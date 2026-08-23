import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { model, configurations, fieldData, optimizerSettings } = await request.json();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OPENAI_API_KEY is not configured on the server.' }, { status: 400 });
    }

    let prompt = `You are an expert PGA DFS Lineup Optimizer.
I am providing you with enriched statistical data and salaries for the field of an upcoming golf tournament.
The players have already been rigorously analyzed by our internal scoring engine. The most important metric is "final_ranking", which represents their overall DFS value from 1 to 100 based on their stats, salary, wind, teetimes, and user adjustments.
You must analyze this data and generate exactly ${optimizerSettings.numLineups} DraftKings lineups.

Rules for DraftKings Golf Lineups:
1. Exactly 6 players per lineup.
2. Total salary of the 6 players must be <= ${optimizerSettings.maxSalary} and >= ${optimizerSettings.minSalary}.
3. No duplicate players in the same lineup.
4. Maximize the combined "final_ranking" of the lineups you build.
5. Adhere to a max exposure of ${optimizerSettings.maxExposure}% for any single player across all lineups if possible.

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

    let userData = "Data:\n";
    
    fieldData.forEach((p: any) => {
      userData += `${p.name} (Sal:$${p.salary}, FinalRank:${p.final_ranking}, Value:${p.value_score}, Score:${p.gpt_score}, Wind:${p.wind}, TT:${p.teetime})
`;
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-5.6-sol',
        reasoning_effort: "high",
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
