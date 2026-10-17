#!/usr/bin/env python3
"""Fetch and grep a GitHub Actions job log.

Usage: python scripts/job_log.py <job_id> [out_file] [--errors]

The /logs endpoint 302-redirects to Azure Blob; urllib drops the
Authorization header across that redirect, so we capture the Location
header ourselves and let curl fetch it.
"""
import re
import subprocess
import sys
import urllib.error
import urllib.request

REPO = "3902850445/91Writing-Desktop"


def token():
    raw = open("github_key.txt", encoding="utf-8").read()
    return [l for l in raw.splitlines() if l.startswith("密码")][0].split("：", 1)[1].strip()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a):
        return None


def main():
    job_id = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else f"job_{job_id}.log"
    errors_only = "--errors" in sys.argv

    tok = token()
    op = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(
        f"https://api.github.com/repos/{REPO}/actions/jobs/{job_id}/logs",
        headers={"Authorization": f"Bearer {tok}", "Accept": "application/vnd.github+json"},
    )
    try:
        op.open(req, timeout=60)
        sys.exit("expected a redirect to the log blob")
    except urllib.error.HTTPError as e:
        if e.code != 302:
            sys.exit(f"unexpected HTTP {e.code}")
        loc = e.headers["Location"]

    subprocess.run(["curl", "-sS", "--max-time", "180", "-o", out, loc], check=True)

    text = open(out, encoding="utf-8", errors="replace").read()
    lines = [l for l in text.splitlines() if l.strip()]
    print(f"saved {out} ({len(lines)} lines)")
    if errors_only:
        pat = re.compile(
            r"##\[error\]|error:|Error:|error\[|panicked|failed to|"
            r"cannot find|not found|No such file|denied|exit code",
            re.I,
        )
        hits = [l for l in lines if pat.search(l)]
        print(f"--- {len(hits)} matching lines ---")
        print("\n".join(hits[-40:]))
    else:
        print("\n".join(lines[-40:]))


if __name__ == "__main__":
    main()