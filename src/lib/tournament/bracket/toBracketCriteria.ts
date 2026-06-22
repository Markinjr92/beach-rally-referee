import type { BracketCriteria, BracketSection } from './criteriaTypes';
import type { FormatBracketDefinition } from './types';
import { allBracketDefinitions } from './definitions';

const groupMatchesByPhase = (definition: FormatBracketDefinition): BracketSection[] => {
  const phaseMap = new Map<string, BracketSection>();

  definition.matches.forEach((match) => {
    if (!phaseMap.has(match.phase)) {
      phaseMap.set(match.phase, { phase: match.phase, matches: [] });
    }
    phaseMap.get(match.phase)!.matches.push({
      label: match.label,
      description: match.description ?? `${match.label}`,
      phaseOverride:
        match.phase === 'Final' && match.key === 'F3'
          ? 'Disputa 3º lugar'
          : match.phase === 'Final' && match.key === 'FINAL'
            ? 'Final'
            : undefined,
    });
  });

  const sections: BracketSection[] = [];

  if (definition.infoSections?.length) {
    sections.push(...definition.infoSections);
  }

  definition.phases.forEach((phase) => {
    const section = phaseMap.get(phase);
    if (section && section.matches.length) {
      sections.push(section);
    }
  });

  return sections;
};

export const toBracketCriteria = (definition: FormatBracketDefinition): BracketCriteria => ({
  title: definition.title,
  sections: groupMatchesByPhase(definition),
});

export const bracketCriteriaFromDefinitions: Record<string, BracketCriteria> =
  allBracketDefinitions.reduce(
    (acc, def) => {
      acc[def.formatId] = toBracketCriteria(def);
      return acc;
    },
    {} as Record<string, BracketCriteria>,
  );
