#!/usr/bin/env python3
"""
GPS Sequence - Lokalni strežnik za pregledovanje meritev.
Bere neposredno iz uporabnikovega Google Drive (G:\\Moj disk\\gps_tracks)
ter servira spletni pregledovalnik na http://localhost:8050.
"""

import os
import sys
import json
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8050
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Pot do Google Drive mape z meritvami
GDRIVE_DIR = r"G:\Moj disk\gps_tracks"
FALLBACK_DIR = os.path.join(SCRIPT_DIR, "tracks")

def get_tracks_dir():
    if os.path.exists(GDRIVE_DIR):
        return GDRIVE_DIR
    if not os.path.exists(FALLBACK_DIR):
        os.makedirs(FALLBACK_DIR, exist_ok=True)
    return FALLBACK_DIR

class GpsViewerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SCRIPT_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/tracks":
            self.handle_api_tracks()
        elif path.startswith("/api/track/"):
            filename = urllib.parse.unquote(path[len("/api/track/"):])
            self.handle_api_track_file(filename)
        else:
            # Serviraj statične datoteke (index.html, style.css, viewer.js)
            super().do_GET()

    def handle_api_tracks(self):
        tracks_dir = get_tracks_dir()
        try:
            files = [f for f in os.listdir(tracks_dir) if (f.endswith(".jsonl") or f.endswith(".json")) and not f.startswith(".")]
            files.sort(reverse=True) # Najnovejši najprej
            result = ["__ALL__"] + files if len(files) > 0 else []
            data = json.dumps(result).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))

    def handle_api_track_file(self, filename):
        tracks_dir = get_tracks_dir()

        if filename in ("__ALL__", "ALL", "all"):
            try:
                files = [f for f in os.listdir(tracks_dir) if (f.endswith(".jsonl") or f.endswith(".json")) and not f.startswith(".")]
                files.sort() # Kronološki vrstni red po datumu datoteke
                points = []
                seen_times = set()
                for fname in files:
                    fpath = os.path.join(tracks_dir, fname)
                    with open(fpath, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line:
                                try:
                                    p = json.loads(line)
                                    t = p.get("time_ms")
                                    if t and t not in seen_times:
                                        seen_times.add(t)
                                        points.append(p)
                                except Exception:
                                    pass
                points.sort(key=lambda x: x.get("time_ms", 0))
                data = json.dumps(points).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        filepath = os.path.join(tracks_dir, filename)

        if not os.path.exists(filepath):
            self.send_error(404, "Datoteka ne obstaja")
            return

        try:
            points = []
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            points.append(json.loads(line))
                        except Exception:
                            pass

            data = json.dumps(points).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))

def run_server():
    server_address = ("127.0.0.1", PORT)
    try:
        httpd = HTTPServer(server_address, GpsViewerHandler)
    except OSError as e:
        print(f"Strežnik že teče na portu {PORT} ali je port zaseden ({e}).")
        return

    tracks_dir = get_tracks_dir()
    print(f"==================================================")
    print(f"  GPS Sequence Pregledovalnik zagnan!")
    print(f"  Odpri v brskalniku: http://localhost:{PORT}")
    print(f"  Mapa meritev: {tracks_dir}")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStrežnik zaustavljen.")

if __name__ == "__main__":
    run_server()
