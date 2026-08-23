import { defineConfig } from 'astro/config';

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
  markdown: {
    rehypePlugins: [rehypeTableWrap],
  },
});
