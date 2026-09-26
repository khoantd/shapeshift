# Shapeshift

**An input that becomes what you mean.** One text box that morphs into the right UI as you type — an event card, a checklist, a timer, a color picker, a bill splitter, a poll, a converter and more.

<p align="center">
  <img src="docs/demo.gif" alt="Typing 'dinner with priya friday 8pm on zoom' morphs the text box into an event card, then a shopping checklist" width="820">
  <br>
  <sub><a href="https://shapeshiftui.vercel.app"><b>Join the waitlist</b></a> · <a href="https://shapeshiftui.vercel.app/demo"><b>Try the demo</b></a> · <a href="docs/demo.mp4">Watch the full 60-second demo (1080p60)</a></sub>
</p>

```
dinner with priya friday 8pm on zoom   →  Event card · Friday · 8 PM · Priya · Video call
buy milk, eggs, bread and coffee       →  Shopping checklist
split 2400 between 3                   →  ₹800 each
minecraft diamond                      →  #4AEDD9
```

Intent is classified by [TypeSafe AI](https://typesafe.ai)'s **Jev** model: one call answers 14 typed questions in parallel (which card, plus signals like "is it a video call?", "is it urgent?"). Everything else — dates, amounts, units, math — is deterministic code. **Jev decides, code computes.**

<p align="center"><img src="docs/diagrams/jev-fanout.svg" alt="One Jev call answers 14 questions in parallel; a deterministic parser reads the same text for values" width="820"></p>

It works **fully offline by default** with a built-in keyword classifier, so you can run it without an account.

## Quick start

Requires [Bun](https://bun.sh) 1.2+.

```bash
bun install
bun dev
```

Open http://localhost:3000 for the waitlist landing, or http://localhost:3000/demo to start typing. Press <kbd>/</kbd> to see every card type.

### Waitlist (Convex)

The landing page at `/` stores emails via [Convex](https://convex.dev). From `apps/web`:

```bash
bunx convex dev
# paste NEXT_PUBLIC_CONVEX_URL into apps/web/.env.local
```

Without Convex configured, the form still renders and shows a clear error on submit.

This repo is a **Bun monorepo**:

| Path | Package | Role |
| --- | --- | --- |
| `apps/web` | `@shapeshift/web` | Next.js demo host |
| `packages/core` | `@shapeshift/core` | Intent engine (decide, signals, parsers, Jev types/mock) |
| `packages/react` | `@shapeshift/react` | Drop-in `<Shapeshift />`, cards, hooks, styles |

### Use the online Jev model (optional)

```bash
cp .env.example apps/web/.env.local
# then set TYPESAFE_API_KEY=... (get one at https://console.typesafe.ai/keys)
```

Restart `bun dev`. The latency readout in the bottom-right corner switches from `jev-offline` to `jev-1.13.0`. The key is only ever read on the server (`/api/intent`); it never reaches the browser. If the API is unreachable or rate-limited, Shapeshift quietly falls back to offline mode.

| Variable | Default | What it does |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | _(empty)_ | Enables the online model. Empty or placeholder values keep you offline. |
| `JEV_MODEL` | `jev-1.13.0` | Pinned model version. |
| `NEXT_PUBLIC_USE_MOCK` | `false` | `true` forces offline even with a key. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Used for Open Graph metadata. |
| `NEXT_PUBLIC_CONVEX_URL` | _(empty)_ | Convex deployment URL for waitlist signup on `/`. |

### Use in another workspace app

```tsx
// apps/my-app — depend on workspace:* packages
import { mockClassifyAsync } from "@shapeshift/core";
import { createFetchClassify, Shapeshift } from "@shapeshift/react";
import "@shapeshift/react/styles.css";

const classify =
  process.env.NEXT_PUBLIC_USE_MOCK === "true"
    ? mockClassifyAsync
    : createFetchClassify("/api/intent");

export default function Page() {
  return <Shapeshift classify={classify} />;
}
```

API route (Next.js App Router):

```ts
import { createIntentHandler } from "@shapeshift/core/server";
export const runtime = "nodejs";
export const POST = createIntentHandler({
  forceOffline: process.env.NEXT_PUBLIC_USE_MOCK === "true",
});
```

In your CSS entry: `@import "tailwindcss";` then `@import "@shapeshift/react/styles.css";` and `@source` the react package so utilities are generated.

Omit `classify` to run fully offline with the built-in mock. Swap persistence with `savedItems.setStorage(memoryStorage)` when embedding without localStorage.

**Deploy:** set the Vercel project Root Directory to `apps/web`.

## Card types

| Card | Try |
| --- | --- |
| Event | `lunch with rahul and anna tomorrow` |
| Reminder | `remind me to pay rent tomorrow urgent` |
| Checklist | `buy milk, eggs, bread and coffee` |
| Timer | `25 min focus` |
| Habit | `gym 3x a week` |
| Color | `#ff6b35`, `tiffany blue`, `minecraft diamond` |
| Split | `split 2400 between 3` |
| Tip | `tip 18% on 2400 for 4` |
| Expense | `spent 450 on uber` |
| Convert | `5 miles in km`, `72f to c` |
| Calculate | `18% of 3450` |
| Trip | `flight to goa next weekend` |
| Poll | `pizza or burgers for friday?` |
| Contact | `rahul 98200 12345 rahul@mail.com` |
| Bookmark | `https://vercel.com/blog check later` |
| Countdown | `days until christmas` |
| Time zone | `3pm pst in ist`, `what time is it in tokyo` |
| Random | `roll 2d6`, `flip a coin`, `pick one: tacos, sushi or pizza` |
| Goal | `read 12 books this year, 4 done` |
| RTCFC | `Role: staff engineer. Task: review this PR. Context: NestJS. Format: severity table. Constraints: skip style nits` |
| BCMT | `Bối cảnh: … Con người: … Mục tiêu: … Tiêu chuẩn: …` |
| Triage | `Title: Payment failed. Report: Customer charged twice. Service: Billing. Triage this ticket` |
| Classify | `Classify this document. Q3 invoice for Acme. Categories: finance, legal, hr, product` |
| Moderate | `Content: You should be fired idiot. Policy: No personal attacks. Flag for moderator` |
| Eval | `Request: What is our refund window? Answer: 14 days. Reference: Help center. Evaluate this answer` |
| Route | `Subject: New vendor signup. Fields: company, tax id. Owners: Maya, Billing queue. Route this form` |
| Approve | `Tool: send_email. Args: {"to":"user@acme.com"}. Pause for approval` |
| Workout | `3x10 bench press 60kg` |
| EMI | `emi on 5 lakh at 9% for 5 years` |
| Recipe | `pasta with garlic, tomato and olive oil for 2` |
| Note | anything else |

Saved cards live in your browser (`localStorage`) until you delete them. Click one to edit it.

### Keyboard

| Key | Action |
| --- | --- |
| <kbd>Enter</kbd> | Save the card (RTCFC: new line; <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves) |
| <kbd>Esc</kbd> | Clear (or cancel an edit) |
| <kbd>Tab</kbd> | Keep a faint preview |
| <kbd>←</kbd> <kbd>→</kbd> | Choose between "Did you mean" chips |
| <kbd>/</kbd> | Open every card type |

URL flags: `?debug=1` shows every probability; `?demo=1&loop=1` plays a scripted demo.

## How it works

<p align="center"><img src="docs/diagrams/architecture.svg" alt="Keystroke, debounced hook, server route, Jev or offline classifier, decide, gate signals, parse, card" width="820"></p>

Raw model output flickers as you type, so a small state machine turns confidence into calm UI states. A card only changes when a challenger wins twice in a row (or is very sure), and signal badges use an on/off hysteresis band.

<p align="center"><img src="docs/diagrams/states.svg" alt="States: input, ghost preview, choose between two chips, committed card, with the thresholds between them" width="820"></p>

The diagrams are Excalidraw files — open any `docs/diagrams/*.excalidraw` at [excalidraw.com](https://excalidraw.com) to edit them.

| Path | What lives there |
| --- | --- |
| `packages/react/src/intents/registry.ts` | **The extension point.** One entry per card type. |
| `packages/core/src/jev/questions.ts` | The Jev question schema |
| `packages/core/src/jev/mock.ts` | Offline keyword classifier (same output shape) |
| `packages/core/src/parse/` | One deterministic parser per card type |
| `packages/core/src/decide.ts`, `signals.ts` | The calm-UI state machine |
| `packages/react/src/shapeshift/` | Shell, chips, palette, saved list, HUD |
| `packages/core/src/server.ts` | `createIntentHandler()` for host API routes |

### Adding a card type

1. Add the key to `INTENT_KEYS` in `packages/core/src/jev/types.ts`.
2. Add a non-overlapping criterion to `intent` in `packages/core/src/jev/questions.ts`.
3. Write a parser in `packages/core/src/parse/` and register it in `packages/core/src/parse/index.ts`.
4. Write a card component in `packages/react/src/intents/` and add a registry entry.
5. Teach the offline classifier in `packages/core/src/jev/mock.ts`, and add tests.

TypeScript will point at anything you missed.

## Development

```bash
bun run check    # typecheck + lint + tests
bun test         # parser, decision, signal and classifier tests
bun run build
```

Stack: Next.js (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Motion · chrono-node · zod.

## License

[MIT](LICENSE)
