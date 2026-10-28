import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon.jsx'

export default function ManagedOptionSelect({
  options,
  value,
  onChange,
  onAdd,
  onDelete,
  triggerRef,
  id,
  fieldName,
  placeholder,
  emptyLabel,
  emptyMessage,
  allowEmpty = true,
  canManage = true,
  disabled = false
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const rootRef = useRef(null)
  const listId = useId()
  const selected = options.find((option) => option.name === value)

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

  async function addOption(event) {
    event?.preventDefault()
    const name = draft.trim()
    if (!name) return
    setBusy(true)
    setError('')
    try {
      await onAdd(name)
      setDraft('')
      setOpen(false)
    } catch (err) {
      setError(err.message || 'Gagal menambahkan ' + fieldName.toLowerCase() + '.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteOption(option) {
    if (!confirm('Hapus ' + fieldName.toLowerCase() + ' "' + option.name + '"?')) return
    setBusy(true)
    setError('')
    try {
      await onDelete(option)
    } catch (err) {
      setError(err.message || 'Gagal menghapus ' + fieldName.toLowerCase() + '.')
    } finally {
      setBusy(false)
    }
  }

  function handleTriggerKeyDown(event) {
    if (disabled) return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const optionNames = [...(allowEmpty ? [''] : []), ...options.map((option) => option.name)]
    if (optionNames.length === 0) return
    const selectedIndex = optionNames.indexOf(value || '')
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = selectedIndex < 0
      ? direction > 0 ? 0 : optionNames.length - 1
      : (selectedIndex + direction + optionNames.length) % optionNames.length
    onChange(optionNames[nextIndex])
    setOpen(true)
  }

  function selectOption(optionName) {
    onChange(optionName)
    setOpen(false)
    requestAnimationFrame(() => triggerRef?.current?.focus())
  }

  return (
    <div className="category-select category-select-inline" ref={rootRef}>
      <button
        className="input category-select-trigger"
        id={id}
        type="button"
        role="combobox"
        aria-label={fieldName}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-autocomplete="none"
        aria-expanded={open}
        disabled={disabled}
        tabIndex={0}
        ref={triggerRef}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => !disabled && setOpen((isOpen) => !isOpen)}>
        <span className={selected ? '' : 'category-placeholder'}>{selected?.name || placeholder}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={17} />
      </button>
      {open && (
        <div className="category-menu">
          <div className="category-options" id={listId} role="listbox" aria-label={fieldName + ' produk'}>
            {allowEmpty && (
              <button
                className={'category-option ' + (!value ? 'selected' : '')}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={!value}
                onClick={() => selectOption('')}>
                {emptyLabel}
              </button>
            )}
            {!allowEmpty && options.length === 0 && (
              <p className="customer-select-empty">
                {emptyMessage || 'Belum ada pilihan. Tambahkan nama pelanggan di tab Setting.'}
              </p>
            )}
            {options.map((option) => (
              <div className="category-option-row" key={option.id}>
                <button
                  className={'category-option ' + (value === option.name ? 'selected' : '')}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={value === option.name}
                  onClick={() => selectOption(option.name)}>
                  {option.name}
                </button>
                {canManage && (
                  <button
                    className="category-delete"
                    type="button"
                    tabIndex={-1}
                    aria-label={'Hapus ' + fieldName.toLowerCase() + ' ' + option.name}
                    title={'Hapus ' + fieldName.toLowerCase()}
                    disabled={busy}
                    onClick={() => deleteOption(option)}>
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {canManage && (
            <div className="category-add-form">
              <input className="input" value={draft} maxLength={80}
                tabIndex={-1}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') addOption(event) }}
                placeholder={'Nama ' + fieldName.toLowerCase() + ' baru'} aria-label={'Nama ' + fieldName.toLowerCase() + ' baru'} />
              <button className="btn btn-primary" type="button" tabIndex={-1} disabled={busy || !draft.trim()} onClick={addOption}>
                {busy ? '...' : 'Tambah'}
              </button>
            </div>
          )}
          {error && <p className="form-error category-error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
