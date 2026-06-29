import json, subprocess, sys

payload = json.dumps({"wiki_path": "wiki/", "index_path": "wiki.md"})
r = subprocess.run(["python", "scripts/validate_document.py"], input=payload, capture_output=True, text=True)
result = json.loads(r.stdout.strip() or "{}")
print("Status:", result.get("status", "N/A"))
print("Errors:", len(result.get("errors", [])))
for e in result.get("errors", []):
    print("  -", e)
print("Warnings:", len(result.get("warnings", [])))
for w in result.get("warnings", []):
    print("  -", w)
print("Message:", result.get("message", ""))
sys.exit(0 if result.get("status") == "PASS" else 1)