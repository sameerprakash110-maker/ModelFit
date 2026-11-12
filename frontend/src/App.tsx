import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth.tsx'
import AuthPage from './pages/Auth/AuthPage.tsx'
import BenchmarkPage from './pages/Lab/BenchmarkPage.tsx'
import LabLayout from './pages/Lab/LabLayout.tsx'
import NewBenchmark from './pages/Lab/NewBenchmark.tsx'
import Overview from './pages/Lab/Overview.tsx'
import ProjectPage from './pages/Lab/ProjectPage.tsx'
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
  /app is the signed-in lab: projects, test cases, benchmarks and reports.
  The guard sends visitors without a session to sign up.
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
        <Route
          path="/app"
          element={
            <RequireAuth>
              <LabLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Overview />} />
          <Route path="new" element={<NewBenchmark />} />
          <Route path="projects/:projectId" element={<ProjectPage />} />
          <Route path="benchmarks/:benchmarkId" element={<BenchmarkPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
