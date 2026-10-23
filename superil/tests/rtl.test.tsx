import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { Price } from "@/components/Price";
import { directionFor, formatILS } from "@/lib/format";

describe("RTL and Hebrew formatting basics", () => {
  it("Hebrew locale is right-to-left", () => {
    expect(directionFor("he")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
  });
  it("formats shekel prices with ₪ and two decimals", () => {
    const s = formatILS(7.9);
    expect(s).toContain("₪");
    expect(s).toContain("7.90");
    expect(formatILS(1234.5)).toContain("1,234.50");
  });
  it("isolates numbers inside RTL text", () => {
    render(
      <div dir="rtl">
        מחיר: <Price value={12.5} />
      </div>,
    );
    const el = screen.getByText(/12\.50/);
    expect(el.className).toContain("num");
  });
  it("shows honest Hebrew data-status labels", () => {
    render(<FreshnessBadge status="sample" />);
    expect(screen.getByText("נתון לדוגמה")).toBeTruthy();
  });
});
