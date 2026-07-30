#!/bin/bash
#Update static and config files to web-01 and web-02
set -e

KEY=/Users/nadivgicheru/.ssh/intranet-webserver
DEST=/var/www/player-impact-app

for host in 184.73.19.238 35.175.218.108; do
  echo "=== $host ==="
  for f in index.html script.js style.css server.py; do
    scp -i "$KEY" "$f" ubuntu@"$host":"$DEST/$f"
  done
    scp -r -i "$KEY" assets ubuntu@"$host":"$DEST/"     # ← the folder
  ssh -i "$KEY" ubuntu@"$host" "sudo systemctl restart player-impact"
done

