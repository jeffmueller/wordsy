#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load config
source "$SCRIPT_DIR/.env.deploy"

echo "=== Deploying Wordsy to $PI_USER@$PI_HOST ==="

# Create tarball of site files
echo "--- Packaging site files..."
cd "$PROJECT_DIR"
tar czf /tmp/wordsy-site.tar.gz \
    --exclude='deployment' \
    --exclude='.claude' \
    --exclude='.git' \
    --exclude='.DS_Store' \
    .

# Ensure remote directory exists
echo "--- Setting up remote directories..."
ssh "$PI_USER@$PI_HOST" "mkdir -p ~/$DEPLOY_DIR/site ~/$DEPLOY_DIR/backups"

# Backup current version
echo "--- Backing up current version..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ssh "$PI_USER@$PI_HOST" "
    if [ -d ~/$DEPLOY_DIR/site ] && [ \"\$(ls -A ~/$DEPLOY_DIR/site 2>/dev/null)\" ]; then
        tar czf ~/$DEPLOY_DIR/backups/backup-$TIMESTAMP.tar.gz -C ~/$DEPLOY_DIR/site .
        # Keep only 5 most recent backups
        cd ~/$DEPLOY_DIR/backups && ls -t backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm
    fi
"

# Upload and extract
echo "--- Uploading site files..."
scp /tmp/wordsy-site.tar.gz "$PI_USER@$PI_HOST:/tmp/"
ssh "$PI_USER@$PI_HOST" "
    rm -rf ~/$DEPLOY_DIR/site/*
    tar xzf /tmp/wordsy-site.tar.gz -C ~/$DEPLOY_DIR/site
    rm /tmp/wordsy-site.tar.gz
"
rm /tmp/wordsy-site.tar.gz

echo ""
echo "=== Deployment complete! ==="
echo "Site: https://$DOMAIN"
