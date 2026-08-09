export interface PlayerData {
  name: string;
  dkId: string;
  salary: number;
  projection: number;
  sgTotal64: number;
  sgTotal32: number;
  sgTotal16: number;
  courseFitScore: number;
}

export class SkroderupOptimizer {
  // Brodd Value Board Logic
  static calculateValue(player: PlayerData) {
    // 1. True Talent (Past 20 SG - we use 16/32 here as proxy)
    const trueTalent = (player.sgTotal16 * 0.6) + (player.sgTotal32 * 0.4);
    
    // 2. Market Value (Salary vs Projection)
    const expectedSalary = player.projection * 135; // Rough DK point to salary multiplier
    const salaryDiff = expectedSalary - player.salary;
    const valueMultiplier = salaryDiff > 0 ? 1.1 : 0.9;
    
    // 3. Contest Fit is handled downstream, but we bake courseFit in here
    const finalBVI = (trueTalent * 10) + (player.courseFitScore * 5) + (salaryDiff / 100);
    
    return {
      ...player,
      bvi: finalBVI,
      isMispriced: salaryDiff > 1000 // if they should be  more expensive
    };
  }

  static generateBroddValueBoard(players: PlayerData[]) {
    return players
      .map(this.calculateValue)
      .sort((a, b) => b.bvi - a.bvi);
  }
}
