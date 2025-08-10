CREATE TABLE "ai_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_conditions" text NOT NULL,
	"technical_outlook" text NOT NULL,
	"risk_assessment" text NOT NULL,
	"sector_rotation" text NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_collection_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"data_type" text NOT NULL,
	"symbol" text,
	"collection_date" timestamp NOT NULL,
	"records_processed" integer NOT NULL,
	"api_calls_used" integer NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"data_range_start" timestamp,
	"data_range_end" timestamp,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_quality_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"series_id" text NOT NULL,
	"records_processed" integer NOT NULL,
	"records_stored" integer NOT NULL,
	"records_skipped" integer NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"execution_time" integer,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economic_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"importance" text NOT NULL,
	"event_date" timestamp NOT NULL,
	"actual" text,
	"forecast" text,
	"previous" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economic_time_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"indicator" text NOT NULL,
	"value" numeric(15, 4) NOT NULL,
	"value_formatted" text NOT NULL,
	"category" text NOT NULL,
	"importance" text NOT NULL,
	"frequency" text NOT NULL,
	"units" text NOT NULL,
	"release_date" timestamp NOT NULL,
	"period_date" timestamp NOT NULL,
	"previous_value" numeric(15, 4),
	"monthly_change" numeric(8, 4),
	"annual_change" numeric(8, 4),
	"data_source" text DEFAULT 'fred' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"subscribed_at" timestamp DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp,
	"unsubscribe_token" text NOT NULL,
	CONSTRAINT "email_subscriptions_email_unique" UNIQUE("email"),
	CONSTRAINT "email_subscriptions_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE "historical_context" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_name" text NOT NULL,
	"metric_value" numeric(10, 4) NOT NULL,
	"context_date" timestamp NOT NULL,
	"subsequent_return_1w" numeric(8, 4),
	"subsequent_return_1m" numeric(8, 4),
	"subsequent_return_3m" numeric(8, 4),
	"event_context" text,
	"market_regime" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_context_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"cpi" numeric(8, 4),
	"cpi_change" numeric(8, 4),
	"core_cpi" numeric(8, 4),
	"unemployment" numeric(5, 2),
	"payrolls" integer,
	"retail_sales" numeric(8, 4),
	"housing_starts" numeric(8, 4),
	"fed_funds" numeric(5, 2),
	"inflation_trend" text,
	"employment_trend" text,
	"housing_trend" text,
	"overall_sentiment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_economic_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"indicator" text NOT NULL,
	"value" text NOT NULL,
	"previous_value" text,
	"forecast" text,
	"unit" text,
	"period" text NOT NULL,
	"release_date" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_market_sentiment" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"vix" numeric(5, 2),
	"vix_change" numeric(5, 2),
	"put_call_ratio" numeric(5, 4),
	"fear_greed_index" integer,
	"aaii_bullish" numeric(5, 2),
	"aaii_bearish" numeric(5, 2),
	"data_source" text DEFAULT 'twelve_data' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "historical_market_sentiment_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "historical_sector_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"date" timestamp NOT NULL,
	"open" numeric(10, 2) NOT NULL,
	"high" numeric(10, 2) NOT NULL,
	"low" numeric(10, 2) NOT NULL,
	"close" numeric(10, 2) NOT NULL,
	"volume" integer NOT NULL,
	"change_percent" numeric(5, 2),
	"data_source" text DEFAULT 'twelve_data' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "historical_sector_data_symbol_date_unique" UNIQUE("symbol","date")
);
--> statement-breakpoint
CREATE TABLE "historical_stock_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"open" numeric(10, 2) NOT NULL,
	"high" numeric(10, 2) NOT NULL,
	"low" numeric(10, 2) NOT NULL,
	"close" numeric(10, 2) NOT NULL,
	"volume" integer NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"data_source" text DEFAULT 'twelve_data' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_technical_indicators" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"date" timestamp NOT NULL,
	"rsi" numeric(5, 2),
	"macd" numeric(8, 4),
	"macd_signal" numeric(8, 4),
	"macd_histogram" numeric(8, 4),
	"vwap" numeric(10, 2),
	"bollinger_upper" numeric(10, 2),
	"bollinger_middle" numeric(10, 2),
	"bollinger_lower" numeric(10, 2),
	"atr" numeric(8, 4),
	"adx" numeric(5, 2),
	"stoch_k" numeric(5, 2),
	"stoch_d" numeric(5, 2),
	"williams_r" numeric(5, 2),
	"data_source" text DEFAULT 'twelve_data' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "historical_technical_indicators_symbol_date_unique" UNIQUE("symbol","date")
);
--> statement-breakpoint
CREATE TABLE "market_breadth" (
	"id" serial PRIMARY KEY NOT NULL,
	"advancing_issues" integer NOT NULL,
	"declining_issues" integer NOT NULL,
	"advancing_volume" numeric(15, 0) NOT NULL,
	"declining_volume" numeric(15, 0) NOT NULL,
	"new_highs" integer NOT NULL,
	"new_lows" integer NOT NULL,
	"mcclellan_oscillator" numeric(10, 4),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern_name" text NOT NULL,
	"description" text NOT NULL,
	"detection_date" timestamp NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"pattern_data" jsonb NOT NULL,
	"historical_precedents" jsonb,
	"outcome_actual" text,
	"outcome_predicted" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_regimes" (
	"id" serial PRIMARY KEY NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"regime_type" text NOT NULL,
	"characteristics" jsonb NOT NULL,
	"trigger_event" text,
	"avg_return" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"volatility" numeric(8, 4),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_sentiment" (
	"id" serial PRIMARY KEY NOT NULL,
	"vix" numeric(5, 2) NOT NULL,
	"vix_change" numeric(5, 2),
	"put_call_ratio" numeric(5, 2) NOT NULL,
	"put_call_change" numeric(5, 2),
	"aaii_bullish" numeric(5, 2) NOT NULL,
	"aaii_bullish_change" numeric(5, 2),
	"aaii_bearish" numeric(5, 2) NOT NULL,
	"aaii_bearish_change" numeric(5, 2),
	"aaii_neutral" numeric(5, 2) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"data_source" text DEFAULT 'aaii_survey' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_percentiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_name" text NOT NULL,
	"lookback_period" text NOT NULL,
	"percentile_5" numeric(10, 4),
	"percentile_25" numeric(10, 4),
	"percentile_50" numeric(10, 4),
	"percentile_75" numeric(10, 4),
	"percentile_95" numeric(10, 4),
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"data_points" integer NOT NULL,
	CONSTRAINT "metric_percentiles_metric_name_lookback_period_unique" UNIQUE("metric_name","lookback_period")
);
--> statement-breakpoint
CREATE TABLE "narrative_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"theme_group" text NOT NULL,
	"narrative_thread" text NOT NULL,
	"key_events" jsonb,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '0.5' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sector_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"change_percent" numeric(5, 2) NOT NULL,
	"five_day_change" numeric(5, 2),
	"one_month_change" numeric(5, 2),
	"volume" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"change" numeric(10, 2) NOT NULL,
	"change_percent" numeric(5, 2) NOT NULL,
	"volume" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technical_indicators" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"rsi" numeric(5, 2),
	"macd" numeric(10, 4),
	"macd_signal" numeric(10, 4),
	"bb_upper" numeric(10, 2),
	"bb_middle" numeric(10, 2),
	"bb_lower" numeric(10, 2),
	"percent_b" numeric(5, 4),
	"adx" numeric(5, 2),
	"stoch_k" numeric(5, 2),
	"stoch_d" numeric(5, 2),
	"sma_20" numeric(10, 2),
	"sma_50" numeric(10, 2),
	"vwap" numeric(10, 2),
	"atr" numeric(10, 4),
	"willr" numeric(5, 2),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thematic_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"bottom_line" text NOT NULL,
	"dominant_theme" text NOT NULL,
	"setup" text NOT NULL,
	"evidence" text NOT NULL,
	"implications" text NOT NULL,
	"catalysts" text NOT NULL,
	"contrarian_view" text NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"market_context" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vix_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"vix_value" numeric(5, 2) NOT NULL,
	"vix_change" numeric(5, 2) NOT NULL,
	"vix_change_percent" numeric(5, 2) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_audit_data_type" ON "data_collection_audit" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "idx_audit_collection_date" ON "data_collection_audit" USING btree ("collection_date");--> statement-breakpoint
CREATE INDEX "idx_historical_sentiment_date" ON "historical_market_sentiment" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_historical_sector_symbol" ON "historical_sector_data" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_historical_sector_date" ON "historical_sector_data" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_historical_tech_symbol" ON "historical_technical_indicators" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_historical_tech_date" ON "historical_technical_indicators" USING btree ("date");