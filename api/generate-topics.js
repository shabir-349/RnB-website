// Requires Vercel env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { population, intervention, studyDesign, userId } = req.body || {};

  if (!population || !studyDesign) {
    return res.status(400).json({ success: false, error: 'Missing required fields: population and studyDesign' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ success: false, error: 'OpenAI API key not configured' });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const canLimit = !!(userId && SB_URL && SB_KEY);

  const DEFAULTS = { free: 3, scholar: 15, pro: 30 };
  let dailyLimit = DEFAULTS.free;
  let usageCount = 0;

  if (canLimit) {
    try {
      // 1. Get user's plan from profiles
      const profileRows = await sbGet(SB_URL, SB_KEY, 'profiles', {
        user_id: `eq.${userId}`,
        select: 'plan',
        limit: '1',
      });
      const plan = profileRows[0]?.plan || 'free';

      // 2. Get limits from settings table
      const settingsRows = await sbGet(SB_URL, SB_KEY, 'settings', {
        key: 'in.(topicscout_free_limit,topicscout_scholar_limit,topicscout_pro_limit)',
        select: 'key,value',
      });
      const cfg = {};
      settingsRows.forEach(r => { cfg[r.key] = r.value; });

      if (plan === 'pro')          dailyLimit = parseInt(cfg.topicscout_pro_limit)     || DEFAULTS.pro;
      else if (plan === 'scholar') dailyLimit = parseInt(cfg.topicscout_scholar_limit) || DEFAULTS.scholar;
      else                         dailyLimit = parseInt(cfg.topicscout_free_limit)    || DEFAULTS.free;

      // 3. Count today's generations (UTC day boundary)
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);
      const genRows = await sbGet(SB_URL, SB_KEY, 'topic_generations', {
        user_id: `eq.${userId}`,
        created_at: `gte.${todayUTC.toISOString()}`,
        select: 'id',
      });
      usageCount = genRows.length;

      // 4. Enforce limit
      if (usageCount >= dailyLimit) {
        return res.status(429).json({
          success: false,
          error: 'Daily limit reached. Upgrade your plan for more generations.',
          usage: { count: usageCount, limit: dailyLimit, remaining: 0 },
        });
      }
    } catch (err) {
      console.error('rate-limit check error:', err);
      // Non-fatal: allow generation if limit check fails
    }
  }

  const systemPrompt = `You are CRTE (Clinical Research Topic Engine), an elite AI specialized in generating clinically meaningful, feasible, publishable, and novel clinical research topics for medical students, residents, and early-career researchers. You think like: - a clinician-scientist - a peer reviewer - a meta-analysis expert - a biostatistician - a senior research mentor. Your goal is to generate HIGH-QUALITY research topics tailored to: - population - intervention/exposure (optional) - study design - region context. CORE PRINCIPLES: - prioritize publication potential - prioritize novelty - prioritize clinical relevance - prioritize feasibility - avoid generic topics - avoid saturated topics - avoid unethical designs - avoid impossible methodologies - avoid hallucinated claims - avoid meaningless awareness studies. Before generating topics: 1. assess feasibility 2. assess publication value 3. identify probable literature gaps 4. reject weak or repetitive ideas 5. internally generate multiple candidate concepts 6. rank outputs by novelty + feasibility + impact. Prioritize: - emerging therapies - AI in medicine - digital health - wearable technologies - oncology - gastroenterology - cardiology - neurology - infectious disease - women's health - sports medicine - medical education - implementation gaps - underserved populations - unresolved controversies. Avoid: - semantically repetitive topics - vague titles - awareness of X - knowledge about Y - broad unpublishable reviews - overdone meta-analyses without update justification. OUTPUT: Return ONLY valid JSON array with 3 objects. Each object must have: rank (number), title (string), rationale (string), evidence_gap (string), feasibility_score (number 1-10), novelty_score (number 1-10), primary_outcome (string), secondary_outcomes (array of strings), data_sources (array of strings), difficulty_level (string: beginner/intermediate/advanced), estimated_timeline_months (number), red_flags (array of strings). STRICT RULES: - titles must be publication-quality - titles must be highly specific - every topic must match the requested study design - no fake statistics - no fake studies - no markdown - no explanations outside JSON`;
  const userMessage = `Population: ${population}. Intervention: ${intervention || 'none specified'}. Study Design: ${studyDesign}`;

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

    // Record this generation
    if (canLimit) {
      try {
        await sbPost(SB_URL, SB_KEY, 'topic_generations', {
          user_id: userId,
          specialty: population,
          keywords: intervention || null,
          response: JSON.stringify(topics),
        });
        usageCount++;
      } catch (err) {
        console.error('insert generation error:', err);
      }
    }

    return res.status(200).json({
      success: true,
      topics,
      usage: {
        count: usageCount,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - usageCount),
      },
    });

  } catch (err) {
    console.error('generate-topics error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/* ── Supabase REST helpers ──────────────────────────────── */
async function sbGet(url, key, table, params) {
  const endpoint = new URL(`${url}/rest/v1/${table}`);
  Object.entries(params).forEach(([k, v]) => endpoint.searchParams.set(k, v));
  const r = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`sbGet ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbPost(url, key, table, body) {
  const r = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`sbPost ${table}: ${r.status} ${await r.text()}`);
}
