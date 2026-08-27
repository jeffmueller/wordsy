#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load config
source "$SCRIPT_DIR/.env.deploy"

echo "=== Wordsy Status on $PI_USER@$PI_HOST ==="

# Check nginx
echo ""
echo "--- Nginx ---"
ssh "$PI_USER@$PI_HOST" "sudo systemctl status nginx --no-pager -l 2>&1 | head -5"

# Check site files
echo ""
echo "--- Site Files ---"
ssh "$PI_USER@$PI_HOST" "ls -la ~/$DEPLOY_DIR/site/ 2>/dev/null || echo 'No site files found'"

# Check backups
echo ""
echo "--- Backups ---"
ssh "$PI_USER@$PI_HOST" "ls -lh ~/$DEPLOY_DIR/backups/ 2>/dev/null || echo 'No backups found'"

# Check HTTPS
echo ""
echo "--- HTTPS Check ---"
curl -sI "https://$DOMAIN" 2>/dev/null | head -3 || echo "Could not reach https://$DOMAIN"
