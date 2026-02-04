# BroadcastFinder

A community-powered sports broadcast finder application that helps users discover where to watch sports matches worldwide.

## Features

- **Live Match Tracking**: View sports matches with real-time status indicators
- **Broadcast Information**: Community-contributed broadcasting channels by country
- **Voting System**: Upvote/downvote broadcasts for accuracy and reliability
- **Smart Filtering**: Filter by sports, countries, and events
- **Search**: Find matches by team names, leagues, or sports
- **Date Navigation**: Browse matches for Today, Tomorrow, or This Week
- **Mobile-First Design**: Optimized for mobile and desktop viewing

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Styling**: CSS-in-JS (no external framework)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account (for backend setup)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd broadcast-finder
```

2. Install dependencies:
```bash
npm install
```

3. Configure Supabase:
   - The project is already configured with a Supabase instance
   - Connection details are in `src/config/supabase.js`
   - To use your own Supabase instance, update the URL and anon key

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:3000`

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/       # React components
├── config/          # Configuration files
├── utils/           # Utility functions
├── App.jsx          # Main application
├── main.jsx         # Entry point
└── styles.css       # Global styles

supabase/            # Supabase configuration
index.html           # HTML template
vite.config.js       # Vite configuration
```

## Usage

### For Users

1. **Browse Matches**: View available sports matches organized by date
2. **Search**: Use the search bar to find specific teams or leagues
3. **Filter**: Apply filters for sports, countries, or events
4. **Sign In**: Click "Sign In" to contribute broadcast information
5. **Add Broadcasts**: When signed in, add broadcast channels for matches
6. **Vote**: Help the community by voting on broadcast accuracy

### For Admins

1. Sign in with username "admin"
2. Access the Admin panel from the header
3. Import match data in bulk
4. Manage existing broadcasts

## Database Schema

### Tables

- **matches**: Sports match information (teams, league, date, time)
- **broadcasts**: Broadcasting channels by country for each match
- **votes**: Community votes on broadcast accuracy

For detailed schema information, see [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)

## Configuration

### Adding Sports

Edit `src/config/constants.js`:
```javascript
export const SPORT_COLORS = {
  Football: { accent: "#00e5ff", bg: "rgba(0,229,255,0.12)", glow: "rgba(0,229,255,0.25)" },
  Basketball: { accent: "#ff9f1c", bg: "rgba(255,159,28,0.12)", glow: "rgba(255,159,28,0.25)" },
  // Add your sport here
}
```

### Adding Countries

Edit `src/config/constants.js`:
```javascript
export const CHANNELS_BY_COUNTRY = {
  "USA": ["ESPN", "FOX", "CBS", ...],
  // Add your country here
}

export const FLAG_MAP = {
  USA: "🇺🇸",
  // Add your country emoji here
}
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Code Style

- React functional components with hooks
- Inline CSS-in-JS styling
- No TypeScript (JavaScript with JSX)
- ESLint not configured (follows React best practices)

## Contributing

Contributions are welcome! This is a community-driven project.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Roadmap

Potential future enhancements:
- [ ] Real-time updates via Supabase subscriptions
- [ ] User profiles and contribution history
- [ ] More sports support
- [ ] Calendar integration
- [ ] Notifications for favorite teams
- [ ] Mobile app (React Native)

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or suggestions:
- Create an issue in the repository
- Check [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for detailed documentation

## Acknowledgments

- Built with React and Vite
- Powered by Supabase
- Icons: Custom SVG implementation
- Design: Dark theme with glassmorphism effects

---

**Made with ⚽ for sports fans worldwide**
