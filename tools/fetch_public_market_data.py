# -*- coding: utf-8 -*-
"""抓取可公开获取的行情并按日期更新 DB_DATA。

本地优先使用已安装的 Yahoo Finance 插件；其他环境使用 Yahoo Chart API。
FRED 使用官方 CSV。下载失败不会清空或覆盖已有序列。
"""
from __future__ import annotations

import csv
import io
import json
import math
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "db_data.js"
CACHE = ROOT / "_cache" / "public_market"
YAHOO_TOOL = Path(os.environ.get(
    "YAHOO_FINANCE_TOOL",
    "D:/KimiData/daimon-share/daimon/runtime/kimi-code/home/plugins/managed/yahoo_finance/scripts/yahoo_finance_tool.py",
))
YAHOO = [
    ("d734", "DX-Y.NYB", "dxy"),
    ("d908", "^MOVE", "move"),
    ("d557", "^SOX", "sox"),
    ("d_public_nq", "NQ=F", "nasdaq_futures"),
]
FRED = [
    ("d730", "DGS10", "us10y"),
    ("d731", "DGS2", "us2y"),
    ("d732", "DCOILBRENTEU", "brent"),
    ("d733", "DCOILWTICO", "wti"),
]
NQ_META = {
    "g": "宏观·海外", "sg": "美股期货", "k": "d_public_nq",
    "n": "纳斯达克100指数期货（日）", "u": "点", "s": [],
}


def load_db():
    text = DB_PATH.read_text(encoding="utf-8")
    start = text.index("[")
    return text[:start], json.loads(text[start:text.rindex("]") + 1])


def valid_point(day, value):
    datetime.strptime(day, "%Y-%m-%d")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("无效行情数值")
    return [day, number]


def completed_daily_points(points):
    """Yahoo 当日 Bar 在美股盘中是最新价，不作为已收盘日度值。"""
    from zoneinfo import ZoneInfo
    now_ny = datetime.now(ZoneInfo("America/New_York"))
    if points and points[-1][0] == now_ny.date().isoformat() and now_ny.hour < 17:
        points = points[:-1]
    if not points:
        raise RuntimeError("Yahoo 没有已完成的日度收盘价")
    return points


def read_yahoo_csv(path):
    points = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("Date") and row.get("Close") not in (None, "", "NA"):
                points.append(valid_point(row["Date"][:10], row["Close"]))
    return completed_daily_points(points)


def yahoo_via_plugin(ticker, slug):
    CACHE.mkdir(parents=True, exist_ok=True)
    output = CACHE / f"yahoo_{slug}.csv"
    params = {"ticker": ticker, "period": "1mo", "interval": "1d",
              "file_path": output.as_posix()}
    run = subprocess.run(
        [sys.executable, str(YAHOO_TOOL), "call", "--api-name",
         "get_historical_stock_prices", "--params-json", json.dumps(params)],
        cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=100,
    )
    if run.returncode:
        raise RuntimeError((run.stderr or run.stdout or "Yahoo 插件执行失败").strip()[-500:])
    return read_yahoo_csv(output)


def yahoo_via_http(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    response = requests.get(url, params={"range": "1mo", "interval": "1d"}, timeout=35)
    response.raise_for_status()
    result = response.json().get("chart", {}).get("result") or []
    if not result:
        raise RuntimeError("Yahoo 接口未返回行情")
    timestamps = result[0].get("timestamp") or []
    closes = result[0].get("indicators", {}).get("quote", [{}])[0].get("close") or []
    points = [valid_point(datetime.fromtimestamp(ts, timezone.utc).date().isoformat(), close)
              for ts, close in zip(timestamps, closes) if close is not None]
    return completed_daily_points(points)


def fetch_yahoo(ticker, slug):
    if YAHOO_TOOL.is_file():
        return yahoo_via_plugin(ticker, slug), "Yahoo Finance 插件"
    return yahoo_via_http(ticker), "Yahoo Finance Chart API"


def fetch_fred(series_id):
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    response = requests.get(url, timeout=35)
    response.raise_for_status()
    points = []
    for row in csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))):
        lowered = {str(k).lower(): v for k, v in row.items() if k}
        day = lowered.get("date") or lowered.get("observation_date")
        value = lowered.get(series_id.lower())
        if day and value not in (None, "", ".", "NA"):
            points.append(valid_point(day, value))
    if not points:
        raise RuntimeError(f"FRED {series_id} 没有有效数值")
    return points, "FRED 官方 CSV"


def upsert_newer(series, points):
    """不覆盖比入库日期更晚的手工值；同日及更新日期按公开收盘值更新。"""
    existing = {p[0]: p[1] for p in series}
    latest = max(existing) if existing else ""
    changed = 0
    skipped = 0
    for day, value in points:
        if latest and day < latest:
            skipped += 1
            continue
        if existing.get(day) != value:
            changed += 1
        existing[day] = value
    series[:] = [[day, existing[day]] for day in sorted(existing)]
    return changed, skipped


def assert_history_preserved(original_dates, db):
    """写入前确保所有原有序列及历史日期仍然存在，否则整次拒绝写入。"""
    current = {item["k"]: {p[0] for p in item.get("s", [])} for item in db}
    missing_series = sorted(set(original_dates) - set(current))
    missing_dates = {key: sorted(dates - current.get(key, set()))[:20]
                     for key, dates in original_dates.items()
                     if dates - current.get(key, set())}
    if missing_series or missing_dates:
        raise RuntimeError("历史数据防缺失校验失败：" + json.dumps(
            {"missingSeries": missing_series, "missingDates": missing_dates}, ensure_ascii=False))
    return {"ok": True, "series": len(original_dates),
            "pointsBefore": sum(map(len, original_dates.values())),
            "pointsAfter": sum(map(len, current.values()))}


def main():
    header, db = load_db()
    original_dates = {item["k"]: {p[0] for p in item.get("s", [])} for item in db}
    by_key = {item["k"]: item for item in db}
    results, failures = [], []
    jobs = [(key, slug, lambda ticker=ticker, slug=slug: fetch_yahoo(ticker, slug))
            for key, ticker, slug in YAHOO]
    jobs += [(key, slug, lambda series_id=series_id: fetch_fred(series_id))
             for key, series_id, slug in FRED]
    for key, slug, fetch in jobs:
        try:
            points, source = fetch()
            if key not in by_key:
                if key != "d_public_nq":
                    raise RuntimeError(f"数据库缺少序列 {key}")
                db.append(dict(NQ_META))
                by_key[key] = db[-1]
            series = by_key[key].setdefault("s", [])
            changed, skipped = upsert_newer(series, points)
            results.append({"key": key, "indicator": slug, "source": source,
                            "latest": series[-1], "changed": changed,
                            "skippedOlder": skipped, "ok": True})
        except Exception as exc:
            failures.append({"key": key, "indicator": slug, "ok": False,
                             "error": f"{type(exc).__name__}: {exc}"})
    history_guard = assert_history_preserved(original_dates, db)
    if results:
        temp = DB_PATH.with_suffix(".js.tmp")
        temp.write_text(header + json.dumps(db, ensure_ascii=False, separators=(",", ":")) + ";\n",
                        encoding="utf-8")
        temp.replace(DB_PATH)
    report = {"ok": not failures, "updated": results, "failed": failures,
              "historyGuard": history_guard,
              "generatedAt": datetime.now(timezone.utc).isoformat()}
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "last_run.json").write_text(json.dumps(report, ensure_ascii=False, indent=2),
                                          encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
