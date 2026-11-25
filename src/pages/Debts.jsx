import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addManualCustomerCredit,
  getAll,
  getCustomerReceivableDetails,
  getFinanceData,
  getVendorPayables,
  onRefresh,
  recordCustomerDebtPayment,
  recordVendorPayableGroupPayment,
  requestPageRefresh
} from '../db'
import { rupiah, dateOnly, dateTime } from '../format'
import { getInvoiceNumber, invoiceDueDate } from '../invoice'
import { isSafeRupiahAmount } from '../money'
import CustomerIdentity from '../components/CustomerIdentity.jsx'
import MoneyInput from '../components/MoneyInput.jsx'
import SelectInput from '../components/SelectInput.jsx'
import TransactionDetails from '../components/TransactionDetails.jsx'
import Icon from '../components/Icon.jsx'
import {
  allocateCustomerDebtPayment,
  allocateCustomerPayment,
  orderCustomerManualCredits
} from '../customerPaymentAllocation.js'
import { allocateVendorPayment } from '../vendorPaymentAllocation.js'

const PAGE_SIZE = 20

export default function Debts() {
  const [activeTab, setActiveTab] = useState('receivables')
  const [customerBalances, setCustomerBalances] = useState([])
  const [expandedCustomer, setExpandedCustomer] = useState('')
  const [customerDetails, setCustomerDetails] = useState({})
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState('')
  const [customerDetailsError, setCustomerDetailsError] = useState('')
  const [vendorGroups, setVendorGroups] = useState([])
  const [totalVendorDebt, setTotalVendorDebt] = useState(0)
  const [expandedVendor, setExpandedVendor] = useState('')
  const [payableCount, setPayableCount] = useState(0)
  const [payablePage, setPayablePage] = useState(1)
  const [customers, setCustomers] = useState([])
  const [customerLoadError, setCustomerLoadError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [selectedVendorDebt, setSelectedVendorDebt] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [selectedCustomerDebt, setSelectedCustomerDebt] = useState(null)
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState('')
  const [customerPaymentError, setCustomerPaymentError] = useState('')
  const [savingCustomerPayment, setSavingCustomerPayment] = useState(false)
  const [loadingCustomerPaymentInvoices, setLoadingCustomerPaymentInvoices] = useState(false)
  const [customerPaymentInvoicesError, setCustomerPaymentInvoicesError] = useState('')
  const [savingVendorPayment, setSavingVendorPayment] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [savingManualDebt, setSavingManualDebt] = useState(false)
  const [manualDebtOpen, setManualDebtOpen] = useState(false)
  const [manualDebtCustomer, setManualDebtCustomer] = useState('')
  const [manualDebtAmount, setManualDebtAmount] = useState('')
  const [manualDebtError, setManualDebtError] = useState('')
  const requestId = useRef(0)
  const vendorPaymentRequest = useRef(null)
  const customerPaymentRequest = useRef(null)
  const manualDebtRequest = useRef(null)
  const savingLock = useRef(false)

  useEffect(() => {
    let active = true
    async function loadMasters() {
      try {
        const customerRows = await getAll('customers')
        if (!active) return
        setCustomers(customerRows)
        setCustomerLoadError('')
      } catch (error) {
        if (active) setCustomerLoadError(error.message || 'Gagal memuat data pelanggan.')
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
          const balanceData = await getFinanceData({ from: null, to: null, page: 1, pageSize: 1 })
          if (!active || currentRequest !== requestId.current) return
          setCustomerBalances(balanceData.credit_balances || [])
        } else {
          const payableData = await getVendorPayables(payablePage, PAGE_SIZE)
          if (!active || currentRequest !== requestId.current) return
          setVendorGroups(payableData.vendors)
          setPayableCount(payableData.totalCount)
          setTotalVendorDebt(payableData.totalBalance)
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
  }, [activeTab, payablePage])

  function openVendorPayment(vendor) {
    setSelectedVendorDebt({ ...vendor, excludedPayableIds: [] })
    setPaymentAmount('')
    setPaymentError('')
    vendorPaymentRequest.current = null
  }

  const vendorPaymentPlan = selectedVendorDebt
    ? allocateVendorPayment(
      selectedVendorDebt.payables,
      Number(paymentAmount),
      selectedVendorDebt.excludedPayableIds
    )
    : { allocations: [], allocatedAmount: 0, remainingAmount: 0 }

  async function submitVendorPayment(event) {
    event.preventDefault()
    if (!selectedVendorDebt || savingLock.current) return
    setPaymentError('')
    const amount = Number(paymentAmount)
    if (!isSafeRupiahAmount(amount)) {
      setPaymentError('Nominal pembayaran harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    if (amount > Number(selectedVendorDebt.balance_due)) {
      setPaymentError('Pembayaran tidak boleh melebihi sisa utang ' + rupiah(selectedVendorDebt.balance_due) + '.')
      return
    }
    const allocations = vendorPaymentPlan.allocations.map(({ payableId, amount: allocationAmount }) => ({
      payableId,
      amount: allocationAmount
    }))
    if (vendorPaymentPlan.remainingAmount > 0) {
      setPaymentError('Nominal pembayaran melebihi saldo pembelian yang masih dipilih. Pilih kembali pembelian atau kurangi nominal pembayaran.')
      return
    }
    if (vendorPaymentPlan.allocatedAmount !== amount) {
      setPaymentError('Pastikan seluruh nominal pembayaran dialokasikan ke pembelian.')
      return
    }
    const fingerprint = selectedVendorDebt.vendor_name + ':' + amount + ':' + JSON.stringify(allocations)
    if (vendorPaymentRequest.current?.fingerprint !== fingerprint) {
      vendorPaymentRequest.current = { fingerprint, id: crypto.randomUUID() }
    }
    savingLock.current = true
    setSavingVendorPayment(true)
    try {
      await recordVendorPayableGroupPayment(
        selectedVendorDebt.vendor_name,
        amount,
        allocations,
        vendorPaymentRequest.current.id
      )
      vendorPaymentRequest.current = null
      setSelectedVendorDebt(null)
      setPaymentAmount('')
    } catch (error) {
      setPaymentError(error.message || 'Gagal menyimpan pembayaran utang pembelian.')
    } finally {
      savingLock.current = false
      setSavingVendorPayment(false)
    }
  }

  async function openCustomerPayment(debt) {
    setSelectedCustomerDebt({
      ...debt,
      invoices: [],
      manualCredits: [],
      excludedInvoiceIds: [],
      excludedManualCreditIds: []
    })
    setCustomerPaymentAmount('')
    setCustomerPaymentError('')
    setCustomerPaymentInvoicesError('')
    customerPaymentRequest.current = null
    setLoadingCustomerPaymentInvoices(true)
    try {
      const details = await getCustomerReceivableDetails(debt.customer_name)
      setSelectedCustomerDebt((current) => current && current.customer_name === debt.customer_name
        ? {
            ...current,
            invoices: details.invoices,
            manualCredits: details.manualCredits,
            excludedInvoiceIds: [],
            excludedManualCreditIds: []
          }
        : current)
    } catch (error) {
      setCustomerPaymentInvoicesError(error.message || 'Gagal memuat komponen piutang untuk pembayaran.')
    } finally {
      setLoadingCustomerPaymentInvoices(false)
    }
  }

  const customerPaymentPlan = selectedCustomerDebt
    ? allocateCustomerDebtPayment({
      invoices: selectedCustomerDebt.invoices,
      manualCredits: selectedCustomerDebt.manualCredits,
      amount: Number(customerPaymentAmount),
      excludedInvoiceIds: selectedCustomerDebt.excludedInvoiceIds,
      excludedManualCreditIds: selectedCustomerDebt.excludedManualCreditIds
    })
    : { allocations: [], allocatedAmount: 0, remainingAmount: 0 }

  async function toggleCustomerDetails(debt) {
    const customerKey = debt.customer_name.trim().toLocaleLowerCase('id-ID')
    if (expandedCustomer === customerKey) {
      setExpandedCustomer('')
      setCustomerDetailsError('')
      return
    }

    setExpandedCustomer(customerKey)
    setCustomerDetailsError('')
    if (customerDetails[customerKey]) return

    setLoadingCustomerDetails(customerKey)
    try {
      const details = await getCustomerReceivableDetails(debt.customer_name)
      setCustomerDetails((current) => ({ ...current, [customerKey]: details }))
    } catch (error) {
      setCustomerDetailsError(error.message || 'Gagal memuat detail piutang pelanggan.')
    } finally {
      setLoadingCustomerDetails('')
    }
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
    const allocations = customerPaymentPlan.allocations.map(({ kind, id, amount: allocationAmount }) => ({
      kind,
      id,
      amount: allocationAmount
    }))
    if (customerPaymentPlan.remainingAmount > 0) {
      setCustomerPaymentError('Nominal pembayaran melebihi saldo piutang yang masih dipilih. Pilih kembali komponen piutang atau kurangi nominal pembayaran.')
      return
    }
    if (customerPaymentPlan.allocatedAmount !== amount) {
      setCustomerPaymentError('Pastikan seluruh nominal pembayaran dialokasikan ke faktur atau piutang lama.')
      return
    }
    const fingerprint = selectedCustomerDebt.customer_name + ':' + amount + ':' + JSON.stringify(allocations)
    if (customerPaymentRequest.current?.fingerprint !== fingerprint) {
      customerPaymentRequest.current = { fingerprint, id: crypto.randomUUID() }
    }
    savingLock.current = true
    setSavingCustomerPayment(true)
    try {
      await recordCustomerDebtPayment(
        selectedCustomerDebt.customer_name,
        amount,
        allocations,
        customerPaymentRequest.current.id
      )
      customerPaymentRequest.current = null
      const customerKey = selectedCustomerDebt.customer_name.trim().toLocaleLowerCase('id-ID')
      setSelectedCustomerDebt(null)
      setLoadingCustomerDetails(customerKey)
      setCustomerDetailsError('')
      try {
        const updatedDetails = await getCustomerReceivableDetails(selectedCustomerDebt.customer_name)
        setCustomerDetails((current) => ({ ...current, [customerKey]: updatedDetails }))
      } catch (error) {
        setCustomerDetailsError(error.message || 'Pembayaran berhasil, tetapi detail piutang gagal diperbarui.')
      } finally {
        setLoadingCustomerDetails('')
      }
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
    setSelectedInvoice(transaction)
    const customerKey = String(transaction.customerName || '').trim().toLocaleLowerCase('id-ID')
      || expandedCustomer
    setCustomerDetails((current) => {
      const details = current[customerKey]
      if (!details) return current
      const invoices = details.invoices
        .map((invoice) => invoice.id === transaction.id ? { ...invoice, ...transaction } : invoice)
        .filter((invoice) => Number(invoice.balanceDue) > 0)
      return { ...current, [customerKey]: { ...details, invoices } }
    })
  }

  const payablePageCount = Math.max(1, Math.ceil(payableCount / PAGE_SIZE))
  const totalCustomerReceivable = customerBalances.reduce(
    (total, debt) => total + Number(debt.balance_due || 0),
    0
  )
  const activeCustomerDebt = customerBalances.find(
    (debt) => debt.customer_name.trim().toLocaleLowerCase('id-ID') === expandedCustomer
  )
  const activeVendorDebt = vendorGroups.find(
    (vendor) => vendor.vendor_name.trim().toLocaleLowerCase('id-ID') === expandedVendor
  )

  return (
    <div className="page debts-page">
      <div className="debts-tabs" role="tablist" aria-label="Jenis utang">
        <button
          className={activeTab === 'receivables' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'receivables'}
          onClick={() => {
            setExpandedCustomer('')
            setExpandedVendor('')
            setActiveTab('receivables')
          }}>
          Piutang pelanggan
        </button>
        <button
          className={activeTab === 'payables' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'payables'}
          onClick={() => {
            setExpandedCustomer('')
            setExpandedVendor('')
            setActiveTab('payables')
          }}>
          Utang pembelian
        </button>
      </div>

      {(loadError || (activeTab === 'receivables' && customerLoadError)) && (
        <div className="debts-load-error">
          <p className="form-error" role="alert">{loadError || customerLoadError}</p>
          <button className="btn" type="button" onClick={() => requestPageRefresh('debts')}>Coba lagi</button>
        </div>
      )}

      {activeTab === 'receivables' ? (
        <section className="card table-card debts-card">
          <div className="debts-section-heading">
            <div>
              <h3>Piutang pelanggan</h3>
            </div>
            <button className="btn btn-primary debts-manual-receivable-button" type="button" onClick={() => {
              setManualDebtOpen(true)
              setManualDebtError('')
            }}>
              <Icon name="plus" size={15} /> Catat piutang lama
            </button>
          </div>
          <div className="debts-list-heading">
            <h4>Daftar faktur kredit</h4>
            <div className="debts-list-total">
              <span>Total piutang pelanggan</span>
              <strong>{rupiah(totalCustomerReceivable)}</strong>
            </div>
          </div>
          {customerBalances.length === 0 ? (
            <p className="debts-empty muted">Tidak ada faktur kredit yang belum lunas.</p>
          ) : (
            <div className="debts-invoice-customer-list">
              {customerBalances.map((debt, index) => {
                const customerKey = debt.customer_name.trim().toLocaleLowerCase('id-ID')
                const isExpanded = expandedCustomer === customerKey
                return (
                  <section className="debts-invoice-customer" key={customerKey}>
                    <div className="debts-invoice-customer-row">
                      <span className="debts-invoice-customer-number">{index + 1}.</span>
                      <CustomerIdentity
                        name={debt.customer_name}
                        customer={customers.find((customer) => customer.name === debt.customer_name)}
                        className="debts-invoice-customer-identity"
                      />
                      <strong className="danger">{rupiah(Number(debt.balance_due))}</strong>
                      <div className="debts-invoice-customer-actions">
                        <button
                          className="btn btn-sm"
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleCustomerDetails(debt)}>
                          Detail faktur
                        </button>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="card table-card debts-card">
            <div className="debts-list-heading">
              <h3>Daftar utang pembelian</h3>
              <div className="debts-list-total">
                <span>Total utang pembelian</span>
                <strong>{rupiah(totalVendorDebt)}</strong>
              </div>
            </div>
            {vendorGroups.length === 0 ? (
              <p className="debts-empty muted">Belum ada utang pembelian yang dicatat.</p>
            ) : (
              <div className="debts-invoice-customer-list debts-vendor-list">
                {vendorGroups.map((vendor, index) => {
                  const vendorKey = vendor.vendor_name.trim().toLocaleLowerCase('id-ID')
                  return (
                    <div className="debts-vendor-row" key={vendorKey}>
                      <span className="debts-invoice-customer-number">{(payablePage - 1) * PAGE_SIZE + index + 1}.</span>
                      <strong className="debts-vendor-name">{vendor.vendor_name}</strong>
                      <strong className="danger debts-vendor-balance">{rupiah(vendor.balance_due)}</strong>
                      <button
                        className="btn btn-sm"
                        type="button"
                        onClick={() => setExpandedVendor(vendorKey)}>
                        Detail utang
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <DebtPagination
              page={payablePage}
              pageCount={payablePageCount}
              total={payableCount}
              label="vendor"
              onChange={setPayablePage}
            />
          </section>
      )}

      {activeTab === 'receivables' && activeCustomerDebt && createPortal(
        <div className="overlay debts-customer-details-overlay" onClick={() => setExpandedCustomer('')}>
          <section
            className="modal debts-customer-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debts-customer-details-title"
            onClick={(event) => event.stopPropagation()}>
            <header className="debts-customer-details-heading">
              <div>
                <h3 id="debts-customer-details-title">Detail faktur</h3>
                <CustomerIdentity
                  name={activeCustomerDebt.customer_name}
                  customer={customers.find((customer) => customer.name === activeCustomerDebt.customer_name)}
                />
              </div>
              <button className="btn" type="button" onClick={() => setExpandedCustomer('')}>Tutup</button>
            </header>
            <div className="debts-invoice-customer-details">
              <div className="debts-customer-total">
                <strong>Sisa piutang gabungan: {rupiah(Number(activeCustomerDebt.balance_due))}</strong>
                <button
                  className="btn btn-primary debts-customer-pay-button"
                  type="button"
                  onClick={() => openCustomerPayment(activeCustomerDebt)}>
                  Bayar
                </button>
              </div>
              {loadingCustomerDetails === expandedCustomer ? (
                <p className="muted small">Memuat detail piutang...</p>
              ) : customerDetailsError ? (
                <p className="form-error" role="alert">{customerDetailsError}</p>
              ) : customerDetails[expandedCustomer] && (
                <>
                  {customerDetails[expandedCustomer].customerPayments.length > 0 && (
                    <>
                      <h5>Pembayaran umum pelanggan</h5>
                      <div className="debts-customer-payment-history">
                        {customerDetails[expandedCustomer].customerPayments.map((payment) => (
                          <div key={payment.id}>
                            <span>{dateTime(payment.date)}</span>
                            <strong>{rupiah(payment.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {(customerDetails[expandedCustomer].manualCreditPayments || []).length > 0 && (
                    <>
                      <h5>Pembayaran piutang lama</h5>
                      <div className="debts-customer-payment-history">
                        {(customerDetails[expandedCustomer].manualCreditPayments || []).map((payment) => (
                          <div key={payment.id}>
                            <span>{dateTime(payment.date)}</span>
                            <strong>{rupiah(payment.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <h5>Faktur yang belum lunas</h5>
                  {customerDetails[expandedCustomer].invoices.length === 0 ? (
                    <p className="muted small">Tidak ada faktur transaksi yang belum lunas.</p>
                  ) : (
                    <div className="debts-table-wrap">
                      <table className="debts-table debts-detail-table debts-invoice-detail-table">
                        <thead>
                          <tr>
                            <th>No. faktur</th>
                            <th>Jatuh tempo</th>
                            <th className="right">Total faktur</th>
                            <th className="right">Saldo per faktur</th>
                            <th>Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerDetails[expandedCustomer].invoices.map((invoice) => (
                            <tr key={invoice.id}>
                              <td>
                                <strong>{getInvoiceNumber(invoice)}</strong>
                                <span className="debts-invoice-date">{dateOnly(invoice.createdAt)}</span>
                              </td>
                              <td data-label="Jatuh tempo">{dateOnly(invoiceDueDate(invoice.createdAt))}</td>
                              <td className="right" data-label="Total">{rupiah(invoice.total)}</td>
                              <td className="right" data-label="Sisa"><strong>{rupiah(invoice.balanceDue)}</strong></td>
                              <td className="debts-invoice-detail-action">
                                <button className="btn btn-sm" type="button" onClick={() => setSelectedInvoice(invoice)}>
                                  Lihat
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {customerDetails[expandedCustomer].manualCredits.length > 0 && (
                    <>
                      <h5>Piutang lama</h5>
                      <div className="debts-table-wrap">
                        <table className="debts-table debts-detail-table">
                          <thead>
                            <tr>
                              <th>Tanggal dicatat</th>
                              <th>Jatuh tempo</th>
                              <th className="right">Sisa piutang</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerDetails[expandedCustomer].manualCredits.map((credit) => (
                              <tr key={credit.id}>
                                <td data-label="Dicatat">{dateOnly(credit.createdAt)}</td>
                                <td data-label="Jatuh tempo">{dateOnly(invoiceDueDate(credit.createdAt))}</td>
                                <td className="right" data-label="Sisa"><strong>{rupiah(credit.balance_due)}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}

      {activeTab === 'payables' && activeVendorDebt && createPortal(
        <div className="overlay debts-customer-details-overlay" onClick={() => setExpandedVendor('')}>
          <section
            className="modal debts-customer-details-modal debts-vendor-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debts-vendor-details-title"
            onClick={(event) => event.stopPropagation()}>
            <header className="debts-customer-details-heading">
              <div>
                <h3 id="debts-vendor-details-title">Detail utang pembelian</h3>
                <strong>{activeVendorDebt.vendor_name}</strong>
              </div>
              <button className="btn" type="button" onClick={() => setExpandedVendor('')}>Tutup</button>
            </header>
            <div className="debts-invoice-customer-details">
              <div className="debts-customer-total">
                <strong>Sisa utang gabungan: {rupiah(activeVendorDebt.balance_due)}</strong>
                <button
                  className="btn btn-primary debts-customer-pay-button"
                  type="button"
                  onClick={() => openVendorPayment(activeVendorDebt)}>
                  Bayar
                </button>
              </div>
              <h5>Pembelian yang belum lunas</h5>
              <div className="debts-vendor-detail-list">
                {activeVendorDebt.payables.map((payable) => {
                  const paidAmount = Number(payable.original_amount) - Number(payable.balance_due)
                  return (
                    <article className="debts-vendor-detail" key={payable.id}>
                      <div className="debts-vendor-detail-heading">
                        <strong>{dateOnly(payable.date)}</strong>
                        <span>{payable.description}</span>
                      </div>
                      <div className="debts-vendor-detail-amount">
                        <span>Total <strong>{rupiah(payable.original_amount)}</strong></span>
                        <span>Sudah dibayar <strong>{rupiah(paidAmount)}</strong></span>
                        <span>Sisa <strong className="danger">{rupiah(payable.balance_due)}</strong></span>
                      </div>
                      {payable.payments.length > 0 && (
                        <div className="debts-payment-history">
                          {payable.payments.map((payment, index) => (
                            <span key={index}>{dateTime(payment.date)} · {rupiah(payment.amount)}</span>
                          ))}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        </div>,
        document.body
      )}

      {selectedVendorDebt && (
        createPortal(
          <div className="overlay debts-payment-overlay" onClick={() => !savingVendorPayment && setSelectedVendorDebt(null)}>
            <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submitVendorPayment}>
              <h3>Pembayaran utang pembelian</h3>
              <p className="muted">{selectedVendorDebt.vendor_name} · Sisa utang {rupiah(selectedVendorDebt.balance_due)}</p>
              <label htmlFor="vendor-payable-payment">Jumlah pembayaran</label>
              <MoneyInput
                id="vendor-payable-payment"
                value={paymentAmount}
                onChange={(value) => {
                  setPaymentAmount(value)
                  setPaymentError('')
                }}
                maxAmount={Number(selectedVendorDebt.balance_due)}
                placeholder="Masukkan nominal"
                required
                disabled={savingVendorPayment}
              />
              <div className="debts-payment-allocation">
                <div className="debts-payment-allocation-heading">
                  <strong>Alokasi pembayaran</strong>
                  <span>Pembelian tertua dibayar lebih dahulu</span>
                </div>
                {(() => {
                  const fullAllocation = allocateVendorPayment(
                    selectedVendorDebt.payables,
                    selectedVendorDebt.balance_due
                  ).allocations
                  const allocatedByPayable = new Map(vendorPaymentPlan.allocations.map((allocation) => [
                    String(allocation.payableId),
                    allocation.amount
                  ]))
                  return fullAllocation.map(({ payableId, payable }) => {
                    const allocatedAmount = allocatedByPayable.get(String(payableId)) || 0
                    const fullyAllocated = allocatedAmount === Number(payable.balance_due)
                    return (
                      <article
                        className={'debts-payment-allocation-row vendor-payment-allocation-row' + (fullyAllocated ? ' is-settled' : '')}
                        key={payableId}>
                        <div>
                          <span className="muted small">Tanggal · Pembelian</span>
                          <strong>{dateOnly(payable.date)} · {payable.description}</strong>
                        </div>
                        <div>
                          <span className="muted small">Sisa</span>
                          <strong>{rupiah(payable.balance_due)}</strong>
                        </div>
                        <div>
                          <span className="muted small">Dialokasikan</span>
                          <strong>{rupiah(allocatedAmount)}</strong>
                        </div>
                        {fullyAllocated && (
                          <button
                            className="debts-payment-allocation-remove"
                            type="button"
                            aria-label={'Keluarkan pembelian ' + payable.description + ' tanggal ' + dateOnly(payable.date) + ' dari alokasi'}
                            disabled={savingVendorPayment}
                            onClick={() => setSelectedVendorDebt((current) => ({
                              ...current,
                              excludedPayableIds: [...current.excludedPayableIds, payableId]
                            }))}>
                            ×
                          </button>
                        )}
                      </article>
                    )
                  })
                })()}
                {vendorPaymentPlan.remainingAmount > 0 && Number(paymentAmount) > 0 && (
                  <p className="form-error" role="alert">
                    Sisa {rupiah(vendorPaymentPlan.remainingAmount)} belum dialokasikan ke pembelian yang dipilih.
                  </p>
                )}
                <div className="debts-payment-allocation-total">
                  <span>Total pembayaran</span>
                  <strong>{rupiah(vendorPaymentPlan.allocatedAmount)}</strong>
                </div>
              </div>
              {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
              <div className="modal-actions">
                <button className="btn" type="button" disabled={savingVendorPayment} onClick={() => setSelectedVendorDebt(null)}>Batal</button>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={savingVendorPayment || vendorPaymentPlan.remainingAmount > 0 || !vendorPaymentPlan.allocatedAmount}>
                  {savingVendorPayment ? 'Menyimpan...' : 'Simpan pembayaran'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )
      )}

      {selectedCustomerDebt && (
        createPortal(
          <div className="overlay debts-payment-overlay" onClick={() => !savingCustomerPayment && !loadingCustomerPaymentInvoices && setSelectedCustomerDebt(null)}>
            <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submitCustomerPayment}>
              <h3>Pembayaran piutang pelanggan</h3>
              <p className="muted">{selectedCustomerDebt.customer_name} · Sisa piutang {rupiah(selectedCustomerDebt.balance_due)}</p>
              <label htmlFor="customer-receivable-payment">Jumlah pembayaran</label>
              <MoneyInput
                id="customer-receivable-payment"
                value={customerPaymentAmount}
                onChange={(value) => {
                  setCustomerPaymentAmount(value)
                  setCustomerPaymentError('')
                }}
                maxAmount={Number(selectedCustomerDebt.balance_due)}
                placeholder="Masukkan nominal"
                required
                disabled={savingCustomerPayment || loadingCustomerPaymentInvoices}
              />
              {loadingCustomerPaymentInvoices ? (
                <p className="muted small">Memuat komponen piutang...</p>
              ) : customerPaymentInvoicesError ? (
                <p className="form-error" role="alert">{customerPaymentInvoicesError}</p>
              ) : selectedCustomerDebt.invoices.length > 0 || selectedCustomerDebt.manualCredits.length > 0 ? (
                <div className="debts-payment-allocation">
                  <div className="debts-payment-allocation-heading">
                    <strong>Alokasi pembayaran</strong>
                    <span>Faktur dan piutang lama · Saldo · Dialokasikan</span>
                  </div>
                  {(() => {
                    const invoiceBalanceTotal = selectedCustomerDebt.invoices.reduce(
                      (total, invoice) => total + Number(invoice.balanceDue || 0),
                      0
                    )
                    const allInvoices = allocateCustomerPayment(
                      selectedCustomerDebt.invoices,
                      invoiceBalanceTotal,
                      selectedCustomerDebt.excludedInvoiceIds
                    ).allocations
                    const allManualCredits = orderCustomerManualCredits(
                      selectedCustomerDebt.manualCredits,
                      selectedCustomerDebt.excludedManualCreditIds
                    )
                    const paidByAllocation = new Map(customerPaymentPlan.allocations.map((allocation) => [
                      allocation.kind + ':' + allocation.id,
                      allocation.amount
                    ]))
                    return (
                      <>
                        {allInvoices.map(({ transactionId, invoice }) => {
                          const allocatedAmount = paidByAllocation.get('invoice:' + transactionId) || 0
                          const fullyAllocated = allocatedAmount === Number(invoice.balanceDue)
                          return (
                            <article
                              className={'debts-payment-allocation-row' + (fullyAllocated ? ' is-settled' : '')}
                              key={'invoice-' + transactionId}>
                              <div>
                                <span className="muted small">No faktur</span>
                                <strong>{getInvoiceNumber(invoice)}</strong>
                              </div>
                              <div>
                                <span className="muted small">Total</span>
                                <strong>{rupiah(invoice.balanceDue)}</strong>
                              </div>
                              <div>
                                <span className="muted small">Dialokasikan</span>
                                <strong>{rupiah(allocatedAmount)}</strong>
                              </div>
                              {fullyAllocated && (
                                <button
                                  className="debts-payment-allocation-remove"
                                  type="button"
                                  aria-label={'Keluarkan faktur ' + getInvoiceNumber(invoice) + ' dari alokasi'}
                                  disabled={savingCustomerPayment}
                                  onClick={() => setSelectedCustomerDebt((current) => ({
                                    ...current,
                                    excludedInvoiceIds: [...current.excludedInvoiceIds, transactionId]
                                  }))}>
                                  ×
                                </button>
                              )}
                            </article>
                          )
                        })}
                        {allManualCredits.map((credit) => {
                          const allocatedAmount = paidByAllocation.get('manual_credit:' + credit.id) || 0
                          const fullyAllocated = allocatedAmount === Number(credit.balance_due)
                          return (
                            <article
                              className={'debts-payment-allocation-row' + (fullyAllocated ? ' is-settled' : '')}
                              key={'manual-credit-' + credit.id}>
                              <div>
                                <span className="muted small">Piutang lama</span>
                                <strong>{dateOnly(credit.createdAt)}</strong>
                              </div>
                              <div>
                                <span className="muted small">Sisa</span>
                                <strong>{rupiah(credit.balance_due)}</strong>
                              </div>
                              <div>
                                <span className="muted small">Dialokasikan</span>
                                <strong>{rupiah(allocatedAmount)}</strong>
                              </div>
                              {fullyAllocated && (
                                <button
                                  className="debts-payment-allocation-remove"
                                  type="button"
                                  aria-label={'Keluarkan piutang lama ' + dateOnly(credit.createdAt) + ' dari alokasi'}
                                  disabled={savingCustomerPayment}
                                  onClick={() => setSelectedCustomerDebt((current) => ({
                                    ...current,
                                    excludedManualCreditIds: [...current.excludedManualCreditIds, credit.id]
                                  }))}>
                                  ×
                                </button>
                              )}
                            </article>
                          )
                        })}
                      </>
                    )
                  })()}
                  {customerPaymentPlan.remainingAmount > 0 && Number(customerPaymentAmount) > 0 && (
                    <p className="form-error" role="alert">
                      Sisa {rupiah(customerPaymentPlan.remainingAmount)} belum dialokasikan ke faktur atau piutang lama.
                    </p>
                  )}
                  <div className="debts-payment-allocation-total">
                    <span>Total pembayaran</span>
                    <strong>{rupiah(customerPaymentPlan.allocatedAmount)}</strong>
                  </div>
                </div>
              ) : null}
              {customerPaymentError && <p className="form-error" role="alert">{customerPaymentError}</p>}
              <div className="modal-actions">
                <button className="btn" type="button" disabled={savingCustomerPayment} onClick={() => setSelectedCustomerDebt(null)}>Batal</button>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={savingCustomerPayment || loadingCustomerPaymentInvoices || Boolean(customerPaymentInvoicesError) || customerPaymentPlan.remainingAmount > 0}>
                  {savingCustomerPayment ? 'Menyimpan...' : 'Simpan pembayaran'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )
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
          allowPayment={false}
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
