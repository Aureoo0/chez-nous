import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { Member } from '../data/types'

/** Plaque émaillée en tête de chaque écran : le « numéro » est ce qu'il reste à faire. */
export function Plaque({ title, subtitle, count, unit }: { title: string; subtitle?: string; count?: number; unit?: string }) {
  return (
    <header className="plaque">
      <div className="plaque-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {count !== undefined && (
        <div className="plaque-number">
          <strong>{count}</strong>
          <span>{unit}</span>
        </div>
      )}
    </header>
  )
}

export function Avatar({ member, size = 26 }: { member: Member | null | undefined; size?: number }) {
  if (!member) return null
  return (
    <span className="avatar" style={{ background: member.color, width: size, height: size, fontSize: size * 0.48 }} title={member.display_name}>
      {member.display_name.charAt(0).toUpperCase()}
    </span>
  )
}

export function CheckButton({ label, checked, onClick }: { label: string; checked?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="check" data-checked={checked || undefined} aria-label={label} onClick={onClick}>
      <span className="check-ring">
        <Check size={18} strokeWidth={3} aria-hidden="true" />
      </span>
    </button>
  )
}

export function AddBar({ placeholder, label, suggestions, onAdd }: { placeholder: string; label: string; suggestions?: string[]; onAdd: (value: string) => void }) {
  const [value, setValue] = useState('')
  const inputId = useId()
  const listId = useId()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    onAdd(value)
    setValue('')
  }
  return (
    <form className="addbar" onSubmit={submit}>
      <label className="sr-only" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        value={value}
        placeholder={placeholder}
        maxLength={120}
        autoComplete="off"
        enterKeyHint="done"
        list={suggestions?.length ? listId : undefined}
        onChange={(event) => setValue(event.target.value)}
      />
      {suggestions && suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
        </datalist>
      )}
      <button type="submit" className="addbar-button" aria-label={label} disabled={!value.trim()}>
        <Plus size={24} aria-hidden="true" />
      </button>
    </form>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" aria-label="Fermer" onClick={onClose}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function Choices<T extends string | number | null>({ legend, value, options, onChange }: {
  legend: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div className="chips">
        {options.map((option) => (
          <button key={String(option.value)} type="button" className="chip" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Empty({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action && <button type="button" className="button button-primary" onClick={onAction}>{action}</button>}
    </div>
  )
}
