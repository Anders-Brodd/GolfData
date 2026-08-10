'use client';
import { useState, useEffect, useMemo } from 'react';
import { LineupOptimizer, PlayerData, Lineup } from '@/lib/optimizer';

interface SGStats {
  sgOTT: number; sgAPP: number; sgARG: number; sgPUTT: number; sgT2G: number; sgTotal: number;
  eagles_or_better: number; birdies: number; pars: number; doubles_or_worse: number; bob: number; ba: number;
  driving_dist: number; driving_acc: number; gir: number; scrambling: number; prox_fw: number; prox_rgh: number; great_shots: number; poor_shots: number;
}

interface GolferStats extends PlayerData {
  stats16: SGStats;
  stats32: SGStats;
  stats64: SGStats;
  putt_bermuda: number;
  putt_bentgrass: number;
  putt_poa: number;
  wind: number;
}

const DEFAULT_WEIGHTS = {
  sgOTT: 5, sgAPP: 10, sgARG: 5, sgPUTT: 5, sgT2G: 10, sgTotal: 5, sgBS: 5,
  eagles_or_better: 0, birdies: 5, pars: 0, doubles_or_worse: 0, bob: 5, ba: 5,
  driving_dist: 0, driving_acc: 0, gir: 5, scrambling: 5, prox_fw: 0, prox_rgh: 0, great_shots: 0, poor_shots: 0,
  putt_bermuda: 5, putt_bentgrass: 5, putt_poa: 0, wind: 5
};

export default function Home() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [players, setPlayers] = useState<GolferStats[]>([]);
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  
  // Settings
  const [numLineups, setNumLineups] = useState(20);
  const [maxExposure, setMaxExposure] = useState(50);
  const [minUniques, setMinUniques] = useState(2);
  const [roundsFilter, setRoundsFilter] = useState<'16'|'32'|'64'>('32');
  const [minSalary, setMinSalary] = useState(49000);
  const [maxSalary, setMaxSalary] = useState(50000);
  const [optTarget, setOptTarget] = useState<'custom'|'dg'|'avg'>('custom');
  const [showUnwanted, setShowUnwanted] = useState(false);
  
  // Sorting
  const [sortField, setSortField] = useState('modelScore');
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc');

  // GPT Chat Notes
  const [gptNotes, setGptNotes] = useState('');
  const [gptReasoning, setGptReasoning] = useState('');
  const [gptModel, setGptModel] = useState('gpt-4o-mini');

  // --- UNIFIED TABS STATE ---
  const [tabs, setTabs] = useState<{name: string, weights: typeof DEFAULT_WEIGHTS, lineups: Lineup[]}[]>(Array(10).fill({ name: 'Tab', weights: DEFAULT_WEIGHTS, lineups: [] }).map((t,i) => ({...t, name: `Tab ${i+1}`})));
  const [activeTabIdx, setActiveTabIdx] = useState<number>(0);
  const [playerOverrides, setPlayerOverrides] = useState<Record<string, { bump?: number, exposure?: number, exclude?: boolean }>>({});
  
  // Is Client side ready
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTabs = localStorage.getItem('skroderup_tabs');
      if (storedTabs) {
         try {
           const parsed = JSON.parse(storedTabs);
           setTabs(parsed.map((t: any, i: number) => ({
              name: t.name || `Tab ${i+1}`,
              weights: { ...DEFAULT_WEIGHTS, ...(t.weights||{}) },
              lineups: t.lineups || []
           })));
         } catch (e) {}
      }
      const storedActive = localStorage.getItem('skroderup_active_tab');
      if (storedActive) setActiveTabIdx(Number(storedActive));

      const pOverrides = localStorage.getItem('skroderup_player_overrides');
      if (pOverrides) {
        try { setPlayerOverrides(JSON.parse(pOverrides)); } catch(e){}
      }
      setIsClient(true);
    }
  }, []);

  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      localStorage.setItem('skroderup_tabs', JSON.stringify(tabs));
      localStorage.setItem('skroderup_active_tab', activeTabIdx.toString());
      localStorage.setItem('skroderup_player_overrides', JSON.stringify(playerOverrides));
    }
  }, [tabs, activeTabIdx, playerOverrides, isClient]);

  const weights = tabs[activeTabIdx]?.weights || DEFAULT_WEIGHTS;
  const lineups = tabs[activeTabIdx]?.lineups || [];
  const totalWeight = Object.values(weights).reduce((sum, val) => sum + val, 0);

  useEffect(() => {
    fetch('/api/tournaments').then(res => res.json()).then(data => {
      if (data.success && data.schedule) {
        setTournaments(data.schedule);
        const upcoming = data.schedule.find((t: any) => String(t.event_completed) === "0" || t.event_completed === false);
        if (upcoming) setSelectedTournament(upcoming.event_name);
        else if (data.schedule.length > 0) setSelectedTournament(data.schedule[0].event_name);
      }
    });

    const fetchLivePlayers = async () => {
      try {
        const res = await fetch('/api/players');
        const data = await res.json();
        if (data.success && data.players && data.players.length > 0) {
          setPlayers(data.players);
          setDataError(null);
        } else {
          setDataError(data.error || 'No players found. DataGolf sync may have failed.');
        }
      } catch (err: any) {
        setDataError('Network error connecting to API.');
      }
      setIsDataLoading(false);
    };
    fetchLivePlayers();
  }, []);

  const clearLineups = () => {
    setTabs(prev => {
      const nt = [...prev];
      nt[activeTabIdx] = { ...nt[activeTabIdx], lineups: [] };
      return nt;
    });
  };

  const handleWeightChange = (stat: keyof typeof weights, newValue: number) => {
    const currentWeight = weights[stat] || 0;
    const weightDifference = newValue - currentWeight;
    let clampedValue = newValue;
    if (totalWeight + weightDifference > 100) {
      clampedValue = currentWeight + (100 - totalWeight);
    }
    
    setTabs(prev => {
      const nt = [...prev];
      nt[activeTabIdx] = { ...nt[activeTabIdx], weights: { ...nt[activeTabIdx].weights, [stat]: clampedValue }, lineups: [] };
      return nt;
    });
  };

  const handleOverride = (id: string, field: 'bump'|'exposure'|'exclude', value: any) => {
    setPlayerOverrides(prev => {
      const overrides = { ...prev };
      if (!overrides[id]) overrides[id] = {};
      (overrides[id] as any)[field] = value;
      return overrides;
    });
    clearLineups();
  };

  const renameTab = (index: number) => {
    const slotName = prompt('Enter a name for this configuration tab:', tabs[index].name);
    if (!slotName) return;
    setTabs(prev => {
      const nt = [...prev];
      nt[index].name = slotName;
      return nt;
    });
  };

  const getActiveStats = (p: GolferStats): SGStats => p[`stats${roundsFilter}` as keyof GolferStats] as SGStats || p.stats32 || {};

  const getRawModelScore = (p: GolferStats) => {
    let score = 0; 
    const stats = getActiveStats(p);
    if (!stats || Object.keys(stats).length === 0) return score;
    
    score += (Number(stats.sgOTT||0) * ((weights.sgOTT||0) / 10));
    score += (Number(stats.sgAPP||0) * ((weights.sgAPP||0) / 10));
    score += (Number(stats.sgARG||0) * ((weights.sgARG||0) / 10));
    score += (Number(stats.sgPUTT||0) * ((weights.sgPUTT||0) / 10));
    score += (Number(stats.sgT2G||0) * ((weights.sgT2G||0) / 10));
    score += (Number(stats.sgTotal||0) * ((weights.sgTotal||0) / 10));
    score += ((Number(stats.sgOTT||0) + Number(stats.sgAPP||0)) * ((weights.sgBS||0) / 10));
    
    score += (Number(stats.eagles_or_better||0) * ((weights.eagles_or_better||0) / 10));
    score += (Number(stats.birdies||0) * ((weights.birdies||0) / 10));
    score += (Number(stats.pars||0) * ((weights.pars||0) / 10));
    score += (Number(stats.bob||0) * ((weights.bob||0) / 10));
    score -= (Number(stats.doubles_or_worse||0) * ((weights.doubles_or_worse||0) / 10));
    score -= (Number(stats.ba||0) * ((weights.ba||0) / 10));

    score += (Number(stats.driving_dist||0) * ((weights.driving_dist||0) / 100)); 
    score += (Number(stats.driving_acc||0) * ((weights.driving_acc||0) / 10));
    score += (Number(stats.gir||0) * ((weights.gir||0) / 10));
    score += (Number(stats.scrambling||0) * ((weights.scrambling||0) / 10));
    score += (Number(stats.great_shots||0) * ((weights.great_shots||0) / 10));
    score -= (Number(stats.poor_shots||0) * ((weights.poor_shots||0) / 10));
    
    score += ((p.putt_bermuda||0) * ((weights.putt_bermuda||0) / 1000));
    score += ((p.putt_bentgrass||0) * ((weights.putt_bentgrass||0) / 1000));
    score += ((p.putt_poa||0) * ((weights.putt_poa||0) / 1000));
    score += ((p.wind||0) * ((weights.wind||0) / 1000));

    return score || 0;
  };

  const normalizationStats = useMemo(() => {
    const activeField = players.filter(p => p.salary > 0 && p.projection > 0);
    if (activeField.length === 0) return { rawMean: 0, rawStd: 1, dgMean: 0, dgStd: 1 };
    
    const rawScores = activeField.map(p => getRawModelScore(p));
    const rawMean = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
    const rawStd = Math.sqrt(rawScores.reduce((sq, val) => sq + Math.pow(val - rawMean, 2), 0) / rawScores.length) || 1;

    const dgScores = activeField.map(p => p.projection);
    const dgMean = dgScores.reduce((a, b) => a + b, 0) / dgScores.length;
    const dgStd = Math.sqrt(dgScores.reduce((sq, val) => sq + Math.pow(val - dgMean, 2), 0) / dgScores.length) || 1;

    return { rawMean, rawStd, dgMean, dgStd };
  }, [players, weights, roundsFilter]);

  const getModelScore = (p: GolferStats) => {
    const raw = getRawModelScore(p);
    return ((raw - normalizationStats.rawMean) / normalizationStats.rawStd) * normalizationStats.dgStd + normalizationStats.dgMean;
  };

  const getValueScore = (p: GolferStats) => p.salary ? getModelScore(p) / (p.salary / 1000) : 0;
  const getDgValue = (p: GolferStats) => p.salary ? p.projection / (p.salary / 1000) : 0;
  const getAvgScore = (p: GolferStats) => (getModelScore(p) + p.projection) / 2;
  const getAvgValue = (p: GolferStats) => (getValueScore(p) + getDgValue(p)) / 2;

  const getTargetBaseProj = (p: GolferStats) => {
    if (optTarget === 'dg') return p.projection;
    if (optTarget === 'avg') return getAvgScore(p);
    return getModelScore(p);
  };
  
  const getFinalProj = (p: GolferStats) => getTargetBaseProj(p) + (playerOverrides[p.id]?.bump || 0);

  const ranges = useMemo(() => {
    const activeField = players.filter(p => p.salary > 0 && !(playerOverrides[p.id]?.exclude));
    let sal = { min: Infinity, max: -Infinity };
    let cScr = { min: Infinity, max: -Infinity };
    let cVal = { min: Infinity, max: -Infinity };
    let dScr = { min: Infinity, max: -Infinity };
    let dVal = { min: Infinity, max: -Infinity };
    let aScr = { min: Infinity, max: -Infinity };
    let aVal = { min: Infinity, max: -Infinity };
    let fnl = { min: Infinity, max: -Infinity };
    let statsRanges: Record<string, { min: number, max: number }> = {};
    
    activeField.forEach(p => {
      const cs = getModelScore(p); const cv = getValueScore(p);
      const ds = p.projection; const dv = getDgValue(p);
      const as = getAvgScore(p); const av = getAvgValue(p);
      const fs = getFinalProj(p);
      const stats = getActiveStats(p);
      
      if (p.salary < sal.min) sal.min = p.salary; if (p.salary > sal.max) sal.max = p.salary;
      if (cs < cScr.min) cScr.min = cs; if (cs > cScr.max) cScr.max = cs;
      if (cv < cVal.min) cVal.min = cv; if (cv > cVal.max) cVal.max = cv;
      if (ds < dScr.min) dScr.min = ds; if (ds > dScr.max) dScr.max = ds;
      if (dv < dVal.min) dVal.min = dv; if (dv > dVal.max) dVal.max = dv;
      if (as < aScr.min) aScr.min = as; if (as > aScr.max) aScr.max = as;
      if (av < aVal.min) aVal.min = av; if (av > aVal.max) aVal.max = av;
      if (fs < fnl.min) fnl.min = fs; if (fs > fnl.max) fnl.max = fs;

      const allStats: any = {
         ...stats,
         sgBS: Number(stats.sgOTT||0) + Number(stats.sgAPP||0),
         putt_bermuda: p.putt_bermuda,
         putt_bentgrass: p.putt_bentgrass,
         putt_poa: p.putt_poa
      };

      for (let key in allStats) {
         if (!statsRanges[key]) statsRanges[key] = { min: Infinity, max: -Infinity };
         const v = Number(allStats[key]) || 0;
         if (v < statsRanges[key].min) statsRanges[key].min = v;
         if (v > statsRanges[key].max) statsRanges[key].max = v;
      }
    });
    return { sal, cScr, cVal, dScr, dVal, aScr, aVal, fnl, statsRanges };
  }, [players, weights, roundsFilter, optTarget, playerOverrides, normalizationStats]);

  const getGradient = (val: number, min: number, max: number, type: 'salary'|'score'|'lowerIsBetter') => {
    if (min === max || !isFinite(min)) return 'transparent';
    let percent = Math.max(0, Math.min(1, (val - min) / (max - min)));
    if (type === 'salary' || type === 'lowerIsBetter') percent = 1 - percent; 
    let r, g;
    if (percent > 0.5) {
       r = (1 - percent) * 2 * 255; g = 255;
    } else {
       r = 255; g = percent * 2 * 255;
    }
    return `rgba(${Math.round(r)}, ${Math.round(g)}, 0, 0.5)`;
  }

  const estimateTokenCost = () => {
    const tokens = 350 + Math.ceil(gptNotes.length / 4);
    const cost = gptModel === 'gpt-4o' ? (tokens / 1000) * 0.005 : (tokens / 1000) * 0.00015;
    return cost < 0.001 ? '< $0.001' : `~$${cost.toFixed(3)}`;
  };

  const exportDraftKingsCSV = () => {
    if (lineups.length === 0) return alert('No lineups to export!');
    let csv = "G,G,G,G,G,G\n";
    lineups.forEach(l => {
      csv += l.players.map(p => `"${p.name}"`).join(',') + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DraftKings_Lineups.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const aiAutoWeight = async () => {
    clearLineups();
    setIsAiLoading(true); setGptReasoning('');
    try {
      const res = await fetch('/api/ai/course-fit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament: selectedTournament, userNotes: gptNotes + "\nIMPORTANT: Ensure exactly 100% total sum.", gptModel })
      });
      const data = await res.json();
      if (data.success && data.weights) {
        let newWeights = { ...weights, ...data.weights };
        if ('round_score' in newWeights) delete (newWeights as any).round_score;
        if ('bogies' in newWeights) delete (newWeights as any).bogies;
        let sum = Object.values(newWeights).reduce((a:any, b:any) => Number(a) + Number(b), 0) as number;
        if (sum > 0) {
           for (let k in newWeights) newWeights[k as keyof typeof DEFAULT_WEIGHTS] = Math.round((newWeights[k as keyof typeof DEFAULT_WEIGHTS] / sum) * 100);
        }
        let newSum = Object.values(newWeights).reduce((a:any, b:any) => Number(a) + Number(b), 0) as number;
        if (newSum !== 100) newWeights.sgTotal += (100 - newSum); 
        
        setTabs(prev => {
          const nt = [...prev];
          nt[activeTabIdx] = { ...nt[activeTabIdx], weights: newWeights, lineups: [] };
          return nt;
        });
        setGptReasoning(data.reasoning || 'No reasoning provided by AI.');
      }
    } catch (err) {}
    setIsAiLoading(false);
  };

  const generateLineups = () => {
    if (players.length === 0) return alert('No player data available.');
    
    const pool = players.filter(p => !playerOverrides[p.id]?.exclude);
    const mappedPlayers = pool.map(p => ({ 
      ...p, 
      projection: getFinalProj(p),
      customWeight: 0,
      maxExposure: playerOverrides[p.id]?.exposure 
    }));
    
    const optimized = LineupOptimizer.generateTopLineups(mappedPlayers, {
      minSalary, maxSalary, numLineups, maxExposure, minUniques
    });
    setTabs(prev => {
      const nt = [...prev];
      nt[activeTabIdx] = { ...nt[activeTabIdx], lineups: optimized };
      return nt;
    });
  };

  // Sorting
  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortedPlayers = [...players].sort((a, b) => {
    let aVal: any = 0; let bVal: any = 0;
    const aStats = getActiveStats(a); const bStats = getActiveStats(b);
    
    if (sortField === 'name') { aVal = a.name; bVal = b.name; }
    else if (sortField === 'salary') { aVal = a.salary; bVal = b.salary; }
    else if (sortField === 'modelScore') { aVal = getModelScore(a); bVal = getModelScore(b); }
    else if (sortField === 'valueScore') { aVal = getValueScore(a); bVal = getValueScore(b); }
    else if (sortField === 'dgBaseline') { aVal = a.projection; bVal = b.projection; }
    else if (sortField === 'dgValue') { aVal = getDgValue(a); bVal = getDgValue(b); }
    else if (sortField === 'avgScore') { aVal = getAvgScore(a); bVal = getAvgScore(b); }
    else if (sortField === 'avgValue') { aVal = getAvgValue(a); bVal = getAvgValue(b); }
    else if (sortField === 'finalProj') { aVal = getFinalProj(a); bVal = getFinalProj(b); }
    else if (sortField === 'bump') { aVal = playerOverrides[a.id]?.bump || 0; bVal = playerOverrides[b.id]?.bump || 0; }
    else if (sortField === 'exposure') { aVal = playerOverrides[a.id]?.exposure ?? maxExposure; bVal = playerOverrides[b.id]?.exposure ?? maxExposure; }
    else if (['putt_bermuda', 'putt_bentgrass', 'putt_poa', 'wind'].includes(sortField)) {
      aVal = (a as any)[sortField]; bVal = (b as any)[sortField];
    } else {
      aVal = (aStats as any)[sortField] || 0; bVal = (bStats as any)[sortField] || 0;
    }

    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortHeader = (title: string, field: string) => (
    <th style={{ padding: '10px 8px', color: '#fff', cursor: 'pointer', userSelect: 'none', borderRight: '1px solid #333' }} onClick={() => handleSort(field)}>
      {title} {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  const renderWeightInput = (stat: string, label: string) => (
    <div key={stat} style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '0.75rem' }}><span>{label}</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="number" min="0" max="100" value={(weights as any)[stat] || 0} onChange={(e) => handleWeightChange(stat as any, Number(e.target.value))} style={{ flex: 1, background: '#222', color: '#fff', padding: '4px 6px', border: '1px solid #444', borderRadius: '4px', fontWeight: 'bold' }} />
        <span style={{ color: '#888', fontSize: '0.8rem' }}>%</span>
      </div>
    </div>
  );

  const includedPlayers = sortedPlayers.filter(p => !playerOverrides[p.id]?.exclude);
  const excludedPlayers = sortedPlayers.filter(p => playerOverrides[p.id]?.exclude);

  const renderTableRow = (p: GolferStats, idx: number, isExcluded: boolean) => {
    const cs = getModelScore(p); const cv = getValueScore(p);
    const ds = p.projection; const dv = getDgValue(p);
    const as = getAvgScore(p); const av = getAvgValue(p);
    const fs = getFinalProj(p);
    const stats = getActiveStats(p);
    const ov = playerOverrides[p.id] || {};
    const rowBg = isExcluded ? '#111' : (idx % 2 === 0 ? '#151515' : '#1a1a1a');
    const opacity = isExcluded ? 0.4 : 1;
    
    return (
      <tr key={p.id} style={{ borderBottom: '1px solid #222', background: rowBg, opacity }}>
        <td style={{ padding: '4px', borderRight: '1px solid #333' }}>
          <input type="number" step="0.5" value={ov.bump || 0} onChange={e => handleOverride(p.id, 'bump', Number(e.target.value))} style={{ width: '50px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '4px' }} />
        </td>
        <td style={{ padding: '4px', borderRight: '2px solid #333' }}>
          <input type="number" placeholder={String(maxExposure)} value={ov.exposure ?? ''} onChange={e => handleOverride(p.id, 'exposure', e.target.value === '' ? undefined : Number(e.target.value))} style={{ width: '50px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '4px' }} />
        </td>

        <td style={{ padding: '10px 8px', fontWeight: 'bold', borderRight: '1px solid #333' }}>{p.name}</td>
        <td style={{ padding: '10px 8px', borderRight: '2px solid #333', background: isExcluded ? 'transparent' : getGradient(p.salary, ranges.sal.min, ranges.sal.max, 'salary'), color: '#fff', textShadow: '0 0 2px #000' }}>${p.salary}</td>
        
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333', background: isExcluded ? 'transparent' : getGradient(cs, ranges.cScr.min, ranges.cScr.max, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{cs.toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '2px solid #333', background: isExcluded ? 'transparent' : getGradient(cv, ranges.cVal.min, ranges.cVal.max, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{cv.toFixed(2)}</td>
        
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333', background: isExcluded ? 'transparent' : getGradient(ds, ranges.dScr.min, ranges.dScr.max, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{ds.toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '2px solid #333', background: isExcluded ? 'transparent' : getGradient(dv, ranges.dVal.min, ranges.dVal.max, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{dv.toFixed(2)}</td>
        
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333', background: isExcluded ? 'transparent' : getGradient(as, ranges.aScr.min, ranges.aScr.max, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{as.toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '2px solid #333', background: isExcluded ? 'transparent' : getGradient(av, ranges.aVal.min, ranges.aVal.max, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{av.toFixed(2)}</td>

        <td style={{ padding: '10px 8px', borderRight: '2px solid #333', fontWeight: 'bold', background: isExcluded ? 'transparent' : getGradient(fs, ranges.fnl.min, ranges.fnl.max, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{fs.toFixed(2)}</td>

        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.sgOTT||0), ranges.statsRanges.sgOTT?.min||0, ranges.statsRanges.sgOTT?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.sgOTT||0).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.sgAPP||0), ranges.statsRanges.sgAPP?.min||0, ranges.statsRanges.sgAPP?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.sgAPP||0).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.sgARG||0), ranges.statsRanges.sgARG?.min||0, ranges.statsRanges.sgARG?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.sgARG||0).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.sgPUTT||0), ranges.statsRanges.sgPUTT?.min||0, ranges.statsRanges.sgPUTT?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.sgPUTT||0).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.sgT2G||0), ranges.statsRanges.sgT2G?.min||0, ranges.statsRanges.sgT2G?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.sgT2G||0).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient((Number(stats.sgOTT||0)+Number(stats.sgAPP||0)), ranges.statsRanges.sgBS?.min||0, ranges.statsRanges.sgBS?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{(Number(stats.sgOTT||0)+Number(stats.sgAPP||0)).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '2px solid #333', fontWeight: 'bold' , background: isExcluded ? 'transparent' : getGradient(Number(stats.sgTotal||0), ranges.statsRanges.sgTotal?.min||0, ranges.statsRanges.sgTotal?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.sgTotal||0).toFixed(2)}</td>
        
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.eagles_or_better||0), ranges.statsRanges.eagles_or_better?.min||0, ranges.statsRanges.eagles_or_better?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.eagles_or_better||0).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.birdies||0), ranges.statsRanges.birdies?.min||0, ranges.statsRanges.birdies?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.birdies||0).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333', background: isExcluded ? 'transparent' : getGradient(Number(stats.bob||0), ranges.statsRanges.bob?.min||0, ranges.statsRanges.bob?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.bob||0).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333', background: isExcluded ? 'transparent' : getGradient(Number(stats.ba||0), ranges.statsRanges.ba?.min||0, ranges.statsRanges.ba?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.ba||0).toFixed(2)}</td>
        <td style={{ padding: '10px 8px', borderRight: '2px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.doubles_or_worse||0), ranges.statsRanges.doubles_or_worse?.min||0, ranges.statsRanges.doubles_or_worse?.max||0, 'lowerIsBetter'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.doubles_or_worse||0).toFixed(2)}</td>
        
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.driving_dist||0), ranges.statsRanges.driving_dist?.min||0, ranges.statsRanges.driving_dist?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.driving_dist||0).toFixed(1)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.driving_acc||0), ranges.statsRanges.driving_acc?.min||0, ranges.statsRanges.driving_acc?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.driving_acc||0).toFixed(3)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.gir||0), ranges.statsRanges.gir?.min||0, ranges.statsRanges.gir?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.gir||0).toFixed(3)}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.prox_fw||0), ranges.statsRanges.prox_fw?.min||0, ranges.statsRanges.prox_fw?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.prox_fw||0).toFixed(1)}</td>
        <td style={{ padding: '10px 8px', borderRight: '2px solid #333' , background: isExcluded ? 'transparent' : getGradient(Number(stats.prox_rgh||0), ranges.statsRanges.prox_rgh?.min||0, ranges.statsRanges.prox_rgh?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{Number(stats.prox_rgh||0).toFixed(1)}</td>
        
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(p.putt_bermuda, ranges.statsRanges.putt_bermuda?.min||0, ranges.statsRanges.putt_bermuda?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{p.putt_bermuda}</td>
        <td style={{ padding: '10px 8px', borderRight: '1px solid #333' , background: isExcluded ? 'transparent' : getGradient(p.putt_bentgrass, ranges.statsRanges.putt_bentgrass?.min||0, ranges.statsRanges.putt_bentgrass?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{p.putt_bentgrass}</td>
        <td style={{ padding: '10px 8px', borderRight: '2px solid #333' , background: isExcluded ? 'transparent' : getGradient(p.putt_poa, ranges.statsRanges.putt_poa?.min||0, ranges.statsRanges.putt_poa?.max||0, 'score'), color: '#fff', textShadow: '0 0 2px #000' }}>{p.putt_poa}</td>

        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
          <input type="checkbox" checked={!!ov.exclude} onChange={e => handleOverride(p.id, 'exclude', e.target.checked)} style={{ transform: 'scale(1.5)' }} />
        </td>
      </tr>
    );
  };

  if (!isClient) return <div style={{ background: '#0a0a0a', height: '100vh', color: '#fff', padding: '40px', textAlign: 'center' }}>Loading...</div>;

  return (
    <main style={{ padding: '0', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* TABS BAR */}
      <div style={{ display: 'flex', background: '#111', borderBottom: '1px solid #333', overflowX: 'auto', padding: '0 8px' }}>
         {tabs.map((tab, idx) => (
           <div key={idx} 
             onClick={() => setActiveTabIdx(idx)}
             onDoubleClick={() => renameTab(idx)}
             style={{
               padding: '12px 24px', cursor: 'pointer', borderBottom: activeTabIdx === idx ? '3px solid #22c55e' : '3px solid transparent',
               background: activeTabIdx === idx ? '#1a1a1a' : 'transparent', color: activeTabIdx === idx ? '#22c55e' : '#888',
               fontWeight: activeTabIdx === idx ? 'bold' : 'normal', transition: 'all 0.2s', whiteSpace: 'nowrap'
             }}>
             {tab.name}
           </div>
         ))}
      </div>

      <header style={{ padding: '16px 24px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>SKRODERUP <span style={{ color: '#22c55e' }}>Custom Model</span></h1>
          <select style={{ background: '#222', color: '#22c55e', padding: '6px 12px', border: '1px solid #444', borderRadius: '4px', fontWeight: 'bold' }} value={roundsFilter} onChange={e => { setRoundsFilter(e.target.value as any); clearLineups(); }}>
            <option value="16">L16 Rounds</option><option value="32">L32 Rounds</option><option value="64">L64 Rounds</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select style={{ background: '#222', color: '#fff', padding: '8px 16px', border: '1px solid #444', borderRadius: '4px', maxWidth: '300px' }} value={selectedTournament} onChange={e => { setSelectedTournament(e.target.value); clearLineups(); }}>
            {tournaments.length > 0 ? tournaments.map((t, idx) => <option key={idx} value={t.event_name}>{t.event_name}</option>) : <option>Loading schedule...</option>}
          </select>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: '380px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

            <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#3b82f6', margin: 0 }}>AI Course Adjust</h3>
                <select value={gptModel} onChange={(e) => setGptModel(e.target.value)} style={{ background: '#000', color: '#3b82f6', border: '1px solid #333', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem' }}>
                  <option value="gpt-4o-mini">GPT-4o Mini</option><option value="gpt-4o">GPT-4o</option>
                </select>
              </div>
              <textarea placeholder="Custom notes..." value={gptNotes} onChange={e => setGptNotes(e.target.value)} style={{ width: '100%', height: '40px', background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '8px' }} />
              <button onClick={aiAutoWeight} disabled={isAiLoading || isDataLoading} style={{ width: '100%', background: '#3b82f6', color: '#fff', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                {isAiLoading ? 'Analyzing...' : `Ask AI (${estimateTokenCost()})`}
              </button>
            </div>

            <div style={{ position: 'sticky', top: '-20px', background: '#111', zIndex: 5, paddingBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: '#888', margin: 0 }}>Weights</h3>
                <span style={{ fontSize: '0.8rem', color: totalWeight === 100 ? '#22c55e' : '#eab308', fontWeight: 'bold' }}>{totalWeight} / 100%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, totalWeight)}%`, background: totalWeight === 100 ? '#22c55e' : '#3b82f6', transition: 'width 0.2s, background 0.2s' }} />
              </div>
            </div>
            
            <details open style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '4px solid #a855f7' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#a855f7', fontSize: '0.85rem' }}>Strokes Gained</summary>
              <div style={{ marginTop: '12px' }}>
                {renderWeightInput('sgOTT', 'SG: Off The Tee')}
                {renderWeightInput('sgAPP', 'SG: Approach')}
                {renderWeightInput('sgARG', 'SG: Around Green')}
                {renderWeightInput('sgPUTT', 'SG: Putting')}
                {renderWeightInput('sgT2G', 'SG: Tee to Green')}
                {renderWeightInput('sgBS', 'SG: Ball Striking (OTT+APP)')}
                {renderWeightInput('sgTotal', 'SG: Total')}
              </div>
            </details>

            <details style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '4px solid #eab308' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#eab308', fontSize: '0.85rem' }}>Scoring</summary>
              <div style={{ marginTop: '12px' }}>
                {renderWeightInput('eagles_or_better', 'Eagles or Better')}
                {renderWeightInput('birdies', 'Birdies')}
                {renderWeightInput('pars', 'Pars')}
                {renderWeightInput('bob', 'BOB (Birdies or Better)')}
                {renderWeightInput('ba', 'BA (Bogey Avoidance)')}
                {renderWeightInput('doubles_or_worse', 'Doubles+ (Lower Better)')}
              </div>
            </details>

            <details style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '4px solid #f97316' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#f97316', fontSize: '0.85rem' }}>Ball Striking</summary>
              <div style={{ marginTop: '12px' }}>
                {renderWeightInput('driving_dist', 'Driving Distance')}
                {renderWeightInput('driving_acc', 'Driving Accuracy')}
                {renderWeightInput('gir', 'Greens in Regulation')}
                {renderWeightInput('scrambling', 'Scrambling')}
                {renderWeightInput('prox_fw', 'Prox from Fairway')}
                {renderWeightInput('prox_rgh', 'Prox from Rough')}
                {renderWeightInput('great_shots', 'Great Shots')}
                {renderWeightInput('poor_shots', 'Poor Shots (Lower Better)')}
              </div>
            </details>

            <details style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '4px solid #ec4899' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#ec4899', fontSize: '0.85rem' }}>Putting Splits & Wind</summary>
              <div style={{ marginTop: '12px' }}>
                {renderWeightInput('putt_bermuda', 'Bermuda Grass')}
                {renderWeightInput('putt_bentgrass', 'Bentgrass')}
                {renderWeightInput('putt_poa', 'Poa Annua Grass')}
                {renderWeightInput('wind', 'High Wind Skill')}
              </div>
            </details>
          </div>

          <div style={{ padding: '20px', background: '#000', borderTop: '1px solid #333' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Optimize Target</label>
              <select value={optTarget} onChange={e => { setOptTarget(e.target.value as any); clearLineups(); }} style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px' }}>
                <option value="custom">Custom Model Score</option>
                <option value="avg">Blended Average Score</option>
                <option value="dg">DataGolf Baseline Score</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Lineups</label><input type="number" value={numLineups} onChange={e => { setNumLineups(Number(e.target.value)); clearLineups(); }} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Global Exp %</label><input type="number" min="5" max="100" value={maxExposure} onChange={e => { setMaxExposure(Number(e.target.value)); clearLineups(); }} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Min Uniques</label><input type="number" min="1" max="5" value={minUniques} onChange={e => { setMinUniques(Number(e.target.value)); clearLineups(); }} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Min Salary</label><input type="number" value={minSalary} onChange={e => { setMinSalary(Number(e.target.value)); clearLineups(); }} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
            </div>
            
            <button onClick={generateLineups} disabled={isDataLoading} style={{ width: '100%', background: '#22c55e', color: '#000', padding: '16px', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold', cursor: isDataLoading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
              {isDataLoading ? 'LOADING DATA...' : `BUILD ${numLineups} LINEUPS IN TAB ${activeTabIdx + 1}`}
            </button>
          </div>
        </aside>

        <section style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          
          {isDataLoading ? (
             <div style={{ color: '#22c55e', fontSize: '1.2rem', padding: '40px', textAlign: 'center' }}>Loading live player data...</div>
          ) : (
            <>
              {lineups.length > 0 && (
                <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h3 style={{ color: '#22c55e', margin: 0 }}>
                        {tabs[activeTabIdx].name} - {lineups.length} Lineups
                      </h3>
                      <button onClick={clearLineups} style={{ background: '#ef4444', color: '#fff', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>✕ Clear</button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={exportDraftKingsCSV} style={{ background: '#3b82f6', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Export CSV
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                    {lineups.map((l, i) => (
                      <div key={i} style={{ background: '#222', padding: '12px', borderRadius: '8px', border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                          <strong style={{ color: '#fff' }}>Lineup #{i+1}</strong><span style={{ color: '#22c55e' }}>{l.totalProjection.toFixed(1)} pts</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', lineHeight: '1.4' }}>{l.players.map(p => <div key={p.id}>{p.name} (${p.salary})</div>)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                 <div style={{ color: '#888', fontSize: '0.8rem' }}>Field Size: {includedPlayers.length} Active, {excludedPlayers.length} Excluded</div>
                 <label style={{ color: '#fff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                   <input type="checkbox" checked={showUnwanted} onChange={e => setShowUnwanted(e.target.checked)} />
                   Show Excluded Players In Main Table
                 </label>
              </div>

              <div style={{ overflowX: 'auto', background: '#111', border: '1px solid #333', borderRadius: '8px', maxHeight: '70vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: '#0a0a0a' }}>
                      <th colSpan={2} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#ef4444' }}>OVERRIDES</th>
                      <th colSpan={2} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#888' }}>INFO</th>
                      <th colSpan={2} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#22c55e' }}>CUSTOM MODEL</th>
                      <th colSpan={2} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#3b82f6' }}>DATAGOLF</th>
                      <th colSpan={2} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#eab308' }}>BLENDED (AVG)</th>
                      <th style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#22c55e' }}>FINAL</th>
                      <th colSpan={7} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#a855f7' }}>STROKES GAINED</th>
                      <th colSpan={5} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#eab308' }}>SCORING</th>
                      <th colSpan={5} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#f97316' }}>BALL STRIKING</th>
                      <th colSpan={3} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#ec4899' }}>PUTTING SPLITS</th>
                      <th style={{ padding: '8px', textAlign: 'center', color: '#888' }}>EXCLUDE</th>
                    </tr>
                    <tr style={{ background: '#1a1a1a', borderBottom: '2px solid #333' }}>
                      {renderSortHeader('Bump', 'bump')}
                      {renderSortHeader('Exp %', 'exposure')}
                      
                      {renderSortHeader('Golfer', 'name')}
                      {renderSortHeader('Salary', 'salary')}
                      
                      {renderSortHeader('Score', 'modelScore')}
                      {renderSortHeader('Value', 'valueScore')}

                      {renderSortHeader('DG Score', 'dgBaseline')}
                      {renderSortHeader('DG Value', 'dgValue')}

                      {renderSortHeader('Avg Score', 'avgScore')}
                      {renderSortHeader('Avg Value', 'avgValue')}

                      {renderSortHeader('Proj', 'finalProj')}

                      {renderSortHeader('OTT', 'sgOTT')}
                      {renderSortHeader('APP', 'sgAPP')}
                      {renderSortHeader('ARG', 'sgARG')}
                      {renderSortHeader('PUTT', 'sgPUTT')}
                      {renderSortHeader('T2G', 'sgT2G')}
                      {renderSortHeader('BS', 'sgBS')}
                      {renderSortHeader('Total', 'sgTotal')}

                      {renderSortHeader('Eagles', 'eagles_or_better')}
                      {renderSortHeader('Birdies', 'birdies')}
                      {renderSortHeader('BOB', 'bob')}
                      {renderSortHeader('BA', 'ba')}
                      {renderSortHeader('Dbls+', 'doubles_or_worse')}

                      {renderSortHeader('Dist', 'driving_dist')}
                      {renderSortHeader('Acc', 'driving_acc')}
                      {renderSortHeader('GIR', 'gir')}
                      {renderSortHeader('Prox FW', 'prox_fw')}
                      {renderSortHeader('Prox RGH', 'prox_rgh')}

                      {renderSortHeader('Bermuda', 'putt_bermuda')}
                      {renderSortHeader('Bent', 'putt_bentgrass')}
                      {renderSortHeader('Poa', 'putt_poa')}

                      {renderSortHeader('X', 'exclude')}
                    </tr>
                  </thead>
                  <tbody>
                    {(showUnwanted ? sortedPlayers : includedPlayers).map((p, idx) => renderTableRow(p, idx, !!playerOverrides[p.id]?.exclude))}
                  </tbody>
                </table>
              </div>

              {!showUnwanted && excludedPlayers.length > 0 && (
                <div style={{ marginTop: '32px' }}>
                  <h3 style={{ color: '#666', borderBottom: '1px solid #333', paddingBottom: '8px' }}>Excluded Players</h3>
                  <div style={{ overflowX: 'auto', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem', whiteSpace: 'nowrap', opacity: 0.5 }}>
                      <tbody>
                        {excludedPlayers.map((p, idx) => renderTableRow(p, idx, true))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
