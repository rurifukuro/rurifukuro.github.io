-- ============================================================
-- Blog Analytics for rurifukuro.github.io
-- Apply to: とれはんっ！ Supabase (vuazrgebojcnyjcnhpuq)
--
-- 🔴 このファイルは**冪等**（何度流しても同じ状態になる）＝これ1本が正典。
--    追補ファイルを別に作らず、ここを直して丸ごと再適用すること。
--    適用: npx supabase db query --linked -f blog_analytics.sql
--          （--linked の向き先が とれはんっ！プロジェクトであることを確認してから）
--
-- 計測スクリプト（ブラウザ側）の正典は rurifukuro.github.io/public/analytics.js
-- 読む側は 開発者ダッシュボードの「ポータル記事アクセス」（SPEC §4-21）。
--
-- ── 2026-08-19 ハードニング（とれはんっ！ 批判的チェック ラウンド5 班T【注意 T-7】の横断適用）
--    とれはんっ！側で「public の自作関数に `set search_path` が無い」を潰した際、
--    **同じ DB に相乗りしているこのブログ計測の 4 関数だけが未設定で残っていた**のを実測で発見した。
--    リポジトリを分けても DB は 1 つ＝壊れたときの巻き添えは全アプリに及ぶ。
--    ついでに、anon へ開放している以上どうしても要る入力ガードも同時に入れた（詳細は各関数の注記）。
--
-- ── 2026-08-23 追加: 開発者本人の閲覧を数から外せるようにした（is_dev）
--    詳細は下の「開発者フラグ」節。
-- ============================================================

-- Aggregated view counts (for ranking sidebar)
CREATE TABLE IF NOT EXISTS blog_page_views (
  page_path text PRIMARY KEY,
  view_count integer DEFAULT 0,
  total_time_seconds numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Detailed events (for analytics dashboard)
CREATE TABLE IF NOT EXISTS blog_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page_path text NOT NULL,
  session_id text NOT NULL,
  event_type text NOT NULL,
  value numeric,
  referrer text,
  device_type text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
--  開発者フラグ（is_dev）
--
--  何のため: 開発者本人（テイトさん）が動作確認のために開いた分が、
--            そのまま PV・滞在時間・スクロール率に混ざっていた。
--            2026-08-23 時点で通算 23PV しか無い＝**自分の分が支配的**で、
--            「読まれているか」をこの数字から読み取れる状態ではなかった。
--
--  やり方:   ブラウザ側（analytics.js）で ?dev=1 を開いた端末を localStorage に覚え、
--            以降の記録に is_dev = true を付ける。**記録は消さない**＝後から含めて見られる。
--            ダッシュボードは既定で is_dev = false だけを数える。
--
--  累計側:   is_dev = true のときは blog_page_views（公開サイドバーのランキング元）を
--            更新しない＝公開側の「よく読まれている記事」からも自分の分が消える。
--
--  🔴 blog_events を「真実の源」として扱う。blog_page_views はそこからの導出値であり、
--     このファイル末尾で毎回引き直している。**blog_events を間引くと累計が壊れる**ので、
--     行を減らす運用に変えるなら、その前にこの引き直しを外すこと。
-- ============================================================
ALTER TABLE blog_events ADD COLUMN IF NOT EXISTS is_dev boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_blog_events_path ON blog_events (page_path);
CREATE INDEX IF NOT EXISTS idx_blog_events_type ON blog_events (event_type);
CREATE INDEX IF NOT EXISTS idx_blog_events_created ON blog_events (created_at DESC);

-- ダッシュボードは常に「期間で切って、開発者分を除く」形で読む＝その 2 列の複合。
CREATE INDEX IF NOT EXISTS idx_blog_events_dev_created
  ON blog_events (is_dev, created_at DESC);

-- 🔴 increment_blog_view の重複判定（page_path + session_id + event_type）専用の複合インデックス。
--    既存の idx_blog_events_path は page_path だけなので、同一記事の行が増えるほど
--    「PV を 1 つ数える」たびの走査が重くなる＝**アクセスが伸びるほど遅くなる**形だった。
--    公開値の anon キーで誰でも呼べる関数なので、重い判定は負荷攻撃の増幅器にもなる。
CREATE INDEX IF NOT EXISTS idx_blog_events_dedup
  ON blog_events (page_path, session_id, event_type);

ALTER TABLE blog_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_events ENABLE ROW LEVEL SECURITY;

-- 🔴 冪等化: CREATE POLICY は既存だとエラー（42710）になるため、必ず先に落とす。
--    これが無いと「このファイルを再適用する」という運用自体が成立しない。
DROP POLICY IF EXISTS "blog_page_views_select" ON blog_page_views;
CREATE POLICY "blog_page_views_select" ON blog_page_views
  FOR SELECT USING (true);

-- ⚠ blog_events には**あえてポリシーを1本も置かない**（RLS 有効＋ポリシー 0 件＝anon からは読めない）。
--    生イベントは referrer を含む＝閲覧元が読み取れてしまうため、公開 SELECT にはしない。
--    集計は下の SECURITY DEFINER 関数と、サービスロールで読むダッシュボード側だけが通る。

-- ============================================================
--  入力ガードの共通方針（4 関数すべてに同じ形で入れている）
--
--  ・これらの関数は**匿名キー（公開値）を知る誰でも呼べる**（末尾の GRANT ... TO anon）。
--    ブラウザから直接呼ぶのが仕様なので revoke はできない＝**中身で守るしかない**。
--  ・文字列は素通しだと 1 行に何 MB でも書ける＝FREE プランの共有 DB を安価に膨らませられる。
--    そこで**切り詰める**（拒否ではなく left()）。正当なアクセスは上限に届かないので、
--    計測が黙って止まるより切るほうが害が小さい。
--  ・数値は下限 0 でクランプする。負の秒数を送られると total_time_seconds が減らせてしまい、
--    ランキングの並びを外部から操作できる（「他人の記事の滞在時間を削る」が成立する）。
--    上限は 1 日（86400 秒）／スクロール率は 100% とする。
--  ・`SET search_path = public, pg_temp` は SECURITY DEFINER 関数の必須装備。
--    宣言しないと**呼び出し元セッションの search_path** で名前解決するため、
--    そこを握れる相手には関数の中身が別物にすり替わる。
--
--  ・p_is_dev は**開発者の自己申告**であって、認証ではない。
--    外から true を送れば誰でも「自分の分は数えない」ができる＝逆は成立しない
--    （他人の記録を消したり増やしたりはできない）ので、実害が無い範囲に収まっている。
--    ここを認証で守ろうとすると、静的サイトから匿名で呼ぶという前提のほうが壊れる。
-- ============================================================

-- 🔴 引数を 1 つ増やしたので、**古いシグネチャは必ず落とす**。
--    残すと同名の関数が 2 つ並び、実装が二重になる（片方だけ直す事故のもと）。
--    古い HTML をキャッシュしているブラウザは p_is_dev を送ってこないが、
--    p_is_dev には DEFAULT があるので PostgREST 側で既定値が入る＝計測は途切れない。
DROP FUNCTION IF EXISTS increment_blog_view(text, text, text, text);
DROP FUNCTION IF EXISTS record_blog_time(text, text, numeric);
DROP FUNCTION IF EXISTS record_blog_scroll(text, text, numeric);
DROP FUNCTION IF EXISTS record_blog_cta(text, text, text);

-- Increment page view (session dedup)
CREATE OR REPLACE FUNCTION increment_blog_view(
  p_path text,
  p_session text,
  p_referrer text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_is_dev boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_path     text := left(btrim(coalesce(p_path, '')), 256);
  v_session  text := left(btrim(coalesce(p_session, '')), 64);
  v_referrer text := left(btrim(p_referrer), 512);
  v_device   text := left(btrim(p_device), 32);
  v_is_dev   boolean := coalesce(p_is_dev, false);
BEGIN
  -- 空パス・空セッションは計測として意味が無いうえ、'' に PV が積み上がるとランキングを汚す。
  IF v_path = '' OR v_session = '' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM blog_events
    WHERE page_path = v_path AND session_id = v_session AND event_type = 'pageview'
  ) THEN
    RETURN;
  END IF;

  -- 開発者本人の閲覧は累計（＝公開サイドバーのランキング元）に足さない。
  IF NOT v_is_dev THEN
    INSERT INTO blog_page_views (page_path, view_count)
    VALUES (v_path, 1)
    ON CONFLICT (page_path) DO UPDATE SET
      view_count = blog_page_views.view_count + 1,
      updated_at = now();
  END IF;

  INSERT INTO blog_events (page_path, session_id, event_type, referrer, device_type, is_dev)
  VALUES (v_path, v_session, 'pageview', v_referrer, v_device, v_is_dev);
END;
$$;

-- Record time on page
CREATE OR REPLACE FUNCTION record_blog_time(
  p_path text,
  p_session text,
  p_seconds numeric,
  p_is_dev boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_path    text    := left(btrim(coalesce(p_path, '')), 256);
  v_session text    := left(btrim(coalesce(p_session, '')), 64);
  -- 🔴 負の秒数を弾かないと total_time_seconds を外から減らせる＝ランキング操作が成立する。
  v_seconds numeric := least(greatest(coalesce(p_seconds, 0), 0), 86400);
  v_is_dev  boolean := coalesce(p_is_dev, false);
BEGIN
  IF v_path = '' OR v_session = '' THEN
    RETURN;
  END IF;

  IF NOT v_is_dev THEN
    UPDATE blog_page_views SET
      total_time_seconds = total_time_seconds + v_seconds,
      updated_at = now()
    WHERE page_path = v_path;
  END IF;

  INSERT INTO blog_events (page_path, session_id, event_type, value, is_dev)
  VALUES (v_path, v_session, 'time_on_page', v_seconds, v_is_dev);
END;
$$;

-- Record scroll depth
CREATE OR REPLACE FUNCTION record_blog_scroll(
  p_path text,
  p_session text,
  p_depth numeric,
  p_is_dev boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_path    text    := left(btrim(coalesce(p_path, '')), 256);
  v_session text    := left(btrim(coalesce(p_session, '')), 64);
  v_depth   numeric := least(greatest(coalesce(p_depth, 0), 0), 100);
BEGIN
  IF v_path = '' OR v_session = '' THEN
    RETURN;
  END IF;

  INSERT INTO blog_events (page_path, session_id, event_type, value, is_dev)
  VALUES (v_path, v_session, 'scroll_depth', v_depth, coalesce(p_is_dev, false));
END;
$$;

-- Record CTA click
CREATE OR REPLACE FUNCTION record_blog_cta(
  p_path text,
  p_session text,
  p_target text,
  p_is_dev boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_path    text := left(btrim(coalesce(p_path, '')), 256);
  v_session text := left(btrim(coalesce(p_session, '')), 64);
  v_target  text := left(btrim(p_target), 256);
BEGIN
  IF v_path = '' OR v_session = '' THEN
    RETURN;
  END IF;

  INSERT INTO blog_events (page_path, session_id, event_type, value, referrer, is_dev)
  VALUES (v_path, v_session, 'cta_click', NULL, v_target, coalesce(p_is_dev, false));
END;
$$;

GRANT EXECUTE ON FUNCTION increment_blog_view(text, text, text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION record_blog_time(text, text, numeric, boolean) TO anon;
GRANT EXECUTE ON FUNCTION record_blog_scroll(text, text, numeric, boolean) TO anon;
GRANT EXECUTE ON FUNCTION record_blog_cta(text, text, text, boolean) TO anon;

-- ============================================================
-- ── 2026-08-23 追加: 開発者ダッシュボード（dev-dashboard）が読むための権限
--
--  背景: 上の「集計は SECURITY DEFINER 関数と、**サービスロールで読むダッシュボード側**だけが通る」は
--        設計としては書いてあったが、**実際には service_role に SELECT が付いていなかった**
--        （2026-08-23 実測＝`42501 permission denied for table blog_page_views` / `blog_events`）。
--        テーブルを `CREATE TABLE` しただけでは Supabase の default privileges が
--        必ずしも service_role へ届かない（このプロジェクトでは届いていなかった）＝**明示的に付ける**。
--
--  範囲: service_role への SELECT だけ。anon / authenticated の権限も RLS も一切変えない
--        ＝計測スクリプト（ブラウザ）側の挙動は変わらない。
--        service_role は RLS を迂回するので、blog_events にポリシーを足す必要は無い
--        （＝「anon からは読めない」という上の設計はそのまま維持される）。
--
--  読む側: dev-dashboard の BFF（`server/sources/blogSource.ts`）。ブラウザへは集計後の数字だけを返し、
--          referrer の生値は**ホスト名に丸めてから**返す（生 URL は画面にもログにも出さない）。
-- ============================================================
GRANT SELECT ON TABLE public.blog_page_views TO service_role;
GRANT SELECT ON TABLE public.blog_events     TO service_role;

-- ============================================================
-- ── 2026-08-23 データ是正: 計測開始〜2026-08-23 の記録を「開発者の確認分」として除外扱いにする
--
--  ユーザー判断（2026-08-23）: この期間は公開直後で外部からの閲覧がほぼ無く、
--  自分で開いた分と区別する材料も無い。まとめて除外扱いにして、2026-08-24 を実質のスタートにする。
--
--  🔴 行は 1 つも消さない（印を付けるだけ）＝後から「含めて見る」に切り替えられる。
--  🔴 日付が固定なので、このファイルを何度再適用しても同じ結果になる（冪等）。
-- ============================================================
UPDATE blog_events
   SET is_dev = true
 WHERE created_at < timestamptz '2026-08-24 00:00:00+09'
   AND is_dev = false;

-- 累計（blog_page_views）を、除外扱いでないイベントだけから引き直す。
-- blog_events が真実の源で、こちらは導出値＝何度流しても同じ値になる。
UPDATE blog_page_views v
   SET view_count         = a.pv,
       total_time_seconds = a.sec,
       updated_at         = now()
  FROM (
    SELECT page_path,
           count(*) FILTER (WHERE event_type = 'pageview')::int              AS pv,
           coalesce(sum(value) FILTER (WHERE event_type = 'time_on_page'), 0) AS sec
      FROM blog_events
     WHERE is_dev = false
     GROUP BY page_path
  ) a
 WHERE v.page_path = a.page_path
   AND (v.view_count IS DISTINCT FROM a.pv OR v.total_time_seconds IS DISTINCT FROM a.sec);

-- 除外扱いでないイベントが 1 件も残っていないページは 0 に落とす
-- （上の UPDATE は該当行が無いページに届かないため、こちらが要る）。
UPDATE blog_page_views v
   SET view_count = 0,
       total_time_seconds = 0,
       updated_at = now()
 WHERE NOT EXISTS (
         SELECT 1 FROM blog_events e
          WHERE e.page_path = v.page_path AND e.is_dev = false
       )
   AND (coalesce(v.view_count, 0) <> 0 OR coalesce(v.total_time_seconds, 0) <> 0);
