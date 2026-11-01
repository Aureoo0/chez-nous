// Mode démo : uniquement en développement (npm run dev), avec des exemples et sans serveur.
import type { Backend, Chore, ChoreLog, Device, Household, HueClient, HueOverview, Member, ShoppingItem, Tables, TableName, Task } from './types'

const hid = '00000000-0000-4000-8000-000000000001'
const camille = '00000000-0000-4000-8000-00000000000a'
const sasha = '00000000-0000-4000-8000-00000000000b'

const day = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date
}
const dateOnly = (offset: number) => {
  const date = day(offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const id = () => crypto.randomUUID()

const item = (name: string, category: string, status: ShoppingItem['status'], quantity: string | null = null): ShoppingItem => ({
  id: id(), household_id: hid, name, category, status, quantity, updated_at: day(0).toISOString(),
})
const task = (title: string, due: number | null, assignee: string | null = null): Task => ({
  id: id(), household_id: hid, title, due_date: due === null ? null : dateOnly(due), assignee, done_at: null, done_by: null, created_at: day(-1).toISOString(),
})
const chore = (title: string, room: string, every: number, lastAgo: number | null, by: string | null = null, weekdays: number[] | null = null): Chore => ({
  id: id(), household_id: hid, title, room, every_days: every, weekdays, schedule_start: null, last_done_at: lastAgo === null ? null : day(-lastAgo).toISOString(), last_done_by: by, created_at: day(-20).toISOString(),
})

const chores = [
  chore('Sortir les poubelles', 'Cuisine', 7, 5, sasha, [2, 5]),
  chore('Grand ménage', 'Partout', 7, 7, camille, [0]),
  chore('Aspirateur', 'Partout', 7, 7, camille),
  chore('Salle de bain', 'Salle de bain', 7, 3, sasha),
  chore('Changer les draps', 'Chambre', 14, 2, camille),
  chore('Nettoyer le frigo', 'Cuisine', 30, null),
]
const logs: ChoreLog[] = [camille, sasha, camille, sasha, camille].map((done_by, index) => ({
  id: id(), household_id: hid, chore_id: chores[index].id, done_by, done_at: day(-index - 1).toISOString(),
}))
const devices: Device[] = [
  { id: id(), household_id: hid, name: 'Enceinte du salon', room: 'Salon', app: 'alexa', created_at: day(-5).toISOString() },
  { id: id(), household_id: hid, name: 'Prise de la bouilloire', room: 'Cuisine', app: 'google_home', created_at: day(-4).toISOString() },
]

const tables: { [T in TableName]: Tables[T][] } = {
  shopping_items: [
    item('Lait', 'Frais', 'needed', '2 L'),
    item('Tomates', 'Fruits et légumes', 'needed'),
    item('Pâtes', 'Épicerie', 'needed'),
    item('Liquide vaisselle', 'Entretien', 'needed'),
    item('Papier toilette', 'Entretien', 'needed', '12'),
    item('Café', 'Épicerie', 'stocked'),
    item('Riz', 'Épicerie', 'stocked'),
    item('Beurre', 'Frais', 'stocked'),
  ],
  tasks: [
    task("Souscrire l'assurance habitation", -1, camille),
    task("Changer l'adresse à La Poste", 0, sasha),
    task('Monter la bibliothèque', 3),
    task("Mettre nos noms sur l'interphone", null, sasha),
  ],
  chores,
  chore_log: logs,
  devices,
}

const listeners = new Set<() => void>()

const backend: Backend = {
  fetchAll: async (table) => tables[table].slice() as never,
  upsert: async (table, row) => {
    const rows = tables[table] as { id: string }[]
    const index = rows.findIndex((existing) => existing.id === row.id)
    if (index === -1) rows.push(row)
    else rows[index] = row
  },
  remove: async (table, rowId) => {
    tables[table] = (tables[table] as { id: string }[]).filter((row) => row.id !== rowId) as never
  },
  subscribe: (onChange) => {
    listeners.add(onChange)
    return () => listeners.delete(onChange)
  },
}

const hueState: HueOverview = {
  rooms: [
    { id: id(), name: 'Salon', groupId: id(), on: true, brightness: 70, lights: [
      { id: id(), name: 'Lampadaire', on: true, brightness: 70 },
      { id: id(), name: 'Lampe du canapé', on: true, brightness: 55 },
    ] },
    { id: id(), name: 'Chambre', groupId: id(), on: false, brightness: 40, lights: [
      { id: id(), name: 'Chevet gauche', on: false, brightness: 40 },
      { id: id(), name: 'Chevet droit', on: false, brightness: 40 },
    ] },
    { id: id(), name: 'Cuisine', groupId: id(), on: false, brightness: 100, lights: [{ id: id(), name: 'Plafonnier', on: false, brightness: 100 }] },
  ],
  scenes: [],
}
hueState.scenes = [
  { id: id(), name: 'Détente', roomId: hueState.rooms[0].id },
  { id: id(), name: 'Lecture', roomId: hueState.rooms[0].id },
  { id: id(), name: 'Veilleuse', roomId: hueState.rooms[1].id },
]

const hue: HueClient = {
  status: async () => ({ configured: true, connected: true }),
  connect: async () => '#maison',
  disconnect: async () => undefined,
  overview: async () => structuredClone(hueState),
  set: async (target, targetId, patch) => {
    for (const room of hueState.rooms) {
      if (target === 'grouped_light' && room.groupId === targetId) {
        Object.assign(room, patch)
        room.lights.forEach((light) => Object.assign(light, patch))
      }
      for (const light of room.lights) if (target === 'light' && light.id === targetId) Object.assign(light, patch)
      room.on = room.lights.some((light) => light.on)
    }
  },
  recall: async () => undefined,
}

const household: Household = { id: hid, name: 'Notre appart', invite_code: 'K7M2QP9X' }
const members: Member[] = [
  { household_id: hid, user_id: camille, display_name: 'Camille', color: '#D9482B' },
  { household_id: hid, user_id: sasha, display_name: 'Sasha', color: '#0E8A7D' },
]

export const demo = { household, members, meId: camille, backend, hue }
