# Contributing

Corrections and useful additions are welcome.

1. Edit `data/filters.json`.
2. Keep display-filter and capture-filter syntax in the correct mode.
3. Prefer concise descriptions that explain what the filter surfaces.
4. Run:

```bash
python3 scripts/build_data.py
python3 scripts/validate_filters.py
```

5. Test `index.html` locally.

For syntax corrections, cite the relevant official Wireshark documentation in the pull request.
