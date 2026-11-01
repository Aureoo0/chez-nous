import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { addChore, completeChore } from '../data/actions'
import { useSession } from '../data/session'
import { useRows } from '../data/store'
import type { Chore } from '../data/types'
import { choreDelta, deltaLabel, everyLabel, nextSevenDays, scheduleLabel, today, WEEKDAYS } from '../lib/dates'
import { EVERY_OPTIONS, STARTER_CHORES } from '../lib/starters'
import { AddBar, Avatar, CheckButton, Choices, Empty, Plaque, Sheet } from '../ui/parts'
import { useToast } from '../ui/Toast'

type Row = { chore: Chore; delta: number }
type OpenSheet = { kind: 'edit'; id: string } | { kind: 'new'; title: string; weekdays: number[] }

const hasFixedDays = (chore: Chore) => Boolean(chore.weekdays?.length)

export function Chores() {
  const { store, household, me, members } = useSession()
  const chores = useRows(store, 'chores')
  const { show } = useToast()
  const [view, setView] = useState<'semaine' | 'toutes'>('semaine')
  const [sheet, setSheet] = useState<OpenSheet | null>(null)

  const rows = chores
    .map((chore) => ({ chore, delta: choreDelta(chore) }))
    .sort((a, b) => a.delta - b.delta || a.chore.title.localeCompare(b.chore.title, 'fr'))
  const dueCount = rows.filter(({ delta }) => delta <= 0).length
  const editing = sheet?.kind === 'edit' ? chores.find((chore) => chore.id === sheet.id) : undefined
  const complete = (chore: Chore) => show(`${chore.title} : fait`, completeChore(store, chore, me.user_id))
  const edit = (chore: Chore) => setSheet({ kind: 'edit', id: chore.id })

  return (
    <>
      <Plaque title="Ménage" subtitle={chores.length > 0 ? `${chores.length} corvée${chores.length > 1 ? 's' : ''} suivie${chores.length > 1 ? 's' : ''}` : undefined} count={dueCount} unit="à faire" />

      <AddBar label="Ajouter une corvée" placeholder="Poubelles, grand ménage…" onAdd={(title) => setSheet({ kind: 'new', title: title.trim(), weekdays: [] })} />

      {chores.length === 0 && (
        <Empty
          title="Aucune corvée suivie"
          body="Donnez un jour fixe à chaque corvée, comme le dimanche pour le ménage et le mardi pour les poubelles, ou une fréquence. Ajoutez la vôtre, ou partez des plus courantes."
          action="Ajouter les corvées courantes"
          onAction={() => STARTER_CHORES.forEach((chore) => addChore(store, household.id, chore.title, chore.room, chore.every_days))}
        />
      )}

      {chores.length > 0 && (
        <div className="segmented" role="group" aria-label="Quelle vue afficher ?">
          <button type="button" aria-pressed={view === 'semaine'} onClick={() => setView('semaine')}>Semaine</button>
          <button type="button" aria-pressed={view === 'toutes'} onClick={() => setView('toutes')}>Toutes ({chores.length})</button>
        </div>
      )}

      {chores.length > 0 && view === 'semaine' && (
        <WeekView rows={rows} onComplete={complete} onEdit={edit} onAdd={(weekday) => setSheet({ kind: 'new', title: '', weekdays: [weekday] })} />
      )}

      {chores.length > 0 && view === 'toutes' && (
        <ul className="list section">
          {rows.map(({ chore, delta }) => (
            <li className="row" key={chore.id}>
              <button type="button" className="row-main row-open" onClick={() => edit(chore)}>
                <span className="row-title">{chore.title}</span>
                <span className="row-meta">{[chore.room, scheduleLabel(chore)].filter(Boolean).join(' · ')}</span>
                <span className="pill" data-state={delta < 0 ? 'late' : delta === 0 ? 'due' : 'later'}>
                  {!hasFixedDays(chore) && !chore.last_done_at ? 'Pas encore faite' : deltaLabel(delta)}
                </span>
              </button>
              <Avatar member={members.find((member) => member.user_id === chore.last_done_by)} />
              {(!hasFixedDays(chore) || delta <= 0) && (
                <button type="button" className="button button-small" data-due={delta <= 0 || undefined} onClick={() => complete(chore)}>
                  Fait
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {sheet?.kind === 'new' && <ChoreSheet key="new" draft={sheet} onClose={() => setSheet(null)} />}
      {editing && <ChoreSheet key={editing.id} chore={editing} onClose={() => setSheet(null)} />}
    </>
  )
}

function WeekView({ rows, onComplete, onEdit, onAdd }: {
  rows: Row[]
  onComplete: (chore: Chore) => void
  onEdit: (chore: Chore) => void
  onAdd: (weekday: number) => void
}) {
  const late = rows.filter(({ delta }) => delta < 0)
  return (
    <>
      {late.length > 0 && (
        <section className="section">
          <h2 className="section-title" data-late>En retard</h2>
          <ul className="list">
            {late.map(({ chore, delta }) => (
              <li className="row" key={chore.id}>
                <CheckButton label={`${chore.title} : fait`} onClick={() => onComplete(chore)} />
                <button type="button" className="row-main row-open" onClick={() => onEdit(chore)}>
                  <span className="row-title">{chore.title}</span>
                  <span className="row-meta" data-late>{deltaLabel(delta)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {nextSevenDays().map((day) => {
        const planned = rows.filter(({ chore, delta }) => (hasFixedDays(chore) ? chore.weekdays!.includes(day.weekday) : delta === day.offset))
        return (
          <section className="section day" data-today={day.offset === 0 || undefined} key={day.offset}>
            <div className="day-head">
              <h2>{day.label}</h2>
              <button type="button" className="icon-button" aria-label={`Ajouter une corvée le ${day.name}`} onClick={() => onAdd(day.weekday)}>
                <Plus size={20} aria-hidden="true" />
              </button>
            </div>
            {planned.length === 0 ? (
              <p className="day-empty">Rien de prévu</p>
            ) : (
              <ul className="list">
                {planned.map(({ chore, delta }) => {
                  const toDo = day.offset === 0 && delta <= 0
                  const doneToday = day.offset === 0 && delta > 0
                  return (
                    <li className="row" data-plain={!toDo && !doneToday ? true : undefined} key={chore.id}>
                      {toDo && <CheckButton label={`${chore.title} : fait`} onClick={() => onComplete(chore)} />}
                      {doneToday && (
                        <span className="check" data-checked role="img" aria-label="Déjà fait aujourd'hui">
                          <span className="check-ring"><Check size={18} strokeWidth={3} aria-hidden="true" /></span>
                        </span>
                      )}
                      <button type="button" className="row-main row-open" onClick={() => onEdit(chore)}>
                        <span className={doneToday ? 'row-title row-title-done' : 'row-title'}>{chore.title}</span>
                        {chore.room && <span className="row-meta">{chore.room}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </>
  )
}

function ChoreSheet({ chore, draft, onClose }: { chore?: Chore; draft?: { title: string; weekdays: number[] }; onClose: () => void }) {
  const { store, household } = useSession()
  const { show } = useToast()
  const [title, setTitle] = useState(chore?.title ?? draft?.title ?? '')
  const [room, setRoom] = useState(chore?.room ?? '')
  const [mode, setMode] = useState<'days' | 'every'>(chore && !hasFixedDays(chore) ? 'every' : 'days')
  const [weekdays, setWeekdays] = useState<number[]>(chore?.weekdays ?? draft?.weekdays ?? [])
  const [everyDays, setEveryDays] = useState(chore?.every_days ?? 7)

  const options = EVERY_OPTIONS.includes(everyDays) ? EVERY_OPTIONS : [...EVERY_OPTIONS, everyDays]
  const missingDay = mode === 'days' && weekdays.length === 0
  const toggleDay = (value: number) =>
    setWeekdays((current) => (current.includes(value) ? current.filter((day) => day !== value) : [...current, value]))

  const save = () => {
    if (!title.trim() || missingDay) return
    const fixedDays = mode === 'days' ? [...weekdays].sort((a, b) => a - b) : null
    const sameDays = JSON.stringify(fixedDays) === JSON.stringify(chore?.weekdays?.length ? [...chore.weekdays].sort((a, b) => a - b) : null)
    store.upsert('chores', {
      id: chore?.id ?? crypto.randomUUID(),
      household_id: chore?.household_id ?? household.id,
      title: title.trim(),
      room: room.trim() || null,
      every_days: everyDays,
      weekdays: fixedDays,
      schedule_start: !fixedDays ? null : sameDays ? (chore?.schedule_start ?? null) : today(),
      last_done_at: chore?.last_done_at ?? null,
      last_done_by: chore?.last_done_by ?? null,
      created_at: chore?.created_at ?? new Date().toISOString(),
    })
    onClose()
  }

  return (
    <Sheet title={chore ? 'Modifier la corvée' : 'Nouvelle corvée'} onClose={onClose}>
      <form className="form" onSubmit={(event) => { event.preventDefault(); save() }}>
        <label className="field">
          <span>Corvée</span>
          <input id="chore-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required autoFocus={!title} />
        </label>
        <label className="field">
          <span>Pièce</span>
          <input id="chore-room" value={room} onChange={(event) => setRoom(event.target.value)} maxLength={40} placeholder="Cuisine, salle de bain…" />
        </label>
        <div className="segmented" role="group" aria-label="Quand revient-elle ?">
          <button type="button" aria-pressed={mode === 'days'} onClick={() => setMode('days')}>Jours fixes</button>
          <button type="button" aria-pressed={mode === 'every'} onClick={() => setMode('every')}>Fréquence</button>
        </div>
        {mode === 'days' ? (
          <fieldset className="field">
            <legend>Quels jours ?</legend>
            <div className="weekday-picker">
              {WEEKDAYS.map((day) => (
                <button key={day.value} type="button" className="weekday" aria-label={day.name} aria-pressed={weekdays.includes(day.value)} onClick={() => toggleDay(day.value)}>
                  {day.letter}
                </button>
              ))}
            </div>
            {missingDay && <small>Choisis au moins un jour.</small>}
          </fieldset>
        ) : (
          <Choices
            legend="À quelle fréquence ?"
            value={everyDays}
            onChange={setEveryDays}
            options={options.map((days) => ({ value: days, label: everyLabel(days) }))}
          />
        )}
        <div className="sheet-actions">
          {chore && (
            <button
              type="button"
              className="button button-danger"
              onClick={() => {
                store.remove('chores', chore.id)
                show(`${chore.title} : supprimée`, () => store.upsert('chores', chore))
                onClose()
              }}
            >
              <Trash2 size={18} aria-hidden="true" /> Supprimer
            </button>
          )}
          <button type="submit" className="button button-primary" disabled={missingDay || !title.trim()}>Enregistrer</button>
        </div>
      </form>
    </Sheet>
  )
}
