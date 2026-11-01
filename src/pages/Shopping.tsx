import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { addItem, setItemStatus } from '../data/actions'
import { useSession } from '../data/session'
import { useRows } from '../data/store'
import type { ShoppingItem } from '../data/types'
import { CATEGORIES, STARTER_ITEMS } from '../lib/starters'
import { AddBar, CheckButton, Empty, Plaque, Sheet } from '../ui/parts'
import { useToast } from '../ui/Toast'

function byCategory(items: ShoppingItem[]) {
  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.category === category).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  })).filter((group) => group.items.length > 0)
}

export function Shopping() {
  const { store, household } = useSession()
  const items = useRows(store, 'shopping_items')
  const { show } = useToast()
  const [view, setView] = useState<'needed' | 'stocked'>('needed')
  const [editingId, setEditingId] = useState<string | null>(null)

  const needed = useMemo(() => items.filter((item) => item.status === 'needed'), [items])
  const stocked = useMemo(() => items.filter((item) => item.status === 'stocked'), [items])
  const editing = items.find((item) => item.id === editingId) ?? null
  const groups = byCategory(view === 'needed' ? needed : stocked)

  return (
    <>
      <Plaque title="Courses" subtitle={stocked.length > 0 ? `${stocked.length} à la maison` : undefined} count={needed.length} unit="à acheter" />

      <AddBar
        label="Ajouter un article"
        placeholder="Ajouter un article…"
        suggestions={stocked.map((item) => item.name)}
        onAdd={(name) => {
          addItem(store, household.id, name)
          setView('needed')
        }}
      />

      <div className="segmented" role="group" aria-label="Quelle liste afficher ?">
        <button type="button" aria-pressed={view === 'needed'} onClick={() => setView('needed')}>À acheter ({needed.length})</button>
        <button type="button" aria-pressed={view === 'stocked'} onClick={() => setView('stocked')}>À la maison ({stocked.length})</button>
      </div>

      {groups.length === 0 && view === 'needed' && items.length === 0 && (
        <Empty
          title="La liste est vide"
          body="Ajoutez un article au-dessus, ou partez des indispensables d'un nouvel appart : sel, éponges, sacs poubelle…"
          action="Ajouter les indispensables"
          onAction={() => STARTER_ITEMS.forEach((name) => addItem(store, household.id, name))}
        />
      )}
      {groups.length === 0 && view === 'needed' && items.length > 0 && (
        <Empty title="Rien à acheter" body="Quand quelque chose manque, ajoutez-le au-dessus ou retrouvez-le dans « À la maison »." />
      )}
      {groups.length === 0 && view === 'stocked' && (
        <Empty title="Rien pour l'instant" body="Les articles que vous cochez pendant les courses arrivent ici. Quand il n'y en a plus, un geste suffit pour les remettre sur la liste." />
      )}

      {groups.map((group) => (
        <section className="section" key={group.category}>
          <h2 className="section-title">{group.category}</h2>
          <ul className="list">
            {group.items.map((item) => (
              <li className="row" key={item.id}>
                {view === 'needed' && (
                  <CheckButton
                    label={`${item.name} : acheté`}
                    onClick={() => show(`${item.name} : à la maison`, setItemStatus(store, item, 'stocked'))}
                  />
                )}
                <button type="button" className="row-main row-open" onClick={() => setEditingId(item.id)}>
                  <span className="row-title">{item.name}</span>
                  {item.quantity && <span className="row-meta">{item.quantity}</span>}
                </button>
                {view === 'stocked' && (
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => show(`${item.name} : à acheter`, setItemStatus(store, item, 'needed'))}
                  >
                    Il n'y en a plus
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && <ItemSheet key={editing.id} item={editing} onClose={() => setEditingId(null)} />}
    </>
  )
}

function ItemSheet({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const { store } = useSession()
  const { show } = useToast()
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [category, setCategory] = useState(item.category)

  const save = () => {
    if (name.trim()) {
      store.upsert('shopping_items', { ...item, name: name.trim(), quantity: quantity.trim() || null, category, updated_at: new Date().toISOString() })
    }
    onClose()
  }

  return (
    <Sheet title="Modifier l'article" onClose={onClose}>
      <form className="form" onSubmit={(event) => { event.preventDefault(); save() }}>
        <label className="field">
          <span>Nom</span>
          <input id="item-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
        </label>
        <label className="field">
          <span>Quantité</span>
          <input id="item-quantity" value={quantity} onChange={(event) => setQuantity(event.target.value)} maxLength={40} placeholder="2 L, 6, 500 g…" />
        </label>
        <label className="field">
          <span>Rayon</span>
          <select id="item-category" value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="sheet-actions">
          <button
            type="button"
            className="button button-danger"
            onClick={() => {
              store.remove('shopping_items', item.id)
              show(`${item.name} : supprimé`, () => store.upsert('shopping_items', item))
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
