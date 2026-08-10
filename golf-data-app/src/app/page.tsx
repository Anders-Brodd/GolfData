'use client';
import { useState, useEffect } from 'react';
import { LineupOptimizer, PlayerData, Lineup } from '@/lib/optimizer';

interface GolferStats extends PlayerData {
  sgOTT: number;
  sgAPP: number;
  sgARG: number;
  sgPUTT: number;
  distance: number;
  accuracy: number;
}

export default function Home() {
  const [tournament, setTournament] = useState('Masters Tournament');
  const [players, setPlayers] = useState<GolferStats[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  
  // Contest Type & Betting Details
  const [contestType, setContestType] = useState('MME');
  const [betEntry, setBetEntry] = useState(20);
  const [prizePool, setPrizePool] = useState(100000);
  
  // Pruned Global Stat Weights (percentage 0-100)
  const [weights, setWeights] = useState({
    sgOTT: 20,
    sgAPP: 30,
    sgARG: 10,
    sgPUTT: 20,
    distance: 10,
    accuracy: 10
  });

  // Fetch Live Data from Backblaze / DataGolf on Load
  useEffect(() => {
    const fetchLivePlayers = async () => {
      try {
        const res = await fetch('/api/players');
        const data = await res.json();
        if (data.success && data.players && data.players.length > 0) {
          setPlayers(data.players);
          setDataError(null);
        } else {
          console.error('Failed to load players:', data.error);
          setDataError(data.error || 'No players found. DataGolf sync may have failed.');
        }
      } catch (err: any) {
        console.error('Network error loading players:', err);
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
    try {
      const res = await fetch('/api/ai/course-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament })
      });
      const data = await res.json();
      
      if (data.success && data.weights) {
        setWeights(data.weights);
        alert(`GPT Successfully Analyzed ${tournament}! Weights updated.`);
      } else {
        alert('GPT Analysis failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Network error connecting to OpenAI route.');
    }
    setIsAiLoading(false);
  };

  const getModelScore = (p: GolferStats) => {
    let score = p.projection; 
    score += (p.sgOTT * (weights.sgOTT / 10));
    score += (p.sgAPP * (weights.sgAPP / 10));
    score += (p.sgARG * (weights.sgARG / 10));
    score += (p.sgPUTT * (weights.sgPUTT / 10));
    score += (p.distance * (weights.distance / 100));
    score += (p.accuracy * (weights.accuracy / 100));
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
    const optimized = LineupOptimizer.generateTopLineups(mappedPlayers, lineupCount);
    setLineups(optimized);
  };

  return (
    <main style={{ padding: '0', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* Top Navigation Bar */}
      <header style={{ padding: '16px 24px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>SKRODERUP <span style={{ color: '#22c55e' }}>Custom Model</span></h1>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select style={{ background: '#222', color: '#fff', padding: '8px 16px', border: '1px solid #444', borderRadius: '4px' }} value={tournament} onChange={e => setTournament(e.target.value)}>
            <option>Masters Tournament</option>
            <option>PGA Championship</option>
            <option>US Open</option>
            <option>The Players Championship</option>
            <option>Arnold Palmer Invitational</option>
          </select>
          <button onClick={aiAutoWeight} disabled={isAiLoading || isDataLoading} style={{ background: '#3b82f6', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: isAiLoading ? 'wait' : 'pointer', fontWeight: 'bold' }}>
            {isAiLoading ? '?? Analyzing Course...' : '?? GPT Course Adjust'}
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Sidebar: Stat Weights */}
        <aside style={{ width: '320px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            <h3 style={{ marginBottom: '20px', fontSize: '0.9rem', textTransform: 'uppercase', color: '#888' }}>Model Weights (%)</h3>
            
            {/* Stat Input Group */}
            {Object.entries(weights).map(([stat, weight]) => (
              <div key={stat} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                  <span>{stat.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="number" 
                    min="0" max="100" 
                    value={weight} 
                    onChange={(e) => handleWeightChange(stat as keyof typeof weights, Number(e.target.value))}
                    style={{ flex: 1, background: '#222', color: '#22c55e', padding: '8px', border: '1px solid #444', borderRadius: '4px', fontWeight: 'bold' }}
                  />
                  <span style={{ color: '#888' }}>%</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '20px', background: '#000', borderTop: '1px solid #333' }}>
            
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

        {/* Main Content: Massive Data Grid */}
        <section style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          
          {isDataLoading ? (
             <div style={{ color: '#22c55e', fontSize: '1.2rem', padding: '40px', textAlign: 'center' }}>
               Loading live player data from DataGolf / Backblaze...
             </div>
          ) : dataError ? (
             <div style={{ color: '#ef4444', fontSize: '1.2rem', padding: '40px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid #ef4444' }}>
               {dataError}
               <br/><br/>
               <span style={{ fontSize: '1rem', color: '#fff' }}>Please verify the DataGolf API endpoints in your backend sync script.</span>
             </div>
          ) : (
            <>
              {lineups.length > 0 && (
                <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ color: '#22c55e', margin: 0 }}>? {lineups.length} Lineup{lineups.length !== 1 && 's'} Generated Successfully</h3>
                    
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
                  <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '8px' }}>
                    {contestType === 'Single Entry' ? 'Showing Optimal Single Entry Lineup.' : 'Showing top 5 of 50 MME Lineups. Export feature coming soon.'}
                  </p>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#1a1a1a', borderBottom: '2px solid #333' }}>
                    <th style={{ padding: '12px 8px', color: '#888' }}>Golfer</th>
                    <th style={{ padding: '12px 8px', color: '#888' }}>Salary</th>
                    <th style={{ padding: '12px 8px', color: '#22c55e' }}>Model Score</th>
                    <th style={{ padding: '12px 8px', color: '#888' }}>Base Proj</th>
                    <th style={{ padding: '12px 8px', color: '#888' }}>SG:OTT</th>
                    <th style={{ padding: '12px 8px', color: '#888' }}>SG:APP</th>
                    <th style={{ padding: '12px 8px', color: '#888' }}>SG:ARG</th>
                    <th style={{ padding: '12px 8px', color: '#888' }}>SG:PUTT</th>
                    <th style={{ padding: '12px 8px', color: '#888' }}>Distance</th>
                    <th style={{ padding: '12px 8px', color: '#888' }}>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => {
                    const modelScore = getModelScore(p);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #222' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{p.name}</td>
                        <td style={{ padding: '12px 8px' }}>${p.salary}</td>
                        <td style={{ padding: '12px 8px', color: '#22c55e', fontWeight: 'bold', fontSize: '1rem' }}>{modelScore.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', color: '#aaa' }}>{p.projection}</td>
                        <td style={{ padding: '12px 8px', color: p.sgOTT > 1 ? '#22c55e' : '#fff' }}>{p.sgOTT}</td>
                        <td style={{ padding: '12px 8px', color: p.sgAPP > 1 ? '#22c55e' : '#fff' }}>{p.sgAPP}</td>
                        <td style={{ padding: '12px 8px', color: p.sgARG > 0.5 ? '#22c55e' : p.sgARG < 0 ? '#ef4444' : '#fff' }}>{p.sgARG}</td>
                        <td style={{ padding: '12px 8px' }}>{p.sgPUTT}</td>
                        <td style={{ padding: '12px 8px' }}>{p.distance}</td>
                        <td style={{ padding: '12px 8px' }}>{p.accuracy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

        </section>
      </div>
    </main>
  );
}
