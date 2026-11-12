import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * A modal dialog on the native <dialog> element: focus stays inside, Escape and
 * the backdrop close it, and focus returns to whatever opened it. Children only
 * render while open, so forms inside start fresh every time.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  tone = 'default',
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  const id = useId()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal focuses the first control (the close button); prefer the one marked for it.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`modal modal--${tone}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-desc` : undefined}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open && (
        <div className="modal-panel">
          <div className="modal-head">
            <h2 id={`${id}-title`} className="modal-title">
              {title}
            </h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </div>
          {description && (
            <div id={`${id}-desc`} className="modal-desc">
              {description}
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  )
}
