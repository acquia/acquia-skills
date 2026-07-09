/**
 * Scrapes a webpage for AI-assisted UI component work.
 *
 * Captures responsive screenshots, HTML, AND full design-token data so that
 * Canvas components can be built with 1:1 fidelity — including pseudo-element
 * animations (::before/::after), @keyframes, CSS custom properties, and
 * :hover/:focus/:active interaction rules that plain HTML capture misses.
 *
 * Usage:
 *   node scripts/scrape-page.js <url>
 *   node scripts/scrape-page.js <url> --headless
 *   node scripts/scrape-page.js <url> --no-screenshots
 *
 * Output (in scraped/<timestamp>/):
 *   screenshot-mobile.png / screenshot-tablet.png / screenshot-desktop.png
 *   page.html                  — full rendered HTML
 *   metadata.json              — page info
 *   design/
 *     tokens.json              — CSS custom properties (design tokens)
 *     animations.css           — all @keyframes blocks
 *     pseudo-elements.json     — ::before/::after computed styles per element
 *     interactions.css         — :hover/:focus/:active/:visited rules
 *     stylesheets/             — raw CSS of every accessible stylesheet
 */

import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith('--'));
const headless = args.includes('--headless');
const noScreenshots = args.includes('--no-screenshots');

if (!url) {
  console.error(
    'Usage: node scripts/scrape-page.js <url> [--headless] [--no-screenshots]',
  );
  process.exit(1);
}

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1512, height: 900 },
];

// ─── Design extraction ────────────────────────────────────────────────────────

async function extractDesignData(page) {
  return page.evaluate(() => {
    const tokens = {};
    const keyframeBlocks = {};
    const interactionRules = [];
    const stylesheets = [];

    // Walk every loaded stylesheet
    for (const sheet of Array.from(document.styleSheets)) {
      let sheetText = '';
      try {
        const rules = Array.from(sheet.cssRules || []);

        const processRules = (ruleList, mediaCondition = null) => {
          for (const rule of Array.from(ruleList)) {
            sheetText += rule.cssText + '\n';

            // @keyframes
            if (rule instanceof CSSKeyframesRule) {
              keyframeBlocks[rule.name] = rule.cssText;
            }

            // CSS custom properties from :root
            if (
              rule instanceof CSSStyleRule &&
              (rule.selectorText === ':root' || rule.selectorText === 'html')
            ) {
              const style = rule.style;
              for (let i = 0; i < style.length; i++) {
                const prop = style[i];
                if (prop.startsWith('--')) {
                  tokens[prop] = style.getPropertyValue(prop).trim();
                }
              }
            }

            // Interaction pseudo-class rules
            if (
              rule instanceof CSSStyleRule &&
              /:(?:hover|focus|active|focus-visible|focus-within|visited|checked|disabled|placeholder)/.test(
                rule.selectorText,
              )
            ) {
              interactionRules.push({
                media: mediaCondition,
                cssText: rule.cssText,
              });
            }

            // Recurse into @media / @supports
            if (
              rule instanceof CSSMediaRule ||
              rule instanceof CSSSupportsRule
            ) {
              const cond = rule.conditionText || rule.media?.mediaText || '';
              processRules(rule.cssRules, cond);
            }
          }
        };

        processRules(rules);
        stylesheets.push({ href: sheet.href || 'inline', css: sheetText });
      } catch (_e) {
        // CORS-restricted external sheet — note URL only
        stylesheets.push({
          href: sheet.href,
          css: null,
          note: 'CORS-restricted',
        });
      }
    }

    // ── Pseudo-element extraction ────────────────────────────────────────────
    // Walk every element; record ::before and ::after when they have
    // non-trivial content OR any animation.
    const pseudoData = [];
    const seen = new Set();

    for (const el of Array.from(document.querySelectorAll('*'))) {
      for (const pseudo of ['::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        const hasContent =
          cs.content !== 'none' && cs.content !== '' && cs.content !== 'normal';
        const hasAnimation = cs.animationName && cs.animationName !== 'none';

        if (!hasContent && !hasAnimation) continue;

        // Build a short stable key to deduplicate identical patterns
        const key = `${el.tagName}|${el.className.trim().split(/\s+/).slice(0, 3).join('.')}|${pseudo}|${cs.animationName}|${cs.content}`;
        if (seen.has(key)) continue;
        seen.add(key);

        pseudoData.push({
          selector:
            el.tagName.toLowerCase() +
            (el.id ? `#${el.id}` : '') +
            (el.className
              ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.')
              : ''),
          pseudo,
          // Content
          content: cs.content,
          display: cs.display,
          position: cs.position,
          // Box
          width: cs.width,
          height: cs.height,
          top: cs.top,
          right: cs.right,
          bottom: cs.bottom,
          left: cs.left,
          // Visual
          background: cs.background,
          backgroundImage: cs.backgroundImage,
          color: cs.color,
          border: cs.border,
          borderRadius: cs.borderRadius,
          opacity: cs.opacity,
          // Transform / animation
          transform: cs.transform,
          animation: cs.animation,
          animationName: cs.animationName,
          animationDuration: cs.animationDuration,
          animationTimingFunction: cs.animationTimingFunction,
          animationIterationCount: cs.animationIterationCount,
          // Font
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          // Misc
          zIndex: cs.zIndex,
          overflow: cs.overflow,
        });
      }
    }

    // ── Computed styles snapshot for landmark elements ───────────────────────
    const landmarkStyles = {};
    const landmarks = [
      'body',
      'header',
      'nav',
      'main',
      'footer',
      'h1',
      'h2',
      'h3',
      'p',
      'a',
      'button',
    ];
    for (const sel of landmarks) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      landmarkStyles[sel] = {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        color: cs.color,
        background: cs.background,
        padding: cs.padding,
        margin: cs.margin,
      };
    }

    return {
      tokens,
      keyframeBlocks,
      interactionRules,
      pseudoData,
      stylesheets,
      landmarkStyles,
    };
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function scrapePage() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = join(projectRoot, 'scraped', timestamp);
  const designDir = join(outputDir, 'design');
  const sheetsDir = join(designDir, 'stylesheets');

  await mkdir(sheetsDir, { recursive: true });

  console.log(`\nScraping: ${url}`);
  console.log(`Output:   scraped/${timestamp}`);
  console.log(`Mode:     ${headless ? 'headless' : 'visible browser'}\n`);

  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 100,
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1512, height: 900 },
  });
  const page = await context.newPage();

  try {
    console.log('Loading page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    if (title.includes('Cloudflare') || title.includes('Attention Required')) {
      console.log('CloudFlare detected — waiting...');
      await page.waitForFunction(
        () =>
          !document.title.includes('Cloudflare') &&
          !document.title.includes('Attention'),
        { timeout: 30000 },
      );
      await page.waitForTimeout(2000);
    }

    console.log(`Page loaded: "${await page.title()}"\n`);

    // ── HTML ──────────────────────────────────────────────────────────────────
    console.log('Saving HTML...');
    await writeFile(join(outputDir, 'page.html'), await page.content());

    // ── Screenshots ───────────────────────────────────────────────────────────
    if (!noScreenshots) {
      console.log('Taking screenshots...');
      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(400);
        const file = `screenshot-${vp.name}.png`;
        await page.screenshot({ path: join(outputDir, file), fullPage: true });
        console.log(`  ${file} (${vp.width}px)`);
      }
      // Reset to desktop
      await page.setViewportSize({ width: 1512, height: 900 });
      await page.waitForTimeout(400);
    }

    // ── Design data extraction ─────────────────────────────────────────────────
    console.log('\nExtracting design tokens & pseudo-element styles...');
    const design = await extractDesignData(page);

    // tokens.json — CSS custom properties
    await writeFile(
      join(designDir, 'tokens.json'),
      JSON.stringify(design.tokens, null, 2),
    );
    console.log(
      `  tokens.json (${Object.keys(design.tokens).length} variables)`,
    );

    // animations.css — @keyframes
    const animCSS = Object.values(design.keyframeBlocks).join('\n\n');
    await writeFile(
      join(designDir, 'animations.css'),
      animCSS || '/* no keyframes found */',
    );
    console.log(
      `  animations.css (${Object.keys(design.keyframeBlocks).length} keyframes: ${Object.keys(design.keyframeBlocks).join(', ') || 'none'})`,
    );

    // pseudo-elements.json
    await writeFile(
      join(designDir, 'pseudo-elements.json'),
      JSON.stringify(design.pseudoData, null, 2),
    );
    console.log(`  pseudo-elements.json (${design.pseudoData.length} entries)`);

    // interactions.css — :hover/:focus/:active rules
    const interactCSS = design.interactionRules
      .map((r) =>
        r.media ? `@media ${r.media} {\n  ${r.cssText}\n}` : r.cssText,
      )
      .join('\n\n');
    await writeFile(
      join(designDir, 'interactions.css'),
      interactCSS || '/* no interaction rules found */',
    );
    console.log(`  interactions.css (${design.interactionRules.length} rules)`);

    // landmark-styles.json — computed styles for h1/h2/button/a etc.
    await writeFile(
      join(designDir, 'landmark-styles.json'),
      JSON.stringify(design.landmarkStyles, null, 2),
    );
    console.log(`  landmark-styles.json`);

    // stylesheets/ — raw CSS per sheet
    let sheetIdx = 0;
    for (const sheet of design.stylesheets) {
      if (!sheet.css) continue;
      const name = sheet.href
        ? sheet.href
            .split('/')
            .pop()
            .split('?')[0]
            .replace(/[^a-z0-9._-]/gi, '-') || `sheet-${sheetIdx}`
        : `inline-${sheetIdx}`;
      await writeFile(join(sheetsDir, `${sheetIdx}-${name}`), sheet.css);
      sheetIdx++;
    }
    console.log(`  stylesheets/ (${sheetIdx} files)`);

    // ── Metadata ──────────────────────────────────────────────────────────────
    await writeFile(
      join(outputDir, 'metadata.json'),
      JSON.stringify(
        {
          url: page.url(),
          title: await page.title(),
          scrapedAt: new Date().toISOString(),
          screenshots: !noScreenshots,
          viewports: noScreenshots
            ? undefined
            : viewports.map((v) => `${v.name}: ${v.width}x${v.height}`),
          design: {
            cssVariables: Object.keys(design.tokens).length,
            keyframes: Object.keys(design.keyframeBlocks).length,
            keyframeNames: Object.keys(design.keyframeBlocks),
            pseudoElements: design.pseudoData.length,
            interactionRules: design.interactionRules.length,
            stylesheets: design.stylesheets.length,
          },
        },
        null,
        2,
      ),
    );

    console.log('\nDone. Output:');
    console.log(`  scraped/${timestamp}/`);
    if (!noScreenshots) {
      console.log(`  ├── screenshot-{mobile,tablet,desktop}.png`);
    }
    console.log(`  ├── page.html`);
    console.log(`  ├── metadata.json`);
    console.log(`  └── design/`);
    console.log(`      ├── tokens.json`);
    console.log(`      ├── animations.css`);
    console.log(`      ├── pseudo-elements.json`);
    console.log(`      ├── interactions.css`);
    console.log(`      ├── landmark-styles.json`);
    console.log(`      └── stylesheets/`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

scrapePage();
