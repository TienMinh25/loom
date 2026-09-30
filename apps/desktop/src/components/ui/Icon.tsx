import type { ReactNode } from "react";

type IconName =
  | "arrow-up"
  | "branch"
  | "close"
  | "code"
  | "folder"
  | "message"
  | "monitor"
  | "moon"
  | "redo"
  | "settings"
  | "stop"
  | "sun"
  | "undo";

const iconPaths: Record<IconName, ReactNode> = {
  "arrow-up": <path d="M12 19V5m-7 7 7-7 7 7" />,
  branch: (
    <path d="M6 3v12m0 0a3 3 0 1 0 3 3m-3-3a3 3 0 1 1-3 3m9-15v5a4 4 0 0 0 4 4h2m0 0a3 3 0 1 0 3 3m-3-3a3 3 0 1 1-3 3" />
  ),
  close: <path d="m18 6-12 12M6 6l12 12" />,
  code: <path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  message: (
    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </>
  ),
  moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
  redo: <path d="M21 7v6h-6m6-6a9 9 0 0 0-15-1L3 9m18-2-3-3" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.6a8 8 0 0 1-1.6.9l-.3 1.9h-2.8l-.3-1.9a8 8 0 0 1-1.6-.9l-1.8.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-1.9l-1.4-1.2 1.4-2.4 1.8.7a8 8 0 0 1 1.6-.9l.3-1.9h2.8l.3 1.9a8 8 0 0 1 1.6.9l1.8-.7 1.4 2.4-1.4 1.2a8 8 0 0 1 0 1.8Z" />
    </>
  ),
  stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </>
  ),
  undo: <path d="M3 7v6h6M3 7a9 9 0 0 1 15-1l3 3m-18-2 3-3" />,
};

type Props = {
  name: IconName;
  className?: string;
};

export function Icon({ name, className = "h-4 w-4" }: Props) {
  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 ${className}`.trim()}
      data-icon={name}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}
