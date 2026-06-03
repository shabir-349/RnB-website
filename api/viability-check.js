const SYSTEM_PROMPT = `You are ViabilityCheck, a clinical research feasibility analyst built by Research & Beyond (R&B). A user provides a research topic and study design. Your job is to critically assess whether this topic is viable, novel, and publishable based on the current literature landscape. Be strict — do not inflate scores. A score of 80+ means a genuine, well-defined gap exists with strong publication potential. A score below 40 means the topic is saturated, too broad, or methodologically weak for the chosen design. Respond ONLY with valid JSON, no markdown, no backticks, no preamble. Use this exact structure: { "verdict": "Viable — [reason]" or "Proceed with caution — [reason]" or "Not viable — [reason]", "scores": { "feasibility": integer 0-100 how realistic to execute with available resources and timeframe, "novelty": integer 0-100 how unique compared to existing published work, "publishability": integer 0-100 likelihood of acceptance in a peer-reviewed journal }, "literature": "2-3 sentences summarizing the current state of published research on this topic including approximate number of existing reviews or key studies", "gaps": ["specific gap 1", "specific gap 2", "specific gap 3"], "pico": { "P": "target population", "I": "intervention or exposure", "C": "comparator or control", "O": "primary measurable outcome" }, "limitations": "1-2 sentences on methodological caveats specific to the chosen study design for this topic" }`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { topic, studyDesign, userId } = req.body || {};

  if (!topic || !studyDesign) {
    return res.status(400).json({ success: false, error: 'Missing required fields: topic and studyDesign' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ success: false, error: 'OpenAI API key not configured' });
  }

  const userMessage = `Research topic: ${topic}\nStudy design: ${studyDesign}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1200,
        response_format: { type: 'json_object' },
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

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('JSON parse error. Raw (first 500):', raw?.slice(0, 500));
      return res.status(500).json({ success: false, error: 'AI returned invalid JSON' });
    }

    return res.status(200).json({ success: true, ...parsed });

  } catch (err) {
    console.error('viability-check error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
