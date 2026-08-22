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
Your job is to take the supplied CSV data and produce a PLAYER SCORE and VALUE SCORE (not needed, we calculate value downstream) for every player.

## CRITICAL RULE
The supplied datasets have already been weighted by the Brodd system.
Do NOT create your own weights. Do NOT re-weight the datasets.
Your job is to interpret the evidence contained in the datasets and translate it into a consistent player score.

# 1. PLAYER SCORE (0-100)
Represents the player's overall DFS attractiveness based solely on the supplied Brodd data.
100 = elite, 90-99 = exceptional, 80-89 = strong, 70-79 = above avg, 60-69 = playable, 50-59 = marginal, Below 50 = weak.
The score should represent the quality of the player according to the data, NOT salary value. 
Never allow salary to artificially inflate the Player Score. Keep those concepts separate.

# 2. HOW TO INTERPRET MULTIPLE DATASETS
Look for agreement across the datasets. A player becomes more trustworthy when multiple datasets independently support him.
Improvement over time should increase confidence. Decline should reduce confidence.

# 3. BALL STRIKING VS PUTTING
Place particular analytical emphasis on Ball Striking (SG:T2G, SG:APP, SG:OTT). Ball striking should generally carry more interpretive importance than putting when evaluating whether performance is sustainable.
Putting is volatile. Strong ball striking + weak putting = hidden upside. Weak ball striking + strong putting = regression risk.

# 4. MISPRICING
Identify players where Player Score is substantially stronger than their salary would suggest.
Create a MISPRICING FLAG: ELITE, STRONG, MODERATE, NONE, OVERPRICED.

# 5. CONFIDENCE (0-100)
Provide a CONFIDENCE SCORE (0-100).
Player Score answers: How good is the player?
Confidence answers: How strongly do the datasets agree with that conclusion?

Data Weights to consider for player quality:
`;

    configurations.forEach((c: any) => {
      prompt += `- ${c.rounds} Rounds History, Weight: ${c.weight}%
`;
    });

    prompt += `
Output your predictions strictly as a JSON object where the keys are the exact player names provided, and the values are objects containing "score", "confidence", "mispricing", and "reason".
Do not include any other text, markdown formatting, or explanations. Just the JSON object.
Example:
{
  "Scottie Scheffler": {
    "score": 96.5,
    "confidence": 94.0,
    "mispricing": "MODERATE",
    "reason": "Elite ball striking across all timeframes."
  },
  "Rory McIlroy": {
    "score": 92.1,
    "confidence": 88.5,
    "mispricing": "NONE",
    "reason": "Strong data but perfectly priced."
  }
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
