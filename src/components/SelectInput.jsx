import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon.jsx'

export default function SelectInput({
  options,
  value,
  onChange,
  id,
  ariaLabel,
  placeholder,
  disabled = false,
  required = false,
  className = ''
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const activeOptionRef = useRef(null)
  const listId = useId()
  const selectedOption = options.find((option) => option.value === value)
  const activeOption = options[activeIndex]

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

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function openMenu(index = options.findIndex((option) => option.value === value)) {
    const firstEnabled = options.findIndex((option) => !option.disabled)
    setActiveIndex(index >= 0 && !options[index]?.disabled ? index : firstEnabled)
    setOpen(true)
  }

  function moveActive(direction) {
    const start = activeIndex < 0 ? (direction > 0 ? -1 : options.length) : activeIndex
    for (let step = 1; step <= options.length; step += 1) {
      const nextIndex = (start + direction * step + options.length) % options.length
      if (!options[nextIndex].disabled) {
        setActiveIndex(nextIndex)
        return
      }
    }
  }

  function handleKeyDown(event) {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openMenu()
      else moveActive(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      let index = -1
      if (event.key === 'Home') index = options.findIndex((option) => !option.disabled)
      else {
        for (let optionIndex = options.length - 1; optionIndex >= 0; optionIndex -= 1) {
          if (!options[optionIndex].disabled) {
            index = optionIndex
            break
          }
        }
      }
      if (index >= 0) {
        if (!open) setOpen(true)
        setActiveIndex(index)
      }
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault()
      if (activeOption && !activeOption.disabled) selectOption(activeOption.value)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMenu()
    }
  }

  function selectOption(nextValue) {
    onChange(nextValue)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <div
      className={'category-select select-input ' + className}
      ref={rootRef}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false)
      }}>
      <button
        className="input category-select-trigger"
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={open && activeIndex >= 0 ? listId + '-' + activeIndex : undefined}
        disabled={disabled}
        ref={triggerRef}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (open) setOpen(false)
          else openMenu()
        }}>
        <span className={selectedOption ? '' : 'category-placeholder'}>{selectedOption?.label || placeholder}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={17} />
      </button>
      {open && (
        <div className="category-menu">
          <div className="category-options" id={listId} role="listbox" aria-label={ariaLabel}>
            {options.map((option, index) => (
              <button
                className={'category-option' + (value === option.value ? ' selected' : '') + (activeIndex === index ? ' active' : '')}
                id={listId + '-' + index}
                key={option.value}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={value === option.value}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                ref={activeIndex === index ? activeOptionRef : null}
                onClick={() => selectOption(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
