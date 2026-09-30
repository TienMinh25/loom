import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "small";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "type"> & {
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"] | "primary" | "text";
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: "default" | "circle";
  danger?: boolean;
  className?: string;
  leadingIcon?: ReactNode;
  icon?: ReactNode;
};

const baseClasses =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--loom-accent)] disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[var(--loom-accent)] text-white hover:bg-[var(--loom-accent-hover)]",
  secondary:
    "border border-[var(--loom-line)] bg-[var(--loom-panel)] text-[var(--loom-text)] hover:bg-[var(--loom-panel-raised)]",
  ghost:
    "bg-transparent text-[var(--loom-muted)] hover:bg-[var(--loom-panel-raised)] hover:text-[var(--loom-text)]",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-7 px-2.5 text-xs",
  small: "min-h-7 px-2.5 text-xs",
  md: "min-h-9 px-3 text-sm",
};

export function Button({
  variant,
  size = "md",
  shape = "default",
  danger = false,
  className = "",
  leadingIcon,
  icon,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const mappedVariant =
    variant ??
    (danger ? "danger" : type === "primary" ? "primary" : type === "text" ? "ghost" : "secondary");
  const nativeType = type === "primary" || type === "text" ? "button" : type;
  return (
    <button
      type={nativeType}
      className={`${baseClasses} ${variantClasses[mappedVariant]} ${sizeClasses[size === "small" ? "sm" : size]} ${shape === "circle" ? "!rounded-full" : ""} ${className}`.trim()}
      {...props}
    >
      {leadingIcon ?? icon}
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "children"> & {
  "aria-label": string;
  children: ReactNode;
};

export function IconButton({ className = "", size = "sm", ...props }: IconButtonProps) {
  return (
    <Button {...props} size={size} className={`!h-8 !min-h-8 !w-8 !p-0 ${className}`.trim()} />
  );
}
