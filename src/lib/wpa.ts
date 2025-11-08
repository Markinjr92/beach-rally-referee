export const calculateWinProbability = (scoreA: number, scoreB: number, maxPoints: number): number => {
  const totalScore = scoreA + scoreB;
  if (totalScore === 0) return 50;

  const diff = scoreA - scoreB;
  const maxDiff = maxPoints;
  const progressFactor = totalScore / (maxPoints * 2);

  let winProb = 50 + (diff / maxDiff) * 50 * (1 + progressFactor);

  if (scoreA >= maxPoints - 1 && scoreA > scoreB) {
    winProb = Math.min(95, winProb + 10);
  } else if (scoreB >= maxPoints - 1 && scoreB > scoreA) {
    winProb = Math.max(5, winProb - 10);
  }

  return Math.max(0, Math.min(100, winProb));
};
