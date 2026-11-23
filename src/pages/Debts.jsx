import { useEffect, useRef, useState } from 'react'
import {
  addManualCustomerCredit,
  createVendorPayable,
  getAll,
  getFinanceData,
  getReceivableInvoices,
  getVendorPayables,
  onRefresh,
  recordCustomerCreditPayment,
  recordVendorPayablePayment,
  requestPageRefresh
} from '../db'
import { rupiah, dateOnly, dateTime } from '../format'
import { localDateValue, dateRangeTimestamps } from '../dateFilter'
import { getInvoiceNumber } from '../invoice'
import { isSafeRupiahAmount } from '../money'
import CustomerIdentity from '../components/CustomerIdentity.jsx'
import MoneyInput from '../components/MoneyInput.jsx'
import SelectInput from '../components/SelectInput.jsx'
import VendorSelect from '../components/VendorSelect.jsx'
import TransactionDetails from '../components/TransactionDetails.jsx'
import Icon from '../components/Icon.jsx'

const PAGE_SIZE = 20

export default function Debts() {
  const [activeTab, setActiveTab] = useState('receivables')
  const [customerBalances, setCustomerBalances] = useState([])
  const [invoices, setInvoices] = useState([])
  const [invoiceCount, setInvoiceCount] = useState(0)
  const [invoicePage, setInvoicePage] = useState(1)
  const [payables, setPayables] = useState([])
  const [payableCount, setPayableCount] = useState(0)
  const [payablePage, setPayablePage] = useState(1)
  const [vendors, setVendors] = useState([])
  const [customers, setCustomers] = useState([])
  const [loadError, setLoadError] = useState('')
  const [vendorError, setVendorError] = useState('')
  const [savingDebt, setSavingDebt] = useState(false)
  const [debtError, setDebtError] = useState('')
  const [debtStatus, setDebtStatus] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [description, setDescription] = useState('')
  const [debtAmount, setDebtAmount] = useState('')
  const [debtDate, setDebtDate] = useState(() => localDateValue(new Date()))
  const [selectedPayable, setSelectedPayable] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [selectedCustomerDebt, setSelectedCustomerDebt] = useState(null)
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState('')
  const [customerPaymentError, setCustomerPaymentError] = useState('')
  const [savingCustomerPayment, setSavingCustomerPayment] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [savingManualDebt, setSavingManualDebt] = useState(false)
  const [manualDebtOpen, setManualDebtOpen] = useState(false)
  const [manualDebtCustomer, setManualDebtCustomer] = useState('')
  const [manualDebtAmount, setManualDebtAmount] = useState('')
  const [manualDebtError, setManualDebtError] = useState('')
  const [selectedDebt, setSelectedDebt] = useState(null)
  const requestId = useRef(0)
  const paymentRequest = useRef(null)
  const customerPaymentRequest = useRef(null)
  const manualDebtRequest = useRef(null)
  const savingLock = useRef(false)

  useEffect(() => {
    let active = true
    async function loadMasters() {
      try {
        const [customerRows, vendorRows] = await Promise.all([getAll('customers'), getAll('vendors')])
        if (!active) return
        setCustomers(customerRows)
        setVendors(vendorRows)
        setVendorError('')
      } catch (error) {
        if (active) setVendorError(error.message || 'Gagal memuat data pelanggan dan vendor.')
      }
    }
    loadMasters()
    const unsubscribe = onRefresh(loadMasters, 'debts')
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      const currentRequest = ++requestId.current
      setLoadError('')
      try {
        if (activeTab === 'receivables') {
          const [balanceData, invoiceData] = await Promise.all([
            getFinanceData({ from: null, to: null, page: 1, pageSize: 1 }),
            getReceivableInvoices(invoicePage, PAGE_SIZE)
          ])
          if (!active || currentRequest !== requestId.current) return
          setCustomerBalances(balanceData.credit_balances || [])
          setInvoices(invoiceData.invoices)
          setInvoiceCount(invoiceData.totalCount)
        } else {
          const payableData = await getVendorPayables(payablePage, PAGE_SIZE)
          if (!active || currentRequest !== requestId.current) return
          setPayables(payableData.payables)
          setPayableCount(payableData.totalCount)
        }
      } catch (error) {
        if (active && currentRequest === requestId.current) {
          setLoadError(error.message || 'Gagal memuat data utang/piutang.')
        }
      }
    }
    load()
    const unsubscribe = onRefresh(load, 'debts')
    return () => {
      active = false
      unsubscribe()
    }
  }, [activeTab, invoicePage, payablePage])

  async function submitVendorDebt(event) {
    event.preventDefault()
    if (savingLock.current) return
    setDebtError('')
    setDebtStatus('')
    const amount = Number(debtAmount)
    if (!vendors.some((vendor) => vendor.name === vendorName)) {
      setDebtError('Pilih vendor yang tersedia dari tab Setting.')
      return
    }
    if (!description.trim()) {
      setDebtError('Keterangan pembelian wajib diisi.')
      return
    }
    if (!isSafeRupiahAmount(amount)) {
      setDebtError('Nominal utang harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    let date
    try {
      date = dateRangeTimestamps({ from: debtDate, to: debtDate }).from
    } catch (error) {
      setDebtError(error.message || 'Pilih tanggal pembelian yang valid.')
      return
    }
    const fingerprint = JSON.stringify([vendorName, description.trim(), amount, date])
    if (paymentRequest.current?.fingerprint !== fingerprint) {
      paymentRequest.current = { fingerprint, id: crypto.randomUUID() }
    }
    savingLock.current = true
    setSavingDebt(true)
    try {
      await createVendorPayable({
        vendorName,
        description: description.trim(),
        amount,
        date,
        requestId: paymentRequest.current.id
      })
      paymentRequest.current = null
      setVendorName('')
      setDescription('')
      setDebtAmount('')
      setDebtDate(localDateValue(new Date()))
      setPayablePage(1)
      setDebtStatus('Utang pembelian berhasil dicatat.')
    } catch (error) {
      setDebtError(error.message || 'Gagal mencatat utang pembelian.')
    } finally {
      savingLock.current = false
      setSavingDebt(false)
    }
  }

  async function submitVendorPayment(event) {
    event.preventDefault()
    if (!selectedPayable || savingLock.current) return
    setPaymentError('')
    const amount = Number(paymentAmount)
    if (!isSafeRupiahAmount(amount)) {
      setPaymentError('Nominal pembayaran harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    if (amount > Number(selectedPayable.balance_due)) {
      setPaymentError('Pembayaran tidak boleh melebihi sisa utang ' + rupiah(selectedPayable.balance_due) + '.')
      return
    }
    const fingerprint = selectedPayable.id + ':' + amount
    if (paymentRequest.current?.fingerprint !== fingerprint) {
      paymentRequest.current = { fingerprint, id: crypto.randomUUID() }
    }
    savingLock.current = true
    setSavingPayment(true)
    try {
      await recordVendorPayablePayment(selectedPayable.id, amount, paymentRequest.current.id)
      paymentRequest.current = null
      setSelectedPayable(null)
      setPaymentAmount('')
    } catch (error) {
      setPaymentError(error.message || 'Gagal menyimpan pembayaran utang pembelian.')
    } finally {
      savingLock.current = false
      setSavingPayment(false)
    }
  }

  function openCustomerPayment(debt) {
    setSelectedCustomerDebt(debt)
    setCustomerPaymentAmount(String(Number(debt.balance_due)))
    setCustomerPaymentError('')
    customerPaymentRequest.current = null
  }

  async function submitCustomerPayment(event) {
    event.preventDefault()
    if (!selectedCustomerDebt || savingLock.current) return
    setCustomerPaymentError('')
    const amount = Number(customerPaymentAmount)
    if (!isSafeRupiahAmount(amount)) {
      setCustomerPaymentError('Nominal pembayaran harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    if (amount > Number(selectedCustomerDebt.balance_due)) {
      setCustomerPaymentError('Pembayaran tidak boleh melebihi sisa piutang ' + rupiah(selectedCustomerDebt.balance_due) + '.')
      return
    }
    const fingerprint = selectedCustomerDebt.customer_name + ':' + amount
    if (customerPaymentRequest.current?.fingerprint !== fingerprint) {
      customerPaymentRequest.current = { fingerprint, id: crypto.randomUUID() }
    }
    savingLock.current = true
    setSavingCustomerPayment(true)
    try {
      await recordCustomerCreditPayment(
        selectedCustomerDebt.customer_name,
        amount,
        customerPaymentRequest.current.id
      )
      customerPaymentRequest.current = null
      setSelectedCustomerDebt(null)
    } catch (error) {
      setCustomerPaymentError(error.message || 'Gagal menyimpan pembayaran piutang.')
    } finally {
      savingLock.current = false
      setSavingCustomerPayment(false)
    }
  }

  async function submitManualDebt(event) {
    event.preventDefault()
    if (savingLock.current) return
    setManualDebtError('')
    const amount = Number(manualDebtAmount)
    if (!customers.some((customer) => customer.name === manualDebtCustomer)) {
      setManualDebtError('Pilih pelanggan dari master pelanggan.')
      return
    }
    if (!isSafeRupiahAmount(amount)) {
      setManualDebtError('Nominal hutang harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    const fingerprint = JSON.stringify([manualDebtCustomer, amount])
    if (manualDebtRequest.current?.fingerprint !== fingerprint) {
      manualDebtRequest.current = { fingerprint, id: crypto.randomUUID() }
    }
    savingLock.current = true
    setSavingManualDebt(true)
    try {
      await addManualCustomerCredit(manualDebtCustomer, amount, manualDebtRequest.current.id)
      manualDebtRequest.current = null
      setManualDebtOpen(false)
      setManualDebtCustomer('')
      setManualDebtAmount('')
    } catch (error) {
      setManualDebtError(error.message || 'Gagal mencatat piutang pelanggan.')
    } finally {
      savingLock.current = false
      setSavingManualDebt(false)
    }
  }

  function updateSelectedInvoice(transaction) {
    setInvoices((current) => current.map((invoice) => invoice.id === transaction.id ? transaction : invoice))
    setSelectedInvoice(transaction)
  }

  const invoicePageCount = Math.max(1, Math.ceil(invoiceCount / PAGE_SIZE))
  const payablePageCount = Math.max(1, Math.ceil(payableCount / PAGE_SIZE))

  return (
    <div className="page debts-page">
      <header className="debts-page-heading">
        <div>
          <span className="debts-page-kicker">KEUANGAN</span>
          <h2>Utang/Piutang</h2>
          <p className="muted">Kelola tagihan pelanggan dan kewajiban ke vendor dalam satu tempat.</p>
        </div>
      </header>

      <div className="debts-tabs" role="tablist" aria-label="Jenis utang">
        <button
          className={activeTab === 'receivables' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'receivables'}
          onClick={() => setActiveTab('receivables')}>
          Piutang pelanggan
        </button>
        <button
          className={activeTab === 'payables' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'payables'}
          onClick={() => setActiveTab('payables')}>
          Utang pembelian
        </button>
      </div>

      {vendorError && <p className="form-error" role="alert">{vendorError}</p>}
      {loadError && (
        <div className="debts-load-error">
          <p className="form-error" role="alert">{loadError}</p>
          <button className="btn" type="button" onClick={() => requestPageRefresh('debts')}>Coba lagi</button>
        </div>
      )}

      {activeTab === 'receivables' ? (
        <section className="card table-card debts-card">
          <div className="debts-section-heading">
            <div>
              <h3>Piutang pelanggan</h3>
              <p className="muted small">Pembayaran sebagian dan pelunasan akan dialokasikan ke tagihan pelanggan yang paling lama.</p>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => {
              setManualDebtOpen(true)
              setManualDebtError('')
            }}>
              <Icon name="plus" size={15} /> Catat piutang lama
            </button>
          </div>
          <h4 className="debts-subheading">Sisa piutang per pelanggan</h4>
          {customerBalances.length === 0 ? (
            <p className="debts-empty muted">Tidak ada piutang pelanggan yang belum lunas.</p>
          ) : (
            <div className="debts-customer-list">
              {customerBalances.map((debt) => (
                <div className="debts-customer-row" key={debt.customer_name}>
                  <CustomerIdentity
                    name={debt.customer_name}
                    customer={customers.find((customer) => customer.name === debt.customer_name)}
                  />
                  <strong>{rupiah(Number(debt.balance_due))}</strong>
                  <button className="btn btn-sm btn-primary" type="button" onClick={() => openCustomerPayment(debt)}>
                    Bayar
                  </button>
                </div>
              ))}
            </div>
          )}

          <h4 className="debts-subheading">Daftar faktur kredit</h4>
          <div className="debts-table-wrap">
            <table className="debts-table">
              <thead>
                <tr>
                  <th>No. faktur</th>
                  <th>Pelanggan</th>
                  <th>Tanggal</th>
                  <th className="right">Total</th>
                  <th className="right">Sudah dibayar</th>
                  <th className="right">Sisa tagihan</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {!loadError && invoices.length === 0 ? (
                  <tr><td className="muted center" colSpan="7">Belum ada faktur transaksi kredit.</td></tr>
                ) : invoices.map((invoice) => {
                  const paidAmount = invoice.paidAmount != null
                    ? Number(invoice.paidAmount)
                    : Math.min(Number(invoice.total) || 0, Number(invoice.payment) || 0)
                  const balanceDue = invoice.balanceDue != null
                    ? Number(invoice.balanceDue)
                    : Math.max(0, Number(invoice.total) - paidAmount)
                  return (
                    <tr key={invoice.id}>
                      <td><strong>{getInvoiceNumber(invoice)}</strong></td>
                      <td>{invoice.customerName || 'Pelanggan'}</td>
                      <td>{dateOnly(invoice.createdAt)}</td>
                      <td className="right">{rupiah(invoice.total)}</td>
                      <td className="right">
                        <strong>{rupiah(paidAmount)}</strong>
                        {invoice.payments.length > 0 && (
                          <span className="debts-payment-history">
                            {invoice.payments.map((payment, index) => (
                              <span key={index}>{dateTime(payment.date)} · {rupiah(payment.amount)}</span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="right"><strong className={balanceDue > 0 ? 'danger' : 'ok'}>{rupiah(balanceDue)}</strong></td>
                      <td>
                        <button className="btn btn-sm" type="button" onClick={() => setSelectedInvoice(invoice)}>
                          Detail
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <DebtPagination
            page={invoicePage}
            pageCount={invoicePageCount}
            total={invoiceCount}
            label="faktur"
            onChange={setInvoicePage}
          />
        </section>
      ) : (
        <>
          <section className="card debts-form-card">
            <div className="debts-section-heading">
              <div>
                <h3>Catat utang pembelian</h3>
                <p className="muted small">Pembayaran baru masuk ke Buku Kas sebagai pengeluaran saat dibayar.</p>
              </div>
            </div>
            <form className="debts-form" onSubmit={submitVendorDebt}>
              <label>
                Vendor
                <VendorSelect
                  value={vendorName}
                  onChange={setVendorName}
                  vendors={vendors}
                  fieldName="Vendor"
                  placeholder="Pilih vendor"
                  disabled={savingDebt || vendors.length === 0}
                />
              </label>
              <label>
                Keterangan pembelian
                <input
                  className="input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={200}
                  placeholder="Contoh: Bahan kulit"
                  required
                />
              </label>
              <label>
                Total utang
                <MoneyInput value={debtAmount} onChange={setDebtAmount} placeholder="Masukkan nominal" required />
              </label>
              <label>
                Tanggal
                <input
                  className="input"
                  type="date"
                  value={debtDate}
                  onChange={(event) => setDebtDate(event.target.value)}
                  required
                />
              </label>
              {debtError && <p className="form-error debts-form-message" role="alert">{debtError}</p>}
              {debtStatus && <p className="backup-success debts-form-message" role="status">{debtStatus}</p>}
              <button className="btn btn-primary debts-form-submit" type="submit" disabled={savingDebt || vendors.length === 0}>
                {savingDebt ? 'Menyimpan...' : 'Simpan utang'}
              </button>
            </form>
          </section>

          <section className="card table-card debts-card">
            <div className="debts-section-heading">
              <div>
                <h3>Daftar utang pembelian</h3>
                <p className="muted small">Catat pembayaran sebagian atau lunasi utang vendor.</p>
              </div>
            </div>
            <div className="debts-table-wrap">
              <table className="debts-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Vendor</th>
                    <th>Keterangan</th>
                    <th className="right">Total</th>
                    <th className="right">Sudah dibayar</th>
                    <th className="right">Sisa utang</th>
                    <th>Pembayaran</th>
                  </tr>
                </thead>
                <tbody>
                  {!loadError && payables.length === 0 ? (
                    <tr><td className="muted center" colSpan="7">Belum ada utang pembelian yang dicatat.</td></tr>
                  ) : payables.map((payable) => {
                    const paidAmount = Number(payable.original_amount) - Number(payable.balance_due)
                    return (
                      <tr key={payable.id}>
                        <td>{dateOnly(payable.date)}</td>
                        <td><strong>{payable.vendor_name}</strong></td>
                        <td>{payable.description}</td>
                        <td className="right">{rupiah(payable.original_amount)}</td>
                        <td className="right">
                          <strong>{rupiah(paidAmount)}</strong>
                          {payable.payments.length > 0 && (
                            <span className="debts-payment-history">
                              {payable.payments.map((payment, index) => (
                                <span key={index}>{dateTime(payment.date)} · {rupiah(payment.amount)}</span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="right"><strong className={Number(payable.balance_due) > 0 ? 'danger' : 'ok'}>{rupiah(payable.balance_due)}</strong></td>
                        <td>
                          {Number(payable.balance_due) > 0 ? (
                            <button
                              className="btn btn-sm btn-primary"
                              type="button"
                              onClick={() => {
                                setSelectedPayable(payable)
                                setPaymentAmount(String(payable.balance_due))
                                setPaymentError('')
                                paymentRequest.current = null
                              }}>
                              Bayar
                            </button>
                          ) : <span className="badge badge-ok">Lunas</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <DebtPagination
              page={payablePage}
              pageCount={payablePageCount}
              total={payableCount}
              label="utang"
              onChange={setPayablePage}
            />
          </section>
        </>
      )}

      {selectedPayable && (
        <div className="overlay" onClick={() => !savingPayment && setSelectedPayable(null)}>
          <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submitVendorPayment}>
            <h3>Bayar utang pembelian</h3>
            <p className="muted">{selectedPayable.vendor_name} · {selectedPayable.description}</p>
            <p className="installment-balance">Sisa utang <strong>{rupiah(selectedPayable.balance_due)}</strong></p>
            <div className="debts-payment-modes" role="group" aria-label="Jumlah pembayaran">
              <button className="btn" type="button" onClick={() => setPaymentAmount(String(selectedPayable.balance_due))}>Lunasi penuh</button>
              <button className="btn" type="button" onClick={() => setPaymentAmount('')}>Bayar sebagian</button>
            </div>
            <label htmlFor="vendor-payable-payment">Jumlah pembayaran</label>
            <MoneyInput
              id="vendor-payable-payment"
              value={paymentAmount}
              onChange={setPaymentAmount}
              placeholder="Masukkan nominal"
              required
            />
            {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
            <div className="modal-actions">
              <button className="btn" type="button" disabled={savingPayment} onClick={() => setSelectedPayable(null)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={savingPayment}>
                {savingPayment ? 'Menyimpan...' : 'Simpan pembayaran'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedCustomerDebt && (
        <div className="overlay" onClick={() => !savingCustomerPayment && setSelectedCustomerDebt(null)}>
          <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submitCustomerPayment}>
            <h3>Pembayaran piutang pelanggan</h3>
            <p className="muted">{selectedCustomerDebt.customer_name} · Sisa piutang {rupiah(selectedCustomerDebt.balance_due)}</p>
            <label htmlFor="customer-receivable-payment">Jumlah pembayaran</label>
            <MoneyInput
              id="customer-receivable-payment"
              value={customerPaymentAmount}
              onChange={setCustomerPaymentAmount}
              placeholder="Masukkan nominal"
              required
            />
            <p className="muted small">Pembayaran dialokasikan ke piutang tertua pelanggan terlebih dahulu.</p>
            {customerPaymentError && <p className="form-error" role="alert">{customerPaymentError}</p>}
            <div className="modal-actions">
              <button className="btn" type="button" disabled={savingCustomerPayment} onClick={() => setSelectedCustomerDebt(null)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={savingCustomerPayment}>
                {savingCustomerPayment ? 'Menyimpan...' : 'Simpan pembayaran'}
              </button>
            </div>
          </form>
        </div>
      )}

      {manualDebtOpen && (
        <div className="overlay" onClick={() => !savingManualDebt && setManualDebtOpen(false)}>
          <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submitManualDebt}>
            <h3>Catat piutang lama</h3>
            <label htmlFor="manual-receivable-customer">Pelanggan</label>
            <SelectInput
              id="manual-receivable-customer"
              ariaLabel="Pelanggan"
              value={manualDebtCustomer}
              onChange={setManualDebtCustomer}
              required
              disabled={customers.length === 0 || savingManualDebt}
              placeholder="Pilih pelanggan"
              options={customers.map((customer) => ({ value: customer.name, label: customer.name }))}
            />
            <label htmlFor="manual-receivable-amount">Nominal piutang</label>
            <MoneyInput
              id="manual-receivable-amount"
              value={manualDebtAmount}
              onChange={setManualDebtAmount}
              placeholder="Masukkan nominal"
              required
            />
            {manualDebtError && <p className="form-error" role="alert">{manualDebtError}</p>}
            <div className="modal-actions">
              <button className="btn" type="button" disabled={savingManualDebt} onClick={() => setManualDebtOpen(false)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={savingManualDebt || customers.length === 0}>
                {savingManualDebt ? 'Menyimpan...' : 'Simpan piutang'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedInvoice && (
        <TransactionDetails
          transaction={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onTransactionUpdated={updateSelectedInvoice}
        />
      )}
    </div>
  )
}

function DebtPagination({ page, pageCount, total, label, onChange }) {
  return total > 0 && (
    <div className="dashboard-pagination">
      <span className="muted small">
        Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} dari {total} {label}
      </span>
      {pageCount > 1 && (
        <div className="dashboard-pagination-controls">
          <button className="btn btn-sm" type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>Sebelumnya</button>
          <span className="small">Halaman {page} dari {pageCount}</span>
          <button className="btn btn-sm" type="button" disabled={page === pageCount} onClick={() => onChange(page + 1)}>Berikutnya</button>
        </div>
      )}
    </div>
  )
}
