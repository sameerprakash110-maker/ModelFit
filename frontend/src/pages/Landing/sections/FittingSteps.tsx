import { FanOut } from '../../../components/landing/FanOut.tsx'
import { PatternPiece } from '../../../components/landing/PatternPiece.tsx'
import type { PatternShape } from '../../../components/landing/PatternPiece.tsx'
import { SectionHead } from '../../../components/landing/SectionHead.tsx'

const STEPS: { shape: PatternShape; title: string; body: string }[] = [
  {
    shape: 'bodice',
    title: 'Describe the job',
    body: 'Create a workload and add representative test cases, each with the answer you expect.',
  },
  {
    shape: 'sleeve',
    title: 'Choose what to try',
    body: 'Select the models, the providers they run through, and the agent harness each one works in.',
  },
  {
    shape: 'skirt',
    title: 'Run every model on the same cases',
    body: 'Each configuration gets the identical workload under controlled conditions.',
  },
  {
    shape: 'yoke',
    title: 'Score the answers',
    body: 'Structured outputs are checked by rules. Open-ended outputs are scored against an evaluation rubric.',
  },
  {
    shape: 'pocket',
    title: 'Fix the prompt, then decide',
    body: 'Improve a prompt and benchmark it again as a separate experiment, so the first result stays on record.',
  },
]

const HARNESS: { name: string; what: string }[] = [
  { name: 'System prompts', what: 'The standing instructions the model works under.' },
  { name: 'Tools', what: 'What the model is allowed to call.' },
  { name: 'Context', what: 'The documents and data it is given.' },
  { name: 'Memory', what: 'What carries over from one step to the next.' },
  { name: 'Retry policy', what: 'How many attempts a task gets.' },
  { name: 'Timeout settings', what: 'How long an attempt may run.' },
]

export function FittingSteps() {
  return (
    <section id="fitting" className="fitting">
      <div className="wrap">
        <SectionHead title="How a fitting works">
          A benchmark run takes a workload from a description to a verdict in five steps. Every run is saved, so last
          month's result is still there to compare against.
        </SectionHead>

        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="step">
              <PatternPiece shape={step.shape} step={index + 1} />
              <div className="step-text">
                <h3 className="h3">{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="harness">
          <div className="harness-text">
            <h3 className="h3">What an agent harness is</h3>
            <p>
              The harness is everything around the model while it works. The same model can pass or fail a task
              depending on it, so ModelFit benchmarks a model, its provider and its harness together as one
              configuration.
            </p>
            <dl className="harness-parts">
              {HARNESS.map((part) => (
                <div key={part.name}>
                  <dt>{part.name}</dt>
                  <dd>{part.what}</dd>
                </div>
              ))}
            </dl>
          </div>
          <FanOut />
        </div>
      </div>
    </section>
  )
}
