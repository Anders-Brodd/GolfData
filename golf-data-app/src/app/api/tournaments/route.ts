import { NextResponse } from 'next/server';
import { DataGolfAPI } from '@/lib/datagolf';

export async function GET() {
  try {
    const dg = new DataGolfAPI();
    const scheduleData = await dg.getTourSchedules('pga');
    
    // Sort so most recent / upcoming are at the top, or just return as is
    return NextResponse.json({ success: true, schedule: scheduleData.schedule || [] });
  } catch (error: any) {
    console.error('Failed to load tournaments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
