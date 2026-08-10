import { NextResponse } from 'next/server';
import { DataGolfAPI } from '@/lib/datagolf';
import { uploadData } from '@/lib/b2';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getGptPlayerStats(playerNames: string[]) {
  try {
    const prompt = `
You are a PGA DFS Golf expert. 
For each of the following golfers, provide a historical skill rating from 1-100 on:
- bermuda (Bermuda grass)
- bentgrass (Bentgrass)
- poa (Poa annua grass)
- wind (High Wind Conditions)

Return ONLY a raw JSON object where the keys are the EXACT player names provided, and the values are the rating objects.
Example:
{
  "Scheffler, Scottie": { "bermuda": 95, "bentgrass": 92, "poa": 88, "wind": 90 }
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
    return {}; // fallback
  }
}

export async function GET() {
  try {
    const dg = new DataGolfAPI();
    
    // 1. Fetch DraftKings Projections
    console.log('Fetching DataGolf fantasy projections...');
    const projData = await dg.getFantasyProjections('pga', 'draftkings', 'main');
    
    // 2. Fetch Player Skill (Strokes Gained)
    console.log('Fetching DataGolf player skill...');
    const skillData = await dg.getPlayerSkill('value');
    
    const skillMap = new Map();
    if (skillData.players && Array.isArray(skillData.players)) {
      skillData.players.forEach((p: any) => skillMap.set(p.dg_id, p));
    }

    let projectionsArray = [];
    if (projData.projections && Array.isArray(projData.projections)) {
      projectionsArray = projData.projections;
    } else if (Array.isArray(projData)) {
      projectionsArray = projData;
    }

    // 3. Ask GPT to formulate stats for all players
    console.log('Fetching GPT formulations for grass/wind...');
    const playerNames = projectionsArray.map((p: any) => p.player_name).filter(Boolean);
    
    // We can chunk this if it's too big, but GPT-4o-mini has a 16k output limit which is huge.
    // 150 players * 40 tokens per player = 6000 tokens (well within limits).
    const gptStats = await getGptPlayerStats(playerNames);

    // 4. Merge all data
    const mergedData = projectionsArray.map((proj: any) => {
      const skills = skillMap.get(proj.dg_id) || {};
      const gpt = gptStats[proj.player_name] || { bermuda: 50, bentgrass: 50, poa: 50, wind: 50 };
      
      const sg_ott = skills.sg_ott || 0;
      const sg_app = skills.sg_app || 0;
      const sg_arg = skills.sg_arg || 0;
      const sg_putt = skills.sg_putt || 0;
      
      return {
        ...proj,
        sg_ott,
        sg_app,
        sg_arg,
        sg_putt,
        sg_t2g: sg_ott + sg_app + sg_arg,
        sg_total: sg_ott + sg_app + sg_arg + sg_putt,
        driving_dist: skills.driving_dist || 0,
        driving_acc: skills.driving_acc || 0,
        bermuda: gpt.bermuda || 50,
        bentgrass: gpt.bentgrass || 50,
        poa: gpt.poa || 50,
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
