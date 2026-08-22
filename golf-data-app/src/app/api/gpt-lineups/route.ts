import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { model, configurations, fieldData, optimizerSettings } = await request.json();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OPENAI_API_KEY is not configured on the server.' }, { status: 400 });
    }

    let prompt = `You are an expert PGA DFS Lineup Optimizer.
I am providing you with statistical data and salaries for the field of an upcoming golf tournament.
You must analyze this data and generate exactly ${optimizerSettings.numLineups} DraftKings lineups.
Rules for DraftKings Golf Lineups:
1. Exactly 6 players per lineup.
2. Total salary of the 6 players must be <= ${optimizerSettings.maxSalary} and >= ${optimizerSettings.minSalary}.
3. No duplicate players in the same lineup.
4. Try to adhere to a max exposure of ${optimizerSettings.maxExposure}% for any single player across all lineups if possible.

Data Weights to consider for player quality:
`;

    configurations.forEach((c: any) => {
      prompt += `- ${c.rounds} Rounds History, Weight: ${c.weight}%
`;
    });

    prompt += `
Output your lineups strictly as a JSON object with a "lineups" key containing an array of lineup objects. Each lineup object should have an "id" and a "players" array containing exactly 6 player names.
Do not include any other text, markdown formatting, or explanations. Just the JSON object.
Example:
{
  "lineups": [
    {
      "id": 1,
      "players": ["Scottie Scheffler", "Rory McIlroy", "Xander Schauffele", "Viktor Hovland", "Collin Morikawa", "Max Homa"]
    }
  ]
}`;

    const shortKeys: Record<string, string> = {
      'sgOTT': 'ott', 'sgAPP': 'app', 'sgARG': 'arg', 'sgPUTT': 'putt', 'sgT2G': 't2g', 'sgBS': 'bs', 'sgTotal': 'tot',
      'eob': 'eob', 'bob': 'bob', 'pob': 'pob', 'ba': 'ba', 'driving_dist': 'dd', 'driving_acc': 'da', 'gir': 'gir', 'scrambling': 'scrm', 'prox_fw': 'pxf'
    };

    let userData = "Data:\n";
    
    fieldData.forEach((p: any) => {
      userData += `${p.name} ($${p.salary}): `;
      const datasets: string[] = [];
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
        model: model || 'gpt-4o',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userData }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ success: false, error: err }, { status: 500 });
    }

    const data = await response.json();
    let result = { lineups: [] };
    try {
      result = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      return NextResponse.json({ success: false, error: 'OpenAI returned invalid JSON' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lineups: result.lineups,
      usage: data.usage
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
