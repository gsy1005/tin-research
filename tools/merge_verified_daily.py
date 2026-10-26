# -*- coding: utf-8 -*-
"""把已核验的公开日度数据追加到 db_data.js；不覆盖已有日期。"""
import argparse
import datetime
import json
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--point", action="append", required=True,
                        help="格式：序列键=YYYY-MM-DD:数值，可重复")
    args = parser.parse_args()
    path = Path(args.db)
    source = path.read_text(encoding="utf-8")
    match = re.search(r"=(\[.*\])", source, re.S)
    if not match:
        raise SystemExit("无法解析 db_data.js")
    data = json.loads(match.group(1))
    by_key = {series["k"]: series for series in data}
    for item in args.point:
        key, payload = item.split("=", 1)
        date_text, value_text = payload.split(":", 1)
        datetime.datetime.strptime(date_text, "%Y-%m-%d")
        value = float(value_text)
        series = by_key.get(key)
        if series is None:
            raise SystemExit(f"序列不存在：{key}")
        dates = {point[0] for point in series["s"]}
        if date_text in dates:
            print(f"{key} {date_text} 已存在，跳过")
            continue
        series["s"].append([date_text, value])
        series["s"].sort(key=lambda point: point[0])
        print(f"{key} {date_text} = {value:g}，已追加")
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text(source[:match.start(1)] + encoded + source[match.end(1):], encoding="utf-8")


if __name__ == "__main__":
    main()
