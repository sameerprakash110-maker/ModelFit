/** The logotype: "Model" squeezed narrow, "Fit" let out wide. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`} aria-label="ModelFit">
      <span aria-hidden="true" style={{ fontVariationSettings: '"wdth" 62' }}>
        Model
      </span>
      <span aria-hidden="true" style={{ fontVariationSettings: '"wdth" 150' }}>
        Fit
      </span>
    </span>
  )
}
