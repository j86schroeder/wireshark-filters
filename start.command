#!/bin/zsh
cd "$(dirname "$0")"
PORT="${PORT:-8787}"

echo "Starting Wireshark Filters..."
echo "Open: http://localhost:$PORT"
open "http://localhost:$PORT"
python3 -m http.server "$PORT"
