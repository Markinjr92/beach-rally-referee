// Tournament AI Assistant - public Edge Function.
// Receives a question + tournamentId and returns a grounded answer based on
// the tournament regulation (PDF text) and current standings/matches.
// Provider is configurable via AI_PROVIDER env var (gemini | groq | openai).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

import { callLLM, ProviderError, type ChatMessage } from './providers.ts';
import { buildContextSummary } from './standings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  tournamentId: z.string().uuid('tournamentId invalido'),
  question: z.string().trim().min(1, 'Pergunta vazia').max(500, 'Pergunta muito longa (max 500 caracteres)'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(10)
    .optional()
    .default([]),
});

// Hard cap for the regulation text included in the prompt.
// Gemini handles much more, but we cap it so swapping to Groq/OpenAI stays safe and cheap.
const REGULATION_TEXT_CAP = 60_000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Metodo nao permitido' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, message: 'Body invalido. Esperado JSON.' }, 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        message: 'Dados invalidos',
        errors: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      },
      400,
    );
  }

  const { tournamentId, question, history } = parsed.data;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, message: 'Servidor mal configurado (SUPABASE_URL/SERVICE_ROLE_KEY ausentes).' },
      500,
    );
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // 1. Tournament + regulation
  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select(
      'id, name, location, start_date, end_date, modality, format_id, status, regulation_text',
    )
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    return jsonResponse({ ok: false, message: 'Torneio nao encontrado.' }, 404);
  }

  const regulationText = (tournament.regulation_text ?? '').trim();
  if (!regulationText) {
    return jsonResponse(
      {
        ok: false,
        message:
          'O organizador ainda nao enviou o regulamento deste torneio. O assistente fica disponivel apenas apos o envio.',
      },
      409,
    );
  }
  const truncatedRegulation = regulationText.slice(0, REGULATION_TEXT_CAP);

  // 2. Matches + scores + teams
  const [matchesRes, teamsRes] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select('id, tournament_id, team_a_id, team_b_id, scheduled_at, court, phase, status')
      .eq('tournament_id', tournamentId)
      .order('scheduled_at', { ascending: true }),
    supabaseAdmin
      .from('tournament_teams')
      .select('team_id, group_label, teams(id, name)')
      .eq('tournament_id', tournamentId),
  ]);

  if (matchesRes.error) {
    return jsonResponse({ ok: false, message: `Erro ao carregar jogos: ${matchesRes.error.message}` }, 500);
  }
  if (teamsRes.error) {
    return jsonResponse({ ok: false, message: `Erro ao carregar equipes: ${teamsRes.error.message}` }, 500);
  }

  const matches = matchesRes.data ?? [];
  const teamsLink = (teamsRes.data ?? []) as Array<{
    team_id: string;
    group_label: string | null;
    teams: { id: string; name: string } | null;
  }>;

  let scores: Array<{
    match_id: string;
    set_number: number;
    team_a_points: number;
    team_b_points: number;
  }> = [];
  if (matches.length) {
    const matchIds = matches.map((m) => m.id);
    const { data: scoresData, error: scoresError } = await supabaseAdmin
      .from('match_scores')
      .select('match_id, set_number, team_a_points, team_b_points')
      .in('match_id', matchIds);
    if (scoresError) {
      return jsonResponse(
        { ok: false, message: `Erro ao carregar parciais: ${scoresError.message}` },
        500,
      );
    }
    scores = scoresData ?? [];
  }

  const tableSummary = buildContextSummary({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      location: tournament.location,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      modality: tournament.modality,
      format_id: tournament.format_id,
      status: tournament.status,
    },
    matches,
    scores,
    teamsLink,
  });

  // 3. System prompt (restritivo)
  const systemPrompt = [
    `Voce e um assistente que responde EXCLUSIVAMENTE sobre o torneio "${tournament.name}".`,
    `Use APENAS o conteudo do REGULAMENTO e dos DADOS DO TORNEIO fornecidos abaixo.`,
    `Se a pergunta nao for sobre este torneio especifico (regras, formato, equipes, jogos, classificacao, horarios, locais, premiacao),`,
    `responda EXATAMENTE com a frase: "Desculpe, so posso responder perguntas sobre o torneio ${tournament.name}."`,
    `Nao invente dados. Se a informacao nao estiver no regulamento ou nos dados, diga claramente que nao tem essa informacao.`,
    `Responda em portugues brasileiro, de forma curta, direta e cordial.`,
    ``,
    `==== REGULAMENTO DO TORNEIO ====`,
    truncatedRegulation,
    ``,
    `==== DADOS ATUAIS DO TORNEIO ====`,
    tableSummary,
  ].join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...((history ?? []).slice(-6) as ChatMessage[]),
    { role: 'user', content: question },
  ];

  // 4. Call provider
  try {
    const answer = await callLLM(messages);
    if (!answer) {
      return jsonResponse({ ok: false, message: 'O modelo nao retornou resposta.' }, 502);
    }
    return jsonResponse({
      ok: true,
      answer,
      provider: (Deno.env.get('AI_PROVIDER') ?? 'gemini').toLowerCase(),
      model: Deno.env.get('AI_MODEL') ?? null,
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error('Provider error', { status: error.status, message: error.message, details: error.details });
      return jsonResponse(
        { ok: false, message: error.message },
        error.status >= 400 && error.status < 600 ? error.status : 502,
      );
    }
    console.error('Erro inesperado', error);
    return jsonResponse(
      { ok: false, message: error instanceof Error ? error.message : 'Erro desconhecido' },
      500,
    );
  }
});
