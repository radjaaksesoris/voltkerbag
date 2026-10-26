import ManagedOptionSelect from './ManagedOptionSelect.jsx'

export default function UnitSelect(props) {
  const { categories, ...selectProps } = props
  const availableUnits = categories.filter((unit) => (unit.name || '').trim().toLocaleLowerCase('id-ID') !== 'kodi')
  async function addUnit(name) {
    if (name.trim().toLocaleLowerCase('id-ID') === 'kodi') {
      throw new Error('Satuan KODI sudah tidak tersedia. Gunakan PCS atau LUSIN.')
    }
    return selectProps.onAdd(name)
  }
  return (
    <ManagedOptionSelect
      {...selectProps}
      options={availableUnits}
      onAdd={addUnit}
      fieldName="Satuan"
      placeholder="Pilih satuan"
      allowEmpty={false}
    />
  )
}
