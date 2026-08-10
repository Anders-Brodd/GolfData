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

export async function GET() {
  try {
    const dg = new DataGolfAPI();
    
    console.log('Fetching DataGolf fantasy projections...');
    const projData = await dg.getFantasyProjections('pga', 'draftkings', 'main');
    
    let projectionsArray = [];
    if (projData.projections && Array.isArray(projData.projections)) {
      projectionsArray = projData.projections;
    } else if (Array.isArray(projData)) {
      projectionsArray = projData;
    }

    console.log('Fetching Pre-Calculated Stats from Backblaze...');
    const calculatedStats = await getData('calculated_stats.json').catch(() => ({}));

    console.log('Fetching GPT formulations for grass/wind...');
    const playerNames = projectionsArray.map((p: any) => p.player_name).filter(Boolean);
    const gptStats = await getGptPuttingStats(playerNames);

    const mergedData = projectionsArray.map((proj: any) => {
      const gpt = gptStats[proj.player_name] || { putt_bermuda: 50, putt_bentgrass: 50, putt_poa: 50, wind: 50 };
      const pStats = calculatedStats[String(proj.dg_id)] || {
        stats16: null,
        stats32: null,
        stats64: null
      };
      
      return {
        ...proj,
        stats16: pStats.stats16,
        stats32: pStats.stats32,
        stats64: pStats.stats64,
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
