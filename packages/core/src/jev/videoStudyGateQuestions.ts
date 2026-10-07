import { choice, noul } from "@typesafe-ai/sdk";

/**
 * Small Jev schema for study-pack depth / audience before Perplexity generation.
 * Evaluated against state: { text: title + description + optional topic }.
 */
export const videoStudyGateQuestions = {
  depth: choice("How deep should a learning pack be for this video", {
    short: "Brief video or Short — tight one-pager, few sections",
    standard: "Typical length — full multi-section study pack",
    deep: "Long or dense material — multi-module, thorough coverage",
  }),
  audience: choice("Who this video is aimed at", {
    beginner: "New to the topic; needs definitions and gentle pacing",
    intermediate: "Some background; can handle standard jargon",
    advanced: "Experienced learners; dense or specialist material",
  }),
  packSuitable: noul(
    "This video is suitable for generating a study learning pack (educational or analytical content, not pure entertainment or music)",
  ),
};

export const VIDEO_STUDY_GATE_QUESTION_COUNT = Object.keys(videoStudyGateQuestions).length;
