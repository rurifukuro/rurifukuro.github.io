-- ============================================================
-- Blog Analytics for rurifukuro.github.io
-- Apply to: とれはんっ！ Supabase (vuazrgebojcnyjcnhpuq)
--
-- 🔴 このファイルは**冪等**（何度流しても同じ状態になる）＝これ1本が正典。
--    追補ファイルを別に作らず、ここを直して丸ごと再適用すること。
--    適用: npx supabase db query --linked -f blog_analytics.sql
--          （--linked の向き先が とれはんっ！プロジェクトであることを確認してから）
--
-- ── 2026-08-19 ハードニング（とれはんっ！ 批判的チェック ラウンド5 班T【注意 T-7】の横断適用）
--    とれはんっ！側で「public の自作関数に `set search_path` が無い」を潰した際、
--    **同じ DB に相乗りしているこのブログ計測の 4 関数だけが未設定で残っていた**のを実測で発見した。
--    リポジトリを分けても DB は 1 つ＝壊れたときの巻き添えは全アプリに及ぶ。
--    ついでに、anon へ開放している以上どうしても要る入力ガードも同時に入れた（詳細は各関数の注記）。
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

CREATE INDEX IF NOT EXISTS idx_blog_events_path ON blog_events (page_path);
CREATE INDEX IF NOT EXISTS idx_blog_events_type ON blog_events (event_type);
CREATE INDEX IF NOT EXISTS idx_blog_events_created ON blog_events (created_at DESC);

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
-- ============================================================

-- Increment page view (session dedup)
CREATE OR REPLACE FUNCTION increment_blog_view(
  p_path text,
  p_session text,
  p_referrer text DEFAULT NULL,
  p_device text DEFAULT NULL
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

  INSERT INTO blog_page_views (page_path, view_count)
  VALUES (v_path, 1)
  ON CONFLICT (page_path) DO UPDATE SET
    view_count = blog_page_views.view_count + 1,
    updated_at = now();

  INSERT INTO blog_events (page_path, session_id, event_type, referrer, device_type)
  VALUES (v_path, v_session, 'pageview', v_referrer, v_device);
END;
$$;

-- Record time on page
CREATE OR REPLACE FUNCTION record_blog_time(
  p_path text,
  p_session text,
  p_seconds numeric
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
BEGIN
  IF v_path = '' OR v_session = '' THEN
    RETURN;
  END IF;

  UPDATE blog_page_views SET
    total_time_seconds = total_time_seconds + v_seconds,
    updated_at = now()
  WHERE page_path = v_path;

  INSERT INTO blog_events (page_path, session_id, event_type, value)
  VALUES (v_path, v_session, 'time_on_page', v_seconds);
END;
$$;

-- Record scroll depth
CREATE OR REPLACE FUNCTION record_blog_scroll(
  p_path text,
  p_session text,
  p_depth numeric
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

  INSERT INTO blog_events (page_path, session_id, event_type, value)
  VALUES (v_path, v_session, 'scroll_depth', v_depth);
END;
$$;

-- Record CTA click
CREATE OR REPLACE FUNCTION record_blog_cta(
  p_path text,
  p_session text,
  p_target text
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

  INSERT INTO blog_events (page_path, session_id, event_type, value, referrer)
  VALUES (v_path, v_session, 'cta_click', NULL, v_target);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_blog_view(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION record_blog_time(text, text, numeric) TO anon;
GRANT EXECUTE ON FUNCTION record_blog_scroll(text, text, numeric) TO anon;
GRANT EXECUTE ON FUNCTION record_blog_cta(text, text, text) TO anon;
