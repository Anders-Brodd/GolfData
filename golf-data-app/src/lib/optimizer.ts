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

export interface OptimizerConfig {
  minSalary: number;
  maxSalary: number;
}

export class LineupOptimizer {
  static generateTopLineups(players: PlayerData[], count = 50, config: OptimizerConfig = { minSalary: 49000, maxSalary: 50000 }): Lineup[] {
    const lineups: Map<string, Lineup> = new Map();
    
    // Sort players by adjusted projection descending
    const sortedPlayers = [...players].sort((a, b) => {
      const aProj = a.projection * (1 + a.customWeight / 100);
      const bProj = b.projection * (1 + b.customWeight / 100);
      return bProj - aProj;
    });

    const lineupSize = 6;
    let attempts = 0;
    const maxAttempts = 20000; // run thousands of randomized greedy combos

    while (lineups.size < count && attempts < maxAttempts) {
      attempts++;
      
      // Randomize the full pool slightly, biased towards keeping top projected guys at the top
      const randomizedPool = [...sortedPlayers].sort(() => Math.random() - 0.25); 
      
      const currentLineup: PlayerData[] = [];
      let currentSalary = 0;
      let currentProj = 0;

      for (const p of randomizedPool) {
        if (currentLineup.length < lineupSize && (currentSalary + p.salary) <= config.maxSalary) {
          currentLineup.push(p);
          currentSalary += p.salary;
          const adjustedProj = p.projection * (1 + p.customWeight / 100);
          currentProj += adjustedProj;
        }
        if (currentLineup.length === lineupSize) break;
      }

      if (currentLineup.length === lineupSize && currentSalary >= config.minSalary) {
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
