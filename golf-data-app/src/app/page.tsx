'use client';
import { useState, useMemo } from 'react';
import { LineupOptimizer, PlayerData, Lineup } from '@/lib/optimizer';

const MOCK_PLAYERS: PlayerData[] = [
  { id: '1', name: "Scottie Scheffler", salary: 11500, projection: 95.2, customWeight: 0 },
  { id: '2', name: "Rory McIlroy", salary: 10800, projection: 89.1, customWeight: 0 },
  { id: '3', name: "Xander Schauffele", salary: 10200, projection: 88.5, customWeight: 0 },
  { id: '4', name: "Viktor Hovland", salary: 9800, projection: 82.1, customWeight: 0 },
  { id: '5', name: "Patrick Cantlay", salary: 9500, projection: 80.3, customWeight: 0 },
  { id: '6', name: "Max Homa", salary: 9200, projection: 78.4, customWeight: 0 },
  { id: '7', name: "Collin Morikawa", salary: 9000, projection: 76.2, customWeight: 0 },
  { id: '8', name: "Matt Fitzpatrick", salary: 8800, projection: 74.5, customWeight: 0 },
  { id: '9', name: "Wyndham Clark", salary: 8600, projection: 73.1, customWeight: 0 },
  { id: '10', name: "Brian Harman", salary: 8400, projection: 71.9, customWeight: 0 },
  { id: '11', name: "Tommy Fleetwood", salary: 8200, projection: 70.2, customWeight: 0 },
  { id: '12', name: "Cameron Young", salary: 8000, projection: 68.5, customWeight: 0 },
  { id: '13', name: "Keegan Bradley", salary: 7800, projection: 66.8, customWeight: 0 },
  { id: '14', name: "Rickie Fowler", salary: 7600, projection: 65.1, customWeight: 0 },
  { id: '15', name: "Jason Day", salary: 7400, projection: 63.4, customWeight: 0 },
];

export default function Home() {
  const [tournament, setTournament] = useState('Masters Tournament');
  const [players, setPlayers] = useState<PlayerData[]>(MOCK_PLAYERS);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [betEntry, setBetEntry] = useState(20);
  const [prizePool, setPrizePool] = useState(100000);

  const handleWeightChange = (id: string, weight: number) => {
    setPlayers(players.map(p => p.id === id ? { ...p, customWeight: weight } : p));
  };

  const aiAutoWeight = async () => {
    // In a real app, this calls /api/openai to get course fits and sets weights
    alert('GPT is analyzing the course... (Simulated)');
    const weightedPlayers = players.map(p => ({
      ...p,
      customWeight: Math.floor(Math.random() * 20) - 5 // Random weights -5% to +15%
    }));
    setPlayers(weightedPlayers);
  };

  const generateLineups = () => {
    const optimized = LineupOptimizer.generateTopLineups(players, 50);
    setLineups(optimized);
  };

  const expectedProfit = useMemo(() => {
    if (lineups.length === 0) return 0;
    // Basic mock calculation: Total Entry Cost vs Expected Win based on projections
    const totalCost = lineups.length * betEntry;
    const avgProj = lineups.reduce((sum, l) => sum + l.totalProjection, 0) / lineups.length;
    // Arbitrary formula: if avg projection is over 450, you might cash
    const winProbability = Math.max(0, (avgProj - 400) / 100); 
    const expectedReturn = winProbability * prizePool * 0.05; // 5% of prize pool average win
    return expectedReturn - totalCost;
  }, [lineups, betEntry, prizePool]);

  return (
    <main style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header & Controls */}
      <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>SKRODERUP <span style={{ color: 'var(--primary)' }}>Data Model</span></h1>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select className="input-glass" value={tournament} onChange={e => setTournament(e.target.value)}>
            <option value="Masters Tournament">The Masters Tournament</option>
            <option value="PGA Championship">PGA Championship</option>
            <option value="US Open">US Open</option>
          </select>
          <button className="btn-primary" onClick={aiAutoWeight} style={{ background: '#3b82f6', color: '#fff' }}>
            ?? AI Course Fit Adjust
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px', alignItems: 'start' }}>
        
        {/* Left: Player Data Table */}
        <section className="glass-panel" style={{ overflowX: 'auto' }}>
          <h2 style={{ marginBottom: '16px' }}>Player Pool: {tournament}</h2>
          <table className="premium-table">
            <thead>
              <tr>
                <th>Golfer</th>
                <th>DK Salary</th>
                <th>Base Proj</th>
                <th>AI/Custom Wgt (%)</th>
                <th>Adj Proj</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => {
                const adjProj = p.projection * (1 + p.customWeight / 100);
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>${p.salary.toLocaleString()}</td>
                    <td>{p.projection.toFixed(1)}</td>
                    <td>
                      <input 
                        type="number" 
                        className="input-glass" 
                        style={{ width: '80px', padding: '6px' }}
                        value={p.customWeight}
                        onChange={(e) => handleWeightChange(p.id, Number(e.target.value))}
                      />
                    </td>
                    <td className="highlight-green">{adjProj.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Right: Optimizer Controls & Lineups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Bet Details Calculator */}
          <section className="glass-panel">
            <h3 style={{ marginBottom: '16px' }}>Bet & Profit Calculator</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Entry Fee ($)</label>
                <input type="number" className="input-glass" value={betEntry} onChange={e => setBetEntry(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Prize Pool ($)</label>
                <input type="number" className="input-glass" value={prizePool} onChange={e => setPrizePool(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>
            
            <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Total Entries Cost:</span>
                <strong>${(lineups.length * betEntry).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: expectedProfit >= 0 ? 'var(--primary)' : '#ef4444' }}>
                <span>Expected Profit (ROI):</span>
                <strong>${expectedProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              </div>
            </div>

            <button className="btn-primary" onClick={generateLineups} style={{ width: '100%', fontSize: '1.1rem', padding: '16px' }}>
              Generate Top 50 Lineups
            </button>
          </section>

          {/* Lineups List */}
          {lineups.length > 0 && (
            <section className="glass-panel" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <h3 style={{ marginBottom: '16px' }}>Top {lineups.length} Lineups</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {lineups.map((lineup, i) => (
                  <div key={lineup.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                      <strong>Lineup #{i + 1}</strong>
                      <div>
                        <span style={{ marginRight: '12px', color: '#aaa' }}>${lineup.totalSalary.toLocaleString()}</span>
                        <span className="highlight-green">{lineup.totalProjection.toFixed(1)} pts</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#ddd', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {lineup.players.map(p => (
                        <span key={p.id} style={{ background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px' }}>{p.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </main>
  );
}
