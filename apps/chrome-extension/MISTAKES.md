# Lessons from the Firefox add-on (do not regress)

This Chrome port starts from Meanbox Firefox **v1.3.7**. Keep these guards when changing behavior.

| Lesson | Guard |
|--------|--------|
| Deep dive aborted mid-run when `storage.onChanged` → `load()` bumped `loadId` | Sidebar-owned writes use `setPageContextLocal` + `suppressPageContextReload` so refresh/clip does not race `runDeepDive` |
| Related/promo widgets polluted article excerpt (often inside `<article>`) | `ARTICLE_NOISE_CLASS_RE` + clone/strip before `innerText`; keep regression fixtures in `lib/article.test.js` |
| Deep dive used weak heuristics only | On Deep dive, always `extract-active-article` with `force: true` + `buildForcedArticleContext` |
| `[hidden]` / chrome nodes leaked into extract | `ARTICLE_CHROME_SELECTOR` includes `[hidden]` and role/chrome tags |
| Learning-pack history needs session | `cookies` permission + `X-Meanbox-Cookie` bridge (fetch cannot set Cookie; SameSite blocks credentials from `chrome-extension://`) |
| Arbitrary news sites need host access | Optional `https://*/*` + Options → Grant host access |
| Popup/sidebar CTA clutter | Do not reintroduce duplicate launch-links removed in Firefox v1.2.1 |
| Chrome service worker idle kill | Do not rely on SW memory alone — re-read `chrome.storage.session` for page context; register listeners at top level; use `return true` + `sendResponse` for async messages |

See also [README.md](./README.md).
