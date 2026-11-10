import { formatPercent, formatUnitRupees } from '../../utils/format.ts'
import { STARTING_NUMBERS, estimate } from '../../utils/trapMath.ts'

/*
  The trap in one picture: two models measured twice against the same tape.
  On the price list the model under consideration is the short bar. Per
  successful task it is the long one. The numbers are the calculator's
  starting numbers, worked out by the same code, and labelled as an illustration.
*/
export function HeroMeasure() {
  const { scenario, current, candidate } = STARTING_NUMBERS
  const currentPerAttempt = current.costPer1k / 1000
  const candidatePerAttempt = candidate.costPer1k / 1000
  const currentPerSuccess = estimate(current, scenario).costPerSuccess ?? 0
  const candidatePerSuccess = estimate(candidate, scenario).costPerSuccess ?? 0

  const longest = Math.max(currentPerAttempt, candidatePerAttempt, currentPerSuccess, candidatePerSuccess)
  const width = (value: number) => `${(value / longest) * 100}%`

  const priceListChange = (candidatePerAttempt - currentPerAttempt) / currentPerAttempt
  const perSuccessChange = (candidatePerSuccess - currentPerSuccess) / currentPerSuccess
  const describe = (change: number) =>
    change < 0 ? `${formatPercent(-change, 0)} cheaper` : `${formatPercent(change, 0)} more expensive`

  const groups = [
    {
      title: 'On the price list',
      summary: describe(priceListChange),
      rows: [
        { name: 'Model you use now', value: currentPerAttempt, tone: 'current' },
        { name: "Model you're considering", value: candidatePerAttempt, tone: 'candidate' },
      ],
      unit: 'per attempt',
    },
    {
      title: 'Per successful task',
      summary: describe(perSuccessChange),
      rows: [
        { name: 'Model you use now', value: currentPerSuccess, tone: 'current' },
        { name: "Model you're considering", value: candidatePerSuccess, tone: 'candidate' },
      ],
      unit: 'per successful task',
    },
  ]

  return (
    <figure className="hero-figure">
      <div className="hero-figure-groups">
        {groups.map((group) => (
          <div key={group.title} className="hero-figure-group">
            <p className="hero-figure-title">
              {group.title}
              <strong>{group.summary}</strong>
            </p>
            <ul>
              {group.rows.map((row) => (
                <li key={row.name}>
                  <span className="hero-figure-name">{row.name}</span>
                  <span className="hero-figure-value">{formatUnitRupees(row.value)}</span>
                  <span
                    className={`hero-figure-bar hero-figure-bar--${row.tone}`}
                    style={{ width: width(row.value) }}
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <figcaption>
        An illustration, not a benchmark result. It uses the calculator's starting numbers.{' '}
        <a href="#trap">Put in your own</a>
      </figcaption>
    </figure>
  )
}
