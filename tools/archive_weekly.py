# -*- coding: utf-8 -*-
"""Create an immutable, fully interactive weekly-report snapshot.

Usage (run from any directory):
  python tools/archive_weekly.py --date 2026-10-23
  python tools/archive_weekly.py --date 2026-10-16 --source /path/to/old/site

The snapshot owns its HTML, chart images, interactive data and Chart.js library,
so later Excel refreshes cannot overwrite an archived week.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import shutil
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ARCHIVE_ROOT = APP / "weekly_archive"


def clean(fragment: str) -> str:
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return html.unescape(fragment).replace("\r", " ").replace("\n", " ").strip()


def extract(pattern: str, text: str, fallback: str = "") -> str:
    match = re.search(pattern, text, re.S)
    return clean(match.group(1)) if match else fallback


def build_index() -> None:
    entries = []
    if ARCHIVE_ROOT.exists():
        for meta_path in ARCHIVE_ROOT.glob("*/meta.json"):
            try:
                entries.append(json.loads(meta_path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
    entries.sort(key=lambda item: item["date"], reverse=True)

    cards = []
    for i, item in enumerate(entries):
        badge = "最新留档" if i == 0 else "历史留档"
        summary = item.get("headline", "")
        if len(summary) > 230:
            summary = summary[:230] + "…"
        date_obj = dt.date.fromisoformat(item["date"])
        cards.append(f"""
      <article class="archive-card" data-search="{html.escape(item['title'] + ' ' + item['coverage'] + ' ' + summary)}">
        <div class="card-top">
          <div class="date-block"><strong>{date_obj.month:02d}/{date_obj.day:02d}</strong><span>{date_obj.year} 周报</span></div>
          <span class="badge{' current' if i == 0 else ''}">{badge}</span>
        </div>
        <h2>{html.escape(item['title'])}</h2>
        <div class="coverage">覆盖区间　{html.escape(item['coverage'])}</div>
        <p>{html.escape(summary)}</p>
        <div class="card-foot">
          <span>完整文字 · 交互图表 · 双配色 · PDF</span>
          <a href="weekly_archive/{item['date']}/index.html">打开留档 <b>→</b></a>
        </div>
      </article>""")

    doc = """<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<link rel="icon" href="data:,">
<title>周报留档 · 锡研究工作台</title>
<style>
:root{--red:#C00000;--blue:#1F4E79;--ink:#1a1a1a;--grey:#555;--faint:#777;--line:#D9D9D9;--bg:#fff;--soft:#FDF6F6;--card:#fff;--lead:#EEF3FA}
body.dark{--red:#d4a944;--blue:#7ea8d0;--ink:#dfe5ee;--grey:#a8b2c2;--faint:#8a94a6;--line:#2a3448;--bg:#141a26;--soft:rgba(212,169,68,.08);--card:#1c2434;--lead:rgba(31,78,121,.25)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:"KaiTi","楷体","STKaiti","Microsoft YaHei",serif;font-size:16px;line-height:1.75;padding:28px 22px 48px}
.wrap{max-width:1180px;margin:auto}.top{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.home{color:var(--blue);text-decoration:none;font-size:14px}.theme{margin-left:auto;border:1px solid var(--red);color:var(--red);background:transparent;padding:4px 13px;border-radius:4px;cursor:pointer;font-family:inherit}
h1{font-size:32px;border-left:6px solid var(--red);padding-left:14px;line-height:1.4;margin-top:20px}.sub{color:var(--grey);margin:10px 0 24px 20px}.toolbar{display:flex;align-items:center;gap:14px;border-top:2px solid var(--red);border-bottom:1px solid var(--line);padding:12px 0;margin-bottom:20px}.count{font-weight:700;color:var(--blue);white-space:nowrap}.search{margin-left:auto;width:min(360px,100%);border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:4px;padding:7px 12px;font:inherit;font-size:14px;outline:none}.search:focus{border-color:var(--blue)}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.archive-card{background:var(--card);border-top:4px solid var(--blue);padding:20px 22px;display:flex;flex-direction:column;min-height:310px}.archive-card:first-child{border-top-color:var(--red)}.card-top{display:flex;justify-content:space-between;align-items:flex-start}.date-block{display:flex;align-items:baseline;gap:10px}.date-block strong{font-family:Arial,sans-serif;font-size:35px;color:var(--red);letter-spacing:-1px}.date-block span{color:var(--faint);font-size:13px}.badge{font-size:12px;color:var(--grey);border:1px solid var(--line);padding:1px 9px;border-radius:12px}.badge.current{color:var(--red);border-color:var(--red)}h2{font-size:20px;margin:14px 0 4px}.coverage{font-size:13.5px;color:var(--blue);margin-bottom:12px}.archive-card p{font-size:14.5px;color:var(--grey);line-height:1.8;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.card-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:13px;margin-top:auto}.card-foot span{font-size:11.5px;color:var(--faint)}.card-foot a{color:var(--red);text-decoration:none;font-weight:700;white-space:nowrap}.card-foot a:hover{text-decoration:underline}.empty{display:none;color:var(--grey);padding:50px 0;text-align:center}.how{margin-top:26px;background:var(--lead);border-left:4px solid var(--blue);padding:12px 16px;color:var(--grey);font-size:14px}.how b{color:var(--ink)}
@media(max-width:760px){body{padding:18px 14px 34px}.grid{grid-template-columns:1fr}h1{font-size:26px}.sub{margin-left:0}.toolbar{align-items:stretch;flex-direction:column}.search{margin-left:0;width:100%}.card-foot{align-items:flex-start;flex-direction:column}.archive-card{min-height:290px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><a class="home" href="index.html?v=weekly2">← 返回最新周报</a><button class="theme" id="theme" type="button">◐ 切换配色</button></div>
  <h1>周报留档</h1>
  <p class="sub">按报告截止日期保存每周研究现场，回溯当时的行情、判断与数据。</p>
  <div class="toolbar"><span class="count" id="count">__COUNT__ 期留档</span><input class="search" id="search" type="search" placeholder="搜索日期、观点或关键词…" aria-label="搜索留档"></div>
  <main class="grid" id="grid">__CARDS__
  </main>
  <div class="empty" id="empty">没有匹配的周报留档。</div>
  <div class="how"><b>每期均为独立快照：</b>后续 Excel 更新不会覆盖历史内容。打开留档后仍可切换配色、编辑文字与表格、查看交互图表，并导出 A4、PPT 或长页 PDF。</div>
</div>
<script>
(function(){
  var body=document.body,button=document.getElementById('theme');
  try{if(localStorage.getItem('wkarchive-theme')==='dark')body.classList.add('dark');}catch(e){}
  button.onclick=function(){body.classList.toggle('dark');try{localStorage.setItem('wkarchive-theme',body.classList.contains('dark')?'dark':'light');}catch(e){}};
  var input=document.getElementById('search'),cards=[].slice.call(document.querySelectorAll('.archive-card'));
  input.addEventListener('input',function(){
    var q=input.value.trim().toLowerCase(),visible=0;
    cards.forEach(function(card){var show=!q||card.dataset.search.toLowerCase().indexOf(q)>=0;card.hidden=!show;if(show)visible++;});
    document.getElementById('count').textContent=visible+' 期留档';
    document.getElementById('empty').style.display=visible?'none':'block';
  });
})();
</script>
</body>
</html>"""
    doc = doc.replace("__COUNT__", str(len(entries))).replace("__CARDS__", "".join(cards))
    (APP / "weekly_archive.html").write_text(doc, encoding="utf-8")


def snapshot(source: Path, html_name: str, report_date: str) -> None:
    date_obj = dt.date.fromisoformat(report_date)
    source_html = source / html_name
    text = source_html.read_text(encoding="utf-8")
    title = extract(r"<h1[^>]*>(.*?)</h1>", text, f"锡研究周报 · {report_date}")
    start = extract(r"覆盖区间\s*<b>\s*(\d{4}-\d{2}-\d{2})", text)
    coverage = f"{start} → {report_date}" if start else f"截至 {report_date}"
    headline = extract(r'<div class="tone">(.*?)</div>', text)

    target = ARCHIVE_ROOT / report_date
    target.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source / "charts_full", target / "charts_full", dirs_exist_ok=True)
    (target / "lib").mkdir(exist_ok=True)
    shutil.copy2(source / "lib" / "chart.min.js", target / "lib" / "chart.min.js")

    # Normalize the legacy week label from the actual report date, and keep
    # browser-side edits isolated by report date.
    week = date_obj.isocalendar().week
    title = re.sub(r"\d{4} 年第 \d+ 周", f"{date_obj.year} 年第 {week} 周", title)
    text = re.sub(r"(<h1[^>]*>[^<]*?)\d{4} 年第 \d+ 周",
                  rf"\g<1>{date_obj.year} 年第 {week} 周", text)
    text = re.sub(r"(<title>[^<]*?)2026-W\d+",
                  rf"\g<1>{date_obj.year}-W{week:02d}", text)
    text = re.sub(r"var KEY='[^']+';", f"var KEY='wkarchive_{report_date}_edit';", text)
    text = re.sub(r"var TKEY='[^']+';", f"var TKEY='wkarchive_{report_date}_tables';", text)
    text = text.replace('href="weekly_archive.html"', 'href="../../weekly_archive.html"')
    archive_css = """
.archivebar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;max-width:1180px;margin:0 auto 18px;padding:9px 14px;background:var(--leadbg);border-left:4px solid var(--blue);font-size:13.5px;color:var(--grey)}
.archivebar a{color:var(--blue);text-decoration:none;font-weight:700}.archivebar .latest{margin-left:auto}.archive-stamp{color:var(--red);font-weight:700}
@media print{.archivebar{display:none!important}}
"""
    text = text.replace("</style>", archive_css + "</style>", 1)
    archive_nav = f"""<nav class="archivebar" aria-label="周报留档导航">
  <a href="../../weekly_archive.html">← 周报留档</a><span class="archive-stamp">{date_obj.year}/{date_obj.month:02d}/{date_obj.day:02d} 独立快照</span><span>历史内容不随最新数据覆盖</span><a class="latest" href="../../weekly_full.html">查看最新周报 →</a>
</nav>
"""
    text = text.replace("<body>", "<body>\n" + archive_nav, 1)
    text = text.replace("</title>", " · 留档</title>", 1)
    (target / "index.html").write_text(text, encoding="utf-8")
    (target / "meta.json").write_text(json.dumps({
        "date": report_date,
        "title": title,
        "coverage": coverage,
        "headline": headline,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    build_index()
    print(f"Archived {report_date}: {target}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True, help="report end date, YYYY-MM-DD")
    parser.add_argument("--source", type=Path, default=APP, help="site root containing the source HTML/assets")
    parser.add_argument("--html", default="weekly_full.html", help="source HTML path relative to site root")
    args = parser.parse_args()
    snapshot(args.source.resolve(), args.html, args.date)
