import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Lightbulb, LightbulbOff, LogOut, Trash2 } from 'lucide-react'
import { useSession } from '../data/session'
import { useRows } from '../data/store'
import type { Device, DeviceApp, HueRoom } from '../data/types'
import { useHue } from '../data/useHue'
import { MEMBER_COLORS } from '../lib/starters'
import { AddBar, Choices, Plaque, Sheet } from '../ui/parts'
import { useToast } from '../ui/Toast'

const APPS: Record<DeviceApp, { label: string; url?: string }> = {
  google_home: { label: 'Google Home', url: 'https://home.google.com/' },
  alexa: { label: 'Alexa', url: 'https://alexa.amazon.fr/' },
  autre: { label: 'Autre appli' },
}

const HUE_RETURN: Record<string, string> = {
  ok: 'Votre compte Philips Hue est connecté.',
  refuse: "La connexion à Philips Hue n'a pas été autorisée.",
  expire: 'Cette demande de connexion a expiré. Relance-la depuis cet écran.',
  erreur: "Philips Hue n'a pas finalisé la connexion. Vérifie que le pont est allumé et relié à internet, puis réessaie.",
}

export function Home() {
  const hue = useHue()
  const { store } = useSession()
  const devices = useRows(store, 'devices')
  const { show } = useToast()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('hue')
    if (!result) return
    show(HUE_RETURN[result] ?? HUE_RETURN.erreur)
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  }, [show])

  const litCount = hue.state.kind === 'ready' ? hue.state.data.rooms.flatMap((room) => room.lights).filter((light) => light.on).length : undefined

  return (
    <>
      <Plaque title="Maison" subtitle={`${devices.length} autre${devices.length > 1 ? 's' : ''} objet${devices.length > 1 ? 's' : ''} connecté${devices.length > 1 ? 's' : ''}`} count={litCount} unit={litCount !== undefined && litCount > 1 ? 'lampes allumées' : 'lampe allumée'} />
      <HueSection hue={hue} />
      <Devices devices={devices} />
      <Settings />
    </>
  )
}

function HueSection({ hue }: { hue: ReturnType<typeof useHue> }) {
  const { state } = hue
  return (
    <section className="section">
      <h2 className="section-title">Lampes Philips Hue</h2>
      {state.kind === 'loading' && <p className="quiet-note" aria-busy="true">Recherche de vos lampes…</p>}
      {state.kind === 'unconfigured' && (
        <div className="notice">
          <p>Sans pont Hue, vos lampes se pilotent depuis l'appli Hue, Google Home ou Alexa. Avec un pont relié à votre box et une configuration unique, vous pourrez aussi les piloter d'ici.</p>
        </div>
      )}
      {state.kind === 'disconnected' && (
        <div className="notice">
          <p>Connectez votre compte Philips Hue pour allumer et régler vos lampes d'ici. Il faut un pont Hue relié à votre box.</p>
          <button type="button" className="button button-primary" onClick={() => void hue.connect()}>Connecter notre compte Hue</button>
        </div>
      )}
      {state.kind === 'error' && (
        <div className="notice" data-tone="late">
          <p>{state.message}</p>
          <button type="button" className="button" onClick={() => void hue.refresh()}>Réessayer</button>
        </div>
      )}
      {state.kind === 'ready' && state.data.rooms.length === 0 && (
        <p className="quiet-note">Aucune pièce trouvée. Créez vos pièces dans l'appli Philips Hue : elles apparaîtront ici.</p>
      )}
      {state.kind === 'ready' && (
        <div className="rooms">
          {state.data.rooms.map((room) => (
            <RoomCard key={room.id} room={room} scenes={state.data.scenes.filter((scene) => scene.roomId === room.id)} hue={hue} />
          ))}
        </div>
      )}
    </section>
  )
}

function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" className="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span className="switch-thumb" />
    </button>
  )
}

function RoomCard({ room, scenes, hue }: { room: HueRoom; scenes: { id: string; name: string }[]; hue: ReturnType<typeof useHue> }) {
  const lit = room.lights.filter((light) => light.on).length
  return (
    <article className="room" data-on={room.on || undefined}>
      <div className="room-head">
        <span className="room-bulb">
          {room.on ? <Lightbulb size={22} aria-hidden="true" /> : <LightbulbOff size={22} aria-hidden="true" />}
        </span>
        <div className="row-main">
          <h3>{room.name}</h3>
          <span className="row-meta">{lit === 0 ? 'Éteint' : `${lit} sur ${room.lights.length} allumée${lit > 1 ? 's' : ''}`}</span>
        </div>
        <Switch label={`${room.name} : allumer ou éteindre`} on={room.on} onChange={(on) => hue.setRoom(room, { on })} />
      </div>
      {room.on && room.brightness !== null && (
        <label className="slider">
          <span className="sr-only">Luminosité de {room.name}</span>
          <input
            id={`room-${room.id}`}
            type="range"
            min={1}
            max={100}
            value={room.brightness}
            onChange={(event) => hue.setRoom(room, { brightness: Number(event.target.value) })}
          />
          <output>{Math.round(room.brightness)} %</output>
        </label>
      )}
      {scenes.length > 0 && (
        <div className="chips">
          {scenes.map((scene) => (
            <button key={scene.id} type="button" className="chip" onClick={() => hue.recall(scene.id)}>{scene.name}</button>
          ))}
        </div>
      )}
      {room.lights.length > 1 && (
        <details className="room-lights">
          <summary>Lampe par lampe</summary>
          <ul>
            {room.lights.map((light) => (
              <li key={light.id}>
                <span>{light.name}</span>
                <Switch label={`${light.name} : allumer ou éteindre`} on={light.on} onChange={(on) => hue.setLight(room, light, { on })} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}

function Devices({ devices }: { devices: Device[] }) {
  const { store, household } = useSession()
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = devices.find((device) => device.id === editingId) ?? null
  const sorted = devices.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return (
    <section className="section">
      <h2 className="section-title">Autres objets connectés</h2>
      <p className="section-help">Google Home et Alexa ne permettent pas à une app comme celle-ci de piloter vos objets. Ils restent listés ici, à un geste de la bonne appli.</p>
      <AddBar
        label="Ajouter un objet"
        placeholder="Enceinte, prise, aspirateur…"
        onAdd={(name) => {
          const id = crypto.randomUUID()
          store.upsert('devices', { id, household_id: household.id, name: name.trim(), room: null, app: 'google_home', created_at: new Date().toISOString() })
          setEditingId(id)
        }}
      />
      {sorted.length > 0 && (
        <ul className="list">
          {sorted.map((device) => {
            const app = APPS[device.app]
            return (
              <li className="row" key={device.id}>
                <button type="button" className="row-main row-open" onClick={() => setEditingId(device.id)}>
                  <span className="row-title">{device.name}</span>
                  <span className="row-meta">{[device.room, app.label].filter(Boolean).join(' · ')}</span>
                </button>
                {app.url && (
                  <a className="button button-small" href={app.url} target="_blank" rel="noreferrer">
                    Ouvrir <ExternalLink size={15} aria-hidden="true" />
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {editing && <DeviceSheet key={editing.id} device={editing} onClose={() => setEditingId(null)} />}
    </section>
  )
}

function DeviceSheet({ device, onClose }: { device: Device; onClose: () => void }) {
  const { store } = useSession()
  const { show } = useToast()
  const [name, setName] = useState(device.name)
  const [room, setRoom] = useState(device.room ?? '')
  const [app, setApp] = useState<DeviceApp>(device.app)
  return (
    <Sheet title="Modifier l'objet" onClose={onClose}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) store.upsert('devices', { ...device, name: name.trim(), room: room.trim() || null, app })
          onClose()
        }}
      >
        <label className="field">
          <span>Nom</span>
          <input id="device-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        </label>
        <label className="field">
          <span>Pièce</span>
          <input id="device-room" value={room} onChange={(event) => setRoom(event.target.value)} maxLength={40} />
        </label>
        <Choices
          legend="Il se pilote depuis"
          value={app}
          onChange={setApp}
          options={(Object.keys(APPS) as DeviceApp[]).map((value) => ({ value, label: APPS[value].label }))}
        />
        <div className="sheet-actions">
          <button
            type="button"
            className="button button-danger"
            onClick={() => {
              store.remove('devices', device.id)
              show(`${device.name} : supprimé`, () => store.upsert('devices', device))
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

function Settings() {
  const { household, partner, me, updateMe, signOut } = useSession()
  const { show } = useToast()
  const [name, setName] = useState(me.display_name)
  const installed = window.matchMedia('(display-mode: standalone)').matches

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(household.invite_code)
      show('Code copié.')
    } catch {
      show(`Le code est ${household.invite_code}.`)
    }
  }

  const save = async (patch: { display_name?: string; color?: string }) => {
    try {
      await updateMe(patch)
    } catch {
      show("Ton profil n'a pas pu être enregistré.")
    }
  }

  return (
    <section className="section">
      <h2 className="section-title">Réglages</h2>
      {!partner && (
        <div className="notice">
          <p>Sur son téléphone, l'autre habitant ouvre cette app, touche « J'ai un code » et saisit :</p>
          <div className="invite">
            <code>{household.invite_code}</code>
            <button type="button" className="button button-small" onClick={() => void copyCode()}>
              <Copy size={15} aria-hidden="true" /> Copier
            </button>
          </div>
        </div>
      )}
      {!installed && (
        <div className="notice">
          <p><strong>Installer l'app.</strong> Sur iPhone : Safari, Partager, puis « Sur l'écran d'accueil ». Sur Android : Chrome, menu ⋮, puis « Installer l'application ».</p>
        </div>
      )}
      <form className="form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) void save({ display_name: name.trim() }) }}>
        <label className="field">
          <span>Ton prénom</span>
          <input id="my-name" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => { if (name.trim() && name.trim() !== me.display_name) void save({ display_name: name.trim() }) }} maxLength={40} />
        </label>
        <fieldset className="field">
          <legend>Ta couleur</legend>
          <div className="swatches">
            {MEMBER_COLORS.map((color) => (
              <button key={color} type="button" className="swatch" style={{ background: color }} aria-label={`Couleur ${color}`} aria-pressed={me.color === color} onClick={() => void save({ color })} />
            ))}
          </div>
        </fieldset>
      </form>
      <button type="button" className="button button-quiet button-wide" onClick={() => void signOut()}>
        <LogOut size={18} aria-hidden="true" /> Se déconnecter
      </button>
    </section>
  )
}
