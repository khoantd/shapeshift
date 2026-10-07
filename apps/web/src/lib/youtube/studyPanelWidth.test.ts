import { describe, expect, it } from "vitest";
import {
  STUDY_PANEL_DEFAULT_WIDTH,
  STUDY_PANEL_MIN_WIDTH,
  clampStudyPanelWidth,
  studyPanelMaxWidth,
} from "./studyPanelWidth";

describe("studyPanelMaxWidth", () => {
  it("caps at 720 and floors half the viewport", () => {
    expect(studyPanelMaxWidth(2000)).toBe(720);
    expect(studyPanelMaxWidth(800)).toBe(400);
  });

  it("never goes below the minimum", () => {
    expect(studyPanelMaxWidth(100)).toBe(STUDY_PANEL_MIN_WIDTH);
  });
});

describe("clampStudyPanelWidth", () => {
  it("clamps to min and max", () => {
    expect(clampStudyPanelWidth(100, 500)).toBe(STUDY_PANEL_MIN_WIDTH);
    expect(clampStudyPanelWidth(900, 500)).toBe(500);
    expect(clampStudyPanelWidth(420.7, 500)).toBe(421);
  });

  it("falls back for non-finite input", () => {
    expect(clampStudyPanelWidth(Number.NaN, 500)).toBe(STUDY_PANEL_DEFAULT_WIDTH);
  });
});
