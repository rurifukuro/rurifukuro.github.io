-- ============================================================
-- Blog Analytics for rurifukuro.github.io
-- Apply to: とれはんっ！ Supabase (vuazrgebojcnyjcnhpuq)
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

ALTER TABLE blog_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_page_views_select" ON blog_page_views
  FOR SELECT USING (true);

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
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM blog_events
    WHERE page_path = p_path AND session_id = p_session AND event_type = 'pageview'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO blog_page_views (page_path, view_count)
  VALUES (p_path, 1)
  ON CONFLICT (page_path) DO UPDATE SET
    view_count = blog_page_views.view_count + 1,
    updated_at = now();

  INSERT INTO blog_events (page_path, session_id, event_type, referrer, device_type)
  VALUES (p_path, p_session, 'pageview', p_referrer, p_device);
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
AS $$
BEGIN
  UPDATE blog_page_views SET
    total_time_seconds = total_time_seconds + p_seconds,
    updated_at = now()
  WHERE page_path = p_path;

  INSERT INTO blog_events (page_path, session_id, event_type, value)
  VALUES (p_path, p_session, 'time_on_page', p_seconds);
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
AS $$
BEGIN
  INSERT INTO blog_events (page_path, session_id, event_type, value)
  VALUES (p_path, p_session, 'scroll_depth', p_depth);
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
AS $$
BEGIN
  INSERT INTO blog_events (page_path, session_id, event_type, value, referrer)
  VALUES (p_path, p_session, 'cta_click', NULL, p_target);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_blog_view(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION record_blog_time(text, text, numeric) TO anon;
GRANT EXECUTE ON FUNCTION record_blog_scroll(text, text, numeric) TO anon;
GRANT EXECUTE ON FUNCTION record_blog_cta(text, text, text) TO anon;
