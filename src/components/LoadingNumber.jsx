export default function LoadingNumber({ label }) {
  return (
    <span className="loading-number" role="status" aria-label={`Memuat ${label}`}>
      <span aria-hidden="true">Rp </span>
      <span className="loading-number-digits" aria-hidden="true">
        {Array.from({ length: 3 }, (_, groupIndex) => (
          <span className="loading-number-group" key={groupIndex}>
            {Array.from({ length: 3 }, (_, digitIndex) => {
              const reelIndex = groupIndex * 3 + digitIndex
              return (
                <span className="loading-number-reel" key={reelIndex} style={{ '--reel-index': reelIndex }}>
                  <span className="loading-number-track">
                    {'0123456789'.split('').map((digit) => <span key={digit}>{digit}</span>)}
                  </span>
                </span>
              )
            })}
          </span>
        ))}
      </span>
    </span>
  )
}
