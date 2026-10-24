export default function DateRangeFilter({
  value,
  onChange,
  resetValue = { from: '', to: '' },
  resetLabel = 'Hapus filter'
}) {
  const invalidRange = value.from && value.to && value.from > value.to
  const isResetValue = value.from === resetValue.from && value.to === resetValue.to

  function update(field, nextValue) {
    onChange({ ...value, [field]: nextValue })
  }

  return (
    <section className="date-filter" aria-label="Filter berdasarkan tanggal">
      <label className="date-filter-field">
        <span>Dari tanggal</span>
        <input
          className="input"
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => update('from', event.target.value)}
        />
      </label>
      <label className="date-filter-field">
        <span>Sampai tanggal</span>
        <input
          className="input"
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => update('to', event.target.value)}
        />
      </label>
      <button
        className="btn date-filter-reset"
        type="button"
        disabled={isResetValue}
        onClick={() => onChange(resetValue)}>
        {resetLabel}
      </button>
      {invalidRange && <p className="form-error date-filter-error" role="alert">Tanggal awal tidak boleh melewati tanggal akhir.</p>}
    </section>
  )
}
