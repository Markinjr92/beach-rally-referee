import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { calculateWinProbability } from '@/lib/wpa';

interface MatchLineChartProps {
  teamAName: string;
  teamBName: string;
  pointsPerSet: number[];
  currentSet: number;
  scoresHistory?: Array<{ teamA: number; teamB: number; server: 'A' | 'B' }>;
}

export function MatchLineChart({ 
  teamAName, 
  teamBName, 
  pointsPerSet, 
  currentSet,
  scoresHistory = []
}: MatchLineChartProps) {
  const maxPoints = pointsPerSet[currentSet - 1] || 21;

  const chartData = useMemo(() => {
    if (scoresHistory.length === 0) {
      return [];
    }

    return scoresHistory.map((point, index) => ({
      point: index + 1,
      [teamAName]: point.teamA,
      [teamBName]: point.teamB,
      wpa: calculateWinProbability(point.teamA, point.teamB, maxPoints)
    }));
  }, [scoresHistory, teamAName, teamBName, maxPoints]);

  if (chartData.length === 0) {
    return (
      <Card className="bg-white/10 border-white/20 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} />
            Gráfico de Acompanhamento
          </CardTitle>
          <CardDescription className="text-white/70">
            Acompanhe a evolução dos pontos ao longo do set
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/70">Aguardando início do set...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/10 border-white/20 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp size={20} />
          Gráfico de Acompanhamento - Set {currentSet}
        </CardTitle>
        <CardDescription className="text-white/70">
          Evolução dos pontos e probabilidade de vitória (WPA)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="point" 
              stroke="rgba(255,255,255,0.7)"
              label={{ value: 'Jogadas', position: 'insideBottom', offset: -5, fill: 'rgba(255,255,255,0.7)' }}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.7)"
              label={{ value: 'Pontos', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.7)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(10,16,24,0.92)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 10px 30px rgba(0,0,0,0.35)'
              }}
              formatter={(value: number, name: string) => {
                if (name === 'wpa') {
                  return [`${value.toFixed(1)}%`, `Prob. vitória ${teamAName}`];
                }
                return [value, name];
              }}
              labelFormatter={label => `Rally ${label}`}
            />
            <Legend
              wrapperStyle={{ color: 'white', paddingTop: 16 }}
              formatter={value => {
                if (value === 'wpa') {
                  return 'Prob. vitória ' + teamAName;
                }
                return value;
              }}
            />
            <ReferenceLine y={maxPoints} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey={teamAName}
              stroke="hsl(var(--team-a))"
              strokeWidth={4}
              dot={{ fill: 'hsl(var(--team-a))', r: 4 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey={teamBName}
              stroke="hsl(var(--team-b))"
              strokeWidth={4}
              dot={{ fill: 'hsl(var(--team-b))', r: 4 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="wpa"
              stroke="hsl(160, 100%, 45%)"
              strokeWidth={2.5}
              strokeDasharray="6 6"
              dot={false}
              yAxisId="right"
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="rgba(255,255,255,0.7)"
              domain={[0, 100]}
              label={{ value: 'WPA (%)', angle: 90, position: 'insideRight', fill: 'rgba(255,255,255,0.7)' }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 text-xs text-white/70 space-y-1">
          <p>
            <strong>WPA (Win Probability Added)</strong>: indica a probabilidade instantânea de vitória da {teamAName}.
          </p>
          <p>
            Para {teamBName}, considere <strong>100% - WPA</strong> para obter a probabilidade correspondente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
