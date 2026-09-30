import { useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { useFocusScope } from "./useFocusScope";

type DialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose(): void;
  onConfirm?(): void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  hideActions?: boolean;
  className?: string;
};

export function Dialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  hideActions = false,
  className = "",
}: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onKeyDown = useFocusScope(open, dialogRef, onClose);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[min(88vh,720px)] w-full max-w-lg overflow-auto rounded-xl border border-[var(--loom-line)] bg-[var(--loom-panel)] p-5 shadow-2xl ${className}`.trim()}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="mb-4 text-base font-semibold text-[var(--loom-text)]">
          {title}
        </h2>
        <div className="min-w-0 text-sm text-[var(--loom-muted)]">{children}</div>
        {!hideActions && (
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {cancelLabel}
            </Button>
            {onConfirm && (
              <Button variant={confirmVariant} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
