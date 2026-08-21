import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Shell from './Shell'
import './styles/global.css'
import './styles/sheet.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
