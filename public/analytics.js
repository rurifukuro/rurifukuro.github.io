/* =========================================================================
 * 瑠璃フクロウ ポータル 共通計測スクリプト  ★このファイル1本が正典★
 *
 * 読み込み先（ここに足したら必ずこの一覧も直す。実測 = grep -rln analytics.js public/ src/）:
 *   ・src/layouts/BaseLayout.astro     … ブログ全体（/blog 配下）
 *   ・public/torehan/index.html        … とれはんっ！LP
 *   ・public/torehan/join/index.html   … とれはんっ！テスター参加ページ
 *   ・public/urehan/index.html         … レジさぽっ！LP
 *   ・public/kyasuho-support/index.html … きゃすりん サポートページ
 *   ※ プライバシーポリシー（urehan/privacy.html）と配信停止（unsubscribe/）は
 *     事務ページなので**あえて読み込まない**＝LP の数字にノイズを混ぜない。
 *
 * 🔴 計測ロジックを別の場所へ写さないこと。
 *    2026-08-23 まで計測は BaseLayout.astro の中にだけ書かれていて、
 *    **LP（public 配下の静的HTML）は Astro のレイアウトを通らない**ため
 *    「LPに何人来たか」が 1 行も記録されていなかった＝この集約はその是正。
 *
 * 保存先: とれはんっ！Supabase（vuazrgebojcnyjcnhpuq）
 *         スキーマ・関数の正典は rurifukuro.github.io/blog_analytics.sql
 * 読む側: 開発者ダッシュボード「ポータル記事アクセス」（SPEC §4-21）
 * ========================================================================= */
(function () {
  'use strict';

  var SB = 'https://vuazrgebojcnyjcnhpuq.supabase.co';
  var KEY = 'sb_publishable_pin4V9zyMx6el2Z_fswzUA_dXlom2jf'; /* 公開値（anon）＝ブラウザから直接呼ぶ前提 */
  var PT = '128997588'; /* 瑠璃フクロウ チーム共通のプロバイダID（全アプリ共通・固定値） */
  var DEV_KEY = 'ba_dev';

  /* 🔴 計測するページは「許すものを並べる」（allowlist）。
   *    「これは数えない」を並べる形にすると、ページを 1 枚足した瞬間に
   *    黙って計測対象へ紛れ込む（＝気づけない）。前方一致で判定する。 */
  var TRACK_PREFIXES = ['/blog', '/torehan', '/urehan', '/kyasuho-support'];

  var path = window.location.pathname;

  var query = null;
  try {
    query = new URLSearchParams(window.location.search);
  } catch (e) {
    /* 古いブラウザ。以降 query は null のまま扱う */
  }

  /* -----------------------------------------------------------------------
   * ① 開発者端末の登録／解除
   *
   *   https://rurifukuro.github.io/?dev=1  … この端末を「開発者」として記憶する
   *   https://rurifukuro.github.io/?dev=0  … 解除する
   *
   *   記憶したあとは、この端末からの閲覧に is_dev の印が付いて記録される。
   *   ダッシュボードは既定で除外して数える（記録自体は残るので後から含めて見られる）。
   *
   *   🔴 この処理は「計測対象のページか」の判定より**前**に置く。
   *      トップページ（計測対象外）で ?dev=1 を開いても効くようにするため。
   * --------------------------------------------------------------------- */
  if (query && query.has('dev')) {
    try {
      if (query.get('dev') === '0') {
        window.localStorage.removeItem(DEV_KEY);
      } else {
        window.localStorage.setItem(DEV_KEY, '1');
      }
    } catch (e) {
      /* プライベートモード等で localStorage が使えない場合は何もしない */
    }
  }

  var isDev = false;
  try {
    isDev = window.localStorage.getItem(DEV_KEY) === '1';
  } catch (e) {
    /* 読めなければ「開発者ではない」＝通常の閲覧として数える（安全側） */
  }

  /* -----------------------------------------------------------------------
   * ② App Store リンクに流入元（pt / ct）を付ける
   *
   *   ASC の アナリティクス → 獲得 → キャンペーン で流入元別に見えるようにする。
   *     /torehan/?src=cos_anonenoa → …/id6776913607?pt=128997588&ct=cos_anonenoa&mt=8
   *
   *   ct の決め方（?src= があれば常にそれが優先）:
   *     /blog/<スラッグ>/ → blog_<スラッグ>   … どの記事から来たか
   *     それ以外           → portal            … LP・その他はまとめて
   *
   *   🔴 既に ct が入っているリンクは触らない（手で指定した値を上書きしない）。
   * --------------------------------------------------------------------- */
  function defaultCt() {
    var m = path.match(/^\/blog\/([^/]+)\/?$/);
    if (m && m[1] !== 'tag') return 'blog_' + m[1];
    return 'portal';
  }

  function sanitizeCt(value) {
    /* ct に使えるのは英数字・_・- のみ。長すぎる値は 40 文字で切る */
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  }

  var ct = sanitizeCt((query && query.get('src')) || '') || sanitizeCt(defaultCt()) || 'portal';

  function tagStoreLinks() {
    var links = document.querySelectorAll('a[href*="apps.apple.com"]');
    for (var i = 0; i < links.length; i++) {
      var u;
      try {
        u = new URL(links[i].href);
      } catch (e) {
        continue;
      }
      if (u.searchParams.has('ct')) continue;
      u.searchParams.set('pt', PT);
      u.searchParams.set('ct', ct);
      u.searchParams.set('mt', '8');
      links[i].href = u.toString();
    }
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(tagStoreLinks);

  /* -----------------------------------------------------------------------
   * ③ 閲覧の記録（対象ページのみ）
   * --------------------------------------------------------------------- */
  var tracked = false;
  for (var p = 0; p < TRACK_PREFIXES.length; p++) {
    if (path.indexOf(TRACK_PREFIXES[p]) === 0) {
      tracked = true;
      break;
    }
  }
  if (!tracked) return;

  var sid;
  try {
    sid = window.sessionStorage.getItem('ba_sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.sessionStorage.setItem('ba_sid', sid);
    }
  } catch (e) {
    /* sessionStorage が使えなければ、そのページ限りの一時IDで数える */
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  var hdrs = { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY };

  function rpc(name, params, keepalive) {
    params.p_is_dev = isDev;
    return fetch(SB + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify(params),
      keepalive: !!keepalive
    }).catch(function () {});
  }

  var device = window.innerWidth < 768 ? 'mobile' : 'desktop';
  rpc('increment_blog_view', {
    p_path: path,
    p_session: sid,
    p_referrer: document.referrer || null,
    p_device: device
  });

  var t0 = Date.now();
  var timeSent = false;
  function sendTime() {
    if (timeSent) return;
    timeSent = true;
    var sec = Math.round((Date.now() - t0) / 1000);
    if (sec > 0 && sec < 3600) {
      rpc('record_blog_time', { p_path: path, p_session: sid, p_seconds: sec }, true);
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendTime();
  });
  window.addEventListener('pagehide', sendTime);

  var maxScroll = 0;
  var scrollTimer;
  window.addEventListener('scroll', function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0) {
        var pct = Math.round((window.scrollY / h) * 100);
        if (pct > maxScroll) maxScroll = pct;
      }
    }, 200);
  });
  window.addEventListener('pagehide', function () {
    if (maxScroll > 0) {
      rpc('record_blog_scroll', { p_path: path, p_session: sid, p_depth: maxScroll }, true);
    }
  });

  /* アプリ導線のクリック。
   * ブログ記事内の CTA（.cta-btn）と、LP のストアボタン（App Store へのリンク）の両方を数える。 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('.cta-btn') || t.closest('a[href*="apps.apple.com"]');
    if (a) rpc('record_blog_cta', { p_path: path, p_session: sid, p_target: a.href });
  });
})();
