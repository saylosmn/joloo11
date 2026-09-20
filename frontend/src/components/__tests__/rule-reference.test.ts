import { ruleReferenceLabel } from "@/src/components/RuleReference";

describe("ruleReferenceLabel", () => {
  it("prefers an imported citation over the derived chapter", () => {
    expect(ruleReferenceLabel("8. Дохио", "ЗХД 4.2")).toBe("ЗХД 4.2");
  });

  it("derives the chapter from a numbered category", () => {
    expect(ruleReferenceLabel("15. Уулзвар нэвтрэх")).toBe("ЗХД 15-р бүлэг · Уулзвар нэвтрэх");
  });

  it("derives the appendix from an appendix category", () => {
    expect(ruleReferenceLabel("1-р хавсралт. Хориглох тэмдэг")).toBe(
      "ЗХД 1-р хавсралт · Хориглох тэмдэг",
    );
  });

  it("never invents a reference without a category", () => {
    expect(ruleReferenceLabel(undefined)).toBeNull();
    expect(ruleReferenceLabel(null, null)).toBeNull();
  });
});
