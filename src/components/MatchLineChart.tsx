import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

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

  // Calcular Win Probability Added (WPA) simplificado
  const calculateWPA = (scoreA: number, scoreB: number, maxPoints: number): number => {
    const totalScore = scoreA + scoreB;
    if (totalScore === 0) return 50; // Início do jogo
    
    const diff = scoreA - scoreB;
    const maxDiff = maxPoints;
    const progressFactor = totalScore / (maxPoints * 2);
    
    // Fórmula simplificada de probabilidade baseada em diferença e progresso
    let winProb = 50 + (diff / maxDiff) * 50 * (1 + progressFactor);
    
    // Ajustar para match/set points
    if (scoreA >= maxPoints - 1 && scoreA > scoreB) {
      winProb = Math.min(95, winProb + 10);
    } else if (scoreB >= maxPoints - 1 && scoreB > scoreA) {
      winProb = Math.max(5, winProb - 10);
    }
    
    return Math.max(0, Math.min(100, winProb));
  };

  const chartData = useMemo(() => {
    if (scoresHistory.length === 0) {
      return [];
    }

    return scoresHistory.map((point, index) => ({
      point: index + 1,
      [teamAName]: point.teamA,
      [teamBName]: point.teamB,
      wpa: calculateWPA(point.teamA, point.teamB, maxPoints)
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
                backgroundColor: 'rgba(0,0,0,0.8)', 
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: 'white'
              }}
              formatter={(value: number, name: string) => {
                if (name === 'wpa') {
                  return [`${value.toFixed(1)}%`, 'Prob. Vitória A'];
                }
                return [value, name];
              }}
            />
            <Legend wrapperStyle={{ color: 'white' }} />
            <ReferenceLine y={maxPoints} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
            <Line 
              type="monotone" 
              dataKey={teamAName} 
              stroke="hsl(205, 87%, 50%)" 
              strokeWidth={3}
              dot={{ fill: 'hsl(205, 87%, 50%)', r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey={teamBName} 
              stroke="hsl(25, 95%, 53%)" 
              strokeWidth={3}
              dot={{ fill: 'hsl(25, 95%, 53%)', r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey="wpa" 
              stroke="hsl(142, 76%, 46%)" 
              strokeWidth={2}
              strokeDasharray="5 5"
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
        <div className="mt-4 text-xs text-white/60">
          <p><strong>WPA (Win Probability Added)</strong>: Probabilidade de vitória da {teamAName} em cada momento do jogo.</p>
        </div>
      </CardContent>
    </Card>
  );
}
