import { useEffect, useRef, useState } from 'react'
import LoginScreen from '../components/LoginScreen.jsx'
import Icon from '../components/Icon.jsx'
import ReceiptPreview from '../components/ReceiptPreview.jsx'
import { downloadInvoiceJpeg } from '../invoiceJpeg'
import {
  onAuthStateChange,
  getAuthSession,
  restoreSessionHandoff,
  verifyAuthSession
} from '../supabaseSync'
import { executeAction, prepareAction, queryStore } from './chatDomain.js'
import { checkAssistantConnection, requestAssistantPlan } from './assistantApi.js'
import { formatQueryAnswer } from './queryAnswer.js'
import {
  advanceStockAddition,
  advanceProductCreation,
  productCreationPrompt,
  startProductCreationRequest,
  startStockAdditionRequest,
  stockAdditionPrompt
} from './productCreation.js'
import { resolveDirectQuery, resolveFallbackQuery, resolveProductPriceCapabilityReply } from './queryIntent.js'
import { getChatDayKey } from './chatDay.js'
import { loadChatHistory, saveChatHistory } from './chatHistory.js'
import {
  applyChatPreferencesToPlan,
  buildAssistantHistory,
  createChatCorrection,
  DEFAULT_CHAT_PREFERENCES,
  getApprovedChatCorrections,
  loadChatPreferences,
  saveChatPreferences,
  updateChatCorrection
} from './chatPreferences.js'
import { clearRequestedAppMode } from '../appMode.js'
import { stockEntryUnit } from '../productUnits.js'
import { readDashboardDateRange } from '../dateFilter.js'

function messageId() {
  return crypto.randomUUID()
}

function appendMessage(setMessages, message) {
  setMessages((current) => [...current, { id: messageId(), ...message }])
}

function formatData(data) {
  return JSON.stringify(data, null, 2)
}

const SUMMARY_METRIC_LABELS = {
  transaction_count: 'transaksi',
  sales_total: 'omzet',
  gross_profit: 'laba kotor',
  net_profit: 'laba bersih',
  income: 'pemasukan buku kas',
  expense: 'pengeluaran',
  cash_balance: 'saldo kas',
  customer_debt: 'hutang pelanggan berjalan'
}

function summaryMetricForLabel(label) {
  const cleanLabel = String(label || '').trim().toLocaleLowerCase('id-ID')
  if (/^transaksi\b/.test(cleanLabel)) return 'transaction_count'
  if (/^omzet\b/.test(cleanLabel)) return 'sales_total'
  if (/^laba kotor\b/.test(cleanLabel)) return 'gross_profit'
  if (/^laba bersih\b/.test(cleanLabel)) return 'net_profit'
  if (/^pemasukan buku kas\b/.test(cleanLabel)) return 'income'
  if (/^pengeluaran\b/.test(cleanLabel)) return 'expense'
  if (/^saldo kas\b/.test(cleanLabel)) return 'cash_balance'
  if (/^hutang pelanggan berjalan\b/.test(cleanLabel)) return 'customer_debt'
  return ''
}

function renderChatText(text, formatCurrencyAsTable = true, onSummaryMetricClick = null, expandedSummaryMetric = '') {
  const lines = String(text || '').split(/\r?\n/)
  const blocks = []
  let index = 0
  const currencyPattern = /[−-]?Rp[\s\u00a0]*\d(?:[\d.,]*\d)?(?:\s*\/\s*[\p{L}]+)?/giu
  const hasCurrency = (value) => {
    currencyPattern.lastIndex = 0
    const found = currencyPattern.test(value)
    currencyPattern.lastIndex = 0
    return found
  }
  const renderMetricLabel = (label, key) => {
    const metric = onSummaryMetricClick ? summaryMetricForLabel(label) : ''
    return metric
      ? (
          <button
            type="button"
            className="chat-summary-metric-link"
            aria-expanded={expandedSummaryMetric === metric}
            aria-label={'Buka rincian ' + SUMMARY_METRIC_LABELS[metric]}
            onClick={() => onSummaryMetricClick(metric)}>
            {renderInline(label, key)}
          </button>
        )
      : renderInline(label, key)
  }

  const renderMoneyTable = (tableLines, key) => {
    const rows = tableLines.flatMap((sourceLine, lineIndex) => {
      const cleanLine = sourceLine.replace(/^(?:[•*-]\s+|\d+[.)]\s+)/, '').trim()
      const segments = cleanLine.split(/\s+[·|]\s+/)
      const context = []
      const lineRows = []

      segments.forEach((segment) => {
        currencyPattern.lastIndex = 0
        const matches = [...segment.matchAll(currencyPattern)]
        currencyPattern.lastIndex = 0
        if (!matches.length) {
          if (lineRows.length === 0) context.push(segment.trim())
          else if (segment.trim()) lineRows[lineRows.length - 1].detail += ' ' + segment.trim()
          return
        }

        const firstMatch = matches[0]
        const lastMatch = matches[matches.length - 1]
        const prefix = segment.slice(0, firstMatch.index).replace(/^[\s:—-]+|[\s:—-]+$/g, '')
        const suffix = segment.slice(lastMatch.index + lastMatch[0].length).trim()
        const label = [...context, prefix].filter(Boolean).join(' · ')
        lineRows.push({
          label: label || 'Rincian ' + (lineIndex + 1),
          amount: segment.slice(firstMatch.index, lastMatch.index + lastMatch[0].length).trim(),
          detail: suffix
        })
      })

      if (lineRows.length === 0 && summaryMetricForLabel(cleanLine)) {
        const separatorIndex = cleanLine.indexOf(':')
        if (separatorIndex !== -1) {
          lineRows.push({
            label: cleanLine.slice(0, separatorIndex).trim(),
            amount: cleanLine.slice(separatorIndex + 1).trim(),
            detail: ''
          })
        }
      }

      return lineRows.map((row) => ({
        ...row,
        label: row.detail ? row.label + ' — ' + row.detail : row.label
      }))
    })

    return (
      <div className="chat-rich-table-wrap" key={key} role="region" aria-label="Rincian nominal Rupiah" tabIndex={0}>
        <table className="chat-rich-table">
          <thead>
            <tr><th scope="col">Rincian</th><th scope="col">Nominal</th></tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={'money-row-' + rowIndex}>
                <td>{renderMetricLabel(row.label, key + '-label-' + rowIndex)}</td>
                <td>{renderInline(row.amount, key + '-amount-' + rowIndex)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderInline = (value, keyPrefix) => value
    .split(/(\*\*[^*]+\*\*|[−-]?Rp[\s\u00a0]*\d[\d.,]*)/gi)
    .filter(Boolean)
    .map((part, partIndex) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return <strong key={keyPrefix + '-strong-' + partIndex}>{part.slice(2, -2)}</strong>
      }
      if (/^[−-]?Rp[\s\u00a0]*\d[\d.,]*$/i.test(part)) {
        return <strong key={keyPrefix + '-currency-' + partIndex}>{part}</strong>
      }
      return part
    })

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }

    const bullet = line.match(/^[•*-]\s+(.+)$/)
    const numbered = line.match(/^\d+[.)]\s+(.+)$/)
    if (bullet || numbered) {
      const isNumbered = Boolean(numbered)
      const items = []
      while (index < lines.length) {
        const current = lines[index].trim()
        const match = isNumbered
          ? current.match(/^\d+[.)]\s+(.+)$/)
          : current.match(/^[•*-]\s+(.+)$/)
        if (!match) break
        items.push(match[1])
        index += 1
      }
      const List = isNumbered ? 'ol' : 'ul'
      if (formatCurrencyAsTable && items.some(hasCurrency)) {
        blocks.push(renderMoneyTable(items, 'money-list-' + index))
      } else {
        blocks.push(
          <List className="chat-rich-list" key={'list-' + index}>
            {items.map((item, itemIndex) => (
              <li key={'item-' + itemIndex}>
                {renderMetricLabel(item, 'list-' + index + '-' + itemIndex)}
              </li>
            ))}
          </List>
        )
      }
      continue
    }

    if (formatCurrencyAsTable && hasCurrency(line)) {
      const moneyLines = []
      while (index < lines.length) {
        const current = lines[index].trim()
        if (!current || !hasCurrency(current)) break
        moneyLines.push(current)
        index += 1
      }
      blocks.push(renderMoneyTable(moneyLines, 'money-paragraph-' + index))
      continue
    }

    const explicitHeading = line.match(/^#{1,3}\s+(.+)$/)
    const colonHeading = line.endsWith(':') && line.length <= 90
    const firstLineHeading = blocks.length === 0
      && lines.slice(index + 1).some((nextLine) => nextLine.trim())
      && line.length <= 52
      && !/[.!?]$/.test(line)
    if (explicitHeading || colonHeading || firstLineHeading) {
      const heading = explicitHeading ? explicitHeading[1] : line.replace(/:$/, '')
      blocks.push(
        <h3 className="chat-rich-heading" key={'heading-' + index}>
          {renderInline(heading, 'heading-' + index)}
        </h3>
      )
      index += 1
      continue
    }

    blocks.push(
      <p className="chat-rich-paragraph" key={'paragraph-' + index}>
        {renderInline(line, 'paragraph-' + index)}
      </p>
    )
    index += 1
  }

  return <div className="chat-rich-text">{blocks}</div>
}

export default function ChatApp() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [assistantConnection, setAssistantConnection] = useState({
    status: 'checking',
    message: ''
  })
  const [checkingAssistant, setCheckingAssistant] = useState(false)
  const [rateLimitWait, setRateLimitWait] = useState(0)
  const [historyError, setHistoryError] = useState('')
  const [historyOwner, setHistoryOwner] = useState(null)
  const [preferences, setPreferences] = useState(DEFAULT_CHAT_PREFERENCES)
  const [preferenceDraft, setPreferenceDraft] = useState({
    ...DEFAULT_CHAT_PREFERENCES,
    watchedProductsText: ''
  })
  const [preferencesOwner, setPreferencesOwner] = useState(null)
  const [preferencesError, setPreferencesError] = useState('')
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [feedbackMessageId, setFeedbackMessageId] = useState('')
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackError, setFeedbackError] = useState('')
  const [authCheckKey, setAuthCheckKey] = useState(0)
  const [messages, setMessages] = useState([])
  const [summaryMetricDetails, setSummaryMetricDetails] = useState({})
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [processingStage, setProcessingStage] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState('')
  const [productCreation, setProductCreation] = useState(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [receiptTransaction, setReceiptTransaction] = useState(null)
  const [receiptError, setReceiptError] = useState('')
  const fileInputRef = useRef(null)
  const endOfMessagesRef = useRef(null)
  const inputRef = useRef(null)
  const operationLock = useRef(false)
  const summaryMetricRequestIds = useRef(new Map())
  const summaryDetailRefs = useRef(new Map())
  const lastSummaryDetailMessageId = useRef('')
  const attachmentPreviewUrls = useRef(new Set())
  const chatDayRef = useRef(getChatDayKey())
  const chatBusyRef = useRef(false)
  const chatUserId = session?.user?.id
  const chatDayKey = getChatDayKey()
  const hasPendingAction = messages.some((message) => message.draft)
  const needsSharedStyles = !session

  async function openSummaryMetric(message, metric) {
    const existing = summaryMetricDetails[message.id]
    if (existing?.metric === metric) {
      lastSummaryDetailMessageId.current = ''
      summaryMetricRequestIds.current.delete(message.id)
      setSummaryMetricDetails((current) => {
        const next = { ...current }
        delete next[message.id]
        return next
      })
      return
    }

    lastSummaryDetailMessageId.current = message.id
    const requestId = crypto.randomUUID()
    summaryMetricRequestIds.current.set(message.id, requestId)
    setSummaryMetricDetails((current) => ({
      ...current,
      [message.id]: { metric, loading: true, text: '', error: '' }
    }))
    try {
      const { data } = await queryStore('summary_metric', {
        metric,
        from: message.summaryRange.from,
        to: message.summaryRange.to
      })
      if (summaryMetricRequestIds.current.get(message.id) !== requestId) return
      setSummaryMetricDetails((current) => ({
        ...current,
        [message.id]: {
          metric,
          loading: false,
          text: formatQueryAnswer('summary_metric', data),
          error: ''
        }
      }))
    } catch (error) {
      if (summaryMetricRequestIds.current.get(message.id) !== requestId) return
      setSummaryMetricDetails((current) => ({
        ...current,
        [message.id]: {
          metric,
          loading: false,
          text: '',
          error: error.message || 'Rincian tidak dapat dimuat. Coba lagi.'
        }
      }))
    }
  }

  useEffect(() => {
    if (!rateLimitWait) return undefined
    const timeout = window.setTimeout(() => {
      setRateLimitWait((remaining) => Math.max(0, remaining - 1))
    }, 1_000)
    return () => window.clearTimeout(timeout)
  }, [rateLimitWait])

  useEffect(() => {
    let active = true
    if (!needsSharedStyles) return () => { active = false }
    import('../styles.css').catch((error) => {
      console.error('Gagal memuat gaya aplikasi VOLTKER:', error)
      if (active) setConnectionError('Sebagian tampilan aplikasi gagal dimuat. Muat ulang halaman untuk mencoba kembali.')
    })
    return () => { active = false }
  }, [needsSharedStyles])

  useEffect(() => {
    chatBusyRef.current = busy || actionBusy
  }, [busy, actionBusy])

  async function refreshAssistantConnection() {
    if (!chatUserId) return
    setCheckingAssistant(true)
    setAssistantConnection({ status: 'checking', message: '' })
    try {
      await checkAssistantConnection()
      setAssistantConnection({ status: 'connected', message: 'AI Groq terhubung.' })
    } catch (error) {
      console.error('Pemeriksaan koneksi AI Groq gagal:', error)
      setAssistantConnection({
        status: 'disconnected',
        message: error.message || 'AI Groq tidak dapat dihubungi.'
      })
    } finally {
      setCheckingAssistant(false)
    }
  }

  useEffect(() => {
    if (!chatUserId) {
      setAssistantConnection({ status: 'checking', message: '' })
      return
    }
    let active = true
    const check = async () => {
      setCheckingAssistant(true)
      setAssistantConnection({ status: 'checking', message: '' })
      try {
        await checkAssistantConnection()
        if (active) setAssistantConnection({ status: 'connected', message: 'AI Groq terhubung.' })
      } catch (error) {
        console.error('Pemeriksaan koneksi AI Groq gagal:', error)
        if (active) {
          setAssistantConnection({
            status: 'disconnected',
            message: error.message || 'AI Groq tidak dapat dihubungi.'
          })
        }
      } finally {
        if (active) setCheckingAssistant(false)
      }
    }
    const onOnline = () => check()
    const onOffline = () => {
      setAssistantConnection({
        status: 'disconnected',
        message: 'Perangkat sedang offline; AI Groq tidak dapat dihubungi.'
      })
    }
    check()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      active = false
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [chatUserId])

  useEffect(() => {
    setHistoryOwner(null)
    setMessages([])
    if (!chatUserId) return

    try {
      const currentDay = getChatDayKey()
      const savedMessages = loadChatHistory(window.localStorage, chatUserId, currentDay)
      chatDayRef.current = currentDay
      setMessages(savedMessages)
      setHistoryError('')
      setHistoryOwner(chatUserId)
    } catch (error) {
      console.error('Gagal memuat riwayat chat:', error)
      setHistoryError('Riwayat chat tidak dapat dimuat atau disimpan di perangkat ini.')
    }
  }, [chatUserId])

  useEffect(() => {
    setPreferencesOwner(null)
    setPreferences(DEFAULT_CHAT_PREFERENCES)
    setPreferenceDraft({ ...DEFAULT_CHAT_PREFERENCES, watchedProductsText: '' })
    setPreferencesError('')
    setPreferencesOpen(false)
    if (!chatUserId) return

    try {
      const saved = loadChatPreferences(window.localStorage, chatUserId)
      setPreferences(saved)
      setPreferenceDraft({
        ...saved,
        watchedProductsText: saved.watchedProducts.join(', ')
      })
      setPreferencesOwner(chatUserId)
    } catch (error) {
      console.error('Gagal memuat preferensi asisten:', error)
      setPreferencesError(error.message || 'Preferensi asisten tidak dapat dimuat.')
      setPreferencesOwner(chatUserId)
    }
  }, [chatUserId])

  useEffect(() => {
    if (!chatUserId || historyOwner !== chatUserId) return

    try {
      saveChatHistory(window.localStorage, chatUserId, chatDayKey, messages)
      setHistoryError('')
    } catch (error) {
      console.error('Gagal menyimpan riwayat chat:', error)
      setHistoryError('Riwayat chat tidak dapat disimpan di perangkat ini.')
    }
  }, [chatDayKey, chatUserId, historyOwner, messages])

  useEffect(() => () => {
    attachmentPreviewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    attachmentPreviewUrls.current.clear()
  }, [])

  useEffect(() => {
    const resetIfNewDay = () => {
      const currentDay = getChatDayKey()
      if (currentDay === chatDayRef.current || chatBusyRef.current) return

      chatDayRef.current = currentDay
      setMessages([])
      setProductCreation(null)
      setInput('')
      setAttachment(null)
      attachmentPreviewUrls.current.forEach((url) => URL.revokeObjectURL(url))
      attachmentPreviewUrls.current.clear()
      setAttachmentPreviewUrl('')
    }

    const intervalId = window.setInterval(resetIfNewDay, 30_000)
    window.addEventListener('focus', resetIfNewDay)
    document.addEventListener('visibilitychange', resetIfNewDay)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', resetIfNewDay)
      document.removeEventListener('visibilitychange', resetIfNewDay)
    }
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return undefined

    const updateViewportHeight = () => {
      document.documentElement.style.setProperty('--chat-viewport-height', `${viewport.height}px`)
    }

    updateViewportHeight()
    viewport.addEventListener('resize', updateViewportHeight)
    window.addEventListener('resize', updateViewportHeight)
    return () => {
      viewport.removeEventListener('resize', updateViewportHeight)
      window.removeEventListener('resize', updateViewportHeight)
      document.documentElement.style.removeProperty('--chat-viewport-height')
    }
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    async function verifyConnection() {
      try {
        const handedOffSession = await restoreSessionHandoff()
        if (!active) return
        const currentSession = handedOffSession || await getAuthSession()
        if (!active) return
        const verifiedSession = currentSession ? await verifyAuthSession() : null
        if (!active) return
        setSession(verifiedSession)
        setConnectionError(currentSession && !verifiedSession ? 'Sesi login berakhir. Silakan masuk kembali.' : '')
      } catch (error) {
        if (active) setConnectionError(error.message || 'Tidak dapat menghubungi database server.')
      } finally {
        if (active) setCheckingSession(false)
      }
    }

    if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
      unsubscribe = onAuthStateChange((event, nextSession) => {
        if (event === 'SIGNED_OUT') {
          clearRequestedAppMode()
          setSession(null)
          setMessages([])
          setProductCreation(null)
        } else if (nextSession) {
          setSession(nextSession)
          setConnectionError('')
        }
      })
    }
    verifyConnection()

    const handleOnline = () => {
      setConnectionError('')
      verifyConnection()
    }
    const handleOffline = () => setConnectionError('Koneksi internet tidak tersedia. Chat dan perubahan data memerlukan koneksi.')
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [authCheckKey])

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy, actionBusy])

  useEffect(() => {
    const messageId = lastSummaryDetailMessageId.current
    const detail = summaryMetricDetails[messageId]
    if (!detail) return

    summaryDetailRefs.current.get(messageId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }, [summaryMetricDetails])

  function revokeAttachmentPreview(url) {
    if (!url) return
    URL.revokeObjectURL(url)
    attachmentPreviewUrls.current.delete(url)
  }

  function persistPreferences(nextPreferences, updateDraft = true) {
    if (!chatUserId || preferencesOwner !== chatUserId) {
      setPreferencesError('Preferensi asisten belum siap untuk akun ini. Coba kembali.')
      return null
    }
    try {
      const saved = saveChatPreferences(window.localStorage, chatUserId, nextPreferences)
      setPreferences(saved)
      if (updateDraft) {
        setPreferenceDraft({
          ...saved,
          watchedProductsText: saved.watchedProducts.join(', ')
        })
      }
      setPreferencesError('')
      return saved
    } catch (error) {
      console.error('Gagal menyimpan preferensi asisten:', error)
      setPreferencesError(error.message || 'Preferensi asisten tidak dapat disimpan.')
      return null
    }
  }

  function savePreferences(event) {
    event.preventDefault()
    const watchlist = preferenceDraft.watchedProductsText
      .split(/[,\n]/)
      .map((name) => name.trim())
      .filter(Boolean)
    if (watchlist.length > 5) {
      setPreferencesError('Daftar produk pantauan maksimal 5 nama.')
      return
    }
    if (persistPreferences({
      ...preferenceDraft,
      watchedProducts: watchlist,
      corrections: preferences.corrections
    })) {
      setPreferencesOpen(false)
    }
  }

  function submitCorrection(event, message) {
    event.preventDefault()
    setFeedbackError('')
    try {
      const correction = createChatCorrection(feedbackText, crypto.randomUUID())
      const saved = persistPreferences({
        ...preferences,
        corrections: [...preferences.corrections, correction].slice(-12)
      }, false)
      if (!saved) {
        setFeedbackError('Koreksi tidak dapat disimpan. Periksa pesan pada preferensi asisten.')
        return
      }
      setMessages((current) => current.map((entry) =>
        entry.id === message.id ? { ...entry, feedbackSubmitted: true } : entry
      ))
      setFeedbackMessageId('')
      setFeedbackText('')
    } catch (error) {
      setFeedbackError(error.message || 'Koreksi tidak dapat disimpan.')
    }
  }

  function reviewCorrection(id, status) {
    try {
      const corrections = updateChatCorrection(preferences.corrections, id, status)
      persistPreferences({ ...preferences, corrections }, false)
    } catch (error) {
      setPreferencesError(error.message || 'Status koreksi tidak dapat diperbarui.')
    }
  }

  async function sendMessage(event) {
    event?.preventDefault()
    if (busy || actionBusy || hasPendingAction || rateLimitWait > 0 || operationLock.current) return
    const file = attachment
    const text = input.trim() || (file ? 'Foto produk' : '')
    if (!text) return
    setInput('')
    setAttachment(null)
    setAttachmentPreviewUrl('')
    appendMessage(setMessages, {
      role: 'user',
      text,
      attachmentName: file?.name || '',
      attachmentPreviewUrl
    })
    setBusy(true)

    try {
      setProcessingStage('VOLTKER sedang berpikir...')

      if (productCreation) {
        if (productCreation.kind === 'stock_addition') {
          const progress = advanceStockAddition(productCreation, text)
          if (progress.cancelled) {
            setProductCreation(null)
            appendMessage(setMessages, { role: 'assistant', text: 'Penambahan stok dibatalkan.' })
            return
          }
          if (progress.resolveProduct) {
            const { data } = await queryStore('stock', { product: progress.addition.product })
            const matches = data.matches || []
            const exact = matches.find((product) =>
              product.name.toLocaleLowerCase('id-ID') === progress.addition.product.toLocaleLowerCase('id-ID')
            )
            const product = exact || (matches.length === 1 ? matches[0] : null)
            if (!product) {
              const reply = matches.length
                ? 'Nama produk cocok dengan beberapa pilihan: ' + matches.map((entry) => entry.name).join(', ') + '. Sebutkan nama yang lebih spesifik.'
                : 'Produk "' + progress.addition.product + '" tidak ditemukan. Sebutkan nama produk yang sudah terdaftar.'
              setProductCreation(progress.addition)
              appendMessage(setMessages, { role: 'assistant', text: reply })
              return
            }
            const next = {
              ...progress.addition,
              product: product.name,
              current: product,
              unit: stockEntryUnit(product.unit || 'pcs'),
              step: 'quantity'
            }
            setProductCreation(next)
            appendMessage(setMessages, { role: 'assistant', text: stockAdditionPrompt(next) })
            return
          }
          if (!progress.complete) {
            setProductCreation(progress.addition)
            appendMessage(setMessages, { role: 'assistant', text: progress.prompt })
            return
          }
          try {
            const draft = await prepareAction('add_stock', progress.actionArgs)
            draft.requestId = crypto.randomUUID()
            setProductCreation(null)
            appendMessage(setMessages, {
              role: 'assistant',
              text: 'Detail penambahan stok sudah lengkap. Periksa pratinjau sebelum menyimpan.',
              draft
            })
          } catch (error) {
            setProductCreation({ ...productCreation, step: 'unit_cost' })
            appendMessage(setMessages, {
              role: 'assistant',
              text: (error.message || 'Penambahan stok belum dapat disiapkan.') + ' ' + stockAdditionPrompt(productCreation),
              error: true
            })
          }
          return
        }
        if (productCreation.step === 'unit' && text.trim()) {
          const { data } = await queryStore('units')
          const selectedUnit = (data.entries || []).find((entry) =>
            entry.name.toLocaleLowerCase('id-ID') === text.trim().toLocaleLowerCase('id-ID')
            && entry.name.toLocaleLowerCase('id-ID') !== 'kodi'
          )
          if (!selectedUnit) {
            const choices = (data.entries || [])
              .map((entry) => entry.name)
              .filter((name) => name.toLocaleLowerCase('id-ID') !== 'kodi')
            appendMessage(setMessages, {
              role: 'assistant',
              text: choices.length
                ? 'Satuan "' + text.trim() + '" belum tersedia. Pilih salah satu satuan terdaftar: ' + choices.join(', ') + '.'
                : 'Belum ada satuan produk yang terdaftar. Tambahkan satuan melalui aplikasi tabel terlebih dahulu.'
            })
            return
          }
        }
        if (productCreation.step === 'category'
          && text.trim()
          && !/^(lewati|skip|tidak ada|tidak punya|belum ada|nanti)$/i.test(text.trim())) {
          const { data } = await queryStore('categories')
          const selectedCategory = (data.entries || []).find((entry) =>
            entry.name.toLocaleLowerCase('id-ID') === text.trim().toLocaleLowerCase('id-ID')
          )
          if (!selectedCategory) {
            const choices = (data.entries || []).map((entry) => entry.name)
            appendMessage(setMessages, {
              role: 'assistant',
              text: choices.length
                ? 'Kategori "' + text.trim() + '" belum terdaftar. Pilih salah satu: ' + choices.join(', ') + ', atau balas "lewati".'
                : 'Belum ada kategori terdaftar. Balas "lewati" untuk memakai kategori kosong.'
            })
            return
          }
        }
        const progress = advanceProductCreation(productCreation, { text, attachment: file })
        if (progress.cancelled) {
          setProductCreation(null)
          appendMessage(setMessages, { role: 'assistant', text: 'Pembuatan produk baru dibatalkan.' })
          return
        }
        if (!progress.complete) {
          setProductCreation(progress.creation)
          appendMessage(setMessages, { role: 'assistant', text: progress.prompt })
          return
        }
        try {
          const draft = await prepareAction('add_product', progress.actionArgs, progress.attachment)
          draft.requestId = crypto.randomUUID()
          setProductCreation(null)
          appendMessage(setMessages, {
            role: 'assistant',
            text: 'Data produk sudah lengkap. Periksa pratinjau berikut sebelum menyimpan.',
            draft
          })
        } catch (error) {
          setProductCreation(progress.creation)
          appendMessage(setMessages, {
            role: 'assistant',
            text: (error.message || 'Produk belum dapat disiapkan.') + ' ' + productCreationPrompt(progress.creation),
            error: true
          })
        }
        return
      }

      const newProductRequest = startProductCreationRequest(text)
      if (newProductRequest) {
        if (file?.type?.startsWith('image/')) {
          newProductRequest.image = file
          newProductRequest.step = 'category'
        }
        setProductCreation(newProductRequest)
        appendMessage(setMessages, {
          role: 'assistant',
          text: productCreationPrompt(newProductRequest)
        })
        return
      }

      const newStockAddition = startStockAdditionRequest(text)
      if (newStockAddition) {
        let productResolution = ''
        if (newStockAddition.product) {
          const { data } = await queryStore('stock', { product: newStockAddition.product })
          const matches = data.matches || []
          const exact = matches.find((product) =>
            product.name.toLocaleLowerCase('id-ID') === newStockAddition.product.toLocaleLowerCase('id-ID')
          )
          const product = exact || (matches.length === 1 ? matches[0] : null)
          if (product) {
            newStockAddition.product = product.name
            newStockAddition.current = product
            newStockAddition.unit = stockEntryUnit(product.unit || 'pcs')
            newStockAddition.step = 'quantity'
          } else {
            productResolution = matches.length
              ? 'Nama produk cocok dengan beberapa pilihan: ' + matches.map((entry) => entry.name).join(', ') + '. '
              : 'Produk "' + newStockAddition.product + '" tidak ditemukan di daftar stok. '
          }
        }
        setProductCreation(newStockAddition)
        appendMessage(setMessages, {
          role: 'assistant',
          text: productResolution + stockAdditionPrompt(newStockAddition)
        })
        return
      }

      const productPriceCapabilityReply = resolveProductPriceCapabilityReply(text, Boolean(file))
      if (productPriceCapabilityReply) {
        appendMessage(setMessages, {
          role: 'assistant',
          text: productPriceCapabilityReply,
          contextSafe: true
        })
        return
      }

      let plan
      let fallbackQuery = null
      let usedErrorFallback = false
      const directQuery = resolveDirectQuery(text, Boolean(file))
      if (directQuery) {
        plan = directQuery
        setProcessingStage('Mengambil data toko...')
      } else {
        setProcessingStage('Memahami permintaan dengan AI...')
        const history = buildAssistantHistory(messages)
        try {
          plan = await requestAssistantPlan({
            message: text,
            history,
            responseStyle: preferences.responseStyle,
            approvedCorrections: getApprovedChatCorrections(preferences),
            attachmentName: file?.name || ''
          })
          setAssistantConnection({ status: 'connected', message: 'AI Groq terhubung.' })
        } catch (error) {
          fallbackQuery = resolveFallbackQuery(text, { kind: 'error' }, Boolean(file))
          if (fallbackQuery) {
            plan = fallbackQuery
            usedErrorFallback = true
            setProcessingStage('AI belum dapat menjawab; aplikasi mencari data...')
            if (error.status === 429) {
              setAssistantConnection({
                status: 'connected',
                message: 'AI Groq terhubung; permintaan menunggu batas penggunaan.'
              })
              setRateLimitWait(error.retryAfterSeconds || 0)
            } else {
              setAssistantConnection({
                status: 'disconnected',
                message: error.message || 'AI Groq tidak dapat memproses permintaan.'
              })
            }
          } else {
            if (error.status === 429) {
              setAssistantConnection({
                status: 'connected',
                message: 'AI Groq terhubung; permintaan menunggu batas penggunaan.'
              })
              setRateLimitWait(error.retryAfterSeconds || 0)
            } else {
              setAssistantConnection({
                status: 'disconnected',
                message: error.message || 'AI Groq tidak dapat memproses permintaan.'
              })
            }
            throw error
          }
        }
      }

      if (!usedErrorFallback) {
        fallbackQuery = resolveFallbackQuery(text, plan, Boolean(file))
        if (fallbackQuery) {
          plan = fallbackQuery
          setProcessingStage('Memverifikasi maksud pertanyaan; mengambil data yang sesuai...')
        }
      }

      plan = applyChatPreferencesToPlan(plan, preferences)

      if (plan.kind === 'query' && [
        'daily_summary', 'sales_summary', 'finance_summary', 'cashbook',
        'transactions', 'purchases', 'product_performance', 'operational_insights',
        'sales_trend', 'product_stock_performance'
      ].includes(plan.query) && !plan.args?.period && !plan.args?.from && !plan.args?.to) {
        const activeDateRange = readDashboardDateRange()
        if (activeDateRange && (activeDateRange.from || activeDateRange.to)) {
          plan = {
            ...plan,
            args: { ...plan.args, ...activeDateRange, useDashboardDateFilter: true }
          }
        }
      }

      if (plan.kind === 'reply') {
        appendMessage(setMessages, {
          role: 'assistant',
          text: plan.message,
          contextSafe: true,
          feedbackEligible: true
        })
        return
      }

      if (plan.kind === 'query') {
        if (!fallbackQuery) setProcessingStage('Mengambil data toko...')
        const result = await queryStore(plan.query, {
          ...plan.args,
          ...(plan.query === 'operational_insights'
            ? { watchedProducts: preferences.watchedProducts }
            : {})
        })
        appendMessage(setMessages, {
          role: 'assistant',
          text: formatQueryAnswer(plan.query, result.data),
          formatCurrencyAsTable: plan.args?.explainProfitDifference !== true,
          summaryRange: ['daily_summary', 'sales_summary'].includes(plan.query)
            && plan.args?.explainProfitDifference !== true
            ? result.data.date_range
            : null
        })
        return
      }

      if (plan.action === 'add_product') {
        const missing = getMissingProductDetails(plan.args)
        if (missing.length) {
          appendMessage(setMessages, {
            role: 'assistant',
            text: 'Untuk membuat produk baru, mohon lengkapi: ' + missing.join('; ') +
              '. Kategori boleh dikosongkan (akan memakai Umum). Foto produk opsional; lampirkan melalui tombol + bersama detailnya.'
          })
          return
        }
      }

      setProcessingStage('Menyiapkan pratinjau tindakan...')
      try {
        const draft = await prepareAction(plan.action, plan.args, file)
        draft.requestId = crypto.randomUUID()
        appendMessage(setMessages, {
          role: 'assistant',
          text: plan.message,
          contextSafe: true,
          draft
        })
      } catch (error) {
        appendMessage(setMessages, {
          role: 'assistant',
          text: error.message || 'Perintah belum dapat disiapkan. Mohon lengkapi atau perjelas informasinya.',
          error: true
        })
      }
    } catch (error) {
      appendMessage(setMessages, {
        role: 'assistant',
        text: error.message || 'Chat gagal diproses. Periksa koneksi dan konfigurasi asisten.',
        error: true
      })
    } finally {
      setBusy(false)
      setProcessingStage('')
      inputRef.current?.focus()
    }
  }

  async function confirmAction(message) {
    if (!message?.draft || actionBusy || operationLock.current) return
    if (message.draft.action === 'reset_store' && confirmationText !== 'HAPUS DATA') return

    operationLock.current = true
    setActionBusy(true)
    setConfirmationText('')
    try {
      const result = await executeAction(message.draft)
      setMessages((current) => current.map((entry) =>
        entry.id === message.id ? { ...entry, draft: null, completed: true } : entry
      ))
      if (typeof result === 'string') {
        appendMessage(setMessages, { role: 'assistant', text: result, success: true })
      } else {
        appendMessage(setMessages, {
          role: 'assistant',
          text: result.text,
          success: true,
          transaction: result.transaction
        })
      }
    } catch (error) {
      appendMessage(setMessages, {
        role: 'assistant',
        text: 'Perubahan gagal disimpan: ' + (error.message || 'Kesalahan server tidak diketahui.'),
        error: true
      })
    } finally {
      operationLock.current = false
      setActionBusy(false)
    }
  }

  function cancelAction(message) {
    setMessages((current) => current.map((entry) =>
      entry.id === message.id ? { ...entry, draft: null, cancelled: true } : entry
    ))
    setConfirmationText('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  async function downloadInvoice(transaction) {
    setReceiptError('')
    try {
      await downloadInvoiceJpeg(transaction)
    } catch (error) {
      setReceiptError(error.message || 'Gagal mengunduh faktur.')
    }
  }

  if (!session && checkingSession) {
    return (
      <main className="chat-loading" role="status" aria-live="polite">
        Memeriksa sesi...
      </main>
    )
  }

  if (!session) {
    return (
      <LoginScreen
        configured={Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)}
        checkingSession={checkingSession}
        connectionError={connectionError}
        updateBanner={null}
        defaultAppMode="chat"
        onSignedIn={async (nextSession, targetApp) => {
          if (targetApp === 'table') {
            const { handoffSession } = await import('../supabaseSync')
            handoffSession(nextSession)
            window.location.assign(import.meta.env.BASE_URL + '?mode=table')
            return
          }
          setSession(nextSession)
          setConnectionError('')
        }}
        onRetry={() => {
          setCheckingSession(true)
          setConnectionError('')
          setAuthCheckKey((key) => key + 1)
        }}
      />
    )
  }

  return (
    <main className="chat-app-shell">
      <header className="chat-topbar">
        <div className="chat-brand">
          <img
            className="chat-brand-logo"
            src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
            alt="VOLTKER"
            width="160"
            height="40"
          />
        </div>
        <div className="chat-topbar-actions">
          <button
            type="button"
            className="chat-preferences-button"
            aria-expanded={preferencesOpen}
            aria-controls="chat-preferences"
            onClick={() => setPreferencesOpen((open) => !open)}>
            Preferensi
          </button>
          <a className="chat-old-app-link" href={import.meta.env.BASE_URL + '?mode=table'} title="Buka aplikasi VOLTKER tabel">
            APLIKASI TABEL
          </a>
        </div>
      </header>

      {assistantConnection.status === 'disconnected' && (
        <div className="chat-ai-status chat-ai-status-error" role="alert">
          <div>
            <strong>AI Groq tidak terhubung</strong>
            <span>{assistantConnection.message}</span>
          </div>
          <button type="button" disabled={checkingAssistant} onClick={refreshAssistantConnection}>
            {checkingAssistant ? 'Memeriksa...' : 'Coba lagi'}
          </button>
        </div>
      )}
      {assistantConnection.status === 'checking' && (
        <div className="chat-ai-status chat-ai-status-checking" role="status">
          Memeriksa koneksi AI Groq...
        </div>
      )}

      {preferencesOpen && (
        <section className="chat-preferences" id="chat-preferences" role="dialog" aria-modal="false" aria-labelledby="chat-preferences-title">
          <form onSubmit={savePreferences}>
            <div className="chat-preferences-heading">
              <div>
                <strong id="chat-preferences-title">Preferensi asisten</strong>
                <span>Disimpan lokal di perangkat ini untuk akun Anda.</span>
              </div>
              <button type="button" aria-label="Tutup preferensi" onClick={() => setPreferencesOpen(false)}>×</button>
            </div>
            <label>
              Periode default untuk ringkasan
              <select
                value={preferenceDraft.defaultPeriod}
                onChange={(event) => setPreferenceDraft((current) => ({ ...current, defaultPeriod: event.target.value }))}>
                <option value="dashboard">Ikuti filter Rekap Harian</option>
                <option value="hari ini">Hari ini</option>
                <option value="minggu ini">Minggu ini</option>
                <option value="bulan ini">Bulan ini</option>
                <option value="bulan lalu">Bulan lalu</option>
              </select>
            </label>
            <label>
              Gaya balasan AI
              <select
                value={preferenceDraft.responseStyle}
                onChange={(event) => setPreferenceDraft((current) => ({ ...current, responseStyle: event.target.value }))}>
                <option value="concise">Singkat</option>
                <option value="friendly">Ramah dan ringkas</option>
                <option value="detailed">Lebih terperinci</option>
              </select>
            </label>
            <label>
              Produk pantauan (maksimal 5, pisahkan dengan koma)
              <input
                value={preferenceDraft.watchedProductsText}
                maxLength={420}
                placeholder="Contoh: Tas A, Tas B"
                onChange={(event) => setPreferenceDraft((current) => ({
                  ...current,
                  watchedProductsText: event.target.value
                }))} />
            </label>
            <section className="chat-corrections" aria-label="Koreksi panduan AI">
              <strong>Koreksi jawaban AI</strong>
              <p className="chat-preferences-note">
                Koreksi baru menunggu tinjauan. Yang disetujui saja dikirim sebagai panduan ke AI; simpanan berlaku untuk akun dan browser ini, tidak tersinkron.
              </p>
              {preferences.corrections.length
                ? preferences.corrections.slice().reverse().map((correction) => (
                    <article className="chat-correction" key={correction.id}>
                      <p>{correction.text}</p>
                      <small>
                        {correction.status === 'approved'
                          ? 'Disetujui dan aktif'
                          : correction.status === 'rejected' ? 'Ditolak' : 'Menunggu tinjauan'}
                      </small>
                      {correction.status === 'pending' && (
                        <div>
                          <button type="button" onClick={() => reviewCorrection(correction.id, 'approved')}>Setujui & aktifkan</button>
                          <button type="button" onClick={() => reviewCorrection(correction.id, 'rejected')}>Tolak</button>
                        </div>
                      )}
                      {correction.status === 'approved' && (
                        <div>
                          <button type="button" onClick={() => reviewCorrection(correction.id, 'rejected')}>Nonaktifkan</button>
                        </div>
                      )}
                    </article>
                  ))
                : <p className="chat-preferences-note">Belum ada koreksi yang diajukan.</p>}
            </section>
            <p className="chat-preferences-note">Daftar pantauan dan hasil data toko tidak dikirim ke AI. Hindari memasukkan data pribadi pada koreksi.</p>
            {preferencesError && <p className="chat-preferences-error" role="alert">{preferencesError}</p>}
            <div className="chat-preferences-actions">
              <button type="button" onClick={() => {
                setPreferenceDraft({ ...preferences, watchedProductsText: preferences.watchedProducts.join(', ') })
                setPreferencesError('')
                setPreferencesOpen(false)
              }}>Batal</button>
              <button type="submit" disabled={preferencesOwner !== chatUserId}>Simpan preferensi</button>
            </div>
          </form>
        </section>
      )}

      {(connectionError || historyError || preferencesError) && (
        <div className="chat-connection-banner" role="status">
          {[connectionError, historyError, preferencesError].filter(Boolean).join(' ')}
        </div>
      )}

      <section className="chat-workspace" aria-label="Percakapan dengan asisten VOLTKER">
        <div className="chat-feed" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-starter">
              <strong>Briefing kondisi toko</strong>
              <span>Ringkasan berbasis data toko, tanpa mengubah data.</span>
              <button
                type="button"
                className="chat-starter-button"
                disabled={busy || actionBusy || hasPendingAction}
                onClick={() => {
                  setInput('Analisis kondisi toko hari ini')
                  inputRef.current?.focus()
                }}>
                Analisis toko hari ini
              </button>
            </div>
          )}
          {messages.map((message) => (
            <article key={message.id} className={'chat-message chat-message-' + message.role}>
              {message.role === 'assistant' && (
                <div className="chat-avatar" aria-hidden="true">
                  <img src={import.meta.env.BASE_URL + 'voltker-icon-192.png'} alt="" />
                </div>
              )}
              <div className="chat-message-content">
                <div className={'chat-bubble' + (message.error ? ' is-error' : '') + (message.success ? ' is-success' : '')}>
                  <span className="chat-bubble-kicker" aria-hidden="true">
                    {message.role === 'user' ? 'PESAN ADMIN' : 'VOLTKER · ASISTEN TOKO'}
                  </span>
                  {renderChatText(
                    message.text,
                    message.role === 'assistant' && message.formatCurrencyAsTable !== false,
                    message.summaryRange
                      ? (metric) => openSummaryMetric(message, metric)
                      : null,
                    summaryMetricDetails[message.id]?.metric
                  )}
                  {message.attachmentPreviewUrl && (
                    <img
                      className="chat-message-image"
                      src={message.attachmentPreviewUrl}
                      alt={'Lampiran ' + (message.attachmentName || 'gambar')}
                    />
                  )}
                  {message.attachmentName && <span className="chat-attachment-label"><Icon name="image" size={14} />{message.attachmentName}</span>}
                </div>
                {message.summaryRange && summaryMetricDetails[message.id] && (
                  <section
                    ref={(element) => {
                      if (element) summaryDetailRefs.current.set(message.id, element)
                      else summaryDetailRefs.current.delete(message.id)
                    }}
                    className="chat-summary-detail"
                    aria-live="polite">
                    <div className="chat-summary-detail-heading">
                      <strong>Rincian {SUMMARY_METRIC_LABELS[summaryMetricDetails[message.id].metric]}</strong>
                      <button
                        type="button"
                        aria-label="Tutup rincian metrik"
                        onClick={() => openSummaryMetric(message, summaryMetricDetails[message.id].metric)}>
                        Tutup
                      </button>
                    </div>
                    {summaryMetricDetails[message.id].loading && (
                      <p role="status">Memuat rincian sesuai periode laporan...</p>
                    )}
                    {summaryMetricDetails[message.id].error && (
                      <p className="chat-summary-detail-error" role="alert">
                        {summaryMetricDetails[message.id].error}
                      </p>
                    )}
                    {summaryMetricDetails[message.id].text && renderChatText(summaryMetricDetails[message.id].text)}
                  </section>
                )}

                {message.feedbackEligible && !message.feedbackSubmitted && (
                  <div className="chat-feedback">
                    {feedbackMessageId === message.id
                      ? (
                          <form onSubmit={(event) => submitCorrection(event, message)}>
                            <label>
                              Saran koreksi (maks. 240 karakter)
                              <textarea
                                value={feedbackText}
                                maxLength={240}
                                onChange={(event) => setFeedbackText(event.target.value)}
                                placeholder="Tuliskan panduan umum yang seharusnya diikuti AI."
                                required
                              />
                            </label>
                            <p>Jangan sertakan nama pelanggan, nomor telepon, email, atau hasil data toko.</p>
                            {feedbackError && <p className="chat-preferences-error" role="alert">{feedbackError}</p>}
                            <div>
                              <button type="button" onClick={() => {
                                setFeedbackMessageId('')
                                setFeedbackError('')
                              }}>Batal</button>
                              <button type="submit">Ajukan untuk ditinjau</button>
                            </div>
                          </form>
                        )
                      : <button type="button" onClick={() => {
                          setFeedbackMessageId(message.id)
                          setFeedbackText('')
                          setFeedbackError('')
                        }}>Sarankan koreksi</button>}
                  </div>
                )}
                {message.feedbackSubmitted && (
                  <small className="chat-feedback-status">Koreksi menunggu tinjauan di Preferensi.</small>
                )}

                {message.draft && (
                  <section className="chat-action-card" aria-label="Pratinjau tindakan">
                    <div className="chat-action-heading">
                      <span className="chat-action-icon"><Icon name="bolt" size={16} /></span>
                      <div><small>PRATINJAU TINDAKAN</small><strong>{message.draft.title}</strong></div>
                    </div>
                    <ul>
                      {message.draft.details.map((detail) => <li key={detail}>{renderChatText(detail)}</li>)}
                    </ul>
                    {message.draft.action === 'reset_store' && (
                      <label className="chat-confirm-reset">
                        Ketik <strong>HAPUS DATA</strong> untuk menyetujui
                        <input
                          className="input"
                          value={confirmationText}
                          onChange={(event) => setConfirmationText(event.target.value)}
                          autoComplete="off"
                          spellCheck="false"
                          disabled={actionBusy}
                        />
                      </label>
                    )}
                    <div className="chat-action-buttons">
                      <button className="btn" type="button" disabled={actionBusy} onClick={() => cancelAction(message)}>Batal</button>
                      <button
                        className={'btn btn-primary' + (message.draft.action === 'reset_store' ? ' btn-danger' : '')}
                        type="button"
                        disabled={actionBusy || (message.draft.action === 'reset_store' && confirmationText !== 'HAPUS DATA')}
                        onClick={() => confirmAction(message)}>
                        {actionBusy ? 'Menyimpan...' : 'Konfirmasi'}
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </article>
          ))}
          {(busy || actionBusy) && (
            <div className="chat-thinking" role="status" aria-live="polite">
              <span /><span /><span />{actionBusy ? 'Menyimpan perubahan...' : processingStage}
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="chat-composer-wrap">
          {rateLimitWait > 0 && (
            <p className="chat-rate-limit-wait" role="status" aria-live="polite">
              Batas penggunaan AI sementara tercapai. Anda bisa mencoba lagi dalam {rateLimitWait} detik.
            </p>
          )}
          {attachment && (
            <div className="chat-queued-attachment">
              {attachmentPreviewUrl
                ? <img className="chat-queued-image" src={attachmentPreviewUrl} alt="Pratinjau gambar yang akan dikirim" />
                : <Icon name="download" size={15} />}
              <span>{attachment.name}</span>
              <button
                type="button"
                aria-label="Hapus lampiran"
                onClick={() => {
                  revokeAttachmentPreview(attachmentPreviewUrl)
                  setAttachmentPreviewUrl('')
                  setAttachment(null)
                }}>
                <Icon name="close" size={15} />
              </button>
            </div>
          )}
          <form className="chat-composer" onSubmit={sendMessage}>
            <button
              className="chat-attach-button"
              type="button"
              aria-label="Lampirkan foto produk atau backup ZIP"
              title="Lampirkan foto produk atau backup ZIP"
              disabled={busy || actionBusy || hasPendingAction}
              onClick={() => fileInputRef.current?.click()}>
              <Icon name="plus" size={19} />
            </button>
            <input
              ref={fileInputRef}
              className="chat-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,.zip,application/zip"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                if (file.type.startsWith('image/') && file.size > 5 * 1024 * 1024) {
                  appendMessage(setMessages, { role: 'assistant', text: 'Ukuran foto maksimal 5 MB.', error: true })
                  event.target.value = ''
                  return
                }
                if (!file.type.startsWith('image/') && !/\.zip$/i.test(file.name)) {
                  appendMessage(setMessages, { role: 'assistant', text: 'Lampiran hanya menerima foto JPG, PNG, WebP, atau backup ZIP.', error: true })
                  event.target.value = ''
                  return
                }
                revokeAttachmentPreview(attachmentPreviewUrl)
                const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
                if (previewUrl) attachmentPreviewUrls.current.add(previewUrl)
                setAttachmentPreviewUrl(previewUrl)
                setAttachment(file)
                event.target.value = ''
              }}
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ketik pesan atau perintah toko..."
              aria-label="Pesan untuk asisten VOLTKER"
              rows={1}
              maxLength={4000}
              disabled={busy || actionBusy || hasPendingAction}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  sendMessage(event)
                }
              }}
            />
            <button className="chat-send-button" type="submit" disabled={busy || actionBusy || hasPendingAction || rateLimitWait > 0 || !(input.trim() || attachment)} aria-label="Kirim pesan">
              <Icon name="arrowUp" size={18} />
            </button>
          </form>
          <p className="chat-composer-footnote">Tulis maksud, nama objek, dan detail perubahan. Jika ada yang kurang, asisten akan bertanya. Periksa pratinjau sebelum mengonfirmasi.</p>
        </div>
      </section>

      {receiptError && <div className="chat-toast-error" role="alert">{receiptError}</div>}
      {receiptTransaction && (
        <ReceiptPreview transaction={receiptTransaction} onClose={() => setReceiptTransaction(null)} />
      )}
    </main>
  )
}
