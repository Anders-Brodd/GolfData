'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';

export default function Lineups() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [tabs, setTabs] = useState<any[]>([]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTabs = localStorage.getItem('skroderup_tabs');
      if (storedTabs) {
        setTabs(JSON.parse(storedTabs));
        setActiveTabIdx(Number(localStorage.getItem('skroderup_active_tab') || 0));
      }
      setIsClient(true);
    }
  }, []);

  const updateActiveTab = (idx: number) => {
    setActiveTabIdx(idx);
    localStorage.setItem('skroderup_active_tab', idx.toString());
  };

  const updateTabs = (newTabs: any[]) => {
    setTabs(newTabs);
    localStorage.setItem('skroderup_tabs', JSON.stringify(newTabs));
  };

  if (!isClient) return <div style={{ background: '#0a0a0a', height: '100vh', color: '#fff' }} />;

  const currentLineups = tabs[activeTabIdx]?.lineups || [];

  const exportToCSV = () => {
    if (!currentLineups || currentLineups.length === 0) return;
    let csv = "G,G,G,G,G,G\n";
    currentLineups.forEach((l: any) => {
      csv += l.players.map((p: any) => `"${p.name}"`).join(',') + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineups_tab_${activeTabIdx + 1}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' }}>
      <Navigation tabs={tabs} setTabs={updateTabs} activeTabIdx={activeTabIdx} setActiveTabIdx={updateActiveTab} />
      
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
          <h2 style={{ color: '#a855f7', margin: 0 }}>
            Generated Lineups ({currentLineups.length})
          </h2>
          {currentLineups.length > 0 && (
            <button 
              onClick={exportToCSV}
              style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Export CSV
            </button>
          )}
        </div>
        
        {currentLineups.length === 0 ? (
          <div style={{ color: '#aaa', marginTop: '24px' }}>No lineups generated for this tab yet. Go to Settings & Data to generate some.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginTop: '24px' }}>
            {currentLineups.map((l: any, i: number) => (
              <div key={i} style={{ background: '#111', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Lineup {i+1}</span>
                  <span style={{ color: '#22c55e', fontWeight: 'bold' }}>${l.totalSalary}</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#ccc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {l.players.map((p: any) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{p.name}</span>
                      <span style={{ color: '#888' }}>${p.salary}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
