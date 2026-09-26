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
  NEWS_BRIEF_TONES,
} from "./jev/newsBrief";
export { NEWS_BRIEF_QUESTION_COUNT } from "./jev/newsBriefQuestions";

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
