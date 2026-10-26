import ManagedOptionSelect from './ManagedOptionSelect.jsx'

export default function VendorSelect({ vendors, ...selectProps }) {
  return (
    <ManagedOptionSelect
      {...selectProps}
      options={vendors}
      fieldName="Vendor"
      placeholder="Pilih vendor"
      allowEmpty={false}
      canManage={false}
      emptyMessage="Belum ada vendor. Tambahkan nama vendor di tab Setting."
    />
  )
}
