export function calculateRollingAverages(rounds: any[], count: number) {
  if (rounds.length === 0) {
    return {
      sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgT2G: 0, sgTotal: 0,
      round_score: 0, driving_dist: 0, driving_acc: 0, gir: 0, scrambling: 0, 
      prox_rgh: 0, prox_fw: 0, great_shots: 0, poor_shots: 0, pars: 0, 
      eagles_or_better: 0, birdies: 0, bogies: 0, doubles_or_worse: 0,
      eob: 0, bob: 0, pob: 0, ba: 0
    };
  }
  
  const targetRounds = rounds.slice(0, count);
  
  const sums = targetRounds.reduce((acc, r) => {
    acc.sgOTT += Number(r.sg_ott || 0);
    acc.sgAPP += Number(r.sg_app || 0);
    acc.sgARG += Number(r.sg_arg || 0);
    acc.sgPUTT += Number(r.sg_putt || 0);
    acc.sgT2G += Number(r.sg_t2g || 0);
    acc.sgTotal += Number(r.sg_total || 0);
    
    acc.round_score += Number(r.round_score || 0);
    acc.driving_dist += Number(r.driving_dist || 0);
    acc.driving_acc += Number(r.driving_acc || 0);
    acc.gir += Number(r.gir || 0);
    acc.scrambling += Number(r.scrambling || 0);
    acc.prox_rgh += Number(r.prox_rgh || 0);
    acc.prox_fw += Number(r.prox_fw || 0);
    acc.great_shots += Number(r.great_shots || 0);
    acc.poor_shots += Number(r.poor_shots || 0);
    acc.pars += Number(r.pars || 0);
    acc.eagles_or_better += Number(r.eagles_or_better || 0);
    acc.birdies += Number(r.birdies || 0);
    acc.bogies += Number(r.bogies || 0);
    acc.doubles_or_worse += Number(r.doubles_or_worse || 0);
    
    acc.eob += Number(r.eagles_or_better || 0);
    acc.bob += (Number(r.birdies || 0) + Number(r.eagles_or_better || 0));
    acc.pob += (Number(r.pars || 0) + Number(r.birdies || 0) + Number(r.eagles_or_better || 0));
    acc.ba += (Number(r.bogies || 0) + Number(r.doubles_or_worse || 0));
    
    return acc;
  }, { 
    sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgT2G: 0, sgTotal: 0, 
    round_score: 0, driving_dist: 0, driving_acc: 0, gir: 0, scrambling: 0, 
    prox_rgh: 0, prox_fw: 0, great_shots: 0, poor_shots: 0, pars: 0, 
    eagles_or_better: 0, birdies: 0, bogies: 0, doubles_or_worse: 0,
    eob: 0, bob: 0, pob: 0, ba: 0 
  });

  const len = targetRounds.length;
  
  return {
    sgOTT: sums.sgOTT / len,
    sgAPP: sums.sgAPP / len,
    sgARG: sums.sgARG / len,
    sgPUTT: sums.sgPUTT / len,
    sgT2G: sums.sgT2G / len,
    sgTotal: sums.sgTotal / len,
    
    round_score: sums.round_score / len,
    driving_dist: sums.driving_dist / len,
    driving_acc: sums.driving_acc / len,
    gir: sums.gir / len,
    scrambling: sums.scrambling / len,
    prox_rgh: sums.prox_rgh / len,
    prox_fw: sums.prox_fw / len,
    great_shots: sums.great_shots / len,
    poor_shots: sums.poor_shots / len,
    pars: sums.pars / len,
    eagles_or_better: sums.eagles_or_better / len,
    birdies: sums.birdies / len,
    bogies: sums.bogies / len,
    doubles_or_worse: sums.doubles_or_worse / len,
    
    eob: (sums.eob / len / 18) * 100,
    bob: (sums.bob / len / 18) * 100,
    pob: (sums.pob / len / 18) * 100,
    ba: (sums.ba / len / 18) * 100
  };
}

export interface StatConfig {
  weight: number;
  cutoff: number;
  decay: number; // 0 to 100
}

export function calculateCustomAverages(rounds: any[], configs: Record<string, StatConfig>) {
  const result: Record<string, number> = {};
  const statsKeys = [
    'sgOTT', 'sgAPP', 'sgARG', 'sgPUTT', 'sgT2G', 'sgTotal',
    'round_score', 'driving_dist', 'driving_acc', 'gir', 'scrambling',
    'prox_rgh', 'prox_fw', 'great_shots', 'poor_shots', 'pars',
    'eagles_or_better', 'birdies', 'bogies', 'doubles_or_worse'
  ];

  for (const stat of statsKeys) {
    const rawKey = stat.replace('sg', 'sg_').toLowerCase();
    
    // Map internal key to raw json key
    let sourceKey = rawKey;
    if (stat === 'sgOTT') sourceKey = 'sg_ott';
    else if (stat === 'sgAPP') sourceKey = 'sg_app';
    else if (stat === 'sgARG') sourceKey = 'sg_arg';
    else if (stat === 'sgPUTT') sourceKey = 'sg_putt';
    else if (stat === 'sgT2G') sourceKey = 'sg_t2g';
    else if (stat === 'sgTotal') sourceKey = 'sg_total';
    else sourceKey = stat.toLowerCase();

    const config = configs[stat] || { cutoff: 32, decay: 0 };
    const targetRounds = rounds.slice(0, config.cutoff);
    
    if (targetRounds.length === 0) {
      result[stat] = 0;
      continue;
    }

    let weightedSum = 0;
    let totalWeight = 0;
    
    targetRounds.forEach((r, idx) => {
      let val = Number(r[sourceKey] || 0);
      
      // Calculate linear decay weight
      let w = 1.0;
      if (config.decay > 0 && targetRounds.length > 1) {
        w = 1.0 - (config.decay / 100.0) * (idx / (targetRounds.length - 1));
      }
      
      weightedSum += val * w;
      totalWeight += w;
    });

    result[stat] = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
  }
  
  // Derived stats
  result.eob = ((result.eagles_or_better || 0) / 18) * 100;
  result.bob = (((result.birdies || 0) + (result.eagles_or_better || 0)) / 18) * 100;
  result.pob = (((result.pars || 0) + (result.birdies || 0) + (result.eagles_or_better || 0)) / 18) * 100;
  result.ba = (((result.bogies || 0) + (result.doubles_or_worse || 0)) / 18) * 100;
  
  return result;
}

