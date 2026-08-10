import { NextResponse } from 'next/server';
import { DataGolfAPI } from '@/lib/datagolf';
import { uploadData } from '@/lib/b2';

export async function GET() {
  try {
    const dg = new DataGolfAPI();
    
    // 1. Fetch DraftKings Projections
    console.log('Fetching DataGolf fantasy projections...');
    const projData = await dg.getFantasyProjections('pga', 'draftkings', 'main');
    
    // 2. Fetch Player Skill (Strokes Gained)
    console.log('Fetching DataGolf player skill...');
    const skillData = await dg.getPlayerSkill('value');
    
    // Create a fast lookup map for skill stats by dg_id
    const skillMap = new Map();
    if (skillData.players && Array.isArray(skillData.players)) {
      skillData.players.forEach((p: any) => {
        skillMap.set(p.dg_id, p);
      });
    }

    // Merge skills into the projections array
    let projectionsArray = [];
    if (projData.projections && Array.isArray(projData.projections)) {
      projectionsArray = projData.projections;
    } else if (Array.isArray(projData)) {
      projectionsArray = projData;
    }

    const mergedData = projectionsArray.map((proj: any) => {
      const skills = skillMap.get(proj.dg_id) || {};
      return {
        ...proj,
        // Append SG metrics from the skill endpoint
        sg_ott: skills.sg_ott || 0,
        sg_app: skills.sg_app || 0,
        sg_arg: skills.sg_arg || 0,
        sg_putt: skills.sg_putt || 0,
        driving_dist: skills.driving_dist || 0,
        driving_acc: skills.driving_acc || 0
      };
    });

    // Store the merged result in Backblaze B2
    console.log(`Uploading ${mergedData.length} merged players to Backblaze B2...`);
    await uploadData('latest_merged_data.json', mergedData);
    
    return NextResponse.json({ success: true, count: mergedData.length, message: 'Data synced successfully' });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
