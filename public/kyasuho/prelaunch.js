/* ==========================================================================
 * きゃすりん リリース前の事前登録＋事前アンケート
 *   /kyasuho/prelaunch.html から読み込む。
 *   設問は prelaunch-survey.generated.js（正典＝kyasuho/src/config/prelaunchSurvey.json）。
 *   ここに設問文・選択肢を**書かない**。書いた瞬間に正典と食い違う（CANON-GEN）。
 *
 * 送信先: きゃすりん本番 Supabase の
 *   - public.ky_prelaunch_signups          （事前登録）
 *   - public.ky_prelaunch_survey_responses （アンケート）
 *   どちらも migration 0216。anon には insert しか許可していない
 *   ＝このキーで登録者や回答を読むことはできない。
 *
 * ⚠ `resolution=ignore-duplicates` は使えない（0071 の実測）。
 *   ON CONFLICT が既存行の参照権を要求し、select 権の無い anon では 42501 →
 *   PostgREST が HTTP 401 にマップする。**2回目は 409 を返させて成功扱いにする**。
 *
 * 🔴 2本の POST は独立して扱う。
 *   アンケートだけ / 登録だけ のどちらでも成立させたいので、
 *   片方が失敗しても他方の成功を取り消さない（＝トランザクションにしない）。
 *   突き合わせは submission_id（この画面で生成する uuid）で後から行う。
 * ========================================================================== */
(function () {
  "use strict";

  var SUPABASE_URL = "https://rhmuitgbvilqwdevxxox.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJobXVpdGdidmlscXdkZXZ4eG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTg1NTIsImV4cCI6MjA5Nzc5NDU1Mn0.-AFsrYH8SSv0CddNq12eNcUEDsQtthDr-L6xNw8JNas";

  // 明らかな打ち間違いだけを弾く。厳密な検証はサーバー側の CHECK 制約に任せる
  // （ここで弾きすぎると、正しい連絡先の人が登録できずに黙って去る＝害の方が大きい）。
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

  // 🔴 店舗名の入力欄は**アンケート側の設問1本だけ**にしてある（2026-08-30 ユーザー指示）。
  //    理由＝「回答はするがリリース案内は要らない」お店にも、お礼を伝えられるようにするため。
  //    以前は連絡先ブロック（案内を受け取るにチェックしたときだけ開く）の中にあり、
  //    チェックしない回答者の店舗名は**どこにも残らなかった**。
  //    ここに設問文は書かない＝正典は prelaunchSurvey.json。参照するのはIDだけ。
  var SHOP_NAME_QID = "KP-21";

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    // 古い環境向けの控え。突き合わせ用の相関IDなので暗号強度は要らない。
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function post(table, rows) {
    return fetch(SUPABASE_URL + "/rest/v1/" + table, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    }).then(function (res) {
      // 409 = 一意制約（同じ連絡先での2回目）。利用者にとっては成功なので通す。
      if (res.ok || res.status === 409) return res.status;
      throw new Error("HTTP " + res.status);
    });
  }

  // ── 設問を描く ──────────────────────────────────────────────
  function renderSurvey(root, schema) {
    schema.pages.forEach(function (page) {
      var qs = schema.questions.filter(function (q) { return q.page === page.no; });
      if (!qs.length) return;

      var sec = el("section", { class: "kp-page" });
      sec.appendChild(el("h3", { class: "kp-page-title" }, page.title));
      if (page.lead) sec.appendChild(el("p", { class: "kp-page-lead" }, page.lead));

      qs.forEach(function (q) {
        var box = el("div", { class: "kp-q", "data-qid": q.id });
        var lab = el("p", { class: "kp-q-label" });
        lab.appendChild(document.createTextNode(q.label));
        if (q.required) lab.appendChild(el("span", { class: "kp-req" }, "必須"));
        box.appendChild(lab);
        if (q.hint) box.appendChild(el("p", { class: "kp-q-hint" }, q.hint));

        if (q.kind === "scale5") {
          var labels = schema.scales[q.scale] || [];
          var scale = el("div", { class: "kp-scale" });
          for (var i = 1; i <= 5; i++) {
            var id = "kp-" + q.id + "-" + i;
            var wrap = el("label", { class: "kp-scale-item", for: id });
            var r = el("input", { type: "radio", name: q.id, id: id, value: String(i) });
            wrap.appendChild(r);
            wrap.appendChild(el("span", { class: "kp-scale-n" }, String(i)));
            wrap.appendChild(el("span", { class: "kp-scale-t" }, labels[i - 1] || ""));
            scale.appendChild(wrap);
          }
          box.appendChild(scale);
        } else if (q.kind === "single" || q.kind === "multi") {
          var list = el("div", { class: "kp-opts" });
          (q.options || []).forEach(function (o, idx) {
            var id = "kp-" + q.id + "-" + idx;
            var wrap = el("label", { class: "kp-opt", for: id });
            wrap.appendChild(
              el("input", {
                type: q.kind === "single" ? "radio" : "checkbox",
                name: q.id,
                id: id,
                value: o.value,
              })
            );
            wrap.appendChild(el("span", {}, o.label));
            list.appendChild(wrap);
          });
          box.appendChild(list);
        } else if (q.kind === "text") {
          var t = el(q.multiline ? "textarea" : "input", {
            class: "kp-text",
            name: q.id,
            maxlength: q.maxLength || 500,
            rows: q.multiline ? 4 : null,
            type: q.multiline ? null : "text",
          });
          box.appendChild(t);
        }
        sec.appendChild(box);
      });

      root.appendChild(sec);
    });
  }

  /** 入力を「設問ID → 値」の形に集める。**未回答の設問はキーごと落とす**
   *  （空文字や空配列を送ると、集計側で「答えた人」に数えられてしまう）。 */
  function collect(root, schema) {
    var out = {};
    schema.questions.forEach(function (q) {
      if (q.kind === "multi") {
        var vals = [];
        root.querySelectorAll('input[name="' + q.id + '"]:checked').forEach(function (n) {
          vals.push(n.value);
        });
        if (vals.length) out[q.id] = vals;
      } else if (q.kind === "single" || q.kind === "scale5") {
        var one = root.querySelector('input[name="' + q.id + '"]:checked');
        if (one) out[q.id] = q.kind === "scale5" ? Number(one.value) : one.value;
      } else {
        var f = root.querySelector('[name="' + q.id + '"]');
        var v = f && (f.value || "").trim();
        if (v) out[q.id] = v.slice(0, q.maxLength || 500);
      }
    });
    return out;
  }

  window.initKyasuhoPrelaunch = function () {
    var schema = window.KYASUHO_PRELAUNCH_SURVEY;
    var form = document.getElementById("kp-form");
    var surveyRoot = document.getElementById("kp-survey");
    var button = document.getElementById("kp-submit");
    var label = document.getElementById("kp-submit-label");
    var msg = document.getElementById("kp-msg");
    var trap = document.getElementById("kp-website"); // ボット用の空欄（人には見えない）
    var wantNotify = document.getElementById("kp-want-notify");
    var contactBox = document.getElementById("kp-contact");
    var methodEmail = document.getElementById("kp-method-email");
    var methodX = document.getElementById("kp-method-x");
    var emailRow = document.getElementById("kp-email-row");
    var xRow = document.getElementById("kp-x-row");
    var emailInput = document.getElementById("kp-email");
    var xInput = document.getElementById("kp-x-handle");
    var nameInput = document.getElementById("kp-contact-name");
    if (!schema || !form || !surveyRoot || !button || !label || !msg) return;

    renderSurvey(surveyRoot, schema);

    var done = false;
    function say(text, kind) {
      msg.textContent = text;
      msg.className = "kp-msg is-" + kind;
    }

    function syncContact() {
      var on = wantNotify.checked;
      contactBox.hidden = !on;
      var useEmail = methodEmail.checked;
      emailRow.hidden = !useEmail;
      xRow.hidden = useEmail;
    }
    wantNotify.addEventListener("change", syncContact);
    methodEmail.addEventListener("change", syncContact);
    methodX.addEventListener("change", syncContact);
    syncContact();

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (done) return;

      // ハニーポット: 自動入力するボットだけが埋める欄。埋まっていたら
      // 「送ったふり」をして黙って終える（弾いたことを教えない）。
      if (trap && trap.value) {
        finish("ご協力ありがとうございました。");
        return;
      }

      var answers = collect(surveyRoot, schema);
      var wants = wantNotify.checked;

      // 🔴 店舗名は設問の形をしているが「回答」ではない＝答えた数に混ぜない。
      //    混ぜると、店舗名だけ書いて送った人が集計上「アンケートに答えた1件」になり、
      //    中身の無い行で母数を自分から汚す（意向スコアの分母がずれる）。
      var answered = Object.keys(answers).filter(function (k) {
        return k !== SHOP_NAME_QID;
      });

      // 空送信よけ。**どちらも空**のときだけ止める（片方だけなら通す）。
      if (!wants && !answered.length) {
        say("アンケートにお答えいただくか、リリース案内のご登録にチェックを入れてください。", "err");
        return;
      }

      // 🔴★Rev516（ラウンド56 B-8 / C-4）: 設問の「必須」ラベルは描画側（`if (q.required)` の1箇所）
      //    でしか使われておらず、送信時に一度も検査していなかった＝**必須と書いてあるのに未回答で送れる**。
      //    表示だけの必須は、利用者から見れば嘘であり、集計側から見れば「主軸の設問が欠けた行」が
      //    黙って混ざる原因になる（intent_score は製品と価格を決める分母）。
      //    🔴 ただし LP は「アンケートだけのご回答、ご登録だけ、どちらでも構いません」と書いている＝
      //       案内の登録だけしたい人を止めてはいけない。そこで**アンケートに1問でも答えた人にだけ**
      //       必須を当てる（`answered.length` の条件）。店舗名は回答ではない（SHOP_NAME_QID）ので除く。
      var missing = schema.questions.filter(function (q) {
        return q.required && q.id !== SHOP_NAME_QID && !(q.id in answers);
      });
      if (answered.length && missing.length) {
        say("「" + missing[0].label + "」にお答えください。", "err");
        var missBox = surveyRoot.querySelector('[data-qid="' + missing[0].id + '"]');
        if (missBox && missBox.scrollIntoView) missBox.scrollIntoView({ block: "center" });
        return;
      }

      var signup = null;
      if (wants) {
        var useEmail = methodEmail.checked;
        var email = (emailInput.value || "").trim();
        var handle = (xInput.value || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "");
        if (useEmail && (!EMAIL_RE.test(email) || email.length > 254)) {
          say("メールアドレスの形式をご確認ください。", "err");
          emailInput.focus();
          return;
        }
        if (!useEmail && !HANDLE_RE.test(handle)) {
          say("X のユーザー名をご確認ください（@ は不要です）。", "err");
          xInput.focus();
          return;
        }
        signup = {
          submission_id: null, // 下で埋める
          // 店舗名は上の設問（SHOP_NAME_QID）から取る＝入力欄を二重に置かない。
          shop_name: answers[SHOP_NAME_QID] || null,
          contact_name: (nameInput.value || "").trim() || null,
          contact_method: useEmail ? "email" : "x_dm",
          email: useEmail ? email : null,
          x_handle: useEmail ? null : handle,
          source: "lp",
        };
      }

      var sid = uuid();
      if (signup) signup.submission_id = sid;

      button.disabled = true;
      var labelText = label.textContent;
      label.textContent = "送信中…";
      say("", "");

      var jobs = [];
      // 🔴 `answered`（＝店舗名を除いた実回答）で判定する。店舗名だけの行を作らない
      //    ＝案内登録だけしたい人の店舗名は signup 側に入るので、ここで落としても失われない。
      if (answered.length) {
        jobs.push(
          post("ky_prelaunch_survey_responses", [
            {
              submission_id: sid,
              survey_version: schema.surveyVersion,
              // 🔴 主軸2問だけ列へ写す（0216 の intent_score / price_score と対）。
              //    answers 側にも残す＝集計の入口を1つに絞らない。
              intent_score: typeof answers["KP-1"] === "number" ? answers["KP-1"] : null,
              price_score: typeof answers["KP-6"] === "number" ? answers["KP-6"] : null,
              answers: answers,
            },
          ])
        );
      }
      if (signup) jobs.push(post("ky_prelaunch_signups", [signup]));

      Promise.all(jobs)
        .then(function () {
          finish(
            wants
              ? "ありがとうございました。ご案内できるようになりましたら、いただいた連絡先にお知らせします。"
              : "ありがとうございました。いただいたご意見は今後の開発に使わせていただきます。"
          );
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

    function finish(text) {
      done = true;
      form.classList.add("is-done");
      button.style.display = "none";
      Array.prototype.forEach.call(form.querySelectorAll("input, textarea, select"), function (n) {
        n.disabled = true;
      });
      say(text, "ok");
      msg.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
})();
