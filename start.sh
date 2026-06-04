#!/bin/bash
cd "$(dirname "$0")"
echo "🧊 FridgeTok מופעל על http://localhost:8080/index-standalone.html"
(sleep 1 && open "http://localhost:8080/index-standalone.html" 2>/dev/null || xdg-open "http://localhost:8080/index-standalone.html" 2>/dev/null) &
python3 -m http.server 8080
