import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  expandedWidthFromDrag,
  isCompactPanelLayout,
  parsePanelWidths,
  settlePanelLayout,
} from "../panelLayout";

const COLLAPSED_WIDTH = 48;
const MIN_CENTER_WIDTH = 280;

type Props = {
  leftOpen: boolean;
  rightOpen: boolean;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  onExpandLeft(): void;
  onExpandRight(): void;
  onCollapseLeft(): void;
  onCollapseRight(): void;
};

type DragState = {
  side: "left" | "right";
  startX: number;
  initialWidth: number;
  moved: boolean;
};

export function ResizablePanelShell({
  leftOpen,
  rightOpen,
  left,
  center,
  right,
  onExpandLeft,
  onExpandRight,
  onCollapseLeft,
  onCollapseRight,
}: Props) {
  const [remembered, setRemembered] = useState(() =>
    parsePanelWidths(localStorage.getItem("loom:panel-widths:v1")),
  );
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [dragSide, setDragSide] = useState<"left" | "right" | null>(null);
  const [compactPanel, setCompactPanel] = useState<"left" | "right" | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem("loom:panel-widths:v1", JSON.stringify(remembered));
  }, [remembered]);

  const compactLayout = isCompactPanelLayout(containerWidth);
  const leftWidth = compactLayout
    ? COLLAPSED_WIDTH
    : leftOpen
      ? dragSide === "left"
        ? (dragWidth ?? remembered[0])
        : remembered[0]
      : COLLAPSED_WIDTH;
  const rightWidth = compactLayout
    ? 0
    : rightOpen
      ? dragSide === "right"
        ? (dragWidth ?? remembered[1])
        : remembered[1]
      : COLLAPSED_WIDTH;
  const collapseLeft = useCallback(() => {
    onCollapseLeft();
    setCompactPanel((current) => (current === "left" ? null : current));
  }, [onCollapseLeft]);

  const expandLeft = useCallback(() => {
    onExpandLeft();
    if (compactLayout) {
      setCompactPanel("left");
    }
  }, [compactLayout, onExpandLeft]);

  const collapseRight = useCallback(() => {
    onCollapseRight();
    setCompactPanel((current) => (current === "right" ? null : current));
  }, [onCollapseRight]);

  const expandRight = useCallback(() => {
    onExpandRight();
    if (compactLayout) {
      setCompactPanel("right");
    }
  }, [compactLayout, onExpandRight]);

  const leftContent = isValidElement(left)
    ? cloneElement(
        left as ReactElement<{
          collapsed?: boolean;
          onExpand?: () => void;
          onCollapse?: () => void;
        }>,
        {
          collapsed: !leftOpen || (compactLayout && compactPanel !== "left"),
          onExpand: expandLeft,
          onCollapse: collapseLeft,
        },
      )
    : left;
  const rightContent = isValidElement(right)
    ? cloneElement(
        right as ReactElement<{
          open?: boolean;
          onExpand?: () => void;
          onCollapse?: () => void;
        }>,
        {
          open: rightOpen && (!compactLayout || compactPanel === "right"),
          onExpand: expandRight,
          onCollapse: collapseRight,
        },
      )
    : right;

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    dragRef.current = null;
    const sizes: [number, number, number] =
      drag.side === "left"
        ? [dragWidth ?? leftWidth, 0, rightWidth]
        : [leftWidth, 0, dragWidth ?? rightWidth];
    const settled = settlePanelLayout(sizes, remembered, leftOpen, rightOpen);
    setRemembered(settled.remembered);
    setDragWidth(null);
    setDragSide(null);
    if (drag.side === "left" && leftOpen && sizes[0] <= 72) {
      collapseLeft();
    } else if (drag.side === "left" && !leftOpen && sizes[0] > 72) {
      expandLeft();
    } else if (drag.side === "right" && rightOpen && sizes[2] <= 72) {
      collapseRight();
    } else if (drag.side === "right" && !rightOpen && sizes[2] > 72) {
      expandRight();
    }
  }, [
    dragWidth,
    leftOpen,
    leftWidth,
    collapseLeft,
    collapseRight,
    expandLeft,
    expandRight,
    remembered,
    rightOpen,
    rightWidth,
  ]);

  function startDrag(event: PointerEvent<HTMLDivElement>, side: "left" | "right") {
    if (compactLayout) {
      return;
    }
    event.preventDefault();
    const initialWidth = side === "left" ? leftWidth : rightWidth;
    dragRef.current = { side, startX: event.clientX, initialWidth, moved: false };
    setDragSide(side);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const delta = event.clientX - drag.startX;
    const target = drag.initialWidth + (drag.side === "left" ? delta : -delta);
    const opposingWidth = drag.side === "left" ? rightWidth : leftWidth;
    const maxAvailable = Math.max(
      COLLAPSED_WIDTH,
      containerWidth - opposingWidth - MIN_CENTER_WIDTH - 8,
    );
    const width = Math.max(
      COLLAPSED_WIDTH,
      Math.min(
        drag.side === "left" ? Math.min(340, maxAvailable) : Math.min(420, maxAvailable),
        target,
      ),
    );
    drag.moved = true;
    setDragWidth(width);
    if (drag.side === "left" && !leftOpen) {
      const expanded = expandedWidthFromDrag(width, remembered[0], COLLAPSED_WIDTH, 72, 340);
      if (expanded !== null) {
        setRemembered((current) => [expanded, current[1]]);
        onExpandLeft();
      }
    }
    if (drag.side === "right" && !rightOpen) {
      const expanded = expandedWidthFromDrag(width, remembered[1], COLLAPSED_WIDTH, 72, 420);
      if (expanded !== null) {
        setRemembered((current) => [current[0], expanded]);
        onExpandRight();
      }
    }
  }

  function onKeyResize(side: "left" | "right", event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const amount = event.shiftKey ? 40 : 12;
    const delta = event.key === "ArrowRight" ? amount : -amount;
    const isOpen = side === "left" ? leftOpen : rightOpen;
    const expands = side === "left" ? delta > 0 : delta < 0;
    if (!isOpen) {
      if (expands) {
        (side === "left" ? expandLeft : expandRight)();
      }
      return;
    }

    const current = side === "left" ? leftWidth : rightWidth;
    const minimumWidth = side === "left" ? 190 : 210;
    const maxAvailable = Math.max(
      COLLAPSED_WIDTH,
      containerWidth - (side === "left" ? rightWidth : leftWidth) - MIN_CENTER_WIDTH - 8,
    );
    const requested = Math.max(
      COLLAPSED_WIDTH,
      Math.min(
        Math.min(side === "left" ? 340 : 420, maxAvailable),
        current + (side === "left" ? delta : -delta),
      ),
    );
    const contracts = side === "left" ? delta < 0 : delta > 0;
    if (requested <= 72 || (contracts && current <= minimumWidth && requested < minimumWidth)) {
      (side === "left" ? collapseLeft : collapseRight)();
      return;
    }

    const next = Math.min(maxAvailable, Math.max(minimumWidth, requested));
    setRemembered((state) => (side === "left" ? [next, state[1]] : [state[0], next]));
  }

  return (
    <div
      ref={shellRef}
      className="app-splitter relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--loom-canvas)]"
    >
      <div
        className={`panel-content h-full min-h-0 shrink-0 ${compactLayout ? "compact-panel-frame relative z-20 overflow-visible" : "overflow-hidden"}`}
        style={{ width: leftWidth }}
      >
        <div
          className={`h-full ${compactLayout && compactPanel === "left" ? "absolute inset-y-0 left-0 z-30 bg-[var(--loom-panel)] shadow-2xl ring-1 ring-[var(--loom-line)]" : ""}`}
          style={{ width: compactLayout && compactPanel === "left" ? remembered[0] : "100%" }}
        >
          {leftContent}
        </div>
      </div>
      {!compactLayout && (
        <div
          role="separator"
          aria-label="Resize conversation sidebar"
          aria-orientation="vertical"
          aria-valuemin={COLLAPSED_WIDTH}
          aria-valuemax={340}
          aria-valuenow={Math.round(leftWidth)}
          tabIndex={0}
          className="group relative z-10 w-1 shrink-0 cursor-col-resize touch-none bg-transparent hover:bg-violet-500/70 focus-visible:bg-violet-500"
          onPointerDown={(event) => startDrag(event, "left")}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={(event) => onKeyResize("left", event)}
        >
          <span className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}
      <div className="panel-content h-full min-h-0 min-w-0 flex-1 overflow-hidden">{center}</div>
      {!compactLayout && (
        <div
          role="separator"
          aria-label="Resize workspace explorer"
          aria-orientation="vertical"
          aria-valuemin={COLLAPSED_WIDTH}
          aria-valuemax={420}
          aria-valuenow={Math.round(rightWidth)}
          tabIndex={0}
          className="group relative z-10 w-1 shrink-0 cursor-col-resize touch-none bg-transparent hover:bg-violet-500/70 focus-visible:bg-violet-500"
          onPointerDown={(event) => startDrag(event, "right")}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={(event) => onKeyResize("right", event)}
        >
          <span className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}
      <div
        className={`panel-content h-full min-h-0 shrink-0 ${compactLayout ? "compact-panel-frame relative z-20 overflow-visible" : "overflow-hidden"}`}
        style={{ width: compactLayout ? COLLAPSED_WIDTH : rightWidth }}
      >
        <div
          className={`h-full ${compactLayout && compactPanel === "right" ? "absolute inset-y-0 right-0 z-30 bg-[var(--loom-panel)] shadow-2xl ring-1 ring-[var(--loom-line)]" : ""}`}
          style={{ width: compactLayout && compactPanel === "right" ? remembered[1] : "100%" }}
        >
          {rightContent}
        </div>
      </div>
    </div>
  );
}
