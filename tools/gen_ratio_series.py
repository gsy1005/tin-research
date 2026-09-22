# -*- coding: utf-8 -*-
"""
gen_ratio_series.py — 日报一键更新后自动补回跨品种比价序列
===========================================================
背景：update_daily.yml 的生成器会整体重建 db_data.js，本脚本追加的三条序列
（d900 沪铜主力 / d901 锡铜比 / d902 银锡比）会被覆盖。因此在生成器跑完后
执行本脚本，把三条序列重新贴回 db_data.js 末尾。

数据来源（均为仓库内文件，无需外部网络）：
  d900 沪铜主力   ← cu_data.js 的 cu_px（上海腿），可加补充点 SUPPLEMENT_CU
  d901 锡铜比     ← db_data.js 的 d719（沪锡连续收盘）÷ d900，共同日期逐日计算
  d902 银锡比     ← data.js 的 ag_sn

幂等：先移除旧的追加块与同名序列，再重新生成追加，可重复运行。
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
APPEND_MARK = "/* 追加序列（tools/gen_ratio_series.py 自动维护，勿手改） */"


def read_js_object(path: Path, var_pattern: str):
    """从 'window.X = {...};' 类文件里用正则抠出第一个 JSON 对象。"""
    raw = path.read_text(encoding="utf-8")
    m = re.search(var_pattern, raw, re.S)
    if not m:
        raise SystemExit(f"无法从 {path.name} 解析数据（pattern: {var_pattern}）")
    return json.loads(m.group(1))


def load_series_map(db_raw: str):
    """解析 db_data.js 主数组：字符串定位（前缀 + 最后一个 `];`），避免大文件上的回溯灾难。"""
    prefix = "window.DB_DATA=window.DB_DATA="
    start = db_raw.find(prefix)
    end = db_raw.rfind("];")
    if start < 0 or end <= start:
        raise SystemExit("无法定位 db_data.js 主数组")
    return db_raw[start + len(prefix):end + 1]


def main():
    db_path = ROOT / "db_data.js"
    db_raw = db_path.read_text(encoding="utf-8")

    # 1) 幂等：移除旧的自动/手工追加块
    db_raw = re.sub(r"\n?/\* 追加序列[^\n]*\*/\nwindow\.DB_DATA\.push\(.*?\);\n?", "\n", db_raw, flags=re.S)
    db_raw = re.sub(r"\n?/\* 追加序列[^\n]*\nwindow\.DB_DATA\.push\(.*?\);\n?", "\n", db_raw, flags=re.S)

    # 2) 读主数组并剔除旧的 d900-d902（防止生成器把它们编进主数组后重复）
    main_json = load_series_map(db_raw)
    data = json.loads(main_json)
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
    blob = ",".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in new_series)

    # 6) 重新组装文件：原内容（含生成器新数据）+ 追加块
    append = f"\n{APPEND_MARK}\nwindow.DB_DATA.push({blob});\n"
    db_path.write_text(db_raw.rstrip("\n") + append, encoding="utf-8")

    # 7) 自检：文件可执行、序列就位
    check = db_path.read_text(encoding="utf-8")
    for k in RATIO_KEYS:
        if f'"k":"{k}"' not in check:
            raise SystemExit(f"自检失败：{k} 未写入")
    print(f"OK：d900 {cu_sh[-1][0]}={cu_sh[-1][1]:.0f} | "
          f"d901 {ratio[-1][0]}={ratio[-1][1]} | "
          f"d902 {ag[-1][0]}={ag[-1][1]:.1f} | 主数组序列数 {len(data)}")


if __name__ == "__main__":
    sys.exit(main())
