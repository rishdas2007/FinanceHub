--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.9

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

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: neondb_owner
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO neondb_owner;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: neondb_owner
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO neondb_owner;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: neondb_owner
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.alert_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    symbol text NOT NULL,
    rule text NOT NULL,
    horizon text DEFAULT '60D'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.alert_rules OWNER TO neondb_owner;

--
-- Name: data_collection_audit; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.data_collection_audit (
    id integer NOT NULL,
    data_type text NOT NULL,
    symbol text,
    collection_date timestamp without time zone NOT NULL,
    records_processed integer NOT NULL,
    api_calls_used integer NOT NULL,
    status text NOT NULL,
    error_message text,
    data_range_start timestamp without time zone,
    data_range_end timestamp without time zone,
    processing_time_ms integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.data_collection_audit OWNER TO neondb_owner;

--
-- Name: data_collection_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.data_collection_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_collection_audit_id_seq OWNER TO neondb_owner;

--
-- Name: data_collection_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.data_collection_audit_id_seq OWNED BY public.data_collection_audit.id;


--
-- Name: data_quality_log; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.data_quality_log (
    id integer NOT NULL,
    operation text NOT NULL,
    series_id text NOT NULL,
    records_processed integer NOT NULL,
    records_stored integer NOT NULL,
    records_skipped integer NOT NULL,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    execution_time integer,
    status text NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.data_quality_log OWNER TO neondb_owner;

--
-- Name: data_quality_log_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.data_quality_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_quality_log_id_seq OWNER TO neondb_owner;

--
-- Name: data_quality_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.data_quality_log_id_seq OWNED BY public.data_quality_log.id;


--
-- Name: econ_series_def; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.econ_series_def (
    series_id text NOT NULL,
    display_name text NOT NULL,
    category text NOT NULL,
    type_tag text NOT NULL,
    native_unit text NOT NULL,
    standard_unit text NOT NULL,
    scale_hint text DEFAULT 'NONE'::text NOT NULL,
    display_precision integer DEFAULT 2 NOT NULL,
    default_transform text NOT NULL,
    align_policy text DEFAULT 'last'::text NOT NULL,
    preferred_window_months integer DEFAULT 60 NOT NULL,
    seasonal_adj text NOT NULL,
    source text NOT NULL,
    source_url text
);


ALTER TABLE public.econ_series_def OWNER TO neondb_owner;

--
-- Name: TABLE econ_series_def; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public.econ_series_def IS 'Economic series metadata and formatting rules';


--
-- Name: econ_series_features; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.econ_series_features (
    series_id text NOT NULL,
    period_end date NOT NULL,
    transform_code text NOT NULL,
    ref_window_months integer NOT NULL,
    value_t double precision NOT NULL,
    delta_t double precision NOT NULL,
    mean_level double precision NOT NULL,
    sd_level double precision NOT NULL,
    mean_delta double precision NOT NULL,
    sd_delta double precision NOT NULL,
    level_z double precision NOT NULL,
    change_z double precision NOT NULL,
    level_class text NOT NULL,
    trend_class text NOT NULL,
    multi_signal text NOT NULL,
    pipeline_version text NOT NULL,
    provenance jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.econ_series_features OWNER TO neondb_owner;

--
-- Name: TABLE econ_series_features; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public.econ_series_features IS 'Gold layer: Z-scores, signals, and classifications';


--
-- Name: econ_series_observation; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.econ_series_observation (
    series_id text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    freq text NOT NULL,
    value_std double precision NOT NULL,
    standard_unit text NOT NULL,
    agg_method text NOT NULL,
    scale_hint text NOT NULL,
    display_precision integer NOT NULL,
    transform_code text NOT NULL
);


ALTER TABLE public.econ_series_observation OWNER TO neondb_owner;

--
-- Name: TABLE econ_series_observation; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public.econ_series_observation IS 'Silver layer: standardized economic observations';


--
-- Name: economic_indicators_current; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.economic_indicators_current (
    id integer NOT NULL,
    series_id text NOT NULL,
    metric text NOT NULL,
    category text NOT NULL,
    type text NOT NULL,
    frequency text NOT NULL,
    value_numeric numeric(15,4) NOT NULL,
    period_date_desc text NOT NULL,
    release_date_desc text NOT NULL,
    period_date timestamp without time zone NOT NULL,
    release_date timestamp without time zone NOT NULL,
    unit text NOT NULL,
    is_latest boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.economic_indicators_current OWNER TO neondb_owner;

--
-- Name: economic_indicators_current_backup; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.economic_indicators_current_backup (
    id integer,
    series_id text,
    metric text,
    category text,
    type text,
    frequency text,
    value_numeric numeric(15,4),
    period_date_desc text,
    release_date_desc text,
    period_date timestamp without time zone,
    release_date timestamp without time zone,
    unit text,
    is_latest boolean,
    updated_at timestamp without time zone
);


ALTER TABLE public.economic_indicators_current_backup OWNER TO neondb_owner;

--
-- Name: economic_indicators_current_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.economic_indicators_current_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.economic_indicators_current_id_seq OWNER TO neondb_owner;

--
-- Name: economic_indicators_current_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.economic_indicators_current_id_seq OWNED BY public.economic_indicators_current.id;


--
-- Name: economic_indicators_history; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.economic_indicators_history (
    id integer NOT NULL,
    metric_name text NOT NULL,
    series_id text NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    unit text NOT NULL,
    frequency text NOT NULL,
    value numeric NOT NULL,
    period_date date NOT NULL,
    release_date date,
    forecast numeric,
    prior_value numeric,
    monthly_change numeric,
    annual_change numeric,
    z_score_12m numeric,
    three_month_annualized numeric,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.economic_indicators_history OWNER TO neondb_owner;

--
-- Name: economic_indicators_history_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.economic_indicators_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.economic_indicators_history_id_seq OWNER TO neondb_owner;

--
-- Name: economic_indicators_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.economic_indicators_history_id_seq OWNED BY public.economic_indicators_history.id;


--
-- Name: economic_statistical_alerts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.economic_statistical_alerts (
    id integer NOT NULL,
    metric_name text NOT NULL,
    category text NOT NULL,
    current_value numeric(15,4) NOT NULL,
    mean numeric(15,4) NOT NULL,
    std numeric(15,4) NOT NULL,
    z_score numeric(8,4) NOT NULL,
    trend text NOT NULL,
    alert_type text NOT NULL,
    period_start_date text NOT NULL,
    period_end_date text NOT NULL,
    analysis_date timestamp without time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.economic_statistical_alerts OWNER TO neondb_owner;

--
-- Name: economic_statistical_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.economic_statistical_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.economic_statistical_alerts_id_seq OWNER TO neondb_owner;

--
-- Name: economic_statistical_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.economic_statistical_alerts_id_seq OWNED BY public.economic_statistical_alerts.id;


--
-- Name: email_subscriptions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.email_subscriptions (
    id integer NOT NULL,
    email text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    subscribed_at timestamp without time zone DEFAULT now() NOT NULL,
    unsubscribed_at timestamp without time zone,
    unsubscribe_token text NOT NULL
);


ALTER TABLE public.email_subscriptions OWNER TO neondb_owner;

--
-- Name: email_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.email_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_subscriptions_id_seq OWNER TO neondb_owner;

--
-- Name: email_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.email_subscriptions_id_seq OWNED BY public.email_subscriptions.id;


--
-- Name: equity_daily_bars; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.equity_daily_bars (
    symbol text NOT NULL,
    ts_utc timestamp with time zone NOT NULL,
    open double precision NOT NULL,
    high double precision NOT NULL,
    low double precision NOT NULL,
    close double precision NOT NULL,
    volume integer
);


ALTER TABLE public.equity_daily_bars OWNER TO neondb_owner;