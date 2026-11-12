const MENU_ICONS = {
  dashboard: (
    <>
      <rect x="9" y="10" width="46" height="43" rx="12" fill="rgba(255,248,241,.12)" />
      <path d="M17 45V31h7v14M29 45V23h7v22M41 45V17h7v28" fill="rgba(255,222,207,.92)" stroke="none" />
      <path d="M15 47h35M17 26l11-7 9 4 12-10" />
      <path d="m43 13 6-1-1 6" stroke="#ffe0bd" />
    </>
  ),
  cart: (
    <>
      <path d="M13 16h6l5 25a5 5 0 0 0 5 4h17a5 5 0 0 0 4.8-3.6L55 26H21" />
      <path d="M26 32h25l-2 9H28z" fill="rgba(255,222,207,.26)" />
      <circle cx="31" cy="51" r="3.5" fill="#ffe0bd" stroke="none" />
      <circle cx="47" cy="51" r="3.5" fill="#ffe0bd" stroke="none" />
      <path d="M37 18v9m-4.5-4.5h9" stroke="#ffe0bd" />
    </>
  ),
  purchase: (
    <>
      <path d="m12 27 20-11 20 11v22L32 60 12 49V27Z" fill="rgba(255,248,241,.1)" />
      <path d="m12 27 20 12 20-12M32 39v20M22 21l20 12" />
      <path d="M32 7v17m-7-7 7 7 7-7" stroke="#ffe0bd" />
      <path d="M20 32v12l7 4" stroke="rgba(255,248,241,.7)" />
    </>
  ),
  bag: (
    <>
      <path d="M15 24h34l3 32H12l3-32Z" fill="rgba(255,248,241,.12)" />
      <path d="M23 25v-5a9 9 0 0 1 18 0v5M15 31h34" />
      <path d="m32 35 7 4v8l-7 4-7-4v-8l7-4Z" fill="rgba(255,222,207,.92)" stroke="none" />
      <path d="m32 35 7 4-7 4-7-4 7-4Zm-7 4v8l7 4v-8m7-4v8l-7 4" stroke="#a51f2b" strokeWidth="1.8" />
    </>
  ),
  wallet: (
    <>
      <path d="M14 19a6 6 0 0 1 6-6h31v39H20a6 6 0 0 1-6-6V19Z" fill="rgba(255,248,241,.12)" />
      <path d="M14 22h37M14 46h37" />
      <path d="M37 30h18v12H37a6 6 0 0 1 0-12Z" fill="rgba(255,222,207,.9)" stroke="none" />
      <path d="M45 36h.1" stroke="#a51f2b" strokeWidth="3" />
      <path d="M22 17h21" stroke="#ffe0bd" />
    </>
  ),
  settings: (
    <>
      <path d="m35 8 2 5a20 20 0 0 1 4 2l5-2 5 6-3 5a19 19 0 0 1 0 5l3 5-5 6-5-2a20 20 0 0 1-4 2l-2 5h-8l-2-5a20 20 0 0 1-4-2l-5 2-5-6 3-5a19 19 0 0 1 0-5l-3-5 5-6 5 2a20 20 0 0 1 4-2l2-5h8Z"
        fill="rgba(255,248,241,.12)" />
      <circle cx="31" cy="27" r="8" fill="rgba(255,222,207,.92)" stroke="none" />
      <circle cx="31" cy="27" r="3.2" fill="#a51f2b" stroke="none" />
      <path d="M48 48h8M52 44v8" stroke="#ffe0bd" />
    </>
  ),
  chat: (
    <>
      <path d="M53 30a20 20 0 0 1-20 20H20l-9 6v-15a20 20 0 1 1 42-11Z" fill="rgba(255,248,241,.12)" />
      <path d="M21 29h23M21 37h15" stroke="#fff8f1" />
      <circle cx="47" cy="17" r="7" fill="#ffe0bd" stroke="none" />
      <path d="M45 17h4m-2-2v4" stroke="#a51f2b" strokeWidth="1.8" />
    </>
  ),
  sync: (
    <>
      <path d="M48 23a19 19 0 0 0-32 5l-3 5m0 0V22m0 11h11M16 41a19 19 0 0 0 32-5l3-5m0 0v11m0-11H40" />
      <path d="m44 12 4 11-11-2M20 52l-4-11 11 2" fill="rgba(255,222,207,.92)" stroke="#ffe0bd" />
      <circle cx="32" cy="32" r="4" fill="#ffe0bd" stroke="none" />
    </>
  )
}

export default function MenuShortcutIcon({ name }) {
  return (
    <svg
      className="menu-art-icon"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false">
      {MENU_ICONS[name] || MENU_ICONS.bag}
    </svg>
  )
}
