import os
import sys
import json
import subprocess
import ftplib

# Roots whose folders get an index.json manifest so the web app can discover the
# tree on any static host (no server-side directory listing required).
# Sources/ and Destinations/ now live under Routes/.
MANIFEST_ROOTS = ['Routes']

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

# Files and directories to never upload, even if changed
IGNORE = {'.git', '.env', '__pycache__', 'deploy.py', 'start.py', 'uploadftp.py',
          'node_modules', 'package.json', 'package-lock.json', 'test_puppeteer.js'}

def is_ignored(rel_path):
    parts = rel_path.split('/')
    return any(p in IGNORE or p.startswith('.') for p in parts)

def get_changed_files(project_dir):
    """Return (to_upload, to_delete) relative paths from git status.

    Handles -z porcelain correctly, including renames/copies whose record carries
    TWO NUL-separated paths (new then original) — the original is removed remotely
    and the new path uploaded.
    """
    result = subprocess.run(
        ['git', '-C', project_dir, 'status', '--porcelain', '-z'],
        capture_output=True, text=True, check=True
    )
    tokens = result.stdout.split('\0')
    to_upload = []
    to_delete = []
    i = 0
    while i < len(tokens):
        entry = tokens[i]
        if not entry:
            i += 1
            continue
        status = entry[:2]
        path = entry[3:]
        is_rename = 'R' in status or 'C' in status
        if is_rename:
            # The next token is the original (old) path for this rename/copy.
            orig = tokens[i + 1] if i + 1 < len(tokens) else ''
            i += 2
            if orig and not is_ignored(orig):
                to_delete.append(orig)
            if not is_ignored(path) and os.path.isfile(os.path.join(project_dir, path)):
                to_upload.append(path)
            continue
        i += 1
        if is_ignored(path):
            continue
        if 'D' in status:
            to_delete.append(path)
        elif os.path.isfile(os.path.join(project_dir, path)):
            to_upload.append(path)
    return to_upload, to_delete

def get_all_files(project_dir):
    """Return every non-ignored file (relative paths) by walking the tree."""
    all_files = []
    for root, dirs, files in os.walk(project_dir):
        # Prune ignored directories so we don't descend into them
        dirs[:] = [d for d in dirs if d not in IGNORE and not d.startswith('.')]
        for name in files:
            rel = os.path.relpath(os.path.join(root, name), project_dir)
            if not is_ignored(rel):
                all_files.append(rel)
    return all_files

def ensure_remote_dir(ftp, remote_dir):
    """Create nested remote directories as needed, starting from root."""
    if not remote_dir:
        return
    ftp.cwd('/')
    for part in remote_dir.split('/'):
        if not part:
            continue
        try:
            ftp.mkd(part)
        except ftplib.error_perm:
            pass  # Directory already exists
        ftp.cwd(part)

def upload_to_ftp():
    env = load_env()

    # Fallback to twist.like.audio if FTP_HOST is empty, since ftp.tandaphonic.com didn't resolve
    FTP_HOST = env.get('FTP_HOST', '') or "twist.like.audio"
    FTP_USER = env.get('FTP_USER', '')
    FTP_PASS = env.get('FTP_PASS', '')

    project_dir = os.path.dirname(os.path.abspath(__file__))

    # Refresh manifests first so they reflect the current tree and get uploaded.
    generate_manifests(project_dir)

    # `--all` (or `-a` / `full`) forces a complete upload. Use this after adding
    # files that were committed but never deployed: the git-diff path below skips
    # anything that reads as "clean", so a manifest can end up referencing files
    # the server doesn't have (404s). A full upload guarantees they all go up.
    force_all = any(a in ('--all', '-a', 'full') for a in sys.argv[1:])

    if force_all:
        print("Full upload requested (--all) — uploading every file.")
        to_upload, to_delete = get_all_files(project_dir), []
    else:
        # Manifests are refreshed above; any that actually changed are picked up by
        # git below, so the upload stays incremental (just the real diff).
        to_upload, to_delete = get_changed_files(project_dir)
        if not to_upload and not to_delete:
            # Nothing changed — upload the whole project instead.
            print("No changes detected — uploading everything.")
            to_upload = get_all_files(project_dir)

    # Upload order: root files first, then js/, then everything else — so the page
    # shell (index.htm) and its scripts land before the larger data tree.
    def upload_rank(rel_path):
        if '/' not in rel_path:
            return 0  # root files (index.htm, *.json at root, ...)
        if rel_path.split('/', 1)[0] == 'js':
            return 1  # js/ and js/editors/...
        return 2      # the rest (Routes/Sources/, Routes/Destinations/, ...)
    to_upload.sort(key=lambda p: (upload_rank(p), p))

    print(f"Connecting to FTP server {FTP_HOST} (Explicit FTPS) as {FTP_USER}...")
    try:
        ftp = ftplib.FTP_TLS(FTP_HOST)
        ftp.login(user=FTP_USER, passwd=FTP_PASS)
        ftp.prot_p()  # Switch to secure data connection
        print("Login successful!")

        for rel_path in to_upload:
            remote_dir, filename = os.path.split(rel_path)
            ensure_remote_dir(ftp, remote_dir)
            local_item = os.path.join(project_dir, rel_path)
            print(f"Uploading {rel_path}...")
            with open(local_item, 'rb') as f:
                ftp.storbinary(f'STOR {filename}', f)

        for rel_path in to_delete:
            print(f"Deleting remote {rel_path}...")
            try:
                ftp.cwd('/')
                ftp.delete(rel_path)
            except ftplib.error_perm as e:
                print(f"  Could not delete {rel_path}: {e}")

        ftp.quit()
        print("Upload complete!")

    except Exception as e:
        print(f"FTP Error: {e}")

if __name__ == "__main__":
    upload_to_ftp()
