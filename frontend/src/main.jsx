import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Global CSS reset — injected at runtime to avoid needing a separate .css file
const reset = document.createElement('style')
reset.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; overflow: hidden; }
  body { background: #0A0E1A; }
  button { font-family: inherit; cursor: pointer; outline: none; border: none; }
  video { display: block; }
`
document.head.appendChild(reset)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
