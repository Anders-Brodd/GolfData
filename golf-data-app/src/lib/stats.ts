export function calculateRollingAverages(rounds: any[], count: number) {
  if (rounds.length === 0) {
    return {
      sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgT2G: 0, sgTotal: 0,
      round_score: 0, driving_dist: 0, driving_acc: 0, gir: 0, scrambling: 0, 
      prox_rgh: 0, prox_fw: 0, great_shots: 0, poor_shots: 0, pars: 0, 
      eagles_or_better: 0, birdies: 0, bogies: 0, doubles_or_worse: 0,
      bob: 0, ba: 0
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
    
    acc.bob += (Number(r.birdies || 0) + Number(r.eagles_or_better || 0));
    acc.ba += (Number(r.bogies || 0) + Number(r.doubles_or_worse || 0));
    
    return acc;
  }, { 
    sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgT2G: 0, sgTotal: 0, 
    round_score: 0, driving_dist: 0, driving_acc: 0, gir: 0, scrambling: 0, 
    prox_rgh: 0, prox_fw: 0, great_shots: 0, poor_shots: 0, pars: 0, 
    eagles_or_better: 0, birdies: 0, bogies: 0, doubles_or_worse: 0,
    bob: 0, ba: 0 
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
    
    bob: sums.bob / len,
    ba: sums.ba / len
  };
}
