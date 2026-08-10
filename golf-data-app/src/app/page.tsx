'use client';
import { useState, useEffect } from 'react';
import { LineupOptimizer, PlayerData, Lineup } from '@/lib/optimizer';

interface SGStats {
  sgOTT: number;
  sgAPP: number;
  sgARG: number;
  sgPUTT: number;
  sgT2G: number;
  sgTotal: number;
  bob: number;
  ba: number;
}

interface GolferStats extends PlayerData {
  stats16: SGStats;
  stats32: SGStats;
  stats64: SGStats;
  distance: number;
  accuracy: number;
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
  
  // Contest Type & Betting Details
  const [contestType, setContestType] = useState('MME');
  const [betEntry, setBetEntry] = useState(20);
  const [prizePool, setPrizePool] = useState(100000);
  
  // Advanced Settings
  const [roundsFilter, setRoundsFilter] = useState<'16'|'32'|'64'>('32');
  const [minSalary, setMinSalary] = useState(49000);
  const [maxSalary, setMaxSalary] = useState(50000);
  
  // Sorting
  const [sortField, setSortField] = useState('modelScore');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  // GPT Chat Notes
  const [gptNotes, setGptNotes] = useState('');
  const [gptReasoning, setGptReasoning] = useState('');
  const [gptModel, setGptModel] = useState('gpt-4o-mini');

  const [weights, setWeights] = useState({
    sgOTT: 10,
    sgAPP: 20,
    sgARG: 5,
    sgPUTT: 10,
    sgT2G: 10,
    sgTotal: 10,
    bob: 10,
    ba: 5,
    distance: 2,
    accuracy: 3,
    putt_bermuda: 5,
    putt_bentgrass: 5,
    putt_poa: 0,
    wind: 5
  });

  useEffect(() => {
    fetch('/api/tournaments')
      .then(res => res.json())
      .then(data => {
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
    // Very rough estimate of cost
    const systemPromptTokens = 250; 
    const customPromptTokens = Math.ceil(gptNotes.length / 4);
    const totalTokens = systemPromptTokens + customPromptTokens;
    
    // gpt-4o: $5.00 / 1M input tokens => $0.005 / 1k
    // gpt-4o-mini: $0.150 / 1M input tokens => $0.00015 / 1k
    let cost = 0;
    if (gptModel === 'gpt-4o') {
      cost = (totalTokens / 1000) * 0.005;
    } else {
      cost = (totalTokens / 1000) * 0.00015;
    }
    
    if (cost < 0.001) return '< $0.001';
    return `~$${cost.toFixed(3)}`;
  };

  const aiAutoWeight = async () => {
    setIsAiLoading(true);
    setGptReasoning('');
    try {
      const res = await fetch('/api/ai/course-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament: selectedTournament, userNotes: gptNotes, gptModel })
      });
      const data = await res.json();
      if (data.success && data.weights) {
        setWeights(prev => ({ ...prev, ...data.weights }));
        setGptReasoning(data.reasoning || 'No reasoning provided by AI.');
      } else {
        alert('GPT Analysis failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Network error connecting to OpenAI route.');
    }
    setIsAiLoading(false);
  };

  const getActiveStats = (p: GolferStats): SGStats => {
    if (roundsFilter === '16') return p.stats16;
    if (roundsFilter === '64') return p.stats64;
    return p.stats32;
  };

  const getModelScore = (p: GolferStats) => {
    let score = p.projection; 
    const stats = getActiveStats(p);
    
    score += (stats.sgOTT * (weights.sgOTT / 10));
    score += (stats.sgAPP * (weights.sgAPP / 10));
    score += (stats.sgARG * (weights.sgARG / 10));
    score += (stats.sgPUTT * (weights.sgPUTT / 10));
    score += (stats.sgT2G * (weights.sgT2G / 10));
    score += (stats.sgTotal * (weights.sgTotal / 10));
    score += (stats.bob * (weights.bob / 10));
    score -= (stats.ba * (weights.ba / 10)); 
    score += ((p.distance || 0) * (weights.distance / 100));
    score += ((p.accuracy || 0) * (weights.accuracy / 100));
    score += (p.putt_bermuda * (weights.putt_bermuda / 1000));
    score += (p.putt_bentgrass * (weights.putt_bentgrass / 1000));
    score += (p.putt_poa * (weights.putt_poa / 1000));
    score += (p.wind * (weights.wind / 1000));
    return score;
  };

  const getValueScore = (p: GolferStats) => {
    const score = getModelScore(p);
    if (score === 0) return 0;
    return p.salary / score;
  };

  const generateLineups = () => {
    if (players.length === 0) return alert('No player data available.');
    const mappedPlayers = players.map(p => ({
      ...p,
      projection: getModelScore(p), 
      customWeight: 0
    }));
    
    const lineupCount = contestType === 'Single Entry' ? 1 : 50;
    const optimized = LineupOptimizer.generateTopLineups(mappedPlayers, lineupCount, { minSalary, maxSalary });
    setLineups(optimized);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedPlayers = [...players].sort((a, b) => {
    const aStats = getActiveStats(a);
    const bStats = getActiveStats(b);
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortField) {
      case 'name': aVal = a.name; bVal = b.name; break;
      case 'salary': aVal = a.salary; bVal = b.salary; break;
      case 'modelScore': aVal = getModelScore(a); bVal = getModelScore(b); break;
      case 'valueScore': aVal = getValueScore(a); bVal = getValueScore(b); break;
      case 'sgOTT': aVal = aStats.sgOTT; bVal = bStats.sgOTT; break;
      case 'sgAPP': aVal = aStats.sgAPP; bVal = bStats.sgAPP; break;
      case 'sgARG': aVal = aStats.sgARG; bVal = bStats.sgARG; break;
      case 'sgPUTT': aVal = aStats.sgPUTT; bVal = bStats.sgPUTT; break;
      case 'sgT2G': aVal = aStats.sgT2G; bVal = bStats.sgT2G; break;
      case 'sgTotal': aVal = aStats.sgTotal; bVal = bStats.sgTotal; break;
      case 'bob': aVal = aStats.bob; bVal = bStats.bob; break;
      case 'ba': aVal = aStats.ba; bVal = bStats.ba; break;
      case 'putt_bermuda': aVal = a.putt_bermuda; bVal = b.putt_bermuda; break;
      case 'putt_bentgrass': aVal = a.putt_bentgrass; bVal = b.putt_bentgrass; break;
      case 'putt_poa': aVal = a.putt_poa; bVal = b.putt_poa; break;
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

  return (
    <main style={{ padding: '0', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
      
      <header style={{ padding: '16px 24px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>SKRODERUP <span style={{ color: '#22c55e' }}>Custom Model</span></h1>
          <select 
            style={{ background: '#222', color: '#22c55e', padding: '6px 12px', border: '1px solid #444', borderRadius: '4px', fontWeight: 'bold' }} 
            value={roundsFilter} 
            onChange={e => setRoundsFilter(e.target.value as any)}
          >
            <option value="16">L16 Rounds</option>
            <option value="32">L32 Rounds</option>
            <option value="64">L64 Rounds</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select 
            style={{ background: '#222', color: '#fff', padding: '8px 16px', border: '1px solid #444', borderRadius: '4px', maxWidth: '300px' }} 
            value={selectedTournament} 
            onChange={e => setSelectedTournament(e.target.value)}
          >
            {tournaments.length > 0 ? (
              tournaments.map((t, idx) => (
                <option key={idx} value={t.event_name}>{t.event_name} ({t.status})</option>
              ))
            ) : (
              <option>Loading schedule...</option>
            )}
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
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                </select>
              </div>
              <textarea 
                placeholder="Add custom notes for GPT (e.g., 'Weight accuracy heavily, rough is thick...')"
                value={gptNotes}
                onChange={e => setGptNotes(e.target.value)}
                style={{ width: '100%', height: '60px', background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '8px' }}
              />
              <button onClick={aiAutoWeight} disabled={isAiLoading || isDataLoading} style={{ width: '100%', background: '#3b82f6', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: isAiLoading ? 'wait' : 'pointer', fontWeight: 'bold' }}>
                {isAiLoading ? 'Analyzing...' : `Ask AI to Weight Course (Est. ${estimateTokenCost()})`}
              </button>
              
              {gptReasoning && (
                <div style={{ marginTop: '12px', padding: '8px', background: '#0a0a0a', borderLeft: '3px solid #3b82f6', fontSize: '0.8rem', color: '#aaa', fontStyle: 'italic' }}>
                  {gptReasoning}
                </div>
              )}
            </div>

            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', color: '#888' }}>Model Weights (%)</h3>
            
            {Object.entries(weights).map(([stat, weight]) => (
              <div key={stat} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '0.75rem' }}>
                  <span>{stat.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="number" 
                    min="0" max="100" 
                    value={weight} 
                    onChange={(e) => handleWeightChange(stat as keyof typeof weights, Number(e.target.value))}
                    style={{ flex: 1, background: '#222', color: '#22c55e', padding: '4px 6px', border: '1px solid #444', borderRadius: '4px', fontWeight: 'bold' }}
                  />
                  <span style={{ color: '#888', fontSize: '0.8rem' }}>%</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '20px', background: '#000', borderTop: '1px solid #333' }}>
            <details style={{ marginBottom: '16px' }}>
              <summary style={{ fontSize: '0.8rem', color: '#888', cursor: 'pointer', marginBottom: '8px' }}>Advanced Settings</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Min Salary</label>
                  <input type="number" value={minSalary} onChange={e => setMinSalary(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Max Salary</label>
                  <input type="number" value={maxSalary} onChange={e => setMaxSalary(Number(e.target.value))} style={{ width: '100%', padding: '6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
                </div>
              </div>
            </details>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Contest Type</label>
              <select style={{ width: '100%', background: '#222', color: '#fff', padding: '8px', border: '1px solid #444', borderRadius: '4px' }} value={contestType} onChange={e => setContestType(e.target.value)}>
                <option value="MME">MME (50 Max)</option>
                <option value="Single Entry">Single Entry</option>
              </select>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Entry Fee ($)</label>
                <input type="number" value={betEntry} onChange={e => setBetEntry(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Prize Pool ($)</label>
                <input type="number" value={prizePool} onChange={e => setPrizePool(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }} />
              </div>
            </div>

            <button onClick={generateLineups} disabled={isDataLoading} style={{ width: '100%', background: '#22c55e', color: '#000', padding: '16px', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold', cursor: isDataLoading ? 'not-allowed' : 'pointer' }}>
              {isDataLoading ? 'LOADING DATA...' : (contestType === 'Single Entry' ? 'BUILD OPTIMAL LINEUP' : 'BUILD 50 LINEUPS')}
            </button>
          </div>
        </aside>

        <section style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          
          {isDataLoading ? (
             <div style={{ color: '#22c55e', fontSize: '1.2rem', padding: '40px', textAlign: 'center' }}>
               Loading live player data from DataGolf / Backblaze...
             </div>
          ) : dataError ? (
             <div style={{ color: '#ef4444', fontSize: '1.2rem', padding: '40px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid #ef4444' }}>
               {dataError}
             </div>
          ) : (
            <>
              {lineups.length > 0 && (
                <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ color: '#22c55e', margin: 0 }}>{lineups.length} Lineups Generated</h3>
                    <div style={{ display: 'flex', gap: '24px', background: '#000', padding: '8px 16px', borderRadius: '4px', border: '1px solid #333' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.75rem', color: '#888' }}>Total Risk</span>
                        <strong style={{ fontSize: '0.9rem' }}>${(lineups.length * betEntry).toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.75rem', color: '#888' }}>Exp. ROI</span>
                        <strong style={{ fontSize: '0.9rem', color: '#22c55e' }}>+${Math.max(0, lineups.length * betEntry * 1.2).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {lineups.slice(0, 5).map((l, i) => (
                      <div key={i} style={{ minWidth: '300px', background: '#222', padding: '12px', borderRadius: '8px', border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                          <strong style={{ color: '#fff' }}>Lineup #{i+1}</strong>
                          <span style={{ color: '#22c55e' }}>{l.totalProjection.toFixed(1)} pts</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                          {l.players.map(p => <div key={p.id}>{p.name} (${p.salary})</div>)}
                        </div>
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
                      {renderSortHeader('Value Score', 'valueScore')}
                      {renderSortHeader('SG:OTT', 'sgOTT')}
                      {renderSortHeader('SG:APP', 'sgAPP')}
                      {renderSortHeader('SG:ARG', 'sgARG')}
                      {renderSortHeader('SG:PUTT', 'sgPUTT')}
                      {renderSortHeader('SG:T2G', 'sgT2G')}
                      {renderSortHeader('SG:Tot', 'sgTotal')}
                      {renderSortHeader('BOB', 'bob')}
                      {renderSortHeader('B.Avoid', 'ba')}
                      {renderSortHeader('Putt. Berm', 'putt_bermuda')}
                      {renderSortHeader('Putt. Bent', 'putt_bentgrass')}
                      {renderSortHeader('Putt. Poa', 'putt_poa')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map(p => {
                      const modelScore = getModelScore(p);
                      const valueScore = getValueScore(p);
                      const stats = getActiveStats(p);
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.name}</td>
                          <td style={{ padding: '8px' }}>${p.salary}</td>
                          <td style={{ padding: '8px', color: '#22c55e', fontWeight: 'bold', fontSize: '0.9rem' }}>{modelScore.toFixed(2)}</td>
                          <td style={{ padding: '8px', color: '#3b82f6', fontWeight: 'bold', fontSize: '0.9rem' }}>{valueScore === 0 ? '-' : `$${valueScore.toFixed(0)}/pt`}</td>
                          <td style={{ padding: '8px' }}>{stats.sgOTT.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgAPP.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgARG.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgPUTT.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgT2G.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgTotal.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.bob.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.ba.toFixed(2)}</td>
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
