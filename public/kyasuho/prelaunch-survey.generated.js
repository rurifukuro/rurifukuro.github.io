/* このファイルは自動生成物です。手で編集しないでください。
 * 正典: kyasuho/src/config/prelaunchSurvey.json
 * 再生成: cd kyasuho && npm run gen-prelaunch-survey */
(function () {
  "use strict";
  window.KYASUHO_PRELAUNCH_SURVEY = {
    "surveyVersion": "kyasuho-prelaunch-v1",
    "_comment": "正典1本。ここを直したら npm run gen:prelaunch-survey で全生成物を作り直す（CANON-GEN）。",
    "pages": [
      {
        "no": 1,
        "title": "お店のことを教えてください",
        "lead": "いただいた回答は、機能と料金を決めるためだけに使います。分かる範囲で構いません。"
      },
      {
        "no": 2,
        "title": "「きゃすりん」について",
        "lead": "上の「できること（8つのモジュール）」をご覧いただいたうえでお答えください。"
      },
      {
        "no": 3,
        "title": "料金について",
        "lead": "上の「料金（予定）」をご覧いただいたうえでお答えください。"
      },
      {
        "no": 4,
        "title": "最後に",
        "lead": ""
      }
    ],
    "scales": {
      "intent": [
        "導入したいとは思わない",
        "あまり導入したいと思わない",
        "どちらとも言えない",
        "やや導入したい",
        "ぜひ導入したい"
      ],
      "price": [
        "かなり安いと思う",
        "やや安いと思う",
        "妥当だと思う",
        "やや高いと思う",
        "かなり高いと思う"
      ]
    },
    "questions": [
      {
        "id": "KP-10",
        "page": 1,
        "kind": "single",
        "label": "お店の業態に一番近いものはどれですか",
        "options": [
          {
            "value": "concept_cafe",
            "label": "コンセプトカフェ"
          },
          {
            "value": "maid",
            "label": "メイド喫茶・メイドカフェ"
          },
          {
            "value": "butler",
            "label": "執事喫茶・男装カフェ"
          },
          {
            "value": "idol_photo",
            "label": "アイドル系・撮影会中心"
          },
          {
            "value": "bar_lounge",
            "label": "ガールズバー・ラウンジ寄り"
          },
          {
            "value": "other",
            "label": "その他"
          }
        ]
      },
      {
        "id": "KP-11",
        "page": 1,
        "kind": "single",
        "label": "在籍しているキャストはおおよそ何人ですか",
        "options": [
          {
            "value": "n1_5",
            "label": "1〜5人"
          },
          {
            "value": "n6_10",
            "label": "6〜10人"
          },
          {
            "value": "n11_20",
            "label": "11〜20人"
          },
          {
            "value": "n21_50",
            "label": "21〜50人"
          },
          {
            "value": "n51",
            "label": "51人以上"
          }
        ]
      },
      {
        "id": "KP-12",
        "page": 1,
        "kind": "single",
        "label": "運営している店舗数を教えてください",
        "options": [
          {
            "value": "s1",
            "label": "1店舗"
          },
          {
            "value": "s2_3",
            "label": "2〜3店舗"
          },
          {
            "value": "s4",
            "label": "4店舗以上"
          }
        ]
      },
      {
        "id": "KP-13",
        "page": 1,
        "kind": "multi",
        "label": "いまお客様の予約は、どの方法で受け付けていますか",
        "hint": "使っているものをすべて選んでください。",
        "options": [
          {
            "value": "x_dm",
            "label": "X（旧Twitter）のDM・リプライ"
          },
          {
            "value": "line",
            "label": "LINE公式アカウント・個人LINE"
          },
          {
            "value": "phone",
            "label": "電話"
          },
          {
            "value": "walkin",
            "label": "予約は受けていない（当日ご来店のみ）"
          },
          {
            "value": "reserve_site",
            "label": "予約サイト（トレタ・ホットペッパー等）"
          },
          {
            "value": "own_form",
            "label": "自店のWebサイト・予約フォーム"
          },
          {
            "value": "other",
            "label": "その他"
          }
        ]
      },
      {
        "id": "KP-14",
        "page": 1,
        "kind": "multi",
        "label": "いま使っている店舗管理・POSのサービスはありますか",
        "hint": "複数を併用している場合はすべて選んでください。",
        "options": [
          {
            "value": "none",
            "label": "使っていない（紙・Excel・LINEなどで管理）"
          },
          {
            "value": "d_system",
            "label": "Dシステム"
          },
          {
            "value": "yorureji",
            "label": "夜レジ"
          },
          {
            "value": "trust",
            "label": "TRUST"
          },
          {
            "value": "nightcore",
            "label": "NIGHTCORE"
          },
          {
            "value": "concafe_go",
            "label": "コンカフェGo"
          },
          {
            "value": "other",
            "label": "その他のサービス"
          }
        ]
      },
      {
        "id": "KP-15",
        "page": 1,
        "kind": "multi",
        "label": "いまの運営で、一番手間がかかっていると感じる仕事はどれですか",
        "hint": "3つまでを目安に選んでください。",
        "options": [
          {
            "value": "reservation",
            "label": "予約の受付・変更・当日の席合わせ"
          },
          {
            "value": "shift",
            "label": "シフトの作成・キャストへの共有"
          },
          {
            "value": "register",
            "label": "オーダー・伝票・お会計"
          },
          {
            "value": "payroll",
            "label": "給与・バックの計算"
          },
          {
            "value": "sales",
            "label": "売上の集計・日報"
          },
          {
            "value": "expense",
            "label": "経費・領収書の整理"
          },
          {
            "value": "customer",
            "label": "お客様への告知・ポイントや特典の管理"
          },
          {
            "value": "attendance",
            "label": "出勤・退勤の記録"
          }
        ]
      },
      {
        "id": "KP-1",
        "page": 2,
        "kind": "scale5",
        "scale": "intent",
        "required": true,
        "label": "「きゃすりん」がリリースされたら、お店に導入したいと思いますか"
      },
      {
        "id": "KP-2",
        "page": 2,
        "kind": "text",
        "multiline": true,
        "maxLength": 500,
        "label": "そう思ったのはなぜですか",
        "hint": "良い・悪いのどちらでも、思ったままをお書きください。ここが一番参考になります。"
      },
      {
        "id": "KP-3",
        "page": 2,
        "kind": "multi",
        "label": "便利だと思った機能はどれですか",
        "hint": "当てはまるものをすべて選んでください。",
        "options": [
          {
            "value": "base",
            "label": "予約台帳・受付（お客様が自分で予約できるページ／指名・キャスト管理）"
          },
          {
            "value": "register",
            "label": "オーダーと会計（伝票・席料・日報・レシート印刷）"
          },
          {
            "value": "shift",
            "label": "シフト表の作成（テンプレートとAIデザイン・SNSへの投稿）"
          },
          {
            "value": "sales",
            "label": "売上と給与（バック・スライド時給の自動計算）"
          },
          {
            "value": "analytics",
            "label": "分析（期間集計・ランキング・グラフ）"
          },
          {
            "value": "customer",
            "label": "お客様向け機能（ポイント・スタンプ・景品）"
          },
          {
            "value": "attendance",
            "label": "勤怠（打刻・遅刻早退・月次集計）"
          },
          {
            "value": "expense",
            "label": "経費管理（領収書の読み取り・固定費）"
          },
          {
            "value": "none",
            "label": "特に便利だと思うものはなかった"
          }
        ]
      },
      {
        "id": "KP-4",
        "page": 2,
        "kind": "text",
        "multiline": true,
        "maxLength": 500,
        "label": "「これが無いと使えない」と感じた、不足している機能はありますか",
        "hint": "小さなことでも構いません。いま困っている業務そのものを書いていただくのでも大丈夫です。"
      },
      {
        "id": "KP-5",
        "page": 2,
        "kind": "single",
        "label": "導入するとしたら、どのくらいの時期をお考えですか",
        "options": [
          {
            "value": "asap",
            "label": "使えるようになり次第すぐ"
          },
          {
            "value": "m3",
            "label": "3か月以内"
          },
          {
            "value": "y1",
            "label": "半年〜1年以内"
          },
          {
            "value": "undecided",
            "label": "時期は決めていない"
          },
          {
            "value": "no_plan",
            "label": "導入する予定はない"
          }
        ]
      },
      {
        "id": "KP-6",
        "page": 3,
        "kind": "scale5",
        "scale": "price",
        "label": "掲載している料金は、他社のサービスと比べて高いと思いますか",
        "hint": "他社をご存じない場合は、お店の負担として高いと感じるかでお答えください。"
      },
      {
        "id": "KP-7",
        "page": 3,
        "kind": "text",
        "multiline": true,
        "maxLength": 500,
        "label": "そう思ったのはなぜですか",
        "hint": "比べたサービス名や、いま支払っている金額を書いていただけると助かります。"
      },
      {
        "id": "KP-8",
        "page": 3,
        "kind": "single",
        "label": "この種のサービスに、月額でいくらまでなら出せますか",
        "options": [
          {
            "value": "u5000",
            "label": "〜5,000円"
          },
          {
            "value": "u10000",
            "label": "5,001〜10,000円"
          },
          {
            "value": "u20000",
            "label": "10,001〜20,000円"
          },
          {
            "value": "u30000",
            "label": "20,001〜30,000円"
          },
          {
            "value": "u40000",
            "label": "30,001〜40,000円"
          },
          {
            "value": "o40000",
            "label": "40,001円以上"
          }
        ]
      },
      {
        "id": "KP-9",
        "page": 3,
        "kind": "single",
        "label": "導入をためらうとしたら、一番の理由は何ですか",
        "options": [
          {
            "value": "price",
            "label": "料金"
          },
          {
            "value": "migration",
            "label": "いまのやり方から移し替える手間"
          },
          {
            "value": "staff",
            "label": "キャストやスタッフが使いこなせるか不安"
          },
          {
            "value": "enough",
            "label": "いまのやり方で足りている"
          },
          {
            "value": "trust",
            "label": "個人開発のため実績や続くかが分からない"
          },
          {
            "value": "none",
            "label": "ためらう理由は特にない"
          },
          {
            "value": "other",
            "label": "その他"
          }
        ]
      },
      {
        "id": "KP-20",
        "page": 4,
        "kind": "text",
        "multiline": true,
        "maxLength": 1000,
        "label": "その他、ご意見・ご要望があればお書きください",
        "hint": "「こういうアプリなら使う」といったご要望も歓迎します。"
      }
    ]
  };
})();
