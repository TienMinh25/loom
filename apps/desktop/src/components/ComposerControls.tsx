import { useState } from "react";
import { approvalModeOptions, type ApprovalMode } from "../approvalMode";
import { MODEL_OPTIONS } from "../modelOptions";
import { Button, Icon, IconButton } from "./ui";

type Props = {
  model: string;
  reasoning: string;
  approvalMode: ApprovalMode;
  extensions: string[];
  onModelChange(value: string): void;
  onReasoningChange(value: string): void;
  onApprovalModeChange(value: ApprovalMode): void;
  onAddExtension(kind: "plugin" | "mcp"): void;
};

const selectClass =
  "h-8 min-w-0 rounded-md border border-[var(--loom-line)] bg-[var(--loom-panel)] px-2 text-xs text-[var(--loom-muted)] outline-none hover:text-[var(--loom-text)] focus:border-violet-500";

export function ComposerControls(props: Props) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [runOptionsOpen, setRunOptionsOpen] = useState(false);
  return (
    <div className="composer-options flex min-w-0 flex-wrap items-center gap-1.5">
      <div className="relative">
        <IconButton
          aria-label="Add plugin or MCP"
          aria-expanded={addMenuOpen}
          variant="ghost"
          className="!border !border-[var(--loom-line)] text-base"
          onClick={() => setAddMenuOpen((open) => !open)}
        >
          +
        </IconButton>
        {addMenuOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-0 z-10 mb-1 min-w-40 rounded-lg border border-[var(--loom-line)] bg-[var(--loom-panel)] p-1 shadow-xl"
          >
            <Button
              role="menuitem"
              variant="ghost"
              className="!h-9 !w-full !justify-start rounded px-3 text-left text-sm"
              onClick={() => {
                props.onAddExtension("plugin");
                setAddMenuOpen(false);
              }}
            >
              Add plugin
            </Button>
            <Button
              role="menuitem"
              variant="ghost"
              className="!h-9 !w-full !justify-start rounded px-3 text-left text-sm"
              onClick={() => {
                props.onAddExtension("mcp");
                setAddMenuOpen(false);
              }}
            >
              Add MCP server
            </Button>
          </div>
        )}
      </div>
      <label className="sr-only" htmlFor="composer-model">
        Model
      </label>
      <select
        id="composer-model"
        aria-label="Model"
        className={`${selectClass} composer-model-select`}
        value={props.model}
        onChange={(event) => props.onModelChange(event.target.value)}
      >
        {MODEL_OPTIONS.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      <IconButton
        type="button"
        aria-label="Run options"
        aria-expanded={runOptionsOpen}
        variant="ghost"
        className="!border !border-[var(--loom-line)] text-xs"
        onClick={() => setRunOptionsOpen((open) => !open)}
      >
        <Icon name="settings" />
      </IconButton>
      {runOptionsOpen && (
        <div className="composer-advanced-options">
          <label className="sr-only" htmlFor="composer-reasoning">
            Reasoning effort
          </label>
          <select
            id="composer-reasoning"
            aria-label="Reasoning effort"
            className={selectClass}
            value={props.reasoning}
            onChange={(event) => props.onReasoningChange(event.target.value)}
          >
            <option value="low">Low reasoning</option>
            <option value="medium">Medium reasoning</option>
            <option value="high">High reasoning</option>
          </select>
          <label className="sr-only" htmlFor="composer-approval">
            Approval mode
          </label>
          <select
            id="composer-approval"
            aria-label="Approval mode"
            className={selectClass}
            value={props.approvalMode}
            onChange={(event) => props.onApprovalModeChange(event.target.value as ApprovalMode)}
          >
            {approvalModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="extension-tags flex min-w-0 flex-wrap gap-1">
        {props.extensions.map((extension) => (
          <span
            key={extension}
            className="rounded-full border border-[var(--loom-line)] px-2 py-1 text-xs text-[var(--loom-muted)]"
          >
            {extension}
          </span>
        ))}
      </div>
    </div>
  );
}
