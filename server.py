from collections import OrderedDict
from dotenv import load_dotenv
from http.server import HTTPServer
from http.server import BaseHTTPRequestHandler
import json
import os
from urllib.parse import urlparse
from urllib.parse import parse_qs
import requests

cache_max = 100
cache = OrderedDict()

load_dotenv()
api_key = os.getenv("FOOTBALL_KEY")
if not api_key:
    raise SystemExit("FOOTBALL_KEY is not set - check .env file")
last_known_rate_limit = {
    "dailyLimit": None,
    "dailyRemaining": None,
    "minuteLimit": None,
    "minuteRemaining": None,
}


# helper function for keep last know API Limit value
def get_rate_limit_value(key, header_value):
    if header_value is not None:
        last_known_rate_limit[key] = header_value
        return header_value
    return last_known_rate_limit[key]


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        query = url.query
        params = parse_qs(query)

        if "player" not in params or "league" not in params or "season" not in params:
            self.send_json(
                404, {"error": "bad_request", "message": "Missing search parameters"}
            )

            return

        player = params["player"][0]
        league = params["league"][0]
        season = params["season"][0]

        if path not in {"/search", "/player", "/league", "/season"}:

            self.send_json(
                404, {"error": "bad_request", "message": "Endpoint not found"}
            )
            return

        key = (player.strip().lower(), league, season)

        # cache searched player to save on API requests
        if key in cache:
            cache.move_to_end(key)
            response = dict(cache[key])
            response["rateLimit"] = last_known_rate_limit
            response["cached"] = True
            self.send_json(200, response)

            return

        URL = f"https://v3.football.api-sports.io/players?league={league}&season={season}&search={player}"
        headers = {"x-apisports-key": api_key, "Accept": "application/json"}

        try:

            response_object = requests.get(URL, headers=headers, timeout=10)
        except requests.Timeout:
            self.send_json(
                504,
                {
                    "error": "upstream_timeout",
                    "message": "Football API is taking its sweet time to respond... Try again in a bit",
                    "rateLimit": last_known_rate_limit,
                },
            )
            return
        except requests.RequestException:
            self.send_json(
                502,
                {
                    "error": "upstream_unreachable",
                    "message": "Can't reach Football API; might be down. Do try again later.",
                    "rateLimit": last_known_rate_limit,
                },
            )
            return

        # keeps last known API limit value
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
        if response_object.status_code != 200:
            self.send_json(
                502,
                {
                    "error": "upstream_error",
                    "message": f"Football API returned {response_object.status_code} error. Try again later.",
                    "rateLimit": rate_limit_info,
                },
            )
            return

        response = response_object.json()
        api_errors = response.get("errors")

        if isinstance(api_errors, dict) and api_errors:
            if "requests" in api_errors or "rateLimit" in api_errors:
                code = "quota_exhausted"
                message = "Daily Limit Reached - try again tomorrow. "
            elif "token" in api_errors:
                code = "bad_key"
                message = "Invalid API Key - check your server config"
            else:
                code = "api_error"
                message = " ".join(str(v) for v in api_errors.values())

            self.send_json(
                200,
                {
                    "error": code,
                    "message": message,
                    "rateLimit": rate_limit_info,
                },
            )
            return

        cache[key] = dict(response)
        cache.move_to_end(key)
        if len(cache) > cache_max:
            cache.popitem(last=False)

        response["rateLimit"] = rate_limit_info
        self.send_json(200, response)

        print(response_object.text)


server = HTTPServer(("localhost", 8000), handler)
print("Server running at http://localhost:8000")
server.serve_forever()
