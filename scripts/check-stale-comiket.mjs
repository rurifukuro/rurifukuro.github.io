// 記事に書かれたコミケの回次が古いまま公開されるのを止める検出器。
//
//   node scripts/check-stale-comiket.mjs
//
// なぜ要るか:
//   下書き（draft: true）の記事は誰の目にも触れないまま残るので、回次だけが黙って腐る。
//   実際に C108（2026-08-15〜16・終了済み）が 3 本の記事に残っていた。
//   draft を外した瞬間に「終わったイベントを未来形で案内する記事」が公開される。
//
// 数え方（W28＝「悪いものを数える」ではなく「良いものを要求する」）:
//   記事本文に現れる C+3桁 は **すべて CURRENT.id と一致していなければならない**。
//   古い回次を列挙する denylist にすると、C110 が来た瞬間に黙って素通しする。
//
// 正典との関係:
//   回次と開催日の正典は とれはんっ！ の supabase/data/event_schedule.json（別リポジトリ）。
//   ここはその写しなので、**写しの更新忘れが素通しにならない側へ倒してある**
//   ＝ lastDay を過ぎたら、記事を1文字も触っていなくても落ちる。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CURRENT = { id: 'C109', lastDay: '2026-12-31' };

const BLOG_DIR = 'src/content/blog';
const RE = /C\d{3}/g;

// --- 自己テスト（W28-B: 検出器そのものを検査対象にする）-------------------
// 見本は検出器の正規表現からではなく、実際に埋まっていた本文の形から起こす。
{
  const sample = 'コミケC108は、2026年8月15日(土)〜16日(日)に開催されます。#C108 お品書き';
  const hit = sample.match(RE) ?? [];
  if (hit.length !== 2 || hit[0] !== 'C108') {
    console.error(`検出器の自己テストが落ちました（回次の拾い出し）: ${JSON.stringify(hit)}`);
    process.exit(2);
  }
  const okSample = '<!-- stale-ok C106: 他社アプリの説明文の引用 -->';
  const okHit = [...okSample.matchAll(/<!--\s*stale-ok\s+(C\d{3})\s*:[^>]*-->/g)].map((m) => m[1]);
  if (okHit.length !== 1 || okHit[0] !== 'C106') {
    console.error(`検出器の自己テストが落ちました（stale-ok の読み取り）: ${JSON.stringify(okHit)}`);
    process.exit(2);
  }
}

let ng = 0;

const today = new Date().toISOString().slice(0, 10);
if (today > CURRENT.lastDay) {
  console.error(
    `× ${CURRENT.id} は ${CURRENT.lastDay} に終了しています。` +
      `この検出器の CURRENT を次回の回次へ更新してください（正典＝とれはんっ！ event_schedule.json）。`
  );
  ng++;
}

const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
if (files.length === 0) {
  console.error(`× ${BLOG_DIR} に記事が1本もありません（走査範囲の設定ミスを疑ってください）`);
  process.exit(2);
}

for (const f of files) {
  const text = readFileSync(join(BLOG_DIR, f), 'utf8');
  // 他社アプリの説明文の引用など、こちらで更新する対象ではない回次は
  //   <!-- stale-ok C106: 理由 -->
  // を本文に置いて明示的に除外する（理由の記述を必須にして、黙って消えないようにする）。
  const allowed = new Set(
    [...text.matchAll(/<!--\s*stale-ok\s+(C\d{3})\s*:[^>]*-->/g)].map((m) => m[1])
  );
  const stale = [...new Set(text.match(RE) ?? [])].filter(
    (id) => id !== CURRENT.id && !allowed.has(id)
  );
  if (stale.length > 0) {
    console.error(`× ${f}: 古い回次 ${stale.join(', ')}（現在は ${CURRENT.id}）`);
    ng++;
  }
}

if (ng > 0) {
  console.error(`\n${ng} 件。回次を ${CURRENT.id} へ揃えるか、回次に依存しない書き方へ直してください。`);
  process.exit(1);
}
console.log(`✓ ${files.length} 本の記事の回次はすべて ${CURRENT.id}（期限 ${CURRENT.lastDay}）`);
