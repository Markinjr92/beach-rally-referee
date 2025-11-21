# Guia Completo: Como Criar um Novo Formato de Torneio

Este guia detalha todos os arquivos e seções que precisam ser modificados ao criar um novo formato de torneio no sistema.

## 📋 Índice

1. [Definição do Tipo](#1-definição-do-tipo)
2. [Definição do Formato](#2-definição-do-formato)
3. [Sequência de Fases](#3-sequência-de-fases)
4. [Critérios de Chaveamento](#4-critérios-de-chaveamento)
5. [Lógica de Avanço de Fase](#5-lógica-de-avanço-de-fase)
6. [Cálculo de Classificação](#6-cálculo-de-classificação)
7. [Carregamento do FormatId](#7-carregamento-do-formats-id)

---

## 1. Definição do Tipo

**Arquivo:** `src/types/volleyball.ts`

**O que fazer:**
- Adicionar o novo `TournamentFormatId` ao union type `TournamentFormatId`

**Exemplo:**
```typescript
export type TournamentFormatId =
  | 'groups_and_knockout'
  | 'double_elimination'
  // ... outros formatos
  | '2_groups_3_cross_semis'; // ← NOVO FORMATO
```

---

## 2. Definição do Formato

**Arquivo:** `src/lib/tournament/formats.ts`

**O que fazer:**
- Adicionar uma nova entrada no objeto `formatDefinitions`
- Implementar a função `generate` que cria a estrutura do torneio

**Estrutura necessária:**
```typescript
'novo_formato_id': {
  id: 'novo_formato_id',
  name: 'Nome do Formato',
  description: 'Descrição detalhada do formato',
  generate: (options) => {
    // 1. Validar número de equipes
    // 2. Criar fases (TournamentPhase[])
    // 3. Criar grupos (TournamentGroup[])
    // 4. Gerar jogos da fase de grupos
    // 5. Criar placeholders para fases eliminatórias
    // 6. Retornar { phases, groups, matches }
  }
}
```

**Pontos importantes:**
- Use `ensureXTeams()` para validar o número de equipes
- Use `mapTeamsBySeed()` para mapear equipes por seed
- Use `generateGroupStageMatches()` para jogos dentro de grupos
- Use `generateCrossGroupMatches()` para jogos cruzados entre grupos
- Use `placeholderTeam()` para criar placeholders nas fases eliminatórias
- Use `createMatch()` para criar cada jogo com todas as configurações

---

## 3. Sequência de Fases

**Arquivo:** `src/lib/tournament/phaseConfig.ts`

**O que fazer:**
- Adicionar a sequência de fases no objeto `phaseSequences`

**Exemplo:**
```typescript
export const phaseSequences: Partial<Record<TournamentFormatId, string[]>> = {
  // ... outros formatos
  '2_groups_3_cross_semis': ['Fase de Grupos', 'Semifinal', 'Final'], // ← NOVO
}
```

**Importante:**
- Os nomes das fases devem corresponder exatamente aos usados em `formats.ts` e `bracketCriteria.ts`
- A ordem define a sequência de avanço entre fases

---

## 4. Critérios de Chaveamento

**Arquivo:** `src/lib/tournament/bracketCriteria.ts`

**O que fazer:**
- Adicionar uma nova entrada no objeto `bracketCriteriaByFormat`
- Definir as seções e confrontos para cada fase

**Estrutura:**
```typescript
'novo_formato_id': {
  title: 'Título do Formato',
  sections: [
    {
      phase: 'Fase de Grupos',
      matches: [
        match('Estrutura', 'Descrição da estrutura'),
        match('Formato', 'Como os jogos são organizados'),
        // ...
      ]
    },
    {
      phase: 'Semifinal',
      matches: [
        match('SF1', '1º Grupo A × 2º Grupo B'),
        match('SF2', '1º Grupo B × 2º Grupo A'),
      ]
    },
    {
      phase: 'Final',
      matches: [
        match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
        match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
      ]
    }
  ]
}
```

**Função `match()`:**
- `label`: Identificador do confronto (ex: 'SF1', 'QF2')
- `description`: Descrição do confronto (ex: '1º Grupo A × 2º Grupo B')
- `phaseOverride` (opcional): Nome da fase se diferente da seção (ex: 'Disputa 3º lugar')

**Importante:**
- As descrições são usadas para sugerir confrontos no modal de criação de jogos
- Use padrões como "1º Grupo A", "2º Grupo B", "Venc. SF1", "Perd. SF2" para que o sistema possa interpretar

---

## 5. Lógica de Avanço de Fase

**Arquivo:** `src/lib/tournament/phaseAdvancement.ts`

**O que fazer:**
- Adicionar o formato em `phaseSequences` (se ainda não estiver)
- Adicionar handlers em `formatHandlers` para calcular classificados e sugerir confrontos

**Estrutura:**
```typescript
const formatHandlers: Partial<Record<TournamentFormatId, Record<string, PhaseHandler>>> = {
  // ... outros formatos
  'novo_formato_id': {
    'Fase de Grupos': async (context) => {
      // Calcular classificados
      const qualifiers = await calculateGroupQualifiers(...)
      // Retornar sugestões de confrontos (NÃO criar automaticamente)
      return createSemifinalMatchesSuggestions(context.options, qualifiers)
    },
    'Semifinal': async (context) => {
      // Calcular vencedores das semifinais
      const semifinalMatches = context.matches.filter(...)
      // Retornar sugestões para final e 3º lugar
      return createFinalMatchesSuggestions(context.options, semifinalMatches)
    }
  }
}
```

**IMPORTANTE:**
- Os handlers agora devem **sugerir** confrontos, não criar automaticamente
- As funções devem retornar `TablesInsert<'matches'>[]` com as sugestões
- O sistema preencherá automaticamente o modal com essas sugestões

**Funções auxiliares:**
- `calculateGroupQualifiers()`: Calcula os classificados de cada grupo
- `createSemifinalMatchesSuggestions()`: Cria sugestões de confrontos para semifinais
- `createFinalMatchesSuggestions()`: Cria sugestões de confrontos para finais

---

## 6. Cálculo de Classificação

**Arquivo:** `src/utils/tournamentStandings.ts`

**O que fazer:**
- Verificar se o formato usa jogos cruzados entre grupos
- Se sim, atualizar `computeStandingsByGroup` para considerar jogos cruzados

**Para formatos com jogos cruzados:**
```typescript
// No arquivo que chama computeStandingsByGroup
computeStandingsByGroup({
  // ... outros parâmetros
  isCrossGroupFormat: tournamentConfig?.formatId === 'novo_formato_cruzado',
})
```

**Lógica de jogos cruzados:**
- Se `isCrossGroupFormat === true`: Um jogo é considerado para um grupo se **pelo menos uma** das equipes pertence a esse grupo
- Se `isCrossGroupFormat === false`: Um jogo é considerado apenas se **ambas** as equipes pertencem ao mesmo grupo

---

## 7. Carregamento do FormatId

**Arquivos que podem precisar de atualização:**
- `src/pages/TournamentDetailDB.tsx`
- `src/pages/TournamentInfoDetail.tsx`
- `src/pages/PublicTournamentView.tsx`

**O que fazer:**
- Garantir que `tournament.format_id` ou `tournamentData.format_id` seja carregado
- Verificar se `tournamentConfig?.formatId` está sendo usado corretamente

**Exemplo:**
```typescript
// Carregar format_id do torneio
const { data: tournament } = await supabase
  .from('tournaments')
  .select('format_id, ...')
  .eq('id', tournamentId)
  .single()

// Usar para cálculos
const isCrossGroupFormat = tournamentConfig?.formatId === 'novo_formato_cruzado'
```

---

## 📝 Checklist de Implementação

Ao criar um novo formato, verifique:

- [ ] ✅ Tipo adicionado em `src/types/volleyball.ts`
- [ ] ✅ Formato definido em `src/lib/tournament/formats.ts`
- [ ] ✅ Sequência de fases em `src/lib/tournament/phaseConfig.ts`
- [ ] ✅ Critérios de chaveamento em `src/lib/tournament/bracketCriteria.ts`
- [ ] ✅ Handlers de avanço em `src/lib/tournament/phaseAdvancement.ts`
- [ ] ✅ Cálculo de classificação ajustado (se necessário) em `src/utils/tournamentStandings.ts`
- [ ] ✅ FormatId carregado nas páginas que usam (se necessário)
- [ ] ✅ Testado o fluxo completo: criação → fase de grupos → avanço → semifinais → finais

---

## 🔍 Exemplo Completo: Formato "2 Grupos de 3 - Cruzado"

### 1. Tipo (`src/types/volleyball.ts`)
```typescript
export type TournamentFormatId =
  | 'groups_and_knockout'
  // ... outros
  | '2_groups_3_cross_semis';
```

### 2. Formato (`src/lib/tournament/formats.ts`)
```typescript
'2_groups_3_cross_semis': {
  id: '2_groups_3_cross_semis',
  name: '2 Grupos de 3 - Cruzado + Semi/Final',
  description: 'Dois grupos de três duplas. Cada dupla de um grupo joga contra todas do outro grupo. Passam 2 de cada grupo para semifinais.',
  generate: (options) => {
    // Implementação completa
  }
}
```

### 3. Fases (`src/lib/tournament/phaseConfig.ts`)
```typescript
'2_groups_3_cross_semis': ['Fase de Grupos', 'Semifinal', 'Final'],
```

### 4. Critérios (`src/lib/tournament/bracketCriteria.ts`)
```typescript
'2_groups_3_cross_semis': {
  title: '2 Grupos de 3 - Cruzado + Semi/Final',
  sections: [
    { phase: 'Fase de Grupos', matches: [...] },
    { phase: 'Semifinal', matches: [...] },
    { phase: 'Final', matches: [...] }
  ]
}
```

### 5. Avanço (`src/lib/tournament/phaseAdvancement.ts`)
```typescript
'2_groups_3_cross_semis': {
  'Fase de Grupos': async (context) => {
    // Calcular classificados e sugerir semifinais
  },
  'Semifinal': async (context) => {
    // Calcular vencedores e sugerir finais
  }
}
```

---

## ⚠️ Observações Importantes

1. **Nomes de Fases**: Sempre use os mesmos nomes em todos os arquivos (case-sensitive)
2. **Jogos Cruzados**: Se o formato tem jogos entre grupos, marque `isCrossGroupFormat: true`
3. **Sugestões vs Criação**: O sistema agora **sugere** confrontos, não cria automaticamente
4. **Placeholders**: Use placeholders nas fases eliminatórias durante a geração inicial
5. **Validação**: Sempre valide o número de equipes no início da função `generate`

---

## 🆘 Dúvidas Comuns

**Q: Como saber se preciso ajustar `computeStandingsByGroup`?**
A: Se o formato tem jogos onde equipes de grupos diferentes se enfrentam, você precisa marcar `isCrossGroupFormat: true`.

**Q: O que acontece se eu esquecer de adicionar em algum arquivo?**
A: O sistema pode não reconhecer o formato, não mostrar critérios corretos, ou não sugerir confrontos adequadamente.

**Q: Posso criar formatos com número variável de equipes?**
A: Atualmente o sistema valida números fixos. Para números variáveis, seria necessário ajustar as funções de validação.

---

**Última atualização:** Janeiro 2025
**Versão do sistema:** 1.0

