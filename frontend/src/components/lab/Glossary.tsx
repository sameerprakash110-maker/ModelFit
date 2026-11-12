import { MIN_QUALITY, MIN_SUCCESS_RATE, RELATIVE_QUALITY } from '../../utils/benchmark.ts'
import { USD_TO_INR } from '../../utils/format.ts'

/** Plain-language meaning of every number on the results page. */
export function Glossary() {
  return (
    <details className="glossary">
      <summary>What these numbers mean</summary>
      <dl>
        <div>
          <dt>Quality</dt>
          <dd>
            A judge model reads each answer and scores it from 0 to 10 against the test case's “good answer”. Higher is
            better. Scores vary a little from run to run, so differences under about half a point are noise.
          </dd>
        </div>
        <div>
          <dt>Answered (reliability)</dt>
          <dd>
            The share of calls that returned an answer. A call is retried once before it counts as failed. Failures
            matter in production: each one is a request your users don't get answered.
          </dd>
        </div>
        <div>
          <dt>Typical speed and slowest 5%</dt>
          <dd>
            Latency: the time from sending a request to receiving the full answer, including retries. “Typical” is the
            median call; “slowest 5%” (p95) is how long the slowest one in twenty calls took.
          </dd>
        </div>
        <div>
          <dt>Tokens</dt>
          <dd>
            Models read and write text in tokens, roughly three quarters of a word each. “In” is your prompt plus the
            system prompt; “out” is the answer. Providers charge per token, so longer answers cost more.
          </dd>
        </div>
        <div>
          <dt>Cost per answer</dt>
          <dd>
            Everything spent on a model's calls divided by the answers that succeeded, so failed calls count against
            it. Providers price in US dollars; ModelFit shows rupees at ₹{USD_TO_INR} per US$.
          </dd>
        </div>
        <div>
          <dt>Can be recommended?</dt>
          <dd>
            A model is only recommended if it scores at least {MIN_QUALITY}/10, stays within{' '}
            {Math.round(RELATIVE_QUALITY * 100)}% of the best model's score, and answers at least{' '}
            {Math.round(MIN_SUCCESS_RATE * 100)}% of calls. Among those, “Optimise for” decides the pick.
          </dd>
        </div>
      </dl>
    </details>
  )
}
