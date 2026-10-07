import { choice, score } from "@typesafe-ai/sdk";

/**
 * Small Jev schema for suggesting a knowledge-graph edge type between two entities.
 * Evaluated against state: { text: entity pair + optional article snippets }.
 */
export const newsLinkSuggestQuestions = {
  linkType: choice(
    "How these two news entities should be linked in a personal knowledge graph",
    {
      RELATED_TO: "Generally related or co-mentioned without clear support or conflict",
      SUPPORTS: "One entity corroborates, enables, or reinforces the other",
      CONTRASTS_WITH: "The entities oppose, conflict, or present competing narratives",
    },
  ),
  confidence: score("How confident this link-type suggestion is from the given context", [
    "Low confidence, weak or missing evidence",
    "Moderate confidence, some supporting cues",
    "High confidence, clear relationship in the text",
  ]),
};

export const NEWS_LINK_SUGGEST_QUESTION_COUNT = Object.keys(newsLinkSuggestQuestions).length;
