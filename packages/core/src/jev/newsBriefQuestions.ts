import { choice, score } from "@typesafe-ai/sdk";

/**
 * Small Jev schema for news story briefing (not the full intent fan-out).
 * Evaluated against state: { text: title + excerpt, query?: filter topic }.
 */
export const newsBriefQuestions = {
  urgency: score("How urgent or time-sensitive this news story sounds", [
    "Not urgent at all",
    "Somewhat time-sensitive",
    "Urgent, needs attention immediately",
  ]),
  relevance: score(
    "How relevant this news story is to the user's topic filter in state.query (if query is empty, treat as moderately relevant)",
    [
      "Not relevant to the filter",
      "Somewhat related to the filter",
      "Highly relevant to the filter",
    ],
  ),
  tone: choice("The briefing tone of this news story", {
    neutral: "Plain and factual reporting",
    caution: "Warning, risk, crisis or concern",
    opportunity: "Positive development, breakthrough or upside",
  }),
};

export const NEWS_BRIEF_QUESTION_COUNT = Object.keys(newsBriefQuestions).length;
