/**
 * Live style + animation + behavior extractor for pixel-precise design cloning.
 *
 * Produces a machine-readable "style fingerprint" of one or more elements on a
 * live page: structure (classes/id/attrs), curated computed styles, the actual
 * matched CSS rules INCLUDING :hover/:focus/:active states, resolved @keyframes,
 * @media variants, :root design tokens, and (best-effort) bound JS event
 * listeners via the Chrome DevTools Protocol.
 *
 * Use this before building a Canvas component so styling/animation is written
 * from data instead of eyeballed. Pairs with `nebula-scrape-url` (screenshots)
 * and feeds `canvas-styling-conventions` (map values -> @theme tokens/CVA).
 *
 * Usage:
 *   node scripts/extract-styles.js <url> --selector "<css>"
 *   node scripts/extract-styles.js <url> --selector "<css>" --all   # all matches
 *   node scripts/extract-styles.js <url> --selector "<css>" --headless
 *   node scripts/extract-styles.js <url> --accept-cookies
 *
 * Output (in extracted/<timestamp>/):
 *   - style-spec.json   (full fingerprint, consume this when building)
 *   - report.md         (human-readable summary)
 *
 * Note: visible browser by default to bypass bot protection; --headless to opt out.
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const getFlagVal = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const selector = getFlagVal('--selector');
const configPath = getFlagVal('--config');
const all = args.includes('--all');
const headless = args.includes('--headless');
const acceptCookies = args.includes('--accept-cookies');
// Default 1440 so desktop-only hover behaviors (e.g. translateY hidden behind a max-width
// media query override) are captured. Override with --viewport <width>.
const viewportWidth = parseInt(getFlagVal('--viewport') || '1440', 10);

if (!url || (!selector && !configPath)) {
  console.error(
    'Usage:\n' +
      '  node scripts/extract-styles.js <url> --selector "<css>" [--all] [--headless] [--accept-cookies] [--viewport <width>]\n' +
      '  node scripts/extract-styles.js <url> --config <map.json> [--headless] [--accept-cookies] [--viewport <width>]\n' +
      '    where map.json is { "componentName": "<css selector>", ... } (each treated as --all)\n' +
      '    --viewport defaults to 1440 to catch desktop-only hover/animation behaviors',
  );
  process.exit(1);
}

// Curated set of computed properties worth recording (skip the ~400 defaults).
const COMPUTED_PROPS = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
  'boxSizing',
  'width',
  'height',
  'maxWidth',
  'minWidth',
  'maxHeight',
  'margin',
  'padding',
  'gap',
  'rowGap',
  'columnGap',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignSelf',
  'flex',
  'gridTemplateColumns',
  'gridTemplateRows',
  'color',
  'backgroundColor',
  'backgroundImage',
  'backgroundSize',
  'backgroundPosition',
  'opacity',
  'mixBlendMode',
  'border',
  'borderRadius',
  'borderColor',
  'borderWidth',
  'boxShadow',
  'outline',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'textDecorationLine',
  'textUnderlineOffset',
  'whiteSpace',
  'transform',
  'transformOrigin',
  'transition',
  'transitionProperty',
  'transitionDuration',
  'transitionTimingFunction',
  'transitionDelay',
  'animation',
  'animationName',
  'animationDuration',
  'animationTimingFunction',
  'animationDelay',
  'animationIterationCount',
  'animationDirection',
  'cursor',
  // Image/visual filters (brightness, contrast, blur, etc.) — critical for overlay cards
  'filter',
  'backdropFilter',
  // Overflow & visibility
  'overflow',
  'overflowX',
  'overflowY',
  'visibility',
  'pointerEvents',
  // Object fit for images
  'objectFit',
  'objectPosition',
];

// This function is serialized and run inside the page.
function extractInPage({ sel, wantAll, props }) {
  const PSEUDO_STATE =
    /:(hover|focus|focus-visible|focus-within|active|visited|checked|disabled)\b/g;
  const PSEUDO_ELEMENT =
    /::?(before|after|placeholder|marker|selection|first-line|first-letter)\b/g;
  // Functional pseudo-classes must be removed WHOLE (with their parens), not
  // have their inner :hover stripped — otherwise `:not(.x:hover)` becomes
  // `:not(.x)` and wrongly excludes the element (this dropped the tab-dimming
  // rule `.nav-tabs:has(.item:hover) .item:not(:hover)`). Handles one nesting
  // level of parens.
  const FUNC_PSEUDO = /:(not|is|where|has)\((?:[^()]|\([^()]*\))*\)/g;

  const stripPseudo = (s) => {
    let prev;
    let cur = s;
    do {
      prev = cur;
      cur = cur.replace(FUNC_PSEUDO, '');
    } while (cur !== prev);
    return (
      cur.replace(PSEUDO_STATE, '').replace(PSEUDO_ELEMENT, '').trim() || '*'
    );
  };

  // A rule affects `el` via ANOTHER element's state (group/sibling/ancestor
  // hover) — e.g. `.parent:has(.x:hover) .el` or `.parent:hover .el`. These are
  // easy to miss because the state isn't on the element itself.
  const isGroupInteraction = (s) =>
    /:has\([^)]*:(hover|focus|checked)/.test(s) ||
    /:(hover|focus|focus-within|checked)\b(?=[^,{]*[ >~+])/.test(s);

  const detectStates = (s) => {
    const states = [];
    let m;
    PSEUDO_STATE.lastIndex = 0;
    while ((m = PSEUDO_STATE.exec(s)) !== null) states.push(m[1]);
    return states;
  };

  const computedOf = (el) => {
    const cs = getComputedStyle(el);
    const o = {};
    props.forEach((p) => {
      const v = cs[p];
      if (v && v !== 'normal' && v !== 'none' && v !== 'auto' && v !== '0px')
        o[p] = v;
    });
    return o;
  };

  // Walk every stylesheet and collect rules that match `el`, tagging pseudo
  // state and enclosing @media. Cross-origin sheets throw on .cssRules; we
  // record their href so the caller can fetch + surface them separately.
  const keyframes = {};
  const blockedSheets = [];

  const collectFromRules = (rules, el, media, out) => {
    for (const rule of rules) {
      if (rule.type === CSSRule.MEDIA_RULE) {
        collectFromRules(rule.cssRules, el, rule.conditionText, out);
      } else if (rule.type === CSSRule.KEYFRAMES_RULE) {
        keyframes[rule.name] = rule.cssText;
      } else if (rule.type === CSSRule.STYLE_RULE) {
        for (const sub of rule.selectorText.split(',')) {
          const trimmed = sub.trim();
          let base;
          try {
            base = stripPseudo(trimmed);
          } catch {
            continue;
          }
          let matches = false;
          try {
            matches = el.matches(base);
          } catch {
            continue;
          }
          if (matches) {
            out.push({
              selector: trimmed,
              states: detectStates(trimmed),
              groupInteraction: isGroupInteraction(trimmed),
              media: media || null,
              css: rule.style.cssText,
            });
          }
        }
      }
    }
  };

  // Capture pseudo-element computed styles (::before, ::after).
  const pseudoOf = (el) => {
    const out = {};
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      const content = cs.getPropertyValue('content');
      // Only record if pseudo-element actually exists (content !== 'none' or has width/height)
      const hasSize = parseFloat(cs.width) > 0 || parseFloat(cs.height) > 0;
      if (content !== 'none' || hasSize) {
        const o = {};
        props.forEach((p) => {
          const v = cs[p];
          if (
            v &&
            v !== 'normal' &&
            v !== 'none' &&
            v !== 'auto' &&
            v !== '0px'
          )
            o[p] = v;
        });
        // Always include content, even if 'none'
        o.content = content;
        // Always include transition for hover expansion detection
        o.transition = cs.transition;
        o.width = cs.width;
        o.height = cs.height;
        out[pseudo] = o;
      }
    }
    return out;
  };

  // Simulate hover and capture computed style deltas.
  // Injects a :hover rule override via a <style> tag, captures deltas, then removes it.
  const hoverDeltaOf = (el) => {
    const beforeCS = computedOf(el);
    const beforePseudo = pseudoOf(el);

    // Build a unique class to force-hover
    const uid = '__ext_hover_' + Math.random().toString(36).slice(2);
    el.classList.add(uid);
    const style = document.createElement('style');
    // Force :hover styles to apply via a class that we can target
    style.textContent = `.${uid}, .${uid}:hover, .${uid} * { /* hover simulation */ }`;
    document.head.appendChild(style);

    // Use :hover via programmatic mouse-enter event dispatch instead
    el.classList.remove(uid);
    style.remove();

    // Better approach: inject a CSS rule that matches `uid:not(.no-hover)` → same as :hover
    // For the purposes of extracting hover styles from matched rules, parse the already-collected rules
    return null; // hover deltas are captured via matchedRules[].states filtering
  };

  // Extract first-child elements for overlay-card patterns (image, overlay div, text spans)
  const childrenOf = (el, depth) => {
    if (depth <= 0) return [];
    return Array.from(el.children)
      .slice(0, 8)
      .map((child) => {
        const attrs = {};
        for (const a of child.attributes) attrs[a.name] = a.value;
        return {
          tag: child.tagName.toLowerCase(),
          id: child.id || null,
          classes: [...child.classList],
          attributes: attrs,
          text: (child.textContent || '').trim().slice(0, 60),
          computed: computedOf(child),
          pseudo: pseudoOf(child),
          children: childrenOf(child, depth - 1),
        };
      });
  };

  const describe = (el) => {
    const matched = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        if (sheet.href) blockedSheets.push(sheet.href);
        continue;
      }
      if (rules) collectFromRules(rules, el, null, matched);
    }
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value;

    // Separate hover and base rules for easy reading
    const baseRules = matched.filter((r) => r.states.length === 0);
    const hoverRules = matched.filter((r) => r.states.includes('hover'));
    const focusRules = matched.filter(
      (r) => r.states.includes('focus') || r.states.includes('focus-visible'),
    );

    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: [...el.classList],
      attributes: attrs,
      text: (el.textContent || '').trim().slice(0, 80),
      computed: computedOf(el),
      pseudo: pseudoOf(el),
      matchedRules: matched,
      baseRules,
      hoverRules,
      focusRules,
      // Shallow child tree for overlay-card / compound component patterns
      children: childrenOf(el, 2),
      // Ancestor spacing: walk up the DOM collecting marginBottom/paddingBottom/marginTop/paddingTop
      // on each ancestor until <body>. Surfaces parent-wrapper spacing that the element's own
      // computed styles never show (e.g. .vlb-section { margin-bottom: 60px }).
      ancestorSpacing: (() => {
        const chain = [];
        let node = el.parentElement;
        while (node && node !== document.body) {
          const cs = getComputedStyle(node);
          const mb = cs.marginBottom;
          const pb = cs.paddingBottom;
          const mt = cs.marginTop;
          const pt = cs.paddingTop;
          if (mb !== '0px' || pb !== '0px' || mt !== '0px' || pt !== '0px') {
            chain.push({
              tag: node.tagName.toLowerCase(),
              cls: (node.className || '').toString().trim().slice(0, 80),
              marginTop: mt,
              marginBottom: mb,
              paddingTop: pt,
              paddingBottom: pb,
            });
          }
          node = node.parentElement;
        }
        return chain;
      })(),
      // Section gap: pixel distance between the bottom of this element and the top of
      // the next sibling section-like element (div, section, article). Captures the
      // visual whitespace between sections that comes from ancestor wrappers, not the
      // element itself.
      sectionGap: (() => {
        // Find the top-level section ancestor of this element (direct child of body or a layout root)
        let ancestor = el;
        while (
          ancestor.parentElement &&
          ancestor.parentElement !== document.body
        ) {
          ancestor = ancestor.parentElement;
        }
        const next = ancestor.nextElementSibling;
        if (!next) return null;
        const thisRect = ancestor.getBoundingClientRect();
        const nextRect = next.getBoundingClientRect();
        return {
          gap: Math.round(nextRect.top - thisRect.bottom),
          nextTag: next.tagName.toLowerCase(),
          nextCls: (next.className || '').toString().trim().slice(0, 80),
        };
      })(),
      // Descendant pseudo-element scan: walks ALL descendants and surfaces any ::before
      // or ::after that has meaningful visual content — non-transparent background,
      // non-zero dimensions, or positioned layout. Catches overlay backgrounds, animated
      // fills, and decorative shapes on deep children that childrenOf(el, 2) never reaches
      // (e.g. .taxonomy-term::after { background: cyan; opacity: 0.4; } 4 levels deep).
      // Also collects CSS rules that match each found element's pseudo on hover, so the
      // full at-rest + hover transition is surfaced in one place.
      descendantPseudos: (() => {
        const found = [];
        const TRANSPARENT = ['rgba(0, 0, 0, 0)', 'transparent'];
        const isMeaningful = (cs) =>
          cs.content !== 'none' &&
          (!TRANSPARENT.includes(cs.backgroundColor) ||
            !TRANSPARENT.includes(cs.background.split(' ')[0]) ||
            cs.backgroundImage !== 'none' ||
            (parseFloat(cs.width) > 0 &&
              parseFloat(cs.height) > 0 &&
              cs.position !== 'static'));

        // Collect hover pseudo rules from stylesheets once (keyed by lowercased selector)
        const hoverPseudoRules = [];
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules || []) {
              const sel = rule.selectorText || '';
              if (
                /:hover.*::?(before|after)|::?(before|after).*:hover/.test(sel)
              ) {
                hoverPseudoRules.push({
                  sel,
                  css: rule.style.cssText.slice(0, 300),
                });
              }
            }
          } catch {
            /* cross-origin sheet */
          }
        }

        for (const desc of el.querySelectorAll('*')) {
          for (const pseudo of ['::before', '::after']) {
            const cs = getComputedStyle(desc, pseudo);
            if (!isMeaningful(cs)) continue;
            // Find matching hover rules for this element's pseudo
            const matchingHover = hoverPseudoRules.filter(({ sel }) => {
              const base =
                sel
                  .replace(/:hover/g, '')
                  .replace(/::?(before|after)/g, '')
                  .trim() || '*';
              try {
                return desc.matches(base);
              } catch {
                return false;
              }
            });
            found.push({
              tag: desc.tagName.toLowerCase(),
              cls: (desc.className || '').toString().trim().slice(0, 80),
              pseudo,
              // Key visual properties at rest
              background: cs.backgroundColor,
              backgroundImage:
                cs.backgroundImage !== 'none'
                  ? cs.backgroundImage.slice(0, 80)
                  : null,
              opacity: cs.opacity,
              position: cs.position,
              inset: cs.inset,
              width: cs.width,
              height: cs.height,
              zIndex: cs.zIndex,
              transition: cs.transition,
              // Hover rules that affect this element's pseudo — shows the full animation
              hoverRules: matchingHover,
            });
          }
        }
        return found;
      })(),
      // Contextual hover rules: CSS rules using :has() or sibling combinators (~, +)
      // combined with :hover to apply styles to OTHER elements — the hovered element
      // is NOT the element receiving the style. Classic examples:
      //   ".grid:has(.card:hover) .card:not(:hover) { opacity: 0.5 }"  ← sibling dimming
      //   ".nav:has(.item:hover) .item:not(:hover) { opacity: 0.7 }"   ← nav item fade
      //   ".row ~ .row:hover { ... }"                                    ← adjacent sibling
      // These are invisible to matchedRules (no hover at extract time), hoverCascadeRules
      // (`:hover` is inside `:has(...)` so never directly before a combinator), and
      // descendantHoverRules (stripping :hover leaves an invalid :not() selector that
      // can't match). Strategy: collect all rules containing :hover + :has(|~|+), strip
      // :has()/:not()/:hover to get a rough base selector, then check if el, any ancestor,
      // or any descendant matches — relevance is enough to surface the full rule.
      contextualHoverRules: (() => {
        const found = [];
        for (const sheet of document.styleSheets) {
          try {
            const checkRule = (r, media) => {
              if (!r.selectorText) return;
              for (const sub of r.selectorText.split(',')) {
                const trimmed = sub.trim();
                if (!/:hover/.test(trimmed)) continue;
                // Only contextual patterns: :has() or sibling combinators around :hover
                const isContextual =
                  /:has\(/.test(trimmed) ||
                  /~[^,]*:hover|:hover[^,]*~/.test(trimmed) ||
                  /\+[^,]*:hover|:hover[^,]*\+/.test(trimmed);
                if (!isContextual) continue;
                // Strip :has(...), :not(...), :hover to get a rough base for matching.
                // Uses single-level [^)]* which is sufficient for the patterns we target.
                const roughBase =
                  trimmed
                    .replace(/:has\([^)]*\)/g, '')
                    .replace(/:not\([^)]*\)/g, '')
                    .replace(/:(hover|focus|focus-visible|active)\b/g, '')
                    .replace(/\s+/g, ' ')
                    .trim() || '*';
                let relevant = false;
                try {
                  relevant = el.matches(roughBase);
                } catch {
                  /* invalid after stripping */
                }
                if (!relevant) {
                  let node = el.parentElement;
                  while (node && node !== document.body && !relevant) {
                    try {
                      relevant = node.matches(roughBase);
                    } catch {}
                    node = node.parentElement;
                  }
                }
                if (!relevant) {
                  for (const desc of el.querySelectorAll('*')) {
                    try {
                      if (desc.matches(roughBase)) {
                        relevant = true;
                        break;
                      }
                    } catch {}
                  }
                }
                if (relevant) {
                  found.push({
                    selector: trimmed,
                    media: media || null,
                    css: r.style.cssText.slice(0, 400),
                  });
                }
              }
            };
            for (const rule of sheet.cssRules || []) {
              if (rule.type === CSSRule.MEDIA_RULE) {
                for (const r of rule.cssRules || [])
                  checkRule(r, rule.conditionText);
              } else if (rule.type === CSSRule.STYLE_RULE) {
                checkRule(rule, null);
              }
            }
          } catch {
            /* cross-origin sheet */
          }
        }
        return found;
      })(),
      // Hover-cascade rules: CSS rules where THIS element's :hover state controls
      // a DESCENDANT (e.g. ".card:hover .bottom-content { transform: translateY(0) }").
      // This is the only reliable way to catch animated wrappers deep in the DOM tree
      // without DOM depth limits or viewport-dependent computed-style diffing.
      hoverCascadeRules: (() => {
        const found = [];
        for (const sheet of document.styleSheets) {
          let rules;
          try {
            rules = sheet.cssRules;
          } catch {
            continue;
          }
          const checkRule = (r, media) => {
            if (!r.selectorText) return;
            for (const sub of r.selectorText.split(',')) {
              const trimmed = sub.trim();
              // Match: <something>:hover <descendant> — i.e. :hover followed by whitespace/combinator + more selector
              if (
                !/:hover[\s>+~]/.test(trimmed) &&
                !/hover\b.*hover/.test(trimmed)
              )
                continue;
              // Extract the part before :hover to check if it matches this element
              const preHover =
                trimmed.replace(/:hover[\s>+~].*/, '').trim() || '*';
              let matches = false;
              try {
                matches = el.matches(preHover);
              } catch {
                continue;
              }
              if (matches) {
                found.push({
                  selector: trimmed,
                  media: media || null,
                  css: r.style.cssText.slice(0, 300),
                });
              }
            }
          };
          for (const rule of rules || []) {
            if (rule.type === CSSRule.MEDIA_RULE) {
              for (const r of rule.cssRules || [])
                checkRule(r, rule.conditionText);
            } else if (rule.type === CSSRule.STYLE_RULE) {
              checkRule(rule, null);
            }
          }
        }
        return found;
      })(),
      // Descendant hover rules: CSS rules where a DESCENDANT element itself has :hover
      // (e.g. ".block__content:hover { top: -3px; box-shadow: ... }"). This is different
      // from hoverCascadeRules (parent:hover → child) and catches self-hover effects on
      // nested elements regardless of DOM depth — card lift effects, button hover transforms,
      // any element that animates on its own hover. Without this, "lift" patterns
      // (top/left offset + shadow on card hover) are silently dropped.
      descendantHoverRules: (() => {
        // Pre-collect all self-hover rules (selector has :hover but NOT as a cascade trigger)
        // "self-hover": the :hover applies to the matched element itself, e.g. ".card:hover"
        // "cascade": the :hover triggers styles on a descendant, e.g. ".card:hover .icon"
        const selfHoverRules = [];
        for (const sheet of document.styleSheets) {
          try {
            const processRule = (r, media) => {
              if (!r.selectorText) return;
              for (const sub of r.selectorText.split(',')) {
                const trimmed = sub.trim();
                // Must contain :hover
                if (!/:hover/.test(trimmed)) continue;
                // Skip cascade rules: :hover followed by descendant combinator
                if (/:hover[\s>+~]/.test(trimmed)) continue;
                // Strip :hover (and other pseudo-states/elements) to get base selector
                const base =
                  trimmed
                    .replace(
                      /:(hover|focus|focus-visible|active|visited|checked|disabled)\b/g,
                      '',
                    )
                    .replace(/::?(before|after|placeholder|marker)\b/g, '')
                    .trim() || '*';
                selfHoverRules.push({
                  base,
                  selector: trimmed,
                  css: r.style.cssText.slice(0, 400),
                  media: media || null,
                });
              }
            };
            for (const rule of sheet.cssRules || []) {
              if (rule.type === CSSRule.MEDIA_RULE) {
                for (const r of rule.cssRules || [])
                  processRule(r, rule.conditionText);
              } else if (rule.type === CSSRule.STYLE_RULE) {
                processRule(rule, null);
              }
            }
          } catch {
            /* cross-origin sheet */
          }
        }

        // Walk all descendants and match against pre-collected rules
        const found = [];
        for (const desc of el.querySelectorAll('*')) {
          const matching = [];
          for (const { base, selector, css, media } of selfHoverRules) {
            try {
              if (desc.matches(base)) matching.push({ selector, css, media });
            } catch {
              /* invalid selector */
            }
          }
          if (matching.length === 0) continue;
          // Include at-rest position + transition so the lift mechanic is fully understood
          const cs = getComputedStyle(desc);
          found.push({
            tag: desc.tagName.toLowerCase(),
            cls: (desc.className || '').toString().trim().slice(0, 80),
            // at-rest position context (top/left/right/bottom only matter if position !== static)
            position: cs.position,
            top: cs.top,
            left: cs.left,
            transition: cs.transition,
            boxShadow: cs.boxShadow,
            hoverRules: matching,
          });
        }
        return found;
      })(),
    };
  };

  const nodes = wantAll
    ? [...document.querySelectorAll(sel)]
    : [document.querySelector(sel)].filter(Boolean);

  // :root design tokens (custom properties).
  const rootCS = getComputedStyle(document.documentElement);
  const tokens = {};
  for (let i = 0; i < rootCS.length; i++) {
    const p = rootCS[i];
    if (p.startsWith('--')) tokens[p] = rootCS.getPropertyValue(p).trim();
  }

  const elements = nodes.map(describe);
  // keyframes actually referenced by the extracted elements
  const usedNames = new Set();
  elements.forEach((e) => {
    const n = e.computed.animationName;
    if (n) n.split(',').forEach((x) => usedNames.add(x.trim()));
  });
  const usedKeyframes = {};
  for (const name of usedNames)
    if (keyframes[name]) usedKeyframes[name] = keyframes[name];

  return {
    elements,
    keyframes: usedKeyframes,
    allKeyframes: keyframes,
    tokens,
    blockedSheets: [...new Set(blockedSheets)],
  };
}

async function getListeners(page, sel) {
  try {
    const client = await page.context().newCDPSession(page);
    const { root } = await client.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await client.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: sel,
    });
    if (!nodeId) return [];
    const { object } = await client.send('DOM.resolveNode', { nodeId });
    const { listeners } = await client.send('DOMDebugger.getEventListeners', {
      objectId: object.objectId,
    });
    return (listeners || []).map((l) => ({
      type: l.type,
      useCapture: l.useCapture,
      passive: l.passive,
      once: l.once,
      source:
        l.scriptId && l.lineNumber != null
          ? `script#${l.scriptId}:${l.lineNumber}:${l.columnNumber}`
          : null,
      handler: l.handler?.description?.slice(0, 200) || null,
    }));
  } catch (e) {
    return { error: String(e) };
  }
}

(async () => {
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({
    viewport: { width: viewportWidth, height: 900 },
  });
  console.log(`Navigating to ${url} …`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (acceptCookies) {
    try {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button,a')].find((x) =>
          /accept|agree|got it|ok/i.test(x.textContent || ''),
        );
        if (b) b.click();
      });
      await page.waitForTimeout(500);
    } catch {
      /* ignore */
    }
  }

  // Build the list of extraction targets: either one --selector or a --config map.
  let targets;
  if (configPath) {
    const map = JSON.parse(await readFile(configPath, 'utf8'));
    targets = Object.entries(map).map(([name, sel]) => ({
      name,
      selector: sel,
      all: true,
    }));
  } else {
    targets = [{ name: 'primary', selector, all }];
  }

  const results = {};
  const blockedAll = new Set();
  for (const t of targets) {
    const found = await page
      .waitForSelector(t.selector, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!found) {
      console.error(`⚠ Selector not found: ${t.name} -> ${t.selector}`);
      results[t.name] = { selector: t.selector, notFound: true };
      continue;
    }
    const spec = await page.evaluate(extractInPage, {
      sel: t.selector,
      wantAll: t.all,
      props: COMPUTED_PROPS,
    });
    spec.selector = t.selector;
    spec.listeners = await getListeners(page, t.selector);

    // Hover simulation: move pointer onto the element, re-capture computed styles,
    // compute the delta (changed properties only). This catches opacity reveals,
    // color swaps, box-shadow reveals, bg-color fills, transform scales, etc.
    // that are invisible in CSS rule inspection alone.
    try {
      // Scroll element into viewport before hovering — required when the target is below
      // the fold, otherwise Playwright's actionability check times out silently.
      // force:true bypasses stability/actionability checks for animated/carousel elements.
      await page
        .locator(t.selector)
        .first()
        .scrollIntoViewIfNeeded({ timeout: 5000 });
      await page.waitForTimeout(300); // let scroll settle
      await page.hover(t.selector, { timeout: 5000, force: true });
      await page.waitForTimeout(100); // let CSS :hover state propagate before capturing
      const hoverSpec = await page.evaluate(
        ({ sel, props: p }) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const cs = getComputedStyle(el);
          const o = {};
          p.forEach((prop) => {
            o[prop] = cs[prop];
          });
          // Capture hovered computed styles of interactive descendants (links, buttons, CTAs).
          // Uses generic semantic/role selectors — no site-specific class names.
          // Also captures ::before/::after pseudo-element styles while parent is hovered,
          // since patterns like .card:hover .link::before { height/width/left } are common
          // and invisible without pseudo-element capture under hover.
          const PSEUDO_PROPS = [
            'content',
            'backgroundColor',
            'background',
            'color',
            'opacity',
            'height',
            'width',
            'top',
            'right',
            'bottom',
            'left',
            'transform',
            'transition',
            'display',
            'position',
            'borderRadius',
            'boxShadow',
          ];
          const childDelta = Array.from(
            el.querySelectorAll(
              'a,button,[role="button"],[type="submit"],[type="button"]',
            ),
          )
            .slice(0, 6)
            .map((child) => {
              const cc = getComputedStyle(child);
              const co = {};
              p.forEach((prop) => {
                co[prop] = cc[prop];
              });
              // Capture pseudo-element styles under parent hover (e.g. link::before expanding)
              const pseudo = {};
              for (const pe of ['::before', '::after']) {
                const pcs = getComputedStyle(child, pe);
                const pv = {};
                PSEUDO_PROPS.forEach((prop) => {
                  const v = pcs[prop];
                  if (
                    v &&
                    v !== 'none' &&
                    v !== 'normal' &&
                    v !== 'auto' &&
                    v !== '0px'
                  )
                    pv[prop] = v;
                });
                if (Object.keys(pv).length) pseudo[pe] = pv;
              }
              return {
                tag: child.tagName.toLowerCase(),
                classes: child.className,
                styles: co,
                pseudo,
              };
            });
          return { styles: o, childDelta };
        },
        { sel: t.selector, props: COMPUTED_PROPS },
      );
      // Move mouse away to un-hover
      await page.mouse.move(0, 0);

      if (hoverSpec) {
        // Compute delta vs base computed styles
        const base = spec.elements[0]?.computed || {};
        const delta = {};
        for (const [k, v] of Object.entries(hoverSpec.styles)) {
          if (v !== (base[k] ?? '') && v && v !== 'normal')
            delta[k] = { base: base[k] ?? '(unset)', hover: v };
        }
        spec.hoverDelta = delta;
        spec.hoverChildDelta = hoverSpec.childDelta;
      }
    } catch {
      spec.hoverDelta = null; // element not hoverable (off-screen, etc.)
    }

    (spec.blockedSheets || []).forEach((h) => blockedAll.add(h));
    results[t.name] = spec;
    console.log(
      `✓ ${t.name}: ${spec.elements.length} el, ${
        spec.elements[0]?.matchedRules.length || 0
      } rules, kf: ${Object.keys(spec.keyframes).join(',') || '-'}`,
    );
  }

  // Fetch cross-origin stylesheets once (shared across targets).
  const blockedSheetContents = {};
  for (const href of blockedAll) {
    try {
      const res = await page.request.get(href);
      if (res.ok()) blockedSheetContents[href] = await res.text();
    } catch {
      /* ignore */
    }
  }

  await browser.close();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(projectRoot, 'extracted', stamp);
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, 'style-spec.json'),
    JSON.stringify({ url, results, blockedSheetContents }, null, 2),
  );

  const lines = [`# Style fingerprints`, ``, `- URL: ${url}`, ``];
  for (const [name, spec] of Object.entries(results)) {
    if (spec.notFound) {
      lines.push(`## ${name} — NOT FOUND (\`${spec.selector}\`)`, ``);
      continue;
    }
    const el0 = spec.elements[0];
    const hoverRuleCount = (el0?.hoverRules || []).length;
    const pseudoKeys = Object.keys(el0?.pseudo || {});
    const filterVal = el0?.computed?.filter;
    const childFilters = (el0?.children || [])
      .filter((c) => c.computed?.filter)
      .map(
        (c) =>
          `${c.tag}.${(c.classes || []).join('.') || '(no-class)'}: ${c.computed.filter}`,
      );
    lines.push(
      `## ${name} (\`${spec.selector}\`)`,
      `- matched: ${spec.elements.length} el, ${
        el0?.matchedRules.length || 0
      } rules`,
      `- states: ${
        [...new Set((el0?.matchedRules || []).flatMap((r) => r.states))].join(
          ', ',
        ) || 'base only'
      }`,
      `- hover rules: ${hoverRuleCount} (see hoverRules[] in style-spec.json)`,
      ...(spec.hoverDelta && Object.keys(spec.hoverDelta).length
        ? [
            `- hover delta: ${Object.entries(spec.hoverDelta)
              .map(([k, d]) => `${k}: ${d.base} → ${d.hover}`)
              .join('; ')}`,
          ]
        : [`- hover delta: (none / not captured)`]),
      ...(spec.hoverChildDelta?.length
        ? spec.hoverChildDelta.flatMap((c) => {
            const label = `${c.tag}(${(c.classes || '').split(' ')[0] || '?'})`;
            const lines2 = [];
            // Report ALL non-empty style props (not just opacity/bg) so patterns
            // like height/width/left changes on ::before are never silently dropped.
            const styleProps = Object.entries(c.styles || {})
              .filter(
                ([, v]) =>
                  v &&
                  v !== 'none' &&
                  v !== 'normal' &&
                  v !== 'auto' &&
                  v !== '0px',
              )
              .map(([k, v]) => `${k}:${v}`);
            if (styleProps.length)
              lines2.push(`- hovered child ${label}: ${styleProps.join('; ')}`);
            // Pseudo-element styles under parent hover (key pattern: ::before height/width expansion)
            for (const [pe, pv] of Object.entries(c.pseudo || {})) {
              const pvStr = Object.entries(pv)
                .map(([k, v]) => `${k}:${v}`)
                .join('; ');
              lines2.push(`  - ${label}${pe} (hovered): ${pvStr}`);
            }
            return lines2;
          })
        : []),
      // Hover-cascade rules: CSS rules where hovering THIS element changes a descendant.
      // Catches translateY slide-ups, opacity fades on wrapper divs — depth-independent,
      // works at any viewport (pure CSS rule scan, no DOM traversal or hover simulation).
      ...(spec.elements[0]?.hoverCascadeRules?.length
        ? spec.elements[0].hoverCascadeRules.map((r) => {
            const mq = r.media ? ` [@media ${r.media}]` : '';
            return `- hover→child: \`${r.selector}\`${mq} → ${r.css}`;
          })
        : [`- hover→child: (none found)`]),
      `- pseudo-elements: ${pseudoKeys.join(', ') || '(none)'}`,
      `- filter: ${filterVal || '(none)'}`,
      ...(childFilters.length
        ? [`- child filters: ${childFilters.join('; ')}`]
        : []),
      `- @keyframes: ${Object.keys(spec.keyframes).join(', ') || '(none)'}`,
      `- listeners: ${
        Array.isArray(spec.listeners)
          ? spec.listeners.map((l) => l.type).join(', ') || '(none)'
          : '(n/a)'
      }`,
      ``,
    );
  }
  await writeFile(join(outDir, 'report.md'), lines.join('\n'));

  console.log(
    `\n✓ Extracted ${targets.length} target(s) → ${join('extracted', stamp)}`,
  );
})();
