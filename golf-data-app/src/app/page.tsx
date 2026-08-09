'use client';
import { useState } from 'react';

export default function Home() {
  const [model, setModel] = useState('gpt-5.5-mini');
  const [isSyncing, setIsSyncing] = useState(false);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/sync');
      alert('Sync complete!');
    } catch (e) {
      alert('Sync failed');
    }
    setIsSyncing(false);
  };

  // Mock data for UI demonstration
  const players = [
    { name: "Scottie Scheffler", salary: 11500, proj: 95.2, bvi: 125.4, mispriced: false },
    { name: "Rory McIlroy", salary: 10800, proj: 89.1, bvi: 118.2, mispriced: true },
    { name: "Xander Schauffele", salary: 10200, proj: 88.5, bvi: 120.1, mispriced: true },
  ];

  return (
    <main style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px' }}>
            SKRODERUP <span style={{ color: 'var(--primary)' }}>Optimizer</span>
          </h1>
          <p style={{ color: '#888', marginTop: '8px' }}>DraftKings Value Board & AI Course Fit</p>
        </div>
        <button className="btn-primary" onClick={triggerSync} disabled={isSyncing}>
          {isSyncing ? 'Syncing...' : 'Force Data Sync'}
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '32px' }}>
        
        {/* Sidebar: AI Configurator */}
        <aside className="glass-panel" style={{ alignSelf: 'start' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>AI Course Fit</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#aaa' }}>LLM Model</label>
            <select 
              className="input-glass" 
              style={{ width: '100%' }}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="gpt-5.5-mini">GPT-5.5 mini (Default)</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4">GPT-4</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#aaa' }}>Top Stats (Auto-generated)</label>
            <textarea 
              className="input-glass" 
              style={{ width: '100%', minHeight: '120px', resize: 'vertical' }}
              defaultValue={"SG: Approach\nDriving Distance\nSG: Tee-to-Green\nPar 4 Scoring"}
            />
            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px' }}>You can override the AI's choices here.</p>
          </div>

          <button className="btn-primary" style={{ width: '100%' }}>Generate Lineups</button>
        </aside>

        {/* Main Content: Value Board */}
        <section className="glass-panel">
          <h2 style={{ marginBottom: '24px' }}>Brodd Value Board</h2>
          <table className="premium-table">
            <thead>
              <tr>
                <th>Golfer</th>
                <th>Salary</th>
                <th>Projection</th>
                <th>BVI Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>\</td>
                  <td>{p.proj}</td>
                  <td className="highlight-green">{p.bvi}</td>
                  <td>
                    {p.mispriced 
                      ? <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>MISPRICED</span> 
                      : <span style={{ color: '#888', fontSize: '0.8rem' }}>FAIR VALUE</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>
    </main>
  );
}
