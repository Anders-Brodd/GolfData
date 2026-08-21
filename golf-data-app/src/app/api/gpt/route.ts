import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { model, configurations, fieldData } = await request.json();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OPENAI_API_KEY is not configured on the server.' }, { status: 400 });
    }

    let prompt = `You are an expert PGA DFS analyst and data scientist.
I am providing you with statistical data for the field of an upcoming golf tournament.
You must analyze this data and predict the exact DraftKings Fantasy Points each player will score.
You are given data for different round histories.
Please apply the following weights to your analysis:\n`;

    configurations.forEach((c: any) => {
      prompt += `- ${c.rounds} Rounds History, Weight: ${c.weight}%\n`;
    });

    prompt += `\nOutput your predictions strictly as a JSON object where the keys are the exact player names provided, and the values are the predicted DraftKings points (as numbers).
Do not include any other text, markdown formatting, or explanations. Just the JSON object.
Example:
{
  "Scottie Scheffler": 95.5,
  "Rory McIlroy": 92.1
}`;

    const shortKeys: Record<string, string> = {
      'sgOTT': 'ott', 'sgAPP': 'app', 'sgARG': 'arg', 'sgPUTT': 'putt', 'sgT2G': 't2g', 'sgBS': 'bs', 'sgTotal': 'tot',
      'eob': 'eob', 'bob': 'bob', 'pob': 'pob', 'ba': 'ba', 'driving_dist': 'dd', 'driving_acc': 'da', 'gir': 'gir', 'scrambling': 'scrm', 'prox_fw': 'pxf'
    };

    let userData = "Data:\n";
    
    fieldData.forEach((p: any) => {
      userData += `${p.name}: `;
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
        model: model || 'gpt-4o-mini',
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
