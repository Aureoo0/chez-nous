import { useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { addChore, completeChore } from '../data/actions'
import { useSession } from '../data/session'
import { useRows } from '../data/store'
import type { Chore, Member } from '../data/types'
import { choreCalendar, monthCells, type ChoreOnDay, type ChoreState } from '../lib/calendar'
import { choreDelta, dayNumber, deltaLabel, everyLabel, longDate, monthLabel, scheduleLabel, today, weekdayOf, WEEKDAYS } from '../lib/dates'
import { CHORE_COLORS, EVERY_OPTIONS, STARTER_CHORES } from '../lib/starters'
import { AddBar, Avatar, CheckButton, Choices, Empty, Plaque, Sheet } from '../ui/parts'
import { useToast } from '../ui/Toast'

type Row = { chore: Chore; delta: number }
type OpenSheet = { kind: 'edit'; id: string } | { kind: 'new'; title: string; weekdays: number[] }

const hasFixedDays = (chore: Chore) => Boolean(chore.weekdays?.length)
const STATE_WORDS: Record<ChoreState, string> = { done: 'fait', due: 'à faire', late: 'en retard', missed: 'pas fait', planned: 'prévu' }
const MAX_CHIPS = 3

export function Chores() {
  const { store, household, me, members } = useSession()
  const chores = useRows(store, 'chores')
  const log = useRows(store, 'chore_log')
  const { show } = useToast()
  const [view, setView] = useState<'calendrier' | 'toutes'>('calendrier')
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

      {(chores.length === 0 || view === 'toutes') && (
        <AddBar label="Ajouter une corvée" placeholder="Poubelles, grand ménage…" onAdd={(title) => setSheet({ kind: 'new', title: title.trim(), weekdays: [] })} />
      )}

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
          <button type="button" aria-pressed={view === 'calendrier'} onClick={() => setView('calendrier')}>Calendrier</button>
          <button type="button" aria-pressed={view === 'toutes'} onClick={() => setView('toutes')}>Toutes ({chores.length})</button>
        </div>
      )}

      {chores.length > 0 && view === 'calendrier' && (
        <MonthView
          rows={rows}
          members={members}
          log={log}
          onComplete={complete}
          onEdit={edit}
          onAdd={(weekday) => setSheet({ kind: 'new', title: '', weekdays: [weekday] })}
        />
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

function MonthView({ rows, members, log, onComplete, onEdit, onAdd }: {
  rows: Row[]
  members: Member[]
  log: ReturnType<typeof useRows<'chore_log'>>
  onComplete: (chore: Chore) => void
  onEdit: (chore: Chore) => void
  onAdd: (weekday: number) => void
}) {
  const now = new Date()
  const todayNumber = dayNumber(now)
  const [shown, setShown] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selected, setSelected] = useState(todayNumber)
  const detail = useRef<HTMLElement>(null)

  // Même ordre sur les deux téléphones, pour qu'une corvée y garde la même couleur.
  const ordered = useMemo(
    () => rows.map(({ chore }) => chore).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
    [rows],
  )
  const colorOf = (chore: Chore) => CHORE_COLORS[ordered.indexOf(chore) % CHORE_COLORS.length]
  const onDay = choreCalendar(ordered, log)
  const cells = monthCells(shown.year, shown.month)
  const isCurrentMonth = shown.year === now.getFullYear() && shown.month === now.getMonth()

  const moveMonth = (change: number) => {
    const target = new Date(shown.year, shown.month + change, 1)
    setShown({ year: target.getFullYear(), month: target.getMonth() })
  }

  const selectedCell = cells.find((cell) => cell.day === selected)
  const selectedDate = selectedCell?.date ?? new Date(now.getFullYear(), now.getMonth(), now.getDate() + selected - todayNumber)
  // Le jour même, on retrouve aussi les jours fixes oubliés, pour pouvoir les cocher.
  const overdue: ChoreOnDay[] = selected === todayNumber
    ? rows.filter(({ chore, delta }) => hasFixedDays(chore) && delta < 0).map(({ chore }) => ({ chore, state: 'late', doneBy: null }))
    : []
  const selectedItems = [...overdue, ...onDay(selected)]

  return (
    <>
      <section className="cal" aria-label="Calendrier du ménage">
        <div className="cal-nav">
          <h2>{monthLabel(shown.year, shown.month)}</h2>
          {!isCurrentMonth && (
            <button
              type="button"
              className="button button-small"
              onClick={() => {
                setShown({ year: now.getFullYear(), month: now.getMonth() })
                setSelected(todayNumber)
              }}
            >
              Aujourd'hui
            </button>
          )}
          <button type="button" className="icon-button" aria-label="Mois précédent" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" aria-label="Mois suivant" onClick={() => moveMonth(1)}>
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((day) => <span className="cal-head" key={day.value} aria-hidden="true">{day.name.slice(0, 2)}</span>)}
          {cells.map((cell) => {
            const items = onDay(cell.day)
            const summary = items.length === 0 ? 'rien de prévu' : items.map(({ chore, state }) => `${chore.title}, ${STATE_WORDS[state]}`).join(' ; ')
            return (
              <button
                key={cell.day}
                type="button"
                className="cal-cell"
                data-outside={!cell.inMonth || undefined}
                data-today={cell.isToday || undefined}
                aria-pressed={cell.day === selected}
                aria-current={cell.isToday ? 'date' : undefined}
                aria-label={`${longDate(cell.date)} : ${summary}`}
                onClick={() => {
                  setSelected(cell.day)
                  if (!cell.inMonth) setShown({ year: cell.date.getFullYear(), month: cell.date.getMonth() })
                  detail.current?.scrollIntoView({ block: 'nearest' })
                }}
              >
                <span className="cal-day">{cell.date.getDate()}</span>
                {items.slice(0, MAX_CHIPS).map(({ chore, state }) => (
                  <span
                    className="cal-chip"
                    data-state={state}
                    key={chore.id}
                    style={state === 'planned' || state === 'due' ? { background: colorOf(chore) } : undefined}
                  >
                    {chore.title}
                  </span>
                ))}
                {items.length > MAX_CHIPS && <span className="cal-more">+{items.length - MAX_CHIPS}</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="section day" ref={detail}>
        <div className="day-head">
          <h2>{longDate(selectedDate)}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={`Ajouter une corvée le ${WEEKDAYS.find((day) => day.value === weekdayOf(selected))?.name}`}
            onClick={() => onAdd(weekdayOf(selected))}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
        {selectedItems.length === 0 ? (
          <p className="day-empty">Rien de prévu ce jour-là.</p>
        ) : (
          <ul className="list">
            {selectedItems.map(({ chore, state, doneBy }) => {
              const delta = choreDelta(chore)
              const meta = [chore.room, state === 'late' ? deltaLabel(delta) : state === 'missed' ? 'Pas fait' : null].filter(Boolean).join(' · ')
              return (
                <li className="row" key={`${chore.id}-${state}`}>
                  {(state === 'due' || state === 'late') && <CheckButton label={`${chore.title} : fait`} onClick={() => onComplete(chore)} />}
                  {state === 'done' && (
                    <span className="check" data-checked role="img" aria-label="Fait">
                      <span className="check-ring"><Check size={18} strokeWidth={3} aria-hidden="true" /></span>
                    </span>
                  )}
                  {(state === 'planned' || state === 'missed') && (
                    <span className="check">
                      <span className="cal-dot" data-state={state} style={state === 'planned' ? { background: colorOf(chore) } : undefined} />
                    </span>
                  )}
                  <button type="button" className="row-main row-open" onClick={() => onEdit(chore)}>
                    <span className={state === 'done' ? 'row-title row-title-done' : 'row-title'}>{chore.title}</span>
                    {meta && <span className="row-meta" data-late={state === 'late' || state === 'missed' || undefined}>{meta}</span>}
                  </button>
                  {state === 'done' && <Avatar member={members.find((member) => member.user_id === doneBy)} />}
                </li>
              )
            })}
          </ul>
        )}
      </section>
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
