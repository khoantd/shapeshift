import { choice, noul, score } from "@typesafe-ai/sdk";

/**
 * Small Jev schema for YouTube video classification (not the full intent fan-out).
 * Content types align with youtube-to-learning skill Phase 2A, plus residual buckets.
 * Evaluated against state: { text: title + description, query?: search topic }.
 */
export const videoClassifyQuestions = {
  topic: choice("Which content type best fits this video based on its title and description", {
    tutorial: "How-to, DIY, coding walkthrough, recipe, or step-by-step practical demo",
    lecture: "Educational explainer, course lesson, academic lecture, or concept teaching",
    talk: "Keynote, interview, podcast, panel, or spoken thesis with stories/arguments",
    documentary: "Documentary, case study, narrative investigation of what happened and why",
    review: "Review, opinion, news commentary, critique, or claims-vs-evidence analysis",
    entertainment: "Comedy, vlog, reaction, variety, trailer, or general entertainment",
    music: "Song, music video, album, concert, or audio performance",
    other: "Does not clearly fit the categories above",
  }),
  needsModeration: noul(
    "The video title or description suggests content that likely violates policy and should be flagged for a moderator",
  ),
  urgency: score("How urgent or time-sensitive this video sounds", [
    "Not urgent at all",
    "Somewhat time-sensitive",
    "Urgent, needs attention immediately",
  ]),
  relevance: score(
    "How relevant this video is to the user's search query in state.query (if query is empty, treat as moderately relevant)",
    [
      "Not relevant to the filter",
      "Somewhat related to the filter",
      "Highly relevant to the filter",
    ],
  ),
  tone: choice("The briefing tone of this video based on title and description", {
    neutral: "Plain and factual presentation",
    caution: "Warning, risk, crisis or concern",
    opportunity: "Positive development, breakthrough or upside",
  }),
};

export const VIDEO_CLASSIFY_QUESTION_COUNT = Object.keys(videoClassifyQuestions).length;
