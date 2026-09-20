// Answer feedback illustrations — correct, incorrect, time's up.
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";

type Props = { size?: number };

/** Green circle with checkmark — correct answer. */
export function CorrectAnswer({ size = 80 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="50" fill="#DCFCE7" />
      <Circle cx="60" cy="60" r="36" fill="#10B981" />
      <Path
        d="M42 60 L54 72 L80 46"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Red circle with X — incorrect answer. */
export function IncorrectAnswer({ size = 80 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="50" fill="#FEE2E2" />
      <Circle cx="60" cy="60" r="36" fill="#EF4444" />
      <Path
        d="M44 44 L76 76 M76 44 L44 76"
        stroke="#FFFFFF"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Yellow clock — time expired. */
export function TimeUp({ size = 80 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="50" fill="#FEF3C7" />
      <Circle cx="60" cy="60" r="36" fill="#F59E0B" />
      <Circle cx="60" cy="60" r="26" fill="#FFFFFF" />
      <Path
        d="M60 42 V62 L74 72"
        stroke="#F59E0B"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
