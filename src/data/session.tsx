import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isBackendConfigured, remoteBackend, remoteHue, supabase } from './remote'
import { Store } from './store'
import type { Household, HueClient, Member } from './types'
import { Welcome } from '../pages/Welcome'
import { useToast } from '../ui/Toast'

type SessionValue = {
  household: Household
  members: Member[]
  me: Member
  partner: Member | null
  store: Store
  hue: HueClient
  isDemo: boolean
  updateMe: (patch: Partial<Pick<Member, 'display_name' | 'color'>>) => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession hors de SessionProvider')
  return value
}

const CACHE_KEY = 'cheznous:v1:membership'

type Membership = { household: Household; members: Member[]; userId: string }

function readCache(userId: string): Membership | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Membership | null
    return cached?.userId === userId ? cached : null
  } catch {
    return null
  }
}

async function loadMembership(userId: string): Promise<Membership | null> {
  const { data: mine, error } = await supabase.from('members').select('household_id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!mine) return null
  const [household, members] = await Promise.all([
    supabase.from('households').select('id, name, invite_code').eq('id', mine.household_id).single(),
    supabase.from('members').select('household_id, user_id, display_name, color').eq('household_id', mine.household_id),
  ])
  if (household.error) throw household.error
  if (members.error) throw members.error
  const membership = { household: household.data as Household, members: members.data as Member[], userId }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(membership))
  } catch {
    // Sans copie locale, seul le démarrage hors ligne est perdu.
  }
  return membership
}

function Ready({ membership, isDemo, hue, backend, onChanged, onSignOut, children }: {
  membership: Membership
  isDemo: boolean
  hue: HueClient
  backend: ConstructorParameters<typeof Store>[0]
  onChanged: () => void
  onSignOut: () => Promise<void>
  children: ReactNode
}) {
  const { household, members, userId } = membership
  const { show } = useToast()
  const store = useMemo(() => new Store(backend, household.id), [backend, household.id])

  useEffect(() => {
    store.onError = (message) => show(message)
    return store.start()
  }, [store, show])

  useEffect(() => {
    if (isDemo) return
    const channel = supabase
      .channel(`membres-${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, onChanged)
      .subscribe()
    return () => void supabase.removeChannel(channel)
  }, [household.id, isDemo, onChanged])

  const me = members.find((member) => member.user_id === userId) ?? members[0]
  const partner = members.find((member) => member.user_id !== userId) ?? null

  const value = useMemo<SessionValue>(
    () => ({
      household,
      members,
      me,
      partner,
      store,
      hue,
      isDemo,
      signOut: onSignOut,
      updateMe: async (patch) => {
        if (isDemo) return
        const { error } = await supabase.from('members').update(patch).eq('user_id', userId)
        if (error) throw error
        onChanged()
      },
    }),
    [household, members, me, partner, store, hue, isDemo, onSignOut, userId, onChanged],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

type Demo = typeof import('./demo').demo

export function SessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'signedOut' | 'noHousehold' | 'ready' | 'demo'>('loading')
  const [userId, setUserId] = useState<string | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [demo, setDemo] = useState<Demo | null>(null)
  const [loadError, setLoadError] = useState(false)

  const reload = useCallback(async (uid: string) => {
    try {
      const fresh = await loadMembership(uid)
      setLoadError(false)
      setMembership(fresh)
      setPhase(fresh ? 'ready' : 'noHousehold')
    } catch {
      const cached = readCache(uid)
      setMembership(cached)
      setLoadError(!cached)
      setPhase(cached ? 'ready' : 'noHousehold')
    }
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV && (!isBackendConfigured || new URLSearchParams(location.search).has('demo'))) {
      void import('./demo').then((module) => {
        setDemo(module.demo)
        setPhase('demo')
      })
      return
    }
    const onUser = (uid: string | null) => {
      setUserId(uid)
      if (!uid) {
        setMembership(null)
        setPhase('signedOut')
        return
      }
      const cached = readCache(uid)
      if (cached) {
        setMembership(cached)
        setPhase('ready')
      }
      void reload(uid)
    }
    void supabase.auth.getSession().then(({ data }) => onUser(data.session?.user.id ?? null))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Différé : appeler Supabase directement dans ce rappel peut bloquer la session.
        setTimeout(() => onUser(session?.user.id ?? null), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [reload])

  const backend = useMemo(() => (membership ? remoteBackend(membership.household.id) : null), [membership?.household.id])
  const onChanged = useCallback(() => {
    if (userId) void reload(userId)
  }, [reload, userId])
  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(CACHE_KEY)
    } catch {
      // Rien à nettoyer si le stockage est indisponible.
    }
    await supabase.auth.signOut()
  }, [])
  const noop = useCallback(() => undefined, [])
  const noopAsync = useCallback(async () => undefined, [])

  if (phase === 'loading') return <div className="splash" aria-busy="true"><span>Chez nous</span></div>

  if (phase === 'demo' && demo) {
    return (
      <Ready
        membership={{ household: demo.household, members: demo.members, userId: demo.meId }}
        isDemo
        hue={demo.hue}
        backend={demo.backend}
        onChanged={noop}
        onSignOut={noopAsync}
      >
        {children}
      </Ready>
    )
  }

  if (phase === 'ready' && membership && backend) {
    return (
      <Ready membership={membership} isDemo={false} hue={remoteHue} backend={backend} onChanged={onChanged} onSignOut={signOut}>
        {children}
      </Ready>
    )
  }

  return <Welcome signedIn={phase === 'noHousehold'} loadError={loadError} onDone={(uid) => void reload(uid)} onSignOut={signOut} />
}
