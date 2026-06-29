// Build a single self-contained visual report from the last two recorded runs
// (phase 1 = original markup, phase 2 = after the refactor). Screenshots are
// embedded as data URIs so the .html file opens anywhere with no assets.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const runs = JSON.parse(readFileSync(join(root, '.healwright', 'runs.json'), 'utf8'));
const [phase1, phase2] = runs.slice(-2);

function img(path) {
  if (!path) return '';
  try {
    const b64 = readFileSync(join(root, path)).toString('base64');
    return `<img src="data:image/png;base64,${b64}" alt="" />`;
  } catch {
    return '<div class="noimg">no screenshot</div>';
  }
}

const ICON = { passed: '✓', healed: '⛑', failed: '✗', skipped: '‣' };

function stepCard(s) {
  const healed = s.status === 'healed';
  const diff = healed
    ? `<div class="diff">
         <div class="broke"><span>broke</span><code>${loc(s.healedFrom)}</code></div>
         <div class="fixed"><span>fixed</span><code>${loc(s.action?.locator)}</code></div>
       </div>`
    : '';
  return `<div class="step ${s.status}">
    <div class="shot">${img(s.screenshot)}</div>
    <div class="meta">
      <div class="status">${ICON[s.status] ?? ''} ${s.status}${s.fromCache ? ' · from cache' : ''}</div>
      <div class="text">${escapeHtml(s.step)}</div>
      ${diff}
    </div>
  </div>`;
}

function loc(l) {
  if (!l) return '-';
  const v = l.name ? `${l.value} (${l.name})` : l.value;
  return `${l.strategy}=${escapeHtml(JSON.stringify(v))}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function phaseSection(title, subtitle, run) {
  const heals = run.healCount > 0 ? `<span class="badge heal">${run.healCount} healed</span>` : '';
  return `<section>
    <h2>${title} ${heals}</h2>
    <p class="sub">${subtitle}</p>
    <div class="steps">${run.steps.map(stepCard).join('')}</div>
  </section>`;
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Healwright - visual run report</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 32px; background: #f6f7f9; color: #1a1a1a; }
  h1 { margin: 0 0 4px; }
  .lead { color: #555; margin: 0 0 28px; max-width: 60ch; }
  section { background: #fff; border: 1px solid #e6e6e6; border-radius: 14px; padding: 20px 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  h2 { margin: 0 0 2px; font-size: 20px; }
  .sub { margin: 0 0 18px; color: #666; }
  .badge { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; vertical-align: middle; }
  .badge.heal { background: #fff3cd; color: #8a6d00; }
  .steps { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .step { display: grid; grid-template-columns: 320px 1fr; gap: 18px; align-items: center; border: 1px solid #eee; border-radius: 10px; padding: 12px; }
  .step.healed { border-color: #f0c000; background: #fffdf3; }
  .shot img { width: 320px; border-radius: 6px; border: 1px solid #ddd; display: block; }
  .noimg { width: 320px; height: 180px; display: grid; place-items: center; color: #aaa; background: #fafafa; border-radius: 6px; }
  .status { font-weight: 700; text-transform: capitalize; margin-bottom: 4px; }
  .step.passed .status { color: #0a7d28; }
  .step.healed .status { color: #8a6d00; }
  .step.failed .status { color: #c01818; }
  .text { font-size: 16px; }
  .diff { margin-top: 12px; font-size: 13px; }
  .diff > div { display: flex; gap: 8px; align-items: baseline; }
  .diff span { width: 44px; font-weight: 700; }
  .broke span { color: #c01818; } .fixed span { color: #0a7d28; }
  .diff code { background: #f1f1f1; padding: 2px 6px; border-radius: 4px; }
  @media (max-width: 700px) { .step { grid-template-columns: 1fr; } .shot img, .noimg { width: 100%; } }
</style></head>
<body>
  <h1>Healwright - visual run report</h1>
  <p class="lead">The same plain-English test, run against two versions of the page. Between the two runs the markup was refactored and a selector broke - watch the agent repair it without the test changing.</p>
  ${phaseSection('Phase 1 - original page', 'First run: each step is resolved from scratch and the plan is cached.', phase1)}
  ${phaseSection('Phase 2 - after a refactor', 'Same test, cached plan replayed. One selector no longer matches, so it is healed on the fly.', phase2)}
</body></html>`;

const out = join(root, 'demo', 'visual-report.html');
writeFileSync(out, html);
console.log(`Wrote ${out}`);
