import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth.tsx'
import AuthPage from './pages/Auth/AuthPage.tsx'
import LandingPage from './pages/Landing/LandingPage.tsx'
import LegalPlaceholder from './pages/Legal/LegalPlaceholder.tsx'

/** Starts each page at the top. Links to a section (a URL with a #hash) are left to the page. */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}

/*
  This project is the public website only.
  /app is where the authenticated benchmarking application will mount. It is
  built separately, so for now the guard sends every visitor to sign up.
*/
export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/privacy" element={<LegalPlaceholder kind="privacy" />} />
        <Route path="/terms" element={<LegalPlaceholder kind="terms" />} />
        <Route path="/app/*" element={<RequireAuth>{null}</RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
