import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TracixQueryProvider } from './hooks/useQueryProvider'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TracixQueryProvider>
      <App />
    </TracixQueryProvider>
  </StrictMode>,
)
