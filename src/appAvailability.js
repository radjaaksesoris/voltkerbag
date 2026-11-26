import { createElement, lazy, Suspense } from 'react'

export const APP_TEMPORARILY_DISABLED = false

const DisabledNotice = lazy(() => import('./components/AppDisabledNotice.jsx'))

export default function AppDisabledNotice() {
  if (!APP_TEMPORARILY_DISABLED) return null

  return createElement(Suspense, { fallback: null }, createElement(DisabledNotice))
}
