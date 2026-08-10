/* ==========================================================================
 * Android 版 テスター応募
 *   /torehan/ と /urehan/ の両方から読み込む共通スクリプト。
 *   ＝文面やテーマ色は各 LP の HTML/CSS 側、通信と状態遷移だけをここに置く。
 *
 * 2026-08-10 に Google フォームから移設した。移設の理由:
 *   - 応募件数を開発者ダッシュボードから読むのに、回答シートを作って共有して
 *     ID を登録する、という手作業が要っていた
 *   - **テスターに応募した人が正式公開のお知らせを受け取れなかった**
 *     （フォームの回答は android_waitlist に入らない＝一斉送信の宛先に入らない）。
 *     テストに実際に参加した人は Play 経由で製品版へ移るが、応募したのに
 *     人数の都合で呼ばれなかった人は、公開を知る手段が無いまま落ちていた。
 *
 * 送信先: Supabase の public.android_testers（migration 0074）
 *   - anon キーは公開前提（RLS で守る）。anon には insert しか許可していない。
 *   - Prefer: return=minimal … 戻り値を要求しない（select 権限が無いため必須）
 *   - 2回目の応募は 409（一意制約）で返る。利用者にとっては成功なので同じ表示にする
 *     （`resolution=ignore-duplicates` は anon に select が無いと使えない＝0071 の実測）。
 *
 * 「公開のお知らせも受け取る」に✔がある場合は、**android_waitlist にも**登録する
 * （source='tester'）。一斉送信の宛先を waitlist 一本に保つための二重書き込みで、
 * ここが唯一の連結点。片方だけ失敗したときは黙らず、下の通知フォームへ誘導する。
 * ========================================================================== */
(function () {
  "use strict";

  var SUPABASE_URL = "https://vuazrgebojcnyjcnhpuq.supabase.co";
  var SUPABASE_KEY = "sb_publishable_pin4V9zyMx6el2Z_fswzUA_dXlom2jf";

  // 明らかな打ち間違いだけを弾く（厳密な検証はサーバー側の CHECK 制約に任せる）。
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function post(path, body) {
    return fetch(SUPABASE_URL + "/rest/v1/" + path, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(body)
    });
  }

  /** 空欄は列ごと送らない（null を送ると CHECK にかからないが、意図が読みにくくなる） */
  function trimmedOrNull(el, max) {
    if (!el) return null;
    var v = (el.value || "").trim();
    if (v === "") return null;
    return v.slice(0, max);
  }

  /**
   * @param {string} app 'torehan' | 'urehan'
   */
  window.initTester = function (app) {
    var form = document.getElementById("tester-form");
    var email = document.getElementById("tester-email");
    var device = document.getElementById("tester-device");
    var osVer = document.getElementById("tester-os");
    var agree = document.getElementById("tester-agree");
    var notify = document.getElementById("tester-notify");
    var button = document.getElementById("tester-submit");
    var msg = document.getElementById("tester-msg");
    // ボタンの文字だけを差し替える（textContent を直に書くと中の <span class="ic"> が消える）
    var label = document.getElementById("tester-btn-label");
    var trap = document.getElementById("tester-website"); // ボット用の空欄（人には見えない）
    if (!form || !email || !agree || !button || !msg || !label) return;

    var done = false;

    function say(text, kind) {
      msg.textContent = text;
      msg.className = "tester-msg is-" + kind;
    }

    function finish(text) {
      done = true;
      form.classList.add("is-done");
      [email, device, osVer, agree, notify].forEach(function (el) {
        if (el) el.disabled = true;
      });
      button.style.display = "none";
      say(text, "ok");
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (done) return;

      // ハニーポット: 自動入力するボットだけが埋める欄。埋まっていたら
      // 「送ったふり」をして黙って終える（弾いたことを教えない）。
      if (trap && trap.value) {
        finish("ご応募ありがとうございます。準備ができましたらご連絡します。");
        return;
      }

      var addr = (email.value || "").trim();
      if (!EMAIL_RE.test(addr) || addr.length > 254) {
        say("Google アカウント（Gmail アドレス）の形式をご確認ください。", "err");
        email.focus();
        return;
      }
      if (!agree.checked) {
        say("ご確認・ご同意のチェックをお願いします。", "err");
        agree.focus();
        return;
      }

      button.disabled = true;
      var labelText = label.textContent;
      label.textContent = "送信中…";
      say("", "");

      var row = { app: app, email: addr, source: "lp" };
      var dev = trimmedOrNull(device, 100);
      var os = trimmedOrNull(osVer, 60);
      if (dev) row.device = dev;
      if (os) row.os_version = os;

      post("android_testers", row)
        .then(function (res) {
          // 409 = 一意制約（同じアプリに同じアドレスの2回目）＝利用者にとっては成功。
          if (!res.ok && res.status !== 409) throw new Error("HTTP " + res.status);

          if (!notify || !notify.checked) {
            finish("ご応募ありがとうございます。テスターの準備ができましたら、このアドレスへご連絡します。");
            return;
          }

          // お知らせ希望＝ウェイトリストにも登録する。ここが失敗したときは黙らない
          // （応募は通っているので、下の通知フォームから登録し直せることを伝える）。
          return post("android_waitlist", { app: app, email: addr, source: "tester" }).then(function (r2) {
            if (r2.ok || r2.status === 409) {
              finish(
                "ご応募ありがとうございます。テスターの準備ができましたらご連絡します。" +
                  "Android 版を公開できましたら、同じアドレスへお知らせもお送りします。"
              );
              return;
            }
            finish(
              "ご応募は受け付けました。ただし公開のお知らせの登録だけがうまくいきませんでした。" +
                "お手数ですが、下の「Android版が出たらお知らせします」からご登録ください。"
            );
          });
        })
        .catch(function () {
          button.disabled = false;
          label.textContent = labelText;
          say(
            "うまく送信できませんでした。時間をおいてお試しいただくか、rurifukuro@gmail.com までご連絡ください。",
            "err"
          );
        });
    });
  };
})();
