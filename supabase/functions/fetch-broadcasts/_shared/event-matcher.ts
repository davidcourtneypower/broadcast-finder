/**
 * Event Matcher
 * Matches TheSportsDB TV events to database fixtures using fuzzy matching
 */

import { TheSportsDBTVEvent } from './thesportsdb-client.ts';
import { TheSportsDBSportConfig } from './thesportsdb-config.ts';

export interface DatabaseMatch {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  match_date: string;
  match_time: string;
}

export interface MatchDetails {
  homeTeamScore: number;
  awayTeamScore: number;
  dateScore: number;
  timeScore: number;
  leagueScore: number;
}

export interface MatchCandidate {
  match: DatabaseMatch;
  score: number;
  matchDetails: MatchDetails;
}

export class EventMatcher {
  /** Minimum score threshold for a valid match (0-100) */
  private static MIN_MATCH_SCORE = 70;

  /**
   * Find the best matching database fixture for a TheSportsDB event
   */
  static findBestMatch(
    sportsdbEvent: TheSportsDBTVEvent,
    dbMatches: DatabaseMatch[],
    sportConfig: TheSportsDBSportConfig
  ): MatchCandidate | null {
    const candidates: MatchCandidate[] = [];

    for (const match of dbMatches) {
      const scoreResult = this.calculateMatchScore(sportsdbEvent, match, sportConfig);

      if (scoreResult.total >= this.MIN_MATCH_SCORE) {
        candidates.push({
          match,
          score: scoreResult.total,
          matchDetails: scoreResult.details
        });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Return highest scoring match
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  /**
   * Calculate match score between TheSportsDB event and database fixture
   */
  private static calculateMatchScore(
    event: TheSportsDBTVEvent,
    match: DatabaseMatch,
    config: TheSportsDBSportConfig
  ): { total: number; details: MatchDetails } {
    const homeScore = this.compareTeamNames(
      event.strHomeTeam,
      match.home,
      config.teamNameNormalizations
    );

    const awayScore = this.compareTeamNames(
      event.strAwayTeam,
      match.away,
      config.teamNameNormalizations
    );

    const dateScore = this.compareDates(event.dateEvent, match.match_date);
    const timeScore = this.compareTimes(event.strTime, match.match_time);
    const leagueScore = this.compareLeagues(
      event.strLeague,
      match.league,
      config.leagueNameMappings
    );

    // Weighted scoring:
    // - Team names are most important (35% each = 70% total)
    // - Time provides additional confidence (15%)
    // - League matching provides final validation (15%)
    // - Date must match exactly (gate condition)
    const weightedScore = (
      homeScore * 0.35 +
      awayScore * 0.35 +
      timeScore * 0.15 +
      leagueScore * 0.15
    );

    // Date must match - acts as gate condition
    const total = dateScore > 0.9 ? Math.round(weightedScore * 100) : 0;

    return {
      total,
      details: {
        homeTeamScore: Math.round(homeScore * 100),
        awayTeamScore: Math.round(awayScore * 100),
        dateScore: Math.round(dateScore * 100),
        timeScore: Math.round(timeScore * 100),
        leagueScore: Math.round(leagueScore * 100)
      }
    };
  }

  /**
   * Compare team names using normalization and Levenshtein distance
   */
  private static compareTeamNames(
    name1: string,
    name2: string,
    normalizations: Record<string, string>
  ): number {
    if (!name1 || !name2) return 0;

    const normalized1 = this.normalizeTeamName(name1, normalizations);
    const normalized2 = this.normalizeTeamName(name2, normalizations);

    // Exact match after normalization
    if (normalized1 === normalized2) return 1.0;

    // Check if one contains the other (handles partial matches)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.9;
    }

    // Calculate similarity using Levenshtein distance
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLen = Math.max(normalized1.length, normalized2.length);

    if (maxLen === 0) return 0;

    const similarity = 1 - (distance / maxLen);
    return similarity;
  }

  /**
   * Normalize team name for comparison
   */
  private static normalizeTeamName(
    name: string,
    normalizations: Record<string, string>
  ): string {
    let normalized = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim();

    // Apply known normalizations
    for (const [pattern, replacement] of Object.entries(normalizations)) {
      if (normalized.includes(pattern)) {
        normalized = normalized.replace(pattern, replacement);
      }
    }

    // Remove common team suffixes
    const suffixes = [
      ' fc', ' cf', ' afc', ' sc', ' ac', ' as', ' ss',
      ' bk', ' bc', ' united', ' city'
    ];

    for (const suffix of suffixes) {
      if (normalized.endsWith(suffix)) {
        normalized = normalized.slice(0, -suffix.length).trim();
      }
    }

    // Also handle prefix versions
    const prefixes = ['fc ', 'cf ', 'afc ', 'sc ', 'ac ', 'as '];
    for (const prefix of prefixes) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length).trim();
      }
    }

    return normalized;
  }

  /**
   * Compare dates (must be exact match)
   */
  private static compareDates(date1: string, date2: string): number {
    if (!date1 || !date2) return 0;

    // Normalize to YYYY-MM-DD format
    const d1 = date1.split('T')[0];
    const d2 = date2.split('T')[0];

    return d1 === d2 ? 1.0 : 0.0;
  }

  /**
   * Compare times with tolerance
   */
  private static compareTimes(time1: string, time2: string): number {
    if (!time1 || !time2) return 0.5; // Neutral if missing

    // Parse times (handle HH:MM:SS or HH:MM format)
    const parseTime = (t: string): number => {
      const parts = t.split(':').map(Number);
      return parts[0] * 60 + (parts[1] || 0);
    };

    try {
      const mins1 = parseTime(time1);
      const mins2 = parseTime(time2);
      const diff = Math.abs(mins1 - mins2);

      if (diff === 0) return 1.0;
      if (diff <= 15) return 0.9;  // Within 15 minutes
      if (diff <= 30) return 0.7;  // Within 30 minutes
      if (diff <= 60) return 0.5;  // Within 1 hour
      if (diff <= 120) return 0.3; // Within 2 hours (timezone issues)
      return 0.0;
    } catch {
      return 0.5; // Neutral on parse error
    }
  }

  /**
   * Compare league names
   */
  private static compareLeagues(
    league1: string,
    league2: string,
    mappings: Record<string, string>
  ): number {
    if (!league1 || !league2) return 0.5; // Neutral if missing

    // Apply mappings
    const normalized1 = (mappings[league1] || league1).toLowerCase();
    const normalized2 = league2.toLowerCase();

    // Exact match
    if (normalized1 === normalized2) return 1.0;

    // Partial match (one contains the other)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.8;
    }

    // Check for common words
    const words1 = new Set(normalized1.split(/\s+/));
    const words2 = new Set(normalized2.split(/\s+/));
    const commonWords = [...words1].filter(w => words2.has(w) && w.length > 3);

    if (commonWords.length > 0) {
      return 0.6;
    }

    return 0.0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    // Create distance matrix
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // Initialize first column
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }

    // Initialize first row
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    // Fill in the rest
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }

    return dp[m][n];
  }
}
