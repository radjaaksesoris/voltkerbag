import Icon from '../components/Icon.jsx'

export default function Menu({ items, onNavigate }) {
  return (
    <div className="page menu-page">
      <header className="menu-heading">
        <span className="menu-eyebrow">AKSES CEPAT</span>
        <h2>Menu</h2>
        <p>Pilih fitur VOLTKERBAG yang ingin dibuka.</p>
      </header>
      <nav className="menu-shortcuts" aria-label="Pilih halaman">
        {items.map((item, index) => (
          <button
            key={item.id}
            className={'menu-shortcut menu-shortcut-' + (index % 4)}
            type="button"
            onClick={() => onNavigate(item.id)}>
            <span className="menu-shortcut-icon">
              <Icon name={item.icon} size={30} />
            </span>
            <span className="menu-shortcut-label">{item.label}</span>
            <span className="menu-shortcut-description">{item.description}</span>
          </button>
        ))}
        <a
          className="menu-shortcut menu-shortcut-chat"
          href={import.meta.env.BASE_URL + 'chat/?mode=chat'}>
          <span className="menu-shortcut-icon">
            <Icon name="chat" size={30} />
          </span>
          <span className="menu-shortcut-label">VOLTKER Chat</span>
          <span className="menu-shortcut-description">Tanya dan kelola toko lewat chat.</span>
        </a>
      </nav>
    </div>
  )
}
