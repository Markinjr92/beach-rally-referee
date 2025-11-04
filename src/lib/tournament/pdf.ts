import { Tournament, TieBreakerCriterion } from '@/types/volleyball';

export interface RegulationTemplateOptions {
  customRules?: string[];
  additionalNotes?: string;
}

const translateTieBreaker = (criterion: TieBreakerCriterion): string => {
  switch (criterion) {
    case 'head_to_head':
      return 'Confronto direto (apenas quando houver exatamente 2 equipes empatadas)';
    case 'sets_average_inner':
      return 'Average de sets entre empatadas (sets vencidos / sets perdidos)';
    case 'points_average_inner':
      return 'Average de pontos entre empatadas (pontos a favor / pontos contra)';
    case 'sets_average_global':
      return 'Average de sets considerando todos os jogos da fase/grupo';
    case 'points_average_global':
      return 'Average de pontos considerando todos os jogos da fase/grupo';
    case 'random_draw':
      return 'Sorteio';
    default:
      return criterion;
  }
};

const formatDate = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const buildTieBreakerList = (criteria: TieBreakerCriterion[] | undefined) => {
  const order = criteria?.length ? criteria : [];
  if (!order.length) {
    return '<li>Ordem padrão: confronto direto, average de sets entre empatadas, average de pontos entre empatadas, average de sets geral, average de pontos geral e sorteio.</li>';
  }

  return order.map((criterion) => `<li>${translateTieBreaker(criterion)}</li>`).join('');
};

const buildCustomRules = (rules?: string[]) => {
  if (!rules || rules.length === 0) {
    return '';
  }

  return `
    <section>
      <h2>Regras adicionais</h2>
      <ol>
        ${rules.map((rule) => `<li>${rule}</li>`).join('')}
      </ol>
    </section>
  `;
};

const buildTeamsTable = (tournament: Tournament) => {
  const teams = tournament.teams ?? [];
  if (!teams.length) return '';

  const rows = teams
    .sort((a, b) => a.seed - b.seed)
    .map(
      (entry) => `
        <tr>
          <td>${entry.seed}</td>
          <td>${entry.team.name}</td>
          <td>${entry.team.players?.map((player) => player.name).join(' / ') ?? ''}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <section>
      <h2>Duplas inscritas</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Seed</th>
            <th>Dupla</th>
            <th>Atletas</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
};

export const buildTournamentRegulationHtml = (
  tournament: Tournament,
  options?: RegulationTemplateOptions,
): string => {
  const tieBreakerList = buildTieBreakerList(tournament.tieBreakerOrder);
  const customRules = buildCustomRules(options?.customRules);
  const teamsTable = buildTeamsTable(tournament);
  const notesBlock = options?.additionalNotes
    ? `<section><h2>Observações</h2><p>${options.additionalNotes}</p></section>`
    : '';

  const formatName = tournament.formatId ?? 'Formato personalizado';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Regulamento - ${tournament.name}</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #1f2937;
            padding: 32px 48px;
            line-height: 1.6;
          }
          h1 {
            font-size: 28px;
            margin-bottom: 8px;
          }
          h2 {
            font-size: 20px;
            margin-top: 32px;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #111827;
          }
          h3 {
            font-size: 16px;
            margin-top: 16px;
            margin-bottom: 8px;
            font-weight: 600;
            color: #2563eb;
          }
          section {
            margin-bottom: 24px;
          }
          .metadata {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            margin-top: 16px;
          }
          .metadata div {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 12px 16px;
          }
          ul, ol {
            padding-left: 24px;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          .table th, .table td {
            border: 1px solid #d1d5db;
            padding: 8px 12px;
          }
          .table th {
            background: #e5e7eb;
            text-align: left;
          }
          .signature-block {
            margin-top: 48px;
            display: flex;
            justify-content: space-between;
            gap: 32px;
          }
          .signature-line {
            flex: 1;
            border-top: 1px solid #4b5563;
            padding-top: 8px;
            text-align: center;
            color: #4b5563;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>${tournament.name}</h1>
          <p>Regulamento oficial do torneio.</p>
          <div class="metadata">
            <div>
              <strong>Local</strong>
              <p>${tournament.location}</p>
            </div>
            <div>
              <strong>Período</strong>
              <p>${formatDate(tournament.startDate)} até ${formatDate(tournament.endDate)}</p>
            </div>
            <div>
              <strong>Formato</strong>
              <p>${formatName}</p>
            </div>
          </div>
        </header>

        <section>
          <h2>Configuração de partidas</h2>
          <h3>Pontuação por resultado</h3>
          <ul>
            <li>Vitória por 2–0: 3 pontos</li>
            <li>Vitória por 2–1: 2 pontos</li>
            <li>Derrota por 1–2: 1 ponto</li>
            <li>Derrota por 0–2: 0 pontos</li>
            <li>Partidas em set único: 3 pontos para o vencedor, 0 para o derrotado</li>
          </ul>

          <h3>Criterios de desempate</h3>
          <ol>${tieBreakerList}</ol>
        </section>

        <section>
          <h2>Estrutura do torneio</h2>
          <p>O torneio é composto pelo formato <strong>${formatName}</strong> com integração total à configuração de mesa padrão do Beach Rally Referee.</p>
          <p>Todos os jogos devem ser gerados através do módulo de gestão de torneios, garantindo alinhamento com o painel de arbitragem e sincronização das estatísticas.</p>
        </section>

        ${teamsTable}
        ${customRules}
        ${notesBlock}

        <section>
          <h2>Responsáveis</h2>
          <div class="signature-block">
            <div class="signature-line">Coordenação Técnica</div>
            <div class="signature-line">Organização</div>
            <div class="signature-line">Representante de Arbitragem</div>
          </div>
        </section>
      </body>
    </html>
  `;
};

export const downloadTournamentRegulationPdf = (
  tournament: Tournament,
  options?: RegulationTemplateOptions,
) => {
  const html = buildTournamentRegulationHtml(tournament, options);
  const popup = window.open('', '_blank', 'noopener');
  if (!popup) {
    throw new Error('Não foi possível abrir uma nova janela para gerar o PDF.');
  }

  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => {
    popup.print();
  }, 250);
};
