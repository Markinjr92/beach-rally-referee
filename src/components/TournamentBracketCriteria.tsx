import { bracketCriteriaByFormat } from '@/lib/tournament/bracketCriteria'
import { TournamentFormatId } from '@/types/volleyball'

interface BracketCriteriaProps {
  formatId: TournamentFormatId | null | undefined
  className?: string
}

export function TournamentBracketCriteria({ formatId, className = '' }: BracketCriteriaProps) {
  if (!formatId) return null
  const criteria = bracketCriteriaByFormat[formatId]
  if (!criteria) return null

  return (
    <div className={className}>
      <h4 className="text-lg font-semibold">{criteria.title}</h4>
      <div className="mt-4 space-y-4 text-sm text-muted-foreground">
        {criteria.sections.map((section) => (
          <div key={section.phase} className="rounded-lg border border-border bg-muted/10 p-4">
            <h5 className="text-sm font-semibold text-foreground">{section.phase}</h5>
            <ul className="mt-2 space-y-1 text-sm">
              {section.matches.map((match) => (
                <li key={`${section.phase}-${match.label}`}>
                  <span className="font-semibold text-foreground">{match.label}:</span>{' '}
                  <span>{match.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

