#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load config
source "$SCRIPT_DIR/.env.deploy"

echo "=== Quick deploy Wordsy to $PI_USER@$PI_HOST ==="

rsync -avz --delete \
    --exclude='deployment' \
    --exclude='.claude' \
    --exclude='.git' \
    --exclude='.DS_Store' \
    "$PROJECT_DIR/" "$PI_USER@$PI_HOST:~/$DEPLOY_DIR/site/"

echo ""
echo "=== Quick deploy complete! ==="
echo "Site: https://$DOMAIN"
