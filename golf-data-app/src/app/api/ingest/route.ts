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
      
      let rounds = [];
      if (Array.isArray(data)) {
        rounds = data;
      } else if (data.data && Array.isArray(data.data)) {
        rounds = data.data;
      } else {
        // DataGolf returns a dictionary keyed by event_id for historical-raw-data
        const allEvents = Object.values(data);
        rounds = allEvents.flat();
      }
      
      console.log(`Uploading ${rounds.length} rounds for ${year} to B2...`);
      await uploadData(`raw_rounds_${year}.json`, rounds);
      results.push({ year, count: rounds.length });
    }

    return NextResponse.json({ success: true, message: 'Historical data ingested', results });
  } catch (error: any) {
    console.error('Ingest error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
