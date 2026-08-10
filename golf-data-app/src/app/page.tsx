'use client';
import { useState, useMemo } from 'react';
import { LineupOptimizer, PlayerData, Lineup } from '@/lib/optimizer';

// Define the comprehensive stat profile for each golfer
interface GolferStats extends PlayerData {
  sgOTT: number;
  sgAPP: number;
  sgARG: number;
  sgPUTT: number;
  sgTTG: number;
  distance: number;
  accuracy: number;
  bermuda: number;
  wind: number;
}

// Mock Data representing DataGolf stats
const MOCK_PLAYERS: GolferStats[] = [
  { id: '1', name: "Scottie Scheffler", salary: 11500, projection: 95.2, customWeight: 0, sgOTT: 1.2, sgAPP: 1.5, sgARG: 0.4, sgPUTT: 0.1, sgTTG: 3.1, distance: 8, accuracy: 7, bermuda: 5, wind: 6 },
  { id: '2', name: "Rory McIlroy", salary: 10800, projection: 89.1, customWeight: 0, sgOTT: 1.4, sgAPP: 0.8, sgARG: 0.2, sgPUTT: 0.3, sgTTG: 2.4, distance: 10, accuracy: 5, bermuda: 6, wind: 7 },
  { id: '3', name: "Xander Schauffele", salary: 10200, projection: 88.5, customWeight: 0, sgOTT: 0.8, sgAPP: 1.1, sgARG: 0.5, sgPUTT: 0.6, sgTTG: 2.4, distance: 6, accuracy: 8, bermuda: 7, wind: 8 },
  { id: '4', name: "Viktor Hovland", salary: 9800, projection: 82.1, customWeight: 0, sgOTT: 0.9, sgAPP: 1.2, sgARG: -0.2, sgPUTT: 0.5, sgTTG: 1.9, distance: 7, accuracy: 7, bermuda: 4, wind: 5 },
  { id: '5', name: "Patrick Cantlay", salary: 9500, projection: 80.3, customWeight: 0, sgOTT: 0.7, sgAPP: 0.9, sgARG: 0.6, sgPUTT: 0.7, sgTTG: 2.2, distance: 6, accuracy: 7, bermuda: 8, wind: 6 },
  { id: '6', name: "Max Homa", salary: 9200, projection: 78.4, customWeight: 0, sgOTT: 0.5, sgAPP: 0.8, sgARG: 0.4, sgPUTT: 0.8, sgTTG: 1.7, distance: 6, accuracy: 6, bermuda: 7, wind: 7 },
];

export default function Home() {
  const [tournament, setTournament] = useState('Masters Tournament');
  const [players, setPlayers] = useState<GolferStats[]>(MOCK_PLAYERS);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  
  // Contest Type & Betting Details
  const [contestType, setContestType] = useState('MME');
  const [betEntry, setBetEntry] = useState(20);
  const [prizePool, setPrizePool] = useState(100000);
  
  // Global Stat Weights (percentage 0-100)
  const [weights, setWeights] = useState({
    sgOTT: 15,
    sgAPP: 30,
    sgARG: 10,
    sgPUTT: 15,
    sgTTG: 0,
    distance: 10,
    accuracy: 10,
    bermuda: 5,
    wind: 5
  });

  const handleWeightChange = (stat: keyof typeof weights, value: number) => {
    setWeights(prev => ({ ...prev, [stat]: value }));
  };

  // AI Course Fit Engine
  const aiAutoWeight = async () => {
    alert('GPT is analyzing the course... (Simulated)');
    // In production, this hits OpenAI with course details and returns optimal weights
    setWeights({
      sgOTT: 25,
      sgAPP: 35,
      sgARG: 5,
      sgPUTT: 10,
      sgTTG: 0,
      distance: 20,
      accuracy: 0,
      bermuda: 5,
      wind: 0
    });
  };

  // Calculate dynamic Model Score for a player based on their stats * global weights
  const getModelScore = (p: GolferStats) => {
    // Normalizing the stats for score combination (arbitrary mock formula)
    let score = p.projection; // Base projection
    score += (p.sgOTT * (weights.sgOTT / 10));
    score += (p.sgAPP * (weights.sgAPP / 10));
    score += (p.sgARG * (weights.sgARG / 10));
    score += (p.sgPUTT * (weights.sgPUTT / 10));
    score += (p.distance * (weights.distance / 100));
    score += (p.bermuda * (weights.bermuda / 100));
    return score;
  };

  const generateLineups = () => {
    // Pass the calculated Model Score as the projection to the optimizer
    const mappedPlayers = players.map(p => ({
      ...p,
      projection: getModelScore(p), // OVERRIDE PROJECTION WITH MODEL SCORE
      customWeight: 0
    }));
    
    // Support Single Entry vs MME
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
          </select>
          <button onClick={aiAutoWeight} style={{ background: '#3b82f6', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            ?? GPT Course Adjust
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Sidebar: Stat Weights (RickRunGood Style) */}
        <aside style={{ width: '320px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            <h3 style={{ marginBottom: '20px', fontSize: '0.9rem', textTransform: 'uppercase', color: '#888' }}>Model Weights (%)</h3>
            
            {/* Stat Input Group */}
            {Object.entries(weights).map(([stat, weight]) => (
              <div key={stat} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                  <span>{stat.toUpperCase()}</span>
                  <span style={{ color: '#22c55e' }}>{weight}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={weight} 
                  onChange={(e) => handleWeightChange(stat as keyof typeof weights, Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#22c55e' }}
                />
              </div>
            ))}
          </div>

          <div style={{ padding: '20px', background: '#000', borderTop: '1px solid #333' }}>
            
            {/* Betting Details & Contest Type */}
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

            <button onClick={generateLineups} style={{ width: '100%', background: '#22c55e', color: '#000', padding: '16px', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
              {contestType === 'Single Entry' ? 'BUILD OPTIMAL LINEUP' : 'BUILD 50 LINEUPS'}
            </button>
          </div>
        </aside>

        {/* Main Content: Massive Data Grid */}
        <section style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          
          {lineups.length > 0 && (
            <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: '#22c55e', margin: 0 }}>? {lineups.length} Lineup{lineups.length !== 1 && 's'} Generated Successfully</h3>
                
                {/* Expected Profit / Bet Details Summary */}
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
                <th style={{ padding: '12px 8px', color: '#888' }}>Dist</th>
                <th style={{ padding: '12px 8px', color: '#888' }}>Bermuda</th>
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
                    <td style={{ padding: '12px 8px' }}>{p.bermuda}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </section>
      </div>
    </main>
  );
}
