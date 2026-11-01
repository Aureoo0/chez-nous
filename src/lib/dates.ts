import type { Chore } from '../data/types'

const MS_PER_DAY = 86_400_000

export function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const today = () => toDateString(new Date())

function dayNumber(date: Date) {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY)
}

function parseLocalDate(value: string) {
  const [year, month, dayOfMonth] = value.split('-').map(Number)
  return new Date(year, month - 1, dayOfMonth)
}

/** Nombre de jours avant la date, négatif si elle est passée. */
export function daysUntil(value: string) {
  return dayNumber(parseLocalDate(value)) - dayNumber(new Date())
}

// Le 1er janvier 1970, jour 0, était un jeudi.
const weekdayOf = (day: number) => (day + 4) % 7

/**
 * Jours avant la prochaine fois : 0 aujourd'hui, négatif en retard.
 * À jours fixes, chaque jour prévu attend d'être fait, sauf s'il précède la mise en place du calendrier.
 * Sinon, une corvée jamais faite est à faire aujourd'hui.
 */
export function choreDelta(chore: Pick<Chore, 'every_days' | 'last_done_at' | 'weekdays' | 'schedule_start' | 'created_at'>) {
  const now = dayNumber(new Date())
  const lastDone = chore.last_done_at ? dayNumber(new Date(chore.last_done_at)) : null
  if (!chore.weekdays?.length) return lastDone === null ? 0 : lastDone + chore.every_days - now

  const weekdays = chore.weekdays
  const start = dayNumber(chore.schedule_start ? parseLocalDate(chore.schedule_start) : new Date(chore.created_at))
  let previous = now
  while (!weekdays.includes(weekdayOf(previous))) previous -= 1
  if (previous >= start && (lastDone === null || lastDone < previous)) return previous - now
  let next = now + 1
  while (!weekdays.includes(weekdayOf(next))) next += 1
  return next - now
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Les 7 prochains jours, en commençant par aujourd'hui. */
export function nextSevenDays() {
  const now = new Date()
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    const weekday = date.toLocaleDateString('fr-FR', { weekday: 'long' })
    const label = offset === 0 ? `Aujourd'hui, ${weekday}` : offset === 1 ? `Demain, ${weekday}` : capitalize(date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }))
    return { offset, weekday: date.getDay(), name: weekday, label }
  })
}

/** La semaine dans l'ordre français : lundi d'abord. */
export const WEEKDAYS = [
  { value: 1, letter: 'L', name: 'lundi' },
  { value: 2, letter: 'M', name: 'mardi' },
  { value: 3, letter: 'M', name: 'mercredi' },
  { value: 4, letter: 'J', name: 'jeudi' },
  { value: 5, letter: 'V', name: 'vendredi' },
  { value: 6, letter: 'S', name: 'samedi' },
  { value: 0, letter: 'D', name: 'dimanche' },
]

export function scheduleLabel(chore: Pick<Chore, 'every_days' | 'weekdays'>) {
  if (!chore.weekdays?.length) return everyLabel(chore.every_days)
  if (chore.weekdays.length === 7) return 'Chaque jour'
  const names = WEEKDAYS.filter((day) => chore.weekdays!.includes(day.value)).map((day) => day.name)
  if (names.length === 1) return `Chaque ${names[0]}`
  return capitalize(new Intl.ListFormat('fr-FR', { type: 'conjunction' }).format(names))
}

export function deltaLabel(delta: number) {
  if (delta < -1) return `En retard de ${-delta} jours`
  if (delta === -1) return 'En retard d\'un jour'
  if (delta === 0) return "Aujourd'hui"
  if (delta === 1) return 'Demain'
  return `Dans ${delta} jours`
}

export function dueLabel(value: string) {
  const delta = daysUntil(value)
  if (delta >= -1 && delta <= 1) return deltaLabel(delta)
  if (delta < 0) return deltaLabel(delta)
  return parseLocalDate(value).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function longToday() {
  const label = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function everyLabel(days: number) {
  const known: Record<number, string> = {
    1: 'Chaque jour',
    3: 'Tous les 3 jours',
    7: 'Chaque semaine',
    14: 'Toutes les 2 semaines',
    30: 'Chaque mois',
    90: 'Tous les 3 mois',
  }
  return known[days] ?? `Tous les ${days} jours`
}
