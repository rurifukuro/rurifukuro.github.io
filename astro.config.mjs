import { defineConfig } from 'astro/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://rurifukuro.github.io';

/*
 * public/ 配下の静的 HTML（LP・サポートページ）を sitemap に載せるための URL 一覧。
 *
 * 🔴 一覧を手で書かない（2026-09-05）。手で並べると、ページを 1 枚足したときに
 *    必ず書き忘れて**黙って検索から消える**（＝気づけない壊れ方）。
 *    ここは逆向きに書く＝「載せない」意思表示は各 HTML の
 *    <meta name="robots" content="noindex"> で行い、**それが無いものは全部載せる**。
 *    実測 2026-09-05: 中継ページ（invite / join）・配信停止・きゃすりん先行アンケートには
 *    既に noindex が入っていて、LP 2 枚とサポートページとプライバシーポリシーだけが残る。
 */
function publicPages() {
  const root = join(process.cwd(), 'public');
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.html')) continue;
      if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(readFileSync(p, 'utf-8'))) continue;
      const rel = relative(root, p).split(sep).join('/');
      out.push(`${SITE}/${rel.replace(/(^|\/)index\.html$/, '$1')}`);
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Markdown の表を <div class="table-scroll"> で包む rehype プラグイン。
 * table 単体に overflow-x を掛けると thead/tbody を別テーブル化する必要があり列幅が揃わなくなるため、
 * 外側にラッパーを立てて横スクロールはそちらに持たせる（見た目の指定は BlogLayout.astro 側）。
 */
function rehypeTableWrap() {
  return (tree) => {
    const walk = (node) => {
      if (!Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        walk(child);
        if (child.type === 'element' && child.tagName === 'table') {
          return {
            type: 'element',
            tagName: 'div',
            properties: { className: ['table-scroll'] },
            children: [child],
          };
        }
        return child;
      });
    };
    walk(tree);
  };
}

export default defineConfig({
  site: 'https://rurifukuro.github.io',
  /*
   * 🔴 sitemap は「入れてある」だけでは 1 行も生成されない（2026-09-05・実被弾）。
   *    package.json には 2026-08 時点で @astrojs/sitemap が入っていたのに、ここへ
   *    結線されていなかったため sitemap.xml も sitemap-index.xml も **本番で 404** だった。
   *    その間、比較記事 2 本の外部からの閲覧は **1 件も無い**（計測は動いていて 0 と分かった）。
   *    依存に在ること＝動いていること、ではない。生成物を curl で数えて初めて確認になる。
   *
   *    Astro が自動で拾うのは Astro のルートだけ（/ ・ /blog/ ・ /blog/<記事>/ ・ /blog/tag/<タグ>/）。
   *    public/ 配下の静的 LP（/torehan/ ・ /urehan/ 等）は Astro のルートではないので
   *    **自動では 1 件も入らない**＝上の publicPages() で足している。
   */
  integrations: [sitemap({ customPages: publicPages() })],
  markdown: {
    rehypePlugins: [rehypeTableWrap],
  },
});
