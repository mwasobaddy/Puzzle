import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
const paypalOptions = paypalClientId && paypalClientId !== 'your-paypal-client-id' ? { "client-id": paypalClientId } : {};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {paypalOptions["client-id"] ? (
      <PayPalScriptProvider options={paypalOptions}>
        <App />
      </PayPalScriptProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
