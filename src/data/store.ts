import { useSyncExternalStore } from 'react'
import { OfflineError, type Backend, type TableName, type Tables } from './types'

// Les listes restent utilisables sans réseau, typiquement au fond d'un supermarché :
// chaque modification s'applique tout de suite, puis part vers le serveur dès que possible.

type AnyRow = { id: string }
type Op = { table: TableName; kind: 'upsert'; row: AnyRow } | { table: TableName; kind: 'delete'; id: string }

const TABLES: TableName[] = ['shopping_items', 'tasks', 'chores', 'chore_log', 'devices']
const RETRY_MS = 15_000

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Stockage indisponible : l'app continue, sans copie locale.
  }
}

function applyOp(rows: AnyRow[], op: Op): AnyRow[] {
  if (op.kind === 'delete') return rows.filter((row) => row.id !== op.id)
  const index = rows.findIndex((row) => row.id === op.row.id)
  if (index === -1) return [...rows, op.row]
  const next = rows.slice()
  next[index] = op.row
  return next
}

export class Store {
  private data = {} as Record<TableName, AnyRow[]>
  private outbox: Op[]
  private listeners = new Set<() => void>()
  private flushing = false
  private retryTimer: number | undefined
  private refreshTimer: number | undefined
  onError: ((message: string) => void) | null = null

  constructor(
    private backend: Backend,
    private householdId: string,
  ) {
    for (const table of TABLES) this.data[table] = read(this.key(table), [])
    this.outbox = read(this.key('outbox'), [])
  }

  start() {
    const unsubscribe = this.backend.subscribe(() => this.scheduleRefresh())
    const wake = () => {
      if (document.visibilityState === 'visible') {
        void this.refresh()
        void this.flush()
      }
    }
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', wake)
    void this.flush()
    void this.refresh()
    return () => {
      unsubscribe()
      window.removeEventListener('online', wake)
      document.removeEventListener('visibilitychange', wake)
      window.clearTimeout(this.retryTimer)
      window.clearTimeout(this.refreshTimer)
    }
  }

  rows<T extends TableName>(table: T) {
    return this.data[table] as unknown as Tables[T][]
  }

  pending = () => this.outbox.length

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  upsert<T extends TableName>(table: T, row: Tables[T]) {
    this.enqueue({ table, kind: 'upsert', row })
  }

  remove(table: TableName, id: string) {
    this.enqueue({ table, kind: 'delete', id })
  }

  private key(name: string) {
    return `cheznous:v1:${this.householdId}:${name}`
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }

  private enqueue(op: Op) {
    this.data[op.table] = applyOp(this.data[op.table], op)
    write(this.key(op.table), this.data[op.table])
    this.outbox.push(op)
    write(this.key('outbox'), this.outbox)
    this.emit()
    void this.flush()
  }

  private async flush() {
    if (this.flushing) return
    this.flushing = true
    let rejected = false
    try {
      while (this.outbox.length > 0) {
        const op = this.outbox[0]
        try {
          if (op.kind === 'upsert') await this.backend.upsert(op.table, op.row as never)
          else await this.backend.remove(op.table, op.id)
        } catch (error) {
          if (error instanceof OfflineError) {
            window.clearTimeout(this.retryTimer)
            this.retryTimer = window.setTimeout(() => void this.flush(), RETRY_MS)
            break
          }
          rejected = true
          this.onError?.("Une modification a été refusée par le serveur. La liste vient d'être remise à jour.")
        }
        this.outbox.shift()
        write(this.key('outbox'), this.outbox)
      }
    } finally {
      this.flushing = false
      this.emit()
    }
    if (rejected) void this.refresh()
  }

  private scheduleRefresh() {
    window.clearTimeout(this.refreshTimer)
    this.refreshTimer = window.setTimeout(() => void this.refresh(), 150)
  }

  private async refresh() {
    await Promise.all(
      TABLES.map(async (table) => {
        try {
          const fetched = (await this.backend.fetchAll(table)) as AnyRow[]
          // Les modifications pas encore envoyées passent par-dessus ce que renvoie le serveur.
          const merged = this.outbox.filter((op) => op.table === table).reduce(applyOp, fetched)
          this.data[table] = merged
          write(this.key(table), merged)
        } catch (error) {
          if (!(error instanceof OfflineError)) console.error(`Lecture de ${table} impossible`, error)
        }
      }),
    )
    this.emit()
  }
}

export function useRows<T extends TableName>(store: Store, table: T) {
  return useSyncExternalStore(store.subscribe, () => store.rows(table))
}

export function usePending(store: Store) {
  return useSyncExternalStore(store.subscribe, store.pending)
}
