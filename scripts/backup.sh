#!/bin/bash
# Pepper Tracker — Supabase nightly backup
# Exports campaigns, projects, and suppliers to timestamped JSON files

SUPABASE_URL="https://wjyylacwtnnveteksbrs.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqeXlsYWN3dG5udmV0ZWtzYnJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDMxMjQ1MSwiZXhwIjoyMDg5ODg4NDUxfQ.yzHnzPzRibSAW_IWkZjWKW5goOUr3a7Vr8L0jsbWr_U"
BACKUP_DIR="$HOME/Projects/pepper-tracker/backups"
DATE=$(date +%Y-%m-%d)

mkdir -p "$BACKUP_DIR"

echo "[$DATE] Starting Pepper Tracker backup..."

for TABLE in campaigns projects suppliers; do
  OUT="$BACKUP_DIR/${DATE}_${TABLE}.json"
  curl -s \
    "$SUPABASE_URL/rest/v1/$TABLE?limit=10000" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -o "$OUT"
  COUNT=$(python3 -c "import json,sys; d=json.load(open('$OUT')); print(len(d))" 2>/dev/null || echo "?")
  echo "  ✓ $TABLE: $COUNT rows → $OUT"
done

# Clean up backups older than 30 days
find "$BACKUP_DIR" -name "*.json" -mtime +30 -delete
echo "[$DATE] Backup complete."
