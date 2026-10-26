const ICONS = {
  dashboard: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M13 16V7" /><path d="M18 16v-8" /></>,
  cart: <><path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 8H6" /><circle cx="10" cy="20" r="1.2" /><circle cx="18" cy="20" r="1.2" /></>,
  purchase: <><path d="M12 3v10" /><path d="m8 9 4 4 4-4" /><path d="M5 14v6h14v-6" /></>,
  bag: <><path d="M5 8h14l1 12H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /><path d="M9 12v1M15 12v1" /></>,
  wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" /><path d="M4 7h16" /><path d="M15 12h5" /><circle cx="15" cy="12" r=".5" /></>,
  bolt: <path d="M13.2 2 5 13h5.8L10 22l9-12h-6l.2-8Z" />,
  menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
  sync: <><path d="M20 7v5h-5" /><path d="M4.9 9A7 7 0 0 1 17 6l3 6" /><path d="M4 17v-5h5" /><path d="M19.1 15A7 7 0 0 1 7 18l-3-6" /></>,
  print: <><path d="M7 8V3h10v5" /><path d="M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /><path d="M17 11h.01" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 18v3h14v-3" /></>,
  settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2A1.7 1.7 0 0 0 5.4 5.8l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2A1.7 1.7 0 0 0 17 3.4l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" transform="translate(1 1) scale(.92)" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="m5 7 1 13h12l1-13" /><path d="M9 7V4h6v3" /></>,
  check: <path d="m5 12 4 4L19 6" />
}

export default function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={'icon ' + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false">
      {ICONS[name]}
    </svg>
  )
}
