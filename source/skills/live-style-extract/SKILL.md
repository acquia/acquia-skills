---
name: live-style-extract
description:
  Extract a pixel-precise style + animation + behavior fingerprint from a live
  web page for 1:1 design cloning. Use whenever recreating/matching a live URL's
  component and you need EXACT classes, ids, computed styles, stateful CSS
  (:hover/:focus/:active), @keyframes/transitions, :root design tokens, and
  bound JS event listeners — instead of eyeballing screenshots. Especially for
  animated or interactive elements. Runs `scripts/extract-styles.js <url>
  --selector "<css>"`. Pairs with `nebula-scrape-url` (screenshots) and feeds
  `canvas-styling-conventions`. Not for Figma/GitHub/docs URLs.
---

# Live style extraction for precise cloning

Screenshots tell you _what it looks like_; `getComputedStyle` gives resolved
static values; **this skill gives the source truth** — the actual matched CSS
rules (including hover/focus/active states), the resolved `@keyframes`, the
site's `:root` design tokens, and which JS listeners are bound. Use it before
building any component that must match a live site, and always for
animated/interactive elements where video and stills are insufficient.

## When to use

- "Match / clone / recreate this exactly" from a live URL.
- Any hover, transition, or keyframe animation you must reproduce precisely.
- You need exact spacing/typography/color that a screenshot only approximates.

Do **not** use for Figma (use the Figma MCP), GitHub (read code), or docs.

## Workflow

1. **Find the selector.** Open the live page (browser MCP or `nebula-scrape-url`
   HTML) and identify a stable CSS selector for the target element/section.

2. **Run the extractor:**

   ```bash
   node scripts/extract-styles.js <url> --selector "<css>" [--all] [--accept-cookies]
   ```

   - `--all` — fingerprint every element matching the selector (e.g. all tabs).
   - `--accept-cookies` — dismiss a cookie banner before extracting.
   - `--headless` — opt out of the default visible browser.

3. **Read `extracted/<timestamp>/style-spec.json`** (and `report.md`). Per
   element you get: `tag`, `id`, `classes`, `attributes`, curated `computed`
   styles, `matchedRules` (each with `selector`, `states`, `media`, `css`), used
   `keyframes`, `:root` `tokens`, and `listeners` (CDP: event `type` + source
   location). Cross-origin stylesheets are fetched into `blockedSheetContents`
   by href.

4. **Map into the build:**
   - Static values + tokens → `@theme` variables and Tailwind/CVA per
     [`canvas-styling-conventions`](../canvas-styling-conventions/SKILL.md).
     Prefer mapping the site's `:root` tokens to project tokens over hardcoding.
   - `:hover`/`:focus`/`:active` rules → CVA/utility state variants.
   - `transition` + `@keyframes` → reproduce duration, delay, and `cubic-bezier`
     exactly (define keyframes in `global.css` if needed).
   - `@media` variants → responsive prefixes.

5. **Structure** the component with
   [`canvas-design-decomposition`](../canvas-design-decomposition/SKILL.md); the
   fingerprint informs styling, not the component tree.

## What is and isn't 100%

- **CSS / animation / tokens: deterministic.** Matched rules, keyframes, and
  `:root` variables are read from the actual stylesheets (same-origin fully;
  cross-origin fetched as raw text).
- **JS behavior: best-effort.** `listeners` reports which events are bound and a
  source location (via `DOMDebugger.getEventListeners`), and you can read the
  downloaded bundle — but minified framework code means you **reconstruct and
  observe** the behavior, not copy it verbatim. State this limit when a task
  hinges on replicating JS logic exactly.

## Parity-diff verifier (the convergence loop)

Extraction alone still leaves hand-matching, which is lossy and eyeballed. To
reach true pixel-parity, **diff our rendered component against the live
element** and drive the deltas to zero:

```bash
node scripts/parity-diff.js --live-url <url> --live-selector "<css>" \
     --local-selector "<css>" [--local-url http://localhost:5174/page/home] \
     [--accept-cookies] [--headless]
# or many pairs at once:
node scripts/parity-diff.js --live-url <url> --pairs <pairs.json> [--accept-cookies]
#   pairs.json = { "name": { "live": "<css>", "local": "<css>" }, ... }
```

It renders both, normalizes colors (Workbench emits `oklab`, live emits `rgb` —
both collapse via canvas `fillStyle`), compares every visual property with a 1px
tolerance, and writes `extracted/<ts>/parity.md` listing each mismatch
(`❌ lineHeight: live 52.2px vs local 45px`) plus a match %. Per section:
**extract → build → diff → fix flagged deltas → diff again until 100%.**

Gotchas learned:

- **Pass equivalent element pairs.** Live's first `h1` may be a visually-hidden
  a11y title; target the _visible_ element or the comparison is meaningless. Our
  Tailwind components lack stable hooks — target by a distinctive tag/section or
  add `data-testid` when needed.
- **Workbench reads `--default-font-family` (set to Geist), not `--font-sans`.**
  Pin `--default-font-family: var(--font-sans)` in `@theme` and set
  `font-family` on `body`, or all body copy silently renders in the wrong font.
- The component renders inside a `*preview*` iframe; the script finds that frame
  automatically.

## Pairs with

- [`nebula-scrape-url`](../nebula-scrape-url/SKILL.md) — screenshots + HTML.
- [`canvas-styling-conventions`](../canvas-styling-conventions/SKILL.md) — where
  the extracted values land.
- [`canvas-design-decomposition`](../canvas-design-decomposition/SKILL.md) —
  component structure.
