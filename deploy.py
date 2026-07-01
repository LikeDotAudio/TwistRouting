"""deploy.py — build the TypeScript app and deploy it (TS-only, no legacy js/).

This is the single production deploy. It supersedes the old `uploadftp.py`
(js/ shell + JSON app) and `deploy-next.py` (side build). See the A.8 cutover in
docs/TYPESCRIPT-WASM-REPORT.md.

What it does, over one Explicit-FTPS connection:
  1. `npm run build`               → dist/ (content-hashed bundle + entry HTML)
  2. refresh Routes/** index.json  → the TS app discovers the data tree from these
                                      manifests on any static host (see
                                      src/platform/discovery.ts). This is the ONLY
                                      JSON that ships: routing DATA, not app code.
  3. upload:
        dist/<entry>.html  → /index.htm     (the site's DEFAULT document — this is
                                             the cutover: the root URL now serves
                                             the TypeScript app)
        dist/assets/**     → /assets/**      (stale /assets cleared first, since
                                             the bundle filename is content-hashed)
        Routes/**          → /Routes/**      (data + manifests)
  4. remove the retired legacy app from the server: js/, sw.js, and the dev
     index.next.html entry.

Routes upload is incremental by default (git diff); the small app bundle is always
re-uploaded.

Run:
    python3 deploy.py            # CUTOVER: publish as /index.htm + delete legacy js/
    python3 deploy.py --next     # SIDE-BY-SIDE: publish as /index.next.html, leave the
                                 #   live /index.htm + js/ untouched (safe until parity)
    python3 deploy.py --all      # also upload the ENTIRE Routes tree (use on first
                                 #   cutover, or after committing files never deployed)
    python3 deploy.py --no-build # deploy the existing dist/ without rebuilding
    python3 deploy.py --no-clean # skip removing the legacy js/ shell from the server

Uses .env for FTP_HOST / FTP_USER / FTP_PASS (Explicit FTPS).
"""

import os
import sys
import json
import subprocess
import ftplib

DIST_DIR = 'dist'
MANIFEST_ROOTS = ['Routes']          # folders that get an index.json manifest
REMOTE_ENTRY = 'index.htm'           # site default document (the cutover target)

# Legacy artifacts to remove from the server on deploy (the retired js/ app).
LEGACY_REMOTE = ['js', 'sw.js', 'index.next.html']


# ── .env ────────────────────────────────────────────────────────────────────
def load_env():
    env_vars = {}
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    env_vars[key] = value.strip('"\'')
    return env_vars


# ── build ─────────────────────────────────────────────────────────────────--
def run_build(project_dir):
    print("Building TypeScript app (npm run build)...")
    subprocess.run(['npm', 'run', 'build'], cwd=project_dir, check=True)


def find_entry(dist_path):
    """The built entry HTML at the dist/ root (index.next.html or index.html)."""
    for name in ('index.next.html', 'index.html'):
        if os.path.isfile(os.path.join(dist_path, name)):
            return name
    return None


def collect_app_files(dist_path, entry_name, remote_entry):
    """Files under dist/ as (local_abs, remote_rel). The entry HTML is remapped to
    `remote_entry` (/index.htm for a cutover, /index.next.html side-by-side);
    everything else keeps its dist-relative path."""
    out = []
    for root, dirs, files in os.walk(dist_path):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for name in files:
            local = os.path.join(root, name)
            rel = os.path.relpath(local, dist_path).replace(os.sep, '/')
            remote = remote_entry if rel == entry_name else rel
            out.append((local, remote))
    return out


# ── manifests (routing DATA discovery) ───────────────────────────────────────
def write_manifest(dirpath):
    """Write index.json listing this folder's immediate children (dirs end '/')."""
    entries = []
    for name in sorted(os.listdir(dirpath)):
        if name == 'index.json' or name.startswith('.'):
            continue
        full = os.path.join(dirpath, name)
        if os.path.isdir(full):
            entries.append(name + '/')
        elif name.lower().endswith('.json'):
            entries.append(name)
    with open(os.path.join(dirpath, 'index.json'), 'w') as f:
        json.dump(entries, f, indent=2)
        f.write('\n')


def generate_manifests(project_dir):
    """Create an index.json in every folder under the manifest roots."""
    count = 0
    for root in MANIFEST_ROOTS:
        root_path = os.path.join(project_dir, root)
        if not os.path.isdir(root_path):
            continue
        for dirpath, dirnames, _ in os.walk(root_path):
            dirnames[:] = [d for d in dirnames if not d.startswith('.')]
            write_manifest(dirpath)
            count += 1
    print(f"Generated {count} manifest(s).")


# ── Routes upload set (incremental) ──────────────────────────────────────────
def _under_roots(rel_path):
    parts = rel_path.split('/')
    return parts[0] in MANIFEST_ROOTS and not any(p.startswith('.') for p in parts)


def get_changed_routes(project_dir):
    """(to_upload, to_delete) for Routes/** only, from git status.

    Handles -z porcelain including renames/copies (two NUL-separated paths).
    """
    result = subprocess.run(
        ['git', '-C', project_dir, 'status', '--porcelain', '-z'],
        capture_output=True, text=True, check=True
    )
    tokens = result.stdout.split('\0')
    to_upload, to_delete = [], []
    i = 0
    while i < len(tokens):
        entry = tokens[i]
        if not entry:
            i += 1
            continue
        status = entry[:2]
        path = entry[3:]
        if 'R' in status or 'C' in status:
            orig = tokens[i + 1] if i + 1 < len(tokens) else ''
            i += 2
            if orig and _under_roots(orig):
                to_delete.append(orig)
            if _under_roots(path) and os.path.isfile(os.path.join(project_dir, path)):
                to_upload.append(path)
            continue
        i += 1
        if not _under_roots(path):
            continue
        if 'D' in status:
            to_delete.append(path)
        elif os.path.isfile(os.path.join(project_dir, path)):
            to_upload.append(path)
    return to_upload, to_delete


def get_all_routes(project_dir):
    """Every file under the manifest roots (relative paths)."""
    out = []
    for root in MANIFEST_ROOTS:
        root_path = os.path.join(project_dir, root)
        for dirpath, dirs, files in os.walk(root_path):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for name in files:
                if name.startswith('.'):
                    continue
                out.append(os.path.relpath(os.path.join(dirpath, name), project_dir)
                           .replace(os.sep, '/'))
    return out


# ── FTP helpers ──────────────────────────────────────────────────────────────
def ensure_remote_dir(ftp, remote_dir):
    """Create nested remote directories as needed, starting from root."""
    ftp.cwd('/')
    if not remote_dir:
        return
    for part in remote_dir.split('/'):
        if not part:
            continue
        try:
            ftp.mkd(part)
        except ftplib.error_perm:
            pass  # already exists
        ftp.cwd(part)


def upload_file(ftp, local, remote_rel):
    remote_dir, filename = os.path.split(remote_rel)
    ensure_remote_dir(ftp, remote_dir)
    print(f"  ↑ {remote_rel}")
    with open(local, 'rb') as f:
        ftp.storbinary(f'STOR {filename}', f)


def remote_rmtree(ftp, path):
    """Delete a remote file or directory tree at /<path>. Silent if absent."""
    # Directory? (can we cwd into it?)
    try:
        ftp.cwd('/')
        ftp.cwd(path)
    except ftplib.error_perm:
        # Not a directory — try to delete as a file.
        try:
            ftp.cwd('/')
            ftp.delete(path)
            print(f"  ✗ {path}")
        except ftplib.error_perm:
            pass  # doesn't exist
        return
    # Directory: recurse into children (basename of each nlst entry), then rmd.
    try:
        children = ftp.nlst()
    except ftplib.error_perm:
        children = []
    for child in children:
        base = child.rsplit('/', 1)[-1]
        if base in ('', '.', '..'):
            continue
        remote_rmtree(ftp, f"{path}/{base}")
    ftp.cwd('/')
    try:
        ftp.rmd(path)
        print(f"  ✗ {path}/")
    except ftplib.error_perm as e:
        print(f"  could not remove {path}/: {e}")


# ── main ─────────────────────────────────────────────────────────────────────
def main():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    args = sys.argv[1:]
    force_all = any(a in ('--all', '-a', 'full') for a in args)
    no_build = '--no-build' in args
    no_clean = '--no-clean' in args
    # Side-by-side: publish to /index.next.html and leave the live /index.htm + js/
    # UNTOUCHED (no cutover, no /assets wipe, no legacy removal). This is the safe
    # deploy to use until the TS build reaches parity.
    side_by_side = '--next' in args
    remote_entry = 'index.next.html' if side_by_side else REMOTE_ENTRY

    # 1) Build.
    if not no_build:
        try:
            run_build(project_dir)
        except subprocess.CalledProcessError:
            print("Build failed — aborting deploy.")
            sys.exit(1)

    dist_path = os.path.join(project_dir, DIST_DIR)
    entry = find_entry(dist_path) if os.path.isdir(dist_path) else None
    if not entry:
        print(f"No built entry HTML in {DIST_DIR}/. Run `npm run build` first.")
        sys.exit(1)
    app_files = collect_app_files(dist_path, entry, remote_entry)

    # 2) Manifests + Routes upload set.
    generate_manifests(project_dir)
    if force_all:
        print("Full Routes upload requested (--all).")
        routes_upload, routes_delete = get_all_routes(project_dir), []
    else:
        routes_upload, routes_delete = get_changed_routes(project_dir)
        if not routes_upload and not routes_delete:
            print("No Routes changes — data already on server (use --all to force).")

    # 3) Connect + deploy.
    env = load_env()
    FTP_HOST = env.get('FTP_HOST', '') or "twist.like.audio"
    FTP_USER = env.get('FTP_USER', '')
    FTP_PASS = env.get('FTP_PASS', '')

    print(f"Connecting to {FTP_HOST} (Explicit FTPS) as {FTP_USER}...")
    try:
        ftp = ftplib.FTP_TLS(FTP_HOST)
        ftp.login(user=FTP_USER, passwd=FTP_PASS)
        ftp.prot_p()
        print("Login successful.")

        # App: clear stale hashed assets (cutover only — side-by-side keeps /assets
        # so the live app's logos and any other bundle survive), upload the new
        # bundle, then the entry HTML LAST so the page never references a
        # not-yet-uploaded bundle.
        if not side_by_side:
            print("Clearing stale /assets...")
            remote_rmtree(ftp, 'assets')
        print(f"Deploying app ({len(app_files)} file(s)); {entry} → /{remote_entry}:")
        for local, remote in sorted(app_files, key=lambda lr: (lr[1] == remote_entry, lr[1])):
            upload_file(ftp, local, remote)

        # Data.
        if routes_upload:
            print(f"Uploading {len(routes_upload)} Routes file(s):")
            for rel in sorted(routes_upload):
                upload_file(ftp, os.path.join(project_dir, rel), rel)
        for rel in routes_delete:
            print(f"Deleting remote {rel}...")
            try:
                ftp.cwd('/')
                ftp.delete(rel)
            except ftplib.error_perm as e:
                print(f"  could not delete {rel}: {e}")

        # Cleanup: remove the retired legacy js/ app from the server (cutover only).
        if not no_clean and not side_by_side:
            print("Removing retired legacy app (js/, sw.js, dev entry):")
            for path in LEGACY_REMOTE:
                remote_rmtree(ftp, path)

        ftp.quit()
        if side_by_side:
            print(f"\nSide-by-side deploy complete → https://{FTP_HOST}/index.next.html "
                  f"(live https://{FTP_HOST}/ + js/ untouched).")
        else:
            print(f"\nDeploy complete → https://{FTP_HOST}/  now serves the TypeScript app.")
    except Exception as e:
        print(f"FTP Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
