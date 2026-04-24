# Mapeamento técnico: modalidade **Trio** + formato de torneio **4 grupos (3-3-4-4) → Top 2 → Quartas/Semis/Final**

## 1) Diagnóstico rápido do estado atual

### Modalidade Trio
- Hoje o sistema tipa modalidade apenas como `dupla | quarteto` em tipos centrais (`GameConfiguration`) e em pontos de parsing/conversão.
- A montagem de atletas por equipe também está codificada para apenas 2 ou 4 atletas (`buildPlayersFromTeam`).
- No Referee, quase toda a rotação de saque já usa tamanho dinâmico da lista de jogadores, mas há pelo menos um ponto visual com regra fixa `dupla=2` e `outros=4`.

### Formato do torneio 3-3-4-4
- Não existe um formato cadastrado com 14 equipes em 4 grupos de tamanhos diferentes (3,3,4,4).
- O formato mais próximo é `groups_and_knockout`, porém ele exige exatamente 12 equipes, quatro grupos iguais de 3 e cruzamento diferente nas quartas.

---

## 2) Trio — alterações necessárias por camada

## 2.1 Tipos e parsing (obrigatório)

### Arquivos impactados
- `src/types/volleyball.ts`
- `src/utils/parsers.ts`
- `src/utils/teamPlayers.ts`
- `src/lib/casualMatches.ts` (se quiser trio também para jogos avulsos)

### Mudanças propostas
1. **Expandir unions de modalidade** para incluir `'trio'` (hoje está `'dupla' | 'quarteto'`).
2. **Atualizar parser de modalidade** para reconhecer `'trio'` (hoje qualquer valor diferente de `quarteto` cai em `dupla`).
3. **Atualizar builder de jogadores**:
   - `dupla`: jogadores 1 e 2
   - `trio`: jogadores 1, 2 e 3
   - `quarteto`: jogadores 1, 2, 3 e 4
4. **Validação de equipe por modalidade**:
   - trio deve exigir `player_c`
   - quarteto exige `player_c` e `player_d`

### Risco atual sem isso
- Torneio salvo como `trio` será interpretado como `dupla` em fluxos que usam `parseGameModality`.

---

## 2.2 Banco de dados (torneio/jogos)

### Para torneios e jogos de torneio
- **Não é obrigatório migration de enum/check para modalidade**: `tournaments.modality` e `matches.modality` estão em `text` sem check rígido.
- **Já existe `player_c` e `player_d` na tabela `teams`**, então trio pode reutilizar `player_c` e deixar `player_d` nulo.

### Para jogos avulsos (se escopo incluir casual)
- A tabela `casual_matches` tem `CHECK (modality IN ('dupla','quarteto'))`.
- Se trio também for suportado em jogos avulsos, aí sim precisa migration alterando esse check.

### Recomendação de banco (boas práticas)
1. Tornar regra de dados explícita por modalidade (trigger/check opcional):
   - `trio` → `player_c` obrigatório
   - `quarteto` → `player_c` e `player_d` obrigatórios
2. (Opcional) padronizar validação da modalidade com constraint em `tournaments`/`matches` para evitar strings inválidas.

---

## 2.3 Cadastro de torneio e equipes (obrigatório)

### Arquivo principal
- `src/pages/TournamentDetailDB.tsx`

### Mudanças propostas
1. Incluir `trio` nas opções de modalidade de criação/edição de torneio.
2. Ajustar formulário de equipes:
   - para trio: exibir e exigir `Jogador 3`
   - para quarteto: manter `Jogador 3` e `Jogador 4`
   - para dupla: apenas jogadores 1 e 2
3. Ajustar mensagens/textos que hoje assumem "dupla" ou regras só para quarteto.

---

## 2.4 Referee (controle de sacador com 3 jogadores)

### Arquivo principal
- `src/pages/RefereeDesk.tsx`

### Situação atual
- A configuração de ordem de saque já usa arrays de tamanho variável em vários trechos (`players.length`, `serviceOrder.length`), o que é bom para trio.
- Porém existe texto/preview de "próximo sacador" com cálculo fixo `dupla ? 2 : 4`, que quebraria para trio.

### Mudanças propostas
1. Criar helper único para total de sacadores por equipe (ex.: `getPlayerCountByTeam(team)` ou derivado de `serviceOrders[team].length`).
2. Substituir qualquer expressão fixa de módulo por cálculo dinâmico.
3. Revisar labels de UX para não ficarem presos em dupla/quarteto (ex.: modalização textual em telas de árbitro e espectador).

---

## 2.5 Cobertura de testes (recomendado)

1. Casos de parser: `'trio'` deve retornar `'trio'`.
2. Casos de `buildPlayersFromTeam` e validação por modalidade.
3. Caso de Referee:
   - ordem de saque com 3 atletas
   - troca de posse e avanço do sacador respeitando ciclo de 3.

---

## 3) Verificação do formato solicitado (3-3-4-4)

## 3.1 O sistema já possui esse formato?
**Não exatamente.**

Existe `groups_and_knockout`, mas:
- exige 12 equipes;
- usa grupos homogêneos de 3;
- quartas cruzam A1 x D2, B1 x C2, C1 x B2, D1 x A2.

Seu formato precisa:
- 14 equipes;
- grupos A/B com 3 e C/D com 4;
- quartas A1xB2, B1xA2, C1xD2, D1xC2.

---

## 3.2 Plano de implementação do novo formato

### Novo ID sugerido
- `4_groups_3_3_4_4_quarterfinals`

### Arquivos que precisam ser alterados
1. `src/types/volleyball.ts`
   - incluir novo `TournamentFormatId`.
2. `src/lib/tournament/formats.ts`
   - adicionar definição do formato com:
     - distribuição de seeds para 14 equipes em A/B/C/D (3/3/4/4)
     - geração de round-robin por grupo (já suportado por `generateGroupStageMatches`)
     - placeholders de quartas no cruzamento solicitado
     - semis + final + 3º opcional
3. `src/lib/tournament/phaseConfig.ts`
   - adicionar sequência de fases do novo formato.
4. `src/lib/tournament/phaseAdvancement.ts`
   - incluir handlers para:
     - `Fase de Grupos` → criação de quartas via top 2 por grupo no cruzamento A/B e C/D
     - `Quartas de final` → semis
     - `Semifinal` → final (+3º se habilitado)
5. `src/lib/tournament/bracketCriteria.ts`
   - critério textual exibido para o novo formato.
6. `src/lib/tournament/teamNameStructure.ts`
   - estrutura de nomes/grupos para entrada das 14 equipes (3-3-4-4).
7. `src/lib/tournament/formatFilter.ts` / pontos de listagem de formatos
   - disponibilizar na UI de criação/configuração de torneio.
8. `supabase/migrations/*` (opcional)
   - atualizar **comentário** de `tournaments.format_id` para listar o novo id (não funcional, mas útil para documentação).

---

## 4) Ordem recomendada de entrega (para reduzir risco)

### Etapa 1 — Trio (base funcional)
1. Types + parser + teamPlayers
2. Cadastro/edição de equipes no torneio
3. Referee (rotação dinâmica 3 atletas)
4. Testes rápidos E2E do fluxo de arbitragem

### Etapa 2 — Novo formato 3-3-4-4
1. Cadastro do formato em `formats.ts`
2. Sequência/avanço em `phaseConfig.ts` e `phaseAdvancement.ts`
3. Critérios/UI de seleção/listagem
4. Testes de geração de jogos e avanço automático

---

## 5) Resposta objetiva à sua pergunta sobre banco

- **Para torneio + jogos de torneio:** em princípio **não precisa migration obrigatória** para habilitar trio, porque os campos já aceitam texto e `teams` já tem `player_c`/`player_d`.
- **Precisa ajustar lógica da aplicação** para trio em tipos/parsers/formulários/referee.
- **Se quiser trio também em jogos avulsos**, aí **precisa migration** por causa do `CHECK` da tabela `casual_matches`.

