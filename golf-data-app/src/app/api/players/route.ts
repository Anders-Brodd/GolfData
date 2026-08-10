import { NextResponse } from 'next/server';
import { getData } from '@/lib/b2';

export async function GET() {
  try {
    const rawData = await getData('latest_projections.json');
    
    // DataGolf preds/get-td endpoint usually returns { baseline_history_fit: [...] } or { baseline: [...] } or just an array
    // Let's robustly parse it.
    let playersList: any[] = [];
    if (Array.isArray(rawData)) {
      playersList = rawData;
    } else if (rawData.baseline_history_fit) {
      playersList = rawData.baseline_history_fit;
    } else if (rawData.baseline) {
      playersList = rawData.baseline;
    } else if (rawData.preds) {
      playersList = rawData.preds;
    } else {
       // fallback, just grab the first array we find
       const arrays = Object.values(rawData).filter(Array.isArray);
       if (arrays.length > 0) playersList = arrays[0];
    }

    // Map to our UI format
    const formattedPlayers = playersList.map((p: any, idx: number) => {
      // Safely extract DataGolf fields. 
      // Different DataGolf endpoints use slightly different keys (e.g., player_name vs name)
      const name = p.player_name || p.name || `Player ${idx+1}`;
      const salary = Number(p.dk_salary || p.salary || 0);
      const projection = Number(p.proj_pts || p.proj || p.fantasy_pts || 50);
      
      // DataGolf get-td endpoint does not always provide full SG data. We extract what we can, default to 0.
      const sgOTT = Number(p.sg_ott || p.sg_off_the_tee || 0);
      const sgAPP = Number(p.sg_app || p.sg_approach || 0);
      const sgARG = Number(p.sg_arg || p.sg_around_the_green || 0);
      const sgPUTT = Number(p.sg_putt || p.sg_putting || 0);
      
      return {
        id: p.dg_id?.toString() || p.id?.toString() || idx.toString(),
        name,
        salary,
        projection,
        customWeight: 0,
        sgOTT,
        sgAPP,
        sgARG,
        sgPUTT,
        distance: 0, // Not typically in get-td
        accuracy: 0  // Not typically in get-td
      };
    }).filter((p: any) => p.salary > 0); // Only include valid DK players

    return NextResponse.json({ success: true, players: formattedPlayers });
  } catch (error: any) {
    console.error('Failed to load players from B2:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
