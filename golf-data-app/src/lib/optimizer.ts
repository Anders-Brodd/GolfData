export interface PlayerData {
  id: string;
  name: string;
  salary: number;
  projection: number;
  customWeight: number; // 0 to 100 multiplier or added points
}

export interface Lineup {
  id: string;
  players: PlayerData[];
  totalSalary: number;
  totalProjection: number;
}

// Generate up to N optimal unique lineups under $50k salary cap with 6 players
export class LineupOptimizer {
  static generateTopLineups(players: PlayerData[], count = 50): Lineup[] {
    const lineups: Map<string, Lineup> = new Map();
    
    // Sort players by value (projection adjusted by weight) / salary
    const sortedPlayers = [...players].sort((a, b) => {
      const aVal = (a.projection * (1 + a.customWeight / 100)) / a.salary;
      const bVal = (b.projection * (1 + b.customWeight / 100)) / b.salary;
      return bVal - aVal;
    });

    const maxSalary = 50000;
    const lineupSize = 6;
    let attempts = 0;
    const maxAttempts = 10000; // run thousands of randomized greedy combos

    while (lineups.size < count && attempts < maxAttempts) {
      attempts++;
      
      // Shuffle the top 40ish players slightly to get unique lineups
      const poolSize = Math.min(60, sortedPlayers.length);
      const pool = sortedPlayers.slice(0, poolSize);
      
      // Randomize the pool slightly to get different top lineups
      const randomizedPool = [...pool].sort(() => Math.random() - 0.2); 
      
      const currentLineup: PlayerData[] = [];
      let currentSalary = 0;
      let currentProj = 0;

      for (const p of randomizedPool) {
        if (currentLineup.length < lineupSize && (currentSalary + p.salary) <= maxSalary) {
          currentLineup.push(p);
          currentSalary += p.salary;
          const adjustedProj = p.projection * (1 + p.customWeight / 100);
          currentProj += adjustedProj;
        }
        if (currentLineup.length === lineupSize) break;
      }

      if (currentLineup.length === lineupSize) {
        // Sort by ID to ensure uniqueness string is consistent
        currentLineup.sort((a, b) => a.id.localeCompare(b.id));
        const lineupId = currentLineup.map(p => p.id).join('-');
        
        if (!lineups.has(lineupId)) {
          lineups.set(lineupId, {
            id: lineupId,
            players: currentLineup,
            totalSalary: currentSalary,
            totalProjection: currentProj
          });
        }
      }
    }

    return Array.from(lineups.values()).sort((a, b) => b.totalProjection - a.totalProjection).slice(0, count);
  }
}
