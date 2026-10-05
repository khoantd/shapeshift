# Agent session

> Cross-tool handoff state for Cursor, Claude Code, and Kiro. Update at session end (`/handoff`) or phase changes; read at session start (`/resume`).

## Meta

| Field | Value |
|-------|-------|
| **Updated** | 2026-10-05 |
| **Phase** | build |
| **Tool** | cursor |

## Goal

YouTube learning packs: history with watch links + player restore; key-concept overlay; prod transcript cascade via TextFlow proxy.

## Done

- Shared top `SiteChrome` app bar + page offsets
- History records expose `videoUrl`; clicking history loads embed player + pack
- Key-concept video overlay: parse pack timestamps → YouTube IFrame API time poll → floating chip (seek on click)
- Prompt requires `**Revisit:** [mm:ss]` on key concepts when transcript is timestamped
- Overlay parser accepts range timestamps `[mm:ss–mm:ss]` (uses start)
- Learning pack history stores + restores `transcript` with each saved pack
- TextFlow `POST /api/videos/transcript/proxy` (service key auth, no JWT)
- Shapeshift `textflowTranscript.ts` + cascade step (after timedtext, before SerpAPI)
- Env docs: `TEXTFLOW_API_URL` / `TEXTFLOW_API_KEY` in root + `apps/web/.env.example`; TextFlow `TEXTFLOW_SERVICE_KEY` in litellm-aid-studio `env.example`
- FEATURES.md cascade includes TextFlow proxy

## Next

1. Set `TEXTFLOW_SERVICE_KEY` on TextFlow host and deploy TextFlow backend
2. Set `TEXTFLOW_API_URL=https://textflow.sutools.app` (+ matching `TEXTFLOW_API_KEY`) on Shapeshift Vercel (Production) and redeploy; ensure prod TextFlow exposes `POST /api/videos/transcript/proxy`
3. Verify prod transcript for a video that fails InnerTube on Vercel (e.g. Mark Richards)
4. Commit when ready

## Decisions

- Overlay only (not in-pack highlight); only when pack already has timestamped concepts
- Derive watch URL from `videoId` (no Convex schema change for URL)
- Range markers use start time for seek/active concept; end time ignored for now
- `transcript` optional on older history rows; new saves include it (max 100k)
- TextFlow proxy is service-to-service (shared secret), not user JWT — TextFlow must run on an IP YouTube allows

## Pointers

| Item | Location |
|------|----------|
| Concept parser | `apps/web/src/lib/youtube/learningPackConcepts.ts` |
| History Convex | `apps/web/convex/youtubeLearningPacks.ts` |
| Player | `apps/web/src/components/youtube/YouTubePlayer.tsx` |
| Overlay | `apps/web/src/components/youtube/ConceptOverlay.tsx` |
| Page wiring | `apps/web/src/components/youtube/YouTubePageClient.tsx` |
| TextFlow proxy | `litellm-aid-studio/backend/src/routes/videos.ts` (`POST /transcript/proxy`) |
| Shapeshift client | `apps/web/src/lib/youtube/textflowTranscript.ts` |
| Cascade | `apps/web/src/lib/youtube/transcript.ts` |
