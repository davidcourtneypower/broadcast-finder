# Adding New Sports to BroadcastFinder

The application has been designed with a centralized sports configuration system, making it easy to add new sports without modifying core logic.

## Quick Start

To add a new sport, you only need to update **two configuration files**:

1. **Frontend**: `src/config/sports.js`
2. **Backend**: `supabase/functions/fetch-fixtures/_shared/sports-config.ts`

## Step-by-Step Guide

### 1. Update Frontend Configuration

Edit `src/config/sports.js` and add your sport to the `SPORTS_CONFIG` object:

```javascript
export const SPORTS_CONFIG = {
  // ... existing sports ...

  Hockey: {
    name: 'Hockey',
    apiKey: 'hockey',              // API-Sports sport key
    apiVersion: 'v1',               // API version (check API-Sports docs)
    apiEndpoint: 'games',           // API endpoint name
    matchDuration: 150,             // Total match duration in minutes
    pregameWindow: 15,              // Minutes before match to show as "live"
    responseStructure: 'flat',      // 'flat' or 'nested' (see Response Structure section)
    colors: {
      accent: '#e63946',            // Primary color for UI elements
      bg: 'rgba(230,57,70,0.12)'    // Background color (with transparency)
    },
    statusCodes: {
      // Status codes from API that indicate live matches
      live: ['LIVE', 'P1', 'P2', 'P3', 'OT'],
      // Status codes that indicate finished matches
      finished: ['FT', 'AOT']
    },
    leagues: {
      // League ID: Popularity score (0-100)
      57: 95,   // NHL
      143: 85,  // KHL
    },
    leagueNameMatches: {
      // Optional: Pattern matching for leagues not in the ID map
      'nhl': 95,
      'khl': 85,
      'olympics': 90,
    },
    defaultPopularity: 60  // Default for leagues not in maps
  }
}
```

### 2. Update Backend Configuration

Edit `supabase/functions/fetch-fixtures/_shared/sports-config.ts` and add the same configuration:

```typescript
export const SPORTS_CONFIG: Record<string, SportConfig> = {
  // ... existing sports ...

  hockey: {
    name: 'Hockey',
    apiKey: 'hockey',
    apiVersion: 'v1',
    apiEndpoint: 'games',
    matchDuration: 150,
    pregameWindow: 15,
    responseStructure: 'flat', // 'flat' or 'nested'
    statusCodes: {
      live: ['LIVE', 'P1', 'P2', 'P3', 'OT'],
      finished: ['FT', 'AOT']
    },
    leagues: {
      57: 95,   // NHL
      143: 85,  // KHL
    },
    leagueNameMatches: {
      'nhl': 95,
      'khl': 85,
      'olympics': 90,
    },
    defaultPopularity: 60
  }
}
```

### 3. Add Icon (Optional)

If you want a custom icon for the sport, update `src/components/Icon.jsx`:

```javascript
const icons = {
  // ... existing icons ...
  hockey: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z", // Add SVG path
}
```

### 4. Deploy Changes

```bash
# Deploy updated Edge Functions
supabase functions deploy fetch-fixtures

# Restart your frontend (if running)
npm run dev
```

## Configuration Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name (capitalized) |
| `apiKey` | string | API-Sports sport identifier |
| `apiVersion` | string | API version (e.g., 'v1', 'v3') |
| `apiEndpoint` | string | Endpoint name ('fixtures', 'games', etc.) |
| `matchDuration` | number | Total match duration in minutes |
| `pregameWindow` | number | Minutes before start to mark as "live" |
| `responseStructure` | string | 'flat' or 'nested' (see Response Structure) |
| `colors.accent` | string | Primary UI color (hex or rgba) |
| `colors.bg` | string | Background color with transparency |
| `statusCodes.live` | string[] | API status codes for live matches |
| `statusCodes.finished` | string[] | API status codes for finished matches |
| `defaultPopularity` | number | Default popularity score (0-100) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `leagues` | object | Map of league ID to popularity score |
| `leagueNameMatches` | object | Pattern-based league popularity matching |

## Finding API Information

To configure a new sport, you need to know:

1. **API Sport Key**: Check [API-Sports documentation](https://www.api-sports.io/documentation)
2. **API Version**: Found in API-Sports docs (usually v1 or v3)
3. **Endpoint Name**: Either 'fixtures' or 'games' typically
4. **Status Codes**: Make a test API call and check the `status.short` field values
5. **League IDs**: Make a test API call to see league IDs and names

Example API-Sports endpoint to test:
```
https://v1.SPORT.api-sports.io/games?date=2026-02-04
```

## Response Structure Differences

The application handles two main API response structures via the `responseStructure` field:

### Nested Structure (`responseStructure: 'nested'`)
Used by Football and some other sports. Data is nested under a `fixture` object:

```json
{
  "fixture": {
    "id": 123,
    "date": "2026-02-04T15:00:00+00:00",
    "status": { "short": "FT" }
  },
  "league": { "name": "..." },
  "teams": { "home": {...}, "away": {...} }
}
```

**Sports using nested structure**: Football

### Flat Structure (`responseStructure: 'flat'`)
Used by Basketball and some other sports. Data is at the root level:

```json
{
  "id": 123,
  "date": "2026-02-04T15:00:00+00:00",
  "status": { "short": "FT" },
  "league": { "name": "..." },
  "teams": { "home": {...}, "away": {...} }
}
```

**Sports using flat structure**: Basketball

### How to Determine Your Sport's Structure

Make a test API call and check the response:
- If match data is in `response[0].fixture.*` → use `'nested'`
- If match data is in `response[0].*` directly → use `'flat'`

The transformer will automatically use the correct structure based on your config.

## Match Duration Guidelines

Choose appropriate match duration to ensure proper "live" status calculation:

- **Football**: 120 minutes (90 min + halftime + injury time)
- **Basketball**: 150 minutes (48 min + timeouts + halftime)
- **Hockey**: 150 minutes (60 min + intermissions + potential overtime)
- **Baseball**: 180 minutes (varies significantly)
- **Tennis**: 180 minutes (best of 3 sets average)

Add buffer time to account for delays, timeouts, and potential overtime.

## Testing Your New Sport

1. **Test API Connection**:
   ```bash
   curl -X POST "YOUR_PROJECT_URL/functions/v1/fetch-fixtures" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"sport":"hockey","dates":["today"],"trigger":"manual"}'
   ```

2. **Verify in UI**:
   - Check that the sport appears in the filter
   - Verify colors display correctly
   - Ensure matches show proper status
   - Test filtering by the new sport

3. **Check Status Calculation**:
   ```javascript
   // In browser console
   import { calculateMatchStatus } from './utils/helpers'
   calculateMatchStatus('2026-02-04', '15:00', 'Hockey')
   ```

## Common Issues

### Sport Not Appearing in Filter
- **Cause**: No matches exist for that sport in the database
- **Solution**: Fetch fixtures using the Edge Function first

### Wrong Status Codes
- **Cause**: API uses different codes than configured
- **Solution**: Make a test API call and update `statusCodes` in config

### Colors Not Showing
- **Cause**: Frontend config not updated or app not restarted
- **Solution**: Ensure both frontend and backend configs match, restart dev server

### API Errors
- **Cause**: Wrong API version, endpoint, or sport key
- **Solution**: Verify against API-Sports documentation

## Need Help?

- Check [API-Sports Documentation](https://www.api-sports.io/documentation)
- Review existing sport configurations in `sports.js` and `sports-config.ts`
- Test API responses directly before configuring

---

**Pro Tip**: Start by copying an existing sport's configuration and modifying it, rather than creating from scratch. This ensures you don't miss any required fields.
