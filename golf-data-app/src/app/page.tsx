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
  
  // GPT Chat Notes
  const [gptNotes, setGptNotes] = useState('');
  const [gptReasoning, setGptReasoning] = useState('');

  const [weights, setWeights] = useState({
    sgOTT: 10,
    sgAPP: 20,
    sgARG: 5,
    sgPUTT: 10,
    sgT2G: 10,
    sgTotal: 10,
    distance: 5,
    accuracy: 5,
    putt_bermuda: 5,
    putt_bentgrass: 5,
    putt_poa: 5,
    wind: 10
  });

  useEffect(() => {
    // Fetch Schedule
    fetch('/api/tournaments')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.schedule) {
          setTournaments(data.schedule);
          if (data.schedule.length > 0) {
            setSelectedTournament(data.schedule[0].event_name);
          }
        }
      });

    // Fetch Players
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

  const aiAutoWeight = async () => {
    setIsAiLoading(true);
    setGptReasoning('');
    try {
      const res = await fetch('/api/ai/course-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament: selectedTournament, userNotes: gptNotes })
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
    score += ((p.distance || 0) * (weights.distance / 100));
    score += ((p.accuracy || 0) * (weights.accuracy / 100));
    score += (p.putt_bermuda * (weights.putt_bermuda / 1000));
    score += (p.putt_bentgrass * (weights.putt_bentgrass / 1000));
    score += (p.putt_poa * (weights.putt_poa / 1000));
    score += (p.wind * (weights.wind / 1000));
    return score;
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
              <h3 style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#3b82f6' }}>? AI Course Adjust</h3>
              <textarea 
                placeholder="Add custom notes for GPT (e.g., 'Weight accuracy heavily, rough is thick...')"
                value={gptNotes}
                onChange={e => setGptNotes(e.target.value)}
                style={{ width: '100%', height: '60px', background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '8px' }}
              />
              <button onClick={aiAutoWeight} disabled={isAiLoading || isDataLoading} style={{ width: '100%', background: '#3b82f6', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: isAiLoading ? 'wait' : 'pointer', fontWeight: 'bold' }}>
                {isAiLoading ? 'Analyzing...' : 'Ask AI to Weight Course'}
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
                    <h3 style={{ color: '#22c55e', margin: 0 }}>? {lineups.length} Lineup{lineups.length !== 1 && 's'} Generated</h3>
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
                      <th style={{ padding: '8px', color: '#888' }}>Golfer</th>
                      <th style={{ padding: '8px', color: '#888' }}>Salary</th>
                      <th style={{ padding: '8px', color: '#22c55e' }}>Model Score</th>
                      <th style={{ padding: '8px', color: '#888' }}>SG:OTT</th>
                      <th style={{ padding: '8px', color: '#888' }}>SG:APP</th>
                      <th style={{ padding: '8px', color: '#888' }}>SG:ARG</th>
                      <th style={{ padding: '8px', color: '#888' }}>SG:PUTT</th>
                      <th style={{ padding: '8px', color: '#888' }}>SG:T2G</th>
                      <th style={{ padding: '8px', color: '#888' }}>SG:Tot</th>
                      <th style={{ padding: '8px', color: '#888' }}>Putt. Berm</th>
                      <th style={{ padding: '8px', color: '#888' }}>Putt. Bent</th>
                      <th style={{ padding: '8px', color: '#888' }}>Putt. Poa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(p => {
                      const modelScore = getModelScore(p);
                      const stats = getActiveStats(p);
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.name}</td>
                          <td style={{ padding: '8px' }}>${p.salary}</td>
                          <td style={{ padding: '8px', color: '#22c55e', fontWeight: 'bold', fontSize: '0.9rem' }}>{modelScore.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgOTT.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgAPP.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgARG.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgPUTT.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgT2G.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>{stats.sgTotal.toFixed(2)}</td>
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
