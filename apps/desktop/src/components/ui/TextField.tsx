import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClasses =
  "w-full rounded-md border border-[var(--loom-line)] bg-[var(--loom-canvas)] px-3 py-2 font-[inherit] text-sm text-[var(--loom-text)] outline-none placeholder:text-[var(--loom-muted)] focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  className?: string;
};

export function TextField({ className = "", ...props }: TextFieldProps) {
  return <input className={`${fieldClasses} ${className}`.trim()} {...props} />;
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "rows"> & {
  className?: string;
  autoResize?: { minRows: number; maxRows: number };
};

export function TextArea({
  className = "",
  autoResize,
  value,
  defaultValue,
  style,
  ...props
}: TextAreaProps) {
  const content = String(value ?? defaultValue ?? "");
  const rows = autoResize
    ? Math.min(autoResize.maxRows, Math.max(autoResize.minRows, content.split("\n").length))
    : undefined;
  return (
    <textarea
      className={`${fieldClasses} resize-y ${className}`.trim()}
      rows={autoResize?.minRows}
      value={value}
      defaultValue={defaultValue}
      style={{ ...style, ...(rows ? { height: `${rows * 24 + 16}px` } : {}) }}
      {...props}
    />
  );
}
