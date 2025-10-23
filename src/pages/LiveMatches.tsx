import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

type Match = Tables<'matches'>
type Team = Tables<'teams'>

export default function LiveMatches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})

  useEffect(() => {
    const load = async () => {
      const { data: ms } = await supabase.from('matches').select('*').eq('status', 'in_progress').order('scheduled_at', { ascending: true })
      setMatches(ms || [])
      const teamIds = Array.from(new Set((ms || []).flatMap(m => [m.team_a_id, m.team_b_id])))
      if (teamIds.length) {
        const { data: ts } = await supabase.from('teams').select('*').in('id', teamIds)
        setTeams(Object.fromEntries((ts || []).map(t => [t.id, t])))
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Jogos em andamento</h1>
        <div className="grid gap-4">
          {matches.map(m => (
            <Card key={m.id}>
              <CardHeader><CardTitle>{teams[m.team_a_id]?.name || 'Equipe A'} vs {teams[m.team_b_id]?.name || 'Equipe B'}</CardTitle></CardHeader>
              <CardContent className="flex gap-2">
                <Link to={`/referee/${m.id}`}><Button>Mesa</Button></Link>
                <Link to={`/scoreboard/${m.id}`}><Button variant="outline">Placar</Button></Link>
                <Link to={`/spectator/${m.id}`}><Button variant="outline">Torcida</Button></Link>
              </CardContent>
            </Card>
          ))}
          {matches.length === 0 && <p className="text-sm text-muted-foreground">Nenhum jogo em andamento.</p>}
        </div>
      </div>
    </div>
  )
}

