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
4. **User Authentication**: Simple username-based authentication via Supabase
5. **Admin Panel**: Special admin interface for importing and managing match data
6. **Live Indicators**: Real-time status indicators for live matches

### User Experience
- **Search**: Search by team names, leagues, or sports
- **Filters**: Filter by sports, countries, and events
- **Date Navigation**: View matches for Today, Tomorrow, or This Week
- **Popularity Sorting**: Matches sorted by popularity when no filters applied
- **Responsive Design**: Mobile-first design (max-width: 440px)

## Project Structure

```
broadcast-finder/
├── src/
│   ├── components/          # React components
│   │   ├── AddBroadcastModal.jsx    # Modal for adding broadcast info
│   │   ├── AdminImportModal.jsx     # Admin data import interface
│   │   ├── AuthModal.jsx            # Authentication modal
│   │   ├── BroadcastPill.jsx        # Individual broadcast display with voting
│   │   ├── FilterModal.jsx          # Filter selection interface
│   │   ├── Icon.jsx                 # SVG icon component
│   │   └── MatchCard.jsx            # Match display card
│   ├── config/
│   │   ├── constants.js             # App constants (sports, countries, channels)
│   │   └── supabase.js              # Supabase client configuration
│   ├── utils/
│   │   └── helpers.js               # Utility functions (date helpers, etc.)
│   ├── App.jsx                      # Main application component
│   ├── main.jsx                     # React entry point
│   └── styles.css                   # Global styles
├── supabase/
│   ├── config.toml                  # Supabase project configuration
│   ├── migrations/                  # Database migrations
│   ├── functions/                   # Edge functions
│   └── README.md                    # Supabase setup docs
├── index.html                       # HTML entry point
├── vite.config.js                   # Vite configuration
├── package.json                     # Project dependencies
└── .gitignore                       # Git ignore rules
```

## Database Schema (Supabase)

### Tables

1. **matches**
   - `id`: Primary key
   - `home`: Home team name
   - `away`: Away team name
   - `sport`: Sport type (Football, Basketball, etc.)
   - `league`: League/competition name
   - `country`: Country code
   - `match_date`: Date string (YYYY-MM-DD)
   - `match_time`: Time string
   - `status`: Match status ("live" or null)
   - `popularity`: Popularity score for sorting

2. **broadcasts**
   - `id`: Primary key
   - `match_id`: Foreign key to matches
   - `country`: Broadcasting country
   - `channel`: Channel name
   - `created_by`: Username who added the broadcast

3. **votes**
   - `id`: Primary key
   - `broadcast_id`: Foreign key to broadcasts
   - `user_id`: Username of voter
   - `vote_type`: "up" or "down"

## Configuration

### Supabase Connection
- **URL**: `https://wgdohslxnbbzttyyqmxa.supabase.co`
- **Anon Key**: Stored in [src/config/supabase.js](src/config/supabase.js)
- Connection is configured for anonymous access with public read/write

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
- Simple username-based authentication (no password)
- Admin access: Username "admin" (case-insensitive)
- User state stored in React state (not persisted)

### Admin Features
- Username "admin" gets admin privileges
- Access to data import modal
- Can bulk import match data
- Admin button appears in header when logged in as admin

## Component Architecture

### Main Components

1. **App.jsx**: Main container component
   - Manages global state (user, matches, filters)
   - Handles data loading from Supabase
   - Coordinates all modals and views

2. **MatchCard.jsx**: Individual match display
   - Expandable to show broadcasts
   - Sport-specific color theming
   - Live match indicators
   - Integrates BroadcastPill components

3. **BroadcastPill.jsx**: Broadcast voting component
   - Displays channel and country
   - Upvote/downvote functionality
   - Vote count display
   - Requires authentication to vote

4. **FilterModal.jsx**: Multi-select filtering
   - Filter by sports, countries, events
   - Dynamic options based on available data
   - Real-time filter application

5. **AuthModal.jsx**: Simple authentication
   - Username-only login
   - No password required
   - Creates user session

6. **AddBroadcastModal.jsx**: Contribute broadcasts
   - Country and channel selection
   - Uses predefined channel lists
   - Requires authentication

## Styling Approach

- **No CSS Framework**: All styling is inline CSS-in-JS
- **Design System**:
  - Dark theme (#0e0e1a background)
  - Accent colors by sport (cyan #00e5ff for Football)
  - Glassmorphism effects
  - Monospace fonts for technical info
- **Layout**: Mobile-first, centered max-width 440px

## Data Flow

1. **Loading Matches**:
   - Fetch all matches from Supabase
   - Load associated broadcasts for each match
   - Load votes for each broadcast
   - Compute vote statistics
   - Enrich match objects with broadcasts and stats

2. **Filtering**:
   - Date-based filtering (Today/Tomorrow/This Week)
   - Multi-criteria filtering (sports, countries, events)
   - Text search across teams, leagues, sports
   - Popularity sorting when no filters active

3. **Voting**:
   - Check existing vote for user
   - Toggle vote if same type clicked
   - Switch vote if different type clicked
   - Refresh data after vote

## Important Patterns

### File References in Code
- Use relative imports within src/
- Components import from `../config/`, `../utils/`
- All paths are relative, no aliases configured

### State Management
- React useState hooks (no Redux or Context)
- Props drilling for user state
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
- Database schema changes require Supabase migrations
- No TypeScript - JavaScript with JSX
- No testing framework configured
- No CI/CD pipeline setup
- Environment variables not used (Supabase keys hardcoded)

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

## Debugging Tips

- Supabase errors logged to console
- Check browser console for API errors
- Verify Supabase connection in config
- Use Supabase dashboard to inspect data
- Refresh functionality available in header

## Design Philosophy

- **Community-First**: Users contribute and validate data
- **Simple Authentication**: Low barrier to contribution
- **Real-time Feel**: Live indicators and instant updates
- **Mobile-Optimized**: Touch-friendly, compact design
- **Minimalist**: Clean UI, focused on content
- **No Monetization**: Free, ad-free experience
