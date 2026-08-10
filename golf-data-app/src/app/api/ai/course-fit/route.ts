import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { tournament } = await req.json();

    const prompt = `
      You are an expert DFS Golf modeler.
      Analyze the course for the upcoming PGA Tour event: ${tournament}.
      
      Based on historical data for this course, determine the optimal weighting (adding up to 100%) for the following key stats to predict a winner:
      - sgOTT (Strokes Gained: Off the Tee)
      - sgAPP (Strokes Gained: Approach)
      - sgARG (Strokes Gained: Around the Green)
      - sgPUTT (Strokes Gained: Putting)
      - sgT2G (Strokes Gained: Tee to Green)
      - sgTotal (Strokes Gained: Total)
      - distance (Driving Distance)
      - accuracy (Driving Accuracy)
      - bermuda (Bermuda grass skill)
      - bentgrass (Bentgrass skill)
      - poa (Poa annua skill)
      - wind (High wind skill)
      
      Return ONLY a raw JSON object with these keys and integer percentage values (0-100) that sum to exactly 100.
      For example, if the course is heavily Bermuda grass, you should give 'bermuda' a higher percentage, and 0 to bentgrass and poa.
      
      Example format:
      {
        "sgOTT": 10,
        "sgAPP": 20,
        "sgARG": 5,
        "sgPUTT": 10,
        "sgT2G": 10,
        "sgTotal": 5,
        "distance": 10,
        "accuracy": 10,
        "bermuda": 15,
        "bentgrass": 0,
        "poa": 0,
        "wind": 5
      }
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const aiResult = JSON.parse(response.choices[0].message.content || '{}');
    return NextResponse.json({ success: true, weights: aiResult });
  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
