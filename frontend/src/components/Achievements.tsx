// Level, XP and badges. The numbers come from /achievements, which derives
// everything from answers already recorded — nothing here is a separate score
// the user has to maintain.
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

import { Text } from "@/src/components/AppText";
import { ProgressBar } from "@/src/components/ui";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

export type Badge = {
  key: string;
  label: string;
  description: string;
  icon: string;
  value: number;
  goal: number;
  earned: boolean;
};

export type Achievements = {
  xp: number;
  level: number;
  levelFloor: number;
  nextLevelXp: number | null;
  bestStreak: number;
  mastered: number;
  examsPassed: number;
  badges: Badge[];
  freeze?: { available: boolean; canRestore: boolean; missedDate: string | null; cooldownDays: number };
};

export function LevelCard({ data }: { data: Achievements }) {
  const styles = useStyles();
  const { colors } = useTheme();

  const span = data.nextLevelXp ? data.nextLevelXp - data.levelFloor : 1;
  const into = data.xp - data.levelFloor;
  const pct = data.nextLevelXp ? Math.min(100, Math.round((into / Math.max(1, span)) * 100)) : 100;
  const earned = data.badges.filter((b) => b.earned).length;

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.levelCard}
    >
      <View style={styles.levelTop}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelNumber}>{data.level}</Text>
          <Text style={styles.levelWord}>түвшин</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.xpValue}>{data.xp.toLocaleString("en-US")} XP</Text>
          <ProgressBar percent={pct} height={8} shimmer={false} />
          <Text style={styles.xpHint}>
            {data.nextLevelXp
              ? `Дараагийн түвшин хүртэл ${(data.nextLevelXp - data.xp).toLocaleString("en-US")} XP`
              : "Хамгийн дээд түвшин!"}
          </Text>
        </View>
      </View>

      <View style={styles.levelStats}>
        <LevelStat icon="flame" label="Хамгийн урт streak" value={`${data.bestStreak} өдөр`} />
        <LevelStat icon="school" label="Эзэмшсэн бүлэг" value={`${data.mastered}`} />
        <LevelStat icon="medal" label="Тэмдэг" value={`${earned}/${data.badges.length}`} />
      </View>
    </LinearGradient>
  );
}

function LevelStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.levelStat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon as any} size={15} color="rgba(255,255,255,0.9)" />
      <Text style={styles.levelStatValue}>{value}</Text>
      <Text style={styles.levelStatLabel}>{label}</Text>
    </View>
  );
}

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {badges.map((b) => (
        <View
          key={b.key}
          style={[styles.badge, b.earned && { borderColor: colors.warning, backgroundColor: colors.warningSubtle }]}
          accessible
          accessibilityLabel={`${b.label}. ${b.description}. ${b.earned ? "Авсан" : `${b.value} / ${b.goal}`}`}
          testID={`badge-${b.key}`}
        >
          <View
            style={[
              styles.badgeIcon,
              { backgroundColor: b.earned ? colors.warning : colors.surfaceTertiary },
            ]}
          >
            <Ionicons
              name={(b.earned ? b.icon : "lock-closed") as any}
              size={18}
              color={b.earned ? "#FFFFFF" : colors.muted}
            />
          </View>
          <Text style={[styles.badgeLabel, !b.earned && { color: colors.muted }]} numberOfLines={1}>
            {b.label}
          </Text>
          <Text style={styles.badgeDesc} numberOfLines={2}>
            {b.earned ? b.description : `${b.value}/${b.goal}`}
          </Text>
          {!b.earned ? (
            <ProgressBar percent={(b.value / Math.max(1, b.goal)) * 100} height={4} shimmer={false} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  levelCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg },
  levelTop: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  levelBadge: {
    width: 74,
    height: 74,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  levelNumber: { color: "#FFFFFF", fontSize: type.title, fontFamily: font.extrabold },
  levelWord: { color: "rgba(255,255,255,0.8)", fontSize: type.xs, fontFamily: font.medium, marginTop: -4 },
  xpValue: { color: "#FFFFFF", fontSize: type.xl, fontFamily: font.extrabold },
  xpHint: { color: "rgba(255,255,255,0.8)", fontSize: type.sm, fontFamily: font.regular },
  levelStats: { flexDirection: "row", gap: spacing.sm },
  levelStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  levelStatValue: { color: "#FFFFFF", fontSize: type.md, fontFamily: font.bold },
  levelStatLabel: { color: "rgba(255,255,255,0.75)", fontSize: type.xs, fontFamily: font.regular, textAlign: "center" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  badge: {
    width: "47%",
    flexGrow: 1,
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elev1,
  },
  badgeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  badgeLabel: { color: colors.onSurface, fontSize: type.base, fontFamily: font.bold },
  badgeDesc: { color: colors.muted, fontSize: type.xs, fontFamily: font.regular, lineHeight: 15 },
}));
