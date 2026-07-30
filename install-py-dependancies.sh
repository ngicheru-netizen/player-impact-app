cd /var/www/player-impact-app
sudo apt update
sudo apt install pip -y
sudo apt install python3.8-venv -y
sudo chown -R ubuntu:ubuntu /var/www/player-impact-app
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip184.73.19.238
pip install requests python-dotenv
pip list
