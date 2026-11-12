'use strict';

/*
 * Swak Heading Jump
 * 編集モード（ライブプレビュー・ソース）で目次の見出しをクリックしたとき、
 * その見出しを画面の一番上にそろえる。通信・ノートへの書き込みは行わない。
 */

const { Plugin, MarkdownView } = require('obsidian');
const { EditorView } = require('@codemirror/view');

const OUTLINE_ITEM_SELECTOR = '.workspace-leaf-content[data-type="outline"] .tree-item-self';
const OUTLINE_LEAF_SELECTOR = '.workspace-leaf-content[data-type="outline"]';
const TOP_MARGIN_PX = 8;
const TOLERANCE_PX = 2;
// 表・コールアウトの描画が遅れて高さが変わるため、位置を確かめ直す時刻（ミリ秒）
const SETTLE_CHECKS_MS = [0, 60, 150, 300, 600];
const INTERRUPT_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];

/** 目次の表示文字列と見出しの原文を比べるため、Markdownの装飾を外す */
function plainHeadingText(text) {
  return String(text || '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|==|~~|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 行要素の上端と、スクロール領域の上端との差（px）。描画範囲外なら null */
function lineOffsetFromTop(cm, line) {
  if (line < 0 || line >= cm.state.doc.lines) return null;
  const pos = cm.state.doc.line(line + 1).from;
  if (pos < cm.viewport.from || pos > cm.viewport.to) return null;
  const { node } = cm.domAtPos(pos);
  const element = node.nodeType === 1 ? node : node.parentElement;
  const lineEl = element && element.closest('.cm-line');
  if (!lineEl) return null;
  return lineEl.getBoundingClientRect().top - cm.scrollDOM.getBoundingClientRect().top;
}

/**
 * 見出し行を画面の一番上へそろえる。描画の遅れで位置がずれたら補正し直す。
 * 利用者がスクロール・クリック・キー操作をしたら、そこで補正をやめる。
 * @returns {{ cancel: () => void, done: Promise<boolean> }}
 */
function scrollLineToTop(cm, line, options = {}) {
  const margin = options.margin ?? TOP_MARGIN_PX;
  const checks = options.checks ?? SETTLE_CHECKS_MS;
  const win = cm.dom.ownerDocument.defaultView || window;
  const timers = [];
  let cancelled = false;
  let finish;
  const done = new Promise(resolve => { finish = resolve; });

  const stop = (result = false) => {
    if (cancelled) return;
    cancelled = true;
    timers.forEach(id => win.clearTimeout(id));
    INTERRUPT_EVENTS.forEach(type => cm.scrollDOM.removeEventListener(type, onInterrupt, true));
    finish(result);
  };
  const onInterrupt = () => stop(false);

  const align = () => {
    if (cancelled) return false;
    const offset = lineOffsetFromTop(cm, line);
    if (offset === null) {
      // 描画範囲外。CodeMirrorに描画範囲まで運ばせてから、次の確認で微調整する。
      const pos = cm.state.doc.line(line + 1).from;
      cm.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: margin }) });
      return false;
    }
    const diff = offset - margin;
    if (Math.abs(diff) <= TOLERANCE_PX) return true;
    cm.scrollDOM.scrollTop += diff;
    return false;
  };

  // 補正の合図となる操作は、補正の開始後に起きたものだけを対象にする
  win.requestAnimationFrame(() => {
    if (cancelled) return;
    INTERRUPT_EVENTS.forEach(type => cm.scrollDOM.addEventListener(type, onInterrupt, true));
  });

  checks.forEach((ms, index) => {
    timers.push(win.setTimeout(() => {
      win.requestAnimationFrame(() => {
        if (cancelled) return;
        const aligned = align();
        if (index === checks.length - 1) stop(aligned);
      });
    }, ms));
  });

  return {
    cancel: () => stop(false),
    done
  };
}

class SwakHeadingJumpPlugin extends Plugin {
  onload() {
    this.pending = null;
    this.attach(document);
    this.registerEvent(this.app.workspace.on('window-open', (_win, popout) => this.attach(popout.document)));
  }

  onunload() {
    if (this.pending) this.pending.cancel();
  }

  attach(doc) {
    this.registerDomEvent(doc, 'click', event => this.onOutlineAction(event), { capture: true });
    this.registerDomEvent(doc, 'keydown', event => {
      if (event.key === 'Enter') this.onOutlineAction(event);
    }, { capture: true });
  }

  onOutlineAction(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest(OUTLINE_ITEM_SELECTOR);
    if (!item) return;
    const text = plainHeadingText((item.querySelector('.tree-item-inner') || item).textContent);
    const occurrence = this.countPrecedingSameText(item, text);
    // 目次側のクリック処理（カーソル移動）が終わってから位置を決める
    window.setTimeout(() => this.jump(text, occurrence), 0);
  }

  countPrecedingSameText(item, text) {
    const leaf = item.closest(OUTLINE_LEAF_SELECTOR);
    if (!leaf) return 0;
    let count = 0;
    for (const other of leaf.querySelectorAll('.tree-item-self')) {
      if (other === item) break;
      const otherText = plainHeadingText((other.querySelector('.tree-item-inner') || other).textContent);
      if (otherText === text) count += 1;
    }
    return count;
  }

  resolveLine(view, text, occurrence) {
    const cache = view.file ? this.app.metadataCache.getFileCache(view.file) : null;
    const headings = (cache && cache.headings) || [];
    // 1. 目次がカーソルを見出し行へ動かしていれば、それを使う
    const cursorLine = view.editor.getCursor().line;
    const atCursor = headings.find(h => h.position.start.line === cursorLine);
    if (atCursor && plainHeadingText(atCursor.heading) === text) return cursorLine;
    // 2. 同じ名前の見出しは、目次上の出現順で特定する
    const matches = headings.filter(h => plainHeadingText(h.heading) === text);
    if (!matches.length) return null;
    return matches[Math.min(occurrence, matches.length - 1)].position.start.line;
  }

  jump(text, occurrence) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.getMode() === 'preview') return; // 閲覧モードは標準の動きで正常
    const cm = view.editor && view.editor.cm;
    if (!cm) return;
    const line = this.resolveLine(view, text, occurrence);
    if (line === null) return;
    if (this.pending) this.pending.cancel();
    this.pending = scrollLineToTop(cm, line);
  }
}

module.exports = SwakHeadingJumpPlugin;
module.exports.scrollLineToTop = scrollLineToTop;
module.exports.plainHeadingText = plainHeadingText;
