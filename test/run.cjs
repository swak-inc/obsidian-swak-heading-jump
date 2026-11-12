// 回帰テスト: 見出しが画面の一番上（8px下）にそろうこと、利用者の操作で補正が止まること
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

const outDir = path.join(__dirname, '.build');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'entry.js')],
    bundle: true, format: 'iife', outfile: path.join(outDir, 'bundle.js'),
    alias: { obsidian: path.join(__dirname, 'obsidian-stub.js') }, logLevel: 'error'
  });
  const js = fs.readFileSync(path.join(outDir, 'bundle.js'), 'utf8');
  const css = `
    body { margin: 0; font: 16px/1.6 sans-serif; }
    #host { height: 600px; }
    #host .cm-editor { height: 100%; }
    .cm-scroller { overflow: auto; }
    .h1-line { padding: 8px 16px; background: #0B3D63; color: #fff; font-size: 1.6em; }
    .before-h1 { padding-top: 46px; }
    .late-widget { background: #E6EFF7; }`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.setContent(`<style>${css}</style><div id="host"></div><script>${js}</script>`);
  await page.waitForFunction(() => window.harness);

  const jump = (headingIndex, opts = {}) => page.evaluate(async ({ headingIndex, opts }) => {
    const { view, headingLines, scrollLineToTop } = window.harness;
    const line = headingLines[headingIndex];
    const job = scrollLineToTop(view, line);
    if (opts.interruptAfterMs) {
      await new Promise(r => setTimeout(r, opts.interruptAfterMs));
      view.scrollDOM.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 40 }));
      view.scrollDOM.scrollTop += 300; // 利用者のスクロール
    }
    const aligned = await job.done;
    await new Promise(r => setTimeout(r, 700)); // 補正が止まった後も動かないことを確認
    const pos = view.state.doc.line(line + 1).from;
    const { node } = view.domAtPos(pos);
    const el = (node.nodeType === 1 ? node : node.parentElement).closest('.cm-line');
    const offset = el ? el.getBoundingClientRect().top - view.scrollDOM.getBoundingClientRect().top : null;
    return { aligned, offset: offset === null ? null : Math.round(offset), text: el && el.textContent };
  }, { headingIndex, opts });

  // 標準のscrollIntoViewだけだと、遅れて伸びる部品でずれることを参考表示する
  const baseline = await page.evaluate(async () => {
    const { view, headingLines, EditorView } = window.harness;
    view.scrollDOM.scrollTop = 0;
    await new Promise(r => setTimeout(r, 400));
    const line = headingLines[40];
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(line + 1).from, { y: 'start' }) });
    await new Promise(r => setTimeout(r, 800));
    const { node } = view.domAtPos(view.state.doc.line(line + 1).from);
    const el = (node.nodeType === 1 ? node : node.parentElement).closest('.cm-line');
    return el ? Math.round(el.getBoundingClientRect().top - view.scrollDOM.getBoundingClientRect().top) : 'off-screen';
  });
  console.log(`参考: 標準の移動だけの場合の見出し位置 = ${baseline}px（理想は0〜8px）`);

  const cases = [
    ['下へ遠くジャンプ', 45],
    ['上へ遠くジャンプ', 3],
    ['少し下へジャンプ', 6],
    ['末尾付近へジャンプ', 0], // 実際の番号は下で上書き
  ];
  const count = await page.evaluate(() => window.harness.headingLines.length);
  cases[3][1] = count - 2;
  let failed = 0;
  for (const [name, index] of cases) {
    const r = await jump(index);
    const ok = r.offset !== null && Math.abs(r.offset - 8) <= 2 && r.text === `# 見出し${index + 1}`;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}（見出し${index + 1}）: 上端からの位置 ${r.offset}px`);
    if (!ok) failed++;
  }

  const interrupted = await jump(30, { interruptAfterMs: 20 });
  const interruptOk = interrupted.offset === null || Math.abs(interrupted.offset - 8) > 50;
  console.log(`${interruptOk ? 'PASS' : 'FAIL'} 利用者がスクロールしたら補正をやめる: 位置 ${interrupted.offset}px`);
  if (!interruptOk) failed++;

  const texts = await page.evaluate(() => {
    const f = window.harness.plainHeadingText;
    return [f('1. **重要**な `設定`'), f('[[note|表示名]] と [リンク](https://example.com)'), f('==強調==  の   ~~旧~~'), f('P0001_工事積算')];
  });
  assert.deepStrictEqual(texts, ['1. 重要な 設定', '表示名 と リンク', '強調 の 旧', 'P0001_工事積算']);
  console.log('PASS 目次の表示文字と見出しの照合');

  await browser.close();
  if (failed) { console.error(`${failed}件失敗`); process.exit(1); }
  console.log('すべて合格');
})().catch(e => { console.error(e); process.exit(1); });
