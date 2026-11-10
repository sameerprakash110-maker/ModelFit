import { useRef } from 'react'
import { SectionHead } from '../../../components/landing/SectionHead.tsx'
import { useFittedLines } from '../../../hooks/useFittedLines.ts'
import type { FitOptions } from '../../../utils/fitText.ts'

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

const WORDS = VERDICTS.map((verdict) => verdict.word)
const LABEL_FONT: FitOptions = {
  family: '"Anybody Variable", sans-serif',
  weight: 800,
  maxSize: 132,
}

export function Verdicts() {
  // All three labels are the same width, so one of them is enough to measure.
  const measure = useRef<HTMLDivElement>(null)
  const fit = useFittedLines(measure, WORDS, LABEL_FONT)

  return (
    <section id="verdicts" className="verdicts">
      <div className="wrap">
        <SectionHead title="Every run ends in a verdict">
          A verdict comes from the results of your benchmark and the criteria you set. ModelFit never fills in a
          score it didn't measure.
        </SectionHead>

        <ul className="labels">
          {VERDICTS.map((verdict, index) => (
            <li key={verdict.word} className="label">
              <div ref={index === 0 ? measure : undefined} className="label-word-box">
                <h3
                  className="label-word"
                  style={{
                    fontSize: fit ? fit.size : undefined,
                    fontVariationSettings: `"wdth" ${fit ? fit.wdths[index] : 100}`,
                    visibility: fit ? 'visible' : 'hidden',
                  }}
                >
                  {verdict.word}
                </h3>
              </div>
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
