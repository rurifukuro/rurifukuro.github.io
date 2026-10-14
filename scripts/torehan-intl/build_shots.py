# -*- coding: utf-8 -*-
"""とれはんっ！海外向けLPの言語別スクショを ASC 提出用スクショから作る。
正本＝事業計画\\アプリ開発\\とれはんっ！\\●各ストア申請用\\<n.言語>\\*.png（1290x2796・ASC 6.9インチ）
出力＝public/torehan/img/<dir>/feat-*.jpg（幅720・JPEG q92）
言語別に無い画面（AI読み取り・おつり計算）は日本語版の共通画像を使う＝ここでは作らない。
使い方: python scripts/torehan-intl/build_shots.py
"""
from PIL import Image
import os

SRC = r'C:\Users\tiash\Desktop\事業計画\アプリ開発\とれはんっ！\●各ストア申請用'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'public', 'torehan', 'img')

LANGS = {'en': '2.英語', 'zh-hans': '3.簡体中国語', 'zh-hant': '4.繫体中国語',
         'ko': '5.韓国語', 'fr': '6.フランス語'}

# 出力名: (元ファイル名, 切り抜き枠)。上=ステータスバー除去。全言語で同じ枠＝寸法が揃う。
SHOTS = {
    'feat-map1.jpg': ('１全体マップ.png', (0, 150, 1290, 2525)),
    'feat-map2.jpg': ('2 全体マップ.png', (0, 150, 1290, 2525)),
    'feat-group.jpg': ('4 サークル分担作成画面.png', (0, 150, 1290, 2796)),
    'feat-guide.jpg': ('9 コミケ攻略情報.png', (0, 150, 1290, 2325)),
}


def save_web(img, path, width=720, q=92):
    w, h = img.size
    r = img.resize((width, round(width * h / w)), Image.LANCZOS)
    r.save(path, 'JPEG', quality=q, optimize=True)
    return r.size


# 🔴 2026-10-15 実測: 3.簡体中国語 と 4.繫体中国語 は一部の画面が入れ替わって入っている
#   （簡体フォルダに繁体字の画面・繁体フォルダに簡体字の画面）。見出し・ボタンの字体で確かめた。
#   入れ替わっている画面だけ、もう片方のフォルダから取る。攻略情報(9)は正しい側に入っている。
SWAPPED = {'１全体マップ.png', '2 全体マップ.png', '4 サークル分担作成画面.png'}
OTHER = {'zh-hans': '4.繫体中国語', 'zh-hant': '3.簡体中国語'}

for d, folder in LANGS.items():
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
    for name, (src, box) in SHOTS.items():
        f = OTHER[d] if (d in OTHER and src in SWAPPED) else folder
        im = Image.open(os.path.join(SRC, f, src)).convert('RGB')
        assert im.size == (1290, 2796), (folder, src, im.size)
        size = save_web(im.crop(box), os.path.join(OUT, d, name))
        print(d, name, size)
