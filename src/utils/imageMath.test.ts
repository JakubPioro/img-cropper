import { describe, expect, it } from "vitest";
import {
  clampCropRect,
  getCenteredCropRect,
  getOrientedTargetSize,
  getTargetRatioForSource,
} from "./imageMath";

describe("imageMath", () => {
  it("returns full image when ratio already matches", () => {
    const rect = getCenteredCropRect(1600, 1200, 4 / 3);
    expect(rect).toEqual({ x: 0, y: 0, width: 1600, height: 1200 });
  });

  it("creates centered crop for wider images", () => {
    const rect = getCenteredCropRect(2000, 1200, 4 / 3);
    expect(rect.height).toBe(1200);
    expect(rect.width).toBe(1600);
    expect(rect.x).toBe(200);
  });

  it("clamps crop inside image bounds", () => {
    const rect = clampCropRect(
      { x: -50, y: 30, width: 9999, height: 9999 },
      1200,
      800,
    );
    expect(rect).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
  });

  it("keeps configured size for landscape sources", () => {
    const target = getOrientedTargetSize(2000, 1200, 800, 600);
    expect(target).toEqual({ width: 800, height: 600 });
  });

  it("swaps configured size for portrait sources", () => {
    const target = getOrientedTargetSize(1200, 2000, 800, 600);
    expect(target).toEqual({ width: 600, height: 800 });
  });

  it("returns ratio aligned with source orientation", () => {
    const ratioLandscape = getTargetRatioForSource(2000, 1200, 800, 600);
    const ratioPortrait = getTargetRatioForSource(1200, 2000, 800, 600);

    expect(ratioLandscape).toBeCloseTo(4 / 3);
    expect(ratioPortrait).toBeCloseTo(3 / 4);
  });
});
