# Supabase Configuration

This directory contains database migrations and Edge Functions for the SportsOnTV API integration.

## Structure

```
supabase/
├── migrations/
│   └── 20260204000001_api_integration.sql  # Database schema for API integration
└── functions/
    ├── fetch-fixtures/                     # Fetch fixtures from API-Sports.io
    │   ├── index.ts                        # Main function logic
    │   ├── deno.json                       # Deno configuration
    │   └── _shared/
    │       ├── api-sports-client.ts        # API client with 15s timeout
    │       └── transformers.ts             # Data transformation logic
    └── cleanup-old-data/                   # Daily cleanup of old data
        ├── index.ts                        # Cleanup logic
        └── deno.json                       # Deno configuration
```

## Database Migration

The migration creates:
- `api_fetch_logs` table: Tracks all fetch attempts, cleanups, and results
- Indexes for performance optimization

## Edge Functions

### fetch-fixtures

Fetches ALL fixtures for specified dates from API-Sports.io.

**Key Features:**
- 15-second timeout on API calls
- No league filtering (fetches all fixtures)
- Batch processing (100 matches per batch)
- Comprehensive error handling
- Logs all operations

**Request Body:**
```json
{
  "sport": "football",
  "dates": ["today", "tomorrow"],
  "trigger": "manual" | "scheduled"
}
```

**Response:**
```json
{
  "success": true,
  "status": "success" | "partial" | "error",
  "fetched": 310,
  "created": 0,
  "updated": 310,
  "errors": []  // Only if status is "partial" or "error"
}
```

### cleanup-old-data

Removes matches, broadcasts, and votes from before today.

**Response:**
```json
{
  "success": true,
  "deleted": {
    "matches": 150,
    "broadcasts": 45,
    "votes": 120
  }
}
```

## Local Development

### Prerequisites

Install Supabase CLI:
```bash
npm install -g supabase
```

### Initialize and Link

```bash
# Link to your project
supabase link --project-ref your-project-ref
```

### Apply Migrations

```bash
supabase db push
```

### Run Functions Locally

```bash
# Start local Supabase (includes functions)
supabase start

# Or serve functions only
supabase functions serve
```

### Test Functions

```bash
# Test fetch-fixtures
curl -X POST http://localhost:54321/functions/v1/fetch-fixtures \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sport":"football","dates":["today"],"trigger":"manual"}'

# Test cleanup
curl -X POST http://localhost:54321/functions/v1/cleanup-old-data \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Deployment

### Deploy Functions

```bash
# Deploy both functions
supabase functions deploy fetch-fixtures
supabase functions deploy cleanup-old-data
```

### Set Secrets

```bash
supabase secrets set API_SPORTS_KEY=your_key_here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key_here
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
```

## API-Sports.io Response Structure

The API returns fixtures in this format:

```json
{
  "get": "fixtures",
  "parameters": { "date": "2026-02-04" },
  "results": 310,
  "response": [
    {
      "fixture": {
        "id": 1501049,
        "date": "2026-02-04T15:00:00+00:00",
        "status": { "short": "NS" }
      },
      "league": {
        "id": 39,
        "name": "Premier League",
        "country": "England"
      },
      "teams": {
        "home": { "name": "Arsenal" },
        "away": { "name": "Chelsea" }
      }
    }
  ]
}
```

This is transformed to match the app's schema:

```javascript
{
  id: "api-1501049",
  sport: "Football",
  league: "Premier League",
  home: "Arsenal",
  away: "Chelsea",
  match_date: "2026-02-04",
  match_time: "15:00",
  country: "England",
  status: "upcoming",
  popularity: 95
}
```

## Logging

All operations are logged to `api_fetch_logs`:

| Field | Description |
|-------|-------------|
| fetch_type | 'scheduled', 'manual', 'cleanup' |
| sport | Sport being fetched |
| fetch_date | Date of operation |
| status | 'success', 'partial', 'error' |
| matches_fetched | Number of fixtures from API |
| matches_updated | Number of matches upserted to DB |
| error_message | Error details if any |
| api_response_time_ms | Total operation time |

## Troubleshooting

### Function Not Found

Ensure function is deployed:
```bash
supabase functions list
```

### Timeout Errors

The 15-second timeout is intentional to prevent hanging. If this occurs frequently:
- Check API-Sports.io status
- Consider breaking into smaller date ranges
- Review network connectivity

### Database Errors

Check migration applied:
```bash
supabase db diff
```

Apply if needed:
```bash
supabase db push
```
