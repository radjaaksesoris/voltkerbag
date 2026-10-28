export default function DateRangeFilter({
  value,
  onChange,
  resetValue = { from: '', to: '' },
  resetLabel = 'Hapus filter',
  quickValue,
  quickLabel
}) {
  const invalidRange = value.from && value.to && value.from > value.to
  const isResetValue = value.from === resetValue.from && value.to === resetValue.to
  const isQuickValue = quickValue && value.from === quickValue.from && value.to === quickValue.to

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
      <div className="date-filter-actions">
        <button
          className="btn date-filter-reset"
          type="button"
          disabled={isResetValue}
          onClick={() => onChange(resetValue)}>
          {resetLabel}
        </button>
        {quickValue && quickLabel && (
          <button
            className="btn date-filter-quick"
            type="button"
            disabled={isQuickValue}
            onClick={() => onChange(quickValue)}>
            {quickLabel}
          </button>
        )}
      </div>
      {invalidRange && <p className="form-error date-filter-error" role="alert">Tanggal awal tidak boleh melewati tanggal akhir.</p>}
    </section>
  )
}
