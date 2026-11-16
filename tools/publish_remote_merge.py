# -*- coding: utf-8 -*-
"""把已人工合并的工作区文件增量发布到远端最新 main，不覆盖远端其他提交。"""
from pathlib import Path
import os
import subprocess
import requests

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.github.com/repos/gsy1005/tin-research"
EXPECTED_REMOTE = os.environ.get("EXPECTED_REMOTE", "").strip()
FILES = [name.strip() for name in os.environ.get("PUBLISH_FILES", "").split(",") if name.strip()] or [
    "db_data.js",
    "summary_note.js",
    "daily_overrides.js",
    "daily_archive/2026-11-06.js",
    "daily_archive/2026-11-06.html",
    "daily_archive/index.json",
    "daily_archive.html",
    "tools/archive_daily.py",
]

def git(*args, input_text=None):
    return subprocess.run(["git", *args], cwd=ROOT, input=input_text, text=True,
                          encoding="utf-8", capture_output=True, check=True).stdout

def main():
    cred = {}
    for line in git("-c", "credential.helper=", "-c", "credential.helper=manager",
                    "credential", "fill", input_text="protocol=https\nhost=github.com\n\n").splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            cred[k] = v
    if not cred.get("password"):
        raise RuntimeError("未获取到 GitHub 凭证")
    def req(method, path, **kwargs):
        payload = kwargs.get("json")
        command = ["curl", "--silent", "--show-error", "--fail-with-body", "--max-time", "240",
                   "-X", method, "-H", f"Authorization: Bearer {cred['password']}",
                   "-H", "Accept: application/vnd.github+json", "-H", "X-GitHub-Api-Version: 2022-11-28",
                   "-H", "User-Agent: tin-research-merge-publisher"]
        input_text = None
        if payload is not None:
            import json
            command += ["-H", "Content-Type: application/json", "--data-binary", "@-"]
            input_text = json.dumps(payload, ensure_ascii=False)
        command.append(API + path)
        result = subprocess.run(command, input=input_text, text=True, encoding="utf-8",
                                capture_output=True, timeout=250)
        if result.returncode:
            raise RuntimeError(f"{method} {path}: {result.stderr} {result.stdout[:300]}")
        import json
        return json.loads(result.stdout)
    remote = req("GET", "/git/ref/heads/main")["object"]["sha"]
    if EXPECTED_REMOTE and remote != EXPECTED_REMOTE:
        raise RuntimeError(f"远端 main 已变化：{remote}；停止发布并重新合并")
    base_tree = req("GET", f"/git/commits/{remote}")["tree"]["sha"]
    changes = []
    for name in FILES:
        changes.append({"path": name, "mode": "100644", "type": "blob",
                        "content": (ROOT / name).read_text(encoding="utf-8")})
    tree = req("POST", "/git/trees", json={"base_tree": base_tree, "tree": changes})["sha"]
    name = git("show", "-s", "--format=%an", "HEAD").strip()
    email = git("show", "-s", "--format=%ae", "HEAD").strip()
    commit = req("POST", "/git/commits", json={
        "message": "更新锡数据日报与供需策略",
        "tree": tree, "parents": [remote],
        "author": {"name": name, "email": email},
        "committer": {"name": name, "email": email},
    })["sha"]
    req("PATCH", "/git/refs/heads/main", json={"sha": commit, "force": False})
    print(f"发布成功：{commit}")

if __name__ == "__main__":
    main()
