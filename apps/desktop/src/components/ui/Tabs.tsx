import { useState, type ReactNode } from "react";

export type TabItem = { key: string; label: string; children: ReactNode };

type TabsProps = {
  items: TabItem[];
  defaultKey?: string;
  className?: string;
};

export function Tabs({ items, defaultKey, className = "" }: TabsProps) {
  const [selectedKey, setSelectedKey] = useState(defaultKey ?? items[0]?.key ?? "");
  const selected = items.find((item) => item.key === selectedKey) ?? items[0];
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <div role="tablist" className="flex gap-1 border-b border-[var(--loom-line)]">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected?.key === item.key}
            tabIndex={selected?.key === item.key ? 0 : -1}
            className={`min-h-10 border-b-2 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${selected?.key === item.key ? "border-violet-500 text-[var(--loom-text)]" : "border-transparent text-[var(--loom-muted)] hover:text-[var(--loom-text)]"}`}
            onClick={() => setSelectedKey(item.key)}
            onFocus={() => setSelectedKey(item.key)}
            onKeyDown={(event) => {
              const tabs = Array.from(
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                ) ?? [],
              );
              const currentIndex = tabs.indexOf(event.currentTarget);
              let nextIndex: number | undefined;
              if (event.key === "ArrowRight") {
                nextIndex = (currentIndex + 1) % tabs.length;
              } else if (event.key === "ArrowLeft") {
                nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
              } else if (event.key === "Home") {
                nextIndex = 0;
              } else if (event.key === "End") {
                nextIndex = tabs.length - 1;
              }
              if (nextIndex !== undefined) {
                event.preventDefault();
                tabs[nextIndex]?.focus();
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {selected && (
        <div role="tabpanel" aria-label={selected.label} className="min-w-0 pt-4">
          {selected.children}
        </div>
      )}
    </div>
  );
}
