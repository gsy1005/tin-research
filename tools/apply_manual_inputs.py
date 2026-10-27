# -*- coding: utf-8 -*-
"""应用 GitHub 日报手动输入中的云锡升水、SOX、印尼成交，并刷新基本面分析。

下游/同业成交仍由 auto_daily.py 写入；本脚本不会改动这两项。
环境变量：IN_DATE（可空）、IN_YX（云锡升水）、IN_SOX（SOX 收盘）、IN_IDN（印尼当日成交）。
"""
import json
import os
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "db_data.js"
NOTE_PATH = ROOT / "summary_note.js"


def load_js_json(path, prefix):
    text = path.read_text(encoding="utf-8")
    start = text.index(prefix) + len(prefix)
    return text[:start], json.loads(text[start:text.rindex("]") + 1])


def write_db(header, rows):
    DB_PATH.write_text(header + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")


def upsert(series, day, value):
    series[:] = [p for p in series if p[0] != day]
    series.append([day, float(value)])
    series.sort(key=lambda p: p[0])


def fmt(value):
    return f"{value:,.0f}"


def pct(value):
    return f"{value * 100:+.1f}%"


def main():
    header, db = load_js_json(DB_PATH, "window.DB_DATA=window.DB_DATA=")
    by_key = {x["k"]: x for x in db}
    day = os.environ.get("IN_DATE", "").strip()
    if not day:
        day = by_key["d0"]["s"][-1][0]
    date.fromisoformat(day)

    yx = os.environ.get("IN_YX", "").strip()
    if yx:
        upsert(by_key["d65"]["s"], day, float(yx))

    sox = os.environ.get("IN_SOX", "").strip()
    if sox:
        upsert(by_key["d557"]["s"], day, float(sox))

    idn = os.environ.get("IN_IDN", "").strip()
    if idn:
        upsert(by_key["d480"]["s"], day, float(idn))
        month = day[:7]
        cumulative = sum(p[1] for p in by_key["d480"]["s"] if p[0].startswith(month))
        upsert(by_key["d481"]["s"], day, cumulative)

    # 无论当天是否有印尼成交，都用最新已确认数据刷新同比、环比和解读。
    daily = by_key["d480"]["s"]
    cumulative_series = by_key["d481"]["s"]
    latest_day = cumulative_series[-1][0]
    latest_cum = cumulative_series[-1][1]
    latest_daily = next((p[1] for p in reversed(daily) if p[0] == latest_day), 0.0)
    month = latest_day[:7]
    previous = [p for p in cumulative_series if p[0] < month + "-01"]
    previous_cum = previous[-1][1] if previous else None
    y, m, d = map(int, latest_day.split("-"))
    ly_day = f"{y-1:04d}-{m:02d}-{d:02d}"
    ly = [p for p in cumulative_series if p[0] <= ly_day and p[0].startswith(f"{y-1:04d}-{m:02d}")]
    ly_cum = ly[-1][1] if ly else None

    parts = [f"【印尼交易所】截至{int(m)}/{d}月累计成交{fmt(latest_cum)}吨"]
    if previous_cum:
        parts.append(f"较上月全月{pct(latest_cum / previous_cum - 1)}（月内与全月口径不同）")
    if ly_cum:
        parts.append(f"较去年同期同日{pct(latest_cum / ly_cum - 1)}")
    parts.append(f"当日成交{fmt(latest_daily)}吨")
    analysis = "，".join(parts) + "。"
    if latest_daily == 0:
        analysis += "当日无成交不代表供应中断，只反映交易所成交节奏放缓。"
    if ly_cum and previous_cum and latest_cum >= ly_cum and latest_cum < previous_cum:
        analysis += "同比仍有增长、较上月放量放缓，对进口供应的边际支持暂有限，后续看月末成交与出口到港兑现。"
    else:
        analysis += "后续结合月末成交、印尼出口及国内到港验证供应边际。"

    if yx or sox or idn:
        write_db(header, db)

    note_text = NOTE_PATH.read_text(encoding="utf-8")
    note = json.loads(note_text[note_text.index("{"):note_text.rindex("}") + 1])
    note["B"] = re.sub(r"\s*【印尼交易所】.*$", "", note.get("B", "")).rstrip() + " " + analysis
    NOTE_PATH.write_text("window.TIN_SUMMARY_NOTE = " + json.dumps(note, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(analysis)


if __name__ == "__main__":
    main()
