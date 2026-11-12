/** The logotype: lowercase "modelfit", with a short length of measuring tape stitched under "fit". */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`} aria-label="ModelFit">
      <span aria-hidden="true">model</span>
      <span aria-hidden="true" className="wordmark-fit">
        fit
      </span>
    </span>
  )
}
