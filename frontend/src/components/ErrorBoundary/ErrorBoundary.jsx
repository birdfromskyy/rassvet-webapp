import React from 'react'
import errorReportService from '../../services/errorReportService'
import './ErrorBoundary.scss'

// Catches render-time errors in the component tree below it and shows a
// fallback screen instead of leaving the user with a blank white page.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    errorReportService.report({
      message: error?.message || String(error),
      stack: info?.componentStack || error?.stack,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__card">
            <h1>Что-то пошло не так</h1>
            <p>Произошла непредвиденная ошибка. Попробуйте обновить страницу.</p>
            <button onClick={() => window.location.reload()}>Обновить страницу</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
