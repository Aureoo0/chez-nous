import type { Chore, ChoreLog } from '../data/types'
import { choreDelta, dayNumber, parseLocalDate, weekdayOf } from './dates'

export type CalendarCell = { day: number; date: Date; inMonth: boolean; isToday: boolean }

/** Les semaines complètes du mois, de lundi à dimanche, avec les jours voisins pour remplir la grille. */
export function monthCells(year: number, month: number): CalendarCell[] {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks = Math.ceil((leading + daysInMonth) / 7)
  const today = dayNumber(new Date())
  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = new Date(year, month, 1 - leading + index)
    const day = dayNumber(date)
    return { day, date, inMonth: date.getMonth() === month, isToday: day === today }
  })
}

export type ChoreState = 'done' | 'due' | 'late' | 'missed' | 'planned'
export type ChoreOnDay = { chore: Chore; state: ChoreState; doneBy: string | null }

/**
 * Prépare la lecture du calendrier : ce qui est prévu ou fait, jour par jour.
 * Passé : les jours fixes sont faits ou manqués, les fréquences n'apparaissent que si elles ont été faites.
 * Avenir : les jours fixes, et les fréquences projetées depuis leur prochaine échéance.
 */
export function choreCalendar(chores: Chore[], log: ChoreLog[]) {
  const today = dayNumber(new Date())
  const entriesByChore = new Map<string, { day: number; doneBy: string }[]>()
  for (const entry of log) {
    const entries = entriesByChore.get(entry.chore_id) ?? []
    entries.push({ day: dayNumber(new Date(entry.done_at)), doneBy: entry.done_by })
    entriesByChore.set(entry.chore_id, entries)
  }

  const fixedDayState = (chore: Chore, weekdays: number[], day: number): ChoreOnDay | null => {
    if (!weekdays.includes(weekdayOf(day))) return null
    const start = dayNumber(chore.schedule_start ? parseLocalDate(chore.schedule_start) : new Date(chore.created_at))
    if (day < start) return null
    if (day > today) return { chore, state: 'planned', doneBy: null }

    // Un jour prévu est fait si la corvée a été cochée avant le jour prévu suivant.
    let next = day + 1
    while (!weekdays.includes(weekdayOf(next))) next += 1
    const entry = entriesByChore.get(chore.id)?.find((candidate) => candidate.day >= day && candidate.day < next)
    if (entry) return { chore, state: 'done', doneBy: entry.doneBy }
    if (chore.last_done_at) {
      const lastDone = dayNumber(new Date(chore.last_done_at))
      if (lastDone >= day && lastDone < next) return { chore, state: 'done', doneBy: chore.last_done_by }
    }
    if (day === today) return { chore, state: 'due', doneBy: null }
    return { chore, state: today + choreDelta(chore) === day ? 'late' : 'missed', doneBy: null }
  }

  const frequencyState = (chore: Chore, day: number): ChoreOnDay | null => {
    if (day <= today) {
      const entry = entriesByChore.get(chore.id)?.find((candidate) => candidate.day === day)
      if (entry) return { chore, state: 'done', doneBy: entry.doneBy }
    }
    if (day < today) return null
    const delta = choreDelta(chore)
    const first = today + Math.max(delta, 0)
    if (day < first || (day - first) % chore.every_days !== 0) return null
    if (day > today) return { chore, state: 'planned', doneBy: null }
    return { chore, state: delta < 0 ? 'late' : 'due', doneBy: null }
  }

  return (day: number) =>
    chores
      .map((chore) => (chore.weekdays?.length ? fixedDayState(chore, chore.weekdays, day) : frequencyState(chore, day)))
      .filter((item): item is ChoreOnDay => item !== null)
}
