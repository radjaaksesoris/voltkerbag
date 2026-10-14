import { useEffect, useLayoutEffect, useRef, useState } from 'react'

function formatAmount(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function rawAmount(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export default function MoneyInput({ value, onChange, className = 'input', ...props }) {
  const inputRef = useRef(null)
  const pendingDigitOffset = useRef(null)
  const [displayValue, setDisplayValue] = useState(() => formatAmount(value))

  useEffect(() => {
    setDisplayValue(formatAmount(value))
  }, [value])

  useLayoutEffect(() => {
    if (pendingDigitOffset.current == null || !inputRef.current) return
    const offset = pendingDigitOffset.current
    let digits = 0
    let cursor = 0
    while (cursor < inputRef.current.value.length && digits < offset) {
      if (/\d/.test(inputRef.current.value[cursor])) digits += 1
      cursor += 1
    }
    inputRef.current.setSelectionRange(cursor, cursor)
    pendingDigitOffset.current = null
  }, [displayValue])

  function handleChange(event) {
    const input = event.currentTarget
    const offset = rawAmount(input.value.slice(0, input.selectionStart ?? input.value.length)).length
    const nextValue = rawAmount(input.value)
    pendingDigitOffset.current = offset
    setDisplayValue(formatAmount(nextValue))
    onChange(nextValue)
  }

  const placeholder = /^\d+$/.test(String(props.placeholder ?? ''))
    ? formatAmount(props.placeholder)
    : props.placeholder

  return (
    <div className="money-input-wrap">
      <span className="money-input-prefix" aria-hidden="true">Rp</span>
      <input
        {...props}
        ref={inputRef}
        className={className}
        type="text"
        inputMode="numeric"
        value={displayValue}
        placeholder={placeholder}
        onChange={handleChange}
      />
    </div>
  )
}
