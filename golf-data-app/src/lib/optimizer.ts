export interface PlayerData {
  id: string;
  name: string;
  salary: number;
  projection: number;
  customWeight: number; // Not used anymore, kept for compat
  maxExposure?: number; // 0 to 100 percent for this specific player
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
    const sortedPlayers = [...players].sort((a, b) => b.projection - a.projection);

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
          currentProj += p.projection;
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
    
    for (const lineup of allValidLineups) {
      if (finalLineups.length >= config.numLineups) break;

      // Check max exposure
      let violatesExposure = false;
      for (const player of lineup.players) {
        const playerMaxExp = player.maxExposure !== undefined ? player.maxExposure : config.maxExposure;
        const maxUsageAllowed = playerMaxExp === 0 ? 0 : Math.max(1, Math.floor(config.numLineups * (playerMaxExp / 100)));
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
