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

/** Jours avant la prochaine fois : 0 aujourd'hui, négatif en retard. Jamais faite = à faire aujourd'hui. */
export function choreDelta(chore: Pick<Chore, 'every_days' | 'last_done_at'>) {
  if (!chore.last_done_at) return 0
  return dayNumber(new Date(chore.last_done_at)) + chore.every_days - dayNumber(new Date())
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
