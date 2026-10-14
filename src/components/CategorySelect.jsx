import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

export default function CategorySelect({ categories, value, onChange, onAdd, onDelete }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const rootRef = useRef(null)
  const selected = categories.find((category) => category.name === value)

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function addCategory(event) {
    event?.preventDefault()
    const name = draft.trim()
    if (!name) return
    setBusy(true)
    setError('')
    try {
      await onAdd(name)
      setDraft('')
    } catch (err) {
      setError(err.message || 'Gagal menambahkan kategori.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteCategory(category) {
    if (!confirm('Hapus kategori "' + category.name + '"?')) return
    setBusy(true)
    setError('')
    try {
      await onDelete(category)
    } catch (err) {
      setError(err.message || 'Gagal menghapus kategori.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="category-select" ref={rootRef}>
      <button
        className="input category-select-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}>
        <span className={selected ? '' : 'category-placeholder'}>{selected?.name || 'Pilih kategori'}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={17} />
      </button>
      {open && (
        <div className="category-menu">
          <div className="category-options" role="listbox" aria-label="Kategori produk">
            <button
              className={'category-option ' + (!value ? 'selected' : '')}
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => { onChange(''); setOpen(false) }}>
              Tanpa kategori
            </button>
            {categories.map((category) => (
              <div className="category-option-row" key={category.id}>
                <button
                  className={'category-option ' + (value === category.name ? 'selected' : '')}
                  type="button"
                  role="option"
                  aria-selected={value === category.name}
                  onClick={() => { onChange(category.name); setOpen(false) }}>
                  {category.name}
                </button>
                <button
                  className="category-delete"
                  type="button"
                  aria-label={'Hapus kategori ' + category.name}
                  title="Hapus kategori"
                  disabled={busy}
                  onClick={() => deleteCategory(category)}>
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="category-add-form">
            <input className="input" value={draft} maxLength={80}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') addCategory(event) }}
              placeholder="Nama kategori baru" aria-label="Nama kategori baru" />
            <button className="btn btn-primary" type="button" disabled={busy || !draft.trim()} onClick={addCategory}>
              {busy ? '...' : 'Tambah'}
            </button>
          </div>
          {error && <p className="form-error category-error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
