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
  numLineups: number;
  maxExposure: number; // percentage 0 to 100
  minUniques: number; // minimum unique players between lineups
}

export class LineupOptimizer {
  static generateTopLineups(players: PlayerData[], config: OptimizerConfig): Lineup[] {
    const sortedPlayers = [...players].sort((a, b) => {
      const aProj = a.projection * (1 + a.customWeight / 100);
      const bProj = b.projection * (1 + b.customWeight / 100);
      return bProj - aProj;
    });

    const lineupSize = 6;
    const maxBulkAttempts = 50000;
    
    // Step 1: Generate a massive bulk pool of valid lineups
    const bulkLineups: Map<string, Lineup> = new Map();
    let attempts = 0;
    
    // Create highly optimized pool to draw from
    while (bulkLineups.size < 5000 && attempts < maxBulkAttempts) {
      attempts++;
      // Biased random sort to favor high projections but allow variation
      const randomizedPool = [...sortedPlayers].sort((a, b) => {
          const aRank = sortedPlayers.indexOf(a) + (Math.random() * 40 - 20);
          const bRank = sortedPlayers.indexOf(b) + (Math.random() * 40 - 20);
          return aRank - bRank;
      });
      
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
        currentLineup.sort((a, b) => a.id.localeCompare(b.id));
        const lineupId = currentLineup.map(p => p.id).join('-');
        
        if (!bulkLineups.has(lineupId)) {
          bulkLineups.set(lineupId, {
            id: lineupId,
            players: currentLineup,
            totalSalary: currentSalary,
            totalProjection: currentProj
          });
        }
      }
    }

    // Step 2: Filter and select the exact number of requested lineups enforcing constraints
    const allValidLineups = Array.from(bulkLineups.values()).sort((a, b) => b.totalProjection - a.totalProjection);
    const finalLineups: Lineup[] = [];
    const playerExposureCount: Record<string, number> = {};
    
    const maxUsageAllowed = Math.max(1, Math.floor(config.numLineups * (config.maxExposure / 100)));

    for (const lineup of allValidLineups) {
      if (finalLineups.length >= config.numLineups) break;

      // Check max exposure
      let violatesExposure = false;
      for (const player of lineup.players) {
        if ((playerExposureCount[player.id] || 0) >= maxUsageAllowed) {
          violatesExposure = true;
          break;
        }
      }
      if (violatesExposure) continue;

      // Check min uniques against all previously selected lineups
      let violatesUniques = false;
      if (config.minUniques > 0) {
        for (const existingLineup of finalLineups) {
          const overlap = lineup.players.filter(p => existingLineup.players.some(ep => ep.id === p.id)).length;
          const uniqueCount = lineupSize - overlap;
          if (uniqueCount < config.minUniques) {
            violatesUniques = true;
            break;
          }
        }
      }
      if (violatesUniques) continue;

      // Add to final
      finalLineups.push(lineup);
      lineup.players.forEach(p => {
        playerExposureCount[p.id] = (playerExposureCount[p.id] || 0) + 1;
      });
    }

    return finalLineups;
  }
}
