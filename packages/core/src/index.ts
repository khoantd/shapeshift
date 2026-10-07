/** Public API for @shapeshift/core — framework-agnostic intent engine. */

export {
  INTENT_KEYS,
  TONES,
  EVENT_MODES,
  TRANSPORTS,
  TRIP_TYPES,
  EXPENSE_CATEGORIES,
  COLOR_MOODS,
  TIMER_KINDS,
  DOC_CATEGORIES,
  ROUTE_DECISIONS,
  TOOL_APPROVALS,
  intentRequestSchema,
  intentResultSchema,
  noneResult,
  type IntentKey,
  type CardIntent,
  type IntentResult,
  type Answer,
  type Tone,
  type EventMode,
  type Transport,
  type TripType,
  type ExpenseCategory,
  type ColorMood,
  type TimerKind,
  type DocCategory,
  type RouteDecision,
  type ToolApproval,
} from "./jev/types";

export { questions, QUESTION_COUNT } from "./jev/questions";
export { mockClassify, mockClassifyAsync, MOCK_QUESTION_COUNT } from "./jev/mock";
export {
  mockBriefNewsStory,
  composeNewsBriefLine,
  newsBriefRequestSchema,
  type NewsBriefResult,
  type NewsBriefRequest,
  type NewsBriefTone,
  type NewsBriefLanguage,
  NEWS_BRIEF_TONES,
  NEWS_BRIEF_LANGUAGES,
  NEWS_TRIAGE_THRESHOLD,
} from "./jev/newsBrief";
export { NEWS_BRIEF_QUESTION_COUNT } from "./jev/newsBriefQuestions";

export {
  mockSuggestNewsLink,
  composeNewsLinkSuggestLine,
  newsLinkSuggestRequestSchema,
  newsLinkTextForSuggest,
  type NewsLinkSuggestResult,
  type NewsLinkSuggestRequest,
  type NewsLinkType,
  NEWS_LINK_TYPES,
} from "./jev/newsLinkSuggest";
export { NEWS_LINK_SUGGEST_QUESTION_COUNT } from "./jev/newsLinkSuggestQuestions";

export {
  mockVideoStudyGate,
  composeVideoStudyGateLine,
  videoStudyGateRequestSchema,
  videoTextForStudyGate,
  type VideoStudyGateResult,
  type VideoStudyGateRequest,
  type VideoStudyDepth,
  type VideoStudyAudience,
  VIDEO_STUDY_DEPTHS,
  VIDEO_STUDY_AUDIENCES,
} from "./jev/videoStudyGate";
export { VIDEO_STUDY_GATE_QUESTION_COUNT } from "./jev/videoStudyGateQuestions";

export {
  decide,
  force,
  promote,
  initialMemory,
  activeIntent,
  rawState,
  changedSubstantially,
  THRESHOLDS,
  type UiState,
  type DecideMemory,
} from "./decide";

export { gateSignals, neutralGated, type GatedSignals } from "./signals";
export { LRU, normalizeKey } from "./lru";
export { hexToOklch, oklchToHex, rgbToHex, shades, withLightness } from "./color";

export { parseFor, parsers, completenessFor, type ParsedMap } from "./parse";
