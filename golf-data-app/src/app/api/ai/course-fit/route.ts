import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      
      Strokes Gained:
      - sgOTT
      - sgAPP
      - sgARG
      - sgPUTT
      - sgT2G
      - sgTotal
      
      Scoring:
      - round_score (Lower is better)
      - eagles_or_better
      - birdies
      - pars
      - bogies (Lower is better)
      - doubles_or_worse (Lower is better)
      - bob (Birdies or Better)
      - ba (Bogey Avoidance, Lower is better)
      
      Ball Striking:
      - driving_dist
      - driving_acc
      - gir
      - scrambling
      - prox_fw (Lower is better)
      - prox_rgh (Lower is better)
      - great_shots
      - poor_shots (Lower is better)
      
      Course/Conditions:
      - putt_bermuda
      - putt_bentgrass
      - putt_poa
      - wind
      
      Return ONLY a raw JSON object with two keys:
      1. "reasoning": A 1-2 sentence string explaining why you chose these weights.
      2. "weights": An object with the EXACT stat keys above and integer percentage values (0-100) that sum to exactly 100.
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
