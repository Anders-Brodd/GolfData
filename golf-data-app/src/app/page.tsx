'use client';
import { useState, useEffect } from 'react';
import { LineupOptimizer, PlayerData, Lineup } from '@/lib/optimizer';

interface SGStats {
  sgOTT: number; sgAPP: number; sgARG: number; sgPUTT: number; sgT2G: number; sgTotal: number;
  round_score: number; eagles_or_better: number; birdies: number; pars: number; bogies: number; doubles_or_worse: number; bob: number; ba: number;
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

interface SaveSlot<T> {
  name: string;
  data: T;
}

const DEFAULT_WEIGHTS = {
  sgOTT: 10, sgAPP: 10, sgARG: 5, sgPUTT: 5, sgT2G: 10, sgTotal: 5,
  round_score: 5, eagles_or_better: 0, birdies: 5, pars: 0, bogies: 0, doubles_or_worse: 0, bob: 5, ba: 5,
  driving_dist: 0, driving_acc: 0, gir: 5, scrambling: 5, prox_fw: 0, prox_rgh: 0, great_shots: 0, poor_shots: 0,
  putt_bermuda: 5, putt_bentgrass: 5, putt_poa: 0, wind: 5
};

export default function Home() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [players, setPlayers] = useState<GolferStats[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  
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
  
  // Sorting
  const [sortField, setSortField] = useState('modelScore');
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc');

  // GPT Chat Notes
  const [gptNotes, setGptNotes] = useState('');
  const [gptReasoning, setGptReasoning] = useState('');
  const [gptModel, setGptModel] = useState('gpt-4o-mini');

  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const totalWeight = Object.values(weights).reduce((sum, val) => sum + val, 0);

  // --- SAVE SLOTS STATE ---
  const [weightSlots, setWeightSlots] = useState<SaveSlot<typeof DEFAULT_WEIGHTS>[]>(Array(10).fill({ name: 'Empty Slot', data: null }));
  const [activeWeightSlot, setActiveWeightSlot] = useState<number>(-1);
  const [lineupSlots, setLineupSlots] = useState<SaveSlot<Lineup[]>[]>(Array(10).fill({ name: 'Empty Slot', data: null }));
  const [activeLineupSlot, setActiveLineupSlot] = useState<number>(-1);
  
  // Load from LocalStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedWeights = localStorage.getItem('skroderup_active_weights');
      if (savedWeights) setWeights(JSON.parse(savedWeights));
      
      const savedLineups = localStorage.getItem('skroderup_active_lineups');
      if (savedLineups) setLineups(JSON.parse(savedLineups));

      const wSlots = localStorage.getItem('skroderup_weight_slots');
      if (wSlots) setWeightSlots(JSON.parse(wSlots));

      const lSlots = localStorage.getItem('skroderup_lineup_slots');
      if (lSlots) setLineupSlots(JSON.parse(lSlots));
    }
  }, []);

  // Save to LocalStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('skroderup_active_weights', JSON.stringify(weights));
      localStorage.setItem('skroderup_active_lineups', JSON.stringify(lineups));
      localStorage.setItem('skroderup_weight_slots', JSON.stringify(weightSlots));
      localStorage.setItem('skroderup_lineup_slots', JSON.stringify(lineupSlots));
    }
  }, [weights, lineups, weightSlots, lineupSlots]);

  useEffect(() => {
    fetch('/api/tournaments').then(res => res.json()).then(data => {
      if (data.success && data.schedule) {
        setTournaments(data.schedule);
        const upcoming = data.schedule.find((t: any) => t.event_completed === "0" || t.event_completed === 0 || t.event_completed === false);
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

  const handleWeightChange = (stat: keyof typeof weights, newValue: number) => {
    setActiveWeightSlot(-1); // Switch to custom if editing a slot
    const currentWeight = weights[stat];
    const weightDifference = newValue - currentWeight;
    
    // Clamp so total doesn't exceed 100
    if (totalWeight + weightDifference > 100) {
      newValue = currentWeight + (100 - totalWeight);
    }
    
    setWeights(prev => ({ ...prev, [stat]: newValue }));
    setLineups([]);
    setActiveLineupSlot(-1);
  };

  const saveWeightSlot = (index: number) => {
    const slotName = prompt('Enter a name for this model configuration:', weightSlots[index].name !== 'Empty Slot' ? weightSlots[index].name : `Model Slot ${index + 1}`);
    if (!slotName) return;
    const newSlots = [...weightSlots];
    newSlots[index] = { name: slotName, data: weights };
    setWeightSlots(newSlots);
    setActiveWeightSlot(index);
  };

  const loadWeightSlot = (index: number) => {
    if (!weightSlots[index].data) return;
    setWeights(weightSlots[index].data);
    setActiveWeightSlot(index);
    setLineups([]);
    setActiveLineupSlot(-1);
  };
  
  const saveLineupSlot = (index: number) => {
    if (lineups.length === 0) return alert('No active lineups to save!');
    const slotName = prompt('Enter a name for these lineups:', lineupSlots[index].name !== 'Empty Slot' ? lineupSlots[index].name : `Lineups Slot ${index + 1}`);
    if (!slotName) return;
    const newSlots = [...lineupSlots];
    newSlots[index] = { name: slotName, data: lineups };
    setLineupSlots(newSlots);
    setActiveLineupSlot(index);
  };

  const loadLineupSlot = (index: number) => {
    if (!lineupSlots[index].data) return;
    setLineups(lineupSlots[index].data);
    setActiveLineupSlot(index);
  };

  const estimateTokenCost = () => {
    const tokens = 350 + Math.ceil(gptNotes.length / 4);
    const cost = gptModel === 'gpt-4o' ? (tokens / 1000) * 0.005 : (tokens / 1000) * 0.00015;
    return cost < 0.001 ? '< $0.001' : `~$${cost.toFixed(3)}`;
  };

  const aiAutoWeight = async () => {
    setLineups([]); setActiveLineupSlot(-1); setActiveWeightSlot(-1);
    setIsAiLoading(true); setGptReasoning('');
    try {
      const res = await fetch('/api/ai/course-fit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament: selectedTournament, userNotes: gptNotes, gptModel })
      });
      const data = await res.json();
      if (data.success && data.weights) {
        setWeights(prev => ({ ...prev, ...data.weights }));
        setGptReasoning(data.reasoning || 'No reasoning provided by AI.');
      }
    } catch (err) {}
    setIsAiLoading(false);
  };

  const getActiveStats = (p: GolferStats): SGStats => p[`stats${roundsFilter}` as keyof GolferStats] as SGStats || p.stats32 || {};

  const getModelScore = (p: GolferStats) => {
    let score = 0; 
    const stats = getActiveStats(p);
    if (!stats || Object.keys(stats).length === 0) return score;
    
    score += (Number(stats.sgOTT||0) * (weights.sgOTT / 10));
    score += (Number(stats.sgAPP||0) * (weights.sgAPP / 10));
    score += (Number(stats.sgARG||0) * (weights.sgARG / 10));
    score += (Number(stats.sgPUTT||0) * (weights.sgPUTT / 10));
    score += (Number(stats.sgT2G||0) * (weights.sgT2G / 10));
    score += (Number(stats.sgTotal||0) * (weights.sgTotal / 10));
    score += (Number(stats.eagles_or_better||0) * (weights.eagles_or_better / 10));
    score += (Number(stats.birdies||0) * (weights.birdies / 10));
    score += (Number(stats.pars||0) * (weights.pars / 10));
    score += (Number(stats.bob||0) * (weights.bob / 10));
    score += (Number(stats.driving_dist||0) * (weights.driving_dist / 100)); 
    score += (Number(stats.driving_acc||0) * (weights.driving_acc / 10));
    score += (Number(stats.gir||0) * (weights.gir / 10));
    score += (Number(stats.scrambling||0) * (weights.scrambling / 10));
    score += (Number(stats.great_shots||0) * (weights.great_shots / 10));
    
    score += (p.putt_bermuda * (weights.putt_bermuda / 1000));
    score += (p.putt_bentgrass * (weights.putt_bentgrass / 1000));
    score += (p.putt_poa * (weights.putt_poa / 1000));
    score += (p.wind * (weights.wind / 1000));

    score -= (Number(stats.round_score||0) * (weights.round_score / 10));
    score -= (Number(stats.bogies||0) * (weights.bogies / 10));
    score -= (Number(stats.doubles_or_worse||0) * (weights.doubles_or_worse / 10));
    score -= (Number(stats.ba||0) * (weights.ba / 10));
    score -= (Number(stats.prox_fw||0) * (weights.prox_fw / 10));
    score -= (Number(stats.prox_rgh||0) * (weights.prox_rgh / 10));
    score -= (Number(stats.poor_shots||0) * (weights.poor_shots / 10));

    return score;
  };

  const getValueScore = (p: GolferStats) => {
    if (!p.salary) return 0;
    return getModelScore(p) / (p.salary / 1000);
  };
  
  const getDgValue = (p: GolferStats) => {
    if (!p.salary) return 0;
    return p.projection / (p.salary / 1000);
  };

  const getAvgScore = (p: GolferStats) => {
    return (getModelScore(p) + p.projection) / 2;
  };

  const getAvgValue = (p: GolferStats) => {
    return (getValueScore(p) + getDgValue(p)) / 2;
  };

  const generateLineups = () => {
    if (players.length === 0) return alert('No player data available.');
    
    const mappedPlayers = players.map(p => {
      let targetProj = 0;
      if (optTarget === 'custom') targetProj = getModelScore(p);
      else if (optTarget === 'dg') targetProj = p.projection;
      else if (optTarget === 'avg') targetProj = getAvgScore(p);
      
      return { ...p, projection: targetProj, customWeight: 0 };
    });
    
    const optimized = LineupOptimizer.generateTopLineups(mappedPlayers, {
      minSalary, maxSalary, numLineups, maxExposure, minUniques
    });
    setLineups(optimized);
    setActiveLineupSlot(-1);
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

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortedPlayers = [...players].sort((a, b) => {
    const aStats = getActiveStats(a);
    const bStats = getActiveStats(b);
    let aVal: any = 0; let bVal: any = 0;

    if (sortField === 'name') { aVal = a.name; bVal = b.name; }
    else if (sortField === 'salary') { aVal = a.salary; bVal = b.salary; }
    else if (sortField === 'modelScore') { aVal = getModelScore(a); bVal = getModelScore(b); }
    else if (sortField === 'valueScore') { aVal = getValueScore(a); bVal = getValueScore(b); }
    else if (sortField === 'dgBaseline') { aVal = a.projection; bVal = b.projection; }
    else if (sortField === 'dgValue') { aVal = getDgValue(a); bVal = getDgValue(b); }
    else if (sortField === 'avgScore') { aVal = getAvgScore(a); bVal = getAvgScore(b); }
    else if (sortField === 'avgValue') { aVal = getAvgValue(a); bVal = getAvgValue(b); }
    else if (sortField === 'delta') { aVal = getModelScore(a) - a.projection; bVal = getModelScore(b) - b.projection; }
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
    <th style={{ padding: '10px 8px', color: '#888', cursor: 'pointer', userSelect: 'none', borderRight: '1px solid #333' }} onClick={() => handleSort(field)}>
      {title} {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  const renderWeightInput = (stat: string, label: string) => (
    <div key={stat} style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '0.75rem' }}><span>{label}</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="number" min="0" max="100" value={(weights as any)[stat]} onChange={(e) => handleWeightChange(stat as any, Number(e.target.value))} style={{ flex: 1, background: '#222', color: '#22c55e', padding: '4px 6px', border: '1px solid #444', borderRadius: '4px', fontWeight: 'bold' }} />
        <span style={{ color: '#888', fontSize: '0.8rem' }}>%</span>
      </div>
    </div>
  );

  return (
    <main style={{ padding: '0', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
      
      <header style={{ padding: '16px 24px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>SKRODERUP <span style={{ color: '#22c55e' }}>Custom Model</span></h1>
          <select style={{ background: '#222', color: '#22c55e', padding: '6px 12px', border: '1px solid #444', borderRadius: '4px', fontWeight: 'bold' }} value={roundsFilter} onChange={e => { setRoundsFilter(e.target.value as any); setLineups([]); setActiveLineupSlot(-1); }}>
            <option value="16">L16 Rounds</option><option value="32">L32 Rounds</option><option value="64">L64 Rounds</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select style={{ background: '#222', color: '#fff', padding: '8px 16px', border: '1px solid #444', borderRadius: '4px', maxWidth: '300px' }} value={selectedTournament} onChange={e => { setSelectedTournament(e.target.value); setLineups([]); setActiveLineupSlot(-1); }}>
            {tournaments.length > 0 ? tournaments.map((t, idx) => <option key={idx} value={t.event_name}>{t.event_name}</option>) : <option>Loading schedule...</option>}
          </select>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: '380px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            {/* Model Save Slots UI */}
            <div style={{ marginBottom: '24px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333', overflow: 'hidden' }}>
              <div style={{ background: '#222', padding: '10px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#fff', fontSize: '0.9rem' }}>Model Weights</strong>
              </div>
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {weightSlots.map((slot, i) => (
                    <button key={i} onClick={() => loadWeightSlot(i)} disabled={!slot.data}
                      style={{ flex: '1 1 18%', padding: '4px', fontSize: '0.7rem', background: activeWeightSlot === i ? '#22c55e' : (slot.data ? '#333' : '#111'), color: activeWeightSlot === i ? '#000' : (slot.data ? '#fff' : '#444'), border: '1px solid #444', borderRadius: '4px', cursor: slot.data ? 'pointer' : 'default', fontWeight: activeWeightSlot === i ? 'bold' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={slot.name}>
                      {slot.data ? (i+1) : '-'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => saveWeightSlot(activeWeightSlot >= 0 ? activeWeightSlot : weightSlots.findIndex(s => !s.data) >= 0 ? weightSlots.findIndex(s => !s.data) : 0)} 
                    style={{ flex: 1, background: '#3b82f6', color: '#fff', padding: '6px', border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>
                    Save to Slot {activeWeightSlot >= 0 ? activeWeightSlot + 1 : ''}
                  </button>
                  {activeWeightSlot >= 0 && (
                    <button onClick={() => setActiveWeightSlot(-1)} style={{ padding: '6px 12px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>New</button>
                  )}
                </div>
                {activeWeightSlot >= 0 && (
                   <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#888', marginTop: '8px' }}>Active: <span style={{ color: '#22c55e' }}>{weightSlots[activeWeightSlot]?.name}</span></div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#3b82f6', margin: 0 }}>AI Course Adjust</h3>
                <select value={gptModel} onChange={(e) => setGptModel(e.target.value)} style={{ background: '#000', color: '#3b82f6', border: '1px solid #333', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem' }}>
                  <option value="gpt-4o-mini">GPT-4o Mini</option><option value="gpt-4o">GPT-4o</option>
                </select>
              </div>
              <textarea placeholder="Custom notes (e.g. 'Weight accuracy heavily')" value={gptNotes} onChange={e => setGptNotes(e.target.value)} style={{ width: '100%', height: '60px', background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '8px' }} />
              <button onClick={aiAutoWeight} disabled={isAiLoading || isDataLoading} style={{ width: '100%', background: '#3b82f6', color: '#fff', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                {isAiLoading ? 'Analyzing...' : `Ask AI to Weight Course (${estimateTokenCost()})`}
              </button>
              {gptReasoning && <div style={{ marginTop: '12px', padding: '8px', background: '#0a0a0a', borderLeft: '3px solid #3b82f6', fontSize: '0.8rem', color: '#aaa', fontStyle: 'italic' }}>{gptReasoning}</div>}
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
            
            <details open style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>Strokes Gained</summary>
              <div style={{ marginTop: '12px' }}>
                {renderWeightInput('sgOTT', 'SG: Off The Tee')}
                {renderWeightInput('sgAPP', 'SG: Approach')}
                {renderWeightInput('sgARG', 'SG: Around Green')}
                {renderWeightInput('sgPUTT', 'SG: Putting')}
                {renderWeightInput('sgT2G', 'SG: Tee to Green')}
                {renderWeightInput('sgTotal', 'SG: Total')}
              </div>
            </details>

            <details style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>Scoring</summary>
              <div style={{ marginTop: '12px' }}>
                {renderWeightInput('round_score', 'Round Score (Lower Better)')}
                {renderWeightInput('eagles_or_better', 'Eagles or Better')}
                {renderWeightInput('birdies', 'Birdies')}
                {renderWeightInput('pars', 'Pars')}
                {renderWeightInput('bogies', 'Bogies (Lower Better)')}
                {renderWeightInput('doubles_or_worse', 'Doubles+ (Lower Better)')}
                {renderWeightInput('bob', 'BOB (Birdies or Better)')}
                {renderWeightInput('ba', 'BA (Bogey Avoidance)')}
              </div>
            </details>

            <details style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>Ball Striking</summary>
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

            <details style={{ marginBottom: '12px', background: '#1a1a1a', padding: '8px', borderRadius: '4px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>Course & Conditions (GPT)</summary>
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
              <select value={optTarget} onChange={e => { setOptTarget(e.target.value as any); setLineups([]); setActiveLineupSlot(-1); }} style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px' }}>
                <option value="custom">Custom Model Score</option>
                <option value="avg">Blended Average Score</option>
                <option value="dg">DataGolf Baseline Score</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.8rem', color: '#aaa' }}>Lineups to Build</label>
              <select value={numLineups} onChange={e => { setNumLineups(Number(e.target.value)); setLineups([]); setActiveLineupSlot(-1); }} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '2px 6px' }}>
                <option value="1">1 (Single Entry)</option>
                <option value="3">3 Max</option>
                <option value="20">20 Max</option>
                <option value="50">50 Max (MME)</option>
                <option value="150">150 Max</option>
              </select>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Max Exposure %</label><input type="number" min="5" max="100" value={maxExposure} onChange={e => { setMaxExposure(Number(e.target.value)); setLineups([]); setActiveLineupSlot(-1); }} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Min Uniques</label><input type="number" min="1" max="5" value={minUniques} onChange={e => { setMinUniques(Number(e.target.value)); setLineups([]); setActiveLineupSlot(-1); }} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Min Salary</label><input type="number" value={minSalary} onChange={e => { setMinSalary(Number(e.target.value)); setLineups([]); setActiveLineupSlot(-1); }} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Max Salary</label><input type="number" value={maxSalary} onChange={e => { setMaxSalary(Number(e.target.value)); setLineups([]); setActiveLineupSlot(-1); }} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
            </div>
            
            <button onClick={generateLineups} disabled={isDataLoading} style={{ width: '100%', background: '#22c55e', color: '#000', padding: '16px', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold', cursor: isDataLoading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
              {isDataLoading ? 'LOADING DATA...' : `BUILD ${numLineups} LINEUPS`}
            </button>
          </div>
        </aside>

        <section style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          
          {isDataLoading ? (
             <div style={{ color: '#22c55e', fontSize: '1.2rem', padding: '40px', textAlign: 'center' }}>Loading live player data...</div>
          ) : dataError ? (
             <div style={{ color: '#ef4444', fontSize: '1.2rem', padding: '40px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid #ef4444' }}>{dataError}</div>
          ) : (
            <>
              {/* Lineup Save Slots UI */}
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                <span style={{ color: '#888', fontSize: '0.8rem', padding: '6px 8px 0 0' }}>Saved Sets:</span>
                {lineupSlots.map((slot, i) => (
                  <button key={i} onClick={() => loadLineupSlot(i)} disabled={!slot.data}
                    style={{ flex: '0 0 auto', padding: '6px 12px', fontSize: '0.8rem', background: activeLineupSlot === i ? '#a855f7' : (slot.data ? '#333' : '#111'), color: activeLineupSlot === i ? '#fff' : (slot.data ? '#fff' : '#444'), border: '1px solid #444', borderRadius: '20px', cursor: slot.data ? 'pointer' : 'default', fontWeight: activeLineupSlot === i ? 'bold' : 'normal', minWidth: '40px' }}
                    title={slot.name}>
                    {slot.data ? slot.name : '-'}
                  </button>
                ))}
              </div>

              {lineups.length > 0 && (
                <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h3 style={{ color: '#22c55e', margin: 0 }}>
                        {activeLineupSlot >= 0 ? `[${lineupSlots[activeLineupSlot]?.name}] ` : ''}
                        {lineups.length} Lineups
                      </h3>
                      <button onClick={() => { setLineups([]); setActiveLineupSlot(-1); }} style={{ background: '#ef4444', color: '#fff', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>✕ Close</button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => saveLineupSlot(activeLineupSlot >= 0 ? activeLineupSlot : lineupSlots.findIndex(s => !s.data) >= 0 ? lineupSlots.findIndex(s => !s.data) : 0)} 
                        style={{ background: '#a855f7', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Save Set
                      </button>
                      <button onClick={exportDraftKingsCSV} style={{ background: '#3b82f6', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Export CSV
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                    {lineups.map((l, i) => (
                      <div key={i} style={{ background: '#222', padding: '12px', borderRadius: '8px', border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                          <strong style={{ color: '#fff' }}>Lineup #{i+1}</strong><span style={{ color: '#22c55e' }}>{l.totalProjection.toFixed(1)} pts</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', lineHeight: '1.4' }}>{l.players.map(p => <div key={p.id}>{p.name} (${p.salary})</div>)}</div>
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', textAlign: 'right', color: '#888' }}>Rem: ${(50000 - l.totalSalary)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ overflowX: 'auto', background: '#111', border: '1px solid #333', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: '#0a0a0a' }}>
                      <th colSpan={2} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#888' }}>INFO</th>
                      <th colSpan={3} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#22c55e' }}>CUSTOM MODEL</th>
                      <th colSpan={2} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#3b82f6' }}>DATAGOLF</th>
                      <th colSpan={2} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#eab308' }}>BLENDED (AVG)</th>
                      
                      <th colSpan={5} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#3b82f6' }}>STROKES GAINED</th>
                      <th colSpan={4} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#eab308' }}>SCORING</th>
                      <th colSpan={5} style={{ borderRight: '2px solid #333', padding: '8px', textAlign: 'center', color: '#f97316' }}>BALL STRIKING</th>
                      <th colSpan={3} style={{ padding: '8px', textAlign: 'center', color: '#a855f7' }}>PUTTING SPLITS</th>
                    </tr>
                    <tr style={{ background: '#1a1a1a', borderBottom: '2px solid #333' }}>
                      {renderSortHeader('Golfer', 'name')}
                      <th style={{ borderRight: '2px solid #333', padding: '10px 8px', color: '#888', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('salary')}>Salary {sortField === 'salary' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                      
                      {renderSortHeader('Score', 'modelScore')}
                      {renderSortHeader('Value', 'valueScore')}
                      <th style={{ borderRight: '2px solid #333', padding: '10px 8px', color: '#888', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('delta')}>Δ {sortField === 'delta' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>

                      {renderSortHeader('DG Score', 'dgBaseline')}
                      <th style={{ borderRight: '2px solid #333', padding: '10px 8px', color: '#888', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('dgValue')}>DG Value {sortField === 'dgValue' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>

                      {renderSortHeader('Avg Score', 'avgScore')}
                      <th style={{ borderRight: '2px solid #333', padding: '10px 8px', color: '#888', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('avgValue')}>Avg Value {sortField === 'avgValue' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>

                      {renderSortHeader('OTT', 'sgOTT')}
                      {renderSortHeader('APP', 'sgAPP')}
                      {renderSortHeader('ARG', 'sgARG')}
                      {renderSortHeader('PUTT', 'sgPUTT')}
                      <th style={{ borderRight: '2px solid #333', padding: '10px 8px', color: '#888', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('sgTotal')}>Total {sortField === 'sgTotal' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>

                      {renderSortHeader('RoundScore', 'round_score')}
                      {renderSortHeader('BOB', 'bob')}
                      {renderSortHeader('BA', 'ba')}
                      <th style={{ borderRight: '2px solid #333', padding: '10px 8px', color: '#888', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('bogies')}>Bogies {sortField === 'bogies' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>

                      {renderSortHeader('Dist', 'driving_dist')}
                      {renderSortHeader('Acc', 'driving_acc')}
                      {renderSortHeader('GIR', 'gir')}
                      {renderSortHeader('Prox FW', 'prox_fw')}
                      <th style={{ borderRight: '2px solid #333', padding: '10px 8px', color: '#888', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('prox_rgh')}>Prox RGH {sortField === 'prox_rgh' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>

                      {renderSortHeader('Bermuda', 'putt_bermuda')}
                      {renderSortHeader('Bent', 'putt_bentgrass')}
                      {renderSortHeader('Poa', 'putt_poa')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((p, idx) => {
                      const modelScore = getModelScore(p);
                      const valueScore = getValueScore(p);
                      const dgScore = p.projection;
                      const dgValue = getDgValue(p);
                      const avgScore = getAvgScore(p);
                      const avgValue = getAvgValue(p);
                      const delta = modelScore - dgScore;
                      const stats = getActiveStats(p);
                      
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #222', background: idx % 2 === 0 ? '#111' : '#151515' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 'bold', borderRight: '1px solid #333' }}>{p.name}</td>
                          <td style={{ padding: '10px 8px', borderRight: '2px solid #333' }}>${p.salary}</td>
                          
                          <td style={{ padding: '10px 8px', color: '#22c55e', fontWeight: 'bold', fontSize: '0.9rem', borderRight: '1px solid #333' }}>{modelScore.toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', color: '#22c55e', borderRight: '1px solid #333' }}>{valueScore.toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '2px solid #333', fontWeight: 'bold', color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#aaa' }}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                          </td>
                          
                          <td style={{ padding: '10px 8px', color: '#3b82f6', fontWeight: 'bold', borderRight: '1px solid #333' }}>{dgScore.toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', color: '#3b82f6', borderRight: '2px solid #333' }}>{dgValue.toFixed(2)}</td>
                          
                          <td style={{ padding: '10px 8px', color: '#eab308', fontWeight: 'bold', borderRight: '1px solid #333' }}>{avgScore.toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', color: '#eab308', borderRight: '2px solid #333' }}>{avgValue.toFixed(2)}</td>
                          
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{Number(stats.sgOTT||0).toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{Number(stats.sgAPP||0).toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{Number(stats.sgARG||0).toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{Number(stats.sgPUTT||0).toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '2px solid #333', fontWeight: 'bold' }}>{Number(stats.sgTotal||0).toFixed(2)}</td>
                          
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{Number(stats.round_score||0).toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333', color: '#22c55e' }}>{Number(stats.bob||0).toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333', color: '#ef4444' }}>{Number(stats.ba||0).toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '2px solid #333' }}>{Number(stats.bogies||0).toFixed(2)}</td>
                          
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{Number(stats.driving_dist||0).toFixed(1)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{Number(stats.driving_acc||0).toFixed(3)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{Number(stats.gir||0).toFixed(3)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{Number(stats.prox_fw||0).toFixed(1)}</td>
                          <td style={{ padding: '10px 8px', borderRight: '2px solid #333' }}>{Number(stats.prox_rgh||0).toFixed(1)}</td>
                          
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{p.putt_bermuda}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{p.putt_bentgrass}</td>
                          <td style={{ padding: '10px 8px', borderRight: '1px solid #333' }}>{p.putt_poa}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
