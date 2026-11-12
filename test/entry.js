// 実物のCodeMirror 6で、遅れて高さが伸びる部品（表・コールアウト相当）が多い長文を再現する
// Obsidianと同じく require で読み込み、プラグインと同一のCodeMirrorを使う
const { EditorView, Decoration, WidgetType } = require('@codemirror/view');
const { EditorState, StateField, RangeSetBuilder } = require('@codemirror/state');
const plugin = require('../main.js');

class LateGrowWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('div');
    el.className = 'late-widget';
    el.style.height = '24px';
    setTimeout(() => { el.style.height = '220px'; }, 120 + Math.random() * 200);
    return el;
  }
  get estimatedHeight() { return 24; }
  eq() { return false; }
}

const lines = [];
const headingLines = [];
for (let i = 0; lines.length < 1500; i++) {
  if (i % 30 === 0) { lines.push(''); headingLines.push(lines.length); lines.push(`# 見出し${headingLines.length}`); }
  else if (i % 7 === 0) lines.push('WIDGET');
  else lines.push(`本文 ${i} ` + 'テキスト'.repeat(i % 5 + 1));
}

const decoField = StateField.define({
  create(state) {
    const b = new RangeSetBuilder();
    for (let n = 1; n <= state.doc.lines; n++) {
      const line = state.doc.line(n);
      if (line.text === 'WIDGET') b.add(line.from, line.to, Decoration.replace({ widget: new LateGrowWidget(), block: true }));
      else if (line.text.startsWith('# ')) b.add(line.from, line.from, Decoration.line({ class: 'h1-line' }));
      else if (line.text === '' && n < state.doc.lines && state.doc.line(n + 1).text.startsWith('# ')) b.add(line.from, line.from, Decoration.line({ class: 'before-h1' }));
    }
    return b.finish();
  },
  update(v) { return v; },
  provide: f => EditorView.decorations.from(f)
});

const view = new EditorView({
  parent: document.getElementById('host'),
  state: EditorState.create({ doc: lines.join('\n'), extensions: [decoField] })
});
window.harness = { view, headingLines, scrollLineToTop: plugin.scrollLineToTop, plainHeadingText: plugin.plainHeadingText, EditorView };
