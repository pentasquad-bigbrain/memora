import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ensureCaptureWorker } from './lib/captureNotification'

ensureCaptureWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
