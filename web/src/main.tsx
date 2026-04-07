import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Applications } from './pages/Applications'
import { Pipeline } from './pages/Pipeline'
import { ReportView } from './pages/ReportView'
import { PDFs } from './pages/PDFs'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/reports/:filename" element={<ReportView />} />
          <Route path="/pdfs" element={<PDFs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
