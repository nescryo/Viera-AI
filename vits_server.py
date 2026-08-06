#!/usr/bin/env python3
"""
Viera 3D — Local VITS Anime Voice Server Bridge
Runs on http://localhost:5000/tts with zero external pip dependencies using Python standard library.
"""

import sys
import os
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import subprocess
import tempfile

class VitsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/tts':
            query = urllib.parse.parse_qs(parsed.query)
            text = query.get('text', ['Hello'])[0]
            character = query.get('character', ['Firefly'])[0]

            print(f"[Local VITS Server] Generating Japanese/Anime Voice for {character}: {text}")

            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp_file:
                tmp_path = tmp_file.name

            try:
                try:
                    cmd = ["edge-tts", "--voice", "ja-JP-NanamiNeural", "--text", text, "--write-media", tmp_path]
                    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    
                    if res.returncode != 0:
                        cmd = ["edge-tts", "--voice", "en-US-AnaNeural", "--text", text, "--write-media", tmp_path]
                        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                except FileNotFoundError:
                    print("[Local VITS Server Warning] edge-tts binary not found in PATH.")

                if os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 0:
                    with open(tmp_path, 'rb') as f:
                        audio_data = f.read()

                    self.send_response(200)
                    self.send_header('Content-Type', 'audio/mpeg')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Length', str(len(audio_data)))
                    self.end_headers()
                    self.wfile.write(audio_data)
                else:
                    self.send_error(500, "Failed to generate audio: edge-tts CLI missing or execution failed")
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
        else:
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b"Viera Local VITS Voice Server Online!")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

def run_server():
    server_address = ('localhost', 5000)
    httpd = ThreadingHTTPServer(server_address, VitsHandler)
    print("=====================================================")
    print("🚀 Viera Local VITS Anime Voice Server Running (Threaded)!")
    print("📍 URL: http://localhost:5000/tts")
    print("=====================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping VITS Server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
