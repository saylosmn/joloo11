// Achievement badge illustrations.
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";

type Props = { size?: number };

/** Green medal — first exam pass. */
export function BadgeFirstPass({ size = 60 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="34" r="26" fill="#10B981" />
      <Circle cx="40" cy="34" r="19" fill="#DCFCE7" />
      <Path
        d="M32 34 L38 40 L50 28"
        fill="none"
        stroke="#10B981"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M30 56 L40 68 L50 56" fill="#10B981" />
    </Svg>
  );
}

/** Fire badge — streak milestone. */
export function BadgeStreak({ size = 60, days = 7 }: Props & { days?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="38" r="26" fill="#FEF3C7" />
      <Path
        d="M40 16 C40 16 28 34 28 44 A12 12 0 0 0 52 44 C52 34 40 16 40 16 Z"
        fill="#F59E0B"
      />
      <Path
        d="M40 30 C40 30 34 40 34 46 A6 6 0 0 0 46 46 C46 40 40 30 40 30 Z"
        fill="#FDE68A"
      />
      <SvgText
        x="40"
        y="72"
        textAnchor="middle"
        fontFamily="System"
        fontSize="12"
        fontWeight="700"
        fill="#F59E0B"
      >
        {days}
      </SvgText>
    </Svg>
  );
}

/** Star badge — category mastered. */
export function BadgeMaster({ size = 60 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="36" r="26" fill="#DBEAFE" />
      <Path
        d="M40 14 L44 28 L58 28 L46 36 L50 50 L40 42 L30 50 L34 36 L22 28 L36 28 Z"
        fill="#2563EB"
      />
      <SvgText
        x="40"
        y="72"
        textAnchor="middle"
        fontFamily="System"
        fontSize="10"
        fill="#2563EB"
      >
        Мастер
      </SvgText>
    </Svg>
  );
}

/** Lightning badge — fast answers. */
export function BadgeFast({ size = 60 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="36" r="26" fill="#EDE9FE" />
      <Path d="M44 14 L30 40 H40 L36 58 L54 30 H42 Z" fill="#7C3AED" />
      <SvgText
        x="40"
        y="72"
        textAnchor="middle"
        fontFamily="System"
        fontSize="10"
        fill="#7C3AED"
      >
        Хурдан
      </SvgText>
    </Svg>
  );
}

/** Gold trophy badge — perfect score. */
export function BadgePerfect({ size = 60 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="36" r="26" fill="#FEF3C7" />
      <Rect x="30" y="54" width="20" height="6" rx="3" fill="#D97706" />
      <Rect x="34" y="44" width="12" height="12" fill="#D97706" />
      <Path d="M24 20 H56 V36 A16 16 0 0 1 24 36 Z" fill="#F59E0B" />
      <Path
        d="M34 28 L38 34 L44 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SvgText
        x="40"
        y="72"
        textAnchor="middle"
        fontFamily="System"
        fontSize="10"
        fill="#D97706"
      >
        Төгс
      </SvgText>
    </Svg>
  );
}
