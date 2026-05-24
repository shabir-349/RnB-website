export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { specialty, keywords, userId } = req.body || {};

  if (!specialty) {
    return res.status(400).json({ success: false, error: 'Missing required field: specialty' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ success: false, error: 'OpenAI API key not configured' });
  }

  const systemPrompt = `You are a medical research topic advisor. Given a specialty and optional keywords, generate exactly 3 novel, specific research topic suggestions. Each topic must include: title (specific and detailed, not generic), study_design (cross-sectional, cohort, case-control, RCT, systematic review, or meta-analysis), rationale (one sentence on why this matters and what gap it fills), and feasibility (one sentence on how a medical student could conduct this). Avoid generic topics like 'prevalence of diabetes' or 'effects of smoking'. Focus on underexplored angles, emerging trends, and novel combinations. Return ONLY valid JSON array with 3 objects, no markdown, no extra text.`;

  const userMessage = `Specialty: ${specialty}. Additional interests: ${keywords || 'none'}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.4-nano',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', err);
      return res.status(502).json({ success: false, error: 'Failed to get response from AI service' });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;

    if (!raw) {
      return res.status(502).json({ success: false, error: 'Empty response from AI service' });
    }

    let topics;
    try {
      topics = JSON.parse(raw);
    } catch {
      console.error('JSON parse error. Raw response:', raw);
      return res.status(502).json({ success: false, error: 'AI returned invalid JSON' });
    }

    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(502).json({ success: false, error: 'AI returned unexpected format' });
    }

    return res.status(200).json({ success: true, topics });
  } catch (err) {
    console.error('generate-topics error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
