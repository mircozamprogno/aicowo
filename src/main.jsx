import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Import CSS files in order
import './styles/components/auth.css'
import './styles/components/invitation-register.css'
import './styles/components/layout.css'
import './styles/components/send-invitation-modal.css'
import './styles/components/sidebar.css'
import './styles/components/toast.css'
import './styles/global.css'
import './styles/pages/dashboard.css'
import './styles/pages/partners.css'
import './styles/pages/users.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)