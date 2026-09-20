// Where a question comes from in the rule book.
//
// The source spreadsheet has no clause numbers, so nothing here is invented: a
// precise citation is shown only when an admin has imported one (`ruleRef`),
// otherwise the chapter is derived from the category title, which is itself
// taken from the rules ("8. Замын хөдөлгөөн зохицуулах дохио").
import Ionicons from "@react-native-vector-icons/ionicons";
import { View } from "react-native";

import { Text } from "@/src/components/AppText";
import { font, radius, spacing, type, useTheme } from "@/src/theme";

/** "8. Уулзвар нэвтрэх" → "ЗХД 8-р бүлэг · Уулзвар нэвтрэх" */
export function ruleReferenceLabel(categoryName?: string | null, ruleRef?: string | null): string | null {
  if (ruleRef) return ruleRef;
  if (!categoryName) return null;

  const appendix = categoryName.match(/^(\d+)-р хавсралт\.\s*(.+)$/);
  if (appendix) return `ЗХД ${appendix[1]}-р хавсралт · ${appendix[2].trim()}`;

  const chapter = categoryName.match(/^(\d+)\.\s*(.+)$/);
  if (chapter) return `ЗХД ${chapter[1]}-р бүлэг · ${chapter[2].trim()}`;

  return `ЗХД · ${categoryName}`;
}

export function RuleReference({
  categoryName,
  ruleRef,
}: {
  categoryName?: string | null;
  ruleRef?: string | null;
}) {
  const { colors } = useTheme();
  const label = ruleReferenceLabel(categoryName, ruleRef);
  if (!label) return null;

  return (
    <View
      accessible
      accessibilityLabel={`Эх сурвалж: ${label}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceTertiary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name="book-outline" size={13} color={colors.muted} />
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: type.sm, fontFamily: font.semibold }}>
        {label}
      </Text>
    </View>
  );
}
