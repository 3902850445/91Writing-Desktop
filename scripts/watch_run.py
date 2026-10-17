#!/usr/bin/env python3
"""Poll a GitHub Actions run and print per-job status.

Usage: python scripts/watch_run.py [run_id] [--watch]
"""
import json
import sys
import time
import urllib.request

REPO = "3902850445/91Writing-Desktop"
KEYFILE = "github_key.txt"

tok_raw = open(KEYFILE, encoding="utf-8").read()
TOKEN = [l for l in tok_raw.splitlines() if l.startswith("密码")][0].split("：", 1)[1].strip()


def get(path):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{REPO}{path}",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main():
    args = [a for a in sys.argv[1:] if a != "--watch"]
    watch = "--watch" in sys.argv
    run_id = args[0] if args else None

    if not run_id:
        runs = get("/actions/runs?per_page=1")["workflow_runs"]
        if not runs:
            sys.exit("no runs found")
        run_id = runs[0]["id"]

    while True:
        run = get(f"/actions/runs/{run_id}")
        jobs = get(f"/actions/runs/{run_id}/jobs")["jobs"]
        print(f"\n=== run #{run['run_number']} [{run['head_branch']}] "
              f"{run['status']} / {run['conclusion']} ===")
        for j in jobs:
            print(f"  {j['name']:<30} {j['status']:<12} {j['conclusion'] or '-'}")
        print(f"  URL: {run['html_url']}")

        if not watch or run["status"] == "completed":
            failed = [j for j in jobs if j["conclusion"] not in ("success", "skipped", None)]
            if failed:
                print("\nfailed jobs:")
                for j in failed:
                    print(f"  {j['name']} -> {j['conclusion']}")
                    for s in j.get("steps", []):
                        if s["conclusion"] == "failure":
                            print(f"     step: {s['name']}")
            return
        time.sleep(45)


if __name__ == "__main__":
    main()