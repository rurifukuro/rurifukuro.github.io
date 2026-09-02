# タップ目標 48px 是正の残作業（★UI-REACH）

きゃすりん Rev517 / 批判的チェック ラウンド57 C-1 の**作業中断メモ**（2026-08-31）。
ユーザー指示「一度作業を止めて」→「現状の記録を行って作業を止めて欲しい」で停止した地点を残す。

## いまの状態

```
node scripts/check-tap-target.mjs
```

```
タップ目標チェック: 自己テスト 18/18 OK / 面 21 本・押せる物 115 個・例外 7 種
タップ目標チェック: NG
  [FLOOR] public/kyasuho-support/index.html の <a class="back">「← アプリ一覧に戻る」に **48px の床の宣言が無い**
```

- 検出器は**完成していて動いている**。走査は `public/**/*.html` ＋ `src/**/*.astro`
  （`node_modules` / `.git` / `dist` / `.astro` / `*.bak_*` は除外）。
- 例外は **7 種**（`inline-mailto` / `inline-tel` / `field-label` / `honeypot` / `checkbox-radio` /
  `inline-in-sentence` / `skip-link`）。`why` は 20 文字以上を必須にしてある。
- **是正済みの面**（すべて `.bak_rev517c` あり）:
  `public/kyasuho/index.html` / `public/torehan/index.html` / `public/urehan/index.html` /
  `public/urehan/privacy.html` / `public/torehan/invite/index.html` / `public/torehan/join/index.html`

## `[FLOOR]` 50 件の仕分け（vw=375 での実測値つき）

### A 群 — 実測で既に 48px 以上。**`min-height:48px` の宣言を足すだけ＝見た目は変わらない**

偶然 48 を超えているだけの状態を、**宣言で保証する**のが目的。

`.cta`(62.8) / `.kp-text`(51.5, 128) / `#kp-submit`(55) / unsubscribe 2 面の `button`(53, 58) /
`.btn`・`.btn-store`・`.btn-x`(117.6, 82.4, 119.6) / `.btn-waitlist`(65) / `#waitlist-email`(60) /
`.sister a.link`(51.5) / torehan invite・join の `.copy` / `.card`(198.8, 401.8) / `.featured`(378.7) /
`.rec-item`(99) / `.cta-btn` / PopularSidebar の `a`

### B 群 — 実測 48px 未満。**高さが変わる＝大原則4-B の報告対象**

`.back`(25.2) / kyasuho-support の `<p><a>プライバシーポリシー</a></p>`・`<p><a>利用規約</a></p>`(18) /
アプリ一覧の `a`(16) / `.more`(26.8) / `#t-privacy`(16) / urehan-privacy の「← 瑠璃フクロウ トップ」(17) /
unsubscribe 2 面の `a`(16) / `.cta-detail`(20.4)

実 markup とセレクタ（**この 6 か所が B 群の実体**）:

```
public/urehan/privacy.html:203  <p>連絡先: <a href="mailto:rurifukuro@gmail.com">…</a></p>   ← ja
public/urehan/privacy.html:341  <p><a href="mailto:rurifukuro@gmail.com">…</a></p>          ← en（地の文なし）
public/urehan/privacy.html:888  <p style="margin-top:6px"><a href="../">← 瑠璃フクロウ トップ</a></p>
public/kyasuho-support/index.html:89-90  <p><a …>プライバシーポリシー</a></p> / <p><a …>利用規約</a></p>
public/urehan/invite/index.html:137  <p><a class="more" href="/urehan/" id="t-more">…</a></p>
public/urehan/invite/index.html:139  <p class="foot"><a href="/urehan/privacy.html" id="t-privacy">…</a></p>
```

🔴 `public/urehan/privacy.html` の `[FLOOR]` は**この 3 件だけ**。**地の文に埋まった mailto は
例外で正しく除外されている**（上がっているのは「リンクだけの段落」＝独立導線）。
検出器が過剰に鳴っているのではないか、という疑義は実測で 2 回とも「検出器が正しい」で決着している。

### C 群 — ブログ面（`src/**/*.astro`）。**見た目の変化が大きい＝⏳ゲート候補**

`.nav-logo`(27.2) / `.nav-link.active`(25.8) / `.breadcrumb-link`(22.1) / `.tag`(30.4 × 18 個) /
`.footer-links a`(17) / 各面の `mailto`・`@rurifukuro`(16〜18)

どれも `display` が `inline` / `inline-block` なので、48px 化には `inline-flex` 化が要り
**行の高さが目に見えて増える**＝大原則4-C の「UI の**大きな**変更」に当たりうる。
**自分の判断で実装しない。⏳ゲートとして起票し、ユーザーに聞く**（W24-F＝選択肢から外さない）。

検討して**まだ実装していない**案: 検出器に `PENDING`（⏳ゲート番号を必須にする）枠を作り、
決着まで `exit 1` にしないが**件数は必ず表示する**。件数を黙らせないのが条件（W28-B）。

## 是正の方式（決定済み・未実装）

**既存の CSS ブロックを一切触らず、各面の `</style>` 直前に「★UI-REACH 床」ブロックを 1 つ挿入する。**

- A 群セレクタ → `min-height:48px` のみ
- B 群セレクタ → `display:inline-flex;align-items:center;min-height:48px;padding:0 12px;margin-left:-12px`
  ＋ 周囲の `margin` で総高を相殺（＝`HIT-SLOP-BASE` の Web 版。**見た目の位置を 1px も動かさない**）
- `<p><a>…</a></p>` のようにセレクタが書けないものは `<p class="legal-link">` のようにクラスを付ける

この方式を選んだ理由:

1. 置換の安全性が高い（W26＝終端を書ける・`count == 1` を assert できる）。
   既存の複雑な CSS ブロックを正規表現で書き換えるより事故が少ない。
2. 詳細度と**順序**で確実に効く。
3. `@media` の中ではないので、検出器の `parseTopLevelRules` が確実に拾える。
4. 「なぜ 48px なのか」の根拠コメントを 1 箇所に集約できる。

## 残手順（この順で再開する）

1. **A 群の宣言追加**（見た目不変＝報告不要）。
2. **B 群の是正**（高さが変わる＝**ユーザーへ一言添える**／大原則4-B）。
3. **C 群を ⏳ゲートとして台帳へ起票**（きゃすりんの `SPEC.md` §63-13 ではなく、**ポータルの決定を書く場所**へ。
   W24-D＝台帳を 2 つ作らない。置き場が無いなら 1 つ決めてから起票する）。
4. **CI 結線（CI-SCAN）**。`package.json` に検査スクリプトが**1 本も無い**ので新設する:
   - `"checks": "node scripts/check-tap-target.mjs"`
   - `.github/workflows/deploy.yml` の `npm ci` の**直後**に `- run: npm run checks` を足す。
     **走る面はこの 1 本だけ**（`deploy.yml` 以外に workflow は無い）。
5. **陰性対照**。`.bak_rev517c` の版に戻して検出器が**実際に赤くなるか**を実測する。
   緑のまま通ったら検出器が壊れている（W28-B＝検出器の誤りは必ず甘い方向へ倒れる）。
6. **検出器の欠陥を 1 件直す**（甘い方向ではないが、人が場所を特定できない）:
   出力メッセージのテキスト抽出がズレる。実測例＝
   `<input id="kp-email">「X のユーザー名（@ は不要）」` /
   `<input id="kp-x-handle">「ご担当者名（任意） <label f」` /
   `<input id="kp-contact-name">「Website 送信する<」`。
   **`[FLOOR]` の判定そのものは正しい**。壊れているのは引用テキストの切り出しだけ。

## 未還元の知見（`web_dev_rules.md` へ ID を採って追記する）

🔴 **JS のテンプレートリテラルで正規表現を組むと、`\b` は単語境界ではなく制御文字 0x08 になり、
`\s` はただの `s` になる**（文字列エスケープが正規表現より先に食う）。
**例外も警告も出ず、黙って一致しなくなる**。根治は `String.raw`。
さらに **Python の heredoc 経由でファイルを書くと `\b` が 0x08 の実バイトとしてソースに焼き付く**
（`cat -A` で `^H` として見える）。

## 未決定

`scripts/check-tap-target.mjs.bak_rev517d` を残すか消すかを決めていない。
