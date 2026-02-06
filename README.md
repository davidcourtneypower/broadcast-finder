# BroadcastFinder

A community-powered sports broadcast finder application that helps users discover where to watch sports matches worldwide. Automatically fetches fixture and broadcast data from TheSportsDB, with community voting to verify accuracy.

## Features

- **13+ Sports**: Soccer, Basketball, American Football, Ice Hockey, Tennis, Baseball, Rugby, Cricket, Golf, Motorsport, Boxing/MMA, Volleyball, Handball
- **Automated Data**: Fixtures fetched hourly, broadcasts every 15 minutes via Supabase pg_cron
- **Live Match Tracking**: Real-time status indicators (LIVE, STARTING SOON, UPCOMING, FINISHED)
- **Broadcast Information**: Auto-fetched from TheSportsDB + community-contributed channels
- **Voting System**: Upvote/downvote broadcasts with instant optimistic UI updates
- **Google OAuth**: Sign in with Google via Supabase Auth
- **Timezone Support**: Automatic conversion to user's preferred timezone (12h/24h format)
- **Smart Filtering**: Filter by sports, countries, events, and match status
- **Search**: Find matches by team names, leagues, or sports
- **Real-time Updates**: Supabase Realtime subscriptions for broadcasts and votes
- **Mobile-First Design**: Optimized for mobile (max-width: 440px)
- **Admin Panel**: Import data, manage fixtures, view logs, manage users

## Tech Stack

- **Frontend**: React 18 + Vite 7
- **Backend**: Supabase (PostgreSQL + Auth + Real-time + Edge Functions)
- **Data Source**: TheSportsDB API (v1 & v2)
- **Scheduling**: Supabase pg_cron + pg_net
- **Deployment**: GitHub Pages (auto-deploy on push)
- **Styling**: Inline CSS-in-JS (no external framework)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/davidcourtneypower/broadcast-finder.git
cd broadcast-finder
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

4. Start the development server:
```bash
npm run dev
```

5. Open `http://localhost:3000`

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
broadcast-finder/
├── .github/workflows/          # CI/CD (deploy, manual fetch/cleanup)
├── src/
│   ├── components/             # React components (10 files)
│   ├── config/                 # Constants, sports config, Supabase client
│   ├── hooks/                  # useAuth, useUserPreferences
│   ├── utils/                  # Helpers, time formatting, user profiles
│   ├── App.jsx                 # Main application
│   └── main.jsx                # Entry point
├── supabase/
│   ├── functions/              # Edge Functions (4 functions + shared utils)
│   │   ├── _shared/            # Shared API clients and transformers
│   │   ├── fetch-all-sports/   # Fetch fixtures from TheSportsDB
│   │   ├── fetch-broadcasts/   # Fetch TV broadcasts from TheSportsDB
│   │   ├── cleanup-old-data/   # Delete past match data
│   │   └── fetch-fixtures/     # Legacy fixture fetcher
│   └── migrations/             # 8 database migrations
├── .env.example                # Environment template
├── vite.config.js              # Vite configuration
└── package.json                # Dependencies
```

## Automated Data Pipeline

Data is fetched automatically via Supabase pg_cron:

| Schedule | Function | Description |
|----------|----------|-------------|
| Every 1 hour | `fetch-all-sports` | Fetch fixtures for today + tomorrow + day after |
| Every 15 min | `fetch-broadcasts` | Fetch TV broadcasts and link to fixtures |
| Daily 3 AM UTC | `cleanup-old-data` | Delete past matches, broadcasts, and votes |

GitHub Actions workflows are also available for manual triggering.

### Deploying Edge Functions

```bash
npx supabase functions deploy fetch-all-sports --no-verify-jwt
npx supabase functions deploy fetch-broadcasts --no-verify-jwt
npx supabase functions deploy cleanup-old-data --no-verify-jwt
```

## Usage

### For Users

1. **Browse Matches**: View sports matches organized by date (Today/Tomorrow)
2. **Search**: Find specific teams or leagues
3. **Filter**: Apply filters for sports, countries, events, or match status
4. **Sign In**: Sign in with Google to contribute
5. **Settings**: Configure timezone and time format (12h/24h)
6. **Add Broadcasts**: Contribute broadcast channels for matches
7. **Vote**: Upvote/downvote broadcast accuracy
8. **View Sources**: See whether broadcasts are auto-fetched or user-contributed

### For Admins

1. Sign in with an admin account
2. Access the Admin panel (shield icon in header)
3. **Import tab**: Paste TheSportsDB JSON to import fixtures or broadcasts
4. **Manage tab**: Fetch fixtures/broadcasts on demand, cleanup old data
5. **Fixtures tab**: View, search, and delete fixtures
6. **Users tab**: View users, ban/unban with reason
7. **Logs tab**: View API fetch logs and admin action logs

## Database

### Tables

| Table | Purpose |
|-------|---------|
| `matches` | Sports fixtures (team, league, date, time, sport) |
| `broadcasts` | TV channels per match (with source: thesportsdb/user) |
| `votes` | Community upvotes/downvotes on broadcasts |
| `user_profiles` | User display names, avatars, preferences (JSONB) |
| `api_fetch_logs` | History of automated data fetches |
| `admin_action_logs` | Admin activity audit trail |

For detailed schema, see [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Configuration

### Supported Countries (23)

USA, UK, Canada, Australia, India, Germany, France, Spain, Italy, China, Turkey, Greece, Lithuania, Serbia, Russia, Argentina, Brazil, Mexico, Japan, Global, and more.

Each country has predefined broadcast channel lists. Edit `src/config/constants.js` to add countries or channels.

### Sport Colors & Durations

Sport-specific match durations (for status calculation) and UI color schemes are defined in `src/config/sports.js`. Sports are dynamically fetched from TheSportsDB.

## Development

### Available Scripts

- `npm run dev` - Start development server (port 3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### GitHub Actions

- **deploy.yml**: Auto-deploys to GitHub Pages on push to `main`
- **fetch-all-sports.yml**: Manual workflow to fetch fixtures
- **fetch-broadcasts.yml**: Manual workflow to fetch broadcasts
- **cleanup-old-data.yml**: Manual workflow to cleanup old data

Required secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `PROJECT_URL`, `SERVICE_ROLE_KEY`

### Code Style

- React functional components with hooks
- Inline CSS-in-JS styling (dark theme, glassmorphism)
- JavaScript with JSX (no TypeScript in frontend)
- TypeScript in Supabase Edge Functions (Deno runtime)

## Roadmap

### Completed
- [x] Google OAuth authentication
- [x] User preferences (timezone, time format)
- [x] Timezone-aware match time display
- [x] Broadcast source tracking (auto vs user)
- [x] Real-time updates via Supabase subscriptions
- [x] Automated data fetching (TheSportsDB API)
- [x] pg_cron scheduling (fixtures hourly, broadcasts every 15 min)
- [x] 13+ sports support
- [x] Admin panel (import, manage, fixtures, users, logs)
- [x] Optimistic UI updates for votes
- [x] Automated cleanup of past data
- [x] GitHub Pages deployment

### Future Enhancements
- [ ] User contribution history and profiles
- [ ] Calendar integration and iCal export
- [ ] Notifications for favorite teams
- [ ] Mobile app (React Native)

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or suggestions:
- Create an issue in the [repository](https://github.com/davidcourtneypower/broadcast-finder/issues)
- Check [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for detailed technical documentation

## Acknowledgments

- Built with [React](https://react.dev) and [Vite](https://vite.dev)
- Powered by [Supabase](https://supabase.com)
- Sports data from [TheSportsDB](https://www.thesportsdb.com)
- Icons: Custom SVG implementation
- Design: Dark theme with glassmorphism effects
