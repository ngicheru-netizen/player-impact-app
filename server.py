from dotenv import load_dotenv
from http.server import HTTPServer
from http.server import BaseHTTPRequestHandler
import json
import os
from urllib.parse import urlparse
from urllib.parse import parse_qs
import requests

load_dotenv()
api_key = os.getenv("FOOTBALL_KEY")


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        query = url.query
        params = parse_qs(query)

        if "player" not in params or "league" not in params or "season" not in params:
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Parameter not found"}).encode())
            return

        player = params["player"][0]
        league = params["league"][0]
        season = params["season"][0]

        if path not in {"/search", "/player", "/league", "/season"}:
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())
            return

        URL = f"https://v3.football.api-sports.io/players?league={league}&season={season}&search={player}"
        headers = {"x-apisports-key": api_key, "Accept": "application/json"}
        response_object = requests.get(URL, headers=headers)
        print(f"API Key: {api_key}")

        if response_object.status_code == 200:
            response = response_object.json()

            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-type", "application/json")
            self.end_headers()
            print(f"Data: {response}")
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(response_object.status_code)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Something went wrong"}).encode())

        print(response_object.text)


server = HTTPServer(("localhost", 8000), handler)
print("Server running at http://localhost:8000")
server.serve_forever()
