import { createRoot } from 'react-dom/client'
// Removed StrictMode to avoid double-mount issues with WebSocket connection
import React from 'react'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <App />,
)
