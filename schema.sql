
\restrict XTcPdcsm5TnoILLa2nOhzk9NluIPC1wsznwyV5BWPEXr8TN12LruwcF56yTX8Jt


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_and_award_achievements"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  ach RECORD;
  us RECORD;
  threshold int;
  already boolean;
  review_exists boolean;
  night_exists boolean;
  weekend_visits_count int;
  photos_count int;
BEGIN
  PERFORM public.ensure_user_stats_row(p_user_id);
  SELECT * INTO us FROM public.user_stats WHERE user_id = p_user_id;

  FOR ach IN SELECT * FROM public.achievements ORDER BY created_at LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id = p_user_id AND ua.achievement_id = ach.id
    ) INTO already;

    IF already THEN
      CONTINUE;
    END IF;

    -- Interpret requirement JSON structure. Common shapes used below:
    -- { "kind": "shops_visited", "value": 5 }
    -- { "kind": "reviews_written", "value": 5 }
    -- { "kind": "photos_uploaded", "value": 10 }
    -- { "kind": "votes_received", "value": 10 }
    -- { "kind": "review_time_early", "before_hour": 8 }
    -- { "kind": "review_time_night", "after_hour": 20 }
    -- { "kind": "weekend_visits", "value": 5 }

    IF ach.requirements->>'kind' = 'shops_visited' THEN
      threshold := (ach.requirements->>'value')::int;
      IF COALESCE(us.shops_visited,0) >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('shops_visited', us.shops_visited));
        UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    ELSIF ach.requirements->>'kind' = 'reviews_written' THEN
      threshold := (ach.requirements->>'value')::int;
      IF COALESCE(us.reviews_written,0) >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('reviews_written', us.reviews_written));
        UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    ELSIF ach.requirements->>'kind' = 'photos_uploaded' THEN
      threshold := (ach.requirements->>'value')::int;
      SELECT COUNT(*) INTO photos_count FROM public.user_photos WHERE user_id = p_user_id;
      IF photos_count >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('photos_uploaded', photos_count));
        UPDATE public.user_stats SET photos_uploaded = photos_count, total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    ELSIF ach.requirements->>'kind' = 'votes_received' THEN
      threshold := (ach.requirements->>'value')::int;
      IF COALESCE(us.votes_received,0) >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('votes_received', us.votes_received));
        UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    ELSIF ach.requirements->>'kind' = 'review_time_early' THEN
      -- Award if user has any review before the specified hour (in America/Chicago timezone)
      IF ach.requirements ? 'before_hour' THEN
        IF EXISTS (
          SELECT 1 FROM public.shop_reviews r
          WHERE r.user_id = p_user_id
            AND EXTRACT(HOUR FROM timezone('America/Chicago', r.created_at)) < (ach.requirements->>'before_hour')::int
          LIMIT 1
        ) THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
          VALUES (p_user_id, ach.id, now(), jsonb_build_object('note','Has early review'));
          UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
        END IF;
      END IF;

    ELSIF ach.requirements->>'kind' = 'review_time_night' THEN
      IF ach.requirements ? 'after_hour' THEN
        IF EXISTS (
          SELECT 1 FROM public.shop_reviews r
          WHERE r.user_id = p_user_id
            AND EXTRACT(HOUR FROM timezone('America/Chicago', r.created_at)) >= (ach.requirements->>'after_hour')::int
          LIMIT 1
        ) THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
          VALUES (p_user_id, ach.id, now(), jsonb_build_object('note','Has late-night review'));
          UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
        END IF;
      END IF;

    ELSIF ach.requirements->>'kind' = 'weekend_visits' THEN
      threshold := (ach.requirements->>'value')::int;
      SELECT COUNT(*) INTO weekend_visits_count
      FROM public.user_shop_status uss
      WHERE uss.user_id = p_user_id
        AND uss.status = 'visited'
        AND EXTRACT(DOW FROM uss.created_at) IN (0,6); -- Sunday=0, Saturday=6

      IF weekend_visits_count >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('weekend_visits', weekend_visits_count));
        UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."check_and_award_achievements"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_shop_review_overall"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  sum_vals integer := 0;
  cnt integer := 0;
  avg_val numeric(3,2);
BEGIN
  -- Backward compatibility: if client wrote `rating` (legacy single-field), and coffee_quality_rating is not set,
  -- treat the incoming rating value as coffee_quality_rating (cast/truncate if necessary).
  IF (NEW.coffee_quality_rating IS NULL) AND (NEW.rating IS NOT NULL) THEN
    -- If rating is a decimal (e.g. existing rows after type change), cast to nearest integer for coffee_quality_rating
    NEW.coffee_quality_rating := CAST(ROUND(NEW.rating)::int AS smallint);
  END IF;

  -- Sum up non-null rating criteria
  IF NEW.coffee_quality_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.coffee_quality_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.atmosphere_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.atmosphere_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.noise_level_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.noise_level_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.wifi_quality_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.wifi_quality_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.work_friendliness_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.work_friendliness_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.service_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.service_rating;
    cnt := cnt + 1;
  END IF;

  IF cnt = 0 THEN
    NEW.rating := NULL; -- no criteria provided
  ELSE
    avg_val := (sum_vals::numeric / cnt)::numeric(3,2);
    NEW.rating := avg_val;
  END IF;

  -- Keep updated_at fresh
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."compute_shop_review_overall"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_user_stats_row"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."ensure_user_stats_row"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shop_details"("p_shop_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "address" "text", "formatted_address" "text", "phone" "text", "google_rating" numeric, "opening_hours" "jsonb", "website" "text", "main_photo_url" "text", "photo_attribution" "text", "google_photo_reference" "text", "avg_rating" numeric, "avg_coffee_quality" numeric, "avg_atmosphere" numeric, "avg_noise_level" numeric, "avg_wifi_quality" numeric, "avg_work_friendliness" numeric, "avg_service" numeric, "drink_review_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.name,
    cs.address,
    cs.formatted_address,
    cs.phone,
    cs.google_rating,
    cs.opening_hours,
    cs.website,
    cs.main_photo_url,
    cs.photo_attribution,
    cs.google_photo_reference,
    -- Aggregated review ratings
    AVG(sr.rating) as avg_rating,
    AVG(sr.coffee_quality_rating) as avg_coffee_quality,
    AVG(sr.atmosphere_rating) as avg_atmosphere,
    AVG(sr.noise_level_rating) as avg_noise_level,
    AVG(sr.wifi_quality_rating) as avg_wifi_quality,
    AVG(sr.work_friendliness_rating) as avg_work_friendliness,
    AVG(sr.service_rating) as avg_service,
    -- Drink review count
    COUNT(dr.id) as drink_review_count
  FROM public.coffee_shops cs
  -- Left join review aggregates
  LEFT JOIN public.shop_reviews sr ON sr.shop_id = cs.id
  -- Left join drink review count
  LEFT JOIN public.drink_reviews dr ON dr.shop_id = cs.id
  WHERE cs.id = p_shop_id
  GROUP BY cs.id, cs.name, cs.address, cs.formatted_address, cs.phone,
           cs.google_rating, cs.opening_hours, cs.website, cs.main_photo_url,
           cs.photo_attribution, cs.google_photo_reference;
END;
$$;


ALTER FUNCTION "public"."get_shop_details"("p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shop_tag_popularity"("p_shop_id" "uuid") RETURNS TABLE("tag_id" "uuid", "tag_name" "text", "category" "text", "total_votes" bigint, "user_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS tag_id,
    t.name AS tag_name,
    t.category,
    COALESCE(SUM(st.votes), 0) AS total_votes,
    COUNT(st.*) FILTER (WHERE st.id IS NOT NULL) AS user_count
  FROM public.tags t
  JOIN public.shop_tags st ON st.tag_id = t.id
  WHERE st.shop_id = p_shop_id
  GROUP BY t.id, t.name, t.category
  ORDER BY total_votes DESC, user_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_shop_tag_popularity"("p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shop_tag_score"("p_shop_id" "uuid", "p_tag_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  s bigint;
BEGIN
  SELECT COALESCE(SUM(utv.vote_type), 0) INTO s
  FROM public.user_tag_votes utv
  JOIN public.shop_tags st ON st.id = utv.shop_tag_id
  WHERE st.shop_id = p_shop_id AND st.tag_id = p_tag_id;

  RETURN COALESCE(s, 0);
END;
$$;


ALTER FUNCTION "public"."get_shop_tag_score"("p_shop_id" "uuid", "p_tag_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shops_with_data"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_days" integer DEFAULT NULL::integer, "p_limit" integer DEFAULT 1000) RETURNS TABLE("id" "uuid", "name" "text", "latitude" numeric, "longitude" numeric, "status" "text", "avg_rating" numeric, "avg_coffee_quality" numeric, "avg_atmosphere" numeric, "avg_noise_level" numeric, "avg_wifi_quality" numeric, "avg_work_friendliness" numeric, "avg_service" numeric, "main_photo_url" "text", "photo_attribution" "text", "top_tags" "jsonb", "tag_ids" "jsonb", "date_added" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH shop_data AS (
    -- Get shops with basic info and user status
    SELECT
      cs.id,
      cs.name,
      cs.latitude,
      cs.longitude,
      CASE WHEN p_user_id IS NOT NULL THEN uss.status ELSE NULL END as status,
      cs.main_photo_url,
      cs.photo_attribution,
      cs.date_added,
      -- Aggregated review ratings
      AVG(sr.rating) as avg_rating,
      AVG(sr.coffee_quality_rating) as avg_coffee_quality,
      AVG(sr.atmosphere_rating) as avg_atmosphere,
      AVG(sr.noise_level_rating) as avg_noise_level,
      AVG(sr.wifi_quality_rating) as avg_wifi_quality,
      AVG(sr.work_friendliness_rating) as avg_work_friendliness,
      AVG(sr.service_rating) as avg_service
    FROM public.coffee_shops cs
    LEFT JOIN public.user_shop_status uss ON uss.shop_id = cs.id AND uss.user_id = p_user_id
    LEFT JOIN public.shop_reviews sr ON sr.shop_id = cs.id
    WHERE (p_days IS NULL OR cs.date_added >= (NOW() - INTERVAL '1 day' * p_days))
    GROUP BY cs.id, cs.name, cs.latitude, cs.longitude, uss.status,
             cs.main_photo_url, cs.photo_attribution, cs.date_added
    LIMIT p_limit
  ),
  tag_data AS (
    -- Get tag data separately
    SELECT
      stp.shop_id,
      jsonb_agg(
        jsonb_build_object(
          'tag_id', stp.tag_id,
          'tag_name', stp.tag_name,
          'total_votes', stp.total_votes
        )
        ORDER BY stp.total_votes DESC
      ) FILTER (WHERE stp.tag_id IS NOT NULL) as all_tags
    FROM public.get_shop_tag_popularity(NULL) stp
    GROUP BY stp.shop_id
  ),
  top_tags AS (
    -- Get top 3 tags per shop
    SELECT
      td.shop_id,
      jsonb_agg(tag ORDER BY (tag->>'total_votes')::bigint DESC) as top_tags
    FROM tag_data td,
         jsonb_array_elements(td.all_tags) as tag
    GROUP BY td.shop_id
  ),
  tag_ids AS (
    -- Get all tag IDs for filtering
    SELECT
      td.shop_id,
      jsonb_agg(DISTINCT (tag->>'tag_id')) as tag_ids
    FROM tag_data td,
         jsonb_array_elements(td.all_tags) as tag
    GROUP BY td.shop_id
  )
  SELECT
    sd.id,
    sd.name,
    sd.latitude,
    sd.longitude,
    sd.status,
    sd.avg_rating,
    sd.avg_coffee_quality,
    sd.avg_atmosphere,
    sd.avg_noise_level,
    sd.avg_wifi_quality,
    sd.avg_work_friendliness,
    sd.avg_service,
    sd.main_photo_url,
    sd.photo_attribution,
    tt.top_tags,
    ti.tag_ids,
    sd.date_added
  FROM shop_data sd
  LEFT JOIN top_tags tt ON tt.shop_id = sd.id
  LEFT JOIN tag_ids ti ON ti.shop_id = sd.id;
END;
$$;


ALTER FUNCTION "public"."get_shops_with_data"("p_user_id" "uuid", "p_days" integer, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_shop_tag_votes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  target_shop_tag uuid;
  total integer;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    target_shop_tag := NEW.shop_tag_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- When updating, NEW.shop_tag_id may be present or the same as OLD
    target_shop_tag := COALESCE(NEW.shop_tag_id, OLD.shop_tag_id);
  ELSIF (TG_OP = 'DELETE') THEN
    target_shop_tag := OLD.shop_tag_id;
  ELSE
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(vote_type), 0) INTO total FROM public.user_tag_votes WHERE shop_tag_id = target_shop_tag;

  UPDATE public.shop_tags SET votes = total WHERE id = target_shop_tag;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."recalc_shop_tag_votes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_after_insert_shop_review"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Ensure user_stats exists
  PERFORM public.ensure_user_stats_row(NEW.user_id);

  -- Increment reviews_written
  UPDATE public.user_stats
  SET reviews_written = COALESCE(reviews_written,0) + 1,
      last_updated = now()
  WHERE user_id = NEW.user_id;

  -- Call achievement checker
  PERFORM public.check_and_award_achievements(NEW.user_id);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_after_insert_shop_review"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_after_insert_user_photo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.ensure_user_stats_row(NEW.user_id);

  UPDATE public.user_stats
  SET photos_uploaded = (SELECT COUNT(*) FROM public.user_photos WHERE user_id = NEW.user_id),
      last_updated = now()
  WHERE user_id = NEW.user_id;

  PERFORM public.check_and_award_achievements(NEW.user_id);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_after_insert_user_photo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_user_shop_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.ensure_user_stats_row(NEW.user_id);

  -- If new status is 'visited' and old wasn't 'visited', increment counter
  IF (TG_OP = 'INSERT' AND NEW.status = 'visited')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'visited' AND (OLD.status IS DISTINCT FROM NEW.status AND OLD.status <> 'visited')) THEN

    UPDATE public.user_stats
    SET shops_visited = COALESCE(shops_visited,0) + 1,
        last_updated = now()
    WHERE user_id = NEW.user_id;

    PERFORM public.check_and_award_achievements(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_user_shop_status_change"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "category" "text",
    "requirements" "jsonb" NOT NULL,
    "points" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coffee_shops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "google_place_id" "text",
    "name" "text" NOT NULL,
    "address" "text",
    "latitude" numeric,
    "longitude" numeric,
    "formatted_address" "text",
    "phone" "text",
    "website" "text",
    "google_rating" numeric(2,1),
    "price_level" integer,
    "opening_hours" "jsonb",
    "photos" "text"[],
    "types" "text"[],
    "status" "text" DEFAULT 'active'::"text",
    "is_chain_excluded" boolean DEFAULT false,
    "date_added" timestamp with time zone DEFAULT "now"(),
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "google_user_ratings_total" integer,
    "google_photo_reference" "text",
    "main_photo_url" "text",
    "photo_attribution" "text",
    "sync_metadata" "jsonb",
    CONSTRAINT "chk_price_level_range" CHECK ((("price_level" >= 1) AND ("price_level" <= 4))),
    CONSTRAINT "chk_status_enum" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text", 'temporarily_closed'::"text"]))),
    CONSTRAINT "coffee_shops_price_level_check" CHECK ((("price_level" >= 0) AND ("price_level" <= 4)))
);


ALTER TABLE "public"."coffee_shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drink_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "drink_name" "text" NOT NULL,
    "rating" "text" NOT NULL,
    "drink_type" "text",
    "review_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "drink_reviews_rating_check" CHECK (("rating" = ANY (ARRAY['pass'::"text", 'good'::"text", 'awesome'::"text"])))
);


ALTER TABLE "public"."drink_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "rating" numeric(3,2),
    "review_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "coffee_quality_rating" smallint,
    "atmosphere_rating" smallint,
    "noise_level_rating" smallint,
    "wifi_quality_rating" smallint,
    "work_friendliness_rating" smallint,
    "service_rating" smallint,
    CONSTRAINT "ck_shop_reviews_atmosphere_rating_range" CHECK ((("atmosphere_rating" IS NULL) OR (("atmosphere_rating" >= 1) AND ("atmosphere_rating" <= 5)))),
    CONSTRAINT "ck_shop_reviews_coffee_quality_rating_range" CHECK ((("coffee_quality_rating" IS NULL) OR (("coffee_quality_rating" >= 1) AND ("coffee_quality_rating" <= 5)))),
    CONSTRAINT "ck_shop_reviews_noise_level_rating_range" CHECK ((("noise_level_rating" IS NULL) OR (("noise_level_rating" >= 1) AND ("noise_level_rating" <= 5)))),
    CONSTRAINT "ck_shop_reviews_rating_range" CHECK ((("rating" IS NULL) OR (("rating" >= (1)::numeric) AND ("rating" <= (5)::numeric)))),
    CONSTRAINT "ck_shop_reviews_service_rating_range" CHECK ((("service_rating" IS NULL) OR (("service_rating" >= 1) AND ("service_rating" <= 5)))),
    CONSTRAINT "ck_shop_reviews_wifi_quality_rating_range" CHECK ((("wifi_quality_rating" IS NULL) OR (("wifi_quality_rating" >= 1) AND ("wifi_quality_rating" <= 5)))),
    CONSTRAINT "ck_shop_reviews_work_friendliness_rating_range" CHECK ((("work_friendliness_rating" IS NULL) OR (("work_friendliness_rating" >= 1) AND ("work_friendliness_rating" <= 5)))),
    CONSTRAINT "shop_reviews_rating_check" CHECK ((("rating" >= (1)::numeric) AND ("rating" <= (5)::numeric)))
);


ALTER TABLE "public"."shop_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "votes" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone,
    "inserted_count" integer,
    "status" "text" DEFAULT 'started'::"text",
    "error" "text",
    "requested_by" "uuid",
    "requested_email" "text",
    "updated_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "sync_history_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sync_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_id" "uuid" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"(),
    "progress" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shop_id" "uuid",
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "is_admin" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_shop_status" (
    "user_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_shop_status_status_check" CHECK (("status" = ANY (ARRAY['want_to_try'::"text", 'visited'::"text", 'favorite'::"text"])))
);


ALTER TABLE "public"."user_shop_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_stats" (
    "user_id" "uuid" NOT NULL,
    "total_points" integer DEFAULT 0,
    "level" integer DEFAULT 1,
    "shops_visited" integer DEFAULT 0,
    "reviews_written" integer DEFAULT 0,
    "photos_uploaded" integer DEFAULT 0,
    "votes_received" integer DEFAULT 0,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_tag_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vote_type" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ck_user_tag_votes_vote_type" CHECK (("vote_type" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."user_tag_votes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coffee_shops"
    ADD CONSTRAINT "coffee_shops_google_place_id_key" UNIQUE ("google_place_id");



ALTER TABLE ONLY "public"."coffee_shops"
    ADD CONSTRAINT "coffee_shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drink_reviews"
    ADD CONSTRAINT "drink_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_reviews"
    ADD CONSTRAINT "shop_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_tags"
    ADD CONSTRAINT "shop_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_history"
    ADD CONSTRAINT "sync_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_photos"
    ADD CONSTRAINT "user_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_shop_status"
    ADD CONSTRAINT "user_shop_status_pkey" PRIMARY KEY ("user_id", "shop_id");



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_tag_votes"
    ADD CONSTRAINT "user_tag_votes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_achievements_key" ON "public"."achievements" USING "btree" ("key");



CREATE INDEX "idx_coffee_shops_date_added" ON "public"."coffee_shops" USING "btree" ("date_added");



CREATE INDEX "idx_coffee_shops_google_place_id" ON "public"."coffee_shops" USING "btree" ("google_place_id");



CREATE INDEX "idx_drink_reviews_shop_count" ON "public"."drink_reviews" USING "btree" ("shop_id");



CREATE INDEX "idx_drink_reviews_shop_id" ON "public"."drink_reviews" USING "btree" ("shop_id");



CREATE INDEX "idx_drink_reviews_user_id" ON "public"."drink_reviews" USING "btree" ("user_id");



CREATE INDEX "idx_shop_reviews_shop_id" ON "public"."shop_reviews" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_reviews_shop_rating" ON "public"."shop_reviews" USING "btree" ("shop_id", "rating");



CREATE INDEX "idx_shop_reviews_user_id" ON "public"."shop_reviews" USING "btree" ("user_id");



CREATE INDEX "idx_shop_tags_shop_id" ON "public"."shop_tags" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_tags_tag_id" ON "public"."shop_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_shop_tags_user_id" ON "public"."shop_tags" USING "btree" ("user_id");



CREATE INDEX "idx_sync_history_started_at" ON "public"."sync_history" USING "btree" ("started_at");



CREATE INDEX "idx_tags_category" ON "public"."tags" USING "btree" ("category");



CREATE INDEX "idx_tags_name_lower" ON "public"."tags" USING "btree" ("lower"("name"));



CREATE INDEX "idx_user_achievements_user_id" ON "public"."user_achievements" USING "btree" ("user_id");



CREATE INDEX "idx_user_photos_shop_id" ON "public"."user_photos" USING "btree" ("shop_id");



CREATE INDEX "idx_user_photos_user_id" ON "public"."user_photos" USING "btree" ("user_id");



CREATE INDEX "idx_user_shop_status_shop_id" ON "public"."user_shop_status" USING "btree" ("shop_id");



CREATE INDEX "idx_user_shop_status_user_id" ON "public"."user_shop_status" USING "btree" ("user_id");



CREATE INDEX "idx_user_stats_user_id" ON "public"."user_stats" USING "btree" ("user_id");



CREATE INDEX "idx_user_tag_votes_shop_tag_id" ON "public"."user_tag_votes" USING "btree" ("shop_tag_id");



CREATE INDEX "idx_user_tag_votes_user_id" ON "public"."user_tag_votes" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_shop_reviews_user_shop" ON "public"."shop_reviews" USING "btree" ("user_id", "shop_id");



CREATE UNIQUE INDEX "uq_shop_tags_shop_tag_user" ON "public"."shop_tags" USING "btree" ("shop_id", "tag_id", "user_id");



CREATE UNIQUE INDEX "uq_tags_name_category" ON "public"."tags" USING "btree" ("lower"("name"), "category");



CREATE UNIQUE INDEX "uq_user_achievement_user_ach" ON "public"."user_achievements" USING "btree" ("user_id", "achievement_id");



CREATE UNIQUE INDEX "uq_user_tag_votes_shop_tag_user" ON "public"."user_tag_votes" USING "btree" ("shop_tag_id", "user_id");



CREATE UNIQUE INDEX "ux_coffee_shops_google_place_id" ON "public"."coffee_shops" USING "btree" ("google_place_id");



CREATE OR REPLACE TRIGGER "tr_shop_reviews_after_insert" AFTER INSERT ON "public"."shop_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."trg_after_insert_shop_review"();



CREATE OR REPLACE TRIGGER "tr_user_photos_after_insert" AFTER INSERT ON "public"."user_photos" FOR EACH ROW EXECUTE FUNCTION "public"."trg_after_insert_user_photo"();



CREATE OR REPLACE TRIGGER "tr_user_shop_status_on_change" AFTER INSERT OR UPDATE ON "public"."user_shop_status" FOR EACH ROW EXECUTE FUNCTION "public"."trg_user_shop_status_change"();



CREATE OR REPLACE TRIGGER "trg_compute_overall_rating" BEFORE INSERT OR UPDATE ON "public"."shop_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."compute_shop_review_overall"();



CREATE OR REPLACE TRIGGER "trg_recalc_shop_tag_votes" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_tag_votes" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_shop_tag_votes"();



ALTER TABLE ONLY "public"."drink_reviews"
    ADD CONSTRAINT "fk_drink_review_shop" FOREIGN KEY ("shop_id") REFERENCES "public"."coffee_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drink_reviews"
    ADD CONSTRAINT "fk_drink_review_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_reviews"
    ADD CONSTRAINT "fk_review_shop" FOREIGN KEY ("shop_id") REFERENCES "public"."coffee_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_reviews"
    ADD CONSTRAINT "fk_review_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_shop_status"
    ADD CONSTRAINT "fk_shop" FOREIGN KEY ("shop_id") REFERENCES "public"."coffee_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_tags"
    ADD CONSTRAINT "fk_shop_tags_shop" FOREIGN KEY ("shop_id") REFERENCES "public"."coffee_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_tags"
    ADD CONSTRAINT "fk_shop_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_tags"
    ADD CONSTRAINT "fk_shop_tags_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_shop_status"
    ADD CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "fk_user_achiv_ach" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "fk_user_achiv_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_photos"
    ADD CONSTRAINT "fk_user_photos_shop" FOREIGN KEY ("shop_id") REFERENCES "public"."coffee_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_photos"
    ADD CONSTRAINT "fk_user_photos_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "fk_user_stats_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tag_votes"
    ADD CONSTRAINT "fk_user_tag_votes_shop_tag" FOREIGN KEY ("shop_tag_id") REFERENCES "public"."shop_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tag_votes"
    ADD CONSTRAINT "fk_user_tag_votes_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."check_and_award_achievements"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_award_achievements"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_award_achievements"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_shop_review_overall"() TO "anon";
GRANT ALL ON FUNCTION "public"."compute_shop_review_overall"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_shop_review_overall"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_user_stats_row"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_user_stats_row"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_user_stats_row"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shop_details"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shop_details"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shop_details"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shop_tag_popularity"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shop_tag_popularity"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shop_tag_popularity"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shop_tag_score"("p_shop_id" "uuid", "p_tag_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shop_tag_score"("p_shop_id" "uuid", "p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shop_tag_score"("p_shop_id" "uuid", "p_tag_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shops_with_data"("p_user_id" "uuid", "p_days" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_shops_with_data"("p_user_id" "uuid", "p_days" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shops_with_data"("p_user_id" "uuid", "p_days" integer, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_shop_tag_votes"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_shop_tag_votes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_shop_tag_votes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_after_insert_shop_review"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_after_insert_shop_review"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_after_insert_shop_review"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_after_insert_user_photo"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_after_insert_user_photo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_after_insert_user_photo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_user_shop_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_user_shop_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_user_shop_status_change"() TO "service_role";


















GRANT ALL ON TABLE "public"."achievements" TO "anon";
GRANT ALL ON TABLE "public"."achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."achievements" TO "service_role";



GRANT ALL ON TABLE "public"."coffee_shops" TO "anon";
GRANT ALL ON TABLE "public"."coffee_shops" TO "authenticated";
GRANT ALL ON TABLE "public"."coffee_shops" TO "service_role";



GRANT ALL ON TABLE "public"."drink_reviews" TO "anon";
GRANT ALL ON TABLE "public"."drink_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."drink_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."shop_reviews" TO "anon";
GRANT ALL ON TABLE "public"."shop_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."shop_tags" TO "anon";
GRANT ALL ON TABLE "public"."shop_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_tags" TO "service_role";



GRANT ALL ON TABLE "public"."sync_history" TO "anon";
GRANT ALL ON TABLE "public"."sync_history" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_history" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."user_photos" TO "anon";
GRANT ALL ON TABLE "public"."user_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."user_photos" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_shop_status" TO "anon";
GRANT ALL ON TABLE "public"."user_shop_status" TO "authenticated";
GRANT ALL ON TABLE "public"."user_shop_status" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";



GRANT ALL ON TABLE "public"."user_tag_votes" TO "anon";
GRANT ALL ON TABLE "public"."user_tag_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tag_votes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























\unrestrict XTcPdcsm5TnoILLa2nOhzk9NluIPC1wsznwyV5BWPEXr8TN12LruwcF56yTX8Jt

RESET ALL;
