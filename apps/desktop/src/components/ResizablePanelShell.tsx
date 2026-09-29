import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Splitter } from "antd";
import {
  expandedWidthFromDrag,
  parsePanelWidths,
  resizePanelLayout,
  settlePanelLayout,
} from "../panelLayout";

const COLLAPSED_WIDTH = 48;

type Props = {
  leftOpen: boolean;
  rightOpen: boolean;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  onExpandLeft(): void;
  onExpandRight(): void;
};

export function ResizablePanelShell({
  leftOpen,
  rightOpen,
  left,
  center,
  right,
  onExpandLeft,
  onExpandRight,
}: Props) {
  const [leftWidth, setLeftWidth] = useState(
    () => parsePanelWidths(localStorage.getItem("loom:panel-widths:v1"))[0],
  );
  const [rightWidth, setRightWidth] = useState(
    () => parsePanelWidths(localStorage.getItem("loom:panel-widths:v1"))[1],
  );
  const [layoutWidths, setLayoutWidths] = useState<[number, number, number]>(() => {
    const widths = parsePanelWidths(localStorage.getItem("loom:panel-widths:v1"));
    return [widths[0], 600, widths[1]];
  });
  const dragging = useRef(false);

  useEffect(() => {
    localStorage.setItem("loom:panel-widths:v1", JSON.stringify([leftWidth, rightWidth]));
  }, [leftWidth, rightWidth]);

  useEffect(() => {
    if (dragging.current) {
      return;
    }
    setLayoutWidths(([currentLeft, center, currentRight]) => {
      const nextLeft = leftOpen
        ? Math.max(leftWidth, currentLeft > COLLAPSED_WIDTH ? currentLeft : leftWidth)
        : COLLAPSED_WIDTH;
      const nextRight = rightOpen
        ? Math.max(rightWidth, currentRight > COLLAPSED_WIDTH ? currentRight : rightWidth)
        : COLLAPSED_WIDTH;
      return [nextLeft, center, nextRight];
    });
  }, [leftOpen, rightOpen, leftWidth, rightWidth]);

  const updateWidths = useCallback(
    (sizes: number[]) => {
      const next = resizePanelLayout(sizes, layoutWidths, leftOpen, rightOpen, [
        leftWidth,
        rightWidth,
      ]);
      const restoredLeft = leftOpen
        ? null
        : expandedWidthFromDrag(sizes[0], leftWidth, COLLAPSED_WIDTH, 72, 340);
      const restoredRight = rightOpen
        ? null
        : expandedWidthFromDrag(sizes[2], rightWidth, COLLAPSED_WIDTH, 72, 420);
      if (restoredLeft !== null) {
        next[0] = restoredLeft;
        setLeftWidth(restoredLeft);
        onExpandLeft();
      }
      if (restoredRight !== null) {
        next[2] = restoredRight;
        setRightWidth(restoredRight);
        onExpandRight();
      }
      setLayoutWidths(next);
    },
    [layoutWidths, leftWidth, rightWidth, leftOpen, rightOpen, onExpandLeft, onExpandRight],
  );

  const settleWidths = useCallback(
    (sizes: number[]) => {
      dragging.current = false;
      const settled = settlePanelLayout(sizes, [leftWidth, rightWidth], leftOpen, rightOpen);
      setLeftWidth(settled.remembered[0]);
      setRightWidth(settled.remembered[1]);
      setLayoutWidths(settled.layout);
    },
    [leftWidth, rightWidth, leftOpen, rightOpen],
  );

  return (
    <Splitter
      className="app-splitter"
      onResizeStart={(sizes) => {
        dragging.current = true;
        setLayoutWidths([sizes[0], sizes[1], sizes[2]]);
      }}
      onResize={updateWidths}
      onResizeEnd={settleWidths}
    >
      <Splitter.Panel size={layoutWidths[0]} min={leftOpen ? 190 : COLLAPSED_WIDTH} max={340}>
        <div className={leftOpen ? "panel-content" : "panel-rail panel-rail-left"}>
          {leftOpen ? left : <div className="panel-rail-actions">{left}</div>}
        </div>
      </Splitter.Panel>
      <Splitter.Panel size={layoutWidths[1]} min={280}>
        {center}
      </Splitter.Panel>
      <Splitter.Panel size={layoutWidths[2]} min={rightOpen ? 210 : COLLAPSED_WIDTH} max={420}>
        <div className={rightOpen ? "panel-content" : "panel-rail panel-rail-right"}>
          {rightOpen ? right : <div className="panel-rail-actions">{right}</div>}
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}
