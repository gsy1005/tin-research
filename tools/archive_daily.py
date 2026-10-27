# -*- coding: utf-8 -*-
"""冻结数据日报、供需日度变化和策略；每次日度更新后生成独立留档。"""
from __future__ import annotations

import html
import json
import os
import re
from datetime import date as date_type
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "daily_archive"
KEYS = ("d0", "d71", "d72", "d65", "d339", "d340", "d62", "d63", "d480")
KEY_MAP = {
    "价格": "price", "宏观": "macro", "美股·半导体 AI": "ai",
    "供给·矿端": "mine", "供给·冶炼端": "smelt", "需求·焊料": "demand",
    "现货·贸易": "spot", "月差结构": "spread", "库存": "inventory", "风险点": "risk",
}


def read_js_json(path: Path, marker: str):
    text = path.read_text(encoding="utf-8")
    start = text.find(marker)
    if start < 0:
        raise RuntimeError(f"{path.name} 未找到 {marker}")
    value, _ = json.JSONDecoder().raw_decode(text[start + len(marker):].lstrip())
    return value


def plain(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", fragment))).strip()


def weekly_snapshot() -> dict:
    text = (ROOT / "weekly_full.html").read_text(encoding="utf-8")
    match = re.search(r'<div id="sumsec">.*?<table class="sum">(.*?)</table>', text, re.S)
    if not match:
        raise RuntimeError("weekly_full.html 未找到周度供需表")
    rows, final = [], ""
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", match.group(1), re.S):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        values = [plain(cell) for cell in cells]
        if len(values) >= 4:
            rows.append({
                "key": KEY_MAP.get(values[0], f"row{len(rows)}"), "cat": values[0],
                "related": values[1], "conclusion": values[2], "signal": values[3],
            })
        elif len(values) >= 2 and "总结论" in values[0]:
            final = values[1]
    if len(rows) != 10 or not final:
        raise RuntimeError(f"周度供需表解析异常：{len(rows)} 行，总结论={'有' if final else '无'}")
    return {"rows": rows, "final": final}


def fmt(value) -> str:
    if value is None:
        return "—"
    if abs(value - round(value)) < 1e-8:
        return f"{value:,.0f}"
    return f"{value:,.1f}"


def data_table(db: list, archive_date: str) -> str:
    selected = [item for item in db if item.get("k") in KEYS]
    dates = sorted({p[0] for item in selected for p in item.get("s", [])
                    if p[0] <= archive_date and isinstance(p[1], (int, float))})[-7:]
    lookup = {item["k"]: {p[0]: p[1] for p in item.get("s", []) if p[0] <= archive_date}
              for item in selected}

    def value(key: str, day: str):
        return lookup.get(key, {}).get(day)

    specs = [
        ("SMM 1#锡（元/吨）", lambda d: value("d0", d)),
        ("下游成交（吨）", lambda d: value("d72", d)),
        ("同业成交（吨）", lambda d: value("d71", d)),
        ("总成交（吨）", lambda d: (value("d72", d) + value("d71", d))
         if value("d72", d) is not None and value("d71", d) is not None else None),
        ("云锡升贴水（元/吨）", lambda d: value("d65", d)),
        ("SHFE 仓单（吨）", lambda d: value("d339", d)),
        ("SHFE 仓单增减（吨）", lambda d: value("d340", d)),
        ("印尼交易所成交（吨）", lambda d: value("d480", d)),
        ("连一－连二（元/吨）", lambda d: (value("d63", d) - value("d62", d))
         if value("d63", d) is not None and value("d62", d) is not None else None),
    ]
    head = "".join(f"<th>{day[5:]}</th>" for day in dates)
    body = []
    for label, getter in specs:
        cells = "".join(f"<td>{html.escape(fmt(getter(day)))}</td>" for day in dates)
        body.append(f'<tr><th>{html.escape(label)}</th>{cells}</tr>')
    return f'<table class="daily-data"><thead><tr><th>指标</th>{head}</tr></thead><tbody>{"".join(body)}</tbody></table>'


ARCHIVE_CSS = r"""
:root{--red:#C00000;--blue:#1F4E79;--ink:#1a1a1a;--muted:#6c737d;--line:#d9d9d9;--lead:#EEF3FA}
*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:var(--ink);font-family:"KaiTi","STKaiti","Noto Serif CJK SC",serif}.archive-top{max-width:1460px;margin:auto;padding:12px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}.archive-top a{color:var(--blue);font-size:14px;text-decoration:none}.archive-top .badge{margin-left:auto;color:var(--red);border:1px solid var(--red);border-radius:4px;padding:3px 10px;font-size:12px}.archive-wrap{max-width:1460px;margin:0 auto 36px;background:#fff;padding:0 0 18px}.archive-head{padding:20px 16px 14px;border-bottom:2px solid var(--red)}.archive-head h1{margin:0;font-size:30px;letter-spacing:3px;border-left:6px solid var(--red);padding-left:14px}.archive-head p{margin:7px 0 0 20px;color:var(--muted);font-size:13px}.archive-summary{margin:12px 6px 0;padding:12px 16px;background:var(--red);color:#fff}.archive-summary h2{font-size:16px;letter-spacing:3px;margin:0 0 8px}.summary-grid{display:grid;grid-template-columns:1fr;gap:8px}.summary-item{display:flex;gap:10px;line-height:1.7;font-size:14px}.summary-item b{flex:0 0 auto;align-self:flex-start;background:#8A0000;padding:1px 9px;border-radius:3px;font-size:13px;letter-spacing:1px}.archive-data{margin:14px 6px 0;border:1px solid var(--line)}.archive-data h2{margin:0;padding:8px 12px;background:var(--lead);border-left:5px solid var(--blue);font-size:16px}.archive-data h2 span{font-size:11px;color:var(--muted);font-weight:400;margin-left:8px}.data-scroll{overflow-x:auto}.daily-data{width:100%;min-width:850px;border-collapse:collapse;table-layout:fixed}.daily-data th,.daily-data td{border:1px solid var(--line);padding:6px 8px;font-size:13px;text-align:right;white-space:nowrap}.daily-data thead th{background:var(--blue);color:#fff;text-align:center}.daily-data th:first-child{width:210px;text-align:left}.daily-data tbody th{background:#f7f8fa}.archive-foot{margin:12px 6px 0;color:var(--muted);font-size:12px;line-height:1.7}.archive-foot a{color:var(--blue)}.strategy-block{margin:14px 6px 0}.strategy-card [contenteditable]{min-height:52px}@media(max-width:760px){.archive-top .badge{margin-left:0}.archive-wrap{margin-bottom:0}.archive-head h1{font-size:25px}.strategy-tablewrap{overflow-x:auto}.summary-item{display:block}.summary-item b{display:inline-block;margin-bottom:3px}}
"""


def archive_html(archive_date: str, summary: dict, table: str, has_research: bool) -> str:
    summary_blocks = "".join(
        f'<div class="summary-item"><b>{label}</b><div>{html.escape(str(summary.get(key, "")))}</div></div>'
        for label, key in (("宏观", "A"), ("基本面", "B"), ("情绪", "C"))
    )
    research = (f'<a href="../daily_{archive_date}.html">打开当天完整研究日报 →</a>' if has_research
                else "当天未生成长篇研究日报；本页已保存数据日报与策略快照。")
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>锡数据日报 · {archive_date} 留档</title>
<link rel="stylesheet" href="../daily_strategy.css?v=202610271450"><style>{ARCHIVE_CSS}</style></head>
<body><nav class="archive-top"><a href="../daily_archive.html">← 日报留档索引</a><a href="../sheet.html">返回最新数据日报</a><span class="badge">历史快照 · 只读</span></nav>
<main class="archive-wrap"><header class="archive-head"><h1>锡数据日报 · 留档</h1><p>{archive_date} · 日内总结、供需日度变化、周度策略和日度策略均按当天冻结</p></header>
<section class="archive-summary"><h2>日 内 总 结</h2><div class="summary-grid">{summary_blocks}</div></section>
<section class="strategy-block is-archive" id="dailyStrategyBlock"><div class="strategy-head"><h2>周度供需 × 日度变化</h2><span>历史快照 · 只读</span></div>
<div class="strategy-tablewrap"><table class="weeksum"><colgroup><col style="width:7%"><col style="width:35%"><col style="width:21%"><col style="width:29%"><col style="width:8%"></colgroup><thead><tr><th>环节</th><th>周度相关数据</th><th>日度变化</th><th>周度结论</th><th>多空</th></tr></thead><tbody id="weeksumBody"></tbody></table></div>
<div class="strategy-grid"><div class="strategy-card weekly"><h3>周度策略<span>当周结论 · 只读</span></h3><div id="weeklyStrategyText" contenteditable="false"></div></div><div class="strategy-card daily"><h3 id="dailyStrategyTitle">日度策略<span>当天生成 · 只读</span></h3><div id="dailyStrategyText" contenteditable="false"></div></div></div></section>
<section class="archive-data"><h2>日度数据快照<span>最近 7 个有数据日期 · 与当天日报口径一致</span></h2><div class="data-scroll">{table}</div></section>
<footer class="archive-foot">本页为 {archive_date} 独立快照，后续 Excel、周报或日度数据更新不会改写本页。{research}</footer></main>
<script src="{archive_date}.js"></script><script src="../daily_strategy.js?v=202610271450"></script></body></html>"""


INDEX_CSS = r"""
:root{--red:#C00000;--blue:#1F4E79;--ink:#1a1a1a;--muted:#697386;--line:#dfe3e8;--bg:#f4f5f7}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"KaiTi","STKaiti","Microsoft YaHei",serif}.top{max-width:1180px;margin:auto;padding:18px 20px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}.top a{color:var(--blue);text-decoration:none}.wrap{max-width:1180px;margin:0 auto;padding:10px 20px 46px}h1{font-size:32px;border-left:6px solid var(--red);padding-left:14px;margin:12px 0}.sub{color:var(--muted);margin:0 0 24px 20px}.toolbar{display:flex;gap:16px;align-items:center;padding:12px 0;border-top:2px solid var(--red);border-bottom:1px solid var(--line);margin-bottom:20px}.count{font-weight:700;color:var(--blue);white-space:nowrap}.search{margin-left:auto;width:min(360px,100%);padding:8px 12px;border:1px solid var(--line);border-radius:4px;background:#fff;font:inherit}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{background:#fff;border-top:4px solid var(--blue);padding:20px 22px;min-height:250px;display:flex;flex-direction:column}.card:first-child{border-top-color:var(--red)}.date{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.date strong{font-family:Arial,sans-serif;font-size:30px;color:var(--red)}.date span{font-size:12px;color:var(--muted);border:1px solid var(--line);padding:2px 8px;border-radius:12px}.card h2{font-size:20px;margin:12px 0 8px}.card p{font-size:14px;line-height:1.75;color:var(--muted);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.links{display:flex;gap:16px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px;margin-top:auto}.links a{color:var(--red);font-weight:700;text-decoration:none}.note{margin-top:24px;background:#EEF3FA;border-left:4px solid var(--blue);padding:12px 16px;color:var(--muted);font-size:14px;line-height:1.7}.empty{display:none;text-align:center;padding:40px;color:var(--muted)}@media(max-width:760px){.grid{grid-template-columns:1fr}.toolbar{align-items:stretch;flex-direction:column}.search{margin-left:0;width:100%}h1{font-size:27px}.sub{margin-left:0}}
"""


def render_index(entries: list) -> str:
    cards = []
    for i, entry in enumerate(entries):
        day = entry["date"]
        research = (f'<a href="daily_{day}.html">完整研究日报 →</a>' if entry.get("research") else "")
        excerpt = html.escape(entry.get("excerpt", ""))
        cards.append(f"""<article class="card" data-search="{day} {excerpt}"><div class="date"><strong>{day[5:].replace('-', '/')}</strong><span>{'最新留档' if i == 0 else '历史留档'}</span></div><h2>锡数据日报 · {day}</h2><p>{excerpt}</p><div class="links"><a href="daily_archive/{day}.html">数据日报与日度策略 →</a>{research}</div></article>""")
    return f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>日报留档 · 锡研究工作台</title><style>{INDEX_CSS}</style></head><body>
<nav class="top"><a href="index.html?v=sheet">← 返回工作台</a><a href="sheet.html">最新数据日报</a></nav><main class="wrap"><h1>日报留档</h1><p class="sub">回溯每天的行情摘要、供需日度变化、周度策略和日度策略。</p><div class="toolbar"><span class="count" id="count">{len(entries)} 天留档</span><input class="search" id="search" type="search" placeholder="搜索日期、成交、库存或观点…" aria-label="搜索日报留档"></div>
<div class="grid" id="grid">{''.join(cards)}</div><div class="empty" id="empty">没有匹配的日报留档。</div><div class="note"><b>每天更新后自动冻结：</b>“数据日报与日度策略”保存表格和两种策略的只读快照；“完整研究日报”打开当天长篇报告。历史留档不会被后续数据更新覆盖。</div></main>
<script>(function(){{var input=document.getElementById('search'),cards=[].slice.call(document.querySelectorAll('.card'));input.addEventListener('input',function(){{var q=input.value.trim().toLowerCase(),n=0;cards.forEach(function(c){{var show=!q||c.dataset.search.toLowerCase().indexOf(q)>=0;c.hidden=!show;if(show)n++;}});document.getElementById('count').textContent=n+' 天留档';document.getElementById('empty').style.display=n?'none':'block';}});}})();</script></body></html>"""


def main():
    OUT.mkdir(exist_ok=True)
    db = read_js_json(ROOT / "db_data.js", "window.DB_DATA=window.DB_DATA=")
    summary = read_js_json(ROOT / "summary_note.js", "window.TIN_SUMMARY_NOTE =")
    candidates = [p[0] for item in db if item.get("k") in ("d339", "d72", "d0")
                  for p in item.get("s", []) if isinstance(p[1], (int, float))]
    archive_date = os.environ.get("IN_DATE") or summary.get("date") or max(candidates)
    date_type.fromisoformat(archive_date)
    weekly = weekly_snapshot()
    frozen_db = []
    for item in db:
        if item.get("k") not in KEYS:
            continue
        copied = {k: v for k, v in item.items() if k != "s"}
        copied["s"] = [p for p in item.get("s", []) if p[0] <= archive_date][-40:]
        frozen_db.append(copied)
    frozen = {"date": archive_date, "summary": summary, "weekly": weekly}
    js = (f"window.DB_DATA={json.dumps(frozen_db, ensure_ascii=False, separators=(',', ':'))};\n"
          f"window.TIN_SUMMARY_NOTE={json.dumps(summary, ensure_ascii=False, separators=(',', ':'))};\n"
          f"window.DAILY_ARCHIVE={json.dumps(frozen, ensure_ascii=False, separators=(',', ':'))};\n")
    (OUT / f"{archive_date}.js").write_text(js, encoding="utf-8")
    research = (ROOT / f"daily_{archive_date}.html").exists()
    (OUT / f"{archive_date}.html").write_text(
        archive_html(archive_date, summary, data_table(frozen_db, archive_date), research), encoding="utf-8")
    index_path = OUT / "index.json"
    old = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else []
    entries = {entry["date"]: entry for entry in old}
    entries[archive_date] = {"date": archive_date, "excerpt": summary.get("B", ""), "research": research}
    ordered = [entries[key] for key in sorted(entries, reverse=True)]
    index_path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "daily_archive.html").write_text(render_index(ordered), encoding="utf-8")
    print(f"已生成日报留档 {archive_date}；共 {len(ordered)} 天")


if __name__ == "__main__":
    main()
