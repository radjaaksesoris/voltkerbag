export default function LoadingNumber({ label }) {
  return (
    <span className="loading-number" role="status" aria-label={`Memuat ${label}`}>
      <span aria-hidden="true">Rp </span>
      <span className="loading-number-placeholder" aria-hidden="true" />
    </span>
  )
}
