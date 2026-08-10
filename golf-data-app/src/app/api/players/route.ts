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
      
      const sgOTT = Number(p.sg_ott || 0);
      const sgAPP = Number(p.sg_app || 0);
      const sgARG = Number(p.sg_arg || 0);
      const sgPUTT = Number(p.sg_putt || 0);
      const sgT2G = Number(p.sg_t2g || 0);
      const sgTotal = Number(p.sg_total || 0);
      const distance = Number(p.driving_dist || 0);
      const accuracy = Number(p.driving_acc || 0);
      
      const bermuda = Number(p.bermuda || 50);
      const bentgrass = Number(p.bentgrass || 50);
      const poa = Number(p.poa || 50);
      const wind = Number(p.wind || 50);
      
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
        sgT2G,
        sgTotal,
        distance,
        accuracy,
        bermuda,
        bentgrass,
        poa,
        wind
      };
    }).filter((p: any) => p.salary > 0); 

    return NextResponse.json({ success: true, players: formattedPlayers });
  } catch (error: any) {
    console.error('Failed to load players from B2:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
