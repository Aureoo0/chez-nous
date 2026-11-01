// Passerelle vers l'API distante Philips Hue. Les jetons restent côté serveur.
// Secrets à définir dans Supabase : HUE_CLIENT_ID, HUE_CLIENT_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2'

const HUE = 'https://api.meethue.com'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const clientId = () => Deno.env.get('HUE_CLIENT_ID') ?? ''
const clientSecret = () => Deno.env.get('HUE_CLIENT_SECRET') ?? ''
const appUrl = () => Deno.env.get('APP_URL') ?? 'https://aureoo0.github.io/chez-nous/'
const isConfigured = () => Boolean(clientId() && clientSecret())

type Connection = { household_id: string; access_token: string; refresh_token: string; expires_at: string; app_key: string }
type Resource = Record<string, any>

async function householdOf(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return null
  const { data: member } = await admin.from('members').select('household_id').eq('user_id', data.user.id).maybeSingle()
  return member?.household_id ?? null
}

async function requestToken(params: Record<string, string>) {
  const res = await fetch(`${HUE}/v2/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId()}:${clientSecret()}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  if (!res.ok) throw new Error(`Hue a refusé le jeton (${res.status})`)
  const token = await res.json()
  const lifetime = Number(token.expires_in ?? token.access_token_expires_in ?? 3600)
  return {
    access_token: token.access_token as string,
    refresh_token: token.refresh_token as string,
    expires_at: new Date(Date.now() + lifetime * 1000).toISOString(),
  }
}

async function freshConnection(householdId: string): Promise<Connection | null> {
  const { data } = await admin.from('hue_connections').select('*').eq('household_id', householdId).maybeSingle()
  if (!data) return null
  const connection = data as Connection
  if (new Date(connection.expires_at).getTime() - Date.now() > 60_000) return connection
  const token = await requestToken({ grant_type: 'refresh_token', refresh_token: connection.refresh_token })
  await admin.from('hue_connections').update({ ...token, updated_at: new Date().toISOString() }).eq('household_id', householdId)
  return { ...connection, ...token }
}

async function clip(connection: Connection, path: string, init?: { method: string; body: unknown }) {
  const res = await fetch(`${HUE}/route/clip/v2/resource/${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      'hue-application-key': connection.app_key,
      'Content-Type': 'application/json',
    },
    body: init ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) throw new Error(`Hue a répondu ${res.status} sur ${path}`)
  return (await res.json()).data as Resource[]
}

async function overview(connection: Connection) {
  const [rooms, groups, lights, scenes] = await Promise.all([
    clip(connection, 'room'),
    clip(connection, 'grouped_light'),
    clip(connection, 'light'),
    clip(connection, 'scene'),
  ])
  const groupById = new Map(groups.map((group) => [group.id, group]))
  return {
    rooms: rooms.map((room) => {
      const groupRef = (room.services as Resource[]).find((service) => service.rtype === 'grouped_light')
      const group = groupRef ? groupById.get(groupRef.rid) : undefined
      const deviceIds = new Set((room.children as Resource[]).filter((child) => child.rtype === 'device').map((child) => child.rid))
      return {
        id: room.id,
        name: room.metadata?.name ?? 'Pièce',
        groupId: group?.id ?? null,
        on: Boolean(group?.on?.on),
        brightness: group?.dimming?.brightness ?? null,
        lights: lights
          .filter((light) => deviceIds.has(light.owner?.rid))
          .map((light) => ({
            id: light.id,
            name: light.metadata?.name ?? 'Lampe',
            on: Boolean(light.on?.on),
            brightness: light.dimming?.brightness ?? null,
          })),
      }
    }),
    scenes: scenes.map((scene) => ({ id: scene.id, name: scene.metadata?.name ?? 'Ambiance', roomId: scene.group?.rid ?? null })),
  }
}

async function handleCallback(url: URL) {
  const done = (result: string) => Response.redirect(`${appUrl()}?hue=${result}#maison`, 302)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return done('refuse')
  const { data: pending } = await admin.from('hue_oauth_states').delete().eq('state', state).select('household_id, created_at').maybeSingle()
  if (!pending || Date.now() - new Date(pending.created_at).getTime() > 15 * 60_000) return done('expire')
  try {
    const token = await requestToken({ grant_type: 'authorization_code', code })
    const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }
    const link = await fetch(`${HUE}/route/api/0/config`, { method: 'PUT', headers, body: JSON.stringify({ linkbutton: true }) })
    if (!link.ok) throw new Error(`Pont Hue injoignable (${link.status})`)
    const created = await fetch(`${HUE}/route/api`, { method: 'POST', headers, body: JSON.stringify({ devicetype: 'chez-nous#app' }) })
    const username = (await created.json())?.[0]?.success?.username
    if (!username) throw new Error('Pas de clé renvoyée par le pont Hue')
    await admin.from('hue_connections').upsert({
      household_id: pending.household_id,
      ...token,
      app_key: username,
      updated_at: new Date().toISOString(),
    })
    return done('ok')
  } catch (error) {
    console.error('Connexion Hue échouée', error)
    return done('erreur')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const action = url.pathname.split('/').filter(Boolean).pop()

  if (action === 'callback' && req.method === 'GET') return handleCallback(url)
  if (req.method !== 'POST') return reply(405, { error: 'Méthode non autorisée.' })

  const householdId = await householdOf(req)
  if (!householdId) return reply(401, { error: 'Connexion requise.' })

  try {
    if (action === 'status') {
      const { data } = await admin.from('hue_connections').select('household_id').eq('household_id', householdId).maybeSingle()
      return reply(200, { configured: isConfigured(), connected: Boolean(data) })
    }
    if (!isConfigured()) return reply(409, { error: "Philips Hue n'est pas encore configuré." })

    if (action === 'connect') {
      const state = crypto.randomUUID()
      await admin.from('hue_oauth_states').insert({ state, household_id: householdId })
      const params = new URLSearchParams({ client_id: clientId(), response_type: 'code', state })
      return reply(200, { url: `${HUE}/v2/oauth2/authorize?${params}` })
    }
    if (action === 'disconnect') {
      await admin.from('hue_connections').delete().eq('household_id', householdId)
      return reply(200, { ok: true })
    }

    const connection = await freshConnection(householdId)
    if (!connection) return reply(409, { error: "Le compte Hue n'est pas connecté." })

    if (action === 'overview') return reply(200, await overview(connection))

    const body = await req.json()
    const id = String(body.id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply(400, { error: 'Lampe inconnue.' })

    if (action === 'set') {
      if (body.target !== 'light' && body.target !== 'grouped_light') return reply(400, { error: 'Cible inconnue.' })
      const patch: Resource = {}
      if (typeof body.on === 'boolean') patch.on = { on: body.on }
      if (typeof body.brightness === 'number') patch.dimming = { brightness: Math.min(100, Math.max(1, body.brightness)) }
      await clip(connection, `${body.target}/${id}`, { method: 'PUT', body: patch })
      return reply(200, { ok: true })
    }
    if (action === 'scene') {
      await clip(connection, `scene/${id}`, { method: 'PUT', body: { recall: { action: 'active' } } })
      return reply(200, { ok: true })
    }
    return reply(404, { error: 'Action inconnue.' })
  } catch (error) {
    console.error('Erreur Hue', error)
    return reply(502, { error: 'Philips Hue ne répond pas. Vérifie que le pont est allumé et connecté.' })
  }
})
