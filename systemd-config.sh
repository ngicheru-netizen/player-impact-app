set -e
sudo tee /etc/systemd/system/player-impact.service > /dev/null << 'EOF'
[Unit]
Description=Player Impact API proxy
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/player-impact-app
ExecStart=/var/www/player-impact-app/venv/bin/python /var/www/player-impact-app/server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable player-impact
sudo systemctl start player-impact
sudo systemctl status player-impact