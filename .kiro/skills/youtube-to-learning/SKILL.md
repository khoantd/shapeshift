---
name: "youtube-to-learning"
description: Turn a YouTube video into study-ready learning materials — a structured learning pack with key concepts, insights and takeaways, a glossary, timestamped notes, self-test questions, and spaced-repetition flashcards. Use this whenever a user shares a YouTube link (youtube.com, youtu.be, Shorts, live) and wants to learn from it, study it, understand it, extract the key points, make notes/summary/flashcards/a quiz/a study guide, or "teach me what's in this video." Also trigger for phrases like "turn this video into notes", "what are the key takeaways", "làm tài liệu học từ video này", "tóm tắt video để học", or pasting a video link with any learning intent — even if they don't say the word "skill". Prefer this over a plain summary — the goal is materials a learner can actually study and retain from, not a recap. Not for making your own video modeled on the link ("make a video like this", "turn this into a script") — that is the youtube-video-remix skill, not this one.
---

# YouTube → Learning Materials

Convert a YouTube video into materials a learner can **study and retain from** — not a passive recap. The value you add is instructional design: you organize the video's content around how people actually learn (active recall, chunking, elaboration, worked examples, retrieval cues back to the source).

Work in four phases: **Get the transcript → Understand & classify → Build the learning pack → Deliver.**

---

## Scope & routing

This skill produces **study materials from a video** — it is for *learning from, understanding, or revising* the content. If the user instead wants to **create their own video modeled on this one** — "make a video like this", "replicate this format", "clone the structure", "turn this into a script for my channel" — that is the **youtube-video-remix** skill; hand off to it.

Both skills can fire on a pasted YouTube link, so disambiguate by **intent**: *learn from it* → this skill; *make one like it* → remix. If the intent is genuinely unclear, ask one short question before building.

---

## Phase 1 — Get the transcript

You need the spoken content before you can build anything. There are three legitimate ways to get it; which one works depends on the environment, and **asking the user is a normal, fast route — not a failure.** On many cloud/server hosts YouTube blocks the fetch outright, so a quick script attempt that comes back `network_blocked` followed by asking the user is often the *expected* path, not a fallback of last resort. Pick the first route that fits the environment; don't burn turns and don't apologize for a blocked fetch.

**Route A — fetch script (fastest when the host can reach YouTube):**
```bash
pip install youtube-transcript-api --break-system-packages -q
python scripts/fetch_transcript.py "<url>" --out ./yt_work --lang en vi
```
Read the final stdout line — `STATUS: <ok|partial|failed> <reason>` — and branch on it:
- **`ok`** → you now have `yt_work/transcript.txt` (read this into context), `transcript_ts.txt` (for citing `[mm:ss]` timestamps), and `metadata.json` (title, author, duration, language). Continue to Phase 2.
- **`failed network_blocked`** (or **`partial`**) → YouTube is blocking this host's IP (common on cloud hosts — not your fault). `metadata.json` still holds the title if it was reachable. Move to Route B or C **without** re-running the script.
- **`failed no_transcript`** → the video has no captions. Go straight to Route C.

Add more `--lang` codes if you know the video's language.

**Route B — web tools (script blocked, but the session can browse):**
Use web_fetch / web_search on the video, or a browser tool if available, to recover the title and as much of the spoken content as you can. Clean captions beat a scraped page — if browsing only yields fragments, prefer Route C.

**Route C — ask the user (always available, and perfectly fine to use first in a blocked environment):**
Ask once, concisely, and proceed the moment they answer. Tell them: open the video → "⋯" → "Show transcript" → copy and paste. Also accept a transcript **file upload**, or a solid **description** of the video to caption-match against. Phrase it plainly, e.g. *"I can't pull this video's transcript from here — paste it (video → ⋯ → Show transcript) or upload it, and I'll build the full learning pack."* Don't frame this as a breakdown; it's one of three normal routes.

**Sanity check before Phase 2:** confirm you actually have enough real content (not just a title). If the transcript is auto-generated, expect noise — mentally correct obvious mis-transcriptions from context, and don't quote verbatim strings that are clearly garbled. **Never invent content you couldn't retrieve.**

---

## Phase 2 — Understand and classify

Read the whole transcript first. Then decide two things, because they change what good output looks like:

**A. Content type** (pick the closest; it sets emphasis):
- **Tutorial / how-to / coding** → steps, commands, code blocks, a "do this yourself" checklist; concepts are secondary to procedure.
- **Lecture / educational explainer** → concepts, definitions, mental models, cause-and-effect; a concept map helps.
- **Talk / keynote / interview / podcast** → arguments, claims, stories, the speaker's thesis and supporting evidence; capture nuance and disagreement.
- **Documentary / case study** → timeline, actors, what happened and why it matters.
- **Review / opinion / news** → claims vs. evidence, criteria used, verdict, and what's assertion vs. fact.

**B. Depth** — scale the pack to the material. A 6-minute Short becomes a tight one-pager; a 90-minute lecture becomes a full multi-module guide. Don't pad a thin video or crush a dense one.

Also note the **audience/level** if the user stated one ("explain for a beginner", "I already know React"); otherwise infer from the video and aim at a motivated learner new to the specifics.

---

## Phase 3 — Build the learning pack

Produce the sections below. **Include every section that has real substance; omit a section rather than padding it.** Order them as listed. The full writing spec, with per-section guidance and worked examples, is in `references/output-templates.md` — read it before writing so the output is consistent and genuinely study-grade.

1. **Header & orientation** — title, creator, duration, language; a 2–3 sentence TL;DR; "Who this is for" and "What you'll be able to do after" (concrete, outcome-based).
2. **Key concepts** — the 3–10 ideas worth remembering. Each: a short name, a plain-language explanation (your words, not transcript phrasing), why it matters, and a `[mm:ss]` timestamp to revisit the source. These are the backbone — get them right.
3. **Insights & takeaways** — the non-obvious points, the "so what", the things a skimmer would miss. Distinct from concepts: these are judgments, implications, and connections.
4. **Structured notes** — the video's actual content, reorganized by logical theme (never a raw timestamp dump). Use chunked subsections; keep worked examples, numbers, and names the speaker gave.
5. **Glossary** — key terms and jargon, each defined in one line. Skip if the video has none.
6. **Worked example / walkthrough** (tutorials) OR **Key arguments** (talks) — the procedure to reproduce, or the thesis-and-evidence structure. Choose by content type.
7. **Check your understanding** — 5–10 self-test questions spanning Bloom's levels (recall → apply → analyze), with an answer key below (collapsed from the questions so the learner can test first). This is the active-recall engine; don't skip it.
8. **Flashcards** — 8–20 atomic question/answer pairs for spaced repetition. One fact or idea each. Offer to export as an Anki-importable CSV (see Delivery).
9. **Apply it** — concrete next actions, a mini-exercise, or reflection prompts so the learning transfers.
10. **Go deeper** — what to learn next and (only if you can verify them) further resources; otherwise suggest search terms rather than inventing links.

**Quality bar:** explain in your own words (elaboration beats transcription), make questions test understanding not trivia, keep flashcards atomic, and anchor concepts to timestamps so the learner can always return to the source. Flag anything the speaker claims that is contested or likely outdated rather than presenting it as settled fact.

**Very long videos:** if the transcript is too large to hold at once, map-reduce it — extract candidate concepts and notes per chunk, then merge and de-duplicate into one coherent pack, keeping each item's timestamp. Never silently drop the back half of a long video; if a section had to be summarized thinly, say so. (See the depth-scaling guidance in `references/output-templates.md`.)

---

## Phase 4 — Deliver

- **Default:** one Markdown learning pack. In a chat surface create it as a single Markdown artifact/file the user can keep; in Claude Code/Cowork save it to the working dir and present it. If the environment has a dedicated doc output type, that's fine too.
- **Flashcards as CSV:** when the user wants spaced repetition or says "flashcards/Anki", also write `flashcards.csv` with two columns (front,back), no header, UTF-8 — directly importable into Anki/Quizlet.
- **Interactive quiz:** if (and only if) this session exposes a quiz tool, you may additionally render the "Check your understanding" questions through it. Don't make this the primary deliverable; the written pack is.
- Match the **language** of the video/user. If the video is Vietnamese, write the pack in Vietnamese (concepts, questions, and all) unless the user asks for another language. Bilingual on request.
- Keep your chat message short: deliver the pack, note what you produced, and offer the obvious next step (CSV export, deeper dive on one concept, a quiz) rather than explaining your process.

---

## Guardrails

- **Fidelity over fabrication.** Everything in the pack must trace to the video. If you couldn't get the full transcript, say what's partial and build from what you have — never fill gaps with plausible-sounding invented content.
- **No copyright dumps.** Teach from the content; don't reproduce long verbatim passages. Quotes stay short and attributed; paraphrase otherwise.
- **Respect the learner's time.** A tighter pack that covers the real substance beats a long one padded with filler. Depth scales with the video.

---

## Project wiring (Meanbox)

This monorepo productizes the skill on **`/youtube`**:

| Piece | Location |
|-------|----------|
| Page UI | `apps/web/src/components/youtube/YouTubePageClient.tsx` |
| Jev content types | `packages/core/src/jev/videoClassify*.ts` (`tutorial` / `lecture` / `talk` / `documentary` / `review` + residual) |
| Transcript (best-effort + paste) | `GET/POST /api/youtube/transcript` — cascade: Data API OAuth (owned videos) → timedtext scrape → paste |
| Learning pack (Perplexity) | `POST /api/youtube/learning-pack` — requires `PERPLEXITY_API_KEY` |
| Knowledge graph (Neo4j + neo4j-arc) | `POST/GET /api/youtube/knowledge-graph` — pack → `YtVideo`/`YtConcept`/`YtGlossaryTerm`/`YtInsight`; UI: `KnowledgeGraphPanel` + vendored `neo4j-arc`. Optional `NEO4J_*` env — offline local graph still works |
| OAuth setup (captions) | `/api/youtube/oauth/start` (dev) → set `YOUTUBE_OAUTH_*` in `.env` |
| Section templates | `references/output-templates.md` |

**Product flow:** select/search a video → Jev classifies content type → fetch or paste transcript → Generate learning pack (Markdown). On Vercel/cloud hosts, caption fetch often fails (`network_blocked` / no captions) — paste from YouTube’s “Show transcript” is the expected path, not a failure.

When working as an agent in this repo, prefer the product APIs above for in-app work; use this skill’s phases for chat-side study packs when the user pastes a link without using `/youtube`.
