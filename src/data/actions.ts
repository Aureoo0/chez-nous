import { guessCategory } from '../lib/starters'
import type { Store } from './store'
import type { Chore, ShoppingItem, Task } from './types'

const now = () => new Date().toISOString()

/** Ajoute un article, ou le remet « à acheter » s'il existe déjà sous le même nom. */
export function addItem(store: Store, householdId: string, name: string) {
  const clean = name.trim()
  const existing = store.rows('shopping_items').find((item) => item.name.toLowerCase() === clean.toLowerCase())
  if (existing) {
    store.upsert('shopping_items', { ...existing, status: 'needed', updated_at: now() })
    return
  }
  store.upsert('shopping_items', {
    id: crypto.randomUUID(),
    household_id: householdId,
    name: clean,
    quantity: null,
    category: guessCategory(clean),
    status: 'needed',
    updated_at: now(),
  })
}

export function setItemStatus(store: Store, item: ShoppingItem, status: ShoppingItem['status']) {
  store.upsert('shopping_items', { ...item, status, updated_at: now() })
  return () => store.upsert('shopping_items', item)
}

export function addTask(store: Store, householdId: string, title: string) {
  store.upsert('tasks', {
    id: crypto.randomUUID(),
    household_id: householdId,
    title: title.trim(),
    due_date: null,
    assignee: null,
    done_at: null,
    done_by: null,
    created_at: now(),
  })
}

export function completeTask(store: Store, task: Task, userId: string) {
  store.upsert('tasks', { ...task, done_at: now(), done_by: userId })
  return () => store.upsert('tasks', task)
}

export function addChore(store: Store, householdId: string, title: string, room: string | null = null, every_days = 7) {
  store.upsert('chores', {
    id: crypto.randomUUID(),
    household_id: householdId,
    title: title.trim(),
    room,
    every_days,
    last_done_at: null,
    last_done_by: null,
    created_at: now(),
  })
}

export function completeChore(store: Store, chore: Chore, userId: string) {
  const logId = crypto.randomUUID()
  const doneAt = now()
  store.upsert('chores', { ...chore, last_done_at: doneAt, last_done_by: userId })
  store.upsert('chore_log', { id: logId, household_id: chore.household_id, chore_id: chore.id, done_by: userId, done_at: doneAt })
  return () => {
    store.upsert('chores', chore)
    store.remove('chore_log', logId)
  }
}
