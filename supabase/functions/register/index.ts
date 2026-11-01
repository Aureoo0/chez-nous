// Crée un compte sans e-mail de confirmation, mais uniquement pour le tout premier compte
// ou pour quelqu'un qui possède un code d'invitation valide : l'app reste réservée à vous deux.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'Méthode non autorisée.' })

  let body: { email?: unknown; password?: unknown; inviteCode?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'Requête illisible.' })
  }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : ''

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply(400, { error: "Cette adresse e-mail n'est pas valide." })
  if (password.length < 8) return reply(400, { error: 'Choisis un mot de passe de 8 caractères ou plus.' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (inviteCode) {
    const { data: household, error } = await admin.from('households').select('id').eq('invite_code', inviteCode).maybeSingle()
    if (error) return reply(500, { error: 'Le serveur ne répond pas correctement. Réessaie dans un instant.' })
    if (!household) return reply(403, { error: "Ce code d'invitation ne correspond à aucun appart." })
    const { count } = await admin.from('members').select('*', { count: 'exact', head: true }).eq('household_id', household.id)
    if ((count ?? 0) >= 2) return reply(403, { error: 'Cet appart a déjà ses deux habitants.' })
  } else {
    const { count, error } = await admin.from('households').select('*', { count: 'exact', head: true })
    if (error) return reply(500, { error: 'Le serveur ne répond pas correctement. Réessaie dans un instant.' })
    if ((count ?? 0) > 0) return reply(403, { error: "L'appart existe déjà. Demande le code d'invitation à l'autre habitant." })
  }

  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) {
    const taken = /already|registered|exists/i.test(error.message)
    return reply(taken ? 409 : 400, {
      error: taken ? 'Un compte existe déjà avec cette adresse. Connecte-toi plutôt.' : 'Le compte n\'a pas pu être créé. Vérifie ton e-mail et ton mot de passe.',
    })
  }
  return reply(200, { ok: true })
})
