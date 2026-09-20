// Empty / error state illustrations.
import Svg, { Circle, Path, Rect } from "react-native-svg";

type Props = { size?: number };

/** Broken road — no internet / connection error. */
export function NoConnection({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size * (100 / 140)} viewBox="0 0 140 100">
      <Path d="M14 78 H52" stroke="#CBD5E1" strokeWidth="11" strokeLinecap="round" />
      <Path d="M88 78 H126" stroke="#CBD5E1" strokeWidth="11" strokeLinecap="round" />
      <Path d="M60 86 L70 60 L80 86 Z" fill="#F59E0B" />
      <Rect x="56" y="22" width="28" height="6" rx="3" fill="#E2E8F0" />
      <Rect x="48" y="36" width="44" height="6" rx="3" fill="#E2E8F0" />
    </Svg>
  );
}

/** Empty page — no history / no notes. */
export function EmptyList({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size * (100 / 140)} viewBox="0 0 140 100">
      <Rect x="42" y="12" width="56" height="76" rx="10" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="3" />
      <Rect x="54" y="32" width="32" height="6" rx="3" fill="#E2E8F0" />
      <Rect x="54" y="48" width="32" height="6" rx="3" fill="#E2E8F0" />
      <Rect x="54" y="64" width="20" height="6" rx="3" fill="#E2E8F0" />
    </Svg>
  );
}

/** Warning triangle — generic error. */
export function ErrorTriangle({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size * (100 / 140)} viewBox="0 0 140 100">
      <Path
        d="M70 14 L118 88 H22 Z"
        fill="#FEF3C7"
        stroke="#F59E0B"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <Rect x="65" y="42" width="10" height="24" rx="5" fill="#B45309" />
      <Circle cx="70" cy="76" r="6" fill="#B45309" />
    </Svg>
  );
}

/** Green trophy with checkmark — exam passed. */
export function ExamPassed({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size * (100 / 140)} viewBox="0 0 140 100">
      <Rect x="58" y="76" width="24" height="10" rx="4" fill="#CBD5E1" />
      <Rect x="64" y="60" width="12" height="18" fill="#CBD5E1" />
      <Path d="M44 14 H96 V44 A26 26 0 0 1 44 44 Z" fill="#10B981" />
      <Path
        d="M58 34 L67 43 L84 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="26" cy="26" r="5" fill="#F59E0B" />
      <Circle cx="114" cy="30" r="5" fill="#2563EB" />
      <Circle cx="34" cy="58" r="4" fill="#EF4444" />
    </Svg>
  );
}
