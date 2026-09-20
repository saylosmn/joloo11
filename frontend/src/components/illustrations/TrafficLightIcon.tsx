// App icon / logo as SVG — the traffic light design.
import Svg, { Circle, Rect } from "react-native-svg";

type Props = { size?: number };

/** The primary app icon — traffic light on deep blue. */
export function TrafficLightIcon({ size = 80 }: Props) {
  const s = size / 120; // scale factor relative to 120×120 viewBox
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect width="120" height="120" rx="27" fill="#1D4ED8" />
      <Rect x="37" y="18" width="46" height="84" rx="16" fill="#0F172A" />
      <Circle cx="60" cy="38" r="11" fill="#EF4444" />
      <Circle cx="60" cy="60" r="11" fill="#F59E0B" />
      <Circle cx="60" cy="82" r="11" fill="#10B981" />
    </Svg>
  );
}

export default TrafficLightIcon;
