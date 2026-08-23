'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { LineupOptimizer } from '@/lib/optimizer';

type SGStats = {
  sgOTT?: number; sgAPP?: number; sgARG?: number; sgPUTT?: number; sgT2G?: number; sgTotal?: number;
  eagles_or_better?: number; birdies?: number; pars?: number; bob?: number; ba?: number; doubles_or_worse?: number;
  driving_dist?: number; driving_acc?: number; gir?: number; scrambling?: number; prox_fw?: number; prox_rgh?: number;
  great_shots?: number; poor_shots?: number;
};

type GolferStats = {
  id: string;
  name: string;
  salary: number;
  projection: number; // DG Score
  teetime?: string;
  wind?: number;
  gptScore?: number;
  stats16?: SGStats;
  stats32?: SGStats;
  stats64?: SGStats;
  putt_bermuda?: number; putt_bentgrass?: number; putt_poa?: number; wind_skill?: number;
  [key: string]: any;
};



const DEFAULT_WEIGHTS = {
  sgOTT: 15, sgAPP: 25, sgARG: 10, sgPUTT: 15, eob: 0, bob: 10, pob: 0, ba: 0,
  doubles_or_worse: 5, driving_dist: 0, driving_acc: 0, gir: 0, scrambling: 5, prox_fw: 0, prox_rgh: 0,
  great_shots: 5, poor_shots: 5, putt_bermuda: 0, putt_bentgrass: 0, putt_poa: 0, wind: 0, sgT2G: 0, sgBS: 0, sgTotal: 0,
};


let syncTimeout: NodeJS.Timeout;
let pendingSync: any = {};
let lastLocalUpdate = 0;
const syncStateToServer = (updates: any) => {
  lastLocalUpdate = Date.now();
  Object.assign(pendingSync, updates);
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const payload = { ...pendingSync };
      pendingSync = {};
      await fetch('/api/app-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {}
  }, 500);
};

export default function Home() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [players, setPlayers] = useState<GolferStats[]>([]);
  const [playerOverrides, setPlayerOverrides] = useState<any>({});
  const [safetyWeight, setSafetyWeight] = useState<number>(0);
  
  // Tabs for global navigation
  const [tabs, setTabs] = useState<any[]>([{ name: 'Tab 1', lineups: [] }]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' }>({ key: 'salary', direction: 'desc' });
  const [showUnwanted, setShowUnwanted] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Phase 1 (Data Prep) States
  const [weights, setWeights] = useState<any>(DEFAULT_WEIGHTS);
  const [viewRounds, setViewRounds] = useState<'16'|'32'|'64'>('32');
    const [fileConfigs, setFileConfigs] = useState([
    { rounds: 16, weight: 33 },
    { rounds: 32, weight: 33 },
    { rounds: 64, weight: 34 }
  ]);
  const [isGptRunning, setIsGptRunning] = useState(false);
  const [gptStatusText, setGptStatusText] = useState("");
  const [isGptLineupsOpen, setIsGptLineupsOpen] = useState(false);
  const [isGptLineupsRunning, setIsGptLineupsRunning] = useState(false);
  const [gptCompleted, setGptCompleted] = useState(false);
  
  // AI Weight Adjuster States
  const [gptNotes, setGptNotes] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState('');

  // Phase 2 (Optimizer) States
  const [numLineups, setNumLineups] = useState(20);
  const [maxExposure, setMaxExposure] = useState(50);
  const [minUniques, setMinUniques] = useState(2);
  const [minSalary, setMinSalary] = useState(49000);
  const [maxSalary, setMaxSalary] = useState(50000);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (typeof window !== 'undefined') {
      const loadState = async () => {
        try {
          const res = await fetch('/api/app-state');
          const data = await res.json();
          if (data.success && data.state) {
            if (Date.now() - lastLocalUpdate < 3000) return;
            const s = data.state;
            if (s.tabs) setTabs(s.tabs);
            if (s.activeTabIdx !== undefined) setActiveTabIdx(s.activeTabIdx);
            if (s.playerOverrides) setPlayerOverrides(s.playerOverrides);
            if (s.weights) setWeights(s.weights);
            if (s.safetyWeight !== undefined) setSafetyWeight(s.safetyWeight);
            if (s.fileConfigs) setFileConfigs(s.fileConfigs);
            if (s.optimizerSettings) {
              setNumLineups(s.optimizerSettings.numLineups);
              setMaxExposure(s.optimizerSettings.maxExposure);
              setMinUniques(s.optimizerSettings.minUniques);
              setMinSalary(s.optimizerSettings.minSalary);
              setMaxSalary(s.optimizerSettings.maxSalary);
            }
          }
        } catch (err) {}
      };

      loadState();
      interval = setInterval(loadState, 3000);

      fetchData();
      setIsClient(true);
      
      const handleTourneyChange = () => {
        setIsDataLoading(true);
        fetchData();
      };
      window.addEventListener('tournament_changed', handleTourneyChange);
      
      fetch('/api/tournaments').then(res => res.json()).then(data => {
        if (data.success && data.schedule) {
          const upcoming = data.schedule.find((t: any) => String(t.event_completed) === "0" || t.event_completed === false);
          if (upcoming) setSelectedTournament(upcoming.event_name);
          else if (data.schedule.length > 0) setSelectedTournament(data.schedule[0].event_name);
        }
      }).catch(()=>{});

      return () => {
        window.removeEventListener('tournament_changed', handleTourneyChange);
        clearInterval(interval);
      };
    }
  }, []);

  const fetchData = async () => {
    try {
      const r = await fetch('/api/players');
      const d = await r.json();
      let field = d.players || [];
      
      const t = await fetch('/api/teetimes');
      const tData = await t.json();
      if (tData.success && tData.players) {
        field = field.map((p: any) => ({
          ...p,
          teetime: tData.players[p.id]?.teetime,
          wind: tData.players[p.id]?.wind
        }));
      }
      setPlayers(field);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDataLoading(false);
    }
  };

  const totalWeight = Object.values(weights).reduce((sum, val) => Number(sum) + Number(val), 0) as number;

  const updateWeight = (key: string, val: number) => {
    const nw = { ...weights, [key]: val };
    setWeights(nw);
    syncStateToServer({ weights: nw });
  };

  const aiAutoWeight = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/course-fit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament: selectedTournament, userNotes: gptNotes + "\nIMPORTANT: Ensure exactly 100% total sum.", model: 'gpt-5.6-sol' })
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
        
        setWeights(newWeights);
        syncStateToServer({ weights: newWeights });
      }
    } catch (err) {}
    setIsAiLoading(false);
  };

  const saveOverrides = (newO: any) => {
    setPlayerOverrides(newO);
    syncStateToServer({ playerOverrides: newO });
  };
  const updateOverride = (id: string, field: string, val: any) => {
    const o = { ...playerOverrides };
    if (!o[id]) o[id] = {};
    o[id][field] = val;
    saveOverrides(o);
  };

  const handleSort = (key: string) => {
    let direction: 'asc'|'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  // Stats Accessor for Grid
  const getActiveStats = (p: GolferStats): SGStats => p[`stats${viewRounds}` as keyof GolferStats] as SGStats || p.stats32 || {};

  const getFinalProj = (p: GolferStats) => {
    return p.gptFinalRanking || p.gptScore || 0;
  };
  const getValue = (p: GolferStats) => p.gptValue || (p.salary ? (p.gptScore || 0) / (p.salary / 1000) : 0);

  const getWeightedStats = (p: GolferStats, rounds: number) => {
    const raw = p[`stats${rounds}` as keyof GolferStats] as any || {};
    const w: any = {};
    for (const key of Object.keys(weights)) {
      if (weights[key] !== 0) {
        if (key === 'sgBS') w[key] = ((Number(raw.sgOTT)||0) + (Number(raw.sgAPP)||0)) * (weights[key]/10);
        else if (key === 'sgT2G') w[key] = ((Number(raw.sgOTT)||0) + (Number(raw.sgAPP)||0) + (Number(raw.sgARG)||0)) * (weights[key]/10);
        else if (key === 'sgTotal') w[key] = ((Number(raw.sgOTT)||0) + (Number(raw.sgAPP)||0) + (Number(raw.sgARG)||0) + (Number(raw.sgPUTT)||0)) * (weights[key]/10);
        else if (key.startsWith('putt_') || key === 'wind') w[key] = (p[key] || 0) * (weights[key]/1000);
        else if (['eob', 'bob', 'pob', 'ba', 'driving_acc', 'gir', 'scrambling'].includes(key)) w[key] = (Number(raw[key])||0) * (weights[key]/100);
        else if (key === 'driving_dist') w[key] = (Number(raw[key])||0) * (weights[key]/100);
        else w[key] = (Number(raw[key])||0) * (weights[key]/10);
      }
    }
    
    // Explicitly add missing stats even if weight is 0, so they can be derived for display later
    if (w.sgOTT === undefined) w.sgOTT = (Number(raw.sgOTT)||0) * (weights.sgOTT ? weights.sgOTT/10 : 0);
    if (w.sgAPP === undefined) w.sgAPP = (Number(raw.sgAPP)||0) * (weights.sgAPP ? weights.sgAPP/10 : 0);
    if (w.sgARG === undefined) w.sgARG = (Number(raw.sgARG)||0) * (weights.sgARG ? weights.sgARG/10 : 0);
    if (w.sgPUTT === undefined) w.sgPUTT = (Number(raw.sgPUTT)||0) * (weights.sgPUTT ? weights.sgPUTT/10 : 0);

    return w;
  };

  const getDisplayStats = (p: GolferStats, rounds: number) => {
    const raw = p[`stats${rounds}` as keyof GolferStats] as any || {};
    const w = { ...getWeightedStats(p, rounds) };
    for (const key of Object.keys(weights)) {
      if (weights[key] === 0) {
        if (key === 'sgBS') w[key] = (Number(raw.sgOTT)||0) + (Number(raw.sgAPP)||0);
        else if (key === 'sgT2G') w[key] = (Number(raw.sgOTT)||0) + (Number(raw.sgAPP)||0) + (Number(raw.sgARG)||0);
        else if (key === 'sgTotal') w[key] = (Number(raw.sgOTT)||0) + (Number(raw.sgAPP)||0) + (Number(raw.sgARG)||0) + (Number(raw.sgPUTT)||0);
        else w[key] = Number(raw[key])||0;
      }
    }
    // Explicitly add derived stats for the UI if they don't have explicit weights
    w.sgBS = weights.sgBS ? w.sgBS : (Number(w.sgOTT)||0) + (Number(w.sgAPP)||0);
    w.sgT2G = weights.sgT2G ? w.sgT2G : (Number(w.sgOTT)||0) + (Number(w.sgAPP)||0) + (Number(w.sgARG)||0);
    w.sgTotal = weights.sgTotal ? w.sgTotal : (Number(w.sgT2G)||0) + (Number(w.sgPUTT)||0);
    
    // Always explicitly show raw values for distance/percentages in the UI, even if they are weighted in the background
    const uiFields = ['eob', 'bob', 'pob', 'ba', 'driving_dist', 'driving_acc', 'gir', 'scrambling', 'prox_fw', 'prox_rgh', 'great_shots', 'poor_shots'];
    uiFields.forEach(f => {
       let val = Number(raw[f])||0;
       if (['driving_acc', 'gir', 'scrambling'].includes(f)) {
         val *= 100;
       }
       w[f] = val;
    });

    return w;
  };

  const { includedPlayers, excludedPlayers, sortedPlayers, ranges } = useMemo(() => {
    const inc: GolferStats[] = [];
    const exc: GolferStats[] = [];
    players.forEach(p => {
      if (playerOverrides[p.id]?.exclude) exc.push(p);
      else inc.push(p);
    });

    const activeList = showUnwanted ? players : inc;
    let statsRanges: Record<string, { min: number, max: number }> = {};
    
    activeList.forEach(p => {
      const allStats = getDisplayStats(p, Number(viewRounds));
      for (let key in allStats) {
         if (!statsRanges[key]) statsRanges[key] = { min: Infinity, max: -Infinity };
         const v = Number(allStats[key]) || 0;
         if (v < statsRanges[key].min) statsRanges[key].min = v;
         if (v > statsRanges[key].max) statsRanges[key].max = v;
      }
    });
    
    activeList.sort((a, b) => {
      let va = 0, vb = 0;
      if (sortConfig.key === 'salary') { va = a.salary; vb = b.salary; }
      else if (sortConfig.key === 'name') { return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name); }
      else if (sortConfig.key === 'bump') { va = playerOverrides[a.id]?.bump || 0; vb = playerOverrides[b.id]?.bump || 0; }
      else if (sortConfig.key === 'exposure') { va = playerOverrides[a.id]?.exposure || 0; vb = playerOverrides[b.id]?.exposure || 0; }
      else if (sortConfig.key === 'gptScore') { va = a.gptScore || 0; vb = b.gptScore || 0; }
        else if (sortConfig.key === 'gptConfidence') { va = a.gptConfidence || 0; vb = b.gptConfidence || 0; }
        else if (sortConfig.key === 'gptMispricing') { va = Number(a.gptMispricing) || 0; vb = Number(b.gptMispricing) || 0; }
      else if (sortConfig.key === 'gptValue') { va = getValue(a); vb = getValue(b); }
      else if (sortConfig.key === 'finalProj') { va = getFinalProj(a); vb = getFinalProj(b); }
      else if (sortConfig.key === 'teetime') { return sortConfig.direction === 'asc' ? String(a.teetime||'').localeCompare(String(b.teetime||'')) : String(b.teetime||'').localeCompare(String(a.teetime||'')); }
      else if (sortConfig.key === 'wind') { va = a.wind || 0; vb = b.wind || 0; }
      else if (['sgOTT','sgAPP','sgARG','sgPUTT','sgT2G','sgBS','sgTotal','eob','bob','pob','ba','driving_dist','driving_acc','gir','scrambling','prox_fw','prox_rgh','great_shots','poor_shots'].includes(sortConfig.key)) {
        const wsa = getDisplayStats(a, Number(viewRounds));
        const wsb = getDisplayStats(b, Number(viewRounds));
        va = Number(wsa[sortConfig.key]) || 0; vb = Number(wsb[sortConfig.key]) || 0;
      }
      else { va = (a as any)[sortConfig.key] || 0; vb = (b as any)[sortConfig.key] || 0; }
      return sortConfig.direction === 'desc' ? vb - va : va - vb;
    });

    return { includedPlayers: inc, excludedPlayers: exc, sortedPlayers: activeList, ranges: statsRanges };
  }, [players, playerOverrides, sortConfig, showUnwanted, viewRounds]);

  const getGradient = (val: number, min: number, max: number, type: 'salary'|'score'|'lowerIsBetter') => {
    if (val === undefined || isNaN(val)) return 'transparent';
    let pct = (val - min) / (max - min);
    if (pct < 0) pct = 0; if (pct > 1) pct = 1;
    if (type === 'lowerIsBetter') pct = 1 - pct;
    
    if (type === 'salary') {
      const r = pct < 0.5 ? 255 : Math.floor(255 - (pct - 0.5) * 2 * 255);
      const g = pct > 0.5 ? 255 : Math.floor(pct * 2 * 255);
      return `rgba(${r},${g},0,0.15)`;
    }
    const r = pct < 0.5 ? 255 : Math.floor(255 - (pct - 0.5) * 2 * 255);
    const g = pct > 0.5 ? 255 : Math.floor(pct * 2 * 255);
    return `rgba(${r},${g},0,0.25)`;
  };



  const sendToGPT = async () => {
    const totalW = fileConfigs.reduce((acc, curr) => acc + curr.weight, 0);
    if (totalW !== 100) {
      alert("Weights must sum exactly to 100%. Currently: " + totalW + "%");
      return;
    }

    setIsGptRunning(true);
    setGptStatusText('Analyzing data with gpt-5.6-sol (Low Reasoning)...');
    try {
      const gptPayload = players.map(p => {
        const payload: any = { 
          name: p.name, 
          salary: p.salary,
          teetime: p.teetime || '',
          wind: p.wind || 0,
          bump: playerOverrides[p.id]?.bump || 0
        };
        
        const combinedStats: any = {};
        
        fileConfigs.forEach((c, i) => {
          const wStats = getWeightedStats(p, c.rounds);
          payload[`Dataset${i+1}_${c.rounds}R`] = wStats;
          
          for (const key of Object.keys(wStats)) {
            combinedStats[key] = (combinedStats[key] || 0) + (wStats[key] * (c.weight / 100));
          }
        });
        
        payload.Combined_Final_Stats = combinedStats;
        return payload;
      });

      const res = await fetch('/api/gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5.6-sol',
          configurations: fileConfigs,
          fieldData: gptPayload
        })
      });
      const data = await res.json();
      
      if (data.success && data.predictions) {
        const pMap = data.predictions;
        setPlayers(prev => prev.map(p => {
            const match = pMap[p.name] || pMap[p.name.split(' ')[0]];
            const gptScore = match ? (typeof match === 'object' ? Number(match.score) : Number(match)) : p.projection;
            return {
              ...p,
              gptScore,
              gptValue: match && typeof match === 'object' ? match.value : undefined,
              gptFinalRanking: match && typeof match === 'object' ? match.final_ranking : undefined,
              gptConfidence: match && typeof match === 'object' ? match.confidence : undefined,
              gptMispricing: match && typeof match === 'object' ? match.mispricing : undefined,
              gptReason: match && typeof match === 'object' ? match.reason : undefined
            };
          }));
        setGptCompleted(true);
      } else {
        alert("GPT Error: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Request failed: " + e.message);
    } finally {
      setIsGptRunning(false);
    }
  };

  const generateGptLineups = async () => {
      setIsGptLineupsRunning(true);
    setGptStatusText('Generating Lineups with gpt-5.6-sol (High Reasoning)...');
      setGptStatusText("Generating Lineups with gpt-5.6-sol (High Reasoning)...");
      try {
      const activePool = players.filter(p => !playerOverrides[p.id]?.exclude && p.salary > 0);
      const gptPayload = activePool.map(p => {
        const payload: any = { 
          name: p.name, 
          salary: p.salary,
          final_ranking: getFinalProj(p).toFixed(2),
          gpt_score: p.gptScore,
          value_score: getValue(p).toFixed(2),
          teetime: p.teetime || '',
          wind: p.wind || 0,
          bump: playerOverrides[p.id]?.bump || 0
        };
        
        const combinedStats: any = {};
        
        fileConfigs.forEach((c, i) => {
          const wStats = getWeightedStats(p, c.rounds);
          payload[`Dataset${i+1}_${c.rounds}R`] = wStats;
          
          for (const key of Object.keys(wStats)) {
            combinedStats[key] = (combinedStats[key] || 0) + (wStats[key] * (c.weight / 100));
          }
        });
        
        payload.Combined_Final_Stats = combinedStats;
        return payload;
      });

      const res = await fetch('/api/gpt-lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          configurations: fileConfigs,
          fieldData: gptPayload,
          optimizerSettings: { numLineups, maxExposure, minUniques, minSalary, maxSalary }
        })
      });
      
      const data = await res.json();
      if (data.success && data.lineups) {
        // Apply the generated lineups to the active tab
        setTabs((prev: any) => {
          const nt = [...prev];
          // Transform GPT lineups into the format expected by the lineups page
          // { id: 1, golfers: [player1, player2, ...] }
          const processed = data.lineups.map((lu: any) => {
            return {
              id: lu.id || Math.random().toString(36).substr(2, 9),
              golfers: lu.players.map((name: string) => {
                // Find golfer in players array
                const golfer = players.find(p => p.name === name || p.name.includes(name) || name.includes(p.name));
                return golfer || { name: name, salary: 0 };
              })
            };
          });
          nt[activeTabIdx] = { ...nt[activeTabIdx], lineups: processed };
          syncStateToServer({ tabs: nt });
          return nt;
        });
        router.push('/lineups');
      } else {
        alert("GPT Error: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Request failed: " + e.message);
    } finally {
      setIsGptLineupsRunning(false);
    }
  };

  const generateLineups = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const activePool = players.filter(p => !playerOverrides[p.id]?.exclude && p.salary > 0);
        const mappedPlayers = activePool.map(p => ({
          id: p.id,
          name: p.name,
          salary: p.salary,
          projection: getFinalProj(p),
          maxExposure: playerOverrides[p.id]?.exposure,
          customWeight: 0
        }));

        const optimized = LineupOptimizer.generateTopLineups(mappedPlayers, {
          minSalary, maxSalary, numLineups, maxExposure, minUniques
        }).map(l => ({ ...l, players: l.players.map(p => ({ id: p.id, name: p.name, salary: p.salary })) }));

        setTabs(prev => {
          const nt = [...prev];
          nt[activeTabIdx] = { ...nt[activeTabIdx], lineups: optimized };
          syncStateToServer({ tabs: nt });
          return nt;
        });
        
        router.push('/lineups');
      } catch(e: any) {
        alert('Error generating lineups: ' + e.message);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  const exportPage1ToCSV = () => {
    let csv = "Name,Salary,Tee Time,Wind,SG OTT,SG APP,SG ARG,SG PUTT,SG T2G,SG BS,SG Total,EoB%,BoB%,PoB%,BA%,Driving Dist,Driving Acc,GIR,Scrambling,Prox FW,Prox RGH,Great Shots,Poor Shots\n";
    sortedPlayers.forEach(p => {
      const wStats = getDisplayStats(p, Number(viewRounds));
      csv += `"${p.name}",${p.salary || ''},${p.teetime || ''},${p.wind || ''},${(wStats.sgOTT||0).toFixed(2)},${(wStats.sgAPP||0).toFixed(2)},${(wStats.sgARG||0).toFixed(2)},${(wStats.sgPUTT||0).toFixed(2)},${(wStats.sgT2G||0).toFixed(2)},${(wStats.sgBS||0).toFixed(2)},${(wStats.sgTotal||0).toFixed(2)},${(wStats.eob||0).toFixed(1)},${(wStats.bob||0).toFixed(1)},${(wStats.pob||0).toFixed(1)},${(wStats.ba||0).toFixed(1)},${(wStats.driving_dist||0).toFixed(1)},${(wStats.driving_acc||0).toFixed(1)},${(wStats.gir||0).toFixed(1)},${(wStats.scrambling||0).toFixed(1)},${(wStats.prox_fw||0).toFixed(1)},${(wStats.prox_rgh||0).toFixed(1)},${(wStats.great_shots||0).toFixed(2)},${(wStats.poor_shots||0).toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weighted_stats_dataset_${viewRounds}r.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportGridToCSV = () => {
    let csv = "Name,Salary,Tee Time,Wind,Bump,Exposure,GPT Score,GPT Value,Final Proj\n";
    sortedPlayers.forEach(p => {
      const cs = p.gptScore || 0;
      const cv = getValue(p);
      const fs = getFinalProj(p);
      csv += `"${p.name}",${p.salary},${p.teetime||''},${p.wind||''},${playerOverrides[p.id]?.bump || 0},${playerOverrides[p.id]?.exposure || ''},${cs.toFixed(2)},${cv.toFixed(2)},${fs.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skroderup_gpt_data.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const DESCRIPTIONS: Record<string, string> = {
    name: "Golfer's name",
    salary: "DraftKings Salary",
    sgOTT: "Strokes Gained: Off The Tee - Performance off the tee box.",
    sgAPP: "Strokes Gained: Approach - Performance on shots into the green.",
    sgARG: "Strokes Gained: Around The Green - Performance on chips and pitches.",
    sgPUTT: "Strokes Gained: Putting - Performance on the putting surface.",
    sgT2G: "Strokes Gained: Tee to Green - Overall performance excluding putting.",
    sgBS: "Strokes Gained: Ball Striking - Sum of Off The Tee and Approach.",
    sgTotal: "Strokes Gained: Total - Overall performance compared to the field.",
    eob: "Eagle or Better % - How often the golfer scores an eagle or better.",
    bob: "Birdie or Better % - How often the golfer scores a birdie or better.",
    pob: "Par or Better % - How often the golfer avoids a bogey.",
    ba: "Bogey Avoidance - Lower is better. % of holes with a bogey or worse.",
    driving_dist: "Driving Distance - Average length of drives (yards).",
    driving_acc: "Driving Accuracy - % of fairways hit off the tee.",
    gir: "Greens in Regulation - % of greens hit in the expected number of strokes.",
    scrambling: "Scrambling - % of times saving par after missing the green.",
    prox_fw: "Proximity from Fairway - Average distance to the hole from the fairway.",
    prox_rgh: "Proximity from Rough - Average distance to the hole from the rough.",
    great_shots: "Great Shots - Shots that significantly beat the field average.",
    poor_shots: "Poor Shots - Shots that significantly fall behind the field average.",
    bump: "Manual Bump - Your custom adjustment to the final projection.",
    exposure: "Max Exposure % - Maximum % of lineups this golfer can appear in.",
    teetime: "Tee Time - The golfer's starting time.",
    wind: "Wind Speed - Expected wind speed during their round.",
    gptScore: "GPT Score (1-100) - AI's rating of raw skill based on weighted stats.",
    gptConfidence: "GPT Confidence (1-100) - Consistency across the 16, 32, and 64 round timeframes.",
    gptValue: "GPT Value (1-100) - AI's rating of salary vs expected performance.",
    gptMispricing: "GPT Mispricing (1-100) - 1 is extremely overpriced, 100 is extremely underpriced.",
    finalProj: "Final Projection (1-100) - AI's ultimate ranking incorporating Score, Value, Wind, Tee Time, and Bumps."
  };

  const renderSortHeader = (label: string, key: string) => {
    const isAct = sortConfig.key === key;
    return (
      <th title={DESCRIPTIONS[key] || label} onClick={() => handleSort(key)} style={{ padding: '8px', cursor: 'pointer', userSelect: 'none', background: isAct ? '#222' : 'transparent', borderRight: '1px solid #333' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          {label} {isAct ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}
        </div>
      </th>
    );
  };

  const renderWeightInput = (stat: string, label: string) => (
    <div key={stat} style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '0.75rem' }}><span>{label}</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="number" min="0" max="100" value={(weights as any)[stat] || 0} onChange={(e) => updateWeight(stat, Number(e.target.value))} style={{ flex: 1, background: '#222', color: '#fff', padding: '4px 6px', border: '1px solid #444', borderRadius: '4px', fontWeight: 'bold' }} />
        <span style={{ color: '#888', fontSize: '0.8rem' }}>%</span>
      </div>
    </div>
  );

  if (!isClient) return <div style={{ background: '#0a0a0a', height: '100vh' }} />;

  const estTokens = players.length * 300;
  
  const updateActiveTab = (idx: number) => {
    setActiveTabIdx(idx);
    syncStateToServer({ activeTabIdx: idx });
  };
  const updateTabs = (newTabs: any[]) => {
    setTabs(newTabs);
    syncStateToServer({ tabs: newTabs });
  };

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' }}>
      <Navigation tabs={tabs} setTabs={updateTabs} activeTabIdx={activeTabIdx} setActiveTabIdx={updateActiveTab} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        <aside style={{ width: '380px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
          {!gptCompleted ? (
            <>
              {/* PHASE 1: DATA PREP SIDEBAR */}
              <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                
                {/* AI Weight Adjuster */}
                <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#3b82f6', margin: 0 }}>AI Course Adjust</h3>
                  </div>
                  <textarea placeholder="Custom notes..." value={gptNotes} onChange={e => setGptNotes(e.target.value)} style={{ width: '100%', height: '40px', background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '8px' }} />
                  <button onClick={aiAutoWeight} disabled={isAiLoading || isDataLoading} style={{ width: '100%', background: '#3b82f6', color: '#fff', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {isAiLoading ? 'Analyzing...' : `Ask AI`}
                  </button>
                </div>

                <div style={{ position: 'sticky', top: '-20px', background: '#111', zIndex: 5, paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: '#888', margin: 0 }}>Weights</h3>
                      <button onClick={() => {
                        const nw = { ...weights };
                        for (const k in nw) nw[k] = 0;
                        setWeights(nw);
                        syncStateToServer({ weights: nw });
                      }} style={{ background: '#333', border: '1px solid #444', color: '#ccc', padding: '2px 8px', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer' }}>Zero All</button>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: totalWeight === 100 ? '#22c55e' : '#eab308', fontWeight: 'bold' }}>{totalWeight} / 100%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, totalWeight)}%`, background: totalWeight === 100 ? '#22c55e' : '#3b82f6', transition: 'width 0.2s, background 0.2s' }} />
                  </div>
                </div>

                <details open style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '4px solid #a855f7' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#a855f7', fontSize: '0.85rem' }}>Strokes Gained</summary>
                  <div style={{ marginTop: '12px' }}>
                    {renderWeightInput('sgOTT', 'Off The Tee')}
                    {renderWeightInput('sgAPP', 'Approach')}
                    {renderWeightInput('sgARG', 'Around Green')}
                    {renderWeightInput('sgPUTT', 'Putting')}
                          {renderWeightInput('sgT2G', 'Tee to Green')}
                          {renderWeightInput('sgBS', 'Ball Striking')}
                          {renderWeightInput('sgTotal', 'Total SG')}
                  </div>
                </details>
                <details style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '4px solid #eab308' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#eab308', fontSize: '0.85rem' }}>Scoring</summary>
                  <div style={{ marginTop: '12px' }}>
                    {renderWeightInput('eob', 'Eagle or Better %')}
                    {renderWeightInput('bob', 'Birdie or Better %')}
                    {renderWeightInput('pob', 'Par or Better %')}
                    {renderWeightInput('ba', 'Bogey Avoidance')}
                  </div>
                </details>
                <details style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '4px solid #f97316' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#f97316', fontSize: '0.85rem' }}>Ball Striking & Proximities</summary>
                  <div style={{ marginTop: '12px' }}>
                    {renderWeightInput('driving_dist', 'Driving Distance')}
                    {renderWeightInput('driving_acc', 'Driving Accuracy')}
                    {renderWeightInput('gir', 'GIR')}
                    {renderWeightInput('scrambling', 'Scrambling')}
                    {renderWeightInput('great_shots', 'Great Shots')}
                    {renderWeightInput('poor_shots', 'Poor Shots')}
                    {renderWeightInput('prox_fw', 'Prox: Fairway')}
                    {renderWeightInput('prox_rgh', 'Prox: Rough')}
                  </div>
                </details>
              </div>
              <div style={{ padding: '20px', background: '#0a0a0a', borderTop: '1px solid #333' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#a855f7', marginBottom: '12px', marginTop: 0 }}>GPT Setup</h3>
                
                {fileConfigs.map((fc, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <select value={fc.rounds} onChange={e => {
                      const nf = [...fileConfigs]; nf[idx].rounds = Number(e.target.value); setFileConfigs(nf); syncStateToServer({ fileConfigs: nf });
                    }} style={{ flex: 1, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px' }}>
                      <option value="16">16 Rounds Data</option>
                      <option value="32">32 Rounds Data</option>
                      <option value="64">64 Rounds Data</option>
                    </select>
                    <input type="number" min="0" max="100" value={fc.weight} onChange={e => {
                      const nf = [...fileConfigs]; nf[idx].weight = Number(e.target.value); setFileConfigs(nf); syncStateToServer({ fileConfigs: nf });
                    }} style={{ width: '70px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px', textAlign: 'center' }} />
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: fileConfigs.reduce((a,b)=>a+b.weight,0) === 100 ? '#22c55e' : '#ef4444', marginBottom: '12px' }}>
                  Total: {fileConfigs.reduce((a,b)=>a+b.weight,0)}%
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button onClick={sendToGPT} disabled={isGptRunning} style={{ width: '100%', background: '#a855f7', color: '#fff', padding: '12px', border: 'none', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
                      {isGptRunning ? 'Processing...' : 'Send to GPT'}
                    </button>
                    {isGptRunning && (
                      <div style={{ width: '100%', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#a855f7', marginBottom: '4px', fontWeight: 'bold' }}>{gptStatusText}</div>
                        <div style={{ width: '100%', background: '#222', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: '0%', height: '100%', background: '#a855f7', animation: 'fillUp 120s cubic-bezier(0.1, 0.7, 0.1, 1) forwards' }}></div>
                        </div>
                        <style>{`@keyframes fillUp { 0% { width: 0%; } 100% { width: 90%; } }`}</style>
                      </div>
                    )}
                  </div>

                  <button onClick={exportPage1ToCSV} style={{ width: '100%', marginTop: '8px', background: '#2563eb', color: '#fff', padding: '12px', border: 'none', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
                  Export Weighted Stats (CSV)
                </button>
              </div>
            </>
          ) : (
            <>
              {/* PHASE 2: OPTIMIZER SIDEBAR */}
              <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '16px' }}>
                   <h2 style={{ color: '#22c55e', margin: 0 }}>Optimizer Settings</h2>
                   <button onClick={() => setGptCompleted(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem' }}>Edit Data</button>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '24px' }}>
                  GPT processing complete! Use the settings below to generate your DraftKings lineups.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                  <div><label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Lineups</label>
                    <input type="number" value={numLineups} onChange={e => { setNumLineups(Number(e.target.value)); syncStateToServer({ optimizerSettings: { numLineups: Number(e.target.value), maxExposure, minUniques, minSalary, maxSalary } }); }} style={{ width: '100%', padding: '8px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                  </div>
                  <div><label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Global Exp %</label>
                    <input type="number" value={maxExposure} onChange={e => { setMaxExposure(Number(e.target.value)); syncStateToServer({ optimizerSettings: { numLineups, maxExposure: Number(e.target.value), minUniques, minSalary, maxSalary } }); }} style={{ width: '100%', padding: '8px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                  </div>
                  <div><label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Min Salary</label>
                    <input type="number" value={minSalary} onChange={e => { setMinSalary(Number(e.target.value)); syncStateToServer({ optimizerSettings: { numLineups, maxExposure, minUniques, minSalary: Number(e.target.value), maxSalary } }); }} style={{ width: '100%', padding: '8px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                  </div>
                  <div><label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Max Salary</label>
                    <input type="number" value={maxSalary} onChange={e => { setMaxSalary(Number(e.target.value)); syncStateToServer({ optimizerSettings: { numLineups, maxExposure, minUniques, minSalary, maxSalary: Number(e.target.value) } }); }} style={{ width: '100%', padding: '8px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                  </div>
                  <div><label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Min Uniques</label>
                    <input type="number" value={minUniques} onChange={e => { setMinUniques(Number(e.target.value)); syncStateToServer({ optimizerSettings: { numLineups, maxExposure, minUniques: Number(e.target.value), minSalary, maxSalary } }); }} style={{ width: '100%', padding: '8px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                  </div>
                </div>
                
                                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontWeight: 'bold', color: '#10b981', fontSize: '0.85rem' }}>Vegas Odds (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={safetyWeight}
                    onChange={(e) => { setSafetyWeight(Number(e.target.value)); syncStateToServer({ safetyWeight: Number(e.target.value) }); }}
                    style={{ width: '60px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '4px 8px', textAlign: 'center' }}
                  />
                </div>
                
                <hr style={{ borderColor: '#333', margin: '20px 0' }} />
                                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                            <button onClick={generateGptLineups} disabled={isGptLineupsRunning} style={{ width: '100%', background: '#10b981', color: '#fff', padding: '12px', border: 'none', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
                        {isGptLineupsRunning ? 'Generating...' : 'Generate'}
                      </button>
                      {isGptLineupsRunning && (
                        <div style={{ width: '100%', textAlign: 'center', marginTop: '4px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '4px', fontWeight: 'bold' }}>{gptStatusText}</div>
                          <div style={{ width: '100%', background: '#222', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: '0%', height: '100%', background: '#10b981', animation: 'fillUp 120s cubic-bezier(0.1, 0.7, 0.1, 1) forwards' }}></div>
                          </div>
                        </div>
                      )}
                    </div>
              </div>
            </>
          )}
        </aside>

        <section style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {isDataLoading ? (
             <div style={{ color: '#22c55e', fontSize: '1.2rem', padding: '40px', textAlign: 'center' }}>Loading live player data...</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ color: '#888', fontSize: '0.9rem' }}>Field Size: {includedPlayers.length} Active, {excludedPlayers.length} Excluded</div>
                   {!gptCompleted && (
                     <select 
                       value={viewRounds} 
                       onChange={e => setViewRounds(e.target.value as any)} 
                       style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px 12px', fontSize: '0.85rem' }}
                     >
                       <option value="16">Viewing 16 Rounds</option>
                       <option value="32">Viewing 32 Rounds</option>
                       <option value="64">Viewing 64 Rounds</option>
                     </select>
                   )}
                   {gptCompleted && (
                     <button 
                       onClick={exportGridToCSV}
                       style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}
                     >
                       Export CSV
                     </button>
                   )}
                 </div>
                 <label style={{ color: '#fff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                   <input type="checkbox" checked={showUnwanted} onChange={e => setShowUnwanted(e.target.checked)} />
                   Show Excluded Players In Main Table
                 </label>
              </div>

              <div style={{ overflowX: 'auto', background: '#111', border: '1px solid #333', borderRadius: '8px', maxHeight: '75vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                    <tr style={{ background: 'rgba(10, 10, 10, 0.85)' }}>
                      {!gptCompleted ? (
                        <>
                          <th colSpan={1} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: 'white', WebkitTextStroke: '1px #888', fontSize: '1.1rem', letterSpacing: '1px' }}>EXCLUDE</th>
                          <th colSpan={3} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: 'white', WebkitTextStroke: '1px #888', fontSize: '1.1rem', letterSpacing: '1px' }}>INFO</th>
                          <th colSpan={7} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: 'white', WebkitTextStroke: '1px #a855f7', fontSize: '1.1rem', letterSpacing: '1px' }}>STROKES GAINED</th>
                          <th colSpan={4} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: 'white', WebkitTextStroke: '1px #eab308', fontSize: '1.1rem', letterSpacing: '1px' }}>SCORING</th>
                          <th colSpan={8} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: 'white', WebkitTextStroke: '1px #f97316', fontSize: '1.1rem', letterSpacing: '1px' }}>BALL STRIKING</th>
                        </>
                      ) : (
                        <>
                          <th colSpan={1} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: 'white', WebkitTextStroke: '1px #888', fontSize: '1.1rem', letterSpacing: '1px' }}>EXCLUDE</th>
                          <th colSpan={2} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: '#ef4444' }}>OVERRIDES</th>
                          <th colSpan={2} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: 'white', WebkitTextStroke: '1px #888', fontSize: '1.1rem', letterSpacing: '1px' }}>INFO</th>
                          <th colSpan={2} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: '#eab308' }}>ENVIRONMENT</th>
                          <th colSpan={5} style={{ borderRight: '4px solid #555', padding: '8px', textAlign: 'center', color: '#22c55e' }}>GPT MODEL</th>
                        </>
                      )}
                    </tr>
                    
                    {!gptCompleted ? (
                      <tr style={{ background: 'rgba(26, 26, 26, 0.85)', borderBottom: '2px solid #333' }}>
                        <th style={{ padding: '8px', cursor: 'pointer', textAlign: 'center', color: '#ccc', width: '60px' }}>Exclude</th>
                        {renderSortHeader('Golfer', 'name')}
                        {renderSortHeader('Salary', 'salary')}
                        {renderSortHeader('Tee Time', 'teetime')}
                        
                        {renderSortHeader('OTT', 'sgOTT')}
                        {renderSortHeader('APP', 'sgAPP')}
                        {renderSortHeader('ARG', 'sgARG')}
                        {renderSortHeader('PUTT', 'sgPUTT')}
                        {renderSortHeader('T2G', 'sgT2G')}
                        {renderSortHeader('BS', 'sgBS')}
                        {renderSortHeader('TOT', 'sgTotal')}
                        
                        {renderSortHeader('EoB %', 'eob')}
                        {renderSortHeader('BoB %', 'bob')}
                        {renderSortHeader('PoB %', 'pob')}
                        {renderSortHeader('BA %', 'ba')}
                        
                        {renderSortHeader('Dist', 'driving_dist')}
                        {renderSortHeader('Acc', 'driving_acc')}
                        {renderSortHeader('GIR', 'gir')}
                        {renderSortHeader('Scram', 'scrambling')}
                        {renderSortHeader('Px Fw', 'prox_fw')}
                        {renderSortHeader('Px Rgh', 'prox_rgh')}
                        {renderSortHeader('Great', 'great_shots')}
                        {renderSortHeader('Poor', 'poor_shots')}
                      </tr>
                    ) : (
                      <tr style={{ background: 'rgba(26, 26, 26, 0.85)', borderBottom: '2px solid #333' }}>
                        <th style={{ padding: '8px', cursor: 'pointer', textAlign: 'center', color: '#ccc', width: '60px' }}>Exclude</th>
                        {renderSortHeader('Bump', 'bump')}
                        {renderSortHeader('Exp %', 'exposure')}
                        {renderSortHeader('Golfer', 'name')}
                        {renderSortHeader('Salary', 'salary')}
                        
                        {renderSortHeader('Tee Time', 'teetime')}
                        {renderSortHeader('Wind', 'wind')}
                        
                        {renderSortHeader('Score', 'gptScore')}
                          {renderSortHeader('Conf', 'gptConfidence')}
                          {renderSortHeader('Value', 'gptValue')}
                          {renderSortHeader('Misprice', 'gptMispricing')}
                          {renderSortHeader('Final Proj', 'finalProj')}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {sortedPlayers.map(p => {
                      try {
                      const isExcluded = playerOverrides[p.id]?.exclude;
                      const stats = getActiveStats(p);
                      const hasGpt = p.gptScore !== undefined;
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #222', background: isExcluded ? '#2a0a0a' : 'transparent', opacity: isExcluded ? 0.6 : 1 }}>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input type="checkbox" checked={!!isExcluded} onChange={(e) => updateOverride(p.id, 'exclude', e.target.checked)} style={{ cursor: 'pointer' }} />
                          </td>
                          {gptCompleted && (
                            <>
                          <td style={{ padding: '4px', borderRight: '1px solid #333', textAlign: 'center' }}>
                             <input type="number" value={playerOverrides[p.id]?.bump || ''} onChange={e => updateOverride(p.id, 'bump', Number(e.target.value))} style={{ width: '40px', background: '#333', color: '#fff', border: 'none', textAlign: 'center', padding: '4px', borderRadius: '4px' }} placeholder="0" />
                          </td>
                          <td style={{ padding: '4px', borderRight: '4px solid #555', textAlign: 'center' }}>
                             <input type="number" min="0" max="100" value={playerOverrides[p.id]?.exposure || ''} onChange={e => updateOverride(p.id, 'exposure', Number(e.target.value))} style={{ width: '40px', background: '#333', color: '#fff', border: 'none', textAlign: 'center', padding: '4px', borderRadius: '4px' }} placeholder="-" />
                          </td>
                            </>
                          )}
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.name}</td>
                          <td style={{ padding: '8px', background: p.salary ? getGradient(p.salary, ranges.salary?.min||0, ranges.salary?.max||0, 'salary') : 'transparent', color: p.salary ? '#fff' : '#22c55e', fontWeight: 'bold', textAlign: 'center' }}>${p.salary || '-'}</td>
                          
                          {!gptCompleted ? (() => {
                              const wStats = getDisplayStats(p, Number(viewRounds));
                              return (
                            <>
                              <td style={{ padding: '8px', color: '#aaa', textAlign: 'center' }}>{typeof p.teetime === 'string' ? p.teetime.substring(11, 16) : '-'}</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.sgOTT||0, ranges.sgOTT?.min||0, ranges.sgOTT?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.sgOTT||0).toFixed(2)}</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.sgAPP||0, ranges.sgAPP?.min||0, ranges.sgAPP?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.sgAPP||0).toFixed(2)}</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.sgARG||0, ranges.sgARG?.min||0, ranges.sgARG?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.sgARG||0).toFixed(2)}</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.sgPUTT||0, ranges.sgPUTT?.min||0, ranges.sgPUTT?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.sgPUTT||0).toFixed(2)}</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.sgT2G||0, ranges.sgT2G?.min||0, ranges.sgT2G?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.sgT2G||0).toFixed(2)}</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.sgBS||0, ranges.sgBS?.min||0, ranges.sgBS?.max||0, 'score'), color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>{(wStats.sgBS||0).toFixed(2)}</td>
                              <td style={{ padding: '8px', borderRight: '4px solid #555', background: getGradient(wStats.sgTotal||0, ranges.sgTotal?.min||0, ranges.sgTotal?.max||0, 'score'), color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>{(wStats.sgTotal||0).toFixed(2)}</td>
                              
                              <td style={{ padding: '8px', background: getGradient(wStats.eob||0, ranges.eob?.min||0, ranges.eob?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.eob||0).toFixed(1)}%</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.bob||0, ranges.bob?.min||0, ranges.bob?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.bob||0).toFixed(1)}%</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.pob||0, ranges.pob?.min||0, ranges.pob?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.pob||0).toFixed(1)}%</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.ba||0, ranges.ba?.min||0, ranges.ba?.max||0, 'lowerIsBetter'), borderRight: '4px solid #555', color: '#fff', textAlign: 'center' }}>{(wStats.ba||0).toFixed(1)}%</td>
                              
                              <td style={{ padding: '8px', background: getGradient(wStats.driving_dist||0, ranges.driving_dist?.min||0, ranges.driving_dist?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.driving_dist||0).toFixed(1)}</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.driving_acc||0, ranges.driving_acc?.min||0, ranges.driving_acc?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.driving_acc||0).toFixed(1)}%</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.gir||0, ranges.gir?.min||0, ranges.gir?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.gir||0).toFixed(1)}%</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.scrambling||0, ranges.scrambling?.min||0, ranges.scrambling?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.scrambling||0).toFixed(1)}%</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.prox_fw||0, ranges.prox_fw?.min||0, ranges.prox_fw?.max||0, 'lowerIsBetter'), color: '#fff', textAlign: 'center' }}>{(wStats.prox_fw||0).toFixed(1)}'</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.prox_rgh||0, ranges.prox_rgh?.min||0, ranges.prox_rgh?.max||0, 'lowerIsBetter'), color: '#fff', textAlign: 'center' }}>{(wStats.prox_rgh||0).toFixed(1)}'</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.great_shots||0, ranges.great_shots?.min||0, ranges.great_shots?.max||0, 'score'), color: '#fff', textAlign: 'center' }}>{(wStats.great_shots||0).toFixed(1)}</td>
                              <td style={{ padding: '8px', background: getGradient(wStats.poor_shots||0, ranges.poor_shots?.min||0, ranges.poor_shots?.max||0, 'lowerIsBetter'), borderRight: '4px solid #555', color: '#fff', textAlign: 'center' }}>{(wStats.poor_shots||0).toFixed(1)}</td>
                            </>
                              );
                          })() : (
                            <>
                              <td style={{ padding: '8px', color: '#aaa', textAlign: 'center' }}>{typeof p.teetime === 'string' ? p.teetime.substring(11, 16) : '-'}</td>
                              <td style={{ padding: '8px', borderRight: '4px solid #555', color: '#3b82f6', textAlign: 'center' }}>{p.wind ? `${p.wind} km/h` : '-'}</td>
                              
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', background: hasGpt ? getGradient(Number(p.gptScore)||0, ranges.gptScore?.min||0, ranges.gptScore?.max||0, 'score') : 'transparent', color: hasGpt ? '#fff' : '#555' }} title={p.gptReason || ''}>
                                    {hasGpt ? (Number(p.gptScore) || 0).toFixed(2) : '-'}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center', background: (hasGpt && p.gptConfidence) ? getGradient(Number(p.gptConfidence)||0, ranges.gptConfidence?.min||0, ranges.gptConfidence?.max||0, 'score') : 'transparent', color: hasGpt ? '#fff' : '#555' }}>
                                    {hasGpt && p.gptConfidence ? p.gptConfidence.toFixed(1) : '-'}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center', background: hasGpt ? getGradient(getValue(p), ranges.gptValue?.min||0, ranges.gptValue?.max||0, 'score') : 'transparent', color: hasGpt ? '#fff' : '#555' }}>
                                    {hasGpt ? getValue(p).toFixed(2) : '-'}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center', background: hasGpt ? getGradient(Number(p.gptMispricing)||0, ranges.gptMispricing?.min||0, ranges.gptMispricing?.max||0, 'score') : 'transparent', color: hasGpt ? '#fff' : '#555' }}>
                                    {hasGpt && p.gptMispricing ? Number(p.gptMispricing).toFixed(1) : '-'}
                                  </td>
                                <td style={{ padding: '8px', borderRight: '4px solid #555', textAlign: 'center', fontWeight: 'bold', background: hasGpt ? getGradient(getFinalProj(p), ranges.finalProj?.min||0, ranges.finalProj?.max||0, 'score') : 'transparent', color: hasGpt ? '#fff' : '#555' }}>
                                  {hasGpt ? getFinalProj(p).toFixed(2) : '-'}
                                </td>
                            </>
                          )}
                        </tr>
                      );
                      } catch (err) {
                        console.error('Error rendering player', p, err);
                        return null;
                      }
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
