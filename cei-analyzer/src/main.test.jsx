import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Minimal test to check if React renders
function TestApp() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <h1 className="text-4xl font-bold">CEI Analyzer Loaded ✅</h1>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TestApp />
  </StrictMode>,
)
