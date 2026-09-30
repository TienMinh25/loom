export const COMPACT_PANEL_BREAKPOINT = 800;

export function isCompactPanelLayout(width: number): boolean {
  return width > 0 && width < COMPACT_PANEL_BREAKPOINT;
}

export function rememberExpandedWidths(
  sizes: number[],
  current: [number, number],
  collapsedSize = 48,
): [number, number] {
  return [
    sizes[0] > collapsedSize ? sizes[0] : current[0],
    sizes[2] > collapsedSize ? sizes[2] : current[1],
  ];
}

export function expandedWidthFromDrag(
  requested: number,
  remembered: number,
  collapsedSize = 48,
  activationThreshold = 72,
  maximum = 420,
): number | null {
  if (requested <= activationThreshold || remembered <= collapsedSize) {
    return null;
  }
  return Math.min(maximum, Math.max(190, requested));
}

export function resizePanelLayout(
  sizes: number[],
  current: [number, number, number],
  leftOpen: boolean,
  rightOpen: boolean,
  expanded: [number, number],
  collapsedSize = 48,
): [number, number, number] {
  const left = leftOpen
    ? Math.max(collapsedSize, sizes[0] > collapsedSize ? sizes[0] : expanded[0])
    : collapsedSize;
  const right = rightOpen
    ? Math.max(collapsedSize, sizes[2] > collapsedSize ? sizes[2] : expanded[1])
    : collapsedSize;
  const center = Math.max(280, sizes[1] || current[1]);
  return [left, center, right];
}

export function settlePanelLayout(
  sizes: number[],
  remembered: [number, number],
  leftOpen: boolean,
  rightOpen: boolean,
  collapsedSize = 48,
): { layout: [number, number, number]; remembered: [number, number] } {
  const leftCollapsed = sizes[0] <= 72;
  const rightCollapsed = sizes[2] <= 72;
  const widths: [number, number] = [
    leftCollapsed ? remembered[0] : sizes[0] < 190 ? remembered[0] : sizes[0],
    rightCollapsed ? remembered[1] : sizes[2] < 210 ? remembered[1] : sizes[2],
  ];
  const left = leftOpen ? (leftCollapsed ? collapsedSize : Math.max(190, sizes[0])) : collapsedSize;
  const right = rightOpen
    ? rightCollapsed
      ? collapsedSize
      : Math.max(210, sizes[2])
    : collapsedSize;
  return {
    layout: [left, Math.max(280, sizes[1] || 280), right],
    remembered: widths,
  };
}

export function parsePanelWidths(value: string | null): [number, number] {
  if (!value) {
    return [248, 280];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      parsed.every((width) => typeof width === "number" && Number.isFinite(width))
    ) {
      return [Math.min(340, Math.max(190, parsed[0])), Math.min(420, Math.max(210, parsed[1]))];
    }
  } catch {
    return [248, 280];
  }
  return [248, 280];
}
