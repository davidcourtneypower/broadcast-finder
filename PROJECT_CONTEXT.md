# BroadcastFinder - Project Context

## Project Overview

**BroadcastFinder** is a community-powered sports broadcast finder application that helps users discover where to watch sports matches worldwide. The app provides real-time information about sports broadcasts, allowing community members to contribute and vote on broadcast information.

## Technology Stack

- **Frontend Framework**: React 18.2.0
- **Build Tool**: Vite 7.3.1
- **Backend/Database**: Supabase (PostgreSQL + Auth + Real-time)
- **Styling**: Inline CSS-in-JS (no external CSS framework)
- **Development Server**: Vite Dev Server (port 3000)

## Key Features

### Core Functionality
1. **Match Listings**: Browse sports matches with team names, leagues, dates, and times
2. **Broadcast Information**: Community-contributed broadcasting channels by country
3. **Voting System**: Upvote/downvote broadcasts for accuracy and reliability
4. **User Authentication**: Email/password authentication via Supabase Auth
5. **User Preferences**: Personalized timezone and time format (12h/24h) settings
6. **Timezone Support**: Automatic conversion of match times to user's preferred timezone
7. **Admin Panel**: Special admin interface for importing and managing match data
8. **Live Indicators**: Real-time status indicators for live matches
9. **Broadcast Source Tracking**: Distinguish between user-contributed and auto-fetched data

### User Experience
- **Search**: Search by team names, leagues, or sports
- **Filters**: Filter by sports, countries, and events
- **Date Navigation**: View matches for Today, Tomorrow, or This Week
- **Popularity Sorting**: Matches sorted by popularity when no filters applied
- **Responsive Design**: Mobile-first design (max-width: 440px)

## Project Structure

```
broadcast-finder/
├── api-response-examples/           # API response examples (reference data)
│   ├── exampleResponse-basketball.txt
│   └── exampleResponse-football.txt
├── src/
│   ├── components/                  # React components
│   │   ├── AddBroadcastModal.jsx    # Modal for adding broadcast info
│   │   ├── AdminDataModal.jsx       # Admin data view/export interface
│   │   ├── AdminImportModal.jsx     # Admin data import interface
│   │   ├── AuthModal.jsx            # Authentication modal (Supabase Auth)
│   │   ├── BroadcastPill.jsx        # Individual broadcast display with voting
│   │   ├── FilterModal.jsx          # Filter selection interface
│   │   ├── FixtureCard.jsx          # Match display card
│   │   ├── Icon.jsx                 # SVG icon component
│   │   └── UserSettingsModal.jsx    # User preferences modal
│   ├── config/
│   │   ├── constants.js             # App constants (sports, countries, channels)
│   │   └── supabase.js              # Supabase client configuration
│   ├── hooks/
│   │   └── useUserPreferences.js    # Hook for timezone/time format handling
│   ├── utils/
│   │   ├── helpers.js               # Utility functions (date helpers, etc.)
│   │   ├── timeFormatting.js        # Timezone and time formatting utilities
│   │   └── userProfiles.js          # User profile management utilities
│   ├── App.jsx                      # Main application component
│   ├── main.jsx                     # React entry point
│   └── styles.css                   # Global styles
├── supabase/
│   ├── config.toml                  # Supabase project configuration
│   ├── functions/                   # Edge functions
│   │   ├── cleanup-old-data/        # Cleanup function
│   │   └── fetch-fixtures/          # Fixture fetching function
│   ├── migrations/                  # Database migrations
│   │   ├── 20260204000001_initial_schema.sql
│   │   ├── 20260204000002_add_auth_users.sql
│   │   ├── 20260204000003_add_user_preferences.sql
│   │   └── 20260204000004_add_broadcast_source_tracking.sql
│   └── README.md                    # Supabase setup docs
├── .env                             # Environment variables (not in git)
├── .env.example                     # Environment template
├── index.html                       # HTML entry point
├── vite.config.js                   # Vite configuration
├── package.json                     # Project dependencies
└── .gitignore                       # Git ignore rules
```

## Database Schema (Supabase)

### Tables

1. **matches**
   - `id`: Primary key (format: `{sport}-{api_id}`)
   - `home`: Home team name
   - `away`: Away team name
   - `sport`: Sport type (Football, Basketball, etc.)
   - `league`: League/competition name
   - `country`: Country code
   - `match_date`: Date string (YYYY-MM-DD, stored in UTC)
   - `match_time`: Time string (HH:MM, stored in UTC)
   - `status`: Match status ("upcoming", "live", "starting-soon", "finished")
   - `popularity`: Popularity score for sorting (0-100)

2. **broadcasts**
   - `id`: Primary key
   - `match_id`: Foreign key to matches
   - `country`: Broadcasting country
   - `channel`: Channel name
   - `created_by`: User ID who added the broadcast
   - `source`: Data source ("user", "api-football", "livesoccertv", etc.)
   - `source_id`: External ID from source system (if applicable)
   - `confidence_score`: Confidence score 0-100 (increased by upvotes)
   - `last_verified_at`: Timestamp of last verification by user vote
   - `created_at`: Timestamp of creation

3. **votes**
   - `id`: Primary key
   - `broadcast_id`: Foreign key to broadcasts
   - `user_id`: User ID of voter (from auth.users)
   - `vote_type`: "up" or "down"
   - `created_at`: Timestamp of vote

4. **auth_users**
   - `id`: Primary key (UUID, linked to Supabase Auth)
   - `email`: User email
   - `username`: Display username
   - `is_admin`: Boolean flag for admin privileges
   - `created_at`: Timestamp of account creation
   - `last_sign_in_at`: Timestamp of last login

5. **user_preferences**
   - `id`: Primary key
   - `user_id`: Foreign key to auth.users (UUID)
   - `timezone`: User's preferred timezone (e.g., "America/New_York")
   - `time_format`: Preferred time format ("12h" or "24h")
   - `created_at`: Timestamp of creation
   - `updated_at`: Timestamp of last update

## Configuration

### Environment Variables
The project uses Vite environment variables (`.env` file):
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous/public key

**Note**: Copy `.env.example` to `.env` and fill in your credentials.

### Supabase Connection
- Connection configured in [src/config/supabase.js](src/config/supabase.js)
- Uses Supabase Auth for user authentication
- Auto-refresh tokens and session persistence enabled
- Session detection from URL for auth callbacks

### Supported Sports
- Football (Soccer)
- Basketball
- (Extensible via [constants.js](src/config/constants.js))

### Supported Countries
USA, UK, Canada, Australia, India, Germany, France, Spain, Italy, Global
- Each country has predefined list of common broadcast channels
- See [constants.js](src/config/constants.js) for full list

## Development Workflow

### Running the App
```bash
npm run dev        # Start dev server on http://localhost:3000
npm run build      # Build for production
npm run preview    # Preview production build
```

### Authentication System
- **Supabase Auth**: Email/password authentication
- **Session Management**: Auto-refresh tokens, persistent sessions
- **User Profiles**: Stored in `auth_users` table with username and admin flag
- **Admin Access**: Users with `is_admin` flag set to true
- **User State**: Managed via Supabase Auth, persists across sessions

### Admin Features
- Users with `is_admin` flag get admin privileges
- Access to data import/export modals
- Can bulk import match data (JSON format)
- Admin button appears in header when logged in as admin

### Timezone Handling
- **Storage**: All match times stored in UTC in database
- **Display**: Converted to user's preferred timezone for display
- **User Preferences**: Users can set timezone in settings modal
- **Default**: Browser timezone used if no preference set
- **Format**: Supports 12-hour and 24-hour time formats
- **Relative Times**: Shows "in X hours", "starts in 30 min", etc.
- **Status Calculation**: Live/upcoming/finished status calculated in user's timezone

## Component Architecture

### Main Components

1. **App.jsx**: Main container component
   - Manages global state (user, matches, filters)
   - Handles data loading from Supabase
   - Coordinates all modals and views
   - Manages authentication state

2. **FixtureCard.jsx**: Individual match display
   - Expandable to show broadcasts
   - Sport-specific color theming
   - Live match indicators
   - Timezone-aware time display
   - Relative time countdown
   - Integrates BroadcastPill components

3. **BroadcastPill.jsx**: Broadcast voting component
   - Displays channel and country
   - Shows source badge (🤖 Auto / 👤 User)
   - Upvote/downvote functionality
   - Vote count display
   - Requires authentication to vote

4. **FilterModal.jsx**: Multi-select filtering
   - Filter by sports, countries, events
   - Dynamic options based on available data
   - Real-time filter application

5. **AuthModal.jsx**: Supabase authentication
   - Email/password sign up and sign in
   - Username selection during registration
   - Integration with Supabase Auth
   - Error handling and validation

6. **AddBroadcastModal.jsx**: Contribute broadcasts
   - Country and channel selection
   - Uses predefined channel lists
   - Requires authentication
   - Marks source as "user"

7. **UserSettingsModal.jsx**: User preferences
   - Timezone selection (searchable dropdown)
   - Time format toggle (12h/24h)
   - Saves to user_preferences table
   - Real-time UI update on save

8. **AdminImportModal.jsx**: Bulk data import
   - JSON paste interface
   - Validates and imports matches
   - Upsert functionality (update or insert)
   - Admin-only access

9. **AdminDataModal.jsx**: Data management
   - View all matches and broadcasts
   - Export data as JSON
   - Admin-only access

### Custom Hooks

1. **useUserPreferences**: Timezone and formatting hook
   - Loads user preferences from database
   - Provides `formatTime()` for timezone conversion
   - Provides `getStatus()` for status calculation in user timezone
   - Provides `getRelative()` for relative time display
   - Falls back to browser timezone if no preferences set

## Styling Approach

- **No CSS Framework**: All styling is inline CSS-in-JS
- **Design System**:
  - Dark theme (#0e0e1a background)
  - Accent colors by sport (cyan #00e5ff for Football)
  - Glassmorphism effects
  - Monospace fonts for technical info
- **Layout**: Mobile-first, centered max-width 440px

## Data Flow

1. **Authentication**:
   - User signs up/in via Supabase Auth
   - Session stored in browser (auto-refresh enabled)
   - User profile created in `auth_users` table
   - User preferences loaded from `user_preferences` table
   - Session persists across page reloads

2. **Loading Matches**:
   - Fetch all matches from Supabase (stored in UTC)
   - Load associated broadcasts for each match
   - Load votes for each broadcast
   - Compute vote statistics
   - Enrich match objects with broadcasts and stats
   - Convert match times to user's timezone for display

3. **Timezone Handling**:
   - Match times stored in UTC in database
   - User preference loaded via `useUserPreferences` hook
   - Times converted to user's timezone for display
   - Status (live/upcoming/finished) calculated in user's timezone
   - Relative times ("in 2 hours") updated every minute

4. **Filtering**:
   - Date-based filtering (Today/Tomorrow/This Week) in user's timezone
   - Multi-criteria filtering (sports, countries, events)
   - Text search across teams, leagues, sports
   - Popularity sorting when no filters active

5. **Voting**:
   - Check existing vote for user (by user_id from auth)
   - Toggle vote if same type clicked
   - Switch vote if different type clicked
   - Update broadcast confidence score based on votes
   - Refresh data after vote

6. **User Preferences**:
   - Load preferences on authentication
   - Update in database when changed
   - Immediately apply to UI (time format, timezone)
   - Persist across sessions

## Important Patterns

### File References in Code
- Use relative imports within src/
- Components import from `../config/`, `../utils/`
- All paths are relative, no aliases configured

### State Management
- React useState hooks (no Redux or Context)
- Supabase Auth for user authentication state
- Custom hooks for user preferences (useUserPreferences)
- Props drilling for user and preference state
- Real-time updates via data refresh, not Supabase subscriptions

### Supabase Queries
- Direct queries from components
- No query abstraction layer
- Manual data enrichment (joins)
- No caching layer

## Future Development Considerations

When making changes, consider:
- Adding new sports requires updating [constants.js](src/config/constants.js) SPORT_COLORS
- New countries need updates to CHANNELS_BY_COUNTRY and FLAG_MAP
- Database schema changes require Supabase migrations (see `supabase/migrations/`)
- All match times must be stored in UTC in the database
- Timezone conversions happen on client-side using user preferences
- Broadcast source tracking distinguishes user vs auto-fetched data
- No TypeScript - JavaScript with JSX
- No testing framework configured
- No CI/CD pipeline setup
- Environment variables in `.env` (not committed to git)

## Common Development Tasks

### Adding a New Sport
1. Update `SPORT_COLORS` in [constants.js](src/config/constants.js)
2. Add color scheme (accent, bg, glow)
3. Component will automatically adapt

### Adding a New Country
1. Update `CHANNELS_BY_COUNTRY` in [constants.js](src/config/constants.js)
2. Add to `FLAG_MAP` for flag emoji
3. Country will appear in filters and dropdowns

### Modifying Database Schema
1. Create migration in `supabase/migrations/`
2. Apply via Supabase CLI or dashboard
3. Update queries in components

### Adding a New Component
1. Create in `src/components/`
2. Use existing components as template
3. Follow inline styling pattern
4. Import and integrate in [App.jsx](src/App.jsx)

### Working with Timezones
1. Always store match times in UTC in database (YYYY-MM-DD, HH:MM format)
2. Use `useUserPreferences` hook to get timezone conversion functions
3. Display times using `formatTime()` from the hook
4. Calculate status using `getStatus()` which accounts for timezone
5. Show relative times using `getRelative()` for better UX

### Adding Broadcast Source Types
1. Update broadcast insert to include `source` field ("user", "api-football", etc.)
2. Optionally add `source_id` for external reference
3. Set initial `confidence_score` (default 50)
4. Source badge will automatically appear in UI (🤖 Auto / 👤 User)

## Utility Functions

### timeFormatting.js
- `formatMatchTime()`: Convert UTC time to user timezone
- `getMatchStatus()`: Calculate match status (live/upcoming/finished) in user timezone
- `getRelativeTime()`: Get relative time string ("in 2 hours", "LIVE NOW")
- `getTimezoneAbbreviation()`: Get timezone abbreviation (EST, PST, etc.)
- `getAllTimezones()`: Get list of all available timezones

### userProfiles.js
- `getUserProfile()`: Fetch user profile from auth_users table
- `createUserProfile()`: Create new user profile
- `updateUserProfile()`: Update user profile fields
- `getUserPreferences()`: Fetch user preferences
- `updateUserPreferences()`: Save user timezone and time format preferences

### helpers.js
- Date manipulation utilities
- Flag emoji mapping (`getFlag()`)
- General helper functions

## Debugging Tips

- Supabase errors logged to console
- Check browser console for API errors and auth issues
- Verify Supabase connection in config and `.env` file
- Use Supabase dashboard to inspect data and auth users
- Check timezone conversions if times appear incorrect
- Verify user preferences are saved in `user_preferences` table
- Refresh functionality available in header

## Design Philosophy

- **Community-First**: Users contribute and validate data
- **Simple Authentication**: Low barrier to contribution
- **Real-time Feel**: Live indicators and instant updates
- **Mobile-Optimized**: Touch-friendly, compact design
- **Minimalist**: Clean UI, focused on content
- **No Monetization**: Free, ad-free experience
