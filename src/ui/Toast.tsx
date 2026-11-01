import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type Toast = { id: number; message: string; undo?: () => void }
type ToastApi = { show: (message: string, undo?: () => void) => void }

const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast hors de ToastProvider')
  return api
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const counter = useRef(0)

  const show = useCallback((message: string, undo?: () => void) => {
    window.clearTimeout(timer.current)
    counter.current += 1
    setToast({ id: counter.current, message, undo })
    timer.current = window.setTimeout(() => setToast(null), undo ? 6000 : 4500)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-zone" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                className="toast-undo"
                onClick={() => {
                  toast.undo?.()
                  setToast(null)
                }}
              >
                Annuler
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
