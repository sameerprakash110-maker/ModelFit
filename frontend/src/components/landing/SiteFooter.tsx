import { Link } from 'react-router-dom'
import { Wordmark } from './Wordmark.tsx'

/*
  Section links are written as "/#id" so they work from every public page,
  not only from the landing page itself.
*/
const PRODUCT_LINKS = [
  { href: '/#trap', label: 'The Trap' },
  { href: '/#why', label: 'Why ModelFit' },
  { href: '/#fitting', label: 'How It Works' },
  { href: '/#measured', label: "What's Measured" },
  { href: '/#reading', label: 'Reading a Benchmark' },
]

const YEAR = new Date().getFullYear()

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-grid">
        <div className="site-footer-brand">
          <Link to="/" className="site-footer-logo">
            <Wordmark />
          </Link>
          <p>
            ModelFit benchmarks AI models on your company's own workloads, so the choice of model and provider rests
            on measured success, quality, speed and cost.
          </p>
        </div>

        <nav aria-label="Product">
          <h2>Product</h2>
          <ul>
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2>Account</h2>
          <ul>
            <li>
              <Link to="/signup">Sign Up</Link>
            </li>
            <li>
              <Link to="/login">Log In</Link>
            </li>
            <li>
              <Link to="/app">Open the Lab</Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2>Legal</h2>
          <ul>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/terms">Terms</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="wrap site-footer-base">
        <p>© {YEAR} ModelFit. Built for PS-21, AI model benchmarking on company workloads.</p>
      </div>
    </footer>
  )
}
