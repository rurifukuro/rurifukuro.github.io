/* ==========================================================================
 * Android 版リリース通知の事前登録（ウェイトリスト）
 *   /torehan/ と /urehan/ の両方から読み込む共通スクリプト。
 *   ＝文面やテーマ色は各 LP の HTML/CSS 側、通信と状態遷移だけをここに置く。
 *
 * 送信先: Supabase の public.android_waitlist（migration 0071）
 *   - anon キーは公開前提（RLS で守る／keepalive.yml にも同じ値が入っている）
 *   - anon には insert しか許可していないので、このキーで登録者を読むことはできない
 *   - Prefer: return=minimal … 戻り値を要求しない（select 権限が無いため必須）
 *   - ⚠ `resolution=ignore-duplicates` は **使えない**（2026-08-05 実測）。
 *     ON CONFLICT の競合判定に既存行の参照が要るため、PostgREST が
 *     42501「permission denied（GRANT SELECT せよ）」を返す＝401 になる。
 *     select を与えない設計を優先し、代わりに **2回目の登録は 409 で返させて
 *     クライアント側で成功扱いにする**（利用者から見た結果は同じ）。
 * ========================================================================== */
(function () {
  "use strict";

  var SUPABASE_URL = "https://vuazrgebojcnyjcnhpuq.supabase.co";
  var SUPABASE_KEY = "sb_publishable_pin4V9zyMx6el2Z_fswzUA_dXlom2jf";

  // 明らかな打ち間違いだけを弾く。厳密な検証はサーバー側の CHECK 制約に任せる
  // （ここで弾きすぎると、正しいアドレスの人が登録できずに黙って去る＝害の方が大きい）。
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  /**
   * @param {string} app 'torehan' | 'urehan'
   */
  window.initWaitlist = function (app) {
    var form = document.getElementById("waitlist-form");
    var input = document.getElementById("waitlist-email");
    var button = document.getElementById("waitlist-submit");
    var msg = document.getElementById("waitlist-msg");
    // ボタンの文字だけを差し替える。button.textContent を直に書き換えると
    // 中の <span class="ic"> ごと消えてアイコンの見た目が戻らなくなる。
    var label = document.getElementById("waitlist-btn-label");
    var trap = document.getElementById("waitlist-website"); // ボット用の空欄（人には見えない）
    if (!form || !input || !button || !msg || !label) return;

    var done = false;

    function say(text, kind) {
      msg.textContent = text;
      msg.className = "waitlist-msg is-" + kind;
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (done) return;

      // ハニーポット: 自動入力するボットだけが埋める欄。埋まっていたら
      // 「送ったふり」をして黙って終える（弾いたことを教えない）。
      if (trap && trap.value) {
        say("ご登録ありがとうございます。公開できましたらお知らせします。", "ok");
        done = true;
        return;
      }

      var email = (input.value || "").trim();
      if (!EMAIL_RE.test(email) || email.length > 254) {
        say("メールアドレスの形式をご確認ください。", "err");
        input.focus();
        return;
      }

      button.disabled = true;
      var labelText = label.textContent;
      label.textContent = "送信中…";
      say("", "");

      fetch(SUPABASE_URL + "/rest/v1/android_waitlist", {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ app: app, email: email, source: "lp" })
      })
        .then(function (res) {
          // 409 = 一意制約（同じアプリに同じアドレスの2回目）。
          // 「すでに登録済み」＝利用者にとっては成功なので同じ表示にする。
          if (res.ok || res.status === 409) {
            done = true;
            form.classList.add("is-done");
            input.disabled = true;
            button.style.display = "none";
            say(
              "ご登録ありがとうございます。Android 版を公開できましたら、このアドレスにお知らせをお送りします。",
              "ok"
            );
            return;
          }
          throw new Error("HTTP " + res.status);
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
