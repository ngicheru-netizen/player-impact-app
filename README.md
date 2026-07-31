# Football Player Impact Analyzer

A vanilla-JavaScript web app that searches football players across Europe's top five leagues, displays their season stats, and computes a weighted **Impact Score (0–100)** tailored to each player's position. Built with no frameworks, backed by a small Python API proxy, and deployed behind a load balancer.

> ALU BSE Web Infrastructure summative.
> Nadiv Razzaq Gicheru
> Live Demo on Youtube : https://www.youtube.com/watch?v=2eqTHggqoIQ

---

## Features

- **Player search** by last name, league, and season, powered by [API-Football](https://www.api-football.com/).
- **Position-aware Impact Score** — attackers, midfielders, defenders, and **goalkeepers** are each scored on the stats that matter for their role.
- **Disambiguation picker** — searching a common name (e.g. "Fernandes") lists every match with photo, team, and position so you pick the right player instead of guessing.
- **Side-by-side comparison** — compare two players in a responsive two-column layout that widens to use the full screen.
- **Live API quota counter** — shows remaining daily and per-minute API requests in the corner.
- **Accessible feedback** — status messages via `aria-live`, honest error states (including a clear "API limit reached" message).
- Blurred full-screen stadium backdrop, smooth transitions, and an About page explaining the scoring.

---

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

---

## Credits

- Data: [API-Football](https://www.api-football.com/documentation-v3)
- Author: Nadiv Gicheru, 2026
