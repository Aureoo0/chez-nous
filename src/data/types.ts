export type Household = { id: string; name: string; invite_code: string }
export type Member = { household_id: string; user_id: string; display_name: string; color: string }

export type ShoppingItem = {
  id: string
  household_id: string
  name: string
  quantity: string | null
  category: string
  status: 'needed' | 'stocked'
  updated_at: string
}

export type Task = {
  id: string
  household_id: string
  title: string
  due_date: string | null
  assignee: string | null
  done_at: string | null
  done_by: string | null
  created_at: string
}

export type Chore = {
  id: string
  household_id: string
  title: string
  room: string | null
  every_days: number
  last_done_at: string | null
  last_done_by: string | null
  created_at: string
}

export type ChoreLog = { id: string; household_id: string; chore_id: string; done_by: string; done_at: string }

export type DeviceApp = 'google_home' | 'alexa' | 'autre'
export type Device = { id: string; household_id: string; name: string; room: string | null; app: DeviceApp; created_at: string }

export type Tables = {
  shopping_items: ShoppingItem
  tasks: Task
  chores: Chore
  chore_log: ChoreLog
  devices: Device
}
export type TableName = keyof Tables

export class OfflineError extends Error {}

export interface Backend {
  fetchAll<T extends TableName>(table: T): Promise<Tables[T][]>
  upsert<T extends TableName>(table: T, row: Tables[T]): Promise<void>
  remove(table: TableName, id: string): Promise<void>
  subscribe(onChange: () => void): () => void
}

export type HueLight = { id: string; name: string; on: boolean; brightness: number | null }
export type HueRoom = { id: string; name: string; groupId: string | null; on: boolean; brightness: number | null; lights: HueLight[] }
export type HueScene = { id: string; name: string; roomId: string | null }
export type HueOverview = { rooms: HueRoom[]; scenes: HueScene[] }

export interface HueClient {
  status(): Promise<{ configured: boolean; connected: boolean }>
  connect(): Promise<string>
  disconnect(): Promise<void>
  overview(): Promise<HueOverview>
  set(target: 'light' | 'grouped_light', id: string, patch: { on?: boolean; brightness?: number }): Promise<void>
  recall(sceneId: string): Promise<void>
}
