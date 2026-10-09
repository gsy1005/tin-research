# -*- coding: utf-8 -*-
"""
gen_excel_backfill.py — Excel 数据回填 db_data.js（幂等，可反复运行）

用途：用户丢来新版的 Mysteel / SMM 锡数据库 Excel 后，把其中比 db_data.js 新的
数据点自动合并进去（按日期去重，已存在的跳过）。

用法：
    python gen_excel_backfill.py <钢联Excel路径> <SMM Excel路径> [--db app/db_data.js]

设计要点：
- 自动识别哪个文件是钢联（含「贸易商日度交易量」）、哪个是 SMM（含「印尼交易所成交量」）
- 每条序列标注来源 sheet 与列，提取规则与 2026-10-09 手工回填核对一致
- 全球显性 = LME 日度(取周度日期的前一交易日值) + 钢联社库总计，与 d718 历史口径一致
- SMM「产量开工（周）」只写 d196-198（标准日期）；d217-219 季节序列另有日期约定，不在这里动
- 只追加缺失日期，绝不覆盖已有值；运行结束打印每条序列的新增情况
"""
import argparse
import datetime
import json
import re
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("需要 openpyxl：pip install openpyxl")

TIN_KEYS = {
    "d71":  "锡锭同业贸易商成交合计",
    "d72":  "锡锭下游成交合计",
    "d194": "锡精矿：40%Sn：加工费：云南",
    "d195": "锡精矿：60%Sn：加工费：江西",
    "d196": "SMM: 精炼锡_云南开工率: 周度",
    "d197": "SMM: 精炼锡_江西开工率: 周度",
    "d198": "SMM: 精炼锡_两省合计开工率: 周度",
    "d329": "SMM: 锡锭社会库存: 上海: 周度",
    "d330": "SMM: 锡锭社会库存: 苏州: 周度",
    "d331": "SMM: 锡锭社会库存: 广东: 周度",
    "d332": "SMM: 锡锭社会库存: 总库存: 周度",
    "d351": "全球显性库存·2026年",
    "d397": "上海钢联有色市场",
    "d398": "LME升贴水",
    "d405": "现货进口盈亏",
    "d411": "现货实际比值",
    "d480": "JFX,ICDX: 锡锭_印尼交易所成交量-每日成交量: 日度",
    "d481": "JFX,ICDX: 锡锭_月累计成交量: 日度",
    "d718": "全球显性库存·周",
    "d739": "Mysteel: 锡锭社会库存: 总计: 周度",
    "d740": "Mysteel: 锡锭社会库存: 上海: 周度",
    "d741": "Mysteel: 锡锭社会库存: 江苏: 周度",
    "d742": "Mysteel: 锡锭社会库存: 广东: 周度",
}


def dstr(v):
    return v.strftime("%Y-%m-%d") if isinstance(v, datetime.datetime) else None


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def rows_as_dicts(ws, min_row=1):
    """yield (date_str, row_tuple) for rows whose first non-empty cell is a date"""
    for r in ws.iter_rows(min_row=min_row, values_only=True):
        d = r[0]
        if isinstance(d, datetime.datetime):
            yield dstr(d), r


# ---------------- 钢联 extractors ----------------

def ex_trader(wb):
    """贸易商日度交易量: date, 同业, 下游 -> d71/d72"""
    out = {"d71": [], "d72": []}
    for ds, r in rows_as_dicts(wb["贸易商日度交易量"], min_row=2):
        if num(r[1]) and num(r[2]):
            out["d71"].append((ds, float(r[1])))
            out["d72"].append((ds, float(r[2])))
    return out


def ex_tc(wb):
    """锡精矿加工费统计: date, 云南40%, 江西60% -> d194/d195"""
    out = {"d194": [], "d195": []}
    for ds, r in rows_as_dicts(wb["锡精矿加工费统计"], min_row=2):
        if num(r[1]):
            out["d194"].append((ds, float(r[1])))
        if num(r[2]):
            out["d195"].append((ds, float(r[2])))
    return out


def ex_mysoc(wb):
    """锡锭社会库存: date, 沪, 苏, 粤, 津, 鲁, 总计 -> d739-d742"""
    out = {"d739": [], "d740": [], "d741": [], "d742": []}
    for ds, r in rows_as_dicts(wb["锡锭社会库存"], min_row=2):
        if num(r[6]):
            out["d739"].append((ds, float(r[6])))
        if num(r[1]):
            out["d740"].append((ds, float(r[1])))
        if num(r[2]):
            out["d741"].append((ds, float(r[2])))
        if num(r[3]):
            out["d742"].append((ds, float(r[3])))
    return out


def ex_pnl(wb):
    """进出口盈亏: date, 钢联均价B, LME升贴水C, 沪锡主力F, LME3M G, 现货盈亏J
    -> d397/d398/d405/d411(=F/G)"""
    out = {"d397": [], "d398": [], "d405": [], "d411": []}
    for ds, r in rows_as_dicts(wb["进出口盈亏"], min_row=2):
        if num(r[1]):
            out["d397"].append((ds, float(r[1])))
        if num(r[2]):
            out["d398"].append((ds, float(r[2])))
        if num(r[9]):
            out["d405"].append((ds, float(r[9])))
        if num(r[5]) and num(r[6]) and r[6] != 0:
            out["d411"].append((ds, float(r[5]) / float(r[6])))
    return out


# ---------------- SMM extractors ----------------

def ex_indonesia(wb):
    """印尼交易所成交量: date, 日成交量, 月累计 -> d480/d481"""
    out = {"d480": [], "d481": []}
    for ds, r in rows_as_dicts(wb["印尼交易所成交量"], min_row=5):
        if num(r[1]):
            out["d480"].append((ds, float(r[1])))
        if num(r[2]):
            out["d481"].append((ds, float(r[2])))
    return out


def ex_weekly_ops(wb):
    """产量开工（周）: colB date, C 云南开工, D 江西开工, E 合计开工 -> d196-198"""
    out = {"d196": [], "d197": [], "d198": []}
    ws = wb["产量开工（周）"]
    for r in ws.iter_rows(min_row=6, values_only=True):
        d = r[1]
        if not isinstance(d, datetime.datetime):
            continue
        ds = dstr(d)
        if num(r[2]):
            out["d196"].append((ds, float(r[2])))
        if num(r[3]):
            out["d197"].append((ds, float(r[3])))
        if num(r[4]):
            out["d198"].append((ds, float(r[4])))
    return out


def ex_smm_inv(wb):
    """库存（周）: date, 上海(7th col idx6), 苏州 idx7, 广东 idx8, 总 idx9 -> d329-332
    跳过 #N/A 行（openpyxl 读公式缓存为字符串）"""
    out = {"d329": [], "d330": [], "d331": [], "d332": []}
    keys = ["d329", "d330", "d331", "d332"]
    for ds, r in rows_as_dicts(wb["库存（周）"], min_row=2):
        for i, k in enumerate(keys):
            v = r[6 + i] if len(r) > 6 + i else None
            if num(v):
                out[k].append((ds, float(v)))
    return out


def ex_lme_daily(wb):
    """lme+全球显性库存: colA date, colB LME日度 -> dict date:value"""
    out = {}
    for ds, r in rows_as_dicts(wb["lme+全球显性库存"], min_row=5):
        if num(r[1]):
            out[ds] = float(r[1])
    return out


# ---------------- db merge ----------------

def load_db(path):
    src = open(path, encoding="utf-8").read()
    m = re.search(r"=(\[.*\])", src, re.S)
    if not m:
        sys.exit(f"无法解析 {path}")
    return src, m, json.loads(m.group(1))


def merge(data, additions, lme_daily=None):
    """additions: {key: [(date, val), ...]}；只补缺失日期；返回统计。
    d351/d718（全球显性）为派生序列，只向后接新日期（>现有最大日期），
    避免用当前公式重算历史口径造成重复/覆盖。"""
    stats = {}
    by_key = {s["k"]: s for s in data}
    for key, pts in additions.items():
        s = by_key.get(key)
        if s is None:
            print(f"  !! 序列 {key} 不存在于 db_data.js，跳过")
            continue
        existing = {p[0] for p in s["s"]}
        tail_only = key in ("d351", "d718")
        max_d = max(existing) if (tail_only and existing) else None
        added = 0
        for ds, v in pts:
            if tail_only and max_d and ds <= max_d:
                continue
            if key in ("d351", "d718") and lme_daily:
                # 全球显性 = LME(周度日期前一交易日) + 钢联社库总计
                dt = datetime.datetime.strptime(ds, "%Y-%m-%d") - datetime.timedelta(days=1)
                lme = None
                while lme is None and dt > datetime.datetime(2020, 1, 1):
                    lme = lme_daily.get(dt.strftime("%Y-%m-%d"))
                    dt -= datetime.timedelta(days=1)
                if lme is None:
                    continue
                v = lme + v
            if ds not in existing:
                s["s"].append([ds, v])
                existing.add(ds)
                added += 1
        if added:
            s["s"].sort(key=lambda p: p[0])
        stats[key] = added
    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("excels", nargs="+", help="Mysteel / SMM Excel 路径（自动识别）")
    ap.add_argument("--db", default="db_data.js", help="db_data.js 路径")
    ap.add_argument("--since", default=None, help="只处理该日期之后的数据 YYYY-MM-DD（默认全部，靠去重兜底）")
    args = ap.parse_args()

    my_wb = smm_wb = None
    for p in args.excels:
        wb = openpyxl.load_workbook(p, read_only=True)
        names = set(wb.sheetnames)
        if "贸易商日度交易量" in names:
            my_wb = wb
            print(f"钢联 Excel: {p}")
        elif "印尼交易所成交量" in names:
            smm_wb = wb
            print(f"SMM  Excel: {p}")
        else:
            print(f"!! 无法识别: {p}")

    if not my_wb and not smm_wb:
        sys.exit("没有可用 Excel")

    additions = {}
    lme_daily = None

    if my_wb:
        for ex in (ex_trader, ex_tc, ex_mysoc, ex_pnl):
            for k, pts in ex(my_wb).items():
                additions.setdefault(k, []).extend(pts)
        # 全球显性 = 钢联社库总计 + LME
        additions["_soc_total_for_visible"] = additions.get("d739", [])
    if smm_wb:
        for ex in (ex_indonesia, ex_weekly_ops, ex_smm_inv):
            for k, pts in ex(smm_wb).items():
                additions.setdefault(k, []).extend(pts)
        lme_daily = ex_lme_daily(smm_wb)

    soc = additions.pop("_soc_total_for_visible", [])
    additions["d718"] = [(ds, v) for ds, v in soc]
    additions["d351"] = [(ds, v) for ds, v in soc]

    if args.since:
        additions = {k: [(d, v) for d, v in pts if d >= args.since]
                     for k, pts in additions.items()}

    src, m, data = load_db(args.db)
    stats = merge(data, additions, lme_daily=lme_daily)

    total = 0
    print("\n== 回填结果 ==")
    for k in sorted(stats, key=lambda x: int(x[1:])):
        n = stats[k]
        total += n
        flag = f"+{n}" if n else " 0"
        print(f"  {k:>5} {TIN_KEYS.get(k,'?'):<38} {flag}")
    print(f"合计新增 {total} 个点")

    if total:
        new_json = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        open(args.db, "w", encoding="utf-8").write(src[:m.start(1)] + new_json + src[m.end(1):])
        print(f"已写回 {args.db}")
    else:
        print("无新增，db_data.js 未改动")


if __name__ == "__main__":
    main()
