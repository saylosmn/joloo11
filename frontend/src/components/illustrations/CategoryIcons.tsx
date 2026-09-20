// Category-specific icons for the category list.
import Svg, { Circle, Path, Rect } from "react-native-svg";

type Props = { size?: number };

/** Warning triangle — road signs category. */
export function IconRoadSign({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Path
        d="M30 8 L54 50 H6 Z"
        fill="#FEE2E2"
        stroke="#EF4444"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <Rect x="26" y="22" width="8" height="14" rx="4" fill="#EF4444" />
      <Circle cx="30" cy="42" r="4" fill="#EF4444" />
    </Svg>
  );
}

/** Circular arrow — traffic / movement. */
export function IconTraffic({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx="30" cy="30" r="24" fill="#DBEAFE" />
      <Path
        d="M30 14 A16 16 0 1 1 14 30"
        fill="none"
        stroke="#2563EB"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Path d="M8 22 L14 30 L22 24" fill="#2563EB" />
    </Svg>
  );
}

/** Cross roads — intersections. */
export function IconIntersection({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Rect x="6" y="6" width="48" height="48" rx="8" fill="#DCFCE7" />
      <Path
        d="M30 10 V50 M10 30 H50"
        stroke="#10B981"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Car — vehicles category. */
export function IconVehicle({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Rect x="10" y="22" width="40" height="22" rx="6" fill="#2563EB" />
      <Path d="M16 22 L22 10 H38 L44 22" fill="#3B82F6" />
      <Circle cx="20" cy="44" r="7" fill="#1E293B" />
      <Circle cx="20" cy="44" r="3" fill="#94A3B8" />
      <Circle cx="40" cy="44" r="7" fill="#1E293B" />
      <Circle cx="40" cy="44" r="3" fill="#94A3B8" />
      <Rect x="16" y="28" width="10" height="6" rx="2" fill="#93C5FD" />
      <Rect x="34" y="28" width="10" height="6" rx="2" fill="#93C5FD" />
    </Svg>
  );
}

/** Red cross — first aid. */
export function IconFirstAid({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Rect x="6" y="6" width="48" height="48" rx="12" fill="#FEE2E2" />
      <Rect x="24" y="14" width="12" height="32" rx="3" fill="#EF4444" />
      <Rect x="14" y="24" width="32" height="12" rx="3" fill="#EF4444" />
    </Svg>
  );
}

/** Document — liability / rules. */
export function IconLiability({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Rect x="12" y="6" width="36" height="48" rx="6" fill="#EDE9FE" />
      <Rect x="20" y="16" width="20" height="4" rx="2" fill="#7C3AED" />
      <Rect x="20" y="26" width="20" height="4" rx="2" fill="#A78BFA" />
      <Rect x="20" y="36" width="14" height="4" rx="2" fill="#A78BFA" />
    </Svg>
  );
}
