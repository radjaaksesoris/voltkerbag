import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const INPUT_SELECTOR = 'input[data-custom-numpad]'

function updateInputValue(input, value, selectionStart = null, selectionEnd = selectionStart) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  valueSetter?.call(input, value)
  if (input.type !== 'number' && selectionStart != null) {
    input.setSelectionRange(selectionStart, selectionEnd)
  }
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

export default function CustomNumpad() {
  const [activeInput, setActiveInput] = useState(null)
  const activeInputRef = useRef(null)
  const keypadRef = useRef(null)
  const scrollHostRef = useRef(null)
  const [pasteError, setPasteError] = useState('')

  useLayoutEffect(() => {
    function syncInputReadOnly() {
      const isMobile = window.matchMedia('(max-width: 640px)').matches
      document.querySelectorAll(INPUT_SELECTOR).forEach((input) => {
        if (isMobile && !input.disabled) {
          if (input.dataset.customNumpadManagedReadonly !== 'true') {
            if (input.readOnly) return
            input.dataset.customNumpadOriginalReadonly = String(input.readOnly)
            input.dataset.customNumpadManagedReadonly = 'true'
          }
          input.readOnly = true
        } else if (input.dataset.customNumpadManagedReadonly === 'true') {
          input.readOnly = input.dataset.customNumpadOriginalReadonly === 'true'
          delete input.dataset.customNumpadOriginalReadonly
          delete input.dataset.customNumpadManagedReadonly
        }
      })
    }

    syncInputReadOnly()
    const observer = new MutationObserver(syncInputReadOnly)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-custom-numpad', 'disabled'],
      childList: true,
      subtree: true
    })

    function handleFocusIn(event) {
      const input = event.target
      if (input instanceof HTMLInputElement && input.matches(INPUT_SELECTOR)) syncInputReadOnly()
      const shouldShow = input instanceof HTMLInputElement &&
        input.matches(INPUT_SELECTOR) &&
        input.dataset.customNumpadManagedReadonly === 'true' &&
        !input.disabled &&
        window.matchMedia('(max-width: 640px)').matches
      activeInputRef.current = shouldShow ? input : null
      setActiveInput(shouldShow ? input : null)
      setPasteError('')
    }

    function handlePointerDown(event) {
      if (event.target.closest('.custom-numpad')) return
      if (event.target !== activeInputRef.current) {
        activeInputRef.current?.blur()
        activeInputRef.current = null
        setActiveInput(null)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        activeInputRef.current?.blur()
        activeInputRef.current = null
        setActiveInput(null)
      }
    }

    function handleResize() {
      if (!window.matchMedia('(max-width: 640px)').matches) {
        activeInputRef.current = null
        setActiveInput(null)
      }
      syncInputReadOnly()
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
      observer.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    const keypad = keypadRef.current
    if (!activeInput?.isConnected || !keypad || !window.matchMedia('(max-width: 640px)').matches) {
      return undefined
    }

    keypad.style.setProperty('--custom-numpad-top', `${keypad.getBoundingClientRect().top}px`)
    keypad.classList.add('custom-numpad-expanded')
    return () => {
      keypad.classList.remove('custom-numpad-expanded')
      keypad.style.removeProperty('--custom-numpad-top')
    }
  }, [activeInput])

  useLayoutEffect(() => {
    if (!activeInput?.isConnected || !window.matchMedia('(max-width: 640px)').matches) {
      return undefined
    }

    const guardedUrl = window.location.href
    const previousState = window.history.state
    const guardId = `custom-numpad-${Date.now()}-${Math.random()}`
    let guardCount = 0
    let removingGuard = false

    function pushGuards(count) {
      for (let index = 0; index < count; index += 1) {
        window.history.pushState({ customNumpadBackGuard: guardId }, '', guardedUrl)
        guardCount += 1
      }
    }

    function handlePopState(event) {
      if (removingGuard) {
        window.history.replaceState(previousState, '', guardedUrl)
        window.removeEventListener('popstate', handlePopState, true)
        return
      }

      if (!activeInputRef.current?.isConnected) return
      event.stopImmediatePropagation()
      guardCount = event.state?.customNumpadBackGuard === guardId
        ? Math.max(0, guardCount - 1)
        : 0
      pushGuards(2)
    }

    pushGuards(12)
    window.addEventListener('popstate', handlePopState, true)

    return () => {
      if (guardCount === 0) {
        window.removeEventListener('popstate', handlePopState, true)
        return
      }

      removingGuard = true
      window.history.go(-guardCount)
    }
  }, [Boolean(activeInput?.isConnected)])

  useLayoutEffect(() => {
    if (!activeInput?.isConnected || !keypadRef.current) return undefined

    const scrollHost = activeInput.closest('.product-modal, .modal, .content')
    if (!scrollHost) return undefined

    const originalPaddingBottom = scrollHost.style.paddingBottom
    const keypadHeight = keypadRef.current.getBoundingClientRect().height
    const computedPaddingBottom = Number.parseFloat(getComputedStyle(scrollHost).paddingBottom) || 0
    scrollHost.style.paddingBottom = `${computedPaddingBottom + keypadHeight + 12}px`
    scrollHostRef.current = { element: scrollHost, originalPaddingBottom }

    requestAnimationFrame(() => {
      if (!activeInput.isConnected || !keypadRef.current) return
      const inputBottom = activeInput.getBoundingClientRect().bottom
      const keypadTop = keypadRef.current.getBoundingClientRect().top
      const overlap = inputBottom - keypadTop + 12
      if (overlap > 0) scrollHost.scrollBy({ top: overlap, behavior: 'auto' })
    })

    return () => {
      const currentHost = scrollHostRef.current
      if (currentHost?.element === scrollHost) {
        scrollHost.style.paddingBottom = currentHost.originalPaddingBottom
        scrollHostRef.current = null
      }
    }
  }, [activeInput])

  useLayoutEffect(() => {
    if (!activeInput?.isConnected || !window.matchMedia('(max-width: 640px)').matches) return undefined

    document.body.classList.add('custom-numpad-open')
    return () => document.body.classList.remove('custom-numpad-open')
  }, [activeInput])

  if (!activeInput?.isConnected) return null

  async function pasteFromClipboard() {
    setPasteError('')
    if (!navigator.clipboard?.readText) {
      setPasteError('Akses clipboard tidak tersedia di browser ini.')
      return
    }

    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        setPasteError('Clipboard kosong.')
        return
      }

      const input = activeInput
      if (!input?.isConnected || input.disabled) return
      if (input.type === 'number') {
        updateInputValue(input, text)
      } else {
        const currentValue = input.value
        const start = input.selectionStart ?? currentValue.length
        const end = input.selectionEnd ?? start
        const maxLength = Number(input.maxLength)
        const pastedText = maxLength > 0
          ? text.slice(0, Math.max(0, maxLength - (currentValue.length - (end - start))))
          : text
        updateInputValue(
          input,
          currentValue.slice(0, start) + pastedText + currentValue.slice(end),
          start + pastedText.length
        )
      }
      input.focus()
    } catch (error) {
      setPasteError(error.message || 'Clipboard tidak dapat dibaca. Izinkan akses clipboard lalu coba lagi.')
    }
  }

  function applyKey(key) {
    const input = activeInput
    if (!input?.isConnected || input.disabled ||
        (input.readOnly && input.dataset.customNumpadManagedReadonly !== 'true')) {
      setActiveInput(null)
      return
    }

    const currentValue = input.value
    const isNumberInput = input.type === 'number'
    const acceptsDecimal = input.dataset.customNumpad === 'decimal'

    if (key === 'clear') {
      delete input.dataset.customNumpadDecimalPending
      updateInputValue(input, '', 0)
      input.focus()
      return
    }

    if (key === 'backspace') {
      if (isNumberInput) {
        delete input.dataset.customNumpadDecimalPending
        updateInputValue(input, currentValue.slice(0, -1))
      } else {
        let start = input.selectionStart ?? currentValue.length
        let end = input.selectionEnd ?? start
        if (start === end && start > 0) start -= 1
        updateInputValue(input, currentValue.slice(0, start) + currentValue.slice(end), start)
      }
      input.focus()
      return
    }

    if (key === 'decimal') {
      if (!acceptsDecimal || currentValue.includes('.')) return
      if (isNumberInput) {
        updateInputValue(input, (currentValue || '0') + '.0')
        input.dataset.customNumpadDecimalPending = 'true'
      } else {
        const start = input.selectionStart ?? currentValue.length
        const end = input.selectionEnd ?? start
        updateInputValue(input, currentValue.slice(0, start) + '.' + currentValue.slice(end), start + 1)
      }
      input.focus()
      return
    }

    if (!/^\d$/.test(key)) return
    if (isNumberInput) {
      const nextValue = input.dataset.customNumpadDecimalPending === 'true'
        ? currentValue.replace(/\.0$/, '.' + key)
        : currentValue + key
      delete input.dataset.customNumpadDecimalPending
      updateInputValue(input, nextValue)
    } else {
      const start = input.selectionStart ?? currentValue.length
      const end = input.selectionEnd ?? start
      const maxLength = Number(input.maxLength)
      const nextValue = currentValue.slice(0, start) + key + currentValue.slice(end)
      if (maxLength > 0 && nextValue.length > maxLength) return
      updateInputValue(input, nextValue, start + 1)
    }
    input.focus()
  }

  function handlePointerKey(key) {
    return (event) => {
      event.preventDefault()
      applyKey(key)
    }
  }

  function handleKeyboardClick(key) {
    return (event) => {
      if (event.detail === 0) applyKey(key)
    }
  }

  function handlePastePointerDown(event) {
    event.preventDefault()
    pasteFromClipboard()
  }

  function handlePasteClick(event) {
    if (event.detail === 0) pasteFromClipboard()
  }

  function closeNumpad() {
    activeInputRef.current = null
    setActiveInput(null)
    activeInput.blur()
  }

  return createPortal(
    <div className="custom-numpad" ref={keypadRef} role="group" aria-label="Keypad angka">
      <div className="custom-numpad-heading">
        <strong>Masukkan angka</strong>
        {activeInput.dataset.customNumpad === 'decimal' && (
          <button type="button" onPointerDown={handlePointerKey('decimal')} onClick={handleKeyboardClick('decimal')}>
            .
          </button>
        )}
        <button type="button" onPointerDown={handlePastePointerDown} onClick={handlePasteClick}>
          Tempel
        </button>
        <button type="button" onPointerDown={handlePointerKey('clear')} onClick={handleKeyboardClick('clear')}>
          Hapus
        </button>
      </div>
      {pasteError && <p className="custom-numpad-error" role="status">{pasteError}</p>}
      <div className="custom-numpad-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button key={digit} type="button" onPointerDown={handlePointerKey(digit)} onClick={handleKeyboardClick(digit)}>
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="custom-numpad-done"
          onClick={closeNumpad}>
          Selesai
        </button>
        <button type="button" onPointerDown={handlePointerKey('0')} onClick={handleKeyboardClick('0')}>0</button>
        <button
          type="button"
          className="custom-numpad-backspace"
          aria-label="Hapus angka terakhir"
          onPointerDown={handlePointerKey('backspace')}
          onClick={handleKeyboardClick('backspace')}>
          ⌫
        </button>
      </div>
    </div>,
    document.body
  )
}
