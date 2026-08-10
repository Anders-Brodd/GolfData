import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { tournament, userNotes, gptModel } = await req.json();
    const selectedModel = gptModel || 'gpt-4o-mini';

    const prompt = `
      You are an expert DFS Golf modeler.
      Analyze the course for the upcoming PGA Tour event: ${tournament}.
      
      The user has provided the following custom notes/requests:
      "${userNotes || 'None'}"

      Based on historical data for this course AND the user's custom notes, determine the optimal weighting (adding up to 100%) for the following key stats to predict a winner:
      - sgOTT (Strokes Gained: Off the Tee)
      - sgAPP (Strokes Gained: Approach)
      - sgARG (Strokes Gained: Around the Green)
      - sgPUTT (Strokes Gained: Putting)
      - sgT2G (Strokes Gained: Tee to Green)
      - sgTotal (Strokes Gained: Total)
      - putt_bermuda (Putting on Bermuda grass)
      - putt_bentgrass (Putting on Bentgrass)
      - putt_poa (Putting on Poa annua)
      - wind (High wind skill)
      
      Return ONLY a raw JSON object with two keys:
      1. "reasoning": A 1-2 sentence string explaining why you chose these weights, explicitly mentioning how you incorporated the user's custom notes.
      2. "weights": An object with the above stat keys and integer percentage values (0-100) that sum to exactly 100.
      
      Example format:
      {
        "reasoning": "Since the rough is thick as requested, I heavily weighted accuracy and sgAPP. The course is Bermuda, so putt_bermuda gets 15%.",
        "weights": {
          "sgOTT": 10,
          "sgAPP": 20,
          "sgARG": 5,
          "sgPUTT": 10,
          "sgT2G": 10,
          "sgTotal": 5,
          "putt_bermuda": 15,
          "putt_bentgrass": 0,
          "putt_poa": 0,
          "wind": 5
        }
      }
    `;

    const response = await openai.chat.completions.create({
      model: selectedModel,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const aiResult = JSON.parse(response.choices[0].message.content || '{}');
    return NextResponse.json({ success: true, weights: aiResult.weights || {}, reasoning: aiResult.reasoning || '' });
  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
