import { NextResponse } from 'next/server';
import { getData } from '@/lib/b2';

export async function GET() {
  try {
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
    
    return NextResponse.json({ success: true, rounds: allRounds });
  } catch (error: any) {
    console.error('Failed to load raw rounds:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
