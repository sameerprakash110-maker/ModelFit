import { Link } from 'react-router-dom'
import { SiteFooter } from '../../components/landing/SiteFooter.tsx'
import { Wordmark } from '../../components/landing/Wordmark.tsx'
import '../../styles/site.css'

const COPY = {
  privacy: {
    title: 'Privacy Policy',
    body: "The privacy policy hasn't been written yet. It will be published on this page before ModelFit accepts real accounts or workload data.",
  },
  terms: {
    title: 'Terms',
    body: "The terms of use haven't been written yet. They will be published on this page before ModelFit accepts real accounts.",
  },
}

/* Placeholder for a legal document that does not exist yet. It says so plainly. */
export default function LegalPlaceholder({ kind }: { kind: 'privacy' | 'terms' }) {
  const copy = COPY[kind]

  return (
    <div className="lp plain-page">
      <header className="wrap plain-top">
        <Link to="/" className="site-nav-logo">
          <Wordmark />
        </Link>
        <Link to="/" className="stitch-link">
          Back to the website
        </Link>
      </header>

      <main className="wrap plain-main">
        <h1 className="h2">{copy.title}</h1>
        <p className="lede">{copy.body}</p>
      </main>

      <SiteFooter />
    </div>
  )
}
