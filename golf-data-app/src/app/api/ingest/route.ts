import { NextResponse } from 'next/server';
import { DataGolfAPI } from '@/lib/datagolf';
import { uploadData } from '@/lib/b2';

export async function GET() {
  try {
    const dg = new DataGolfAPI();
    
    // We fetch years individually and upload them individually to avoid massive memory blowouts
    const years = ['2024', '2025', '2026'];
    const results = [];

    for (const year of years) {
      console.log(`Fetching DataGolf raw rounds for ${year}...`);
      const data = await dg.getHistoricalRawRounds(year);
      
      // Ensure we have an array of rounds
      const rounds = Array.isArray(data) ? data : (data.data || []);
      
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
