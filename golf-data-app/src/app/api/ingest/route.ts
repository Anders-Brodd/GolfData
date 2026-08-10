import { NextResponse } from 'next/server';
import { DataGolfAPI } from '@/lib/datagolf';
import { uploadData, getData } from '@/lib/b2';
import { calculateRollingAverages } from '@/lib/stats';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetYear = searchParams.get('year') || new Date().getFullYear().toString();
    
    console.log(`Ingesting raw rounds for ${targetYear}...`);
    const dg = new DataGolfAPI();
    const data = await dg.getHistoricalRawRounds(targetYear);
    
    const flatRounds: any[] = [];
    const eventIds = Object.keys(data);
    for (const eventId of eventIds) {
      const eventObj = data[eventId];
      if (!eventObj || !eventObj.scores) continue;
      
      for (const player of eventObj.scores) {
        const dgId = player.dg_id;
        const playerName = player.player_name;
        
        for (let i = 1; i <= 4; i++) {
          const roundData = player[`round_${i}`];
          if (roundData) {
            flatRounds.push({
              event_id: eventObj.event_id,
              event_name: eventObj.event_name,
              event_completed: eventObj.event_completed,
              date: eventObj.event_completed,
              dg_id: dgId,
              player_name: playerName,
              round_num: i,
              ...roundData
            });
          }
        }
      }
    }
    
    console.log(`Extracted ${flatRounds.length} individual rounds for ${targetYear}. Uploading...`);
    if (flatRounds.length > 0) {
      await uploadData(`raw_rounds_${targetYear}.json`, flatRounds);
    }

    console.log('Loading all historical rounds to compute rolling averages...');
    const [r2024, r2025, r2026] = await Promise.all([
      getData('raw_rounds_2024.json').catch(() => []),
      getData('raw_rounds_2025.json').catch(() => []),
      getData('raw_rounds_2026.json').catch(() => [])
    ]);

    const allRounds = [
      ...(Array.isArray(r2024) ? r2024 : []),
      ...(Array.isArray(r2025) ? r2025 : []),
      ...(Array.isArray(r2026) ? r2026 : [])
    ];
    
    const roundsByPlayer = new Map();
    allRounds.forEach(r => {
      const id = String(r.dg_id);
      if (!roundsByPlayer.has(id)) roundsByPlayer.set(id, []);
      roundsByPlayer.get(id).push(r);
    });

    roundsByPlayer.forEach(rounds => {
      rounds.sort((a: any, b: any) => new Date(b.date || b.start_date || 0).getTime() - new Date(a.date || a.start_date || 0).getTime());
    });

    console.log('Calculating rolling averages for all players...');
    const calculatedStats: Record<string, any> = {};
    
    for (const [dgId, rounds] of roundsByPlayer.entries()) {
      calculatedStats[dgId] = {
        stats16: calculateRollingAverages(rounds, 16),
        stats32: calculateRollingAverages(rounds, 32),
        stats64: calculateRollingAverages(rounds, 64),
      };
    }
    
    await uploadData('calculated_stats.json', calculatedStats);
    console.log('Ingest and calculation complete!');
    
    return NextResponse.json({ success: true, message: `Data ingested and stats calculated`, playersCount: Object.keys(calculatedStats).length });
  } catch (error: any) {
    console.error('Ingest error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
