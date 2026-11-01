import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { addTask, completeTask } from '../data/actions'
import { useSession } from '../data/session'
import { useRows } from '../data/store'
import type { Task } from '../data/types'
import { daysUntil, dueLabel, today } from '../lib/dates'
import { STARTER_TASKS } from '../lib/starters'
import { AddBar, Avatar, CheckButton, Choices, Empty, Plaque, Sheet } from '../ui/parts'
import { useToast } from '../ui/Toast'

function groupOf(task: Task) {
  if (!task.due_date) return 'Sans date'
  const delta = daysUntil(task.due_date)
  if (delta < 0) return 'En retard'
  if (delta === 0) return "Aujourd'hui"
  return 'À venir'
}
const GROUPS = ['En retard', "Aujourd'hui", 'À venir', 'Sans date']

export function Tasks() {
  const { store, household, me, partner, members } = useSession()
  const tasks = useRows(store, 'tasks')
  const { show } = useToast()
  const [filter, setFilter] = useState<'all' | string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const open = tasks.filter((task) => !task.done_at)
  const visible = open
    .filter((task) => filter === 'all' || task.assignee === filter || task.assignee === null)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.created_at.localeCompare(b.created_at))
  const done = tasks.filter((task) => task.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!)).slice(0, 20)
  const editing = tasks.find((task) => task.id === editingId) ?? null

  return (
    <>
      <Plaque title="Tâches" subtitle={done.length > 0 ? `${done.length} terminée${done.length > 1 ? 's' : ''} récemment` : undefined} count={open.length} unit="à faire" />

      <AddBar label="Ajouter une tâche" placeholder="Ajouter une tâche…" onAdd={(title) => addTask(store, household.id, title)} />

      {partner && (
        <div className="segmented" role="group" aria-label="Filtrer les tâches">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Toutes</button>
          <button type="button" aria-pressed={filter === me.user_id} onClick={() => setFilter(me.user_id)}>Pour moi</button>
          <button type="button" aria-pressed={filter === partner.user_id} onClick={() => setFilter(partner.user_id)}>Pour {partner.display_name}</button>
        </div>
      )}

      {tasks.length === 0 && (
        <Empty
          title="Aucune tâche"
          body="Ajoutez la première au-dessus, ou partez de la liste d'emménagement : assurance, compteurs, changement d'adresse…"
          action="Ajouter la liste d'emménagement"
          onAction={() => STARTER_TASKS.forEach((title) => addTask(store, household.id, title))}
        />
      )}
      {tasks.length > 0 && visible.length === 0 && <Empty title="Tout est fait" body="Plus aucune tâche dans cette liste." />}

      {GROUPS.map((group) => {
        const rows = visible.filter((task) => groupOf(task) === group)
        if (rows.length === 0) return null
        return (
          <section className="section" key={group}>
            <h2 className="section-title" data-late={group === 'En retard' || undefined}>{group}</h2>
            <ul className="list">
              {rows.map((task) => (
                <li className="row" key={task.id}>
                  <CheckButton label={`${task.title} : fait`} onClick={() => show(`${task.title} : fait`, completeTask(store, task, me.user_id))} />
                  <button type="button" className="row-main row-open" onClick={() => setEditingId(task.id)}>
                    <span className="row-title">{task.title}</span>
                    {task.due_date && <span className="row-meta" data-late={daysUntil(task.due_date) < 0 || undefined}>{dueLabel(task.due_date)}</span>}
                  </button>
                  <Avatar member={members.find((member) => member.user_id === task.assignee)} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {done.length > 0 && (
        <details className="section done-list">
          <summary className="section-title">Terminées ({done.length})</summary>
          <ul className="list">
            {done.map((task) => (
              <li className="row" key={task.id}>
                <CheckButton
                  checked
                  label={`${task.title} : remettre à faire`}
                  onClick={() => store.upsert('tasks', { ...task, done_at: null, done_by: null })}
                />
                <button type="button" className="row-main row-open" onClick={() => setEditingId(task.id)}>
                  <span className="row-title row-title-done">{task.title}</span>
                </button>
                <Avatar member={members.find((member) => member.user_id === task.done_by)} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && <TaskSheet key={editing.id} task={editing} onClose={() => setEditingId(null)} />}
    </>
  )
}

function TaskSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const { store, members } = useSession()
  const { show } = useToast()
  const [title, setTitle] = useState(task.title)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [assignee, setAssignee] = useState<string | null>(task.assignee)

  const save = () => {
    if (title.trim()) store.upsert('tasks', { ...task, title: title.trim(), due_date: dueDate || null, assignee })
    onClose()
  }

  return (
    <Sheet title="Modifier la tâche" onClose={onClose}>
      <form className="form" onSubmit={(event) => { event.preventDefault(); save() }}>
        <label className="field">
          <span>Tâche</span>
          <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
        </label>
        <label className="field">
          <span>Pour quand ?</span>
          <input id="task-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <div className="chips">
          <button type="button" className="chip" onClick={() => setDueDate(today())}>Aujourd'hui</button>
          <button type="button" className="chip" onClick={() => setDueDate('')}>Pas de date</button>
        </div>
        <Choices
          legend="Qui s'en occupe ?"
          value={assignee}
          onChange={setAssignee}
          options={[{ value: null, label: "L'un de nous" }, ...members.map((member) => ({ value: member.user_id as string | null, label: member.display_name }))]}
        />
        <div className="sheet-actions">
          <button
            type="button"
            className="button button-danger"
            onClick={() => {
              store.remove('tasks', task.id)
              show(`${task.title} : supprimée`, () => store.upsert('tasks', task))
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
