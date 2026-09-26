export { Shapeshift, type ShapeshiftProps } from "./shapeshift/Shapeshift";
export { useIntent, createFetchClassify, type ClassifyFn, type UseIntentOptions, type IntentState, type IntentStatus } from "./hooks/useIntent";
export { useDemoScript, DEMO_SCRIPT, type DemoApi } from "./hooks/useDemoScript";
export { registry, CARD_INTENTS } from "./intents/registry";
export { NewsFeedItemCard, type NewsFeedItem } from "./intents/NewsFeedItemCard";
export { NewsDetailCard } from "./intents/NewsDetailCard";
export { NewsReaderPane, type NewsBriefView, type NewsDeepDiveView, type NewsDeepDiveSource } from "./intents/NewsReaderPane";
export { MarkdownBody } from "./intents/MarkdownBody";
export { NewsSourcePalette, type NewsSourceOption } from "./shapeshift/NewsSourcePalette";
export { NewsIntentConfirm } from "./shapeshift/NewsIntentConfirm";
export { highlightNewsText, collectNewsHighlightTerms, extractNewsHighlightSnippets, NEWS_CRITICAL_TERMS } from "./lib/highlightNewsText";
export { newsFeedHref } from "./intents/NewsCard";
export { DraftContext } from "./intents/shared";
export {
  savedItems,
  newId,
  savedItemSchema,
  localStorageAdapter,
  memoryStorage,
  type SavedItem,
  type StorageAdapter,
} from "./lib/savedItems";
export { notify } from "./lib/notify";
export { cn } from "./lib/utils";
export { Toaster } from "./ui/sonner";
export { TooltipProvider } from "./ui/tooltip";
