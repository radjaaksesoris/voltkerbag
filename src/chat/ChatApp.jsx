import { useEffect, useRef, useState } from 'react'
import LoginScreen from '../components/LoginScreen.jsx'
import AppModePicker from '../components/AppModePicker.jsx'
import Icon from '../components/Icon.jsx'
import ReceiptPreview from '../components/ReceiptPreview.jsx'
import { downloadInvoiceJpeg } from '../invoiceJpeg'
import { onAuthStateChange, getAuthSession, verifyAuthSession } from '../supabaseSync'
import { executeAction, prepareAction, queryStore } from './chatDomain.js'
import { requestAssistantPlan } from './assistantApi.js'
import { formatQueryAnswer } from './queryAnswer.js'
import {
  advanceStockAddition,
  advanceProductCreation,
  productCreationPrompt,
  startProductCreationRequest,
  startStockAdditionRequest,
  stockAdditionPrompt
} from './productCreation.js'
import { resolveDirectQuery, resolveFallbackQuery } from './queryIntent.js'
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
  const [connectionError, setConnectionError] = useState('')
  const [authCheckKey, setAuthCheckKey] = useState(0)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [processingStage, setProcessingStage] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [productCreation, setProductCreation] = useState(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [receiptTransaction, setReceiptTransaction] = useState(null)
  const [receiptError, setReceiptError] = useState('')
  const fileInputRef = useRef(null)
  const endOfMessagesRef = useRef(null)
  const inputRef = useRef(null)
  const operationLock = useRef(false)
  const hasPendingAction = messages.some((message) => message.draft)
  const requestedAppMode = getRequestedAppMode()

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

  async function sendMessage(event, suggestedText) {
    event?.preventDefault()
    if (busy || actionBusy || hasPendingAction || operationLock.current) return
    const file = attachment
    const text = (suggestedText ?? input).trim() || (file ? 'Foto produk' : '')
    if (!text) return
    setInput('')
    setAttachment(null)
    appendMessage(setMessages, {
      role: 'user',
      text,
      attachmentName: file?.name || ''
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

      const directQuery = resolveDirectQuery(text, Boolean(file))
      let plan
      let fallbackQuery = null
      if (directQuery) {
        plan = directQuery
        setProcessingStage('Mengambil data yang diminta...')
      } else {
        setProcessingStage('Memahami permintaan dengan AI...')
        const history = messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.text || message.message || ''
        })).filter((message) => message.content)
        plan = await requestAssistantPlan({
          message: text,
          history,
          attachmentName: file?.name || ''
        })

        fallbackQuery = resolveFallbackQuery(text, plan, Boolean(file))
        if (fallbackQuery) {
          plan = fallbackQuery
          setProcessingStage('AI belum memahami pertanyaan; mencari data langsung...')
        }
      }

      if (plan.kind === 'query' && [
        'daily_summary', 'sales_summary', 'finance_summary', 'cashbook',
        'transactions', 'purchases', 'product_performance'
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
        appendMessage(setMessages, { role: 'assistant', text: plan.message })
        return
      }

      if (plan.kind === 'query') {
        if (!directQuery && !fallbackQuery) setProcessingStage('Mengambil data toko...')
        const result = await queryStore(plan.query, plan.args)
        appendMessage(setMessages, {
          role: 'assistant',
          text: formatQueryAnswer(plan.query, result.data),
          detailTitle: result.title,
          detailText: formatData(result.data),
          invoices: plan.query === 'transactions' ? result.data.transactions : null
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
          <a className="chat-old-app-link" href={import.meta.env.BASE_URL + '?mode=table'} title="Buka aplikasi VOLTKER tabel">
            APLIKASI TABEL
          </a>
        </div>
      </header>

      {connectionError && <div className="chat-connection-banner" role="status">{connectionError}</div>}

      <section className="chat-workspace" aria-label="Percakapan dengan asisten VOLTKER">
        <div className="chat-feed" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <span className="chat-welcome-eyebrow">RUANG KERJA TOKO</span>
              <h1>Selamat datang.<br /><em>Apa yang perlu dibantu?</em></h1>
              <p>Tanyakan stok, penjualan, hutang, atau minta bantuan mencatat transaksi dan kegiatan toko.</p>
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
                  <p>{renderChatText(message.text)}</p>
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
                {message.cancelled && <span className="chat-message-note">Tindakan dibatalkan.</span>}
                {message.completed && <span className="chat-message-note">Tindakan berhasil dikonfirmasi.</span>}

                {message.detailText && (
                  <details className="chat-data-details">
                    <summary>{message.detailTitle || 'Data yang digunakan'}</summary>
                    <pre>{message.detailText}</pre>
                  </details>
                )}
                {message.transaction && (
                  <div className="chat-result-actions">
                    <button className="btn btn-sm" type="button" onClick={() => setReceiptTransaction(message.transaction)}>Pratinjau / cetak faktur</button>
                    <button className="btn btn-sm" type="button" onClick={() => downloadInvoice(message.transaction)}>Unduh faktur JPEG</button>
                  </div>
                )}
                {message.invoices?.length > 0 && (
                  <div className="chat-invoice-list" aria-label="Faktur dari hasil pencarian">
                    {message.invoices.slice(0, 10).map((transaction) => (
                      <div key={transaction.id} className="chat-invoice-row">
                        <span><strong>{transaction.invoiceNo || '#' + transaction.id}</strong><small>{transaction.customerName} · {new Date(transaction.createdAt).toLocaleDateString('id-ID')}</small></span>
                        <div>
                          <button className="btn btn-sm" type="button" onClick={() => setReceiptTransaction(transaction)}>Cetak</button>
                          <button className="btn btn-sm" type="button" onClick={() => downloadInvoice(transaction)}>JPEG</button>
                        </div>
                      </div>
                    ))}
                  </div>
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
          {attachment && (
            <div className="chat-queued-attachment">
              <Icon name={attachment.type === 'application/zip' ? 'download' : 'image'} size={15} />
              <span>{attachment.name}</span>
              <button type="button" aria-label="Hapus lampiran" onClick={() => setAttachment(null)}><Icon name="close" size={15} /></button>
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
            <button className="chat-send-button" type="submit" disabled={busy || actionBusy || hasPendingAction || !(input.trim() || attachment)} aria-label="Kirim pesan">
              <Icon name="arrowUp" size={18} />
            </button>
          </form>
          <p className="chat-composer-footnote">Pesan tertentu diproses Groq · AI bisa keliru, periksa ringkasan sebelum mengonfirmasi tindakan.</p>
        </div>
      </section>

      {receiptError && <div className="chat-toast-error" role="alert">{receiptError}</div>}
      {receiptTransaction && (
        <ReceiptPreview transaction={receiptTransaction} onClose={() => setReceiptTransaction(null)} />
      )}
    </main>
  )
}
