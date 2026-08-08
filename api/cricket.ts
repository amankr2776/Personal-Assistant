import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecurityHeaders, checkRateLimitSync, handleOptions } from './_security';

interface CricketMatch {
  id: string;
  title: string;
  teams: string[];
  scores: string[];
  status: string;
  league: string;
  url: string;
  isLive: boolean;
}

// ESPN Scorepanel API — free, no key, returns structured data with scores
async function getCricketFromESPN(): Promise<CricketMatch[]> {
  try {
    const res = await fetch('https://site.web.api.espn.com/apis/site/v2/sports/cricket/scorepanel', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    const matches: CricketMatch[] = [];

    for (const scoreEntry of (data.scores || [])) {
      const leagueName = scoreEntry.leagues?.[0]?.name || 'Cricket';
      for (const ev of (scoreEntry.events || [])) {
        const name = ev.name || '';
        const statusType = ev.status?.type || {};
        const statusDetail = statusType.detail || statusType.description || '';
        const isLive = statusType.state === 'in' || /\b(live|in progress)\b/i.test(statusDetail);

        const teams: string[] = [];
        const scores: string[] = [];

        for (const comp of (ev.competitions || [])) {
          for (const team of (comp.competitors || [])) {
            const teamName = team.team?.displayName || team.team?.abbreviation || '';
            const teamAbbrev = team.team?.abbreviation || '';
            const score = team.score || '0';
            const linescores = team.linescores || [];

            // Get overs from linescores
            let overs = '';
            let wkts = '';
            let runs = score;
            for (const ls of linescores) {
              if (ls.overs) overs = ls.overs;
              if (ls.wkts) wkts = ls.wkts;
              if (ls.runs) runs = ls.runs.toString();
            }

            teams.push(teamName);
            // Build score string: "IND 287/4 (42.3 ov)"
            let scoreStr = `${teamAbbrev || teamName} ${runs}`;
            if (wkts) scoreStr += `/${wkts}`;
            if (overs) scoreStr += ` (${overs} ov)`;
            scores.push(scoreStr);
          }
        }

        matches.push({
          id: ev.id || '',
          title: name,
          teams,
          scores,
          status: statusDetail,
          league: leagueName,
          url: `https://www.espncricinfo.com/match/${ev.id}`,
          isLive,
        });
      }
    }

    return matches;
  } catch {
    return [];
  }
}

// Format matches as readable text for AI context
function formatMatchesForAI(matches: CricketMatch[], query: string): string {
  if (matches.length === 0) return 'No cricket match data available right now. Try again in a moment.';

  const q = query.toLowerCase();
  const lines: string[] = [];

  // Filter by keywords if user mentioned specific teams/tournaments
  const skipWords = /cricket|score|match|live|update|latest|kya|क्या|चल|scoreboard|ka|का|ke|के|ki|की|batao|बताओ|dikha|दिखा/gi;
  const keywords = q.replace(skipWords, '').trim().split(/\s+/).filter(k => k.length > 2);

  let filtered = matches;
  if (keywords.length > 0) {
    const specific = matches.filter(m =>
      keywords.some(kw =>
        m.title.toLowerCase().includes(kw) ||
        m.league.toLowerCase().includes(kw) ||
        m.teams.some(t => t.toLowerCase().includes(kw)) ||
        m.status.toLowerCase().includes(kw)
      )
    );
    if (specific.length > 0) filtered = specific;
  }

  // Prioritize live, then by relevance
  const live = filtered.filter(m => m.isLive);
  const completed = filtered.filter(m => !m.isLive && !/preview|scheduled/i.test(m.status));
  const upcoming = filtered.filter(m => /preview|scheduled/i.test(m.status));
  const sorted = [...live, ...completed, ...upcoming].slice(0, 12);

  for (const m of sorted) {
    const tag = m.isLive ? '🔴 LIVE' : '⚪';
    const scoreLine = m.scores.length > 0 ? m.scores.join(' vs ') : '';
    if (scoreLine) {
      lines.push(`${tag} ${scoreLine} — ${m.status} (${m.league})`);
    } else {
      lines.push(`${tag} ${m.title} — ${m.status} (${m.league})`);
    }
  }

  return lines.join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(req, res, { allowMethods: ['GET', 'OPTIONS'] });
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (await checkRateLimitSync(req, res, 'cricket', 30)) return;

  const query = (req.query.q as string || '').trim();
  const matches = await getCricketFromESPN();

  if (query) {
    const text = formatMatchesForAI(matches, query);
    return res.status(200).json({ matches, text, count: matches.length, source: 'espn' });
  }

  return res.status(200).json({ matches, count: matches.length, source: 'espn' });
}
