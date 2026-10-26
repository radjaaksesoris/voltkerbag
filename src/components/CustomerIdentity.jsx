export default function CustomerIdentity({ name, customer, className = '' }) {
  return (
    <span className={['customer-identity', className].filter(Boolean).join(' ')}>
      <strong>{name || 'Pelanggan lama'}</strong>
      {(customer?.phone || customer?.address) && (
        <span className="customer-identity-contact">
          {customer.phone && <span>Telp. {customer.phone}</span>}
          {customer.address && <span>{customer.address}</span>}
        </span>
      )}
    </span>
  )
}
