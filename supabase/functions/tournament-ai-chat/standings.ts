// Compact summary of a tournament's matches and standings, formatted as plain text
// for the LLM context. Kept simple on purpose to save tokens.

interface TournamentRow {
  id: string;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  modality: string | null;
  format_id: string | null;
  status: string | null;
}

interface MatchRow {
  id: string;
  tournament_id: string;
  team_a_id: string | null;
  team_b_id: string | null;
  scheduled_at: string | null;
  court: string | null;
  phase: string | null;
  status: string | null;
}

interface MatchScoreRow {
  match_id: string;
  set_number: number;
  team_a_points: number;
  team_b_points: number;
}

interface TournamentTeamRow {
  team_id: string;
  group_label: string | null;
  teams: { id: string; name: string } | null;
}

const COMPLETED_STATUSES = new Set(['completed', 'finished', 'finalizado', 'encerrado']);
const LIVE_STATUSES = new Set(['live', 'in_progress', 'em_andamento']);

// Replica a logica de src/utils/date.ts: descarta o timezone presente no ISO
// e formata os componentes (data/hora) literalmente como aparece no front.
// Importante para que a IA fale o mesmo horario que o usuario ve nos cards.
const TIMEZONE_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;

function formatDateTime(iso: string | null): string {
  if (!iso) return 'horario nao definido';

  const trimmed = String(iso).trim();
  if (!trimmed) return 'horario nao definido';

  const normalized = trimmed.replace(' ', 'T');
  const [datePartRaw, timePartRaw = ''] = normalized.split('T');
  if (!datePartRaw) return iso;

  const [yearStr, monthStr, dayStr] = datePartRaw.split('-');
  if (!yearStr || !monthStr || !dayStr) return iso;

  const timeWithoutTz = timePartRaw.replace(TIMEZONE_PATTERN, '');
  const [hourStr = '00', minuteStr = '00'] = timeWithoutTz.split(':');

  const dd = dayStr.padStart(2, '0');
  const mm = monthStr.padStart(2, '0');
  const yyyy = yearStr.padStart(4, '0');
  const hh = hourStr.padStart(2, '0');
  const mi = minuteStr.padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function formatScores(scores: MatchScoreRow[]): string {
  if (!scores.length) return '';
  const sorted = [...scores].sort((a, b) => a.set_number - b.set_number);
  return sorted.map((s) => `${s.team_a_points}x${s.team_b_points}`).join(' / ');
}

function setsWonFromScores(scores: MatchScoreRow[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of scores) {
    if (s.team_a_points > s.team_b_points) a++;
    else if (s.team_b_points > s.team_a_points) b++;
  }
  return { a, b };
}

interface StandingsEntry {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
  matchPoints: number;
}

function ensureEntry(map: Map<string, StandingsEntry>, teamId: string, teamName: string): StandingsEntry {
  let entry = map.get(teamId);
  if (!entry) {
    entry = {
      teamId,
      teamName,
      played: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      matchPoints: 0,
    };
    map.set(teamId, entry);
  } else if (teamName) {
    entry.teamName = teamName;
  }
  return entry;
}

function sortStandings(entries: StandingsEntry[]): StandingsEntry[] {
  return [...entries].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    const setDiffA = a.setsWon - a.setsLost;
    const setDiffB = b.setsWon - b.setsLost;
    if (setDiffB !== setDiffA) return setDiffB - setDiffA;
    const pointDiffA = a.pointsFor - a.pointsAgainst;
    const pointDiffB = b.pointsFor - b.pointsAgainst;
    if (pointDiffB !== pointDiffA) return pointDiffB - pointDiffA;
    return a.teamName.localeCompare(b.teamName, 'pt-BR');
  });
}

export function buildContextSummary(args: {
  tournament: TournamentRow;
  matches: MatchRow[];
  scores: MatchScoreRow[];
  teamsLink: TournamentTeamRow[];
}): string {
  const { tournament, matches, scores, teamsLink } = args;

  const teamNameById = new Map<string, string>();
  const teamGroupById = new Map<string, string | null>();
  for (const link of teamsLink) {
    if (link.teams) {
      teamNameById.set(link.team_id, link.teams.name);
    }
    teamGroupById.set(link.team_id, link.group_label ?? null);
  }

  const scoresByMatch = new Map<string, MatchScoreRow[]>();
  for (const s of scores) {
    const arr = scoresByMatch.get(s.match_id);
    if (arr) arr.push(s);
    else scoresByMatch.set(s.match_id, [s]);
  }

  const teamLabel = (id: string | null) =>
    id ? teamNameById.get(id) ?? `Equipe ${id.slice(0, 6)}` : '(equipe nao definida)';

  // ---- Matches by status ----
  const completed: MatchRow[] = [];
  const live: MatchRow[] = [];
  const upcoming: MatchRow[] = [];
  for (const m of matches) {
    const status = (m.status ?? '').toLowerCase();
    if (COMPLETED_STATUSES.has(status)) completed.push(m);
    else if (LIVE_STATUSES.has(status)) live.push(m);
    else upcoming.push(m);
  }

  // Most recent completed first; nearest upcoming first
  completed.sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''));
  upcoming.sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));

  const lines: string[] = [];

  lines.push(`TORNEIO: ${tournament.name}`);
  if (tournament.location) lines.push(`Local: ${tournament.location}`);
  if (tournament.modality) lines.push(`Modalidade: ${tournament.modality}`);
  if (tournament.start_date || tournament.end_date) {
    const start = tournament.start_date ? formatDateTime(tournament.start_date) : '?';
    const end = tournament.end_date ? formatDateTime(tournament.end_date) : '?';
    lines.push(`Periodo: ${start} ate ${end}`);
  }
  if (tournament.status) lines.push(`Status: ${tournament.status}`);
  lines.push(`Total de equipes inscritas: ${teamsLink.length}`);
  lines.push('');

  // ---- Live matches ----
  if (live.length) {
    lines.push('JOGOS EM ANDAMENTO:');
    for (const m of live) {
      const sc = scoresByMatch.get(m.id) ?? [];
      const sets = setsWonFromScores(sc);
      lines.push(
        `- [${m.phase ?? 'fase'}] ${teamLabel(m.team_a_id)} ${sets.a}x${sets.b} ${teamLabel(m.team_b_id)}` +
          `${sc.length ? ` (${formatScores(sc)})` : ''}` +
          `${m.court ? ` - quadra ${m.court}` : ''}`,
      );
    }
    lines.push('');
  }

  // ---- Upcoming (next 8) ----
  if (upcoming.length) {
    lines.push('PROXIMOS JOGOS:');
    for (const m of upcoming.slice(0, 8)) {
      lines.push(
        `- ${formatDateTime(m.scheduled_at)} - [${m.phase ?? 'fase'}] ` +
          `${teamLabel(m.team_a_id)} x ${teamLabel(m.team_b_id)}` +
          `${m.court ? ` - quadra ${m.court}` : ''}`,
      );
    }
    lines.push('');
  }

  // ---- Last results (last 10) ----
  if (completed.length) {
    lines.push('ULTIMOS RESULTADOS:');
    for (const m of completed.slice(0, 10)) {
      const sc = scoresByMatch.get(m.id) ?? [];
      const sets = setsWonFromScores(sc);
      lines.push(
        `- [${m.phase ?? 'fase'}] ${teamLabel(m.team_a_id)} ${sets.a}x${sets.b} ${teamLabel(m.team_b_id)}` +
          `${sc.length ? ` (parciais ${formatScores(sc)})` : ''}`,
      );
    }
    lines.push('');
  }

  // ---- Standings by group (only from completed matches in 'group' phase or when phase null) ----
  const groupMatches = completed.filter((m) => {
    const phase = (m.phase ?? '').toLowerCase();
    return phase.includes('grupo') || phase === '' || phase === 'group';
  });

  if (groupMatches.length) {
    const standingsByGroup = new Map<string, Map<string, StandingsEntry>>();
    for (const m of groupMatches) {
      if (!m.team_a_id || !m.team_b_id) continue;
      const group = teamGroupById.get(m.team_a_id) ?? teamGroupById.get(m.team_b_id) ?? 'Geral';
      let groupMap = standingsByGroup.get(group);
      if (!groupMap) {
        groupMap = new Map();
        standingsByGroup.set(group, groupMap);
      }
      const entryA = ensureEntry(groupMap, m.team_a_id, teamLabel(m.team_a_id));
      const entryB = ensureEntry(groupMap, m.team_b_id, teamLabel(m.team_b_id));

      const sc = scoresByMatch.get(m.id) ?? [];
      if (!sc.length) continue;

      let pointsA = 0;
      let pointsB = 0;
      let setsWonA = 0;
      let setsWonB = 0;
      for (const s of sc) {
        pointsA += s.team_a_points;
        pointsB += s.team_b_points;
        if (s.team_a_points > s.team_b_points) setsWonA++;
        else if (s.team_b_points > s.team_a_points) setsWonB++;
      }
      entryA.played++;
      entryB.played++;
      entryA.setsWon += setsWonA;
      entryA.setsLost += setsWonB;
      entryB.setsWon += setsWonB;
      entryB.setsLost += setsWonA;
      entryA.pointsFor += pointsA;
      entryA.pointsAgainst += pointsB;
      entryB.pointsFor += pointsB;
      entryB.pointsAgainst += pointsA;
      if (setsWonA > setsWonB) {
        entryA.wins++;
        entryB.losses++;
        entryA.matchPoints += setsWonB === 0 ? 3 : 2;
        entryB.matchPoints += setsWonB === 0 ? 0 : 1;
      } else if (setsWonB > setsWonA) {
        entryB.wins++;
        entryA.losses++;
        entryB.matchPoints += setsWonA === 0 ? 3 : 2;
        entryA.matchPoints += setsWonA === 0 ? 0 : 1;
      }
    }

    if (standingsByGroup.size) {
      lines.push('CLASSIFICACAO POR GRUPO:');
      const sortedGroups = Array.from(standingsByGroup.entries()).sort(([a], [b]) =>
        a.localeCompare(b, 'pt-BR'),
      );
      for (const [groupLabel, statsMap] of sortedGroups) {
        lines.push(`Grupo ${groupLabel}:`);
        const sorted = sortStandings(Array.from(statsMap.values()));
        sorted.forEach((entry, idx) => {
          lines.push(
            `  ${idx + 1}. ${entry.teamName} - ${entry.matchPoints} pts (${entry.wins}V/${entry.losses}D, sets ${entry.setsWon}-${entry.setsLost}, pts ${entry.pointsFor}-${entry.pointsAgainst})`,
          );
        });
      }
      lines.push('');
    }
  }

  if (!live.length && !upcoming.length && !completed.length) {
    lines.push('Ainda nao ha jogos cadastrados neste torneio.');
  }

  return lines.join('\n');
}
