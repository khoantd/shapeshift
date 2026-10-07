/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as githubFavorites from "../githubFavorites.js";
import type * as newsKnowledgeArticles from "../newsKnowledgeArticles.js";
import type * as newsKnowledgeLinks from "../newsKnowledgeLinks.js";
import type * as placeContacts from "../placeContacts.js";
import type * as placePins from "../placePins.js";
import type * as placesCache from "../placesCache.js";
import type * as waitlist from "../waitlist.js";
import type * as youtubeLearningPacks from "../youtubeLearningPacks.js";
import type * as youtubeTranscriptSummaries from "../youtubeTranscriptSummaries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  githubFavorites: typeof githubFavorites;
  newsKnowledgeArticles: typeof newsKnowledgeArticles;
  newsKnowledgeLinks: typeof newsKnowledgeLinks;
  placeContacts: typeof placeContacts;
  placePins: typeof placePins;
  placesCache: typeof placesCache;
  waitlist: typeof waitlist;
  youtubeLearningPacks: typeof youtubeLearningPacks;
  youtubeTranscriptSummaries: typeof youtubeTranscriptSummaries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
