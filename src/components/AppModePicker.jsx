import SessionControl from './SessionControl.jsx'
import Icon from './Icon.jsx'

export default function AppModePicker({ session, onSignedOut }) {
  return (
    <main className="app-mode-page">
      <div className="app-mode-background" aria-hidden="true">
        <img src={import.meta.env.BASE_URL + 'voltker-app-background.jpg'} alt="" />
      </div>
      <header className="app-mode-header">
        <img
          src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
          width="320"
          height="79"
          alt="VOLTKER Toko Tas"
        />
        <SessionControl email={session.user.email} onSignedOut={onSignedOut} />
      </header>
      <section className="app-mode-content" aria-labelledby="app-mode-title">
        <p className="app-mode-eyebrow">RUANG KERJA ADMINISTRATOR</p>
        <h1 id="app-mode-title">Pilih cara Anda bekerja.</h1>
        <div className="app-mode-options">
          <a className="app-mode-option" href={import.meta.env.BASE_URL + '?mode=table'}>
            <span className="app-mode-icon"><Icon name="table" size={25} /></span>
            <span className="app-mode-option-copy">
              <strong>APLIKASI TABEL</strong>
              <span>Kelola melalui dashboard, tabel stok, transaksi, pembelian, dan keuangan.</span>
            </span>
            <Icon className="app-mode-arrow" name="arrowRight" size={19} />
          </a>
          <a className="app-mode-option" href={import.meta.env.BASE_URL + 'chat/?mode=chat'}>
            <span className="app-mode-icon"><Icon name="chat" size={25} /></span>
            <span className="app-mode-option-copy">
              <strong>APLIKASI CHAT</strong>
              <span>Tanyakan data dan jalankan kegiatan toko melalui percakapan.</span>
            </span>
            <Icon className="app-mode-arrow" name="arrowRight" size={19} />
          </a>
        </div>
      </section>
    </main>
  )
}
