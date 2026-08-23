import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { model, configurations, fieldData } = await request.json();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OPENAI_API_KEY is not configured on the server.' }, { status: 400 });
    }

    let prompt = `You are the Brodd DFS Golf Player Scoring Engine.
Your job is NOT to build DraftKings lineups.

## CRITICAL RULE
The supplied datasets have already been strictly weighted by the user based on internal metrics AND by the timeframes they selected. The data provided in "Combined_Final_Stats" is the mathematically perfect weighted representation of the player.
Your job is to interpret this evidence and translate it into consistent scores.

# 1. PLAYER SCORE (1-100)
Represents the player's overall quality based strictly on their Combined_Final_Stats.
100 = elite, 90-99 = exceptional, 80-89 = strong, 70-79 = above avg, 60-69 = playable, 50-59 = marginal, Below 50 = weak.
Keep salary out of the Player Score.

# 2. VALUE SCORE (1-100)
Calculate the player's value relative to their salary. A score of 100 means they are extremely underpriced for their skill. A score of 1 means they are vastly overpriced.

# 3. FINAL RANKING (1-100)
Produce a Final Ranking from 1 to 100 based heavily on the Player Score and Value, but ALSO adjust it based on their Wind, Tee Time, and user Bump.
- Wind: Higher wind = penalty.
- Bump: A positive bump should increase their final ranking.

# 4. CONFIDENCE & MISPRICING
- CONFIDENCE (1-100): How strongly the individual timeframe datasets agree.
- MISPRICING (1-100): 1 being extremely overpriced, 100 being extremely underpriced.

Output your predictions strictly as a JSON object where the keys are the exact player names provided, and the values are objects containing "score", "value", "final_ranking", "confidence", "mispricing", and "reason".
Example:
{
  "Scottie Scheffler": {
    "score": 96.5,
    "value": 85.0,
    "final_ranking": 97.2,
    "confidence": 94.0,
    "mispricing": 65.0,
    "reason": "Elite ball striking and strong value despite high salary."
  }
}`;

    const shortKeys: Record<string, string> = {
      'sgOTT': 'ott', 'sgAPP': 'app', 'sgARG': 'arg', 'sgPUTT': 'putt', 'sgT2G': 't2g', 'sgBS': 'bs', 'sgTotal': 'tot',
      'eob': 'eob', 'bob': 'bob', 'pob': 'pob', 'ba': 'ba', 'driving_dist': 'dd', 'driving_acc': 'da', 'gir': 'gir', 'scrambling': 'scrm', 'prox_fw': 'pxf'
    };

    let userData = "Data:\n";
    
    fieldData.forEach((p: any) => {
      userData += `${p.name} (Sal:$${p.salary}, Wind:${p.wind}, Bump:${p.bump}): `;
      const datasets: string[] = [];
      
      const combined = p.Combined_Final_Stats || {};
      const combStr = Object.entries(combined)
           .map(([k, v]) => `${shortKeys[k] || k}:${Number(v).toFixed(1)}`)
           .join(',');
      if (combStr) datasets.push(`COMBINED(${combStr})`);
      
      configurations.forEach((c: any, i: number) => {
        const stats = p[`Dataset${i+1}_${c.rounds}R`] || {};
        const statStr = Object.entries(stats)
           .map(([k, v]) => `${shortKeys[k] || k}:${Number(v).toFixed(1)}`)
           .join(',');
        if (statStr) datasets.push(`${c.rounds}R(${statStr})`);
      });
      userData += datasets.join(' | ') + '\n';
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-5.6-sol',
        reasoning_effort: "low",
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userData }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI Error:", err);
      // Return a structured error response that can be read by the client
      return NextResponse.json({ success: false, error: err }, { status: 500 });
    }

    const data = await response.json();
    let predictions = {};
    try {
      predictions = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error("Failed to parse OpenAI JSON output:", data.choices[0].message.content);
      return NextResponse.json({ success: false, error: 'OpenAI returned invalid JSON' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      predictions,
      usage: data.usage
    });

  } catch (error: any) {
    console.error('Error calling GPT:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
