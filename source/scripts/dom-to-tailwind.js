/**
 * PROOF OF CONCEPT — structure -> Tailwind transpiler.
 *
 * Walks a live element's DOM subtree and emits JSX where each node carries
 * Tailwind classes derived from its COMPUTED-STYLE DELTA vs its parent (so
 * inherited props aren't re-stamped on every child). Values with no Tailwind
 * token become arbitrary values (e.g. p-[50px], text-[#1cabe2]).
 *
 * This is a high-fidelity DRAFT generator, not a finished Canvas component:
 * output uses arbitrary values (not design tokens), mirrors framework wrapper
 * nesting, and has no props/slots or :hover/keyframes/JS. Clean up afterward.
 *
 * Usage:
 *   node scripts/dom-to-tailwind.js --url <url> --selector "<css>" \
 *        [--max-depth 5] [--accept-cookies] [--headless]
 *
 * Output (in extracted/<timestamp>/): draft.jsx + tree.json
 */

import { mkdir, writeFile } from 'fs/promises';
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
const url = val('--url');
const selector = val('--selector');
const maxDepth = parseInt(val('--max-depth') || '5', 10);
const headless = args.includes('--headless');
const acceptCookies = args.includes('--accept-cookies');

if (!url || !selector) {
  console.error(
    'Usage: node scripts/dom-to-tailwind.js --url <url> --selector "<css>" [--max-depth 5] [--accept-cookies] [--headless]',
  );
  process.exit(1);
}

// Serialized into the page. Returns a nested {tag,classes,text,img,children}.
function buildTree({ sel, maxDepth }) {
  const cv = document.createElement('canvas').getContext('2d');
  const color = (v) => {
    try {
      cv.fillStyle = '#000';
      cv.fillStyle = v;
      return cv.fillStyle;
    } catch {
      return v;
    }
  };
  const px = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const isTransparent = (v) => /rgba\(0, 0, 0, 0\)|transparent/.test(v);

  const classesFor = (cs, parentCS) => {
    const c = [];
    const d = cs.display;
    if (d === 'flex') c.push('flex');
    else if (d === 'inline-flex') c.push('inline-flex');
    else if (d === 'grid') c.push('grid');
    else if (d === 'inline-block') c.push('inline-block');
    else if (d === 'none') c.push('hidden');

    if (d === 'flex' || d === 'inline-flex') {
      if (cs.flexDirection === 'column') c.push('flex-col');
      if (cs.flexWrap === 'wrap') c.push('flex-wrap');
      const jc = {
        center: 'justify-center',
        'flex-end': 'justify-end',
        'space-between': 'justify-between',
        'space-around': 'justify-around',
      }[cs.justifyContent];
      if (jc) c.push(jc);
      const ai = {
        center: 'items-center',
        'flex-start': 'items-start',
        'flex-end': 'items-end',
      }[cs.alignItems];
      if (ai) c.push(ai);
      const gap = px(cs.gap) || px(cs.columnGap);
      if (gap) c.push(`gap-[${gap}px]`);
    }

    // padding
    const pt = px(cs.paddingTop),
      pr = px(cs.paddingRight),
      pb = px(cs.paddingBottom),
      pl = px(cs.paddingLeft);
    if (pt && pt === pr && pr === pb && pb === pl) c.push(`p-[${pt}px]`);
    else {
      if (pt && pt === pb) c.push(`py-[${pt}px]`);
      else {
        if (pt) c.push(`pt-[${pt}px]`);
        if (pb) c.push(`pb-[${pb}px]`);
      }
      if (pl && pl === pr) c.push(`px-[${pl}px]`);
      else {
        if (pl) c.push(`pl-[${pl}px]`);
        if (pr) c.push(`pr-[${pr}px]`);
      }
    }

    // margin (skip auto)
    const mt = px(cs.marginTop),
      mb = px(cs.marginBottom);
    if (mt) c.push(`mt-[${mt}px]`);
    if (mb) c.push(`mb-[${mb}px]`);

    // background
    if (!isTransparent(cs.backgroundColor))
      c.push(`bg-[${color(cs.backgroundColor)}]`);
    if (/url\(/.test(cs.backgroundImage)) c.push('bg-cover bg-center');

    // border
    const bw = px(cs.borderTopWidth);
    if (bw) {
      c.push(`border-[${bw}px]`);
      c.push(`border-[${color(cs.borderTopColor)}]`);
    }
    const br = px(cs.borderTopLeftRadius);
    if (br) c.push(`rounded-[${br}px]`);
    if (cs.boxShadow && cs.boxShadow !== 'none')
      c.push(`shadow-[${cs.boxShadow.replace(/\s+/g, '_')}]`);

    // inherited props — only when different from parent
    const inh = (prop, fn) => {
      if (!parentCS || cs[prop] !== parentCS[prop]) fn(cs[prop]);
    };
    inh('color', (v) => c.push(`text-[${color(v)}]`));
    inh('fontSize', (v) => {
      const n = px(v);
      if (n) c.push(`text-[${n}px]`);
    });
    inh('fontWeight', (v) =>
      c.push(
        {
          400: 'font-normal',
          500: 'font-medium',
          600: 'font-semibold',
          700: 'font-bold',
          900: 'font-black',
        }[v] || `font-[${v}]`,
      ),
    );
    inh('lineHeight', (v) => {
      const n = px(v);
      if (n) c.push(`leading-[${n}px]`);
    });
    inh('letterSpacing', (v) => {
      const n = px(v);
      if (n) c.push(`tracking-[${n}px]`);
    });
    inh('textTransform', (v) => {
      if (v === 'uppercase') c.push('uppercase');
      else if (v === 'capitalize') c.push('capitalize');
    });
    inh('textAlign', (v) => {
      if (v === 'center') c.push('text-center');
      else if (v === 'right') c.push('text-right');
    });

    if (cs.position !== 'static') c.push(cs.position);
    return c;
  };

  const node = (el, depth, parentCS) => {
    const cs = getComputedStyle(el);
    const classes = classesFor(cs, parentCS);
    const kids = [...el.children];
    let children = [];
    let text = null;
    if (kids.length === 0)
      text = (el.textContent || '').trim().slice(0, 140) || null;
    else if (depth < maxDepth)
      children = kids.map((k) => node(k, depth + 1, cs));
    else text = `/* ${kids.length} children truncated at depth ${maxDepth} */`;
    return {
      tag: el.tagName.toLowerCase(),
      classes,
      text,
      img: el.tagName === 'IMG' ? el.getAttribute('src') : null,
      children,
    };
  };

  const root = document.querySelector(sel);
  if (!root) return null;
  return node(
    root,
    0,
    root.parentElement ? getComputedStyle(root.parentElement) : null,
  );
}

function toJSX(n, indent) {
  const pad = '  '.repeat(indent);
  const cls = n.classes.length ? ` className="${n.classes.join(' ')}"` : '';
  const tag = n.tag === 'a' ? 'a href="#"' : n.tag;
  const close = n.tag === 'a' ? 'a' : n.tag;
  if (n.img) return `${pad}<img${cls} src="${n.img}" alt="" />`;
  if (n.children.length) {
    const inner = n.children.map((c) => toJSX(c, indent + 1)).join('\n');
    return `${pad}<${tag}${cls}>\n${inner}\n${pad}</${close}>`;
  }
  const txt = n.text ? n.text.replace(/[{}<>]/g, '') : '';
  return `${pad}<${tag}${cls}>${txt}</${close}>`;
}

(async () => {
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (acceptCookies) {
    await page
      .evaluate(() => {
        const b = [...document.querySelectorAll('button,a')].find((x) =>
          /accept|agree|got it|ok/i.test(x.textContent || ''),
        );
        if (b) b.click();
      })
      .catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForSelector(selector, { timeout: 15000 });
  const tree = await page.evaluate(buildTree, { sel: selector, maxDepth });
  await browser.close();

  if (!tree) {
    console.error('Selector not found');
    process.exit(1);
  }

  const jsx =
    `// DRAFT transpiled from ${url} ${selector}\n` +
    `// Arbitrary values, framework nesting, no props/slots/states — clean up before use.\n` +
    `const Draft = () => (\n${toJSX(tree, 1)}\n);\n\nexport default Draft;\n`;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(projectRoot, 'extracted', stamp);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'draft.jsx'), jsx);
  await writeFile(join(outDir, 'tree.json'), JSON.stringify(tree, null, 2));
  console.log(`✓ Draft → ${join('extracted', stamp)}/draft.jsx\n`);
  console.log(jsx);
})();
