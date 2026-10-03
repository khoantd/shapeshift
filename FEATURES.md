# Shapeshift — Features

An input that becomes what you mean. One text box morphs into the right UI as you type.

## Product pillars

| Feature | Description |
| --- | --- |
| **Morphs as you type** | One text box becomes the right UI — events, checklists, places, news, splits, and thirty-plus more — without menus or mode switches. |
| **Jev decides, code computes** | TypeSafe AI’s Jev classifies intent in parallel. Dates, amounts, places, and math stay in deterministic parsers. |
| **Places with contacts** | Search venues on the map, open details, pin places for later (`/pinned`), and save people to Lead Flow — type `/contact` to revisit places you’ve already captured. |
| **Works offline by default** | A built-in keyword classifier keeps the demo useful with no API key. Plug in Jev when you want the full model. |

## App surfaces

| Route | What it does |
| --- | --- |
| `/` | Waitlist landing (Convex signup) |
| `/demo` | Live morphing input — press `/` for every card type |
| `/places` | Map search by query or `/category`, pin places (`/pinned`), place details, contacts → Lead Flow |
| `/news` | CXO news briefing feed |

## Morphing intent cards

Press `/` in the demo to browse all types. Each row is a card the input can become.

### Planning & lists

| Intent | Example |
| --- | --- |
| Event | `dinner with priya friday 8pm` |
| Reminder | `remind me to call mom tomorrow` |
| Checklist / Shopping | `buy milk, eggs, bread and coffee` |
| Habit | `meditate every morning` |
| Goal | `read 12 books this year, 4 done` |
| Countdown | `days until christmas` |
| Poll | `pizza or burgers for friday?` |
| Note | `the city felt so quiet this morning` |

### Time & focus

| Intent | Example |
| --- | --- |
| Timer | `25 min focus` |
| Time zone | `3pm pst in ist` |
| Trip | `flight to goa next weekend` |

### Money & math

| Intent | Example |
| --- | --- |
| Split | `split 2400 between 3` |
| Tip | `tip 18% on 2400 for 4` |
| Expense | `spent 450 on uber` |
| Calculate | `18% of 3450` |
| Convert | `5 miles in km` |
| EMI | `emi on 5 lakh at 9% for 5 years` |

### People & places

| Intent | Example |
| --- | --- |
| Contact | `rahul 98200 12345 rahul@mail.com` |
| Place | `find address 1600 Amphitheatre Parkway` |
| Bookmark | `https://vercel.com/blog check later` |

### Lifestyle

| Intent | Example |
| --- | --- |
| Color | `#ff6b35` or `minecraft diamond` |
| Workout | `3x10 bench press 60kg` |
| Recipe | `pasta with garlic, tomato and olive oil for 2` |
| Random | `roll 2d6` |
| News | `critical news on AI regulation` |

### Agent / ops workflows

| Intent | Example |
| --- | --- |
| RTCFC | Role / Task / Context / Format / Constraints prompt builder |
| BCMT | Business case / message template workflow |
| Triage | Ticket triage from title + report + service |
| Classify | Document classification into categories |
| Moderate | Policy-based content moderation flag |
| Eval | Answer quality vs reference |
| Route | Form routing to owners / queues |
| Approve | Tool-call pause for human approval |

## Places (`/places`)

| Feature | Description |
| --- | --- |
| Text search | Autocomplete venues (Google Places or MapTiler, depending on config) |
| Slash categories | `/shop`, `/amenity`, `/tourism`, `/office`, `/craft`, `/healthcare`, `/leisure`, `/service`, `/company`, `/commercial` |
| Contact category | `/contact` lists places that already have saved person contacts (Convex) |
| Pin places | Pin from place details (toast + View); unpin from `/pinned` list; brand OSM markers when filtered (Convex) |
| Place details | Name, address, map context for a selected venue |
| Place contacts | Add name / email / phone on a place; stored in Convex |
| Lead Flow sync | New contacts POST to inbound leads API (server-held API key) |
| Map tiles | Optional map rendering when tiles provider is configured |

## Platform

| Feature | Description |
| --- | --- |
| Offline mock classifier | Keyword fallback when no TypeSafe API key |
| Online Jev | Optional `TYPESAFE_API_KEY` → `/api/intent` |
| Calm UI state machine | `decide` + signal gating — avoids jumpy card swaps |
| Saved items | Complete a card to keep a local summary row |
| Waitlist | Email join via Convex (`joinWaitlist` / `waitlistCount`) |
| Accessibility | Strong focus states; motion respects `prefers-reduced-motion` |
| Packages | `@shapeshift/core` (engine) · `@shapeshift/react` (`<Shapeshift />`) |

## Related

- Live demo: `/demo`
- Landing features section: `apps/web/src/components/waitlist/WaitlistLanding.tsx`
- Intent registry: `packages/react/src/intents/registry.ts`
