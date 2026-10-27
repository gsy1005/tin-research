# -*- coding: utf-8 -*-
"""日报成品消毒：抹掉「机构在盯什么」等处的期货公司名。

生成器（GEN_PACK secret 内的 auto_daily.py）每次会重新写出机构名，
secret 无法读回编辑，因此在 workflow 里加本步骤，对生成的 daily_*.html
做幂等清洗：公司名 -> 共识家数。重复运行无副作用。
"""
import glob
import re
import sys

# 常见卖方（长的放前面，避免「国投」先吃掉「国投安信」）
BROKERS = [
    "混沌天成", "国投安信", "中信建投", "国泰君安", "国君期货",
    "混沌", "国投", "国君", "华泰", "银河", "一德", "中色", "国金",
    "永安", "中信", "南华", "东证", "方正中期", "方正", "浙商",
    "海通", "兴证", "瑞达", "弘业", "东海", "五矿", "云晨", "金瑞",
    "长江期货", "大地期货", "广发", "招商", "申万", "光大", "平安期货",
]
ALT = "|".join(BROKERS)

# 1) 小节标题：只留日期范围，去掉后面的机构名单
RE_HEAD = re.compile(r"(全网锡研报扫描 · [\d\-]+ 至 [\d\-]+)(?: · [^<]+)?")

# 2) 列名
RE_COL = re.compile(r"<th([^>]*)>代表机构</th>")

# 3) 机构名单单元格：<td>国君 · 华泰 · 银河 · 一德</td>（可含「半年报」）
RE_CELL = re.compile(
    r"<td>((?:" + ALT + r")(?:\s*·\s*(?:" + ALT + r"|半年报))*)\s*</td>"
)


def cell_repl(m):
    parts = [p.strip() for p in m.group(1).split("·")]
    has_report = "半年报" in parts
    n = len([p for p in parts if p != "半年报"])
    if has_report:
        return f"<td>{n} 家 + 半年报</td>"
    if n >= 2:
        return f"<td>{n} 家一致</td>"
    return "<td>1 家</td>"


def sweep(text):
    """兜底：清掉残漏的公司名（含 / 分隔的标题名单），压缩多余分隔符。"""
    leftover = re.findall(ALT, text)
    if leftover:
        print("  兜底清理:", sorted(set(leftover)))
        text = re.sub(ALT + r"期货?", "", text)
        text = re.sub(r"\s*[·/、]\s*(?=\s*[·/、<])", "", text)
        text = re.sub(r"(?<=[·/、])\s*[·/、]+\s*", " ", text)
        text = re.sub(r"\s{2,}", " ", text)
    return text


def clean(path):
    src = open(path, encoding="utf-8").read()
    out = RE_HEAD.sub(r"\1", src)
    out = RE_COL.sub(lambda m: f"<th{m.group(1)}>共识家数</th>", out)
    out = RE_CELL.sub(cell_repl, out)
    out = sweep(out)
    if out != src:
        open(path, "w", encoding="utf-8").write(out)
        return True
    return False


def ensure_sheet_customs():
    """日报生成后接回自定义图表、独立供需页入口及留档入口。"""
    path = "sheet.html"
    if not glob.glob(path):
        return
    src = open(path, encoding="utf-8").read()
    out = src
    if 'href="daily_strategy.css' not in out:
        out = out.replace('</head>', '<link rel="stylesheet" href="daily_strategy.css?v=202610271745">\n</head>', 1)
    tags = []
    if 'src="sheet_customs.js' not in out:
        tags.append('<script src="sheet_customs.js?v=202610270148"></script>')
    if 'src="daily_strategy.js' not in out:
        tags.append('<script src="daily_strategy.js?v=202610271850"></script>')
    if tags:
        out, count = re.subn(
            r'(<script src="sheet\.js\?v=[^"]+"></script>)',
            r"\1\n" + '\n'.join(tags),
            out,
            count=1,
        )
        if count != 1:
            raise RuntimeError("sheet.html 未找到 sheet.js 引入位置，无法接入自定义模块")
    out = re.sub(r'daily_strategy\.css\?v=[^"]+', 'daily_strategy.css?v=202610271745', out)
    out = re.sub(r'daily_strategy\.js\?v=[^"]+', 'daily_strategy.js?v=202610271850', out)
    out = out.replace(
        '<button onclick="TIN_DAILY_STRATEGY.exportPNG()">供需策略 PNG</button>',
        '<button onclick="location.href=\'strategy.html\'">供需策略</button>',
    )
    if "location.href='strategy.html'" not in out:
        out, count = re.subn(
            r'(<button onclick="TIN_SHEET\.exportPNG\(\)">.*?</button>)',
            "\\1\n  <button onclick=\"location.href='strategy.html'\">供需策略</button>",
            out,
            count=1,
        )
        if count != 1:
            raise RuntimeError("sheet.html 未找到日报图片导出按钮")
    if 'href="daily_archive.html"' not in out:
        out = out.replace('  <select id="days"', '  <a class="archive-link" href="daily_archive.html">日报留档</a>\n  <select id="days"', 1)
    block_pos = out.find('<section class="strategy-block" id="dailyStrategyBlock">')
    if block_pos >= 0:
        block_end = out.find('</section>', block_pos)
        if block_end < 0:
            raise RuntimeError("sheet.html 供需策略区块不完整")
        block_end += len('</section>')
        out = out[:block_pos] + out[block_end:]
    if out != src:
        open(path, "w", encoding="utf-8").write(out)
        print("已接入日报图表、独立供需页与留档入口")


def main():
    ensure_sheet_customs()
    files = sorted(glob.glob("daily_*.html"))
    if not files:
        print("未找到 daily_*.html")
        return
    for f in files:
        changed = clean(f)
        print(("已清洗 " if changed else "无名字  ") + f)
    # 校验：任何已知公司名都不允许残留
    bad = []
    for f in files:
        t = open(f, encoding="utf-8").read()
        for b in BROKERS:
            if b in t:
                bad.append(f"{f}: {b}")
    if bad:
        print("残留警告:", bad)
        sys.exit(1)
    print("校验通过：无期货公司名残留")


if __name__ == "__main__":
    main()
