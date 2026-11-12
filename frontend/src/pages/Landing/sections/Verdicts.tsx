import { SectionHead } from '../../../components/landing/SectionHead.tsx'

const VERDICTS = [
  {
    word: 'Switch',
    body: 'Another model performs better on your workloads.',
  },
  {
    word: 'Stay',
    body: 'The model you already use is still the best fit.',
  },
  {
    word: 'Optimize',
    body: 'The alternative is close. Improve the prompt or the execution configuration, then run another benchmark.',
  },
]

export function Verdicts() {
  return (
    <section id="verdicts" className="verdicts">
      <div className="wrap">
        <SectionHead title="Every run ends in a verdict">
          A verdict comes from the results of your benchmark and the criteria you set. ModelFit never fills in a
          score it didn't measure.
        </SectionHead>

        <ul className="labels">
          {VERDICTS.map((verdict) => (
            <li key={verdict.word} className="label">
              <h3 className="label-word">{verdict.word}</h3>
              <p>{verdict.body}</p>
            </li>
          ))}
        </ul>

        {/* The fourth outcome is an unsewn label: no recommendation has been attached yet. */}
        <div className="label label--open">
          <h3 className="label-open-word">Inconclusive</h3>
          <p>
            There isn't enough reliable evidence to recommend switching or staying. ModelFit says so instead of
            guessing. More test cases or more repeated runs usually settle it.
          </p>
        </div>
      </div>
    </section>
  )
}
