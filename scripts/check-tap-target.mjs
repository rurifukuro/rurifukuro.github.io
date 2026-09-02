#!/usr/bin/env node
/**
 * ★UI-REACH 検出器（ラウンド57 C-1・Rev517 で新設）
 *
 * ■ 何を守るか
 *   このポータルの静的面（`public/**\/*.html` と `src/**\/*.astro`）で、
 *   **押せる物の高さの下限が CSS に明示されている**ことを要求する。
 *   根拠＝Android の最小タップ目標が 48dp（iOS は 44pt）。
 *
 * ■ なぜ「高さを測る」ではなく「下限の宣言を要求する」のか（W28＝要求型）
 *   CSS から実際の高さを計算しようとすると、継承した `line-height`・フォント差・
 *   折り返しの有無に依存する**推定**にしかならない。推定は必ずどちらかに外れ、
 *   検出器の誤りは**必ず甘い方向へ倒れる**（W28-B）。
 *   そこで「実際に何 px か」ではなく「**48px 以上の床が明示されているか**」を見る。
 *   `padding` の積み上げで結果的に 48px を超えている物も、床の宣言（`min-height:48px`）を
 *   併記させる＝**偶然の 48px を、壊れない 48px に変える**。
 *
 *   これは denylist（「痩せている物を探す」）ではない。押せる物を**全部数えてから**
 *   「床が宣言されているか」を1つずつ当てる＝新しい面・新しいクラスが増えた瞬間に
 *   **黙って素通しされることが構造的に起きない**（W28）。
 *
 * ■ 例外（EXEMPT）
 *   「押せるが 48px の床を当てないのが正しい」物だけを、**理由つきで**列挙する。
 *   理由が空の行は検出器自身が落とす。
 *
 * ■ 走る面（CI-SCAN）
 *   `npm run checks` → `.github/workflows/deploy.yml` の checks ステップ。
 *   ポータルはこの1面しか無い＝ここへ結線しないと**永久に走らない**。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIN_PX = 48; // Android 48dp。iOS の 44pt より厳しいほうに合わせる。

// ───────────────────────────────────────────────────────────────
// 例外表: 「押せるが 48px の床を当てないのが正しい」物だけ。理由必須。
// ───────────────────────────────────────────────────────────────
const EXEMPT = [
  {
    id: 'inline-mailto',
    // 🔴 `mailto:` だからという理由では抜かない＝**地の文の中に埋まっていること**を AND で要求する。
    //   以前は `href` だけで判定しており、`<div class="footer-links">` のように
    //   **並べたナビの中のメールリンク**（実測 16px）まで素通ししていた。
    //   例外の誤りは必ず**甘い方向へ倒れる**（W28-B）。
    match: (el) => el.tag === 'a' && /^mailto:/i.test(el.href || '') && el.inlineInTextBlock(),
    why: '**地の文の中に埋まった**メールリンク＝行の中に収まるのが正しい（箱を 48px にすると段落が割れる）。並べたナビの中の `mailto` はここに当たらない。',
  },
  {
    id: 'inline-tel',
    match: (el) => el.tag === 'a' && /^tel:/i.test(el.href || '') && el.inlineInTextBlock(),
    why: '**地の文の中に埋まった**電話リンク＝行の中に収まるのが正しい（`mailto` と同じ理由）。',
  },
  {
    id: 'field-label',
    match: (el) => el.tag === 'label' && el.wrapsTextField,
    why: '入力欄の**見出し**。押す物は下の `input` 側（実測 51.5〜128px）で、この見出しは高さを持たない案内文。',
  },
  {
    id: 'honeypot',
    match: (el) => el.hiddenByAncestorClass('hp', 'tester-hp', 'kp-hp'),
    why: 'スパム除けの honeypot＝人には見せない欄。人が押す物ではない。',
  },
  {
    id: 'checkbox-radio',
    match: (el) => el.tag === 'input' && /^(checkbox|radio)$/i.test(el.type || ''),
    why: 'ネイティブのチェックボックス／ラジオは OS が寸法を決める（実測 13〜20px）。当たり判定は**それを包む `label`** 側が持つ＝そちらをこの検出器が数えている。',
  },
  {
    id: 'inline-in-sentence',
    match: (el) => el.inlineInTextBlock(),
    why:
      '地の文の中に埋まったリンク＝**行の高さそのものが当たり判定の上限**になる（WCAG 2.5.8 の '
      + '「インライン」例外と同じ理屈）。ここを 48px にすると、囲んでいる文のほうが不自然に間延びする。'
      + '判定は「囲んでいるブロックが地の文のタグ（p / footer / li / 見出し 等）であり、かつ '
      + 'リンク以外の文字がそのブロックに在る」ことの両方＝`div` や `nav` の直下（＝並べたナビ）は当たらない。',
  },
  {
    id: 'skip-link',
    match: (el) => el.tag === 'a' && (el.href || '').startsWith('#') && /skip|スキップ/i.test(el.text || ''),
    why: 'キーボード操作専用のスキップリンク＝マウス／指では押さない。',
  },
];
for (const e of EXEMPT) {
  if (!e.why || e.why.length < 20) {
    console.error(`タップ目標チェック: 例外 "${e.id}" の理由が空か短すぎる＝例外表は理由つきでしか置けない`);
    process.exit(1);
  }
}

// ───────────────────────────────────────────────────────────────
// CSS: `<style>` の中身から「トップレベルのルール」だけを拾う。
//   @media / @supports の中にある宣言は**床の根拠にしない**
//   （画面幅や機能で消えるものは「常に 48px ある」の証明にならない）。
// ───────────────────────────────────────────────────────────────
export function parseTopLevelRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let depth = 0, buf = '', i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      if (depth === 0) {
        const sel = buf.trim();
        buf = '';
        if (sel.startsWith('@')) { depth = 1; i++; continue; }
        // 通常ルール: 対応する `}` まで
        let d = 1, j = i + 1;
        while (j < src.length && d > 0) {
          if (src[j] === '{') d++;
          else if (src[j] === '}') d--;
          j++;
        }
        rules.push({ selector: sel, body: src.slice(i + 1, j - 1) });
        i = j;
        continue;
      }
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      buf = '';
    } else if (depth === 0) {
      buf += ch;
    }
    i++;
  }
  return rules;
}

/** ルールが 48px 以上の「床」を宣言しているか。 */
export function declaresFloor(body) {
  const re = /(?:^|;|\s)(min-height|height)\s*:\s*([0-9.]+)\s*(px|rem|em)/gi;
  let m;
  while ((m = re.exec(body))) {
    const n = parseFloat(m[2]);
    const px = m[3].toLowerCase() === 'px' ? n : n * 16;
    if (px >= MIN_PX) return true;
  }
  return false;
}

/** セレクタの**いちばん右の複合セレクタ**が要素に当たるか（子孫・子は右端だけ見る＝甘くない側へ倒す）。 */
export function rightmostMatches(selector, el) {
  for (let part of selector.split(',')) {
    part = part.trim();
    if (!part) continue;
    const last = part.split(/\s+|>|\+|~/).filter(Boolean).pop();
    if (!last) continue;
    const compound = last.replace(/::?[a-z-]+(\([^)]*\))?/gi, ''); // :hover / ::before を落とす
    if (!compound) continue;
    const tagM = compound.match(/^[a-z][a-z0-9]*/i);
    const tag = tagM ? tagM[0].toLowerCase() : null;
    const classes = [...compound.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((x) => x[1]);
    const ids = [...compound.matchAll(/#([A-Za-z0-9_-]+)/g)].map((x) => x[1]);
    if (tag && tag !== el.tag) continue;
    if (!tag && classes.length === 0 && ids.length === 0) continue;
    if (classes.some((c) => !el.classes.includes(c))) continue;
    if (ids.some((d) => d !== el.id)) continue;
    return true;
  }
  return false;
}

// ───────────────────────────────────────────────────────────────
// HTML/Astro からタップ目標を数える
// ───────────────────────────────────────────────────────────────
const TAP_TAGS = new Set(['a', 'button', 'label', 'select', 'textarea', 'input']);
/** 地の文を入れるタグ＝この直下のリンクだけが「文中のリンク」になりうる。 */
const TEXT_BLOCK = 'p|footer|li|td|th|h[1-6]|small|figcaption|blockquote|dd|dt';
/** 地の文ではない箱＝ここが直近の親なら、並べたナビ／カード扱いで床を要求する。 */
const NON_TEXT_BLOCK = 'div|nav|section|main|header|aside|form|ul|ol|table|tr|button|label';

export function collectTapTargets(html) {
  // コメントアウトされた markup は出荷されない＝数えない
  const src = html.replace(/<!--[\s\S]*?-->/g, '');
  const out = [];
  const tagRe = /<(a|button|label|select|textarea|input)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(src))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const attr = (n) => {
      const r = new RegExp(`\\b${n}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
      return r ? (r[2] ?? r[3] ?? r[4]) : null;
    };
    // 🔴 `m` は while ループで**使い回される変数**＝後から呼ばれるメソッドの中で `m.index` を読むと
    //    別のタグの位置（またはループ終了後の null）を読む。要素ごとの位置はここで値として捕まえる。
    const at = m.index;
    const type = attr('type');
    if (tag === 'input' && /^(hidden|submit|reset|button|checkbox|radio)$/i.test(type || '')) {
      // submit/reset/button は `button` 要素を使う設計なので、来たら数える
      if (!/^(hidden)$/i.test(type || '') && !/^(checkbox|radio)$/i.test(type || '')) {
        // fallthrough: 数える
      } else if (/^hidden$/i.test(type || '')) {
        continue;
      }
    }
    if (tag === 'a' && attr('href') === null) continue; // アンカー名だけの <a> は押せない
    const classes = (attr('class') || '').trim().split(/\s+/).filter(Boolean);
    // 直後のテキストと、label が中に入力欄を持つか
    const after = src.slice(m.index, m.index + 400);
    out.push({
      tag,
      classes,
      id: attr('id'),
      href: attr('href'),
      type,
      // 表示用の抜粋＝**閉じタグまで**で切り、改行と連続空白を1つに畳む
      //（畳まないと1件の指摘が複数行に散って、仕分けのときに読めない）
      text: (() => {
        // 上と同じ理由で String.raw（`\s` がただの `s` になる）。
        const close = new RegExp(String.raw`</${tag}\s*>`, 'i').exec(after);
        const inner = close ? after.slice(0, close.index) : after;
        return inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
      })(),
      wrapsTextField:
        tag === 'label' &&
        /<input\b(?![^>]*type\s*=\s*["']?(checkbox|radio))/i.test(after.slice(0, 400)),
      _before: src.slice(Math.max(0, m.index - 600), m.index),
      // 「地の文の中のリンクか」＝囲んでいるブロックの種類と、リンク以外の文字の有無の**両方**で決める。
      // 片方（文字の有無）だけだと、`<div class="breadcrumb">` のように**並べたナビ**まで素通しする。
      inlineInTextBlock() {
        if (tag !== 'a') return false;
      // 🔴 正規表現を組むテンプレートリテラルは **`String.raw` を付ける**。
      //   付けないと `\b` は**単語境界ではなく制御文字 0x08**、`\s` はただの `s` になる
      //   （JS の文字列エスケープが先に食う）。**例外も警告も出ず、黙って一致しなくなる**。
      const bRe = new RegExp(String.raw`<\/?(?:${TEXT_BLOCK}|${NON_TEXT_BLOCK})\b[^>]*>`, 'gi');
        let start = 0, startTag = null, mm;
        while ((mm = bRe.exec(src)) && mm.index < at) {
          start = mm.index + mm[0].length;
          startTag = mm[0];
        }
        if (!startTag) return false;
        if (!new RegExp(String.raw`^<(?:${TEXT_BLOCK})\b`, 'i').test(startTag)) return false;
        bRe.lastIndex = at;
        const nm = bRe.exec(src);
        const slice = src.slice(start, nm ? nm.index : src.length).replace(/<a\b[\s\S]*?<\/a>/gi, '');
        const txt = slice
          .replace(/<[^>]*>/g, '')
          .replace(/&[a-z]+;|&#\d+;/gi, 'X')          // &copy; 等も地の文として数える
          .replace(/[\s｜|／\/·•・›»＞>,、･:：]+/g, ''); // 区切り記号だけの隣接は「地の文」にしない
        return txt.length > 0;
      },
      hiddenByAncestorClass(...names) {
        return names.some((n) => new RegExp(`class\\s*=\\s*["'][^"']*\\b${n}\\b`, 'i').test(this._before.slice(-400)));
      },
      index: m.index,
    });
  }
  return out;
}

export function checkDocument(text) {
  const styles = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((x) => x[1]).join('\n');
  const rules = parseTopLevelRules(styles);
  const targets = collectTapTargets(text);
  const bad = [];
  for (const el of targets) {
    const ex = EXEMPT.find((e) => e.match(el));
    if (ex) continue;
    const ok = rules.some((r) => rightmostMatches(r.selector, el) && declaresFloor(r.body));
    if (!ok) {
      bad.push(el);
    }
  }
  return { targets, bad, rules };
}

// ───────────────────────────────────────────────────────────────
// 自己テスト（W28-B: 検出器そのものを検査対象にする）
//   見本は正典の本文（★UI-REACH）から起こしてある＝上の正規表現から起こさない。
// ───────────────────────────────────────────────────────────────
function selfTest() {
  const cases = [
    // [名前, HTML, 期待する未充足件数]
    ['床が無い label は落ちる', '<style>.c{display:flex;cursor:pointer}</style><label class="c"><input type="checkbox">同意</label>', 1],
    ['min-height:48px なら通る', '<style>.c{min-height:48px}</style><label class="c"><input type="checkbox">同意</label>', 0],
    ['47px は落ちる', '<style>.c{min-height:47px}</style><label class="c"><input type="checkbox">同意</label>', 1],
    ['3rem(=48px) は通る', '<style>.c{min-height:3rem}</style><button class="c">送信</button>', 0],
    ['@media の中の床は根拠にならない', '<style>@media(min-width:700px){.c{min-height:60px}}</style><button class="c">送信</button>', 1],
    ['子孫セレクタは右端で当たる', '<style>.wrap a{min-height:48px}</style><div class="wrap"><a href="/x">戻る</a></div>', 0],
    ['mailto は例外', '<style></style><p>お問い合わせ <a href="mailto:a@b.c">a@b.c</a></p>', 0],
    ['コメントアウトされた markup は数えない', '<style></style><!-- <button class="z">出ない</button> -->', 0],
    ['checkbox 本体は例外・包む label は数える', '<style>.c{min-height:48px}</style><label class="c"><input type="checkbox">同意</label>', 0],
    ['href の無い <a> は押せないので数えない', '<style></style><a name="top"></a>', 0],
    // 見出し label は例外／中の input は**数える**（押す物はそちら）＝床を与えた版で 0 になる
    ['入力欄の見出し label は例外（中の input には床が要る）', '<style>.f input{min-height:48px}</style><label class="f">メール<input type="email"></label>', 0],
    ['床の無いテキスト入力は落ちる', '<style></style><label class="f">メール<input type="email"></label>', 1],
    // inline-in-sentence: 地の文の中のリンクは例外／同じリンクでも `div` 直下なら例外にしない
    ['地の文の中のリンクは例外', '<style></style><footer>© 私 ｜ <a href="/">一覧</a> ｜ 連絡</footer>', 0],
    ['div 直下に並べたリンクは例外にしない', '<style></style><div class="bc"><a href="/">ブログ</a><span>›</span><span>今</span></div>', 1],
    ['地の文が区切り記号だけなら例外にしない', '<style></style><p><a href="/a">A</a> ｜ <a href="/b">B</a></p>', 2],
    // inline-mailto: `mailto:` かどうかでは決めない＝**地の文に埋まっていること**も同時に要る。
    //   見本は実 markup `src/pages/blog/index.astro` の `<div class="footer-links">`（実測 17px）から起こした。
    ['地の文の中の mailto は例外', '<style></style><p>ご連絡は <a href="mailto:a@b.c">a@b.c</a> まで。</p>', 0],
    ['並べたナビの中の mailto は例外にしない', '<style></style><div class="fl"><a href="mailto:a@b.c">a@b.c</a><span>·</span></div>', 1],
    [':hover 付きの床は当たる', '<style>.c:hover{min-height:48px}</style><button class="c">送信</button>', 0],
  ];
  let ok = 0;
  for (const [name, html, want] of cases) {
    const got = checkDocument(html).bad.length;
    if (got !== want) {
      console.error(`タップ目標チェック: 自己テスト失敗「${name}」 期待 ${want} / 実際 ${got}`);
      process.exit(1);
    }
    ok++;
  }
  if (ok !== cases.length) { console.error('自己テストの件数が合わない'); process.exit(1); }
  return ok;
}

// ───────────────────────────────────────────────────────────────
function walk(dir, exts, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === '.astro') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, acc);
    else if (exts.some((e) => name.endsWith(e)) && !/\.bak_/.test(name)) acc.push(p);
  }
  return acc;
}

const files = [
  ...walk(join(ROOT, 'public'), ['.html']),
  ...walk(join(ROOT, 'src'), ['.astro']),
].sort();

const selfOk = selfTest();
let totalTargets = 0;
const problems = [];
for (const f of files) {
  const rel = relative(ROOT, f).split(sep).join('/');
  const { targets, bad } = checkDocument(readFileSync(f, 'utf8'));
  totalTargets += targets.length;
  for (const el of bad) {
    problems.push({ rel, el });
  }
}

console.log(
  `タップ目標チェック: 自己テスト ${selfOk}/${selfOk} OK / 面 ${files.length} 本・押せる物 ${totalTargets} 個・例外 ${EXEMPT.length} 種`
);

if (problems.length) {
  console.log('\nタップ目標チェック: NG');
  for (const { rel, el } of problems) {
    const who = `<${el.tag}${el.classes.length ? ' class="' + el.classes.join(' ') + '"' : ''}${el.id ? ' id="' + el.id + '"' : ''}>`;
    console.log(
      `  [FLOOR] ${rel} の ${who}「${el.text}」に **${MIN_PX}px の床の宣言が無い**` +
        `（当たるルールのどれも min-height/height >= ${MIN_PX}px を持っていない）。` +
        `\n          CSS へ \`min-height:${MIN_PX}px\` を足す（padding で既に超えているものも、偶然でなく宣言で保証する）。` +
        `\n          押すための物でないなら、この検出器の EXEMPT へ**理由つきで**足す。`
    );
  }
  process.exit(1);
}
console.log('タップ目標チェック: OK');
