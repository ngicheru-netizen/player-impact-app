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
last_known_rate_limit = {
    "dailyLimit": None,
    "dailyRemaining": None,
    "minuteLimit": None,
    "minuteRemaining": None,
}


def get_rate_limit_value(key, header_value):
    if header_value is not None:
        last_known_rate_limit[key] = header_value
        return header_value
    return last_known_rate_limit[key]


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
            self.wfile.write(json.dumps({"errors": "Parameter not found"}).encode())
            return

        player = params["player"][0]
        league = params["league"][0]
        season = params["season"][0]

        if path not in {"/search", "/player", "/league", "/season"}:
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"errors": "Endpoint not found"}).encode())
            return

        URL = f"https://v3.football.api-sports.io/players?league={league}&season={season}&search={player}"
        headers = {"x-apisports-key": api_key, "Accept": "application/json"}
        response_object = requests.get(URL, headers=headers)

        rate_limit_info = {
            "dailyLimit": get_rate_limit_value(
                "dailyLimit", response_object.headers.get("x-ratelimit-requests-limit")
            ),
            "dailyRemaining": get_rate_limit_value(
                "dailyRemaining",
                response_object.headers.get("x-ratelimit-requests-remaining"),
            ),
            "minuteLimit": get_rate_limit_value(
                "minuteLimit", response_object.headers.get("x-ratelimit-limit")
            ),
            "minuteRemaining": get_rate_limit_value(
                "minuteRemaining", response_object.headers.get("x-ratelimit-remaining")
            ),
        }
        if response_object.status_code == 200:

            response = response_object.json()
            response["rateLimit"] = rate_limit_info

            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-type", "application/json")
            self.end_headers()
            print(f"Data: {response}")
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-type", "application/json")
            self.end_headers()
            error_response = {
                "errors": "Something went wrong",
                "rateLimit": rate_limit_info,
            }
            self.wfile.write(json.dumps(error_response).encode())

        print(response_object.text)


server = HTTPServer(("localhost", 8000), handler)
print("Server running at http://localhost:8000")
server.serve_forever()
