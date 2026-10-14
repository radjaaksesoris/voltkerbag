import ManagedOptionSelect from './ManagedOptionSelect.jsx'

export default function CategorySelect(props) {
  const { categories, ...selectProps } = props
  return (
    <ManagedOptionSelect
      {...selectProps}
      options={categories}
      fieldName="Kategori"
      placeholder="Pilih kategori"
      emptyLabel="Tanpa kategori"
    />
  )
}
