import { SectionHead } from '../../../components/landing/SectionHead.tsx'

const DIFFERENCES: { title: string; offTheRack: string; madeToMeasure: string }[] = [
  {
    title: 'Your workloads, not generic benchmarks',
    offTheRack: 'Test sets written for everyone, which means for no company in particular.',
    madeToMeasure: 'The tasks your team actually runs, with the answers you expect.',
  },
  {
    title: 'Controlled, comparable experiments',
    offTheRack: 'Scores gathered under different prompts and settings, by different people.',
    madeToMeasure: 'Every configuration gets identical cases under the same conditions.',
  },
  {
    title: 'Transparent cost calculations',
    offTheRack: 'A price per million tokens.',
    madeToMeasure: 'Cost per successful task, with every attempt and retry counted and shown.',
  },
  {
    title: 'Reproducible evaluation configurations',
    offTheRack: "A result you can't rerun or audit.",
    madeToMeasure: 'Saved rules, rubrics and harness settings that run again unchanged.',
  },
  {
    title: 'Historical performance tracking',
    offTheRack: 'A snapshot from whenever it was published.',
    madeToMeasure: 'Every run is kept, so you can see how a model changes over time.',
  },
  {
    title: 'Workload-specific recommendations',
    offTheRack: 'One ranking for every use case.',
    madeToMeasure: 'A verdict for this workload, weighted by your priorities.',
  },
]

export function WhyModelFit() {
  return (
    <section id="why" className="why">
      <div className="wrap">
        <SectionHead title="Why not just check the public benchmarks?">
          Because they measure someone else's work. A public leaderboard tells you which model did best on its test
          set. ModelFit tells you which one does best on yours.
        </SectionHead>

        <table className="versus">
          <thead>
            <tr>
              <td />
              <th scope="col">
                Off the rack
                <span>Public benchmarks</span>
              </th>
              <th scope="col" className="versus-ours">
                Made to measure
                <span>ModelFit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {DIFFERENCES.map((row) => (
              <tr key={row.title}>
                <th scope="row">{row.title}</th>
                <td data-label="Off the rack">{row.offTheRack}</td>
                <td data-label="Made to measure" className="versus-ours">
                  {row.madeToMeasure}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
