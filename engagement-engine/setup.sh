#!/bin/bash

echo "============================================================"
echo "TheHive Engagement Engine - Setup"
echo "============================================================"
echo ""

echo "[1/4] Installing dependencies..."
npm install

echo ""
echo "[2/4] Creating .env file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file - please edit it with your configuration"
else
    echo ".env already exists - skipping"
fi

echo ""
echo "[3/4] Building TypeScript..."
npm run build

echo ""
echo "[4/4] Setup complete!"
echo ""
echo "============================================================"
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Ensure AGENTS_FILE points to seeded-agents.json"
echo "3. Run: npm start"
echo "============================================================"
