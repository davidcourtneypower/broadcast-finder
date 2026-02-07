# SportsOnTV - Project Context

## Project Overview

**SportsOnTV** is a community-powered app to find where to watch sports on TV. The app automatically fetches fixture and broadcast data from TheSportsDB API, supports real-time updates via Supabase subscriptions, and allows community members to contribute and vote on broadcast information.

## Technology Stack

- **Frontend Framework**: React 18.2.0
- **Build Tool**: Vite 7.3.1
- **Backend/Database**: Supabase (PostgreSQL + Auth + Real-time + Edge Functions)
- **Data Source**: TheSportsDB API (v1 & v2) - Business tier
- **Scheduling**: Supabase pg_cron + pg_net for automated data fetching
- **Deployment**: GitHub Pages (via GitHub Actions)
- **Styling**: Inline CSS-in-JS (no external CSS framework)
- **Development Server**: Vite Dev Server (port 3000)

## Key Features

### Core Functionality
1. **Automated Data Fetching**: Fixtures fetched hourly, broadcasts every 15 minutes via pg_cron
2. **Match Listings**: Browse 13+ sports with team names, leagues, dates, and times
3. **Broadcast Information**: Auto-fetched from TheSportsDB + community-contributed channels
4. **Voting System**: Upvote/downvote broadcasts with optimistic UI updates
5. **User Authentication**: Google OAuth via Supabase Auth
6. **User Preferences**: Personalized timezone and time format (12h/24h) settings
7. **Timezone Support**: Automatic conversion of match times to user's preferred timezone
8. **Admin Panel**: Full admin interface with Import, Manage, Fixtures, Users, and Logs tabs
9. **Live Indicators**: Real-time status indicators (LIVE, STARTING SOON, UPCOMING, FINISHED)
10. **Broadcast Source Tracking**: Distinguish between auto-fetched and user-contributed data
11. **Real-time Subscriptions**: Supabase Realtime for broadcasts and votes changes
12. **Data Cleanup**: Automated daily cleanup of past matches via pg_cron

### User Experience
- **Search**: Search by team names, leagues, or sports
- **Filters**: Filter by sports, countries, events, and match status
- **Date Navigation**: View matches for Today or Tomorrow
- **Status Sorting**: Matches sorted by status (Live > Starting Soon > Upcoming > Finished)
- **Pagination**: Load More button (20 fixtures at a time)
- **Responsive Design**: Mobile-first design (max-width: 440px)

## Project Structure

```
sports-on-tv/
├── .github/
│   └── workflows/
│       ├── deploy.yml                  # Auto-deploy to GitHub Pages on push
│       ├── fetch-all-sports.yml        # Manual: fetch fixtures
│       ├── fetch-broadcasts.yml        # Manual: fetch broadcasts
│       └── cleanup-old-data.yml        # Manual: cleanup old data
├── src/
│   ├── components/
│   │   ├── AddBroadcastModal.jsx       # Modal for adding broadcast info
│   │   ├── AdminDataModal.jsx          # Admin panel (Import/Manage/Fixtures/Users/Logs)
│   │   ├── AdminImportModal.jsx        # Admin data import interface
│   │   ├── AuthModal.jsx               # Google OAuth authentication modal
│   │   ├── BroadcastPill.jsx           # Broadcast display with voting
│   │   ├── ConfirmModal.jsx            # Reusable confirmation dialog
│   │   ├── FilterModal.jsx             # Multi-select filter interface
│   │   ├── FixtureCard.jsx             # Match display card (expandable)
│   │   ├── Icon.jsx                    # SVG icon component
│   │   └── UserSettingsModal.jsx       # User preferences modal
│   ├── config/
│   │   ├── constants.js                # App constants (countries, channels, date tabs)
│   │   ├── sports.js                   # Sport configurations (durations, colors)
│   │   └── supabase.js                 # Supabase client configuration
│   ├── hooks/
│   │   ├── useAuth.js                  # Authentication hook (Google OAuth)
│   │   └── useUserPreferences.js       # Timezone/time format hook
│   ├── utils/
│   │   ├── helpers.js                  # Date helpers, flag mapping, status calculation
│   │   ├── timeFormatting.js           # Timezone conversion and formatting
│   │   └── userProfiles.js             # User profile CRUD utilities
│   ├── App.jsx                         # Main application component
│   ├── main.jsx                        # React entry point
│   └── styles.css                      # Global styles
├── supabase/
│   ├── functions/
│   │   ├── _shared/                    # Shared utilities for edge functions
│   │   │   ├── api-sports-client.ts    # API-Sports client
│   │   │   ├── event-matcher.ts        # Match/event matching logic
│   │   │   ├── sports-config.ts        # Sports configuration
│   │   │   ├── thesportsdb-client.ts   # TheSportsDB v1 client
│   │   │   ├── thesportsdb-config.ts   # TheSportsDB configuration
│   │   │   ├── thesportsdb-v2-client.ts # TheSportsDB v2 client
│   │   │   └── transformers.ts         # Data transformers
│   │   ├── cleanup-old-data/           # Delete past matches/broadcasts/votes
│   │   ├── fetch-all-sports/           # Fetch fixtures from TheSportsDB
│   │   ├── fetch-broadcasts/           # Fetch TV broadcasts from TheSportsDB
│   │   └── fetch-fixtures/             # Legacy fixture fetching (modular)
│   ├── migrations/
│   │   ├── 20260204000001_basketball_support.sql
│   │   ├── 20260204000002_add_auth_users.sql
│   │   ├── 20260204000003_add_user_preferences.sql
│   │   ├── 20260204000004_add_broadcast_source_tracking.sql
│   │   ├── 20260205000001_enhanced_admin_features.sql
│   │   ├── 20260205000002_add_broadcast_unique_constraint.sql
│   │   ├── 20260206000001_thesportsdb_v2_migration.sql
│   │   └── 20260207000001_schedule_cron_jobs.sql
│   ├── config.toml                     # Supabase project configuration
│   └── README.md                       # Supabase setup docs
├── .env                                # Environment variables (not in git)
├── .env.example                        # Environment template
├── index.html                          # HTML entry point
├── vite.config.js                      # Vite configuration
├── package.json                        # Project dependencies
├── PROJECT_CONTEXT.md                  # This file
└── README.md                           # Project README
```

## Database Schema (Supabase)

### Tables

1. **matches**
   - `id`: Primary key (format: `{sport}-{sportsdb_event_id}`)
   - `sportsdb_event_id`: TheSportsDB event ID (for upserts)
   - `home`: Home team name
   - `away`: Away team name
   - `sport`: Sport type (Soccer, Basketball, Ice Hockey, etc.)
   - `league`: League/competition name
   - `country`: Country code
   - `match_date`: Date string (YYYY-MM-DD, stored in UTC)
   - `match_time`: Time string (HH:MM, stored in UTC)
   - `status`: Match status (calculated dynamically on client)
   - `created_at`: Timestamp

2. **broadcasts**
   - `id`: UUID primary key
   - `match_id`: Foreign key to matches
   - `country`: Broadcasting country
   - `channel`: Channel name
   - `source`: Data source (`"thesportsdb"` or `"user"`)
   - `created_by`: Legacy user identifier
   - `created_by_uuid`: User UUID (FK to auth.users)
   - `confidence_score`: Confidence score 0-100
   - `last_verified_at`: Timestamp of last verification
   - `created_at`: Timestamp
   - **Unique constraint**: `(match_id, channel, country, source)`

3. **votes**
   - `id`: UUID primary key
   - `broadcast_id`: Foreign key to broadcasts
   - `user_id`: Legacy user ID
   - `user_id_uuid`: User UUID (FK to auth.users)
   - `vote_type`: `"up"` or `"down"`
   - `created_at`: Timestamp

4. **user_profiles**
   - `id`: UUID primary key (linked to Supabase Auth)
   - `display_name`: User display name
   - `avatar_url`: Profile picture URL (from OAuth provider)
   - `preferences`: JSONB (timezone, timeFormat, dateFormat)
   - `created_at`: Timestamp
   - `updated_at`: Timestamp

5. **api_fetch_logs**
   - `id`: Primary key
   - `fetch_type`: Type of fetch (`"fixtures"`, `"broadcasts"`, `"cleanup"`)
   - `sport`: Sport fetched (or `"all"`)
   - `fetch_date`: Date of fetch
   - `status`: `"success"` or `"error"`
   - `matches_fetched`: Count of matches found
   - `matches_created`: Count of new matches inserted
   - `matches_updated`: Count of matches updated
   - `error_message`: Error details if failed
   - `created_at`: Timestamp

6. **admin_action_logs**
   - Tracks admin actions (imports, deletions, bans, etc.)

## Edge Functions

### fetch-all-sports
- **Schedule**: Every 1 hour via pg_cron
- **Purpose**: Fetches fixtures from TheSportsDB v1 API for all supported sports
- **Endpoint**: `POST /functions/v1/fetch-all-sports`
- **Body**: `{"dates": ["today", "tomorrow", "day_after_tomorrow"], "trigger": "scheduled|manual"}`
- **Behavior**: Upserts on `sportsdb_event_id` - updates existing fixtures if details changed

### fetch-broadcasts
- **Schedule**: Every 15 minutes via pg_cron
- **Purpose**: Fetches TV broadcast data from TheSportsDB and links to existing fixtures
- **Endpoint**: `POST /functions/v1/fetch-broadcasts`
- **Body**: `{"dates": ["today", "tomorrow", "day_after_tomorrow"], "trigger": "scheduled|manual"}`
- **Behavior**: Upserts on `(match_id, channel, country, source)` - only updates system broadcasts, never touches user broadcasts

### cleanup-old-data
- **Schedule**: Daily at 03:00 UTC via pg_cron
- **Purpose**: Deletes matches, broadcasts, and votes for dates before today
- **Endpoint**: `POST /functions/v1/cleanup-old-data`
- **Behavior**: Cascade delete: votes -> broadcasts -> matches

### Scheduling (pg_cron)
Automated scheduling is configured via pg_cron + pg_net in the Supabase database:
- Fixtures: `0 * * * *` (every hour)
- Broadcasts: `*/15 * * * *` (every 15 minutes)
- Cleanup: `0 3 * * *` (daily at 3 AM UTC)

Secrets stored in Supabase Vault (`project_url`, `service_role_key`).

## Configuration

### Environment Variables
The project uses Vite environment variables (`.env` file):
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous/public key

### Supabase Project
- **Project ID**: `wgdohslxnbbzttyyqmxa`
- **TheSportsDB API Key**: Stored in edge function environment (Business tier, 120 req/min)

### Supported Sports (13+, dynamic from TheSportsDB)
Soccer, Basketball, American Football, Ice Hockey, Tennis, Baseball, Rugby, Cricket, Golf, Motorsport, Boxing/MMA, Volleyball, Handball

Sport-specific match durations and color schemes defined in [src/config/sports.js](src/config/sports.js).

### Supported Countries (23)
USA, UK, Canada, Australia, India, Germany, France, Spain, Italy, China, Turkey, Greece, Lithuania, Serbia, Russia, Argentina, Brazil, Mexico, Japan, Global (and more)

Each country has predefined broadcast channel lists in [src/config/constants.js](src/config/constants.js).

## Authentication System
- **Provider**: Google OAuth via Supabase Auth
- **Session Management**: Auto-refresh tokens, persistent sessions
- **Tab-switch safe**: User state only updates on actual sign in/out (not token refreshes)
- **User Profiles**: Stored in `user_profiles` table with display name, avatar, and preferences
- **Admin Access**: Checked by email match (`davidcourtneypower@gmail.com`) or `user_metadata.is_admin`

## Component Architecture

### Main Components

1. **App.jsx**: Main container component
   - Manages global state (user, matches, filters, pagination)
   - Batched Supabase queries (50 IDs per batch) to avoid URL length limits
   - Real-time subscriptions for broadcasts and votes
   - Optimistic UI updates for votes and broadcast deletion
   - Status calculation (live/upcoming/finished) based on sport-specific durations

2. **FixtureCard.jsx**: Individual match display
   - Expandable to show broadcasts
   - Sport-specific color theming (13 sports)
   - Live/Starting Soon/Upcoming/Finished status badges
   - Timezone-aware time display with abbreviation
   - Relative time countdown (updated every minute)

3. **BroadcastPill.jsx**: Broadcast voting component
   - Source badge: Auto / User
   - Upvote/downvote with optimistic UI
   - Creator gets locked upvote (can't change)
   - Delete button for creators and admins

4. **AdminDataModal.jsx**: Full admin panel
   - **Import tab**: Paste TheSportsDB JSON (fixtures or broadcasts), auto-detect format
   - **Manage tab**: Fetch fixtures/broadcasts independently, cleanup old data, 3-day date selector
   - **Fixtures tab**: View/search/delete fixtures with multi-select
   - **Users tab**: View users, ban/unban with reason
   - **Logs tab**: View API fetch logs and admin action logs

5. **ConfirmModal.jsx**: Reusable confirmation dialog
   - Used for destructive actions (delete, ban, etc.)

### Custom Hooks

1. **useAuth**: Authentication hook
   - Google OAuth sign in/out
   - Stable user reference (prevents re-renders on token refresh)
   - Auto-creates user profile on first sign-in

2. **useUserPreferences**: Timezone and formatting hook
   - Loads preferences from `user_profiles.preferences` JSONB
   - Provides `formatTime()`, `getStatus()`, `getRelative()`
   - Falls back to browser timezone

## Data Flow

1. **Automated Fetching** (pg_cron):
   - Every hour: fetch fixtures for today + tomorrow + day after tomorrow
   - Every 15 min: fetch broadcasts and link to existing fixtures
   - Daily at 3 AM: cleanup past match data

2. **Loading Matches** (App.jsx):
   - Fetch all matches from Supabase
   - Fetch broadcasts in batches of 50 match IDs
   - Fetch votes in batches of 50 broadcast IDs
   - Compute vote statistics per broadcast
   - Enrich matches with broadcasts and stats
   - Calculate status dynamically based on sport-specific duration

3. **Real-time Updates**:
   - Broadcasts channel: INSERT adds to state, DELETE removes from state
   - Votes channel: INSERT/DELETE trigger refetch of that broadcast's votes
   - Optimistic updates for user's own votes (immediate UI feedback)

4. **Voting**:
   - Check existing vote via `user_id_uuid`
   - Toggle off: delete vote, optimistically update counts
   - Switch: delete + insert (avoids UPDATE replica identity issues)
   - New vote: insert, optimistically update counts

5. **Broadcast Deletion**:
   - `.delete().select()` to verify RLS allowed the delete
   - Shows permission error if RLS blocked (empty result)
   - Optimistic state removal on success

## GitHub Actions Workflows

1. **deploy.yml**: Auto-deploy to GitHub Pages on push to `main`
2. **fetch-all-sports.yml**: Manual trigger to fetch fixtures (3-day range)
3. **fetch-broadcasts.yml**: Manual trigger to fetch broadcasts (3-day range)
4. **cleanup-old-data.yml**: Manual trigger to cleanup past data

Required GitHub Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `PROJECT_URL`, `SERVICE_ROLE_KEY`

## Styling Approach

- **No CSS Framework**: All styling is inline CSS-in-JS
- **Design System**:
  - Dark theme (#0e0e1a background)
  - Sport-specific accent colors (13 sports with unique schemes)
  - Glassmorphism effects
  - Monospace fonts for technical info
- **Layout**: Mobile-first, centered max-width 440px

## Important Patterns

### State Management
- React useState hooks (no Redux or Context)
- Supabase Auth for authentication state (stable references via useRef)
- Real-time subscriptions for broadcasts and votes
- Optimistic updates for votes and deletions
- Batched queries (50 IDs per request) to avoid HTTP URL length limits

### Supabase Queries
- Direct queries from components (no abstraction layer)
- Batched `.in()` queries for large datasets
- Upserts for fixture and broadcast data (idempotent)
- `.delete().select()` pattern to detect RLS blocking

### Edge Function Patterns
- CORS headers on all responses (browser access)
- OPTIONS preflight handler
- Service role key for database operations
- Logging to `api_fetch_logs` table
- 3-day date range support (`today`, `tomorrow`, `day_after_tomorrow`)

## Development Workflow

### Running the App
```bash
npm run dev        # Start dev server on http://localhost:3000
npm run build      # Build for production
npm run preview    # Preview production build
```

### Deploying Edge Functions
```bash
npx supabase functions deploy fetch-all-sports --no-verify-jwt
npx supabase functions deploy fetch-broadcasts --no-verify-jwt
npx supabase functions deploy cleanup-old-data --no-verify-jwt
```

### Common Development Tasks

**Adding a New Sport**: Sport colors and durations in [src/config/sports.js](src/config/sports.js). Sports are dynamically fetched from TheSportsDB.

**Adding a New Country**: Update `CHANNELS_BY_COUNTRY` and `FLAG_MAP` in [src/config/constants.js](src/config/constants.js).

**Database Schema Changes**: Create migration in `supabase/migrations/`, apply via CLI or dashboard.

**Working with Timezones**: All times stored in UTC. Use `useUserPreferences` hook for `formatTime()`, `getStatus()`, `getRelative()`.

## Debugging Tips

- Check Supabase Dashboard for edge function logs
- Check `api_fetch_logs` table for fetch history and errors
- Check `admin_action_logs` for admin activity
- Verify CORS headers if browser requests fail
- Batched queries: check if broadcast/vote counts exceed 50 per batch
- RLS policies: `.delete().select()` returns empty array when blocked
