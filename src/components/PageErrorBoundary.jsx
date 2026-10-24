import { Component } from 'react'

export default class PageErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Halaman gagal ditampilkan:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="card page-render-error" role="alert">
          <h3>Halaman tidak dapat ditampilkan</h3>
          <p className="muted">Coba buka tab lain atau muat ulang aplikasi.</p>
          <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
            Muat ulang aplikasi
          </button>
        </section>
      )
    }

    return this.props.children
  }
}
