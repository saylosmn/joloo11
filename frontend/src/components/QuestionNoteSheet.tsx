// Per-question notes and tags. Opened from the practice/review headers, saved
// on the user's progress row so it follows the question everywhere it appears.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Text } from "@/src/components/AppText";
import { Sheet } from "@/src/components/Sheet";
import { PrimaryButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

export const QUESTION_TAGS: { key: string; label: string; icon: string }[] = [
  { key: "review", label: "Дахин давтах", icon: "repeat" },
  { key: "confusing", label: "Ойлгомжгүй", icon: "help-circle" },
  { key: "rule", label: "Дүрэм уншина", icon: "book" },
  { key: "mistake", label: "Байнга андуурдаг", icon: "alert-circle" },
];

export type QuestionMeta = {
  note?: string;
  tags?: string[];
  seenCount?: number;
  wrongCount?: number;
};

export function QuestionNoteSheet({
  visible,
  onClose,
  questionId,
  initial,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  questionId: string;
  initial?: QuestionMeta;
  onSaved?: (meta: { note: string; tags: string[] }) => void;
}) {
  // Callers pass key={questionId}, so switching questions remounts this and the
  // draft below starts from that question's saved note.
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [note, setNote] = useState(initial?.note ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);

  const save = useMutation({
    mutationFn: () => api.post(`/questions/${questionId}/note`, { note, tags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review", "bookmark"] });
      qc.invalidateQueries({ queryKey: ["question-history", questionId] });
      onSaved?.({ note, tags });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    },
  });

  const toggle = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    setTags((t) => (t.includes(key) ? t.filter((x) => x !== key) : [...t, key].slice(0, 4)));
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Тэмдэглэл" testID="note-sheet">
      <View style={{ gap: spacing.md }}>
        <View style={styles.tagRow}>
          {QUESTION_TAGS.map((t) => {
            const active = tags.includes(t.key);
            return (
              <Pressable
                key={t.key}
                onPress={() => toggle(t.key)}
                testID={`note-tag-${t.key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
                style={[styles.tag, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
              >
                <Ionicons
                  name={t.icon as any}
                  size={14}
                  color={active ? colors.onBrandPrimary : colors.muted}
                />
                <Text style={[styles.tagText, active && { color: colors.onBrandPrimary }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Юу санахаа бичээрэй (заавал биш)"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={400}
          style={styles.input}
          testID="note-input"
          accessibilityLabel="Тэмдэглэл бичих"
        />
        <Text style={styles.counter}>{note.length}/400</Text>

        <PrimaryButton
          title="Хадгалах"
          icon="checkmark"
          loading={save.isPending}
          onPress={() => save.mutate()}
          testID="note-save"
        />
      </View>
    </Sheet>
  );
}

/** Compact tag list shown under a question. */
export function QuestionTags({ tags, note }: { tags?: string[]; note?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if ((!tags || tags.length === 0) && !note) return null;
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      {tags && tags.length > 0 ? (
        <View style={styles.tagRow}>
          {tags.map((key) => {
            const t = QUESTION_TAGS.find((x) => x.key === key);
            if (!t) return null;
            return (
              <View key={key} style={[styles.tag, { backgroundColor: colors.brandTertiary, borderColor: colors.brandTertiary }]}>
                <Ionicons name={t.icon as any} size={13} color={colors.onBrandTertiary} />
                <Text style={[styles.tagText, { color: colors.onBrandTertiary }]}>{t.label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
      {note ? (
        <View style={styles.noteBox}>
          <Ionicons name="create-outline" size={14} color={colors.muted} />
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * "You have seen this 3 times, missed it twice" — shown once a question has a
 * history, so a repeated mistake is visible at the moment it repeats.
 */
export function QuestionHistory({
  seenCount = 0,
  wrongCount = 0,
  compact = false,
}: {
  seenCount?: number;
  wrongCount?: number;
  compact?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!seenCount) return null;

  const often = wrongCount >= 2;
  const tint = often ? colors.warning : colors.muted;

  return (
    <View style={[styles.historyRow, compact && { paddingVertical: 4 }]}>
      <Ionicons name={often ? "alert-circle" : "time-outline"} size={13} color={tint} />
      <Text style={[styles.historyText, { color: tint }]}>
        {seenCount} удаа үзсэн
        {wrongCount > 0 ? ` · ${wrongCount} удаа буруу` : " · алдаагүй"}
        {often ? " — байнга андуурдаг" : ""}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  historyRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  historyText: { fontSize: type.sm, fontFamily: font.medium },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  tagText: { color: colors.onSurfaceTertiary, fontSize: type.sm, fontFamily: font.bold },
  input: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    padding: spacing.md,
    color: colors.onSurface,
    fontSize: type.md,
    fontFamily: font.regular,
    textAlignVertical: "top",
  },
  counter: { color: colors.muted, fontSize: type.xs, fontFamily: font.medium, alignSelf: "flex-end", marginTop: -8 },
  noteBox: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  noteText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: type.base, lineHeight: 20, fontFamily: font.regular },
}));
