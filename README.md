# Football Player Impact Analyzer

A vanilla-JavaScript web app that searches football players across Europe's top five leagues, displays their season stats, and computes a weighted **Impact Score (0–100)** tailored to each player's position. Built with no frameworks, backed by a small Python API proxy, and deployed behind a load balancer.

> Nadiv Razzaq Gicheru
> ALU BSE Web Infrastructure Summative.
> Live Demo on Youtube : https://www.youtube.com/watch?v=2eqTHggqoIQ

---

## Features

- **Player search** by last name, league, and season, powered by [API-Football](https://www.api-football.com/).
- **Position-aware Impact Score** — attackers, midfielders, defenders, and **goalkeepers** are each scored on the stats that matter for their role.
- **Disambiguation picker** — searching a common name (e.g. "Fernandes") lists every match with photo, team, and position so you pick the right player instead of guessing.
- **Side-by-side comparison** — compare two players in a responsive two-column layout that widens to use the full screen.
- **Live API quota counter** — shows remaining daily and per-minute API requests in the corner.
- **Response caching** — repeat searches are served from an in-memory cache, so they're instant and cost no API quota.
- **Accessible feedback** — status messages via `aria-live`, and specific error states that distinguish an API timeout, an unreachable API, an exhausted quota, and a rejected key from one another.
- Blurred full-screen stadium backdrop, smooth transitions, and an About page explaining the scoring.

---

## Limitations

Because I'm using a free-tier API from API-Football, there are limitations to
what data is available on the web-app. I decided that the app:

- Only tracks **one season at a time** (no multi-season history).
- Only supports **Europe's top five leagues** (Bundesliga, La Liga, Ligue 1,
  Premier League, Serie A).
- Only supports **3 seasons** (2022-23, 2023-24, 2024-25) — the free plan
  rejects anything earlier.

Beyond the plan itself, the current build has these known limits:

**Data**

- Search results are **capped at the API's first page** — a very common surname
  may have matches that never appear in the picker.
- Only a player's **first team entry** for the season is used, so a mid-season
  transfer shows just one half of the campaign.
- **Player, league and season are all required** — there's no cross-league
  search, so you need to know where a player played that year.
- Searches need **at least 3 characters** (an API restriction).

**The proxy**

- The **quota counter is per-server and in-memory**: with two web servers behind
  the load balancer, the figure shown depends on which one answered, and it
  resets whenever the service restarts.
- Responses are **cached in memory per server** (LRU, 100 entries), so a repeat
  search is instant and costs no quota — but each web server keeps its own
  cache, so the same search may still cost a request on the other one, and a
  service restart clears both.
- The proxy is **single-threaded**, so one in-flight upstream call blocks other
  users on that server until it finishes or hits its 10-second timeout.
- The endpoint is **read-only, unauthenticated and un-throttled** — anyone who
  can reach it can spend the daily quota.

**The Impact Score**

- Scores are **not normalised for minutes played**, so a squad player is judged
  against the same season ceilings as an ever-present starter.
- **Missing stats are treated as zero**; for goals conceded (a lower-is-better
  stat) that inflates a goalkeeper's score rather than marking it unknown.
- Ceilings are **hand-tuned constants**, identical across all five leagues and
  every season, rather than derived from real league distributions.

---

## Error handling

The proxy never lets an upstream failure reach the user as a blank screen or a
generic message. Every response is JSON with a machine-readable `error` code and
a human-readable `message`, and the front end renders the message directly:

| Situation                          | Code                   | HTTP |
| ---------------------------------- | ---------------------- | ---- |
| API-Football didn't respond in 10s | `upstream_timeout`     | 504  |
| API-Football unreachable           | `upstream_unreachable` | 502  |
| API-Football returned a bad status | `upstream_error`       | 502  |
| Daily quota exhausted              | `quota_exhausted`      | 200  |
| API key rejected                   | `bad_key`              | 200  |
| Season/plan restriction, etc.      | `api_error`            | 200  |
| Missing params / unknown endpoint  | `bad_request`          | 404  |

The last three arrive as HTTP 200 because API-Football signals them in the body
rather than the status code. A missing `FOOTBALL_KEY` is caught at **startup** —
the service refuses to boot rather than failing on every request.

## How the Impact Score works

For a player's position, each tracked stat is compared to a realistic season **ceiling**, capped at 100%, then combined using per-position **weights** that sum to 1.0:

```
score = Σ ( min(stat / ceiling, 1) × weight )   → rounded to 0–100
```

- **Attacker** — goals, assists, successful dribbles
- **Midfielder** — goals, assists, key passes, total passes
- **Defender** — tackles, interceptions, total passes
- **Goalkeeper** — saves, goals conceded, passes

Goals conceded is a "lower is better" stat, so it's **inverted** (`1 − ratio`) before weighting. The result is shown as a colored bar (green ≥ 70, orange ≥ 40, red below) with a per-stat breakdown.

---

## Tech stack

| Layer         | Tech                                                |
| ------------- | --------------------------------------------------- |
| Front end     | HTML, CSS, vanilla JS (no frameworks)               |
| API proxy     | Python (`http.server`, `requests`, `python-dotenv`) |
| Web server    | Nginx                                               |
| Load balancer | HAProxy                                             |
| Data          | API-Football v3                                     |

---

## Project structure

```
player-impact-app/
├── index.html          # main app (search + compare)
├── about.html          # About / scoring explanation
├── script.js           # all front-end logic
├── style.css           # styles + design tokens
├── server.py           # API proxy (does not serve HTML)
├── assets/             # background image, favicon
├── update-files.sh     # deploy: scp files to both servers + restart
├── systemd-config.sh   # provisions the systemd service
└── .env                # FOOTBALL_KEY (gitignored — never commit)
```

---

## Running locally

**1. Install the proxy's dependencies** (a virtualenv is recommended):

```bash
python3 -m venv venv
source venv/bin/activate
pip install requests python-dotenv
```

**2. Add your API key** in a `.env` file beside `server.py`:

```
FOOTBALL_KEY=your_api_football_key_here
```

**3. Start the API proxy** (listens on `localhost:8000`):

```bash
python server.py
```

**4. Serve the front end** separately — open `index.html` with VS Code **Live Server** (port 5500) or any static server. The app auto-detects local mode and points API calls at `localhost:8000`.

---

## Deployment (production)

The app runs across **two web servers** (web-01, web-02), each with Nginx, behind an **HAProxy** load balancer.

**Request flow:** `browser → HAProxy → Nginx → server.py`

- Nginx serves the static files (`root`) and **reverse-proxies `/search`** to the local proxy:
  ```nginx
  location /search {
      proxy_pass http://127.0.0.1:8000;
  }
  ```
- `server.py` runs as a **systemd service** (`player-impact`) so it survives crashes and reboots. Its `ExecStart` uses the **virtualenv** Python. It binds to `localhost` — only Nginx (same box) reaches it; port 8000 is never public.
- In production the front end uses a same-origin `API_BASE` (`""`), so `/search` goes through the load balancer to whichever web server answers.

**Deploy an update to both servers:**

```bash
./update-files.sh
```

This `scp`s the changed files (and `assets/`) to both hosts and restarts the service. Static-only changes (HTML/CSS/JS) don't strictly need the restart — only `server.py` changes do.

**Rotating the API key.** `update-files.sh` deliberately does **not** copy `.env` — it's gitignored and lives per-host. A key change means editing `/var/www/player-impact-app/.env` on each server and restarting:

```bash
sudo systemctl restart player-impact
```

The key is read once at startup, so editing `.env` without a restart has no effect. If the service won't come up afterwards, `journalctl -u player-impact` will say so directly.

---

## Credits

- Data: [API-Football](https://www.api-football.com/documentation-v3)
- Background image (`assets/football-stadium.jpg`): https://www.unsplash.com
- Favicon (`assets/favicon-32x32.png`): https://favicon.io/emoji-favicons/soccer-ball/
- Author: Nadiv Gicheru, 2026
