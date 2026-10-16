# Meanbox mobile — FigCraft source

Canonical UI mockups for the Meanbox mobile app (Expo / RN target).

| Artifact | Path |
|----------|------|
| Source | [`meanbox.figcraft`](./meanbox.figcraft) |
| PNG previews (@2x) | [`exports/`](./exports/) |
| Design system | [`../MASTER.md`](../MASTER.md) |
| Tokens | [`../tokens.json`](../tokens.json) |

## Screens (390×844)

| Frame | Export | Notes |
|-------|--------|-------|
| `MB_Ask` | [`exports/MB_Ask.png`](./exports/MB_Ask.png) | Intent field, chips, recent rows, TabBar |
| `MB_News` | [`exports/MB_News.png`](./exports/MB_News.png) | Segment chips, flat feed, TabBar |
| `MB_Study` | [`exports/MB_Study.png`](./exports/MB_Study.png) | Context card, Overview / Related, TabBar |
| `MB_Tools` | [`exports/MB_Tools.png`](./exports/MB_Tools.png) | Gadgets + ResultCard, TabBar |

TabBar includes **More**, but there is no `MB_More` frame yet.

## Prerequisites

[`figcraft-cli`](https://github.com/storytold/figcraft/releases) v0.5.1+ on `PATH` (macOS universal zip from the release assets). FigCraft.app alone is not enough for headless export.

```bash
# Example install
curl -L -o /tmp/figcraft-cli.zip \
  https://github.com/storytold/figcraft/releases/download/v0.5.1/figcraft-cli-0.5.1-macos-universal.zip
unzip -o /tmp/figcraft-cli.zip -d /tmp/figcraft-cli
cp /tmp/figcraft-cli/figcraft-cli-0.5.1-macos-universal/figcraft-cli ~/bin/figcraft-cli
chmod +x ~/bin/figcraft-cli
```

## Re-export

From repo root:

```bash
figcraft-cli info design-system/mobile/figcraft/meanbox.figcraft
figcraft-cli export design-system/mobile/figcraft/meanbox.figcraft \
  -o design-system/mobile/figcraft/exports/ --scale 2
```

## Gaps vs MASTER

- No `MB_More` screen (account / locale / settings).
- File has 0 styles / 0 variables — colors are fills in-document; keep [`tokens.json`](../tokens.json) as the implementation source of truth.
