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
      <h4 className="text-lg font-semibold text-white">{criteria.title}</h4>
      <div className="mt-4 space-y-4 text-sm">
        {criteria.sections.map((section) => (
          <div key={section.phase} className="rounded-lg border border-slate-400/40 bg-slate-700/40 p-4">
            <h5 className="text-sm font-semibold text-white mb-2">{section.phase}</h5>
            <ul className="mt-2 space-y-1 text-sm">
              {section.matches.map((match) => (
                <li key={`${section.phase}-${match.label}`} className="text-slate-200/90">
                  <span className="font-semibold text-white">{match.label}:</span>{' '}
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

