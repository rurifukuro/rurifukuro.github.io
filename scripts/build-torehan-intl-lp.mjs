// とれはんっ！海外向けLP（en / zh-hans / zh-hant / ko / fr）を正本1つから生成する（WEB18）。
//   正本＝scripts/torehan-intl/template.html（構造・CSS）＋ strings.json（文言）
//   出力＝public/torehan/<dir>/index.html
// 使い方:
//   node scripts/build-torehan-intl-lp.mjs           … 生成して書き出す
//   node scripts/build-torehan-intl-lp.mjs --check   … 書き出さずに差分だけ数える（差分あり＝exit 1）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "scripts", "torehan-intl");
const BASE = "https://rurifukuro.github.io/torehan/";
const IOS = "https://apps.apple.com/app/id6776913607";
const PLAY = "https://play.google.com/store/apps/details?id=com.torehan.app";

// 並び順＝言語切替の表示順。ja は手書きの既存ページ（生成しない）。
const LANGS = [
  { key: "ja", dir: "", hreflang: "ja", name: "日本語" },
  { key: "en", dir: "en", hreflang: "en", name: "English" },
  { key: "zh-Hans", dir: "zh-hans", hreflang: "zh-Hans", name: "简体中文" },
  { key: "zh-Hant", dir: "zh-hant", hreflang: "zh-Hant", name: "繁體中文" },
  { key: "ko", dir: "ko", hreflang: "ko", name: "한국어" },
  { key: "fr", dir: "fr", hreflang: "fr", name: "Français" },
];
const urlOf = (l) => BASE + (l.dir ? l.dir + "/" : "");

// 生成側で埋めるキー（strings.json に置かない）
const GENERATED = ["url", "alternates", "store_buttons", "langnav", "img_dir"];
// 生成側が使うだけでテンプレートに直接出ないキー
const HELPER = ["ios_label", "ios_sub", "play_label", "play_sub"];
// 属性値に入るキー＝ " を含めると属性が壊れる
const ATTR = ["title", "desc", "og_title", "og_desc", "icon_alt", "alt_map1", "alt_map2",
  "m1_alt", "m2_alt", "m3_alt", "m4_alt", "langs_label", "html_lang", "og_locale", "word_break"];

const template = readFileSync(join(SRC, "template.html"), "utf8");
const strings = JSON.parse(readFileSync(join(SRC, "strings.json"), "utf8"));
const used = [...new Set([...template.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((m) => m[1]))];

const errors = [];
const fail = (msg) => errors.push(msg);

export function alternates() {
  const lines = LANGS.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${urlOf(l)}">`);
  lines.push(`<link rel="alternate" hreflang="x-default" href="${urlOf(LANGS[1])}">`);
  return lines.join("\n");
}

function storeButtons(s, indent) {
  const p = " ".repeat(indent);
  return [
    `${p}<a class="btn btn-ios" href="${IOS}" onclick="torehanTrackStoreClick()">`,
    `${p}  <span class="ic" aria-hidden="true">📱</span>`,
    `${p}  <span>${s.ios_label}<small>${s.ios_sub}</small></span>`,
    `${p}</a>`,
    `${p}<a class="btn btn-play" href="${PLAY}">`,
    `${p}  <span class="ic" aria-hidden="true">▶️</span>`,
    `${p}  <span>${s.play_label}<small>${s.play_sub}</small></span>`,
    `${p}</a>`,
  ].join("\n");
}

function langnav(current) {
  return LANGS.map((l) => {
    const cur = l.key === current ? ' aria-current="page"' : "";
    return `      <a href="${l.dir ? "/torehan/" + l.dir + "/" : "/torehan/"}" hreflang="${l.hreflang}" lang="${l.hreflang}"${cur}>${l.name}</a>`;
  }).join("\n");
}

// 画面に出る文字列から仮名を数える（コメント・lang="ja" の要素・script/style は除外）
function visibleKana(html) {
  let t = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<(span|a|b|li)\b[^>]*\blang="ja"[^>]*>[\s\S]*?<\/\1>/g, "");
  return t.match(/[぀-ヿ]+/g) || [];
}

// JPEG の SOF から寸法を読む（依存を増やさない）
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

// 画像が実在し、width/height 属性が実寸と一致するか（言語別スクショの作り忘れ・切り抜き変更の取り残しを数える）
function checkImages(key, html) {
  for (const m of html.matchAll(/<img src="(\/torehan\/img\/[^"]+)"[^>]*\bwidth="(\d+)" height="(\d+)"/g)) {
    const file = join(ROOT, "public", m[1]);
    if (!existsSync(file)) { fail(`${key}: 画像が無い ${m[1]}（python scripts/torehan-intl/build_shots.py）`); continue; }
    const size = jpegSize(readFileSync(file));
    if (!size) { fail(`${key}: 寸法を読めない ${m[1]}`); continue; }
    if (size.w !== +m[2] || size.h !== +m[3]) fail(`${key}: ${m[1]} は ${size.w}x${size.h}・属性は ${m[2]}x${m[3]}`);
  }
}

function render(lang) {
  const s = strings[lang.key];
  if (!s) { fail(`${lang.key}: strings.json に節が無い`); return null; }
  for (const k of used) {
    if (GENERATED.includes(k)) continue;
    if (typeof s[k] !== "string" || s[k] === "") fail(`${lang.key}: キー ${k} が空／未定義`);
  }
  for (const k of HELPER) if (!s[k]) fail(`${lang.key}: キー ${k} が空／未定義`);
  for (const k of Object.keys(s)) {
    if (!used.includes(k) && !HELPER.includes(k)) fail(`${lang.key}: キー ${k} はテンプレートで使われていない`);
  }
  for (const k of ATTR) if (s[k] && s[k].includes('"')) fail(`${lang.key}: 属性値 ${k} に " がある`);

  let out = template.replace(/\{\{([a-z0-9_]+)\}\}/g, (m, k, offset) => {
    if (k === "url") return urlOf(lang);
    if (k === "alternates") return alternates();
    if (k === "langnav") return langnav(lang.key);
    if (k === "img_dir") return lang.dir;
    if (k === "store_buttons") {
      const lineStart = template.lastIndexOf("\n", offset) + 1;
      const prevIndent = template.slice(lineStart, offset).length === 0
        ? (template.slice(0, lineStart - 1).match(/\n( *)[^\n]*$/) || ["", ""])[1].length + 2
        : 4;
      return storeButtons(s, prevIndent);
    }
    return s[k] ?? m;
  });
  if (/\{\{|\}\}/.test(out)) fail(`${lang.key}: 置換されていない {{…}} が残っている`);
  checkImages(lang.key, out);
  const kana = visibleKana(out);
  if (kana.length) fail(`${lang.key}: 画面に出る仮名がある → ${[...new Set(kana)].slice(0, 8).join(" / ")}`);
  return out;
}

const check = process.argv.includes("--check");
const results = [];
for (const lang of LANGS.slice(1)) {
  const html = render(lang);
  if (html) results.push({ lang, html, path: join(ROOT, "public", "torehan", lang.dir, "index.html") });
}
for (const k of Object.keys(strings)) {
  if (k !== "_note" && !LANGS.some((l) => l.key === k)) fail(`strings.json の節 ${k} は生成対象に無い`);
}

if (errors.length) {
  console.error("✗ torehan-intl:\n  " + errors.join("\n  "));
  process.exit(1);
}

let drift = 0;
for (const r of results) {
  const rel = r.path.slice(ROOT.length + 1).replace(/\\/g, "/");
  if (check) {
    // core.autocrlf=true の作業ツリーでは CRLF で展開される＝改行を揃えてから比べる
    const cur = existsSync(r.path) ? readFileSync(r.path, "utf8").replace(/\r\n/g, "\n") : null;
    if (cur !== r.html) { drift++; console.error(`✗ ${rel} が正本と違う（npm run build:torehan-intl で作り直す）`); }
  } else {
    mkdirSync(dirname(r.path), { recursive: true });
    writeFileSync(r.path, r.html, "utf8");
    console.log(`✓ ${rel} (${Buffer.byteLength(r.html)} B)`);
  }
}

// ja ページの hreflang が生成側と同じ集合か（手書きページとのずれを数える）
const ja = readFileSync(join(ROOT, "public", "torehan", "index.html"), "utf8");
for (const line of alternates().split("\n")) {
  if (!ja.includes(line)) { drift++; console.error(`✗ public/torehan/index.html に無い: ${line}`); }
}

if (drift) process.exit(1);
console.log(check ? `✓ torehan-intl: ${results.length} 言語とも正本どおり` : `✓ torehan-intl: ${results.length} 言語を生成`);
