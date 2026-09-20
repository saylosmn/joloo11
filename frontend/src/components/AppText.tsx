// The app's Text.
//
// This replaces the old `Text.defaultProps` mutation in app/_layout.tsx: that
// API is deprecated in React Native and silently stops working, which would
// have dropped the Cyrillic font and the font-scaling cap across the whole app
// in some future upgrade. Screens import Text from here instead of react-native.
import { forwardRef } from "react";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";

import { font } from "@/src/theme";

/**
 * System font scaling is honoured up to this multiplier. Past roughly 1.3x the
 * question and answer layouts start to clip, so it is capped rather than
 * disabled — large-text users still get noticeably bigger type.
 */
export const MAX_FONT_SCALE = 1.3;

const baseStyle: TextStyle = { fontFamily: font.regular };

export const Text = forwardRef<RNText, TextProps>(function Text(
  { style, allowFontScaling = true, maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest },
  ref,
) {
  return (
    <RNText
      ref={ref}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[baseStyle, style]}
      {...rest}
    />
  );
});

export type { TextProps };
