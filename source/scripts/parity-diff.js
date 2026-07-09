/**
 * Pixel-parity diff: compare a LIVE site element against OUR rendered Canvas
 * component in local Workbench, computed-property by computed-property.
 *
 * This closes the loop that hand-matching can't: instead of eyeballing, it
 * prints an exact list of deltas (padding 40px vs 32px, line-height 1.45 vs
 * 1.25, color #1cabe2 vs #0e97cc) so a section can be driven to zero mismatches.
 *
 * Colors are normalized via canvas fillStyle (Workbench emits oklab, live emits
 * rgb — both collapse to the same hex/rgba). Pixel values compare with a 1px
 * tolerance to ignore sub-pixel rounding. width/height and background-image URL
 * are reported but excluded from the score (layout- and asset-dependent).
 *
 * Usage:
 *   node scripts/parity-diff.js --live-url <url> --live-selector "<css>" \
 *        --local-selector "<css>" [--local-url http://localhost:5174/page/home] \
 *        [--accept-cookies] [--headless]
 *
 *   node scripts/parity-diff.js --live-url <url> --local-url <url> \
 *        --pairs <pairs.json> [--accept-cookies] [--headless]
 *     where pairs.json = { "name": { "live": "<css>", "local": "<css>" }, ... }
 *
 * Output (in extracted/<timestamp>/): parity.json + parity.md
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const val = (n) => {
  const i = args.indexOf(n);
  return i !== -1 ? args[i + 1] : undefined;
};
const liveUrl = val('--live-url');
const localUrl = val('--local-url') || 'http://localhost:5174';
const liveSelector = val('--live-selector');
const localSelector = val('--local-selector');
const pairsPath = val('--pairs');
const headless = args.includes('--headless');
const acceptCookies = args.includes('--accept-cookies');

if (!liveUrl || (!pairsPath && !(liveSelector && localSelector))) {
  console.error(
    'Usage:\n' +
      '  node scripts/parity-diff.js --live-url <url> --live-selector "<css>" --local-selector "<css>" [--local-url <url>] [--accept-cookies] [--headless]\n' +
      '  node scripts/parity-diff.js --live-url <url> --pairs <pairs.json> [--local-url <url>] [--accept-cookies] [--headless]',
  );
  process.exit(1);
}

const PX = [
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'columnGap',
  'rowGap',
];
const COLOR = [
  'color',
  'backgroundColor',
  'outlineColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
];
const STR = [
  'fontWeight',
  'fontStyle',
  'textAlign',
  'textTransform',
  'textDecorationLine',
  'display',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'whiteSpace',
  'boxShadow',
  'opacity',
  'position',
];
// Reported but not scored (container-/asset-dependent).
const INFO = ['width', 'height', 'backgroundImage', 'fontFamily'];

// Runs in the page/frame; returns normalized computed values for the first match.
function grab({ sel, px, color, str, info }) {
  const el = document.querySelector(sel);
  if (!el) return { notFound: true };
  const cs = getComputedStyle(el);
  const cv = document.createElement('canvas').getContext('2d');
  const normColor = (v) => {
    try {
      cv.fillStyle = '#000';
      cv.fillStyle = v;
      return cv.fillStyle;
    } catch {
      return v;
    }
  };
  const out = {};
  [...px, ...str].forEach((p) => (out[p] = cs[p]));
  color.forEach((p) => (out[p] = normColor(cs[p])));
  info.forEach(
    (p) => (out[p] = p === 'fontFamily' ? cs[p].split(',')[0].trim() : cs[p]),
  );
  return { style: out };
}

const pxNum = (v) => parseFloat(v);

function diffPair(live, local) {
  const rows = [];
  let scored = 0;
  let matched = 0;
  const check = (prop, isMatch, scoreIt) => {
    const ok = isMatch(live[prop], local[prop]);
    if (scoreIt) {
      scored += 1;
      if (ok) matched += 1;
    }
    if (!ok || !scoreIt)
      rows.push({
        prop,
        live: live[prop],
        local: local[prop],
        ok,
        scored: scoreIt,
      });
    return ok;
  };
  PX.forEach((p) =>
    check(p, (a, b) => Math.abs(pxNum(a) - pxNum(b)) <= 1 || a === b, true),
  );
  COLOR.forEach((p) => check(p, (a, b) => a === b, true));
  STR.forEach((p) => check(p, (a, b) => a === b, true));
  INFO.forEach((p) => check(p, (a, b) => a === b, false));
  return {
    rows,
    scored,
    matched,
    pct: scored ? Math.round((matched / scored) * 100) : 0,
  };
}

const FN_ARG = { px: PX, color: COLOR, str: STR, info: INFO };

(async () => {
  const pairs = pairsPath
    ? JSON.parse(await readFile(pairsPath, 'utf8'))
    : { primary: { live: liveSelector, local: localSelector } };

  const browser = await chromium.launch({ headless });

  // Live page.
  const livePage = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await livePage.goto(liveUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  if (acceptCookies) {
    await livePage
      .evaluate(() => {
        const b = [...document.querySelectorAll('button,a')].find((x) =>
          /accept|agree|got it|ok/i.test(x.textContent || ''),
        );
        if (b) b.click();
      })
      .catch(() => {});
    await livePage.waitForTimeout(400);
  }

  // Local Workbench page (component renders inside a preview iframe).
  const localPage = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await localPage.goto(localUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await localPage.waitForTimeout(2500);
  const localFrame =
    localPage.frames().find((f) => /preview/.test(f.url())) ||
    localPage.frames().find((f) => f !== localPage.mainFrame()) ||
    localPage.mainFrame();

  const results = {};
  for (const [name, p] of Object.entries(pairs)) {
    const live = await livePage
      .evaluate(grab, { sel: p.live, ...FN_ARG })
      .catch(() => ({ notFound: true }));
    const local = await localFrame
      .evaluate(grab, { sel: p.local, ...FN_ARG })
      .catch(() => ({ notFound: true }));
    if (live.notFound || local.notFound) {
      results[name] = {
        error: `notFound live:${!!live.notFound} local:${!!local.notFound}`,
      };
      console.log(`⚠ ${name}: ${results[name].error}`);
      continue;
    }
    results[name] = {
      ...diffPair(live.style, local.style),
      liveSel: p.live,
      localSel: p.local,
    };
    console.log(
      `${name}: ${results[name].pct}% (${results[name].matched}/${results[name].scored})`,
    );
  }

  await browser.close();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(projectRoot, 'extracted', stamp);
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, 'parity.json'),
    JSON.stringify({ liveUrl, localUrl, results }, null, 2),
  );

  const md = [
    `# Parity diff`,
    ``,
    `- live: ${liveUrl}`,
    `- local: ${localUrl}`,
    ``,
  ];
  for (const [name, r] of Object.entries(results)) {
    if (r.error) {
      md.push(`## ${name} — ${r.error}`, ``);
      continue;
    }
    md.push(`## ${name} — ${r.pct}% (${r.matched}/${r.scored} scored props)`);
    const mism = r.rows.filter((x) => x.scored && !x.ok);
    if (!mism.length) md.push(`- ✅ no scored mismatches`);
    mism.forEach((x) =>
      md.push(`- ❌ \`${x.prop}\`: live \`${x.live}\` vs local \`${x.local}\``),
    );
    const info = r.rows.filter((x) => !x.scored);
    info.forEach((x) =>
      md.push(
        `  - (info) \`${x.prop}\`: live \`${x.live}\` vs local \`${x.local}\``,
      ),
    );
    md.push(``);
  }
  await writeFile(join(outDir, 'parity.md'), md.join('\n'));
  console.log(`\n✓ Parity report → ${join('extracted', stamp)}/parity.md`);
})();
