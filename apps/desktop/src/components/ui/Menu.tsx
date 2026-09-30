import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

export type MenuItem = {
  key: string;
  label: ReactNode;
  kind?: "item" | "divider";
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
};

type MenuProps = {
  label: string;
  items: MenuItem[];
  onSelect(key: string): void;
  className?: string;
};

export function Menu({ label, items, onSelect, className = "" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      menuRef.current
        ?.querySelector<HTMLElement>(
          "[role='menuitem']:not([disabled]), [role='menuitemcheckbox']:not([disabled])",
        )
        ?.focus();
    }
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        {label}
      </Button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${label} menu`}
          className="absolute left-0 top-full z-40 mt-1 min-w-48 rounded-lg border border-[var(--loom-line)] bg-[var(--loom-panel)] p-1 shadow-xl"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              rootRef.current
                ?.querySelector<HTMLButtonElement>("button[aria-haspopup='menu']")
                ?.focus();
              return;
            }
            if (
              event.key === "ArrowDown" ||
              event.key === "ArrowUp" ||
              event.key === "Home" ||
              event.key === "End"
            ) {
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "[role='menuitem'], [role='menuitemcheckbox']",
                ),
              ).filter((item) => !item.disabled);
              const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                      items.length;
              event.preventDefault();
              items[nextIndex]?.focus();
            }
          }}
        >
          {items.map((item) =>
            item.kind === "divider" ? (
              <div
                key={item.key}
                role="separator"
                className="my-1 border-t border-[var(--loom-line)]"
              />
            ) : (
              <button
                key={item.key}
                type="button"
                role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={item.checked}
                disabled={item.disabled}
                className={`flex min-h-8 w-full items-center justify-between gap-5 rounded px-3 py-1.5 text-left text-sm text-[var(--loom-text)] hover:bg-[var(--loom-panel-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40 ${item.danger ? "text-red-400" : ""}`}
                onClick={() => {
                  onSelect(item.key);
                  setOpen(false);
                  rootRef.current
                    ?.querySelector<HTMLButtonElement>("button[aria-haspopup='menu']")
                    ?.focus();
                }}
              >
                <span>{item.label}</span>
                {item.checked !== undefined && (
                  <span aria-hidden="true">{item.checked ? "✓" : ""}</span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
