import { createElement, type HTMLAttributes, type ReactNode } from "react";

type TextProps = HTMLAttributes<HTMLElement> & {
  as?: "span" | "div" | "p";
  tone?: "default" | "secondary" | "danger";
  type?: "secondary" | "danger";
  strong?: boolean;
  children: ReactNode;
};

const textTone = {
  default: "text-[var(--loom-text)]",
  secondary: "text-[var(--loom-muted)]",
  danger: "text-red-400",
} as const;

export function Text({
  as = "span",
  tone,
  type,
  strong = false,
  className = "",
  children,
  ...props
}: TextProps) {
  const resolvedTone = tone ?? type ?? "default";
  return createElement(
    as,
    {
      className: `${textTone[resolvedTone]} ${strong ? "font-semibold" : ""} ${className}`.trim(),
      ...props,
    },
    children,
  );
}

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
};

export function Title({ level = 2, className = "", children, ...props }: HeadingProps) {
  const tag = `h${level}` as const;
  return createElement(
    tag,
    {
      className: `m-0 font-semibold tracking-tight text-[var(--loom-text)] ${className}`.trim(),
      ...props,
    },
    children,
  );
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "warning";
  color?: "orange";
  variant?: "filled";
};

export function Badge({ tone, color, variant, className = "", ...props }: BadgeProps) {
  const resolvedTone = tone ?? (color === "orange" ? "warning" : "default");
  const toneClass =
    resolvedTone === "warning"
      ? "border-amber-500/30 text-amber-400"
      : "border-[var(--loom-line)] text-[var(--loom-muted)]";
  const variantClass = variant === "filled" ? "bg-[var(--loom-panel-raised)]" : "";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${toneClass} ${variantClass} ${className}`.trim()}
      {...props}
    />
  );
}
