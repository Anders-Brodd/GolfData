import { NextResponse } from 'next/server';
import { getData } from '@/lib/b2';

export async function GET() {
  try {
    const rawData = await getData('latest_merged_data.json');
    
    let playersList: any[] = [];
    if (Array.isArray(rawData)) {
      playersList = rawData;
    } else {
       const arrays = Object.values(rawData).filter(Array.isArray);
       if (arrays.length > 0) playersList = arrays[0];
    }

    const formattedPlayers = playersList.map((p: any, idx: number) => {
      const name = p.player_name || p.name || `Player ${idx+1}`;
      const salary = Number(p.salary || p.dk_salary || 0);
      const projection = Number(p.proj_points_total || p.proj_pts || 0);
      
      const stats16 = p.stats16 || { sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgT2G: 0, sgTotal: 0 };
      const stats32 = p.stats32 || { sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgT2G: 0, sgTotal: 0 };
      const stats64 = p.stats64 || { sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgT2G: 0, sgTotal: 0 };
      
      const putt_bermuda = Number(p.putt_bermuda || 50);
      const putt_bentgrass = Number(p.putt_bentgrass || 50);
      const putt_poa = Number(p.putt_poa || 50);
      const wind = Number(p.wind || 50);
      
      return {
        id: p.dg_id?.toString() || p.id?.toString() || idx.toString(),
        name,
        salary,
        projection,
        customWeight: 0,
        stats16,
        stats32,
        stats64,
        putt_bermuda,
        putt_bentgrass,
        putt_poa,
        wind
      };
    }).filter((p: any) => p.salary > 0); 

    return NextResponse.json({ success: true, players: formattedPlayers });
  } catch (error: any) {
    console.error('Failed to load players from B2:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
