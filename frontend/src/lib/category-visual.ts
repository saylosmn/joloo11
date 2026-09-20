// Every category used to look identical in the list. Giving each one an icon
// and a hue turns 36 rows into something the eye can navigate by shape and
// colour instead of by reading every title.
//
// Matching is by keyword, not by index, so re-ordering or re-seeding the
// content does not shuffle the icons.

export type CategoryVisual = { icon: string; color: string };

/** Accent hues that hold up on both the light and the dark surface. */
const HUE = {
  blue: "#3B82F6",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  cyan: "#06B6D4",
  teal: "#14B8A6",
  green: "#22C55E",
  lime: "#84CC16",
  amber: "#F59E0B",
  orange: "#FB923C",
  rose: "#F43F5E",
  pink: "#EC4899",
  slate: "#64748B",
} as const;

const RULES: { match: string[]; icon: string; color: string }[] = [
  // Appendix 1 — road signs
  { match: ["анхааруулах тэмдэг"], icon: "warning", color: HUE.amber },
  { match: ["хориглох"], icon: "ban", color: HUE.rose },
  { match: ["дарааллын"], icon: "swap-horizontal", color: HUE.indigo },
  { match: ["заах тэмдэг"], icon: "arrow-forward-circle", color: HUE.blue },
  { match: ["мэдээлэх"], icon: "information-circle", color: HUE.cyan },
  { match: ["үйлчилгээний"], icon: "restaurant", color: HUE.teal },
  { match: ["нэмэлт тэмдэг"], icon: "add-circle", color: HUE.slate },
  { match: ["замын тэмдэглэл"], icon: "reorder-four", color: HUE.violet },
  { match: ["техникийн эвдрэл", "гэмтэл"], icon: "construct", color: HUE.rose },

  // Rules
  { match: ["нийтлэг үндэслэл", "нэр томьёо"], icon: "document-text", color: HUE.slate },
  { match: ["ангилал"], icon: "layers", color: HUE.indigo },
  { match: ["жолоочийн үүрэг"], icon: "person-circle", color: HUE.blue },
  { match: ["тусгай дуут", "гэрлэн дохио ажиллуулсан"], icon: "megaphone", color: HUE.rose },
  { match: ["явган зорчигч"], icon: "walk", color: HUE.teal },
  { match: ["зорчигчийн үүрэг"], icon: "people", color: HUE.cyan },
  { match: ["замын тэмдэг ба"], icon: "trail-sign", color: HUE.amber },
  { match: ["зохицуулах дохио"], icon: "hand-left", color: HUE.green },
  { match: ["таних тэмдэг"], icon: "alert-circle", color: HUE.amber },
  { match: ["чиг өөрчлөх", "хөдөлгөөн эхлэх"], icon: "arrow-redo", color: HUE.blue },
  { match: ["байрлан явах"], icon: "git-compare", color: HUE.indigo },
  { match: ["хурд"], icon: "speedometer", color: HUE.rose },
  { match: ["гүйцэж түрүүлэх", "зөрөх"], icon: "swap-horizontal", color: HUE.violet },
  { match: ["зогсох"], icon: "pause-circle", color: HUE.orange },
  { match: ["уулзвар"], icon: "navigate", color: HUE.blue },
  { match: ["явган хүний гарц"], icon: "footsteps", color: HUE.teal },
  { match: ["төмөр зам"], icon: "train", color: HUE.slate },
  { match: ["гэрэлтүүлэх"], icon: "flashlight", color: HUE.amber },
  { match: ["хороолл"], icon: "business", color: HUE.cyan },
  { match: ["тууш зам"], icon: "car-sport", color: HUE.blue },
  { match: ["дадлага"], icon: "school", color: HUE.green },
  { match: ["чирэх"], icon: "link", color: HUE.slate },
  { match: ["хүн тээвэрлэх"], icon: "people-circle", color: HUE.teal },
  { match: ["ачаа"], icon: "cube", color: HUE.orange },
  { match: ["унадаг дугуй", "мопед"], icon: "bicycle", color: HUE.green },
  { match: ["мал туух", "ердийн хөсөг"], icon: "paw", color: HUE.lime },
  { match: ["хуулийн этгээд"], icon: "shield-checkmark", color: HUE.slate },
];

const FALLBACK = [HUE.blue, HUE.indigo, HUE.teal, HUE.amber, HUE.violet, HUE.cyan, HUE.green, HUE.rose];

export function categoryVisual(name: string | undefined | null): CategoryVisual {
  const n = (name || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.match.some((m) => n.includes(m))) return { icon: rule.icon, color: rule.color };
  }
  // Stable fallback: same name always lands on the same hue.
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 997;
  return { icon: "reader", color: FALLBACK[h % FALLBACK.length] };
}

/** Strips the leading "12. " / "1-р хавсралт. " numbering for compact rows. */
export function categoryShortName(name: string): string {
  return name.replace(/^\s*\d+\.\s*/, "").trim();
}

/** The "1-р хавсралт" prefix, when the title carries one. */
export function categoryGroup(name: string): string | null {
  const m = name.match(/^(\d+-р хавсралт)\./);
  return m ? m[1] : null;
}
