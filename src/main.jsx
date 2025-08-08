import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Import CSS files in order
import './styles/components/auth.css'
import './styles/components/invitation-register.css'
import './styles/components/layout.css'
import './styles/components/locations.css'
import './styles/components/send-invitation-modal.css'
import './styles/components/sidebar.css'
import './styles/components/toast.css'
import './styles/global.css'
import './styles/pages/bookings.css'
import './styles/pages/contracts.css'
import './styles/pages/customers.css'
import './styles/pages/dashboard.css'
import './styles/pages/invitations.css'
import './styles/pages/partners.css'
import './styles/pages/services.css'
import './styles/pages/settings.css'
import './styles/pages/users.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)