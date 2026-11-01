import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from './session'
import type { HueLight, HueOverview, HueRoom } from './types'
import { useToast } from '../ui/Toast'

export type HueState =
  | { kind: 'loading' }
  | { kind: 'unconfigured' }
  | { kind: 'disconnected' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: HueOverview }

const POLL_MS = 30_000

export function useHue() {
  const { hue } = useSession()
  const { show } = useToast()
  const [state, setState] = useState<HueState>({ kind: 'loading' })
  const timers = useRef(new Map<string, number>())

  const refresh = useCallback(async () => {
    try {
      const status = await hue.status()
      if (!status.configured) return setState({ kind: 'unconfigured' })
      if (!status.connected) return setState({ kind: 'disconnected' })
      setState({ kind: 'ready', data: await hue.overview() })
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Philips Hue ne répond pas pour le moment.' })
    }
  }, [hue])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [refresh])

  const patchData = (change: (data: HueOverview) => HueOverview) =>
    setState((current) => (current.kind === 'ready' ? { kind: 'ready', data: change(current.data) } : current))

  const send = (action: Promise<void>) =>
    action.catch((error: unknown) => {
      show(error instanceof Error ? error.message : "La lampe n'a pas répondu.")
      void refresh()
    })

  const setRoom = (room: HueRoom, patch: { on?: boolean; brightness?: number }) => {
    if (!room.groupId) return
    patchData((data) => ({
      ...data,
      rooms: data.rooms.map((candidate) =>
        candidate.id === room.id
          ? { ...candidate, ...patch, lights: candidate.lights.map((light) => ({ ...light, ...patch })) }
          : candidate,
      ),
    }))
    debounced(`room-${room.id}`, patch.brightness !== undefined, () => void send(hue.set('grouped_light', room.groupId!, patch)))
  }

  const setLight = (room: HueRoom, light: HueLight, patch: { on?: boolean; brightness?: number }) => {
    patchData((data) => ({
      ...data,
      rooms: data.rooms.map((candidate) => {
        if (candidate.id !== room.id) return candidate
        const lights = candidate.lights.map((item) => (item.id === light.id ? { ...item, ...patch } : item))
        return { ...candidate, lights, on: lights.some((item) => item.on) }
      }),
    }))
    debounced(`light-${light.id}`, patch.brightness !== undefined, () => void send(hue.set('light', light.id, patch)))
  }

  // Un curseur envoie des dizaines de valeurs : seule la dernière part vers le pont Hue.
  const debounced = (key: string, wait: boolean, run: () => void) => {
    window.clearTimeout(timers.current.get(key))
    if (!wait) return run()
    timers.current.set(key, window.setTimeout(run, 300))
  }

  const recall = (sceneId: string) => {
    void send(hue.recall(sceneId)).then(() => window.setTimeout(() => void refresh(), 800))
  }

  const connect = async () => {
    try {
      window.location.href = await hue.connect()
    } catch (error) {
      show(error instanceof Error ? error.message : 'La connexion à Philips Hue a échoué.')
    }
  }

  const disconnect = async () => {
    await send(hue.disconnect())
    void refresh()
  }

  return { state, refresh, setRoom, setLight, recall, connect, disconnect }
}
