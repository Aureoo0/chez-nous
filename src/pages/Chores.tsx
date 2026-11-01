import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { addChore, completeChore } from '../data/actions'
import { useSession } from '../data/session'
import { useRows } from '../data/store'
import type { Chore } from '../data/types'
import { choreDelta, deltaLabel, everyLabel } from '../lib/dates'
import { EVERY_OPTIONS, STARTER_CHORES } from '../lib/starters'
import { AddBar, Avatar, Choices, Empty, Plaque, Sheet } from '../ui/parts'
import { useToast } from '../ui/Toast'

export function Chores() {
  const { store, household, me, members } = useSession()
  const chores = useRows(store, 'chores')
  const { show } = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)

  const rows = chores
    .map((chore) => ({ chore, delta: choreDelta(chore) }))
    .sort((a, b) => a.delta - b.delta || a.chore.title.localeCompare(b.chore.title, 'fr'))
  const dueCount = rows.filter(({ delta }) => delta <= 0).length
  const editing = chores.find((chore) => chore.id === editingId) ?? null

  return (
    <>
      <Plaque title="Ménage" subtitle={chores.length > 0 ? `${chores.length} corvées suivies` : undefined} count={dueCount} unit="à faire" />

      <AddBar label="Ajouter une corvée" placeholder="Ajouter une corvée…" onAdd={(title) => addChore(store, household.id, title)} />

      {chores.length === 0 && (
        <Empty
          title="Aucune corvée suivie"
          body="Chaque corvée revient toute seule à la bonne fréquence. Ajoutez la vôtre, ou partez des plus courantes."
          action="Ajouter les corvées courantes"
          onAction={() => STARTER_CHORES.forEach((chore) => addChore(store, household.id, chore.title, chore.room, chore.every_days))}
        />
      )}

      {rows.length > 0 && (
        <ul className="list section">
          {rows.map(({ chore, delta }) => (
            <li className="row" key={chore.id}>
              <button type="button" className="row-main row-open" onClick={() => setEditingId(chore.id)}>
                <span className="row-title">{chore.title}</span>
                <span className="row-meta">{[chore.room, everyLabel(chore.every_days)].filter(Boolean).join(' · ')}</span>
                <span className="pill" data-state={delta < 0 ? 'late' : delta === 0 ? 'due' : 'later'}>{chore.last_done_at || delta !== 0 ? deltaLabel(delta) : 'Pas encore faite'}</span>
              </button>
              <Avatar member={members.find((member) => member.user_id === chore.last_done_by)} />
              <button
                type="button"
                className="button button-small"
                data-due={delta <= 0 || undefined}
                onClick={() => show(`${chore.title} : fait`, completeChore(store, chore, me.user_id))}
              >
                Fait
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && <ChoreSheet key={editing.id} chore={editing} onClose={() => setEditingId(null)} />}
    </>
  )
}

function ChoreSheet({ chore, onClose }: { chore: Chore; onClose: () => void }) {
  const { store } = useSession()
  const { show } = useToast()
  const [title, setTitle] = useState(chore.title)
  const [room, setRoom] = useState(chore.room ?? '')
  const [everyDays, setEveryDays] = useState(chore.every_days)

  const options = EVERY_OPTIONS.includes(chore.every_days) ? EVERY_OPTIONS : [...EVERY_OPTIONS, chore.every_days]

  const save = () => {
    if (title.trim()) store.upsert('chores', { ...chore, title: title.trim(), room: room.trim() || null, every_days: everyDays })
    onClose()
  }

  return (
    <Sheet title="Modifier la corvée" onClose={onClose}>
      <form className="form" onSubmit={(event) => { event.preventDefault(); save() }}>
        <label className="field">
          <span>Corvée</span>
          <input id="chore-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
        </label>
        <label className="field">
          <span>Pièce</span>
          <input id="chore-room" value={room} onChange={(event) => setRoom(event.target.value)} maxLength={40} placeholder="Cuisine, salle de bain…" />
        </label>
        <Choices
          legend="À quelle fréquence ?"
          value={everyDays}
          onChange={setEveryDays}
          options={options.map((days) => ({ value: days, label: everyLabel(days) }))}
        />
        <div className="sheet-actions">
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
          <button type="submit" className="button button-primary">Enregistrer</button>
        </div>
      </form>
    </Sheet>
  )
}
