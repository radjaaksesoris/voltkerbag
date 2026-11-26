const MENU_ICONS = {
  dashboard: <g filter="url(#softShadow)"><rect x="10" y="12" width="43" height="42" rx="9" fill="url(#paper)" stroke="#a91e2a" strokeWidth="2" /><path d="M17 47V33h7v14m4 0V24h7v23m4 0V18h7v29" fill="url(#red)" /><path d="M16 28 27 22l9 3 12-10" fill="none" stroke="#f5b836" strokeWidth="3" strokeLinecap="round" /><path d="m44 15 5-1-1 6" fill="none" stroke="#f5b836" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>,
  cart: <g filter="url(#softShadow)"><path d="M11 17h7l5 25a6 6 0 0 0 6 5h17a6 6 0 0 0 5.8-4.5L56 27H20" fill="#dbe7f7" stroke="#475775" strokeWidth="2.2" strokeLinejoin="round" /><path d="M23 29h29l-2.5 12H25.5Z" fill="url(#steel)" stroke="#526987" strokeWidth="1.5" /><rect x="30" y="20" width="9" height="9" rx="2" fill="#f6bf34" /><rect x="41" y="19" width="9" height="10" rx="2" fill="#e7a928" /><circle cx="30" cy="53" r="4" fill="#26384f" /><circle cx="48" cy="53" r="4" fill="#26384f" /><circle cx="30" cy="53" r="1.7" fill="#e6edf6" /><circle cx="48" cy="53" r="1.7" fill="#e6edf6" /></g>,
  purchase: <g filter="url(#softShadow)"><path d="m11 29 21-12 21 12v22L32 62 11 51Z" fill="url(#box)" stroke="#a96536" strokeWidth="2" strokeLinejoin="round" /><path d="m11 29 21 12 21-12M32 41v21M22 23l21 12" fill="none" stroke="#c9824c" strokeWidth="2" /><path d="M32 8v19m-8-8 8 8 8-8" fill="none" stroke="#f4c94d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 34v11l8 5" fill="none" stroke="#f8d89a" strokeWidth="2" /></g>,
  bag: <g filter="url(#softShadow)"><path d="M14 25h36l3 31H11Z" fill="url(#wallet)" stroke="#6c321f" strokeWidth="2" /><path d="M23 26v-5a9 9 0 0 1 18 0v5" fill="none" stroke="#8d4526" strokeWidth="3" strokeLinecap="round" /><path d="M14 33h39" stroke="#f1a43c" strokeWidth="2" /><rect x="24" y="37" width="18" height="11" rx="3" fill="#e63743" transform="rotate(-11 24 37)" /><path d="m31 37 7 4-7 4-7-4Z" fill="#f8c037" /></g>,
  wallet: <g filter="url(#softShadow)"><path d="M13 20a6 6 0 0 1 6-6h32v39H19a6 6 0 0 1-6-6Z" fill="url(#wallet)" stroke="#703722" strokeWidth="2" /><path d="M13 24h38M13 47h38" stroke="#ef9f3d" strokeWidth="2" /><path d="M37 31h18v12H37a6 6 0 0 1 0-12Z" fill="#e9a42c" stroke="#a9641f" strokeWidth="2" /><circle cx="45" cy="37" r="2.5" fill="#fff1ae" /><path d="M22 18h21" stroke="#ffd16e" strokeWidth="3" strokeLinecap="round" /></g>,
  coins: <g filter="url(#softShadow)"><path d="M10 20v14c0 3.5 5.4 6 12 6s12-2.5 12-6V20" fill="#f5ad24" stroke="#a86a12" strokeWidth="2" /><ellipse cx="22" cy="20" rx="12" ry="6" fill="#ffd65c" stroke="#a86a12" strokeWidth="2" /><path d="M30 35v13c0 3.5 5.4 6 12 6s12-2.5 12-6V35" fill="#e99518" stroke="#a86a12" strokeWidth="2" /><ellipse cx="42" cy="35" rx="12" ry="6" fill="#ffca3b" stroke="#a86a12" strokeWidth="2" /><path d="M16 20h12m-6-4v8M36 35h12m-6-4v8" stroke="#fff0a3" strokeWidth="2" strokeLinecap="round" /></g>,
  settings: <g filter="url(#softShadow)"><path d="m35 8 2 5a20 20 0 0 1 4 2l5-2 5 6-3 5a19 19 0 0 1 0 5l3 5-5 6-5-2a20 20 0 0 1-4 2l-2 5h-8l-2-5a20 20 0 0 1-4-2l-5 2-5-6 3-5a19 19 0 0 1 0-5l-3-5 5-6 5 2a20 20 0 0 1 4-2l2-5Z" fill="url(#gear)" stroke="#5d6583" strokeWidth="2" strokeLinejoin="round" /><circle cx="31" cy="27" r="9" fill="#eef2ff" stroke="#69769c" strokeWidth="2" /><circle cx="31" cy="27" r="3.5" fill="#b5282e" /><path d="M48 49h8M52 45v8" stroke="#f5c955" strokeWidth="3" strokeLinecap="round" /></g>,
  chat: <g filter="url(#softShadow)"><path d="M53 30a20 20 0 0 1-20 20H20l-9 6v-15a20 20 0 1 1 42-11Z" fill="url(#bubbleWhite)" stroke="#cf4053" strokeWidth="2" /><path d="M25 31h19M25 39h12" stroke="#9e3041" strokeWidth="3" strokeLinecap="round" /><path d="M56 31a15 15 0 0 0-15-15 15 15 0 0 0-10 4l4 3a10 10 0 0 1 16 8v6Z" fill="url(#bubblePink)" stroke="#b5284e" strokeWidth="2" /><circle cx="40" cy="28" r="1.8" fill="#fff" /><circle cx="46" cy="28" r="1.8" fill="#fff" /></g>,
  sync: <g filter="url(#softShadow)"><path d="M49 24a20 20 0 0 0-34 5l-3 5m0 0V22m0 12h11" fill="none" stroke="#f4e8ea" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 41a20 20 0 0 0 34-5l3-5m0 0v12m0-12H41" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><path d="m44 12 5 12-12-2M20 52l-5-12 12 2" fill="#f6c13c" stroke="#a86b18" strokeWidth="2" strokeLinejoin="round" /></g>
}

export default function MenuShortcutIcon({ name }) {
  return (
    <svg className="menu-art-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="red" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff6670" /><stop offset="1" stopColor="#bb1627" /></linearGradient>
        <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffdf9" /><stop offset="1" stopColor="#e7dce5" /></linearGradient>
        <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9db9dd" /><stop offset="1" stopColor="#557292" /></linearGradient>
        <linearGradient id="box" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffd58d" /><stop offset="1" stopColor="#c8753a" /></linearGradient>
        <linearGradient id="wallet" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e49a52" /><stop offset="1" stopColor="#8c3d22" /></linearGradient>
        <linearGradient id="gear" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#dfe8ff" /><stop offset="1" stopColor="#8794bc" /></linearGradient>
        <linearGradient id="bubbleWhite" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#f2dfe8" /></linearGradient>
        <linearGradient id="bubblePink" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff9cc5" /><stop offset="1" stopColor="#de366c" /></linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="150%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" floodColor="#5b1720" floodOpacity=".38" /></filter>
      </defs>
      {MENU_ICONS[name] || MENU_ICONS.bag}
    </svg>
  )
}
