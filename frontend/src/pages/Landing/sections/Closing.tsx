import { Link } from 'react-router-dom'
import { TapeStrip } from '../../../components/landing/TapeStrip.tsx'

/** The final call to action. "Open the Lab" leads to sign-up for anyone without an account. */
export function Closing() {
  return (
    <section className="closing" aria-labelledby="closing-headline">
      <div className="wrap closing-cta">
        <h2 id="closing-headline" className="closing-headline">
          Bring a workload. Leave with a verdict.
        </h2>
        <div className="closing-actions">
          <Link to="/app" className="btn btn--large">
            Open the Lab
          </Link>
          <p>
            Already have an account?{' '}
            <Link to="/login" className="stitch-link">
              Log In
            </Link>
          </p>
        </div>
      </div>
      <div className="closing-tape" aria-hidden="true">
        <TapeStrip units={420} ppu={12} />
      </div>
    </section>
  )
}
