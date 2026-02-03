#!/bin/bash

# Setup Cron Jobs for TheHive Recurring Events
# This script helps set up cron jobs for automatic event generation

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON_LOG="/var/log/thehive-events.log"

echo "TheHive - Recurring Events Cron Setup"
echo "======================================"
echo ""
echo "Project root: $PROJECT_ROOT"
echo "Log file: $CRON_LOG"
echo ""

# Check if running as root (needed for crontab on some systems)
if [ "$EUID" -eq 0 ]; then
  echo "Warning: Running as root. Cron jobs will run as root user."
  echo "Consider running as the application user instead."
  echo ""
fi

# Show current crontab
echo "Current crontab entries:"
crontab -l 2>/dev/null | grep -i "thehive\|weekly-events" || echo "  (no existing entries)"
echo ""

# Prepare cron entries
CRON_ENTRY_GENERATE="0 23 * * 0 cd $PROJECT_ROOT && npm run events:generate >> $CRON_LOG 2>&1"
CRON_ENTRY_UPDATE="0 * * * * cd $PROJECT_ROOT && npm run events:generate >> $CRON_LOG 2>&1"

echo "Proposed cron jobs:"
echo ""
echo "1. Generate weekly events (Every Sunday at 11:00 PM):"
echo "   $CRON_ENTRY_GENERATE"
echo ""
echo "2. Update event statuses (Every hour):"
echo "   $CRON_ENTRY_UPDATE"
echo ""

read -p "Do you want to add these cron jobs? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  # Backup existing crontab
  crontab -l > /tmp/crontab.backup 2>/dev/null || touch /tmp/crontab.backup

  # Add new entries
  (crontab -l 2>/dev/null; echo "# TheHive Weekly Events"; echo "$CRON_ENTRY_GENERATE"; echo "$CRON_ENTRY_UPDATE") | crontab -

  echo "Cron jobs added successfully!"
  echo ""
  echo "To view cron jobs: crontab -l"
  echo "To edit cron jobs: crontab -e"
  echo "To remove cron jobs: crontab -r"
  echo "To view logs: tail -f $CRON_LOG"
  echo ""
  echo "Note: Ensure Node.js and npm are in the cron PATH."
  echo "If jobs fail, you may need to use absolute paths to node/npm."
else
  echo "Setup cancelled. You can manually add these entries with: crontab -e"
fi

echo ""
echo "Alternative: Use the npm script manually"
echo "  npm run events:generate"
