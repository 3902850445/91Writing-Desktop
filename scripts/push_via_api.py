#!/usr/bin/env python3
"""Push local HEAD to a GitHub branch via the Git Data REST API.

Needed because github.com is blocked by the local proxy while
api.github.com stays reachable.

Strategy: reuse the tree object of an existing remote branch that already
holds most of the content, then overlay only the files that differ. That
keeps this to ~3 API calls instead of one per file.
"""
import base64
import json
import subprocess
import sys
import urllib.error
import urllib.request

REPO = "3902850445/91Writing-Desktop"
API = f"https://api.github.com/repos/{REPO}"
KEYFILE = "github_key.txt"
DONOR = "master"  # remote branch whose tree we reuse as a base


def load_token():
    with open(KEYFILE, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            for sep in ("：", ":"):
                if line.startswith("密码") and sep in line:
                    return line.split(sep, 1)[1].strip()
    sys.exit("token not found in " + KEYFILE)


TOKEN = load_token()


def api(method, path, payload=None):
    url = API + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read()
        return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        sys.exit(f"{method} {url} -> HTTP {exc.code}\n{exc.read().decode(errors='replace')[:800]}")


def git(*args):
    return subprocess.run(
        ["git", *args], capture_output=True, text=True, check=True
    ).stdout.strip()


def main():
    branch = sys.argv[1] if len(sys.argv) > 1 else "main"
    local_sha = git("rev-parse", "HEAD")
    target_sha = api("GET", f"/git/ref/heads/{branch}")["object"]["sha"]
    donor_sha = api("GET", f"/git/ref/heads/{DONOR}")["object"]["sha"]

    donor_files = {
        e["path"]: e["sha"]
        for e in api("GET", f"/git/trees/{donor_sha}?recursive=1")["tree"]
        if e["type"] == "blob"
    }
    local_files = git("ls-tree", "-r", "--name-only", local_sha).splitlines()

    changed = []
    for path in local_files:
        mode, _typ, sha = git("ls-tree", local_sha, "--", path).split("\t")[0].split()
        if donor_files.get(path) != sha:
            changed.append((path, mode, sha))
    removed = set(donor_files) - set(local_files)
    print(f"local files: {len(local_files)} | to upload: {len(changed)} | to delete: {len(removed)}")

    entries = []
    for path, mode, _sha in changed:
        with open(path, "rb") as fh:
            blob = base64.b64encode(fh.read()).decode()
        sha = api("POST", "/git/blobs", {"content": blob, "encoding": "base64"})["sha"]
        entries.append({"path": path, "mode": mode, "type": "blob", "sha": sha})
    for path in sorted(removed):
        entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})

    tree = api(
        "POST",
        "/git/trees",
        {"base_tree": donor_sha, "tree": entries},
    )
    print("tree:", tree["sha"])

    message = git("log", "-1", "--pretty=%B").strip() or "update via API"
    commit = api(
        "POST",
        "/git/commits",
        {"message": message, "tree": tree["sha"], "parents": [target_sha]},
    )
    print("commit:", commit["sha"], "(parent = current main)")

    # main holds only an unrelated Apache LICENSE; master's history wins
    # per the user's decision, so fast-forward the ref to the new commit.
    ref = api(
        "PATCH",
        f"/git/refs/heads/{branch}",
        {"sha": commit["sha"], "force": True},
    )
    print(f"{branch} -> {ref['object']['sha']}")


if __name__ == "__main__":
    main()