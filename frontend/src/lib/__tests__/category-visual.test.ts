import {
  categoryGroup,
  categoryShortName,
  categoryVisual,
} from "@/src/lib/category-visual";

describe("categoryVisual", () => {
  it("matches a chapter by keyword, not by position", () => {
    const speed = categoryVisual("12. Тээврийн хэрэгслийн хурд");
    expect(speed.icon).toBe("speedometer");
    // The same chapter with different numbering still resolves the same way.
    expect(categoryVisual("40. Тээврийн хэрэгслийн хурд")).toEqual(speed);
  });

  it("separates the sign appendices from each other", () => {
    expect(categoryVisual("1-р хавсралт. Хориглох тэмдэг").icon).toBe("ban");
    expect(categoryVisual("1-р хавсралт. Анхааруулах тэмдэг").icon).toBe("warning");
    expect(categoryVisual("1-р хавсралт. Мэдээлэх тэмдэг").icon).toBe("information-circle");
  });

  it("falls back deterministically for unknown names", () => {
    const a = categoryVisual("Огт танихгүй бүлэг");
    const b = categoryVisual("Огт танихгүй бүлэг");
    expect(a).toEqual(b);
    expect(a.icon).toBe("reader");
  });

  it("handles a missing name", () => {
    expect(categoryVisual(undefined).color).toBeTruthy();
    expect(categoryVisual(null).icon).toBe("reader");
  });
});

describe("categoryShortName", () => {
  it("strips the leading chapter number", () => {
    expect(categoryShortName("15. Уулзвар нэвтрэх")).toBe("Уулзвар нэвтрэх");
  });

  it("leaves appendix titles alone", () => {
    expect(categoryShortName("1-р хавсралт. Заах тэмдэг")).toBe("1-р хавсралт. Заах тэмдэг");
  });
});

describe("categoryGroup", () => {
  it("returns the appendix prefix when there is one", () => {
    expect(categoryGroup("2-р хавсралт. Замын тэмдэглэл")).toBe("2-р хавсралт");
    expect(categoryGroup("8. Замын хөдөлгөөн зохицуулах дохио")).toBeNull();
  });
});
