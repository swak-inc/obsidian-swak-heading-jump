# Swak Heading Jump

[![GitHub release](https://img.shields.io/github/v/release/swak-inc/obsidian-swak-heading-jump?style=flat-square&color=0E3A60)](https://github.com/swak-inc/obsidian-swak-heading-jump/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

## Overview / 概要

**English**

In Live Preview and Source mode, clicking a heading in the Outline sometimes moves the cursor without bringing the heading to the top of the editor. Swak Heading Jump aligns the heading to the top every time.

**日本語**

ライブプレビュー・ソースモードで目次の見出しをクリックしても、カーソルだけが移動して見出しが画面の上に来ないことがあります。Swak Heading Jumpは、見出しを毎回画面の一番上にそろえます。

## How it works / 動き

**English**

- Click a heading in the Outline (or press Enter) to place it 8px below the top of the editor.
- Tables and callouts that finish rendering late can shift the position. The plugin keeps checking for about 0.6 seconds and corrects the shift.
- Scrolling, clicking, or typing during that time stops the correction.
- Reading view keeps Obsidian's standard behavior.

**日本語**

- 目次の見出しをクリック（またはEnter）すると、その見出しを画面上端から8pxの位置にそろえます。
- 表やコールアウトの描画が遅れて位置がずれる分は、約0.6秒のあいだ確認して補正します。
- 補正中にスクロール・クリック・キー操作をすると、そこで補正をやめます。
- 閲覧モードはObsidian標準の動きのままです。

## Privacy and safety / 安全性

**English**

- No network access.
- Does not read or write note files. Heading positions come from Obsidian's heading index.
- No settings file is created.

**日本語**

- 通信は行いません。
- ノートファイルの読み書きは行いません。見出しの位置はObsidianの見出し一覧から取得します。
- 設定ファイルも作りません。

## Installation / 導入

**English**

Install from Community plugins in Obsidian, or place `main.js` and `manifest.json` in `.obsidian/plugins/swak-heading-jump/` in your vault and enable the plugin.

**日本語**

Obsidianのコミュニティプラグインからインストールするか、`main.js` と `manifest.json` をVaultの `.obsidian/plugins/swak-heading-jump/` に置いて有効にしてください。

## Development / 開発

```sh
npm install
npm test
```

The test uses CodeMirror 6 with blocks that grow after rendering. It checks that headings align to the top, that user input stops the correction, and that outline text matches heading text.

テストは、描画後に高さが伸びる部品を含むCodeMirror 6で、見出しが上端にそろうこと、利用者の操作で補正が止まること、目次の表示文字と見出しの照合を確認します。

## License

[MIT](./LICENSE) © Swak Inc.
