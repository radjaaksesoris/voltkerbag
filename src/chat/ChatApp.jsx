import { useEffect, useRef, useState } from 'react'
import LoginScreen from '../components/LoginScreen.jsx'
import AppModePicker from '../components/AppModePicker.jsx'
import Icon from '../components/Icon.jsx'
import ReceiptPreview from '../components/ReceiptPreview.jsx'
import { downloadInvoiceJpeg } from '../invoiceJpeg'
import { onAuthStateChange, getAuthSession, verifyAuthSession } from '../supabaseSync'
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
import { resolveFallbackQuery } from './queryIntent.js'
import { getChatDayKey } from './chatDay.js'
import { loadChatHistory, saveChatHistory } from './chatHistory.js'
import {
  applyChatPreferencesToPlan,
  buildAssistantHistory,
  DEFAULT_CHAT_PREFERENCES,
  loadChatPreferences,
  saveChatPreferences
} from './chatPreferences.js'
import { clearRequestedAppMode, getRequestedAppMode } from '../appMode.js'
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

function renderChatText(text) {
  const currencyParts = String(text).split(/([−-]?Rp[\s\u00a0]*\d[\d.,]*)/gi)
  return currencyParts.map((part, index) =>
    /^[−-]?Rp[\s\u00a0]*\d[\d.,]*$/i.test(part)
      ? <strong key={index}>{part}</strong>
      : part
  )
}

export default function ChatApp() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sharedStylesReady, setSharedStylesReady] = useState(false)
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
  const [authCheckKey, setAuthCheckKey] = useState(0)
  const [messages, setMessages] = useState([])
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
  const attachmentPreviewUrls = useRef(new Set())
  const chatDayRef = useRef(getChatDayKey())
  const chatBusyRef = useRef(false)
  const chatUserId = session?.user?.id
  const chatDayKey = getChatDayKey()
  const hasPendingAction = messages.some((message) => message.draft)
  const requestedAppMode = getRequestedAppMode()
  const needsSharedStyles = !session || requestedAppMode !== 'chat'

  useEffect(() => {
    if (!rateLimitWait) return undefined
    const timeout = window.setTimeout(() => {
      setRateLimitWait((remaining) => Math.max(0, remaining - 1))
    }, 1_000)
    return () => window.clearTimeout(timeout)
  }, [rateLimitWait])

  useEffect(() => {
    let active = true
    if (!needsSharedStyles) {
      setSharedStylesReady(true)
      return () => { active = false }
    }

    setSharedStylesReady(false)
    import('../styles.css').then(() => {
      if (active) setSharedStylesReady(true)
    }).catch((error) => {
      console.error('Gagal memuat gaya aplikasi VOLTKER:', error)
      if (active) {
        setConnectionError('Sebagian tampilan aplikasi gagal dimuat. Muat ulang halaman untuk mencoba kembali.')
        setSharedStylesReady(true)
      }
    })
    return () => { active = false }
  }, [needsSharedStyles])

  useEffect(() => {
    chatBusyRef.current = busy || actionBusy
  }, [busy, actionBusy])

  async function refreshAssistantConnection() {
    if (!chatUserId || requestedAppMode !== 'chat') return
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
    if (!chatUserId || requestedAppMode !== 'chat') {
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
  }, [chatUserId, requestedAppMode])

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
        const currentSession = await getAuthSession()
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

  function revokeAttachmentPreview(url) {
    if (!url) return
    URL.revokeObjectURL(url)
    attachmentPreviewUrls.current.delete(url)
  }

  function savePreferences(event) {
    event.preventDefault()
    if (!chatUserId || preferencesOwner !== chatUserId) return
    const watchlist = preferenceDraft.watchedProductsText
      .split(/[,\n]/)
      .map((name) => name.trim())
      .filter(Boolean)
    if (watchlist.length > 5) {
      setPreferencesError('Daftar produk pantauan maksimal 5 nama.')
      return
    }
    try {
      const saved = saveChatPreferences(window.localStorage, chatUserId, {
        ...preferenceDraft,
        watchedProducts: watchlist
      })
      setPreferences(saved)
      setPreferenceDraft({
        ...saved,
        watchedProductsText: saved.watchedProducts.join(', ')
      })
      setPreferencesError('')
      setPreferencesOpen(false)
    } catch (error) {
      console.error('Gagal menyimpan preferensi asisten:', error)
      setPreferencesError(error.message || 'Preferensi asisten tidak dapat disimpan.')
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
      await new Promise((resolve) => window.setTimeout(resolve, 450))

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

      let plan
      let fallbackQuery = null
      let usedErrorFallback = false
      setProcessingStage('Memahami permintaan dengan AI...')
      const history = buildAssistantHistory(messages)
      try {
        plan = await requestAssistantPlan({
          message: text,
          history,
          responseStyle: preferences.responseStyle,
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
        'transactions', 'purchases', 'product_performance', 'operational_insights'
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
        appendMessage(setMessages, { role: 'assistant', text: plan.message, contextSafe: true })
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
          text: formatQueryAnswer(plan.query, result.data)
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

  if (checkingSession && !session && !connectionError) {
    return <main className="chat-loading" role="status">Memeriksa koneksi dan sesi VOLTKER...</main>
  }

  if (needsSharedStyles && !sharedStylesReady) {
    return <main className="chat-loading" role="status">Memuat tampilan VOLTKER...</main>
  }

  if (!session) {
    return (
      <LoginScreen
        configured={Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)}
        connectionError={connectionError}
        updateBanner={null}
        onSignedIn={(nextSession) => {
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

  if (requestedAppMode !== 'chat') {
    return (
      <AppModePicker
        session={session}
        onSignedOut={() => {
          clearRequestedAppMode()
          setSession(null)
          setMessages([])
          setProductCreation(null)
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
            <p className="chat-preferences-note">Daftar pantauan dan hasil data toko hanya diproses lokal. Hanya pilihan gaya balasan yang disertakan saat AI memahami pesan.</p>
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
                  <p>{renderChatText(message.text)}</p>
                  {message.attachmentPreviewUrl && (
                    <img
                      className="chat-message-image"
                      src={message.attachmentPreviewUrl}
                      alt={'Lampiran ' + (message.attachmentName || 'gambar')}
                    />
                  )}
                  {message.attachmentName && <span className="chat-attachment-label"><Icon name="image" size={14} />{message.attachmentName}</span>}
                </div>

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
