import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  defaultKeymap,
  history,
  historyKeymap,
  historyField,
  indentWithTab,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from "@codemirror/commands";
import { Compartment, EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type CodeEditorHandle = {
  undo(): boolean;
  redo(): boolean;
  serializeState(): unknown;
  findNext(query: string): { match: number; total: number } | null;
  replaceNext(query: string, replacement: string): boolean;
  replaceAll(query: string, replacement: string): number;
  goToLine(line: number): number;
  selectAll(): void;
};
export type CodeEditorStateCache = Map<string, unknown>;

type Props = {
  label: string;
  path: string;
  value: string;
  onChange(value: string): void;
  onCursorChange(line: number): void;
  onHistoryChange(canUndo: boolean, canRedo: boolean): void;
  stateCache: CodeEditorStateCache;
};

const loomHighlightStyle = HighlightStyle.define([
  {
    tag: tags.keyword,
    color: "var(--loom-syntax-keyword)",
    class: "loom-syntax-keyword",
  },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--loom-syntax-string)",
    class: "loom-syntax-string",
  },
  {
    tag: [tags.number, tags.bool, tags.null],
    color: "var(--loom-syntax-literal)",
    class: "loom-syntax-literal",
  },
  {
    tag: tags.comment,
    color: "var(--loom-syntax-comment)",
    fontStyle: "italic",
    class: "loom-syntax-comment",
  },
  {
    tag: [tags.typeName, tags.className],
    color: "var(--loom-syntax-type)",
    class: "loom-syntax-type",
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "var(--loom-syntax-function)",
    class: "loom-syntax-function",
  },
  {
    tag: tags.propertyName,
    color: "var(--loom-syntax-property)",
    class: "loom-syntax-property",
  },
  {
    tag: tags.operator,
    color: "var(--loom-syntax-operator)",
    class: "loom-syntax-operator",
  },
]);

async function languageForPath(path: string): Promise<Extension> {
  const extension = path.split(".").at(-1)?.toLowerCase();
  switch (extension) {
    case "js":
    case "jsx":
      return import("@codemirror/lang-javascript").then(({ javascript }) =>
        javascript({ jsx: true }),
      );
    case "ts":
    case "tsx":
      return import("@codemirror/lang-javascript").then(({ javascript }) =>
        javascript({ jsx: extension === "tsx", typescript: true }),
      );
    case "json":
    case "jsonc":
      return import("@codemirror/lang-json").then(({ json }) => json());
    case "html":
    case "htm":
      return import("@codemirror/lang-html").then(({ html }) => html());
    case "css":
      return import("@codemirror/lang-css").then(({ css }) => css());
    case "py":
      return import("@codemirror/lang-python").then(({ python }) => python());
    case "md":
    case "markdown":
      return import("@codemirror/lang-markdown").then(({ markdown }) => markdown());
    default:
      return Promise.resolve([]);
  }
}

export const CodeEditor = forwardRef<CodeEditorHandle, Props>(function CodeEditor(
  { label, path, value, onChange, onCursorChange, onHistoryChange, stateCache },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);
  const onHistoryChangeRef = useRef(onHistoryChange);
  const valueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
    onCursorChangeRef.current = onCursorChange;
    onHistoryChangeRef.current = onHistoryChange;
  }, [onChange, onCursorChange, onHistoryChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useImperativeHandle(ref, () => ({
    serializeState() {
      const view = viewRef.current;
      return view ? view.state.toJSON({ history: historyField }) : null;
    },
    undo() {
      const view = viewRef.current;
      if (!view || !undo(view)) {
        return false;
      }
      window.requestAnimationFrame(() => {
        if (viewRef.current === view) {
          view.focus();
        }
      });
      return true;
    },
    redo() {
      const view = viewRef.current;
      if (!view || !redo(view)) {
        return false;
      }
      window.requestAnimationFrame(() => {
        if (viewRef.current === view) {
          view.focus();
        }
      });
      return true;
    },
    findNext(query) {
      const view = viewRef.current;
      const text = query.trim();
      if (!view || !text) {
        return null;
      }
      const document = view.state.doc.toString();
      const start = view.state.selection.main.to;
      const match =
        document.indexOf(text, start) >= 0 ? document.indexOf(text, start) : document.indexOf(text);
      if (match < 0) {
        return null;
      }
      let total = 0;
      let matchNumber = 0;
      let index = 0;
      while ((index = document.indexOf(text, index)) >= 0) {
        total += 1;
        if (index === match) {
          matchNumber = total;
        }
        index += text.length;
      }
      view.dispatch({
        selection: { anchor: match, head: match + text.length },
        scrollIntoView: true,
      });
      window.requestAnimationFrame(() => {
        if (viewRef.current === view) {
          view.focus();
        }
      });
      return { match: matchNumber, total };
    },
    replaceNext(query, replacement) {
      const view = viewRef.current;
      const text = query.trim();
      if (!view || !text) {
        return false;
      }
      const document = view.state.doc.toString();
      const start = view.state.selection.main.to;
      const nextMatch = document.indexOf(text, start);
      const match = nextMatch >= 0 ? nextMatch : document.indexOf(text);
      if (match < 0) {
        return false;
      }
      view.dispatch({
        changes: { from: match, to: match + text.length, insert: replacement },
        selection: { anchor: match + replacement.length },
        scrollIntoView: true,
      });
      window.requestAnimationFrame(() => {
        if (viewRef.current === view) {
          view.focus();
        }
      });
      return true;
    },
    replaceAll(query, replacement) {
      const view = viewRef.current;
      const text = query.trim();
      if (!view || !text || text === replacement) {
        return 0;
      }
      const document = view.state.doc.toString();
      const matches = document.split(text).length - 1;
      if (!matches) {
        return 0;
      }
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: document.split(text).join(replacement),
        },
      });
      window.requestAnimationFrame(() => {
        if (viewRef.current === view) {
          view.focus();
        }
      });
      return matches;
    },
    goToLine(line) {
      const view = viewRef.current;
      if (!view) {
        return 1;
      }
      const target = Math.min(view.state.doc.lines, Math.max(1, Math.trunc(line) || 1));
      view.dispatch({
        selection: { anchor: view.state.doc.line(target).from },
        scrollIntoView: true,
      });
      window.requestAnimationFrame(() => {
        if (viewRef.current === view) {
          view.focus();
        }
      });
      return target;
    },
    selectAll() {
      const view = viewRef.current;
      if (view) {
        view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
        window.requestAnimationFrame(() => {
          if (viewRef.current === view) {
            view.focus();
          }
        });
      }
    },
  }));

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    const language = new Compartment();
    const extensions = [
      lineNumbers(),
      foldGutter(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      indentOnInput(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(loomHighlightStyle),
      language.of([]),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        spellcheck: "false",
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onHistoryChangeRef.current(undoDepth(update.state) > 0, redoDepth(update.state) > 0);
        }
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          onCursorChangeRef.current(
            update.state.doc.lineAt(update.state.selection.main.head).number,
          );
        }
      }),
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px" },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: 'Consolas, "SFMono-Regular", monospace',
          lineHeight: "1.65",
        },
        ".cm-content": { padding: "10px 14px", caretColor: "var(--loom-text)" },
        ".cm-gutters": {
          backgroundColor: "var(--loom-panel-raised)",
          color: "var(--loom-muted)",
          borderRight: "1px solid var(--loom-line)",
        },
        ".cm-activeLineGutter, .cm-activeLine": {
          backgroundColor: "color-mix(in srgb, var(--loom-accent) 9%, transparent)",
        },
        ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--loom-accent)" },
        "&.cm-focused": { outline: "none" },
        ".cm-selectionBackground": {
          backgroundColor: "color-mix(in srgb, var(--loom-accent) 30%, transparent) !important",
        },
      }),
    ];
    const cachedState = stateCache.get(path);
    let state: EditorState | null = null;
    if (cachedState) {
      try {
        const restored = EditorState.fromJSON(
          cachedState,
          { extensions },
          { history: historyField },
        );
        if (restored.doc.toString() === valueRef.current) {
          state = restored;
        } else {
          stateCache.delete(path);
        }
      } catch {
        stateCache.delete(path);
      }
    }
    state ??= EditorState.create({ doc: valueRef.current, extensions });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    onHistoryChangeRef.current(undoDepth(view.state) > 0, redoDepth(view.state) > 0);
    void languageForPath(path).then((extension) => {
      if (viewRef.current === view) {
        view.dispatch({ effects: language.reconfigure(extension) });
      }
    });
    onCursorChangeRef.current(1);
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [label, path, stateCache]);

  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className="code-editor" role="group" aria-label="Code editor" />;
});
