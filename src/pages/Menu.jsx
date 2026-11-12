import { useEffect, useMemo, useRef, useState } from 'react'
import { getDashboardData, getFinanceData, onRefresh, requestPageRefresh } from '../db'
import { dateRangeTimestamps, localDateValue } from '../dateFilter'
import { rupiah } from '../format'
import Icon from '../components/Icon.jsx'
import LoadingNumber from '../components/LoadingNumber.jsx'

function getPeriodRange() {
  const now = new Date()
  return {
    from: localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localDateValue(now)
  }
}

function formatPeriodDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' })
    .format(new Date(year, month - 1, day))
}

export default function Menu({ items, onNavigate, onLogout, logoutBusy, logoutError }) {
  const [query, setQuery] = useState('')
  const [summary, setSummary] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [activeSummary, setActiveSummary] = useState(0)
  const requestId = useRef(0)

  useEffect(() => {
    let active = true

    async function load() {
      const currentRequest = ++requestId.current
      try {
        const range = getPeriodRange()
        const timestamps = dateRangeTimestamps(range)
        const [dashboard, finance] = await Promise.all([
          getDashboardData({
            ...timestamps,
            summaryFrom: timestamps.from,
            summaryTo: timestamps.to,
            page: 1,
            pageSize: 1,
            creditFirst: false,
            nameSort: 'date'
          }),
          getFinanceData({ ...timestamps, page: 1, pageSize: 1 })
        ])
        if (!active || currentRequest !== requestId.current) return
        const numericValues = [
          dashboard.summary_count,
          dashboard.revenue,
          dashboard.gross_profit,
          dashboard.inventory?.total_asset,
          finance.income,
          finance.capital,
          finance.expense,
          finance.total_credit
        ]
        if (!dashboard.inventory || !Array.isArray(finance.credit_balances)
          || numericValues.some((value) => value == null || !Number.isFinite(Number(value)))) {
          throw new Error('Ringkasan menu belum tersedia. Perbarui skema database, lalu coba lagi.')
        }
        setSummary({
          range,
          transactionCount: Number(dashboard.summary_count),
          revenue: Number(dashboard.revenue),
          grossProfit: Number(dashboard.gross_profit),
          stockValue: Number(dashboard.inventory.total_asset),
          cashBalance: Number(finance.income) + Number(finance.capital) - Number(finance.expense),
          totalDebt: Number(finance.total_credit)
        })
        setLoadError('')
      } catch (error) {
        if (active && currentRequest === requestId.current) {
          setLoadError(error.message || 'Gagal memuat ringkasan menu.')
        }
      } finally {
        if (active && currentRequest === requestId.current) setLoaded(true)
      }
    }

    load()
    const unsubscribe = onRefresh(load, 'menu')
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const filteredItems = useMemo(() => {
    const shortcuts = [
      ...items,
      { id: 'chat', label: 'Chat', description: 'Tanya dan kelola toko lewat chat.', icon: 'chat' },
      { id: 'refresh', label: 'Segarkan Data', description: 'Muat ulang ringkasan menu.', icon: 'sync' }
    ]
    const normalizedQuery = query.trim().toLocaleLowerCase('id-ID')
    if (!normalizedQuery) return shortcuts
    return shortcuts.filter((item) =>
      (item.label + ' ' + item.description).toLocaleLowerCase('id-ID').includes(normalizedQuery)
    )
  }, [items, query])

  const summarySlides = summary
    ? [
        { label: 'Omzet periode', value: summary.revenue, icon: 'bag' },
        { label: 'Laba kotor', value: summary.grossProfit, icon: 'trend' },
        { label: 'Nilai stok modal', value: summary.stockValue, icon: 'box' }
      ]
    : []
  const periodLabel = summary
    ? `${formatPeriodDate(summary.range.from)}–${formatPeriodDate(summary.range.to)} ${summary.range.to.slice(0, 4)} · ${summary.transactionCount} transaksi`
    : ''

  return (
    <div className="page menu-page">
      <div className="menu-top-actions">
        <button
          className="menu-brand-mark"
          type="button"
          aria-label={logoutBusy ? 'Keluar...' : 'Keluar'}
          title={logoutBusy ? 'Keluar...' : 'Keluar'}
          onClick={onLogout}
          disabled={logoutBusy}>
          <Icon name="bolt" size={27} />
        </button>
        <label className="menu-search">
          <Icon name="search" size={22} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari menu"
            aria-label="Cari menu"
          />
          {query && (
            <button type="button" aria-label="Hapus pencarian menu" onClick={() => setQuery('')}>
              <Icon name="close" size={17} />
            </button>
          )}
        </label>
        <a
          className="menu-chat-action"
          href={import.meta.env.BASE_URL + 'chat/?mode=chat'}
          aria-label="Buka VOLTKER Chat">
          <Icon name="chat" size={23} />
        </a>
      </div>
      {logoutError && <p className="menu-logout-error" role="alert">{logoutError}</p>}

      <section className="menu-summary-card" aria-label="Ringkasan periode">
        <div className="menu-summary-copy">
          <span className="menu-summary-kicker">Ringkasan periode</span>
          {loaded && loadError ? (
            <p className="menu-summary-error" role="alert">{loadError}</p>
          ) : !loaded ? (
            <>
              <span className="menu-summary-label">Omzet periode</span>
              <strong className="menu-summary-value"><LoadingNumber label="omzet periode" /></strong>
              <span className="menu-summary-period" role="status">Memuat ringkasan...</span>
            </>
          ) : (
            <>
              <span className="menu-summary-label">{summarySlides[activeSummary].label}</span>
              <strong className="menu-summary-value">{rupiah(summarySlides[activeSummary].value)}</strong>
              <span className="menu-summary-period">{periodLabel}</span>
            </>
          )}
        </div>
        <span className="menu-summary-art" aria-hidden="true">
          <Icon name={summarySlides[activeSummary]?.icon || 'bag'} size={118} />
        </span>
        {summarySlides.length > 0 && (
          <div className="menu-summary-pagination" aria-label="Pilih ringkasan">
            {summarySlides.map((slide, index) => (
              <button
                key={slide.label}
                type="button"
                className={index === activeSummary ? 'active' : ''}
                aria-label={slide.label}
                aria-pressed={index === activeSummary}
                onClick={() => setActiveSummary(index)} />
            ))}
          </div>
        )}
        {loaded && loadError && (
          <button className="menu-summary-retry" type="button" onClick={() => requestPageRefresh('menu')}>
            Coba lagi
          </button>
        )}
      </section>

      <section className="menu-finance-strip" aria-label="Ringkasan kas dan hutang">
        <div className="menu-finance-metric">
          <span className="menu-finance-icon cash"><Icon name="wallet" size={24} /></span>
          <span className="menu-finance-copy">
            <span>Saldo kas</span>
            <strong>
              {summary
                ? rupiah(summary.cashBalance)
                : loaded && loadError
                  ? '—'
                  : <LoadingNumber label="saldo kas" />}
            </strong>
          </span>
        </div>
        <div className="menu-finance-metric">
          <span className="menu-finance-icon debt"><Icon name="alertTriangle" size={24} /></span>
          <span className="menu-finance-copy">
            <span>Total hutang</span>
            <strong>
              {summary
                ? rupiah(summary.totalDebt)
                : loaded && loadError
                  ? '—'
                  : <LoadingNumber label="total hutang" />}
            </strong>
          </span>
        </div>
      </section>

      <section className="menu-list-section">
        <div className="menu-list-heading">
          <h2>Menu</h2>
        </div>
        <nav className="menu-shortcuts" aria-label="Pilih menu">
          {filteredItems.map((item, index) => (
            item.id === 'chat' ? (
              <a
                key={item.id}
                className={'menu-shortcut menu-shortcut-' + (index % 4)}
                href={import.meta.env.BASE_URL + 'chat/?mode=chat'}>
                <span className="menu-shortcut-icon"><Icon name={item.icon} size={30} /></span>
                <span className="menu-shortcut-label">{item.label}</span>
                <span className="menu-shortcut-description">{item.description}</span>
              </a>
            ) : (
              <button
                key={item.id}
                className={'menu-shortcut menu-shortcut-' + (index % 4)}
                type="button"
                onClick={() => item.id === 'refresh' ? requestPageRefresh('menu') : onNavigate(item.id)}>
                <span className="menu-shortcut-icon"><Icon name={item.icon} size={30} /></span>
                <span className="menu-shortcut-label">{item.label}</span>
                <span className="menu-shortcut-description">{item.description}</span>
              </button>
            )
          ))}
          {filteredItems.length === 0 && (
            <p className="menu-empty-state">Tidak ada menu yang cocok dengan “{query}”.</p>
          )}
        </nav>
      </section>
    </div>
  )
}
