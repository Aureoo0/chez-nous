import { useEffect, useState } from 'react'
import { Lightbulb, ListChecks, ShoppingBasket, Sparkles, Sun, WifiOff, type LucideIcon } from 'lucide-react'
import { useSession } from './data/session'
import { usePending } from './data/store'
import { Chores } from './pages/Chores'
import { Home } from './pages/Home'
import { Shopping } from './pages/Shopping'
import { Tasks } from './pages/Tasks'
import { Today } from './pages/Today'

const TABS: { id: string; label: string; icon: LucideIcon; page: () => React.JSX.Element }[] = [
  { id: 'aujourdhui', label: "Aujourd'hui", icon: Sun, page: Today },
  { id: 'courses', label: 'Courses', icon: ShoppingBasket, page: Shopping },
  { id: 'taches', label: 'Tâches', icon: ListChecks, page: Tasks },
  { id: 'menage', label: 'Ménage', icon: Sparkles, page: Chores },
  { id: 'maison', label: 'Maison', icon: Lightbulb, page: Home },
]

const currentTab = () => {
  const hash = window.location.hash.slice(1)
  return TABS.some((tab) => tab.id === hash) ? hash : TABS[0].id
}

export function App() {
  const { store } = useSession()
  const pending = usePending(store)
  const [tab, setTab] = useState(currentTab)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onHash = () => setTab(currentTab())
    const onNetwork = () => setOnline(navigator.onLine)
    window.addEventListener('hashchange', onHash)
    window.addEventListener('online', onNetwork)
    window.addEventListener('offline', onNetwork)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('online', onNetwork)
      window.removeEventListener('offline', onNetwork)
    }
  }, [])

  const Page = TABS.find((candidate) => candidate.id === tab)!.page

  return (
    <div className="app">
      <main className="screen" key={tab}>
        <Page />
      </main>
      {!online && (
        <p className="offline" role="status">
          <WifiOff size={16} aria-hidden="true" />
          {pending > 0
            ? `Hors ligne : ${pending} ${pending > 1 ? 'modifications partiront' : 'modification partira'} au retour du réseau`
            : 'Hors ligne : vos listes restent utilisables'}
        </p>
      )}
      <nav className="tabs" aria-label="Sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} className="tab" aria-current={tab === id ? 'page' : undefined}>
            <Icon size={23} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
