// Onboarding slide illustrations — one per slide.
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";

type Props = { size?: number };

/** Slide 1: book + road signs — "Бүлэг бүрээр эмхэлсэн". */
export function OnboardingCategories({ size = 200 }: Props) {
  const h = size * (160 / 200);
  return (
    <Svg width={size} height={h} viewBox="0 0 200 160">
      <Rect x="24" y="30" width="64" height="82" rx="8" fill="#2563EB" />
      <Rect x="30" y="36" width="52" height="70" rx="5" fill="#FFFFFF" />
      <Rect x="38" y="48" width="36" height="5" rx="2.5" fill="#BFDBFE" />
      <Rect x="38" y="58" width="28" height="5" rx="2.5" fill="#BFDBFE" />
      <Rect x="38" y="68" width="36" height="5" rx="2.5" fill="#BFDBFE" />
      <Rect x="38" y="78" width="20" height="5" rx="2.5" fill="#BFDBFE" />
      <Circle cx="136" cy="48" r="30" fill="#DBEAFE" />
      <Path d="M120 48 L136 36 L152 48 L136 60 Z" fill="#EF4444" stroke="#FFFFFF" strokeWidth="3" />
      <Circle cx="162" cy="100" r="22" fill="#FEF3C7" />
      <Path d="M162 82 L162 106" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
      <Path d="M150 94 L174 94" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
    </Svg>
  );
}

/** Slide 2: timer + exam sheet — "Жинхэнэ шалгалтын горим". */
export function OnboardingExam({ size = 200 }: Props) {
  const h = size * (160 / 200);
  return (
    <Svg width={size} height={h} viewBox="0 0 200 160">
      <Rect x="60" y="36" width="80" height="96" rx="10" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="3" />
      <Circle cx="100" cy="60" r="14" fill="#10B981" />
      <SvgText x="100" y="65" textAnchor="middle" fontFamily="System" fontSize="14" fontWeight="700" fill="#FFFFFF">
        A
      </SvgText>
      <Circle cx="82" cy="88" r="8" fill="#DBEAFE" />
      <Circle cx="100" cy="88" r="8" fill="#DBEAFE" />
      <Circle cx="118" cy="88" r="8" fill="#10B981" />
      <Circle cx="82" cy="108" r="8" fill="#DBEAFE" />
      <Circle cx="100" cy="108" r="8" fill="#FEE2E2" />
      <Circle cx="118" cy="108" r="8" fill="#DBEAFE" />
      {/* Timer arc */}
      <Path d="M30 42 A30 30 0 1 1 30 41.99" fill="none" stroke="#E2E8F0" strokeWidth="8" />
      <Path d="M30 42 A30 30 0 0 1 56 58" fill="none" stroke="#2563EB" strokeWidth="8" strokeLinecap="round" />
      <SvgText x="30" y="78" textAnchor="middle" fontFamily="System" fontSize="13" fontWeight="500" fill="#2563EB">
        25м
      </SvgText>
    </Svg>
  );
}

/** Slide 3: rising chart + fire — "Алдаагаа давт, ахицаа хар". */
export function OnboardingProgress({ size = 200 }: Props) {
  const h = size * (160 / 200);
  return (
    <Svg width={size} height={h} viewBox="0 0 200 160">
      <Rect x="24" y="24" width="152" height="108" rx="10" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="3" />
      <Path
        d="M44 110 L72 90 L100 96 L128 62 L156 48"
        fill="none"
        stroke="#2563EB"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="156" cy="48" r="7" fill="#2563EB" />
      <Circle cx="156" cy="48" r="12" fill="#2563EB" opacity="0.15" />
      {/* Fire icon */}
      <Path
        d="M40 42 L56 58 L50 58 L56 72 L48 72 L56 88 L34 68 L42 68 L34 54 L42 54 Z"
        fill="#F59E0B"
      />
    </Svg>
  );
}
