#!/usr/bin/env node
'use strict'

/**
 * Cria os torneios Cascatinha - Misto e Cascatinha - Masculino no Supabase.
 *
 * Uso:
 *   node scripts/seed-cascatinha-tournaments.js
 *
 * Variáveis (lidas do .env ou ambiente):
 *   VITE_SUPABASE_URL ou SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (obrigatória para bypass de RLS)
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(ROOT, '.env'), 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env opcional se variáveis já estiverem no ambiente
  }
}

loadEnvFile()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    'Defina SUPABASE_SERVICE_ROLE_KEY e VITE_SUPABASE_URL (ou SUPABASE_URL) no .env ou ambiente.',
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const TIE_BREAKER_ORDER = [
  'head_to_head',
  'sets_average_inner',
  'points_average_inner',
  'sets_average_global',
  'points_average_global',
  'random_draw',
]

const GROUP_MATCH_CONFIG = {
  points_per_set: [21],
  side_switch_sum: [7],
  best_of: 1,
}

const FINALS_MATCH_CONFIG = {
  points_per_set: [15, 15, 10],
  side_switch_sum: [5, 5, 5],
  best_of: 3,
}

const BASE_DATE = '2026-06-21'
const BASE_HOUR = 8
const BASE_MINUTE = 0
const MATCH_INTERVAL_MINUTES = 25

/** Horário "de parede" local — o app ignora timezone ao exibir (parseLocalDateTime). */
function scheduledAt(matchIndex) {
  const totalMinutes = BASE_MINUTE + (matchIndex - 1) * MATCH_INTERVAL_MINUTES
  const hours = BASE_HOUR + Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${BASE_DATE}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

async function deleteExistingByName(name) {
  const { data: existing } = await supabase.from('tournaments').select('id').eq('name', name)
  if (!existing?.length) return

  for (const row of existing) {
    const { data: tt } = await supabase
      .from('tournament_teams')
      .select('team_id')
      .eq('tournament_id', row.id)
    const teamIds = [...new Set((tt || []).map((t) => t.team_id))]

    await supabase.from('matches').delete().eq('tournament_id', row.id)
    await supabase.from('tournament_teams').delete().eq('tournament_id', row.id)
    await supabase.from('tournaments').delete().eq('id', row.id)

    if (teamIds.length) {
      await supabase.from('teams').delete().in('id', teamIds)
    }
  }
  console.log(`Removido torneio existente: ${name}`)
}

async function createTeams(teamDefs) {
  const { data, error } = await supabase
    .from('teams')
    .insert(
      teamDefs.map((t) => ({
        name: t.name,
        player_a: t.playerA,
        player_b: t.playerB,
      })),
    )
    .select('id, name')

  if (error) throw error
  return data
}

async function createTournamentRecord(config) {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name: config.name,
      location: 'Cascatinha',
      start_date: '2026-06-21',
      end_date: '2026-06-21',
      category: config.category,
      modality: 'dupla',
      status: 'upcoming',
      format_id: config.formatId,
      tie_breaker_order: TIE_BREAKER_ORDER,
      include_third_place: true,
      match_format_groups: 'melhorDe1',
      match_format_quarterfinals: 'melhorDe3_15_10',
      match_format_semifinals: 'melhorDe3_15_10',
      match_format_final: 'melhorDe3_15_10',
      match_format_third_place: 'melhorDe3_15_10',
      has_statistics: true,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

async function linkTeams(tournamentId, teamDefs, createdTeams) {
  const nameToId = new Map(createdTeams.map((t) => [t.name, t.id]))
  const payload = teamDefs.map((def) => ({
    tournament_id: tournamentId,
    team_id: nameToId.get(def.name),
    seed: def.seed,
    group_label: def.groupLabel,
  }))

  const { error } = await supabase.from('tournament_teams').insert(payload)
  if (error) throw error
  return nameToId
}

async function insertMatches(tournamentId, matches, nameToId, modality) {
  const payload = matches.map((m) => {
    const teamAId = typeof m.teamA === 'string' ? nameToId.get(m.teamA) : m.teamA
    const teamBId = typeof m.teamB === 'string' ? nameToId.get(m.teamB) : m.teamB
    const config = m.finals ? FINALS_MATCH_CONFIG : GROUP_MATCH_CONFIG

    return {
      tournament_id: tournamentId,
      team_a_id: teamAId,
      team_b_id: teamBId,
      phase: m.phase,
      scheduled_at: scheduledAt(m.gameNumber),
      status: 'scheduled',
      modality,
      direct_win_format: false,
      ...config,
    }
  })

  const { error } = await supabase.from('matches').insert(payload)
  if (error) throw error
}

const MASCULINO_TEAMS = [
  { seed: 1, groupLabel: 'Grupo A', name: 'Alemanha', playerA: 'Lucca Horta Barbosa', playerB: 'Lucas bastos lameira' },
  { seed: 3, groupLabel: 'Grupo A', name: 'Curaçau', playerA: 'José F Borges Júnior', playerB: 'Carlos Augusto Rezende' },
  { seed: 5, groupLabel: 'Grupo A', name: 'Holanda', playerA: 'Bernardo Milione', playerB: 'Mauro lucio' },
  { seed: 7, groupLabel: 'Grupo A', name: 'Japão', playerA: 'Kaio Andries', playerB: 'Davi Andries' },
  { seed: 9, groupLabel: 'Grupo A', name: 'Portugal', playerA: 'Rafael Valle', playerB: 'Guilherme Lelis' },
  { seed: 2, groupLabel: 'Grupo B', name: 'Argentina', playerA: 'Diego Ribas', playerB: 'Halley martins' },
  { seed: 4, groupLabel: 'Grupo B', name: 'Espanha', playerA: 'David Medeiros', playerB: 'Paulo Alves Dos Santos Filho' },
  { seed: 6, groupLabel: 'Grupo B', name: 'França', playerA: 'Marcos Oliveira', playerB: 'Anderson mozão' },
  { seed: 8, groupLabel: 'Grupo B', name: 'Inglaterra', playerA: 'Igor Canedo', playerB: 'André Canedo' },
  { seed: 10, groupLabel: 'Grupo B', name: 'República Tcheca', playerA: 'ROBERTO COUTINHO FERREIRA', playerB: 'Paulo Rogério' },
]

const MASCULINO_PLACEHOLDERS = [
  { name: '1º Grupo A', playerA: 'A definir', playerB: 'A definir' },
  { name: '2º Grupo A', playerA: 'A definir', playerB: 'A definir' },
  { name: '1º Grupo B', playerA: 'A definir', playerB: 'A definir' },
  { name: '2º Grupo B', playerA: 'A definir', playerB: 'A definir' },
  { name: 'Perdedor Semifinal 1', playerA: 'A definir', playerB: 'A definir' },
  { name: 'Perdedor Semifinal 2', playerA: 'A definir', playerB: 'A definir' },
  { name: 'Vencedor Semifinal 1', playerA: 'A definir', playerB: 'A definir' },
  { name: 'Vencedor Semifinal 2', playerA: 'A definir', playerB: 'A definir' },
]

const MASCULINO_MATCHES = [
  { gameNumber: 1, phase: 'Fase de Grupos', teamA: 'Japão', teamB: 'Portugal' },
  { gameNumber: 2, phase: 'Fase de Grupos', teamA: 'França', teamB: 'República Tcheca' },
  { gameNumber: 3, phase: 'Fase de Grupos', teamA: 'Alemanha', teamB: 'Curaçau' },
  { gameNumber: 4, phase: 'Fase de Grupos', teamA: 'Argentina', teamB: 'Inglaterra' },
  { gameNumber: 5, phase: 'Fase de Grupos', teamA: 'Holanda', teamB: 'Japão' },
  { gameNumber: 6, phase: 'Fase de Grupos', teamA: 'França', teamB: 'Espanha' },
  { gameNumber: 7, phase: 'Fase de Grupos', teamA: 'Curaçau', teamB: 'Portugal' },
  { gameNumber: 8, phase: 'Fase de Grupos', teamA: 'Inglaterra', teamB: 'República Tcheca' },
  { gameNumber: 9, phase: 'Fase de Grupos', teamA: 'Alemanha', teamB: 'Holanda' },
  { gameNumber: 10, phase: 'Fase de Grupos', teamA: 'Argentina', teamB: 'Espanha' },
  { gameNumber: 11, phase: 'Fase de Grupos', teamA: 'Curaçau', teamB: 'Japão' },
  { gameNumber: 12, phase: 'Fase de Grupos', teamA: 'Inglaterra', teamB: 'França' },
  { gameNumber: 13, phase: 'Fase de Grupos', teamA: 'Alemanha', teamB: 'Portugal' },
  { gameNumber: 14, phase: 'Fase de Grupos', teamA: 'Argentina', teamB: 'República Tcheca' },
  { gameNumber: 15, phase: 'Fase de Grupos', teamA: 'Curaçau', teamB: 'Holanda' },
  { gameNumber: 16, phase: 'Fase de Grupos', teamA: 'Espanha', teamB: 'Inglaterra' },
  { gameNumber: 17, phase: 'Fase de Grupos', teamA: 'Alemanha', teamB: 'Japão' },
  { gameNumber: 18, phase: 'Fase de Grupos', teamA: 'Argentina', teamB: 'França' },
  { gameNumber: 19, phase: 'Fase de Grupos', teamA: 'Holanda', teamB: 'Portugal' },
  { gameNumber: 20, phase: 'Fase de Grupos', teamA: 'Espanha', teamB: 'República Tcheca' },
  { gameNumber: 21, phase: 'Semifinal', finals: true, teamA: '1º Grupo A', teamB: '2º Grupo B' },
  { gameNumber: 22, phase: 'Semifinal', finals: true, teamA: '1º Grupo B', teamB: '2º Grupo A' },
  { gameNumber: 23, phase: 'Disputa 3º lugar', finals: true, teamA: 'Perdedor Semifinal 1', teamB: 'Perdedor Semifinal 2' },
  { gameNumber: 24, phase: 'Final', finals: true, teamA: 'Vencedor Semifinal 1', teamB: 'Vencedor Semifinal 2' },
]

const MISTO_TEAMS = [
  { seed: 1, groupLabel: 'Grupo A', name: 'Egito', playerA: 'Elisa Zimmermann Teixeira', playerB: 'Ubirajara Teixeira' },
  { seed: 8, groupLabel: 'Grupo A', name: 'Canadá', playerA: 'Adelaine', playerB: 'Josemar Pereira' },
  { seed: 9, groupLabel: 'Grupo A', name: 'Inglaterra', playerA: 'Lívia Stehling', playerB: 'Lucca Horta Barbosa' },
  { seed: 2, groupLabel: 'Grupo B', name: 'Espanha', playerA: 'Mariah K. Nazare', playerB: 'Wiliam Marcelino Nazaré' },
  { seed: 7, groupLabel: 'Grupo B', name: 'Argentina', playerA: 'Simone Rodrigues', playerB: 'Roberto Coutinho Ferreira' },
  { seed: 10, groupLabel: 'Grupo B', name: 'Alemanha', playerA: 'Luiza Assad', playerB: 'Bernardo Milione' },
  { seed: 3, groupLabel: 'Grupo C', name: 'Austrália', playerA: 'Fabíola de Oliveira', playerB: 'Diego Ribas' },
  { seed: 6, groupLabel: 'Grupo C', name: 'Portugal', playerA: 'Thaciana Matos', playerB: 'Gustavo Alves' },
  { seed: 11, groupLabel: 'Grupo C', name: 'Uzbequistão', playerA: 'Karla', playerB: 'Bruno' },
  { seed: 4, groupLabel: 'Grupo D', name: 'Japão', playerA: 'Elisa Xavier', playerB: 'Marcos Oliveira' },
  { seed: 5, groupLabel: 'Grupo D', name: 'Holanda', playerA: 'Letícia Beire Barletta', playerB: 'Kaio Andries' },
  { seed: 12, groupLabel: 'Grupo D', name: 'França', playerA: 'Sofia Andrade de Mendonça', playerB: 'Rafael Mendonça' },
]

const MISTO_MATCHES = [
  { gameNumber: 1, phase: 'Fase de Grupos', teamA: 'Egito', teamB: 'Canadá' },
  { gameNumber: 2, phase: 'Fase de Grupos', teamA: 'Portugal', teamB: 'Uzbequistão' },
  { gameNumber: 3, phase: 'Fase de Grupos', teamA: 'Espanha', teamB: 'Alemanha' },
  { gameNumber: 4, phase: 'Fase de Grupos', teamA: 'Japão', teamB: 'Holanda' },
  { gameNumber: 5, phase: 'Fase de Grupos', teamA: 'Canadá', teamB: 'Inglaterra' },
  { gameNumber: 6, phase: 'Fase de Grupos', teamA: 'Argentina', teamB: 'Espanha' },
  { gameNumber: 7, phase: 'Fase de Grupos', teamA: 'Austrália', teamB: 'Portugal' },
  { gameNumber: 8, phase: 'Fase de Grupos', teamA: 'Holanda', teamB: 'França' },
  { gameNumber: 9, phase: 'Fase de Grupos', teamA: 'Egito', teamB: 'Inglaterra' },
  { gameNumber: 10, phase: 'Fase de Grupos', teamA: 'Argentina', teamB: 'Alemanha' },
  { gameNumber: 11, phase: 'Fase de Grupos', teamA: 'Austrália', teamB: 'Uzbequistão' },
  { gameNumber: 12, phase: 'Fase de Grupos', teamA: 'Japão', teamB: 'França' },
]

async function seedMasculino() {
  const name = 'Cascatinha - Masculino'
  await deleteExistingByName(name)

  const allTeamDefs = [...MASCULINO_TEAMS, ...MASCULINO_PLACEHOLDERS]
  const createdTeams = await createTeams(allTeamDefs)
  const tournamentId = await createTournamentRecord({
    name,
    category: 'M',
    formatId: '2_groups_5_semis',
  })
  const nameToId = await linkTeams(tournamentId, MASCULINO_TEAMS, createdTeams)
  for (const t of createdTeams) {
    if (MASCULINO_PLACEHOLDERS.some((p) => p.name === t.name)) {
      nameToId.set(t.name, t.id)
    }
  }

  await insertMatches(tournamentId, MASCULINO_MATCHES, nameToId, 'dupla')
  console.log(`✓ ${name} (${MASCULINO_MATCHES.length} jogos)`)
  return tournamentId
}

async function seedMisto() {
  const name = 'Cascatinha - Misto'
  await deleteExistingByName(name)

  const createdTeams = await createTeams(MISTO_TEAMS)
  const tournamentId = await createTournamentRecord({
    name,
    category: 'Misto',
    formatId: 'groups_and_knockout',
  })
  const nameToId = await linkTeams(tournamentId, MISTO_TEAMS, createdTeams)
  await insertMatches(tournamentId, MISTO_MATCHES, nameToId, 'dupla')
  console.log(`✓ ${name} (${MISTO_MATCHES.length} jogos de grupos)`)
  return tournamentId
}

async function main() {
  console.log('Criando torneios Cascatinha no Supabase...')
  const masculinoId = await seedMasculino()
  const mistoId = await seedMisto()
  console.log('\nConcluído!')
  console.log(`  Masculino: ${masculinoId}`)
  console.log(`  Misto:     ${mistoId}`)
}

main().catch((err) => {
  console.error('Erro:', err.message || err)
  process.exit(1)
})
