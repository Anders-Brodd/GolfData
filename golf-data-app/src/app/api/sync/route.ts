import { NextResponse } from 'next/server';
import { DataGolfAPI } from '@/lib/datagolf';
import { uploadData } from '@/lib/b2';

export async function GET() {
  try {
    const dg = new DataGolfAPI();
    
    // Fetch predictions and odds
    console.log('Fetching DataGolf projections...');
    const preds = await dg.getProjections();
    
    console.log('Fetching DataGolf odds...');
    const odds = await dg.getPreTournamentOdds();
    
    // Store them in Backblaze B2
    console.log('Uploading to Backblaze B2...');
    await uploadData('latest_projections.json', preds);
    await uploadData('latest_odds.json', odds);
    
    return NextResponse.json({ success: true, message: 'Data synced successfully' });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
