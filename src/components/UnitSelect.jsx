import ManagedOptionSelect from './ManagedOptionSelect.jsx'

export default function UnitSelect(props) {
  const { categories, ...selectProps } = props
  return (
    <ManagedOptionSelect
      {...selectProps}
      options={categories}
      fieldName="Satuan"
      placeholder="Pilih satuan"
      allowEmpty={false}
    />
  )
}
