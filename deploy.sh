#!/bin/bash
set -e
cd /opt/soulorangerie-platform

echo "=== Pulling latest changes ==="
git pull origin main

echo "=== Installing frontend dependencies ==="
npm install --legacy-peer-deps

echo "=== Building frontend ==="
npm run build

echo "=== Installing server dependencies ==="
cd server && npm install --production && cd ..

echo "=== Restarting API server ==="
pm2 restart soulorangerie-api

echo "=== Done! ==="
pm2 status
