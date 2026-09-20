// Layout that adapts to tablets and landscape phones.
//
// Phones keep the single column they always had. From ~720dp the question and
// its picture sit side by side, and long content stops stretching across the
// whole screen — a 1000dp-wide line of Cyrillic is unreadable.
import { useWindowDimensions } from "react-native";

/** Width from which the two-column question layout kicks in. */
export const WIDE_BREAKPOINT = 720;
/** Text never gets wider than this, however big the screen is. */
export const MAX_CONTENT_WIDTH = 760;

export type Responsive = {
  width: number;
  height: number;
  isLandscape: boolean;
  isWide: boolean;
  /** Style to centre a column on big screens; undefined on phones. */
  contentWidthStyle: { maxWidth: number; width: "100%"; alignSelf: "center" } | undefined;
  /** How many cards fit in a grid row. */
  gridColumns: 2 | 3 | 4;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isWide = width >= WIDE_BREAKPOINT;

  return {
    width,
    height,
    isLandscape,
    isWide,
    contentWidthStyle: isWide
      ? { maxWidth: MAX_CONTENT_WIDTH, width: "100%" as const, alignSelf: "center" as const }
      : undefined,
    gridColumns: width >= 1100 ? 4 : width >= WIDE_BREAKPOINT ? 3 : 2,
  };
}

/** Percentage width for a grid item, matching {@link Responsive.gridColumns}. */
export function gridItemWidth(columns: 2 | 3 | 4): string {
  return columns === 4 ? "23%" : columns === 3 ? "31%" : "47%";
}
