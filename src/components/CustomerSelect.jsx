import ManagedOptionSelect from './ManagedOptionSelect.jsx'

export default function CustomerSelect({ customers, ...selectProps }) {
  return (
    <ManagedOptionSelect
      {...selectProps}
      options={customers}
      fieldName="Nama pelanggan"
      placeholder="Pilih nama pelanggan"
      allowEmpty={false}
      canManage={false}
    />
  )
}
