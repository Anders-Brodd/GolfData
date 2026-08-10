import { NextResponse } from 'next/server';
import { DataGolfAPI } from '@/lib/datagolf';
import { uploadData } from '@/lib/b2';

export async function GET() {
  try {
    const dg = new DataGolfAPI();
    const years = ['2024', '2025', '2026'];
    const results = [];

    for (const year of years) {
      console.log(`Fetching DataGolf raw rounds for ${year}...`);
      const data = await dg.getHistoricalRawRounds(year);
      
      const flatRounds: any[] = [];
      
      // data is a dictionary where keys are event_ids
      const eventIds = Object.keys(data);
      
      for (const eventId of eventIds) {
        const eventObj = data[eventId];
        if (!eventObj || !eventObj.scores) continue;
        
        for (const player of eventObj.scores) {
          const dgId = player.dg_id;
          const playerName = player.player_name;
          
          // Check for round_1, round_2, round_3, round_4
          for (let i = 1; i <= 4; i++) {
            const roundData = player[`round_${i}`];
            if (roundData) {
              flatRounds.push({
                event_id: eventObj.event_id,
                event_name: eventObj.event_name,
                event_completed: eventObj.event_completed,
                date: eventObj.event_completed, // used for sorting later
                dg_id: dgId,
                player_name: playerName,
                round_num: i,
                ...roundData
              });
            }
          }
        }
      }
      
      console.log(`Extracted ${flatRounds.length} individual rounds for ${year}. Uploading to B2...`);
      if (flatRounds.length > 0) {
        await uploadData(`raw_rounds_${year}.json`, flatRounds);
      }
      results.push({ year, count: flatRounds.length });
    }

    return NextResponse.json({ success: true, message: 'Historical data ingested', results });
  } catch (error: any) {
    console.error('Ingest error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
