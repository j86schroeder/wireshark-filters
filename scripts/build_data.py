#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
items = json.loads((ROOT / "data" / "filters.json").read_text(encoding="utf-8"))
(ROOT / "data" / "filters.js").write_text(
    "window.WIRESHARK_FILTERS = " + json.dumps(items, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
print(f"Built data/filters.js with {len(items)} entries.")
