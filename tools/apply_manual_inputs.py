# -*- coding: utf-8 -*-
"""日报每日填报：更新数值、结构化红字总结及当天供需/策略配置。

GitHub Actions 使用 IN_NOTES 多行文本；本地填报工具可使用同名字段环境变量。
空值不覆盖已有序列；补充信息只在日期与日报日期一致时生效。
"""
import json
import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "db_data.js"
NOTE_PATH = ROOT / "summary_note.js"
OVERRIDES_PATH = ROOT / "daily_overrides.js"

LABELS = {
    "今日变化": "macroToday", "宏观今日": "macroToday", "宏观今日变化": "macroToday",
    "后续关注": "macroWatch", "宏观关注": "macroWatch", "宏观后续关注": "macroWatch",
    "AI": "ai", "AI变化": "ai", "供需": "fundamentals", "供需变化": "fundamentals",
    "矿端": "mine", "上游点价": "mine", "LME": "lme", "LME仓单": "lme",
    "现货": "spot", "现货情况": "spot", "其他变化": "other", "其他": "other",
    "月差": "spread", "需求": "demand", "持仓": "position", "风险": "risk",
    "情绪": "sentiment", "策略": "strategy", "日度策略": "strategy",
}
SIGNAL_LABELS = {"宏观信号": "macro", "AI信号": "ai", "库存信号": "inventory", "升贴水信号": "spot"}
DIRECT_ENV = {
    "macroToday": "IN_MACRO_TODAY", "macroWatch": "IN_MACRO_WATCH", "ai": "IN_AI",
    "fundamentals": "IN_FUNDAMENTALS", "mine": "IN_MINE", "lme": "IN_LME_NOTE",
    "spot": "IN_SPOT_NOTE", "other": "IN_OTHER", "spread": "IN_SPREAD",
    "demand": "IN_DEMAND", "position": "IN_POSITION", "risk": "IN_RISK",
    "sentiment": "IN_SENTIMENT", "strategy": "IN_STRATEGY",
}


def load_js_json(path, prefix):
    text = path.read_text(encoding="utf-8")
    start = text.index(prefix) + len(prefix)
    return text[:start], json.loads(text[start:text.rindex("]") + 1])


def load_note():
    text = NOTE_PATH.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def load_overrides():
    if not OVERRIDES_PATH.exists():
        return {}
    text = OVERRIDES_PATH.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def write_db(header, rows):
    DB_PATH.write_text(header + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")


def write_overrides(payload):
    OVERRIDES_PATH.write_text("window.TIN_DAILY_INPUT = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


def upsert(series, day, value):
    series[:] = [p for p in series if p[0] != day]
    series.append([day, float(value)])
    series.sort(key=lambda p: p[0])


def fmt(value):
    return f"{value:,.0f}"


def pct(value):
    return f"{value * 100:+.1f}%"


def day_label(day):
    _, m, d = day.split("-")
    return f"{int(m)}/{int(d)}"


def change(cur, pre, unit="吨"):
    if not cur or not pre:
        return "暂无可比值"
    diff = cur[1] - pre[1]
    if diff == 0:
        return f"较{day_label(pre[0])}持平"
    return f"较{day_label(pre[0])}{'增加' if diff > 0 else '减少'} {fmt(abs(diff))} {unit}"


def parse_notes(raw):
    result, signals = {}, {}
    current = None
    for source_line in raw.replace("\r", "").split("\n"):
        line = source_line.strip()
        match = re.match(r"^([^：:]{1,12})[：:]\s*(.*)$", line)
        if match:
            label, value = match.group(1).strip(), match.group(2).strip()
            if label in LABELS:
                current = LABELS[label]
                result[current] = value
                continue
            if label in SIGNAL_LABELS:
                signals[SIGNAL_LABELS[label]] = value
                current = None
                continue
        if current and line:
            result[current] = (result.get(current, "") + "；" + line).strip("；")
    # 未加字段前缀的整段原文也必须保留，不能再静默丢弃。
    if not result and not signals and raw.strip():
        result["fundamentals"] = re.sub(r"\s+", " ", raw.strip())
    if signals:
        result["signals"] = signals
    return result


def collect_input_notes():
    parsed = parse_notes(os.environ.get("IN_NOTES", ""))
    for key, env_name in DIRECT_ENV.items():
        value = os.environ.get(env_name, "").strip()
        if value:
            parsed[key] = value
    signals = parsed.setdefault("signals", {}) if parsed else {}
    for label, key in SIGNAL_LABELS.items():
        value = os.environ.get("IN_SIGNAL_" + key.upper(), "").strip()
        if value:
            signals[key] = value
    if parsed and not parsed.get("signals"):
        parsed.pop("signals", None)
    return parsed


def signal_score(signal):
    return {"强多": 2, "利多": 1, "结构多": 1, "中性略偏多": 0.5,
            "强空": -2, "偏空": -1, "中性略偏空": -0.5}.get(signal, 0)


def score_label(value):
    if value >= 1.25: return "强多"
    if value >= 0.5: return "偏多"
    if value > 0.1: return "中性略偏多"
    if value >= -0.1: return "中性"
    if value > -0.5: return "中性略偏空"
    if value > -1.25: return "偏空"
    return "强空"


def indonesia_analysis(by_key):
    daily = by_key["d480"]["s"]
    cumulative_series = by_key["d481"]["s"]
    latest_day = cumulative_series[-1][0]
    latest_cum = cumulative_series[-1][1]
    latest_daily = next((p[1] for p in reversed(daily) if p[0] == latest_day), 0.0)
    previous_daily = next((p for p in reversed(daily) if p[0] < latest_day), None)
    month = latest_day[:7]
    previous = [p for p in cumulative_series if p[0] < month + "-01"]
    previous_cum = previous[-1][1] if previous else None
    y, m, d = map(int, latest_day.split("-"))
    ly_day = f"{y-1:04d}-{m:02d}-{d:02d}"
    ly = [p for p in cumulative_series if p[0] <= ly_day and p[0].startswith(f"{y-1:04d}-{m:02d}")]
    ly_cum = ly[-1][1] if ly else None
    parts = [f"【印尼交易所】{day_label(latest_day)} 成交 {fmt(latest_daily)} 吨"]
    if previous_daily:
        diff = latest_daily - previous_daily[1]
        parts.append(f"较 {day_label(previous_daily[0])} 的 {fmt(previous_daily[1])} 吨{'增加' if diff >= 0 else '减少'} {fmt(abs(diff))} 吨")
    parts.append(f"{int(m)} 月累计 {fmt(latest_cum)} 吨")
    if previous_cum:
        parts.append(f"较 {int(previous_cum and previous[-1][0][5:7])} 月全月的 {fmt(previous_cum)} 吨{pct(latest_cum / previous_cum - 1)}")
    if ly_cum:
        parts.append(f"较去年同期同日{pct(latest_cum / ly_cum - 1)}")
    analysis = "，".join(parts) + "。"
    if latest_daily == 0:
        analysis += "当日无成交不代表供应中断，只反映交易所成交节奏。"
    else:
        analysis += "后续关注出口到港兑现。"
    return analysis


def main():
    header, db = load_js_json(DB_PATH, "window.DB_DATA=window.DB_DATA=")
    by_key = {x["k"]: x for x in db}
    # 工作流写明“默认今天”，不能再用可能滞后的 SMM 价格日期作为日报日期。
    day = os.environ.get("IN_DATE", "").strip() or datetime.now(timezone(timedelta(hours=8))).date().isoformat()
    date.fromisoformat(day)

    numeric = {}
    for env_name, key in [("IN_TRX", "d72"), ("IN_TRT", "d71"), ("IN_SHFE", "d339"),
                          ("IN_YX", "d65"), ("IN_SOX", "d557"), ("IN_IDN", "d480")]:
        value = os.environ.get(env_name, "").strip()
        if value:
            value_day = os.environ.get(env_name + "_DATE", "").strip() or day
            date.fromisoformat(value_day)
            numeric[env_name] = {"value": value, "date": value_day}
            upsert(by_key[key]["s"], value_day, float(value))
    if "IN_IDN" in numeric:
        month = numeric["IN_IDN"]["date"][:7]
        daily = by_key["d480"]["s"]
        for point in [p for p in daily if p[0].startswith(month)]:
            cumulative = sum(p[1] for p in daily if p[0].startswith(month) and p[0] <= point[0])
            upsert(by_key["d481"]["s"], point[0], cumulative)
    if numeric:
        write_db(header, db)

    new_notes = collect_input_notes()
    existing = load_overrides()
    if new_notes:
        payload = {"date": day}
        payload.update({k: v for k, v in existing.items() if k not in {"date", "signals"}})
        payload.update({k: v for k, v in new_notes.items() if k != "signals"})
        payload["signals"] = {"macro": "利多", "ai": "利多", "spot": "双向"}
        payload["signals"].update(existing.get("signals", {}))
        payload["signals"].update(new_notes.get("signals", {}))
        if "inventory" not in payload["signals"] and "IN_SHFE" in numeric:
            cur, pre = by_key["d339"]["s"][-1], by_key["d339"]["s"][-2]
            payload["signals"]["inventory"] = "偏空" if cur[1] > pre[1] else ("利多" if cur[1] < pre[1] else "中性")
        write_overrides(payload)
        notes = payload
    else:
        notes = existing if existing.get("date") == day else {}

    note = load_note()
    if notes.get("macroToday") or notes.get("macroWatch"):
        note["A"] = "【今日变化】" + notes.get("macroToday", "无补充") + "\n【后续关注】" + notes.get("macroWatch", "无补充")
    if notes.get("sentiment"):
        note["C"] = notes["sentiment"]

    if numeric or new_notes:
        down, trade = by_key["d72"]["s"], by_key["d71"]["s"]
        wh, prem = by_key["d339"]["s"], by_key["d65"]["s"]
        price = by_key["d0"]["s"]
        sections = [indonesia_analysis(by_key)]
        spot_parts = []
        if down and trade:
            total, old_total = down[-1][1] + trade[-1][1], down[-2][1] + trade[-2][1]
            spot_parts.append(f"日度成交量：{day_label(down[-1][0])} 下游 {fmt(down[-1][1])} 吨、同业 {fmt(trade[-1][1])} 吨，总成交 {fmt(total)} 吨，较前日{'增加' if total >= old_total else '减少'} {fmt(abs(total-old_total))} 吨")
            if down[-2][1]:
                spot_parts.append(f"下游日环比 {pct(down[-1][1]/down[-2][1]-1)}")
        if prem:
            spot_parts.append("升贴水：云锡品牌 " + ("+" if prem[-1][1] >= 0 else "") + fmt(prem[-1][1]) + f" 元/吨（{day_label(prem[-1][0])}），{change(prem[-1], prem[-2], '元/吨')}")
        if notes.get("spot"):
            spot_parts.append(notes["spot"])
        if price:
            spot_parts.append(f"SMM 1#锡最新 {fmt(price[-1][1])} 元/吨（{day_label(price[-1][0])}）")
        if spot_parts:
            sections.append("【现货】" + "；".join(spot_parts) + "。")
        if notes.get("mine"):
            sections.append("【上游点价】" + notes["mine"] + "。")
        inventory = []
        if wh:
            inventory.append(f"SHFE 仓单 {fmt(wh[-1][1])} 吨（{day_label(wh[-1][0])}），{change(wh[-1], wh[-2])}")
        lme = by_key["d334"]["s"]
        inventory.append("LME " + (notes.get("lme") or (f"最新库存 {fmt(lme[-1][1])} 吨（{day_label(lme[-1][0])}）" if lme else "暂无读数")))
        social = by_key.get("d739", {}).get("s", [])
        if social:
            inventory.append(f"Mysteel 周度社库 {fmt(social[-1][1])} 吨（{day_label(social[-1][0])}），{change(social[-1], social[-2])}")
        sections.append("【库存】" + "；".join(inventory) + "。")
        other = "；".join(x for x in [notes.get("fundamentals", ""), notes.get("other", "")] if x)
        if other:
            sections.append("【其他变化】" + other + "。")
        note["B"] = "\n".join(sections)

        # 红字“策略”只复制当天日度策略；评分保留在供需策略页。
        note["D"] = notes.get("strategy", "日度策略按供需策略页最新内容执行")
        note["date"] = day
        NOTE_PATH.write_text("window.TIN_SUMMARY_NOTE = " + json.dumps(note, ensure_ascii=False) + ";\n", encoding="utf-8")

    print(json.dumps({"ok": True, "date": day, "numeric": sorted(numeric), "notes": bool(new_notes),
                      "summary": note}, ensure_ascii=False))


if __name__ == "__main__":
    main()
