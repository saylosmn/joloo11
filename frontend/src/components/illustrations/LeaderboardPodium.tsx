// Leaderboard podium illustration.
import Svg, { Circle, Rect, Text as SvgText } from "react-native-svg";

type Props = { size?: number };

export function LeaderboardPodium({ size = 200 }: Props) {
  const h = size * (160 / 240);
  return (
    <Svg width={size} height={h} viewBox="0 0 240 160">
      {/* Podium blocks */}
      <Rect x="52" y="80" width="40" height="56" rx="6" fill="#CBD5E1" />
      <Rect x="100" y="56" width="40" height="80" rx="6" fill="#F59E0B" />
      <Rect x="148" y="92" width="40" height="44" rx="6" fill="#CBD5E1" />
      {/* Avatars */}
      <Circle cx="72" cy="66" r="16" fill="#DBEAFE" />
      <SvgText x="72" y="70" textAnchor="middle" fontFamily="System" fontSize="12" fontWeight="700" fill="#2563EB">
        2
      </SvgText>
      <Circle cx="120" cy="40" r="18" fill="#FEF3C7" />
      <SvgText x="120" y="46" textAnchor="middle" fontFamily="System" fontSize="16" fontWeight="700" fill="#D97706">
        1
      </SvgText>
      <Circle cx="168" cy="78" r="14" fill="#DBEAFE" />
      <SvgText x="168" y="82" textAnchor="middle" fontFamily="System" fontSize="11" fontWeight="700" fill="#2563EB">
        3
      </SvgText>
      <SvgText x="120" y="152" textAnchor="middle" fontFamily="System" fontSize="12" fill="#64748B">
        Шилдэг 3
      </SvgText>
    </Svg>
  );
}

export default LeaderboardPodium;
