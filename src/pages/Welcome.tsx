import { useState, type FormEvent } from 'react'
import { supabase } from '../data/remote'

type Mode = 'create' | 'join' | 'login'

const RPC_MESSAGES: [string, string][] = [
  ['HOUSEHOLD_EXISTS', "L'appart existe déjà. Demande le code d'invitation à l'autre habitant."],
  ['INVALID_CODE', "Ce code d'invitation ne correspond à aucun appart."],
  ['HOUSEHOLD_FULL', 'Cet appart a déjà ses deux habitants.'],
]

async function registerError(error: { context?: Response; message: string }) {
  const details = await error.context?.json?.().catch(() => null)
  return (details?.error as string | undefined) ?? 'Le compte n\'a pas pu être créé. Vérifie ta connexion et réessaie.'
}

export function Welcome({ signedIn, loadError, onDone, onSignOut }: {
  signedIn: boolean
  loadError: boolean
  onDone: (userId: string) => void
  onSignOut: () => Promise<void>
}) {
  const [chosenMode, setMode] = useState<Mode>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [homeName, setHomeName] = useState('Notre appart')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mode: Mode = signedIn && chosenMode === 'login' ? 'create' : chosenMode

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!signedIn && mode !== 'login') {
        const { error: failure } = await supabase.functions.invoke('register', {
          body: { email, password, inviteCode: mode === 'join' ? code : undefined },
        })
        if (failure) throw new Error(await registerError(failure))
      }
      if (!signedIn) {
        const { error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (failure) throw new Error('E-mail ou mot de passe incorrect.')
      }
      if (mode === 'login') return
      const { error: failure } = mode === 'create'
        ? await supabase.rpc('create_household', { p_name: homeName, p_display_name: displayName })
        : await supabase.rpc('join_household', { p_code: code, p_display_name: displayName })
      if (failure) {
        const known = RPC_MESSAGES.find(([key]) => failure.message.includes(key))
        throw new Error(known?.[1] ?? "L'appart n'a pas pu être enregistré. Réessaie dans un instant.")
      }
      const { data } = await supabase.auth.getSession()
      if (data.session) onDone(data.session.user.id)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Quelque chose a échoué. Réessaie dans un instant.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="welcome">
      <header className="plaque plaque-welcome">
        <div className="plaque-text">
          <h1>Chez nous</h1>
          <p>Courses, tâches, ménage et lampes de l'appart, sur vos deux téléphones.</p>
        </div>
      </header>

      {loadError && <p className="form-error" role="alert">Impossible de joindre le serveur. Vérifie ta connexion, puis rouvre l'app.</p>}

      <div className="segmented" role="group" aria-label="Que veux-tu faire ?">
        <button type="button" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>Créer l'appart</button>
        <button type="button" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>J'ai un code</button>
        {!signedIn && <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>Se connecter</button>}
      </div>

      <form className="form" onSubmit={submit}>
        {mode === 'join' && (
          <label className="field">
            <span>Code d'invitation</span>
            <input id="code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required autoCapitalize="characters" autoComplete="off" />
          </label>
        )}
        {mode === 'create' && (
          <label className="field">
            <span>Nom de l'appart</span>
            <input id="home" value={homeName} onChange={(event) => setHomeName(event.target.value)} required maxLength={60} />
          </label>
        )}
        {mode !== 'login' && (
          <label className="field">
            <span>Ton prénom</span>
            <input id="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} autoComplete="given-name" />
          </label>
        )}
        {!signedIn && (
          <>
            <label className="field">
              <span>E-mail</span>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" inputMode="email" />
            </label>
            <label className="field">
              <span>Mot de passe</span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={mode === 'login' ? undefined : 8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {mode !== 'login' && <small>8 caractères ou plus.</small>}
            </label>
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary button-wide" disabled={busy}>
          {busy ? 'Un instant…' : mode === 'create' ? "Créer l'appart" : mode === 'join' ? "Rejoindre l'appart" : 'Se connecter'}
        </button>
      </form>

      {signedIn && (
        <button type="button" className="button button-quiet button-wide" onClick={() => void onSignOut()}>Changer de compte</button>
      )}
    </div>
  )
}
