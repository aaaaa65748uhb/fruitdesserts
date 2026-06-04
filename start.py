#!/usr/bin/env python3
"""
FridgeTok — הפעלת שרת מקומי
מפעיל שרת HTTP על פורט 8080 ופותח את האתר בדפדפן.
"""
import http.server, webbrowser, threading, os, sys

PORT = 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def open_browser():
    webbrowser.open(f"http://localhost:{PORT}/index-standalone.html")

print(f"🧊 FridgeTok מופעל על http://localhost:{PORT}/index-standalone.html")
print("לסיום: Ctrl+C")

threading.Timer(1.0, open_browser).start()
try:
    http.server.test(
        HandlerClass=http.server.SimpleHTTPRequestHandler,
        port=PORT,
        bind="localhost"
    )
except KeyboardInterrupt:
    print("\nשרת הופסק.")
    sys.exit(0)
