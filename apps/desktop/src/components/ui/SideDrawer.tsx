import { useId, useRef, type ReactNode } from "react";
import { IconButton } from "./Button";
import { useFocusScope } from "./useFocusScope";

type SideDrawerProps = {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  width?: number | string;
  className?: string;
};

export function SideDrawer({
  open,
  title,
  onClose,
  children,
  width = 520,
  className = "",
}: SideDrawerProps) {
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const onKeyDown = useFocusScope(open, drawerRef, onClose);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/45"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex h-full max-w-[94vw] flex-col overflow-hidden border-l border-[var(--loom-line)] bg-[var(--loom-panel)] shadow-2xl ${className}`.trim()}
        style={{ width }}
        onKeyDown={onKeyDown}
      >
        <header className="flex min-h-14 items-center justify-between border-b border-[var(--loom-line)] px-5">
          <h2 id={titleId} className="text-base font-semibold text-[var(--loom-text)]">
            {title}
          </h2>
          <IconButton aria-label={`Close ${title}`} variant="ghost" onClick={onClose}>
            ×
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
