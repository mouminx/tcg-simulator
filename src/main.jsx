import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// First, so the @font-face rules and the :root font tokens are defined before any
// stylesheet that consumes them.
import './fonts.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
