#!/bin/bash
cd /home/dan/dev/timekeep || { echo "Error: Directory not found"; exit 1; }

# Load NVM properly (this is the key part for non-interactive shells)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Optional: force the correct Node version if you have .nvmrc
# nvm use --silent

echo "=== Running pagedeploy at $(date) ==="
echo "=== pagedeploy started at $(date) ===" >> /home/dan/deploy.log
pnpm pagedeploy >> /home/dan/deploy.log 2>&1
echo "=== pagedeploy finished at $(date) ===" >> /home/dan/deploy.log
