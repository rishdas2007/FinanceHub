#!/usr/bin/env python3
import sys
import os
import json
import math
import argparse
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests

REQUIRED_COLS = ["metric_name","series_id","type","category","unit","frequency","value","period_date"]

DEFAULT_TYPE_MAP = {
    # Leading
    "10-Year Treasury Yield": "leading",
    "Yield Curve (10yr-2yr)": "leading",
    "Building Permits": "leading",
    "Consumer Confidence Index": "leading",
    "Leading Economic Index": "leading",
    "Manufacturers New Orders: Durable Goods": "leading",
    "Manufacturing PMI": "leading",
    "Michigan Consumer Sentiment": "leading",
    "Stock Prices (S&P 500)": "leading",  # not in list but exemplar
    "Average Weekly Hours": "leading",
    "Average Weekly Hours of Production Employees: Manufacturing": "leading",
    # Coincident
    "Industrial Production": "coincident",
    "Industrial Production Index": "coincident",
    "Real Gross Domestic Product": "coincident",
    "Nonfarm Payrolls": "coincident",
    "Total Nonfarm Payrolls": "coincident",
    "Employment to Population Ratio": "coincident",
    "Employment Population Ratio": "coincident",
    "Retail Sales": "coincident",
    "Retail Sales Ex-Auto": "coincident",
    "Retail Sales: Food Services": "coincident",
    "Capacity Utilization (Mfg)": "coincident",
    "Commercial & Industrial Loans": "coincident",
    "Total Construction Spending": "coincident",
    "Total Consumer Credit Outstanding": "coincident",
    "US Dollar Index": "coincident",
    "US / Euro Foreign Exchange Rate": "coincident",
    # Lagging
    "Unemployment Rate": "lagging",
    "U-6 Unemployment Rate": "lagging",
    "Continuing Claims": "lagging",
    "Continuing Jobless Claims": "lagging",
    "Core CPI": "lagging",
    "Core CPI Year-over-Year": "lagging",
    "CPI All Items": "lagging",
    "CPI Energy": "lagging",
    "CPI Year-over-Year": "lagging",
    "PCE Price Index": "lagging",
    "PCE Price Index YoY": "lagging",
    "Core PCE Price Index": "lagging",
    "Core Personal Consumption Expenditures": "lagging",
    "Personal Consumption Expenditures": "lagging",
    "PPI All Commodities": "lagging",
    "PPI Final Demand": "lagging",
    "Producer Price Index: Final Demand": "lagging",
    "Average Hourly Earnings": "lagging",
    "Average Hourly Earnings of All Employees": "lagging",
}

DEFAULT_CATEGORY_MAP = {
    "10-Year Treasury Yield": "Monetary Policy",
    "30-Year Fixed Rate Mortgage Average": "Monetary Policy",
    "30-Year Mortgage Rate": "Monetary Policy",
    "Federal Funds Rate": "Monetary Policy",
    "Yield Curve (10yr-2yr)": "Monetary Policy",
    "US Dollar Index": "Monetary Policy",
    "US / Euro Foreign Exchange Rate": "Monetary Policy",

    "Core CPI": "Inflation",
    "Core CPI Year-over-Year": "Inflation",
    "Core PCE Price Index": "Inflation",
    "Core Personal Consumption Expenditures": "Inflation",
    "Core PPI": "Inflation",
    "CPI All Items": "Inflation",
    "CPI Energy": "Inflation",
    "CPI Year-over-Year": "Inflation",
    "PCE Price Index": "Inflation",
    "PCE Price Index YoY": "Inflation",
    "PPI All Commodities": "Inflation",
    "PPI Final Demand": "Inflation",
    "Producer Price Index: Final Demand": "Inflation",
    "Gasoline Prices": "Inflation",
    "US Regular All Formulations Gas Price": "Inflation",

    "Unemployment Rate": "Labor",
    "U-6 Unemployment Rate": "Labor",
    "Labor Force Participation Rate": "Labor",
    "Average Hourly Earnings": "Labor",
    "Average Hourly Earnings of All Employees": "Labor",
    "All Employees: Manufacturing": "Labor",
    "Manufacturing Employment": "Labor",
    "Nonfarm Payrolls": "Labor",
    "Total Nonfarm Payrolls": "Labor",
    "Initial Jobless Claims": "Labor",
    "Continuing Claims": "Labor",
    "Continuing Jobless Claims": "Labor",
    "Employment Population Ratio": "Labor",
    "Employment to Population Ratio": "Labor",
    "JOLTS Job Openings": "Labor",
    "JOLTS Hires": "Labor",
    "JOLTS Quits": "Labor",
    "Job Openings and Labor Turnover Survey: Quits": "Labor",
    "Average Weekly Hours": "Labor",
    "Average Weekly Hours of Production Employees: Manufacturing": "Labor",
    "Manufacturing Hours": "Labor",

    "GDP Growth Rate": "Growth",
    "Real Gross Domestic Product": "Growth",
    "Retail Sales": "Growth",
    "Retail Sales MoM": "Growth",
    "Retail Sales Ex-Auto": "Growth",
    "Retail Sales: Food Services": "Growth",
    "E-commerce Retail Sales": "Growth",
    "Industrial Production": "Growth",
    "Industrial Production Index": "Growth",
    "Industrial Production YoY": "Growth",
    "Capacity Utilization (Mfg)": "Growth",
    "Manufacturers New Orders: Durable Goods": "Growth",
    "Durable Goods Orders": "Growth",
    "Durable Goods Orders MoM": "Growth",
    "Total Construction Spending": "Growth",
    "Existing Home Sales": "Growth",
    "New Home Sales": "Growth",
    "Housing Starts": "Growth",
    "Building Permits": "Growth",
    "Personal Consumption Expenditures": "Growth",
    "Real Disposable Personal Income": "Growth",
    "Personal Savings Rate": "Growth",
    "Total Business: Inventories to Sales Ratio": "Growth",
    "Inventories to Sales Ratio": "Growth",
    "Total Consumer Credit Outstanding": "Growth",

    "Consumer Confidence Index": "Sentiment",
    "Michigan Consumer Sentiment": "Sentiment",
    "S&P Global Manufacturing PMI": "Sentiment",
    "Manufacturing PMI": "Sentiment",
    "Leading Economic Index": "Sentiment",
    "Chicago Fed National Activity Index": "Sentiment",
}

# Optional curated overrides for tricky FRED IDs (many more can be added)
# (These are commonly used, Seasonally Adjusted where available)
OVERRIDES = {
    "10-Year Treasury Yield": "DGS10",
    "30-Year Fixed Rate Mortgage Average": "MORTGAGE30US",
    "30-Year Mortgage Rate": "MORTGAGE30US",
    "Federal Funds Rate": "FEDFUNDS",
    "Yield Curve (10yr-2yr)": None,  # computed: DGS10 - DGS2
    "US / Euro Foreign Exchange Rate": "EXUSEU",
    "US Dollar Index": "DTWEXBGS",  # Broad Dollar Index, Goods & Services, SA
    "All Employees: Manufacturing": "MANEMP",
    "Average Weekly Hours": "AWHMAN",  # Manufacturing
    "Average Weekly Hours of Production Employees: Manufacturing": "AWHMAN",  # Best proxy if specific PE series not available
    "Average Hourly Earnings of All Employees": "CES0500000003",  # Total private
    "Average Hourly Earnings": "CES0500000003",

    "Building Permits": "PERMIT",
    "Housing Starts": "HOUST",
    "Existing Home Sales": "EXHOSLUSM495S",
    "New Home Sales": "HSN1F",

    "Capacity Utilization (Mfg)": "TCU",  # Total industry (proxy); for Mfg: "MCUMFN"
    "Industrial Production": "INDPRO",
    "Industrial Production Index": "INDPRO",
    "Industrial Production YoY": "INDPRO",  # compute YoY

    "Consumer Confidence Index": "UMCSENT",  # University of Michigan Sentiment (proxy if Conference Board unavailable)
    "Michigan Consumer Sentiment": "UMCSENT",
    "S&P Global Manufacturing PMI": "USMFGPMI",  # if not found, will search
    "Manufacturing PMI": "USMFGPMI",

    "Manufacturers New Orders: Durable Goods": "DGORDER",
    "Durable Goods Orders": "DGORDER",
    "Durable Goods Orders MoM": "DGORDER",  # compute MoM pct

    "E-commerce Retail Sales": "ECOMSA",
    "Retail Sales": "RSAFS",
    "Retail Sales Ex-Auto": "RSXFS",
    "Retail Sales: Food Services": "RSFSXMV",  # if not found, will search

    "Employment Population Ratio": "EMRATIO",
    "Employment to Population Ratio": "EMRATIO",
    "Nonfarm Payrolls": "PAYEMS",
    "Total Nonfarm Payrolls": "PAYEMS",
    "Labor Force Participation Rate": "CIVPART",
    "Unemployment Rate": "UNRATE",
    "U-6 Unemployment Rate": "U6RATE",
    "Initial Jobless Claims": "ICSA",
    "Continuing Claims": "CCSA",
    "Continuing Jobless Claims": "CCSA",

    "Commercial & Industrial Loans": "BUSLOANS",
    "Total Business: Inventories to Sales Ratio": "ISRATIO",
    "Inventories to Sales Ratio": "ISRATIO",
    "Total Construction Spending": "TTLCONS",
    "Total Consumer Credit Outstanding": "TOTALSL",
    "Chicago Fed National Activity Index": "CFNAI",

    "CPI All Items": "CPIAUCSL",
    "CPI Energy": "CPIENGSL",
    "Core CPI": "CPILFESL",
    "CPI Year-over-Year": "CPIAUCSL",   # compute YoY
    "Core CPI Year-over-Year": "CPILFESL",  # compute YoY

    "PCE Price Index": "PCEPI",
    "PCE Price Index YoY": "PCEPI",  # compute YoY
    "Core PCE Price Index": "PCEPILFE",
    "Core Personal Consumption Expenditures": "PCEPILFE",

    "PPI All Commodities": "PPIACO",
    "PPI Final Demand": "WPSFD49207",  # legacy; "PPIACO" covers commodities; will also search "PPIFGS"
    "Producer Price Index: Final Demand": "WPSFD49207",

    "Gasoline Prices": "GASREGW",  # Weekly (EIA), NSA; will align month-end
    "US Regular All Formulations Gas Price": "GASREGW",

    "Real Gross Domestic Product": "GDPC1",
    "GDP Growth Rate": "GDPC1",  # compute QoQ annualized

    "Personal Consumption Expenditures": "PCEC",
    "Real Disposable Personal Income": "DSPIC96",
    "Personal Savings Rate": "PSAVERT",
    "Case-Shiller Home Price Index": "CSUSHPISA",  # 20-City SA Composite; if unavailable, search
    "Leading Economic Index": None,  # The Conference Board LEI (may require subscription); will search fallback
    "Months Supply of Homes": "MSACSR",
}

SPECIAL_COMPUTATIONS = {
    # metric_name: spec dict
    "Yield Curve (10yr-2yr)": {"type": "spread", "id_a": "DGS10", "id_b": "DGS2", "unit": "percent", "frequency": "Daily"},
    "GDP Growth Rate": {"type": "gdp_qoq_annualized", "base_id": "GDPC1", "unit": "percent", "frequency": "Quarterly"},
    "CPI Year-over-Year": {"type": "yoy_pct", "base_id": "CPIAUCSL", "unit": "percent", "frequency": "Monthly"},
    "Core CPI Year-over-Year": {"type": "yoy_pct", "base_id": "CPILFESL", "unit": "percent", "frequency": "Monthly"},
    "Industrial Production YoY": {"type": "yoy_pct", "base_id": "INDPRO", "unit": "percent", "frequency": "Monthly"},
    "PCE Price Index YoY": {"type": "yoy_pct", "base_id": "PCEPI", "unit": "percent", "frequency": "Monthly"},
    "Durable Goods Orders MoM": {"type": "mom_pct", "base_id": "DGORDER", "unit": "percent", "frequency": "Monthly"},
    "Retail Sales MoM": {"type": "mom_pct", "base_id": "RSAFS", "unit": "percent", "frequency": "Monthly"},
}

def month_end(dt: pd.Timestamp) -> pd.Timestamp:
    return (dt + pd.offsets.MonthEnd(0)).normalize()

def fred_get_json(endpoint: str, params: Dict) -> dict:
    base = "https://api.stlouisfed.org/fred/"
    url = base + endpoint
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def fred_fetch_series(api_key: str, series_id: str, start: str) -> pd.DataFrame:
    js = fred_get_json("series/observations", {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "observation_start": start
    })
    obs = js.get("observations", [])
    df = pd.DataFrame(obs)
    if df.empty:
        return pd.DataFrame(columns=["date","value"])
    df = df[["date","value"]].copy()
    # coerce
    df["value"] = pd.to_numeric(df["value"].replace(".", pd.NA), errors="coerce")
    df["date"] = pd.to_datetime(df["date"])
    return df

def fred_series_info(api_key: str, series_id: str) -> dict:
    js = fred_get_json("series", {"series_id": series_id, "api_key": api_key, "file_type": "json"})
    items = js.get("seriess", [])
    return items[0] if items else {}

def fred_search_series(api_key: str, query: str, seasonal_adj: Optional[str]=None) -> List[dict]:
    js = fred_get_json("series/search", {"search_text": query, "api_key": api_key, "file_type": "json"})
    items = js.get("seriess", [])
    if seasonal_adj:
        items = [it for it in items if it.get("seasonal_adjustment_short", "").upper().startswith(seasonal_adj.upper()[0])]
    return items

def choose_best_candidate(items: List[dict]) -> Optional[dict]:
    if not items:
        return None
    # prefer US, SA, higher popularity, more recent last_updated
    def score(it):
        sa = 1 if it.get("seasonal_adjustment_short","").upper().startswith("S") else 0
        pop = int(it.get("popularity", 0))
        upd = it.get("last_updated", "1970-01-01")
        freq_weight = {"Daily":1, "Weekly":2, "Biweekly":2, "Monthly":3, "Quarterly":4, "Annual":5}.get(it.get("frequency",""), 10)
        return (sa, pop, -freq_weight, upd)
    return sorted(items, key=score, reverse=True)[0]

def compute_transform(kind: str, df: pd.DataFrame, base_id: str=None) -> pd.DataFrame:
    out = df.copy()
    out = out.sort_values("date")
    if kind == "yoy_pct":
        out["value"] = (out["value"].pct_change(12))*100.0
    elif kind == "mom_pct":
        out["value"] = (out["value"].pct_change(1))*100.0
    elif kind == "gdp_qoq_annualized":
        # QoQ annualized: ((q/q-1)^4 - 1) * 100
        growth = (out["value"] / out["value"].shift(1))**4 - 1.0
        out["value"] = growth*100.0
    return out

def align_weekly_to_month_end(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    tmp = df.copy()
    tmp["month"] = tmp["date"].dt.to_period("M").dt.to_timestamp("M")
    # choose the last observation within each month
    idx = tmp.groupby("month")["date"].idxmax()
    out = tmp.loc[idx, ["month","value"]].rename(columns={"month":"date"}).sort_values("date")
    return out

def ensure_required_columns(df: pd.DataFrame) -> pd.DataFrame:
    for c in REQUIRED_COLS:
        if c not in df.columns:
            df[c] = pd.NA
    return df[REQUIRED_COLS].copy()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api_key", required=True, help="FRED API key")
    parser.add_argument("--in1", default="economic_indicators_history.csv")
    parser.add_argument("--in2", default="economic_indicators_history_more_indicators.csv")
    parser.add_argument("--out_full", default="economic_indicators_merged_full_backfilled.csv")
    parser.add_argument("--seasonality", default="SA", choices=["SA","NSA"])
    parser.add_argument("--weekly_align", default="month-end", choices=["month-end"])
    parser.add_argument("--add_notes", action="store_true")
    args = parser.parse_args()

    start_date = (pd.Timestamp.today() - pd.DateOffset(years=10, months=1)).strftime("%Y-%m-01")

    metrics = [
        "10-Year Treasury Yield",
        "30-Year Fixed Rate Mortgage Average",
        "30-Year Mortgage Rate",
        "All Employees: Manufacturing",
        "Average Hourly Earnings",
        "Average Hourly Earnings of All Employees",
        "Average Weekly Hours",
        "Average Weekly Hours of Production Employees: Manufacturing",
        "Building Permits",
        "Capacity Utilization (Mfg)",
        "Case-Shiller Home Price Index",
        "Chicago Fed National Activity Index",
        "Commercial & Industrial Loans",
        "Consumer Confidence Index",
        "Consumer Durable Goods New Orders",
        "Continuing Claims",
        "Continuing Jobless Claims",
        "Core CPI",
        "Core CPI Year-over-Year",
        "Core PCE Price Index",
        "Core Personal Consumption Expenditures",
        "Core PPI",
        "CPI All Items",
        "CPI Energy",
        "CPI Year-over-Year",
        "Durable Goods Orders",
        "Durable Goods Orders MoM",
        "E-commerce Retail Sales",
        "Employment Population Ratio",
        "Employment to Population Ratio",
        "Existing Home Sales",
        "Federal Funds Rate",
        "Gasoline Prices",
        "GDP Growth Rate",
        "Housing Starts",
        "Industrial Production",
        "Industrial Production Index",
        "Industrial Production YoY",
        "Initial Jobless Claims",
        "Inventories to Sales Ratio",
        "Job Openings and Labor Turnover Survey: Quits",
        "JOLTS Hires",
        "JOLTS Job Openings",
        "JOLTS Quits",
        "Labor Force Participation Rate",
        "Leading Economic Index",
        "Manufacturers New Orders: Durable Goods",
        "Manufacturing Employment",
        "Manufacturing Hours",
        "Manufacturing PMI",
        "Michigan Consumer Sentiment",
        "Months Supply of Homes",
        "New Home Sales",
        "Nonfarm Payrolls",
        "PCE Price Index",
        "PCE Price Index YoY",
        "Personal Consumption Expenditures",
        "Personal Savings Rate",
        "PPI All Commodities",
        "PPI Final Demand",
        "Producer Price Index: Final Demand",
        "Real Disposable Personal Income",
        "Real Gross Domestic Product",
        "Retail Sales",
        "Retail Sales Ex-Auto",
        "Retail Sales MoM",
        "Retail Sales: Food Services",
        "S&P Global Manufacturing PMI",
        "Total Business: Inventories to Sales Ratio",
        "Total Construction Spending",
        "Total Consumer Credit Outstanding",
        "Total Nonfarm Payrolls",
        "U-6 Unemployment Rate",
        "Unemployment Rate",
        "US / Euro Foreign Exchange Rate",
        "US Dollar Index",
        "US Regular All Formulations Gas Price",
        "Yield Curve (10yr-2yr)",
    ]

    # Load existing files (if present)
    dfs = []
    for p in [args.in1, args.in2]:
        if os.path.exists(p):
            dfs.append(pd.read_csv(p))
    existing = pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame(columns=REQUIRED_COLS)
    existing = ensure_required_columns(existing)

    rows = []
    notes_rows = []

    for metric in metrics:
        spec = SPECIAL_COMPUTATIONS.get(metric)
        if spec and spec["type"] == "spread":
            # fetch two series and compute
            a_id = spec["id_a"]
            b_id = spec["id_b"]
            a = fred_fetch_series(args.api_key, a_id, start_date)
            b = fred_fetch_series(args.api_key, b_id, start_date)
            if a.empty or b.empty:
                continue
            df = pd.merge_asof(a.sort_values("date"), b.sort_values("date"), on="date", direction="nearest", tolerance=pd.Timedelta("2D"), suffixes=("_a","_b"))
            df["value"] = df["value_a"] - df["value_b"]
            df = df[["date","value"]]
            # align daily to month-end
            df["date"] = df["date"].dt.to_period("M").dt.to_timestamp("M")
            df = df.groupby("date", as_index=False).last()
            unit = spec.get("unit", "percent")
            frequency = "Monthly"
            for _, r in df.iterrows():
                rows.append({
                    "metric_name": metric,
                    "series_id": f"{a_id}-{b_id}",
                    "type": DEFAULT_TYPE_MAP.get(metric, ""),
                    "category": DEFAULT_CATEGORY_MAP.get(metric, ""),
                    "unit": unit,
                    "frequency": frequency,
                    "value": float(r["value"]) if pd.notna(r["value"]) else pd.NA,
                    "period_date": r["date"].date(),
                })
            if args.add_notes:
                notes_rows.append((metric, f"{a_id}-{b_id}", "value = DGS10 - DGS2; daily data aggregated to month-end"))
            continue

        override_id = OVERRIDES.get(metric)
        fred_id = override_id

        # Try to resolve via search when no override
        if fred_id is None:
            items = fred_search_series(args.api_key, metric, seasonal_adj=("Seasonally Adjusted" if args.seasonality=="SA" else None))
            best = choose_best_candidate(items)
            fred_id = best.get("id") if best else None

        if fred_id is None and spec is None:
            # couldn't resolve
            continue

        # fetch underlying
        if spec and spec["type"] in ("yoy_pct","mom_pct","gdp_qoq_annualized"):
            base_id = spec["base_id"]
            base_df = fred_fetch_series(args.api_key, base_id, start_date)
            if base_df.empty:
                continue
            trans = compute_transform(spec["type"], base_df)
            # set frequency and unit from spec
            unit = spec.get("unit","percent")
            frequency = spec.get("frequency","Monthly")
            df_use = trans
            # For weekly base used in transforms: not relevant for these
            for _, r in df_use.iterrows():
                rows.append({
                    "metric_name": metric,
                    "series_id": base_id,
                    "type": DEFAULT_TYPE_MAP.get(metric, ""),
                    "category": DEFAULT_CATEGORY_MAP.get(metric, ""),
                    "unit": unit,
                    "frequency": frequency,
                    "value": float(r["value"]) if pd.notna(r["value"]) else pd.NA,
                    "period_date": r["date"].date(),
                })
            if args.add_notes:
                notes_rows.append((metric, base_id, f"Computed {spec['type']} from {base_id}"))
            continue

        # Otherwise: fetch series directly
        ser_df = fred_fetch_series(args.api_key, fred_id, start_date)
        if ser_df.empty:
            continue

        # Series info for unit/frequency
        info = fred_series_info(args.api_key, fred_id)
        frequency = info.get("frequency", "Monthly")
        unit = info.get("units_short") or info.get("units") or ""

        # Weekly alignment
        if frequency == "Weekly" and args.weekly_align == "month-end":
            ser_df = align_weekly_to_month_end(ser_df)
            frequency = "Monthly"

        # Daily -> month-end (e.g. DGS10)
        if frequency == "Daily":
            ser_df["date"] = ser_df["date"].dt.to_period("M").dt.to_timestamp("M")
            ser_df = ser_df.groupby("date", as_index=False).last()
            frequency = "Monthly"

        for _, r in ser_df.iterrows():
            rows.append({
                "metric_name": metric,
                "series_id": fred_id,
                "type": DEFAULT_TYPE_MAP.get(metric, ""),
                "category": DEFAULT_CATEGORY_MAP.get(metric, ""),
                "unit": unit,
                "frequency": frequency,
                "value": float(r["value"]) if pd.notna(r["value"]) else pd.NA,
                "period_date": r["date"].date(),
            })
        if args.add_notes:
            notes_rows.append((metric, fred_id, f"Direct FRED series: {fred_id} ({frequency}, {unit})"))

    fetched = pd.DataFrame(rows)
    if fetched.empty:
        print("No data fetched. Check your API key or internet connection.")
        sys.exit(1)

    # Constrain to exact last 10 years (>= 10y ago month-start)
    min_allowed = (pd.Timestamp.today() - pd.DateOffset(years=10)).to_period("M").to_timestamp("M")
    fetched["period_date"] = pd.to_datetime(fetched["period_date"])
    fetched = fetched[fetched["period_date"] >= min_allowed].copy()

    # Ensure types/categories
    def fill_type(m):
        return DEFAULT_TYPE_MAP.get(m, "")
    def fill_cat(m):
        return DEFAULT_CATEGORY_MAP.get(m, "")

    fetched["type"] = fetched["metric_name"].map(fill_type)
    fetched["category"] = fetched["metric_name"].map(fill_cat)

    # Merge with existing without dropping rows
    existing["period_date"] = pd.to_datetime(existing["period_date"], errors="coerce")
    existing["value"] = pd.to_numeric(existing["value"], errors="coerce")

    # Combine, preferring fetched values when both exist
    combined = pd.concat([existing, fetched], ignore_index=True)
    combined = combined.drop_duplicates(subset=REQUIRED_COLS, keep="last")

    # Fill blanks
    for col in ["unit","frequency","series_id","metric_name","type","category"]:
        combined[col] = combined[col].fillna("").astype(str).str.strip()

    # Order and sort
    combined = combined[REQUIRED_COLS].copy()
    combined = combined.sort_values(["metric_name","series_id","period_date"], na_position="last").reset_index(drop=True)

    # Optional notes export
    if args.add_notes:
        notes_df = pd.DataFrame(notes_rows, columns=["metric_name","series_id","notes"]).drop_duplicates()
        notes_path = os.path.splitext(args.out_full)[0] + "_notes.csv"
        notes_df.to_csv(notes_path, index=False)
        print(f"Notes saved to {notes_path}")

    combined.to_csv(args.out_full, index=False)
    print(f"Saved merged file to {args.out_full}")
    # Coverage report
    cov = (combined.dropna(subset=["metric_name","series_id","period_date"])
                 .assign(year=lambda d: pd.to_datetime(d["period_date"]).dt.year)
                 .groupby(["metric_name","series_id"])
                 .agg(min_date=("period_date","min"), max_date=("period_date","max"), n_obs=("period_date","count"),
                      n_years=("year", "nunique"))
                 .reset_index()
           )
    cov = cov.sort_values(["metric_name","series_id"])
    cov_path = os.path.splitext(args.out_full)[0] + "_coverage.csv"
    cov.to_csv(cov_path, index=False)
    print(f"Coverage report saved to {cov_path}")

if __name__ == "__main__":
    main()
