# run validation helper
import json, sys, subprocess

doc = sys.argv[1]
payload = json.dumps({"document_path": doc})
r = subprocess.run(["python", "scripts/validate_document.py"], input=payload, capture_output=True, text=True)
out = r.stdout.strip()
err = r.stderr.strip()
if out:
    print(out)
if err:
    print("STDERR:", err)
