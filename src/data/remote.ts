import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import { OfflineError, type Backend, type HueClient, type HueOverview, type TableName } from './types'

export const isBackendConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)
export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

function fail(error: { message: string }): never {
  if (!navigator.onLine || /fetch|network|load failed/i.test(error.message)) throw new OfflineError(error.message)
  throw new Error(error.message)
}

export function remoteBackend(householdId: string): Backend {
  return {
    async fetchAll(table) {
      const { data, error } = await supabase.from(table).select('*').eq('household_id', householdId)
      if (error) fail(error)
      return data as never
    },
    async upsert(table, row) {
      const { error } = await supabase.from(table).upsert(row as never)
      if (error) fail(error)
    },
    async remove(table: TableName, id: string) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) fail(error)
    },
    subscribe(onChange) {
      const channel = supabase.channel(`appart-${householdId}`)
      for (const table of ['shopping_items', 'tasks', 'chores', 'chore_log', 'devices']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
      }
      channel.subscribe()
      return () => void supabase.removeChannel(channel)
    },
  }
}

async function callHue<T>(action: string, body: object = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`hue/${action}`, { body })
  if (error) {
    const details = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(details?.error ?? 'Philips Hue ne répond pas pour le moment.')
  }
  return data as T
}

export const remoteHue: HueClient = {
  status: () => callHue('status'),
  connect: async () => (await callHue<{ url: string }>('connect')).url,
  disconnect: async () => void (await callHue('disconnect')),
  overview: () => callHue<HueOverview>('overview'),
  set: async (target, id, patch) => void (await callHue('set', { target, id, ...patch })),
  recall: async (id) => void (await callHue('scene', { id })),
}
