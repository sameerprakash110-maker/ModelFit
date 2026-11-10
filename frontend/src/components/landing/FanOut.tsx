const CONFIGURATIONS = [
  { letter: 'A', text: 'Your current model in your current harness' },
  { letter: 'B', text: 'A cheaper model in the same harness' },
  { letter: 'C', text: 'The cheaper model with a revised prompt' },
]

/** One set of test cases goes, unchanged, to every configuration being compared. */
export function FanOut() {
  return (
    <figure className="fanout">
      <div className="fanout-diagram">
        <div className="fanout-source">
          <svg viewBox="0 0 80 92" aria-hidden="true">
            <rect x="18" y="4" width="56" height="70" />
            <rect x="11" y="11" width="56" height="70" />
            <rect x="4" y="18" width="56" height="70" />
            <path d="M14 36 H50 M14 48 H50 M14 60 H40" />
          </svg>
          <p>One set of test cases</p>
        </div>

        <svg className="fanout-wires" viewBox="0 0 100 300" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 150 C50 150 50 50 100 50" />
          <path d="M0 150 H100" />
          <path d="M0 150 C50 150 50 250 100 250" />
        </svg>

        <ol className="fanout-targets">
          {CONFIGURATIONS.map((configuration) => (
            <li key={configuration.letter}>
              <span className="fanout-letter" aria-hidden="true">
                {configuration.letter}
              </span>
              <span>
                <span className="visually-hidden">Configuration {configuration.letter}: </span>
                {configuration.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption>
        Same inputs, same scoring. Only the configuration changes, which is what makes the results comparable.
      </figcaption>
    </figure>
  )
}
