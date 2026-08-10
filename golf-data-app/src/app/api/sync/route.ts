import { NextResponse } from 'next/server';
import { DataGolfAPI } from '@/lib/datagolf';
import { uploadData, getData } from '@/lib/b2';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getGptPuttingStats(playerNames: string[]) {
  try {
    const prompt = `
You are a PGA DFS Golf expert. 
For each of the following golfers, provide a qualitative historical skill rating from 1-100 on:
- putt_bermuda (Putting on Bermuda grass)
- putt_bentgrass (Putting on Bentgrass)
- putt_poa (Putting on Poa annua grass)
- wind (High Wind Conditions)

Return ONLY a raw JSON object where the keys are the EXACT player names provided, and the values are the rating objects.
Example:
{
  "Scheffler, Scottie": { "putt_bermuda": 95, "putt_bentgrass": 92, "putt_poa": 88, "wind": 90 }
}

Golfers to rate:
${playerNames.join(', ')}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (err) {
    console.error('GPT Player Stats Error:', err);
    return {}; 
  }
}

function calculateRollingAverages(rounds: any[], count: number) {
  if (rounds.length === 0) return { sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgT2G: 0, sgTotal: 0, bob: 0, ba: 0 };
  
  const targetRounds = rounds.slice(0, count);
  const sums = targetRounds.reduce((acc, r) => {
    acc.sgOTT += Number(r.sg_ott || 0);
    acc.sgAPP += Number(r.sg_app || 0);
    acc.sgARG += Number(r.sg_arg || 0);
    acc.sgPUTT += Number(r.sg_putt || 0);
    acc.sgT2G += Number(r.sg_t2g || 0);
    acc.sgTotal += Number(r.sg_total || 0);
    
    // Birdies or Better (BOB) = birdies + eagles
    acc.bob += (Number(r.birdies || 0) + Number(r.eagles_or_better || 0));
    
    // Bogey Avoidance (BA) = bogies + doubles
    acc.ba += (Number(r.bogies || 0) + Number(r.doubles_or_worse || 0));
    
    return acc;
  }, { sgOTT: 0, sgAPP: 0, sgARG: 0, sgPUTT: 0, sgT2G: 0, sgTotal: 0, bob: 0, ba: 0 });

  const len = targetRounds.length;
  return {
    sgOTT: sums.sgOTT / len,
    sgAPP: sums.sgAPP / len,
    sgARG: sums.sgARG / len,
    sgPUTT: sums.sgPUTT / len,
    sgT2G: sums.sgT2G / len,
    sgTotal: sums.sgTotal / len,
    bob: sums.bob / len,
    ba: sums.ba / len
  };
}

export async function GET() {
  try {
    const dg = new DataGolfAPI();
    
    // 1. Fetch DraftKings Projections
    console.log('Fetching DataGolf fantasy projections...');
    const projData = await dg.getFantasyProjections('pga', 'draftkings', 'main');
    
    let projectionsArray = [];
    if (projData.projections && Array.isArray(projData.projections)) {
      projectionsArray = projData.projections;
    } else if (Array.isArray(projData)) {
      projectionsArray = projData;
    }

    // 2. Load Raw Rounds from B2
    console.log('Fetching Raw Rounds from Backblaze...');
    const [r2024, r2025, r2026] = await Promise.all([
      getData('raw_rounds_2024.json').catch(() => []),
      getData('raw_rounds_2025.json').catch(() => []),
      getData('raw_rounds_2026.json').catch(() => [])
    ]);

    const allRounds = [...(Array.isArray(r2024) ? r2024 : []), ...(Array.isArray(r2025) ? r2025 : []), ...(Array.isArray(r2026) ? r2026 : [])];
    
    const roundsByPlayer = new Map();
    allRounds.forEach(r => {
      const id = String(r.dg_id);
      if (!roundsByPlayer.has(id)) roundsByPlayer.set(id, []);
      roundsByPlayer.get(id).push(r);
    });

    roundsByPlayer.forEach(rounds => {
      rounds.sort((a: any, b: any) => new Date(b.date || b.start_date || 0).getTime() - new Date(a.date || a.start_date || 0).getTime());
    });

    // 3. Ask GPT to formulate qualitative stats
    console.log('Fetching GPT formulations for grass/wind...');
    const playerNames = projectionsArray.map((p: any) => p.player_name).filter(Boolean);
    const gptStats = await getGptPuttingStats(playerNames);

    // 4. Merge all data
    const mergedData = projectionsArray.map((proj: any) => {
      const gpt = gptStats[proj.player_name] || { putt_bermuda: 50, putt_bentgrass: 50, putt_poa: 50, wind: 50 };
      const pRounds = roundsByPlayer.get(String(proj.dg_id)) || [];
      
      const stats16 = calculateRollingAverages(pRounds, 16);
      const stats32 = calculateRollingAverages(pRounds, 32);
      const stats64 = calculateRollingAverages(pRounds, 64);
      
      return {
        ...proj,
        stats16,
        stats32,
        stats64,
        putt_bermuda: gpt.putt_bermuda || 50,
        putt_bentgrass: gpt.putt_bentgrass || 50,
        putt_poa: gpt.putt_poa || 50,
        wind: gpt.wind || 50
      };
    });

    console.log(`Uploading ${mergedData.length} enriched players to Backblaze B2...`);
    await uploadData('latest_merged_data.json', mergedData);
    
    return NextResponse.json({ success: true, count: mergedData.length, message: 'Data synced successfully' });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
