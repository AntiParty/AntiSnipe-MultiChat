import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import UserCardApp from './UserCardApp'
import { ensureTauriBridgeInstalled } from './services/tauriBridge'
import './styles/globals.css'
import './styles/theme.css'

const mode = new URLSearchParams(window.location.search).get('mode')

ensureTauriBridgeInstalled()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {mode === 'usercard' ? <UserCardApp /> : <App />}
  </React.StrictMode>
)
