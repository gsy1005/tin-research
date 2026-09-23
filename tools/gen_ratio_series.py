# -*- coding: utf-8 -*-
"""
gen_ratio_series.py — 日报一键更新后自动补回跨品种比价序列
===========================================================
背景：update_daily.yml 的生成器会整体重建 db_data.js，本脚本维护的三条序列
（d900 沪铜主力 / d901 锡铜比 / d902 银锡比）会被覆盖。因此在生成器跑完后
执行本脚本，把三条序列重新写回 db_data.js。

【重要格式约束】生成器（auto_daily.py）用
    raw[raw.index('[') : raw.rindex(']')+1]
解析本文件——即"首个 [ 到末个 ] 必须恰好是一个合法 JSON 数组"。
因此三条序列必须并入主数组（window.DB_DATA=[...]）内部，
主数组之后不能再出现任何方括号（不能用 window.DB_DATA.push 追加）。

数据来源（均为仓库内文件，无需外部网络）：
  d900 沪铜主力   ← cu_data.js 的 cu_px（上海腿），可加补充点 SUPPLEMENT_CU
  d901 锡铜比     ← db_data.js 的 d719（沪锡连续收盘）÷ d900，共同日期逐日计算
  d902 银锡比     ← data.js 的 ag_sn

幂等：先移除旧的 push 追加块与主数组内同名序列，再重新生成并入。
用法：python tools/gen_ratio_series.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ── d900 手工补充点（周报/日报口径读数，发现更新读数时直接改这里）────────────
# 格式：[日期, 沪铜主力元/吨, 备注]
SUPPLEMENT_CU = [
    ["2026-09-14", 108910.0, "日报口径：9/14 收108,910（-0.39%）"],
    ["2026-09-18", 109620.0, "大类资产周报W38：周五收109,620（周+0.58%）"],
]

RATIO_KEYS = ("d900", "d901", "d902")
TAIL_COMMENT = ("/* 跨品种比价序列 d900/d901/d902 由 tools/gen_ratio_series.py 在每次日报更新后"
                "自动维护（已并入上方主数组；生成器按首个左方括号到末个右方括号解析本文件，"
                "主数组之后不得再出现任何方括号字符）。d900 手工补充点见脚本内 SUPPLEMENT_CU */")


def read_js_object(path: Path, var_pattern: str):
    """从 'window.X = {...};' 类文件里用正则抠出第一个 JSON 对象。"""
    raw = path.read_text(encoding="utf-8")
    m = re.search(var_pattern, raw, re.S)
    if not m:
        raise SystemExit(f"无法从 {path.name} 解析数据（pattern: {var_pattern}）")
    return json.loads(m.group(1))


def main():
    db_path = ROOT / "db_data.js"
    db_raw = db_path.read_text(encoding="utf-8")

    # 2) 定位主数组：从首个 [ 用 raw_decode 精准读出数组终点（之后的历史残留
    #    （push 块、含方括号的注释）一律丢弃），再剔除主数组内同名序列
    i0 = db_raw.index("[")
    data, _end = json.JSONDecoder().raw_decode(db_raw, i0)
    head = db_raw[:i0]                      # 头部注释 + window.DB_DATA= 前缀
    data = [x for x in data if x.get("k") not in RATIO_KEYS]
    by_k = {x["k"]: x for x in data}
    if "d719" not in by_k:
        raise SystemExit("db_data.js 缺少 d719（沪锡连续收盘），无法计算锡铜比")

    # 3) d900 沪铜主力
    cu = read_js_object(ROOT / "cu_data.js", r"=\s*(\{.*\})\s*;?\s*$")
    cu_sh = [[p[0], float(p[2])] for p in cu["cu_px"]]
    cu_sh += [[d, float(v)] for d, v, _ in SUPPLEMENT_CU]
    cu_sh.sort(key=lambda p: p[0])
    m_cu = {d: v for d, v in cu_sh}

    # 4) d901 锡铜比 = d719 / d900（共同日期）
    ratio = [[p[0], round(float(p[1]) / m_cu[p[0]], 3)]
             for p in by_k["d719"]["s"] if p[0] in m_cu]

    # 5) d902 银锡比
    dj = read_js_object(ROOT / "data.js", r"=\s*(\{.*\})\s*;?\s*$")
    ag = [[str(d), float(v)] for d, v in dj["ag_sn"]]

    def ser(k, n, s, u=""):
        return {"g": "价格·盘面与估值", "sg": "跨品种比价", "k": k, "n": n, "u": u, "s": s}

    new_series = [
        ser("d900", "沪铜主力（元/吨）", cu_sh, "元/吨"),
        ser("d901", "锡铜比（沪锡/沪铜）", ratio),
        ser("d902", "银锡比（沪银/沪锡）", ag),
    ]

    # 6) 并入主数组，保持全文件为单一 JSON 数组（生成器解析口径）
    new_main = json.dumps(data + new_series, ensure_ascii=False, separators=(",", ":"))
    db_path.write_text(f"{head}{new_main};\n{TAIL_COMMENT}\n", encoding="utf-8")

    # 7) 自检：按生成器口径解析 + 序列就位
    check = db_path.read_text(encoding="utf-8")
    json.loads(check[check.index("["):check.rindex("]") + 1])  # 解析不过会直接抛异常
    for k in RATIO_KEYS:
        if f'"k":"{k}"' not in check:
            raise SystemExit(f"自检失败：{k} 未写入")
    print(f"OK：d900 {cu_sh[-1][0]}={cu_sh[-1][1]:.0f} | "
          f"d901 {ratio[-1][0]}={ratio[-1][1]} | "
          f"d902 {ag[-1][0]}={ag[-1][1]:.1f} | 主数组序列数 {len(data) + 3}")


if __name__ == "__main__":
    sys.exit(main())
