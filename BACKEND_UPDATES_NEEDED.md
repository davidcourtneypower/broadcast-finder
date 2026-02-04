# Backend Updates Needed for Basketball Support

This document outlines the **critical backend/Supabase updates** required to fully support basketball alongside football in the BroadcastFinder application.

## Overview

The frontend has been updated to support both sports, but the **Supabase Edge Functions** still have hardcoded football references that need to be made dynamic.

---

## Critical Updates Required

### 1. API Client Configuration (`supabase/functions/fetch-fixtures/_shared/api-sports-client.ts`)

**Current Issue:**
- Lines 3 & 22: Hardcoded football API endpoint
```typescript
const baseUrl = 'https://v3.football.api-sports.io'
'x-rapidapi-host': 'v3.football.api-sports.io'
```

**Required Fix:**
Make the API endpoint dynamic based on the sport parameter:

```typescript
function getApiConfig(sport: string) {
  const configs = {
    football: {
      baseUrl: 'https://v3.football.api-sports.io',
      host: 'v3.football.api-sports.io'
    },
    basketball: {
      baseUrl: 'https://v1.basketball.api-sports.io',
      host: 'v1.basketball.api-sports.io'
    }
  }

  return configs[sport] || configs.football
}

// Then use:
const config = getApiConfig(sport)
const response = await fetch(`${config.baseUrl}/games?date=${date}`, {
  headers: {
    'x-rapidapi-host': config.host,
    ...
  }
})
```

---

### 2. Data Transformer (`supabase/functions/fetch-fixtures/_shared/transformers.ts`)

**Current Issue:**
- Line 4: Always sets sport to 'Football' regardless of API response
```typescript
sport: 'Football',
```

**Required Fix:**
Make sport dynamic based on the source API or pass it as a parameter:

```typescript
export function transformFixture(fixture: any, sport: string) {
  return {
    id: `${sport.toLowerCase()}-${fixture.id}`,
    sport: sport.charAt(0).toUpperCase() + sport.slice(1), // Capitalize first letter
    league: fixture.league.name,
    home: fixture.teams.home.name,
    away: fixture.teams.away.name,
    date: fixture.date.split('T')[0],
    time: fixture.time || fixture.date.split('T')[1]?.substring(0, 5) || '00:00',
    country: fixture.country?.name || fixture.league?.country || 'Global',
    status: determineStatus(fixture.status),
    popularity: calculatePopularity(fixture, sport)
  }
}
```

**Note:** Basketball API uses `games` endpoint instead of `fixtures`, so you may need separate transformers or conditional logic:

```typescript
export function transformFixtures(apiResponse: any, sport: string) {
  const data = sport === 'basketball' ? apiResponse.response : apiResponse.response
  return data.map(item => transformFixture(item, sport))
}
```

---

### 3. Main Function Handler (`supabase/functions/fetch-fixtures/index.ts`)

**Current Issues:**

**Line 8:** Default parameter should be explicit
```typescript
const { sport = 'football', dates = ['today', 'tomorrow'], trigger = 'manual' } = await req.json();
```
✅ This is actually fine, just ensure it's being used correctly throughout.

**Line 111:** Error logging hardcodes 'football'
```typescript
sport: 'football',  // In catch block
```

**Required Fix:**
Use the actual sport parameter in error logging:

```typescript
catch (error) {
  await logFetch({
    sport: sport,  // Use the actual sport parameter
    fetch_type: trigger,
    fetch_date: dates[0],
    status: 'error',
    error_message: error.message,
    // ...
  })
}
```

---

### 4. Popularity Calculation

**New Requirement:**
The `calculatePopularity` function needs to handle basketball leagues differently:

```typescript
function calculatePopularity(fixture: any, sport: string): number {
  if (sport === 'basketball') {
    const leagueName = fixture.league.name.toLowerCase()

    if (leagueName.includes('nba') && !leagueName.includes('g league')) {
      return 95
    } else if (leagueName.includes('euroleague')) {
      return 85
    } else if (leagueName.includes('eurocup')) {
      return 75
    } else if (leagueName.includes('ncaa')) {
      return 80
    } else if (leagueName.includes('fiba')) {
      return 75
    } else if (leagueName.includes('olympics') || leagueName.includes('world cup')) {
      return 90
    }
    return 50 // Default for basketball
  }

  // Football logic (existing)
  if (sport === 'football') {
    const leagueName = fixture.league.name.toLowerCase()

    if (leagueName.includes('premier league')) return 95
    if (leagueName.includes('champions league')) return 98
    // ... existing football logic
  }

  return 50 // Default
}
```

---

### 5. Status Determination

**New Requirement:**
Basketball has different status codes than football:

```typescript
function determineStatus(status: any, sport: string): string {
  if (sport === 'basketball') {
    // Basketball status codes: FT, LIVE, Q1, Q2, Q3, Q4, OT, HT, etc.
    const shortStatus = status.short
    if (['LIVE', 'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT'].includes(shortStatus)) {
      return 'live'
    } else if (['FT', 'AOT'].includes(shortStatus)) {
      return 'finished'
    }
    return 'upcoming'
  }

  // Football logic (existing)
  if (sport === 'football') {
    const shortStatus = status.short
    if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(shortStatus)) {
      return 'live'
    } else if (['FT', 'AET', 'PEN'].includes(shortStatus)) {
      return 'finished'
    }
    return 'upcoming'
  }

  return 'upcoming'
}
```

---

## Testing Checklist

After implementing these changes, test:

- [ ] Fetch football fixtures from API (manual trigger from admin panel)
- [ ] Fetch basketball fixtures from API (manual trigger from admin panel)
- [ ] Verify football data transforms correctly
- [ ] Verify basketball data transforms correctly
- [ ] Check that status values are correct for both sports
- [ ] Verify popularity calculations for both sports
- [ ] Test scheduled fetches via GitHub Actions
- [ ] Check error logging captures the correct sport
- [ ] Verify database logs show correct sport values

---

## Environment Variables

Ensure you have API keys configured for both APIs in your Supabase Edge Function secrets:

```bash
# Football API
FOOTBALL_API_KEY=your_football_api_key

# Basketball API (may use same RapidAPI key)
BASKETBALL_API_KEY=your_basketball_api_key

# Or if using the same key for both:
API_SPORTS_KEY=your_unified_api_key
```

---

## API Endpoint Differences

### Football API
- Base URL: `https://v3.football.api-sports.io`
- Endpoint: `/fixtures?date=YYYY-MM-DD`
- Response structure: `{ response: [...fixtures] }`

### Basketball API
- Base URL: `https://v1.basketball.api-sports.io`
- Endpoint: `/games?date=YYYY-MM-DD`
- Response structure: `{ response: [...games] }`

**Note:** The structure is very similar, but terminology differs (fixtures vs games).

---

## Priority

🔴 **CRITICAL** - These updates are required for basketball support to work properly with the fetch functionality. Without these changes:
- Basketball fetches will fail or return football data
- Data will be incorrectly tagged as "Football"
- API calls will go to the wrong endpoint
- Errors will be logged incorrectly

---

## Additional Notes

1. **Type Safety**: Consider adding TypeScript types for both sport responses
2. **Rate Limiting**: Each API may have different rate limits - handle accordingly
3. **Caching**: Consider separate caching strategies per sport if needed
4. **Error Handling**: Sport-specific error messages would improve debugging

---

## Summary

**Frontend**: ✅ Complete (basketball support fully implemented)
**Backend**: ⚠️ Requires updates (outlined above)

Once these backend changes are implemented, the application will have **full end-to-end basketball support** with automatic fetching via GitHub Actions and manual admin triggers.
