import { Check, ChevronRight, Lightbulb, LightbulbOff } from 'lucide-react'
import { completeChore, completeTask } from '../data/actions'
import { useSession } from '../data/session'
import { useRows } from '../data/store'
import { useHue } from '../data/useHue'
import { choreDelta, daysUntil, deltaLabel, dueLabel, longToday } from '../lib/dates'
import { Avatar, CheckButton, Plaque } from '../ui/parts'
import { useToast } from '../ui/Toast'

const THIRTY_DAYS = 30 * 86_400_000

export function Today() {
  const { store, me, members, household } = useSession()
  const tasks = useRows(store, 'tasks')
  const chores = useRows(store, 'chores')
  const items = useRows(store, 'shopping_items')
  const log = useRows(store, 'chore_log')
  const { show } = useToast()
  const hue = useHue()

  const dueTasks = tasks
    .filter((task) => !task.done_at && task.due_date && daysUntil(task.due_date) <= 0)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  const dueChores = chores
    .map((chore) => ({ chore, delta: choreDelta(chore) }))
    .filter(({ delta }) => delta <= 0)
    .sort((a, b) => a.delta - b.delta)
  const needed = items.filter((item) => item.status === 'needed')
  const count = dueTasks.length + dueChores.length

  const since = Date.now() - THIRTY_DAYS
  const recent = log.filter((entry) => new Date(entry.done_at).getTime() >= since)
  const tally = members.map((member) => ({ member, done: recent.filter((entry) => entry.done_by === member.user_id).length }))

  return (
    <>
      <Plaque title={household.name} subtitle={longToday()} count={count} unit="à faire" />

      <section className="section">
        <h2 className="section-title">À faire aujourd'hui</h2>
        {count === 0 ? (
          <p className="quiet-note">
            <Check size={18} aria-hidden="true" /> Rien d'urgent pour aujourd'hui.
          </p>
        ) : (
          <ul className="list">
            {dueChores.map(({ chore, delta }) => (
              <li className="row" key={chore.id}>
                <CheckButton
                  label={`${chore.title} : fait`}
                  onClick={() => show(`${chore.title} : fait`, completeChore(store, chore, me.user_id))}
                />
                <div className="row-main">
                  <span className="row-title">{chore.title}</span>
                  <span className="row-meta" data-late={delta < 0 || undefined}>Ménage · {deltaLabel(delta)}</span>
                </div>
              </li>
            ))}
            {dueTasks.map((task) => (
              <li className="row" key={task.id}>
                <CheckButton
                  label={`${task.title} : fait`}
                  onClick={() => show(`${task.title} : fait`, completeTask(store, task, me.user_id))}
                />
                <div className="row-main">
                  <span className="row-title">{task.title}</span>
                  <span className="row-meta" data-late={daysUntil(task.due_date!) < 0 || undefined}>Tâche · {dueLabel(task.due_date!)}</span>
                </div>
                <Avatar member={members.find((member) => member.user_id === task.assignee)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <a className="section-link" href="#courses">
          <h2 className="section-title">À acheter</h2>
          <span>{needed.length} {needed.length > 1 ? 'articles' : 'article'} <ChevronRight size={16} aria-hidden="true" /></span>
        </a>
        {needed.length === 0 ? (
          <p className="quiet-note"><Check size={18} aria-hidden="true" /> La liste de courses est vide.</p>
        ) : (
          <p className="inline-list">{needed.slice(0, 8).map((item) => item.name).join(', ')}{needed.length > 8 ? '…' : ''}</p>
        )}
      </section>

      {hue.state.kind === 'ready' && hue.state.data.rooms.length > 0 && (
        <section className="section">
          <a className="section-link" href="#maison">
            <h2 className="section-title">Lampes</h2>
            <span>Tout voir <ChevronRight size={16} aria-hidden="true" /></span>
          </a>
          <div className="lamp-grid">
            {hue.state.data.rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className="lamp-tile"
                aria-pressed={room.on}
                onClick={() => hue.setRoom(room, { on: !room.on })}
              >
                {room.on ? <Lightbulb size={20} aria-hidden="true" /> : <LightbulbOff size={20} aria-hidden="true" />}
                <span>{room.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <h2 className="section-title">Ménage sur 30 jours</h2>
          <ul className="tally">
            {tally.map(({ member, done }) => (
              <li key={member.user_id}>
                <Avatar member={member} />
                <span>{member.display_name}</span>
                <strong>{done}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
