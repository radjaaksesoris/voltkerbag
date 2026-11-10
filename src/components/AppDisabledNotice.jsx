import Icon from './Icon.jsx'
import { APP_TEMPORARILY_DISABLED } from '../appAvailability.js'
import './AppDisabledNotice.css'

export default function AppDisabledNotice() {
  if (!APP_TEMPORARILY_DISABLED) return null

  return (
    <main className="app-disabled" aria-labelledby="app-disabled-title">
      <div className="app-disabled-background" aria-hidden="true">
        <img src={import.meta.env.BASE_URL + 'voltker-app-background.jpg'} alt="" />
      </div>
      <section className="app-disabled-panel" role="alert">
        <img
          className="app-disabled-logo"
          src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
          width="320"
          height="79"
          alt="VOLTKER Toko Tas"
        />
        <span className="app-disabled-indicator" aria-hidden="true">
          <Icon name="alertTriangle" size={24} />
        </span>
        <h1 id="app-disabled-title">Aplikasi sementara dinonaktifkan</h1>
        <p>Aplikasi sementara dinonaktifkan karena belum ada respons untuk uji coba aplikasi ini.</p>
      </section>
    </main>
  )
}
