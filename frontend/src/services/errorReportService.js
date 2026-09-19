import api from './api'

// Reports a client-side JS error to the backend for logging (no DB write,
// look for "[CLIENT-ERROR]" in backend logs). Silently swallows failures —
// error reporting must never itself throw or surface to the user.
const errorReportService = {
  report: ({ message, stack, url }) => {
    api.post('/client-error', {
      message: String(message || '').slice(0, 2000),
      stack: String(stack || '').slice(0, 4000),
      url: url || window.location.href,
    }).catch(() => {})
  },
}

export default errorReportService
