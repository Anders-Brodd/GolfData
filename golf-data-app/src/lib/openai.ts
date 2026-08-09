import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const determineCourseStats = async (courseData: any, model = 'gpt-4o-mini') => {
  const prompt = `
    Based on the following historical course data and past winners:
    ${JSON.stringify(courseData)}
    
    Determine the top 10 most important stats to predict a winner at this course.
    Consider metrics like SG: Off the Tee, SG: Approach, Driving Distance, Driving Accuracy, etc.
    Return ONLY a JSON array of strings representing these 10 stats.
  `;

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });

  return response.choices[0].message.content;
};

export const generateLineups = async (playerData: any, courseStats: string[], model = 'gpt-4o-mini') => {
  const prompt = `
    You are an expert DraftKings golf optimizer.
    The key stats for this course are: ${courseStats.join(', ')}
    
    Here is the player data with salaries, projections, and recent SG data:
    ${JSON.stringify(playerData)}
    
    Find the most optimal DraftKings lineups (6 golfers per lineup, max salary $50,000) combining math and your expert intuition on course fit.
    Return a JSON array of lineups, each containing the player names and total projected points.
  `;

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0].message.content;
};
