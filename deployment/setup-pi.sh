#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load config
source "$SCRIPT_DIR/.env.deploy"

echo "=== Setting up Wordsy on $PI_USER@$PI_HOST ==="

# Create directories
echo "--- Creating directories..."
ssh "$PI_USER@$PI_HOST" "mkdir -p ~/$DEPLOY_DIR/site ~/$DEPLOY_DIR/backups"

# Render the nginx config from the template, then upload it
echo "--- Rendering and uploading nginx config..."
RENDERED="$(mktemp)"
trap 'rm -f "$RENDERED"' EXIT
sed -e "s|\${DOMAIN}|$DOMAIN|g" \
    -e "s|\${PI_USER}|$PI_USER|g" \
    -e "s|\${DEPLOY_DIR}|$DEPLOY_DIR|g" \
    "$SCRIPT_DIR/conf/nginx.conf.template" > "$RENDERED"
scp "$RENDERED" "$PI_USER@$PI_HOST:/tmp/wordsy-nginx.conf"
ssh "$PI_USER@$PI_HOST" "
    sudo mv /tmp/wordsy-nginx.conf /etc/nginx/sites-available/$DOMAIN
    sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
"

# SSL certificate
echo "--- Setting up SSL certificate..."
echo "Run the following on the Pi if certificate doesn't exist yet:"
echo "  sudo certbot --nginx -d $DOMAIN"
echo ""

# Test and reload nginx
echo "--- Testing nginx config..."
ssh "$PI_USER@$PI_HOST" "
    sudo nginx -t && sudo systemctl reload nginx
"

echo ""
echo "=== Setup complete! ==="
echo "Now run: ./deployment/deploy.sh"
