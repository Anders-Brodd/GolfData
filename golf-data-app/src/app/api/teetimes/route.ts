import { NextResponse } from 'next/server';
import { DataGolfAPI } from '@/lib/datagolf';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tour = searchParams.get('tour') || 'pga';

    const api = new DataGolfAPI();
    
    // 1. Get schedule to find current tournament location
    const schedData = await api.getTourSchedules(tour);
    const upcoming = schedData.schedule?.filter((t: any) => t.status !== 'completed');
    const currentTourney = upcoming?.length > 0 ? upcoming[0] : schedData.schedule?.[0];

    // 2. Get field updates for tee times
    let fieldUpdates = null;
    try {
      fieldUpdates = await api.getFieldUpdates(tour);
    } catch (e) {
      console.warn("Failed to get field updates, maybe not available yet", e);
    }

    // 3. Get weather if we have lat/lon
    let weatherMap: any = {};
    if (currentTourney?.latitude && currentTourney?.longitude) {
      try {
        const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${currentTourney.latitude}&longitude=${currentTourney.longitude}&hourly=wind_speed_10m&timezone=auto`;
        const wRes = await fetch(wUrl);
        const wData = await wRes.json();
        
        if (wData.hourly && wData.hourly.time) {
          wData.hourly.time.forEach((t: string, idx: number) => {
            // t is like "2026-02-12T09:00"
            const hourKey = t.substring(0, 13); // "2026-02-12T09"
            weatherMap[hourKey] = wData.hourly.wind_speed_10m[idx];
          });
        }
      } catch (e) {
        console.warn("Failed to get weather", e);
      }
    }

    // 4. Map tee times and weather to players
    const players: any = {};
    if (fieldUpdates?.field) {
      fieldUpdates.field.forEach((p: any) => {
        const t1 = p.teetimes?.find((t: any) => t.round_num === 1);
        let wind = null;
        if (t1?.teetime) {
          // teetime format: "2026-02-12 09:11"
          const hourKey = t1.teetime.replace(' ', 'T').substring(0, 13);
          wind = weatherMap[hourKey];
        }
        players[p.dg_id] = {
          teetime: t1?.teetime || null,
          wind: wind !== undefined ? wind : null
        };
      });
    }

    return NextResponse.json({
      success: true,
      event: currentTourney?.event_name,
      players
    });

  } catch (error: any) {
    console.error('Error fetching teetimes:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
