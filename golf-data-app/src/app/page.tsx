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

export default function Home() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState('Masters Tournament');
  const [players, setPlayers] = useState<GolferStats[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  
  // Settings
  const [contestType, setContestType] = useState('MME');
  const [betEntry, setBetEntry] = useState(20);
  const [prizePool, setPrizePool] = useState(100000);
  const [roundsFilter, setRoundsFilter] = useState<'16'|'32'|'64'>('32');
  const [minSalary, setMinSalary] = useState(49000);
  const [maxSalary, setMaxSalary] = useState(50000);
  
  // Toggles
  const [showDgBaseline, setShowDgBaseline] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState('modelScore');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  // GPT Chat Notes
  const [gptNotes, setGptNotes] = useState('');
  const [gptReasoning, setGptReasoning] = useState('');
  const [gptModel, setGptModel] = useState('gpt-4o-mini');

  const [weights, setWeights] = useState({
    sgOTT: 10, sgAPP: 10, sgARG: 5, sgPUTT: 5, sgT2G: 10, sgTotal: 5,
    round_score: 5, eagles_or_better: 0, birdies: 5, pars: 0, bogies: 0, doubles_or_worse: 0, bob: 5, ba: 5,
    driving_dist: 0, driving_acc: 0, gir: 5, scrambling: 5, prox_fw: 0, prox_rgh: 0, great_shots: 0, poor_shots: 0,
    putt_bermuda: 5, putt_bentgrass: 5, putt_poa: 0, wind: 5
  });

  useEffect(() => {
    fetch('/api/tournaments').then(res => res.json()).then(data => {
      if (data.success && data.schedule) {
        setTournaments(data.schedule);
        if (data.schedule.length > 0) setSelectedTournament(data.schedule[0].event_name);
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

  const handleWeightChange = (stat: keyof typeof weights, value: number) => {
    setWeights(prev => ({ ...prev, [stat]: value }));
  };

  const estimateTokenCost = () => {
    const tokens = 350 + Math.ceil(gptNotes.length / 4);
    const cost = gptModel === 'gpt-4o' ? (tokens / 1000) * 0.005 : (tokens / 1000) * 0.00015;
    return cost < 0.001 ? '< $0.001' : `~$${cost.toFixed(3)}`;
  };

  const aiAutoWeight = async () => {
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
    let score = p.projection; 
    const stats = getActiveStats(p);
    if (!stats || Object.keys(stats).length === 0) return score; // Fallback if no history
    
    // Positive factors (higher is better)
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
    score += (Number(stats.driving_dist||0) * (weights.driving_dist / 100)); // normalized divisor
    score += (Number(stats.driving_acc||0) * (weights.driving_acc / 10));
    score += (Number(stats.gir||0) * (weights.gir / 10));
    score += (Number(stats.scrambling||0) * (weights.scrambling / 10));
    score += (Number(stats.great_shots||0) * (weights.great_shots / 10));
    
    score += (p.putt_bermuda * (weights.putt_bermuda / 1000));
    score += (p.putt_bentgrass * (weights.putt_bentgrass / 1000));
    score += (p.putt_poa * (weights.putt_poa / 1000));
    score += (p.wind * (weights.wind / 1000));

    // Negative factors (lower is better, so weight penalizes the score)
    score -= (Number(stats.round_score||0) * (weights.round_score / 10));
    score -= (Number(stats.bogies||0) * (weights.bogies / 10));
    score -= (Number(stats.doubles_or_worse||0) * (weights.doubles_or_worse / 10));
    score -= (Number(stats.ba||0) * (weights.ba / 10));
    score -= (Number(stats.prox_fw||0) * (weights.prox_fw / 10));
    score -= (Number(stats.prox_rgh||0) * (weights.prox_rgh / 10));
    score -= (Number(stats.poor_shots||0) * (weights.poor_shots / 10));

    return score;
  };

  const getRawValue = (p: GolferStats) => {
    const score = getModelScore(p);
    if (!p.salary) return 0;
    return score / p.salary;
  };

  const maxRawValue = players.length > 0 ? Math.max(...players.map(p => getRawValue(p))) : 1;

  const getValueScore = (p: GolferStats) => {
    const raw = getRawValue(p);
    if (maxRawValue === 0) return 0;
    return (raw / maxRawValue) * 100;
  };

  const generateLineups = () => {
    if (players.length === 0) return alert('No player data available.');
    const mappedPlayers = players.map(p => ({ ...p, projection: getModelScore(p), customWeight: 0 }));
    const optimized = LineupOptimizer.generateTopLineups(mappedPlayers, contestType === 'Single Entry' ? 1 : 50, { minSalary, maxSalary });
    setLineups(optimized);
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
    <th style={{ padding: '8px', color: '#888', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(field)}>
      {title} {sortField === field ? (sortDir === 'asc' ? '^' : 'v') : ''}
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
          <select style={{ background: '#222', color: '#22c55e', padding: '6px 12px', border: '1px solid #444', borderRadius: '4px', fontWeight: 'bold' }} value={roundsFilter} onChange={e => setRoundsFilter(e.target.value as any)}>
            <option value="16">L16 Rounds</option><option value="32">L32 Rounds</option><option value="64">L64 Rounds</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: '#aaa' }}>
            <input type="checkbox" checked={showDgBaseline} onChange={e => setShowDgBaseline(e.target.checked)} /> Show DG Baseline
          </label>
          <select style={{ background: '#222', color: '#fff', padding: '8px 16px', border: '1px solid #444', borderRadius: '4px', maxWidth: '300px' }} value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)}>
            {tournaments.length > 0 ? tournaments.map((t, idx) => <option key={idx} value={t.event_name}>{t.event_name}</option>) : <option>Loading schedule...</option>}
          </select>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: '360px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            
            <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#3b82f6', margin: 0 }}>AI Course Adjust</h3>
                <select value={gptModel} onChange={(e) => setGptModel(e.target.value)} style={{ background: '#000', color: '#3b82f6', border: '1px solid #333', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem' }}>
                  <option value="gpt-4o-mini">GPT-4o Mini</option><option value="gpt-4o">GPT-4o</option>
                </select>
              </div>
              <textarea placeholder="Add custom notes for GPT (e.g., 'Weight accuracy heavily...')" value={gptNotes} onChange={e => setGptNotes(e.target.value)} style={{ width: '100%', height: '60px', background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '8px' }} />
              <button onClick={aiAutoWeight} disabled={isAiLoading || isDataLoading} style={{ width: '100%', background: '#3b82f6', color: '#fff', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                {isAiLoading ? 'Analyzing...' : `Ask AI to Weight Course (${estimateTokenCost()})`}
              </button>
              {gptReasoning && <div style={{ marginTop: '12px', padding: '8px', background: '#0a0a0a', borderLeft: '3px solid #3b82f6', fontSize: '0.8rem', color: '#aaa', fontStyle: 'italic' }}>{gptReasoning}</div>}
            </div>

            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', color: '#888' }}>Model Weights (%)</h3>
            
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
            <details style={{ marginBottom: '16px' }}>
              <summary style={{ fontSize: '0.8rem', color: '#888', cursor: 'pointer', marginBottom: '8px' }}>Advanced Settings</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Min Salary</label><input type="number" value={minSalary} onChange={e => setMinSalary(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
                <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Max Salary</label><input type="number" value={maxSalary} onChange={e => setMaxSalary(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} /></div>
              </div>
            </details>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Contest Type</label>
              <select style={{ width: '100%', background: '#222', color: '#fff', padding: '8px', border: '1px solid #444', borderRadius: '4px' }} value={contestType} onChange={e => setContestType(e.target.value)}>
                <option value="MME">MME (50 Max)</option><option value="Single Entry">Single Entry</option>
              </select>
            </div>
            
            <button onClick={generateLineups} disabled={isDataLoading} style={{ width: '100%', background: '#22c55e', color: '#000', padding: '16px', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold', cursor: isDataLoading ? 'not-allowed' : 'pointer' }}>
              {isDataLoading ? 'LOADING DATA...' : (contestType === 'Single Entry' ? 'BUILD OPTIMAL LINEUP' : 'BUILD 50 LINEUPS')}
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
              {lineups.length > 0 && (
                <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ color: '#22c55e', margin: 0 }}>{lineups.length} Lineups Generated</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {lineups.slice(0, 5).map((l, i) => (
                      <div key={i} style={{ minWidth: '300px', background: '#222', padding: '12px', borderRadius: '8px', border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                          <strong style={{ color: '#fff' }}>Lineup #{i+1}</strong><span style={{ color: '#22c55e' }}>{l.totalProjection.toFixed(1)} pts</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{l.players.map(p => <div key={p.id}>{p.name} (${p.salary})</div>)}</div>
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', textAlign: 'right' }}>Sal: ${l.totalSalary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: '#1a1a1a', borderBottom: '2px solid #333' }}>
                      {renderSortHeader('Golfer', 'name')}
                      {renderSortHeader('Salary', 'salary')}
                      {renderSortHeader('Model Score', 'modelScore')}
                      
                      {showDgBaseline && renderSortHeader('DG Baseline', 'dgBaseline')}
                      {showDgBaseline && renderSortHeader('?', 'delta')}
                      
                      {renderSortHeader('Value', 'valueScore')}
                      {renderSortHeader('SG:OTT', 'sgOTT')}
                      {renderSortHeader('SG:APP', 'sgAPP')}
                      {renderSortHeader('SG:ARG', 'sgARG')}
                      {renderSortHeader('SG:PUTT', 'sgPUTT')}
                      {renderSortHeader('SG:Tot', 'sgTotal')}
                      {renderSortHeader('Score', 'round_score')}
                      {renderSortHeader('Dist', 'driving_dist')}
                      {renderSortHeader('Acc', 'driving_acc')}
                      {renderSortHeader('GIR', 'gir')}
                      {renderSortHeader('Prox FW', 'prox_fw')}
                      {renderSortHeader('Prox RGH', 'prox_rgh')}
                      {renderSortHeader('BOB', 'bob')}
                      {renderSortHeader('BA', 'ba')}
                      {renderSortHeader('Putt Berm', 'putt_bermuda')}
                      {renderSortHeader('Putt Bent', 'putt_bentgrass')}
                      {renderSortHeader('Putt Poa', 'putt_poa')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map(p => {
                      const modelScore = getModelScore(p);
                      const valueScore = getValueScore(p);
                      const stats = getActiveStats(p);
                      const delta = modelScore - p.projection;
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.name}</td>
                          <td style={{ padding: '8px' }}>${p.salary}</td>
                          <td style={{ padding: '8px', color: '#22c55e', fontWeight: 'bold', fontSize: '0.9rem' }}>{modelScore.toFixed(2)}</td>
                          
                          {showDgBaseline && <td style={{ padding: '8px', color: '#aaa' }}>{p.projection.toFixed(2)}</td>}
                          {showDgBaseline && (
                            <td style={{ padding: '8px', color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#aaa' }}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                            </td>
                          )}

                          <td style={{ padding: '8px', color: '#3b82f6', fontWeight: 'bold', fontSize: '0.9rem' }}>{valueScore === 0 ? '-' : valueScore.toFixed(1)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.sgOTT||0).toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.sgAPP||0).toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.sgARG||0).toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.sgPUTT||0).toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.sgTotal||0).toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.round_score||0).toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.driving_dist||0).toFixed(1)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.driving_acc||0).toFixed(3)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.gir||0).toFixed(3)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.prox_fw||0).toFixed(1)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.prox_rgh||0).toFixed(1)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.bob||0).toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{Number(stats.ba||0).toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{p.putt_bermuda}</td>
                          <td style={{ padding: '8px' }}>{p.putt_bentgrass}</td>
                          <td style={{ padding: '8px' }}>{p.putt_poa}</td>
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
