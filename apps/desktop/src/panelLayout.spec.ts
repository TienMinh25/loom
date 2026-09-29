import { expect, test } from "bun:test";
import {
  parsePanelWidths,
  expandedWidthFromDrag,
  rememberExpandedWidths,
  resizePanelLayout,
  settlePanelLayout,
} from "./panelLayout";

test("panel resize remembers the last expanded widths", () => {
  expect(rememberExpandedWidths([0, 600, 0], [248, 280])).toEqual([248, 280]);
  expect(rememberExpandedWidths([310, 580, 210], [248, 280])).toEqual([310, 210]);
});

test("panel width persistence validates saved dimensions and falls back safely", () => {
  expect(parsePanelWidths("[310, 360]")).toEqual([310, 360]);
  expect(parsePanelWidths("[10, 900]")).toEqual([190, 420]);
  expect(parsePanelWidths("broken")).toEqual([248, 280]);
  expect(parsePanelWidths('["wide", 280]')).toEqual([248, 280]);
});

test("panel resize ignores collapsed rail widths while retaining the expanded width", () => {
  expect(rememberExpandedWidths([48, 600, 48], [310, 360])).toEqual([310, 360]);
  expect(rememberExpandedWidths([48, 600, 235], [310, 360])).toEqual([310, 235]);
  expect(rememberExpandedWidths([300, 600, 48], [310, 360])).toEqual([300, 360]);
});

test("collapse and restore keep both rails fixed and preserve center width", () => {
  expect(resizePanelLayout([48, 760, 48], [300, 520, 340], false, false, [300, 340])).toEqual([
    48, 760, 48,
  ]);
  expect(resizePanelLayout([48, 760, 48], [300, 520, 340], true, true, [300, 340])).toEqual([
    300, 760, 340,
  ]);
  expect(resizePanelLayout([0, 200, 0], [300, 520, 340], false, true, [300, 340])).toEqual([
    48, 280, 340,
  ]);
});

test("settles drag widths without snapping a collapsed rail or moving the opposite panel", () => {
  expect(settlePanelLayout([310, 620, 48], [248, 280], true, false)).toEqual({
    layout: [310, 620, 48],
    remembered: [310, 280],
  });
  expect(settlePanelLayout([48, 600, 350], [248, 280], false, true)).toEqual({
    layout: [48, 600, 350],
    remembered: [248, 350],
  });
});

test("dragging a collapsed rail past its activation threshold expands only that panel", () => {
  expect(expandedWidthFromDrag(64, 248, 48, 72, 340)).toBeNull();
  expect(expandedWidthFromDrag(210, 248, 48, 72, 340)).toBe(210);
  expect(expandedWidthFromDrag(510, 248, 48, 72, 420)).toBe(420);
});

test("keeps a right-panel drag attached to the right panel after both rails collapse", () => {
  const collapsed = resizePanelLayout([48, 900, 48], [248, 280, 280], false, false, [248, 280]);
  expect(collapsed).toEqual([48, 900, 48]);
  const restored = resizePanelLayout([48, 720, 228], collapsed, false, true, [248, 280]);
  expect(expandedWidthFromDrag(restored[2], 280, 48, 72, 420)).toBe(228);
  expect(restored[0]).toBe(48);
});

test("keeps live drag sizes for panels that were already expanded", () => {
  expect(resizePanelLayout([310, 500, 270], [248, 280, 300], true, true, [248, 280])).toEqual([
    310, 500, 270,
  ]);
});
