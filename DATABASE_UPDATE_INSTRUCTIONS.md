# Database Update Instructions

## ⚠️ Important Database Changes Required

To support basketball and the updated status system, your database schema needs to be updated.

---

## What Changed

### 1. **Status Values** (CRITICAL)
- **Old**: `"live"` or `null`
- **New**: `"upcoming"`, `"live"`, `"finished"`
- The migration will update all existing null or invalid statuses to `"upcoming"`

### 2. **Sport Support**
- Database now properly indexes sport column for faster filtering
- Supports multiple sports (Football, Basketball, and future additions)

### 3. **New Indexes**
- Added indexes for better query performance on:
  - `sport`
  - `match_date`
  - `status`
  - Composite index on `(sport, match_date, status)`

---

## How to Apply the Migration

### Option 1: Using Supabase CLI (Recommended)

```bash
# 1. Navigate to your project directory
cd f:\Projects\broadcast-finder

# 2. Link to your Supabase project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# 3. Push the migration to your database
supabase db push

# 4. Verify the migration was applied
supabase db remote show
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Open the migration file: `supabase/migrations/20260204000001_basketball_support.sql`
5. Copy and paste the entire SQL content
6. Click **Run** to execute

### Option 3: Direct SQL Execution

If you have direct database access:

```bash
psql YOUR_DATABASE_URL -f supabase/migrations/20260204000001_basketball_support.sql
```

---

## Verification Checklist

After applying the migration, verify:

- [ ] Matches table exists with all required columns
- [ ] Status column accepts "upcoming", "live", "finished"
- [ ] Sport column accepts "Football", "Basketball"
- [ ] All indexes are created (check with `\d matches` in psql)
- [ ] api_fetch_logs table exists
- [ ] broadcasts table exists with foreign key to matches
- [ ] votes table exists with foreign key to broadcasts
- [ ] Existing data has valid status values (no nulls)

---

## Testing

After migration, test with:

```bash
# Test football fetch
curl -X POST "YOUR_PROJECT_URL/functions/v1/fetch-fixtures" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sport":"football","dates":["today"],"trigger":"manual"}'

# Test basketball fetch
curl -X POST "YOUR_PROJECT_URL/functions/v1/fetch-fixtures" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sport":"basketball","dates":["today"],"trigger":"manual"}'
```

Both should return success and log to the database.

---

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Remove new indexes
DROP INDEX IF EXISTS idx_matches_sport;
DROP INDEX IF EXISTS idx_matches_date;
DROP INDEX IF EXISTS idx_matches_status;
DROP INDEX IF EXISTS idx_matches_sport_date_status;
DROP INDEX IF EXISTS idx_api_fetch_logs_sport;
DROP INDEX IF EXISTS idx_api_fetch_logs_date;
DROP INDEX IF EXISTS idx_broadcasts_match_id;
DROP INDEX IF EXISTS idx_votes_broadcast_id;
DROP INDEX IF EXISTS idx_votes_user_id;

-- Note: Do NOT drop tables or change status values back
-- as this would lose data
```

---

## Common Issues

### Issue: "relation already exists"
**Solution**: This is normal - the migration uses `CREATE TABLE IF NOT EXISTS`. It's idempotent and safe to run multiple times.

### Issue: "column does not exist"
**Solution**: Your table structure may be different. Check your current schema:
```sql
\d matches
\d broadcasts
\d votes
\d api_fetch_logs
```

### Issue: Status values not updating
**Solution**: Run the UPDATE statement manually:
```sql
UPDATE matches
SET status = 'upcoming'
WHERE status IS NULL OR status NOT IN ('upcoming', 'live', 'finished');
```

---

## Next Steps

1. ✅ Apply the migration
2. ✅ Verify all checks pass
3. ✅ Test both football and basketball fetches
4. ✅ Check admin panel logs show correct sport values
5. ✅ Verify frontend displays both sports correctly

---

## Need Help?

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Verify Edge Functions are deployed: `supabase functions list`
3. Check database connection: `supabase db ping`
4. Review migration status: `supabase migration list`
