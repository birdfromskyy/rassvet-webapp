import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import errorReportService from './services/errorReportService'

// Catches errors outside the React render tree (async code, event handlers,
// promise rejections) — Error Boundary alone only catches render-time errors.
window.addEventListener('error', (e) => {
	errorReportService.report({ message: e.message, stack: e.error?.stack })
})
window.addEventListener('unhandledrejection', (e) => {
	errorReportService.report({
		message: e.reason?.message || String(e.reason),
		stack: e.reason?.stack,
	})
})

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
	<React.StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</ErrorBoundary>
	</React.StrictMode>
)
