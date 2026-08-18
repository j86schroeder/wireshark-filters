#!/usr/bin/env python3
from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parents[1]
items = json.loads((ROOT / "data" / "filters.json").read_text(encoding="utf-8"))
required = {"mode", "category", "title", "code", "description", "tags"}
allowed_modes = {"display", "capture", "recipes"}
errors = []
seen = set()

for i, item in enumerate(items, 1):
    missing = required - set(item)
    if missing:
        errors.append(f"#{i}: missing {sorted(missing)}")
        continue
    if item["mode"] not in allowed_modes:
        errors.append(f"#{i}: invalid mode {item['mode']!r}")
    for field in ("category", "title", "code", "description"):
        if not isinstance(item[field], str) or not item[field].strip():
            errors.append(f"#{i}: {field} must be a non-empty string")
    if not isinstance(item["tags"], list):
        errors.append(f"#{i}: tags must be a list")
    key = (item["mode"], item["category"], item["title"], item["code"])
    if key in seen:
        errors.append(f"#{i}: duplicate entry")
    seen.add(key)

expected = "window.WIRESHARK_FILTERS = " + json.dumps(items, ensure_ascii=False, separators=(",", ":")) + ";\n"
js_path = ROOT / "data" / "filters.js"
if not js_path.exists() or js_path.read_text(encoding="utf-8") != expected:
    errors.append("data/filters.js is stale; run python3 scripts/build_data.py")

if errors:
    print("\n".join(errors))
    sys.exit(1)

counts = {}
for item in items:
    counts[item["mode"]] = counts.get(item["mode"], 0) + 1
print(f"OK: {len(items)} entries — " + ", ".join(f"{k}={v}" for k,v in sorted(counts.items())))
