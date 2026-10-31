export function filterCustomerDebts(customers, search = '') {
  const query = String(search || '').trim().toLocaleLowerCase('id-ID')
  if (!query) return customers

  const exactMatches = customers.filter((customer) =>
    String(customer.customer_name || '').trim().toLocaleLowerCase('id-ID') === query
  )
  if (exactMatches.length) return exactMatches

  return customers.filter((customer) =>
    String(customer.customer_name || '').toLocaleLowerCase('id-ID').includes(query)
  )
}
