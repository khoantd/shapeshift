/** Static content mirroring design-system/mobile/figcraft exports (MB_*). */

export const askChips = ["Ask", "Summarize", "Translate"] as const;

export const recentItems = [
  {
    id: "1",
    title: "Summarize this article",
    meta: "nytimes.com · 2h ago",
    kind: "link" as const,
  },
  {
    id: "2",
    title: "Split dinner bill 4 ways",
    meta: "Gadget · Yesterday",
    kind: "split" as const,
  },
  {
    id: "3",
    title: "Translate menu to English",
    meta: "Camera · 2 days ago",
    kind: "translate" as const,
  },
];

export const newsCategories = ["Top", "Tech", "World", "Science"] as const;

export const newsItems = [
  {
    id: "n1",
    source: "THE VERGE",
    time: "14m",
    highlight: true,
    title: "Apple ships on-device AI for Shortcuts",
    excerpt:
      "A new Foundation Models API lets third-party apps run summaries and rewrites fully offline.",
  },
  {
    id: "n2",
    source: "REUTERS",
    time: "1h",
    title: "Markets steady as central banks hold rates",
    excerpt:
      "Equities edged higher while bond yields slipped after policymakers signalled a longer pause.",
  },
  {
    id: "n3",
    source: "ARS TECHNICA",
    time: "3h",
    title: "Rust 1.97 lands a faster incremental compiler",
    excerpt:
      "Build times drop up to 20% on large workspaces thanks to a reworked query cache.",
  },
  {
    id: "n4",
    source: "NATURE",
    time: "5h",
    title: "Solid-state battery hits new density record",
    excerpt:
      "Researchers report 500 Wh/kg in a pouch cell that survived 1,000 charge cycles.",
  },
];

export const gadgets = [
  { id: "tip", label: "Tip", active: true },
  { id: "split", label: "Split" },
  { id: "convert", label: "Convert" },
  { id: "timer", label: "Timer" },
  { id: "rtcfc", label: "RTCFC" },
] as const;

export const tipResult = {
  title: "Tip calculator",
  badge: "18%",
  amount: "$12.60",
  rows: [
    { label: "Bill", value: "$70.00", bold: false },
    { label: "Tip (18%)", value: "$12.60", bold: false },
    { label: "Total", value: "$82.60", bold: true },
  ],
};

export const places = [
  {
    id: "p1",
    title: "Scan a menu or sign",
    subtitle: "Translate with the camera",
    kind: "camera" as const,
  },
  {
    id: "p2",
    title: "Add a quick note",
    subtitle: "Save to your Meanbox",
    kind: "note" as const,
  },
];

export const studyContext = {
  source: "YouTube · 18:24",
  title: "Transformers, explained visually",
  meta: "3Blue1Brown · 2.4M views",
};

export const keyPoints = [
  "Attention replaces recurrence for sequence models",
  "Self-attention lets every token weigh every other",
  "Positional encodings restore word order",
];

export const chapters = [
  { id: "c1", time: "00:00", title: "Introduction" },
  { id: "c2", time: "02:14", title: "Why attention works" },
  { id: "c3", time: "07:40", title: "Multi-head attention" },
];
