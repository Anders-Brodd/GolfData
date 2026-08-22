'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function Navigation({ tabs, setTabs, activeTabIdx, setActiveTabIdx }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState('');

  useEffect(() => {
    fetch('/api/tournaments').then(r => r.json()).then(d => {
      if (d.schedule) {
        setTournaments(d.schedule);
        const stored = localStorage.getItem('skroderup_tournament');
        if (stored) setSelectedTournament(stored);
        else if (d.schedule.length > 0) {
          const sorted = [...d.schedule].sort((a: any, b: any) => String(a.start_date).localeCompare(String(b.start_date)));
          const upcoming = sorted.filter((t: any) => t.status !== 'completed');
          const toSelect = upcoming.length > 0 ? upcoming[0].event_id : d.schedule[0].event_id;
          setSelectedTournament(toSelect);
          localStorage.setItem('skroderup_tournament', toSelect);
        }
      }
    });
  }, []);

  const handleTournamentChange = (e: any) => {
    setSelectedTournament(e.target.value);
    localStorage.setItem('skroderup_tournament', e.target.value);
    window.dispatchEvent(new Event('tournament_changed'));
  };

  const renameTab = (index: number) => {
    const slotName = prompt('Enter a name for this configuration tab:', tabs[index].name);
    if (!slotName) return;
    const nt = [...tabs];
    nt[index].name = slotName;
    setTabs(nt);
  };


  const deleteTab = (index: number) => {
    if (tabs.length === 1) return alert('You must have at least one tab.');
    if (!confirm('Are you sure you want to delete this tab?')) return;
    const nt = [...tabs];
    nt.splice(index, 1);
    setTabs(nt);
    if (activeTabIdx >= nt.length) {
      setActiveTabIdx(nt.length - 1);
    } else if (activeTabIdx === index) {
      setActiveTabIdx(0);
    }
  };

  const addTab = () => {
    if (tabs.length >= 10) return alert('Maximum 10 tabs allowed.');
    setTabs([...tabs, { name: `Tab ${tabs.length + 1}`, weights: {}, lineups: [] }]);
  };

  const upc = tournaments.filter(t => t.status !== 'completed').sort((a: any, b: any) => String(a.start_date).localeCompare(String(b.start_date)));
  const pst = tournaments.filter(t => t.status === 'completed').sort((a: any, b: any) => String(b.start_date).localeCompare(String(a.start_date)));

  return (
    <>
      <header style={{ padding: '16px 24px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => router.push('/')}>
            <img src="/logo.png" alt="Logo" style={{ height: '80px', objectFit: 'contain' }} />
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#22c55e', whiteSpace: 'nowrap' }}>Custom Model</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
             <button onClick={() => router.push('/')} style={{ background: pathname === '/' ? '#222' : 'transparent', color: '#fff', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Player Grid</button>
             
             {tabs[activeTabIdx]?.lineups?.length > 0 && (<button onClick={() => router.push('/lineups')} style={{ background: pathname === '/lineups' ? '#222' : 'transparent', color: '#fff', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Lineups</button>)}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select 
            style={{ padding: '8px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', outline: 'none' }}
            value={selectedTournament} 
            onChange={handleTournamentChange}
          >
            <optgroup label="Upcoming Tournaments">
              {upc.map(t => <option key={t.event_id} value={t.event_id}>{t.event_name} {t.start_date ? `(${t.start_date.substring(0,4)})` : ''}</option>)}
            </optgroup>
            <optgroup label="Past Tournaments">
              {pst.map(t => <option key={t.event_id} value={t.event_id}>{t.event_name} {t.start_date ? `(${t.start_date.substring(0,4)})` : ''}</option>)}
            </optgroup>
          </select>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', background: '#0a0a0a', padding: '12px 24px', borderBottom: '1px solid #222' }}>
        {tabs.map((tab: any, idx: number) => (
          <div key={idx} style={{ display: 'flex' }}>
            <button
              onClick={() => setActiveTabIdx(idx)}
              style={{
                padding: '8px 16px', background: activeTabIdx === idx ? '#3b82f6' : '#1a1a1a',
                color: '#fff', border: '1px solid #333', borderRight: 'none',
                borderRadius: '4px 0 0 4px', cursor: 'pointer', fontWeight: activeTabIdx === idx ? 'bold' : 'normal',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.name} {tab.lineups?.length > 0 && `(${tab.lineups.length})`}
            </button>
            <button
              onClick={() => renameTab(idx)}
              style={{
                padding: '8px', background: activeTabIdx === idx ? '#2563eb' : '#222',
                color: '#aaa', border: '1px solid #333', borderLeft: 'none', borderRight: tabs.length > 1 ? 'none' : '1px solid #333', borderRadius: tabs.length > 1 ? '0' : '0 4px 4px 0',
                cursor: 'pointer'
              }}
              title="Rename Tab"
            >
              Edit
            </button>
            {tabs.length > 1 && (
              <button
                onClick={() => deleteTab(idx)}
                style={{
                  padding: '8px', background: activeTabIdx === idx ? '#2563eb' : '#222',
                  color: '#ef4444', border: '1px solid #333', borderLeft: '1px solid #444', borderRadius: '0 4px 4px 0',
                  cursor: 'pointer'
                }}
                title="Delete Tab"
              >
              X
              </button>
            )}
          </div>
        ))}
        {tabs.length < 10 && (
          <button onClick={addTab} style={{ padding: '8px 16px', background: 'transparent', color: '#22c55e', border: '1px dashed #22c55e', borderRadius: '4px', cursor: 'pointer' }}>
            + Add Tab
          </button>
        )}
      </div>
    </>
  );
}
