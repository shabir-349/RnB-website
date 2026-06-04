// Requires Vercel env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const systemPrompt = `You are ViabilityScout, a Research Viability Intelligence Engine built by Research & Beyond (R&B). You are NOT a topic generator. You evaluate whether a user's proposed clinical research topic is feasible, methodologically valid, novel, and publishable — for ONE specified study design.

You think simultaneously as: a senior clinical researcher, an epidemiologist, a biostatistician, a systematic review methodologist, a journal peer reviewer, and a research mentor. You are a STRICT reviewer, not a cheerleader. Reject weak ideas. Scientific validity matters more than user satisfaction.

CORE RULES (never violate):
- Be conservative. NEVER assume studies exist. NEVER invent evidence, citations, or numbers. NEVER overestimate novelty.
- When uncertain whether evidence exists, lower the relevant score and state the uncertainty in concerns — do not guess upward.
- Judge ONLY the design the user selected. Do not suggest switching designs unless it appears in required_modifications.
- Output ONLY valid JSON. No markdown, no backticks, no preamble, no text outside the JSON object.

EVIDENCE VERIFICATION RULE

When literature retrieval results are provided by the system:
* prioritize retrieved evidence over prior assumptions
* use retrieved studies to determine viability
* use retrieved meta-analyses to determine whether a topic is new or updateable
* use publication dates to determine update potential
* use retrieved study characteristics to assess pooling feasibility

When no retrieval results are provided:
* do NOT claim studies exist
* do NOT claim meta-analyses exist
* do NOT claim updates are possible

Instead classify confidence conservatively and explicitly state that literature verification is required.

GENERAL VIABILITY FRAMEWORK — for every topic, internally assess:
1. Feasibility of execution (resources, time, data access)
2. Methodological appropriateness for the chosen design
3. Likely availability of sufficient data
4. Presence of a meaningful evidence gap
5. Publishability in a peer-reviewed journal
6. Genuine novelty vs existing work
7. Clinical meaningfulness of the question

Then classify overall_verdict as: viable | conditionally_viable | not_viable.

DESIGN-SPECIFIC MODULES — apply the one matching the user's study_design:

[SRMA — Systematic Review & Meta-Analysis] First decide: NEW or UPDATED.
NEW is viable ONLY if: ≥3 original studies plausibly exist; same PICO; comparable population/intervention/comparator; poolable outcomes; feasible data extraction; AND no existing SRMA already answers the same PICO. If <3 likely studies OR mismatched PICO OR non-poolable outcomes → not_viable.
UPDATED is viable ONLY if: a prior SRMA likely exists; new original studies likely published after it; new studies share the same PICO; the new evidence could plausibly shift pooled estimates or certainty; a clear update rationale exists. No meaningful update → not_viable.
Internally estimate: probability of prior SRMA, probability of new studies, pooling feasibility, expected heterogeneity. State these judgments in evidence_gap_assessment.

[NMA — Network Meta-Analysis] Viable only if ≥3 interventions, a connected evidence network plausibly exists, a common comparator exists, and indirect comparisons are meaningful. Reject disconnected networks, sparse evidence, or only two interventions.

[RCT] Assess ethical feasibility, equipoise, recruitment feasibility, intervention availability, cost practicality, realistic sample size. Reject unethical interventions, impossible recruitment, or unrealistic resource demands.

[Cohort] Assess follow-up feasibility, outcome incidence, data source availability, confounding burden, sample size practicality.

[Case-Control] Assess case definition clarity, control selection, exposure ascertainment, feasibility of retrospective data collection.

[Cross-Sectional] Assess questionnaire feasibility, availability of validated scales, variable measurability, population accessibility, novelty within the stated geography. Reject repetitive awareness/KAP studies, poorly measurable variables, or absence of validated instruments.

[Narrative Review] Assess literature availability, educational value, novelty of the review angle, synthesis opportunity.

[LTE — Letter to Editor] Assess whether a recent target article plausibly exists and whether there are legitimate methodological, statistical, or clinical-interpretation concerns to raise.

SCORING GUIDANCE (strict):
- viability_score, novelty_score, methodological_feasibility: 0-100.
- 80+ = genuine, well-defined opportunity with strong support. 40-79 = real but with notable concerns. <40 = saturated, too broad, infeasible, or methodologically weak.
- publication_potential: low | moderate | high | very_high — anchor to novelty + methodological rigor + clinical relevance.
- confidence: low | moderate | high — reflects how certain you are given the information provided; lower it when the input is vague.

OUTPUT — return ONLY this JSON object, exact keys:
{
"overall_verdict": "viable|conditionally_viable|not_viable",
"study_design": "<echo the user's selected design>",
"viability_score": <int 0-100>,
"publication_potential": "low|moderate|high|very_high",
"novelty_score": <int 0-100>,
"methodological_feasibility": <int 0-100>,
"key_strengths": ["<concise strength>", "..."],
"key_concerns": ["<concise concern>", "..."],
"required_modifications": ["<actionable change to make it viable>", "..."],
"evidence_gap_assessment": "<2-4 sentences on the evidence landscape and gap, including your internal judgment on whether prior studies/reviews likely exist>",
"final_recommendation": "<1-2 sentence verdict a strict reviewer would give>",
"confidence": "low|moderate|high"
}

If the input is too vague to assess (e.g. no topic, or a single ambiguous word), return overall_verdict "not_viable", low scores, confidence "low", and put the reason in key_concerns and required_modifications (ask for a clearer topic/question/PICO).`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return handleGetQuota(req, res);
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { topic, studyDesign, userId, plan: rawPlan } = req.body || {};
  const plan = ['scholar', 'pro'].includes(rawPlan) ? rawPlan : null;

  if (!plan) {
    return res.status(403).json({ success: false, error: 'ViabilityCheck requires a Scholar or Pro plan. Upgrade to unlock.' });
  }

  if (!topic || !studyDesign) {
    return res.status(400).json({ success: false, error: 'Missing required fields: topic and studyDesign' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ success: false, error: 'OpenAI API key not configured' });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const canLimit = !!(userId && SB_URL && SB_KEY);
  console.log('canLimit:', canLimit, '| userId:', !!userId, '| SB_URL:', !!SB_URL, '| SB_KEY:', !!SB_KEY);

  const DEFAULTS = { scholar: 15, pro: 30 };
  const PLAN_LIMIT_KEY = {
    scholar: 'viabilitycheck_scholar_limit',
    pro:     'viabilitycheck_pro_limit',
  };

  let dailyLimit = DEFAULTS[plan];
  let usageCount = 0;

  if (canLimit) {
    try {
      // 1. Get limit from settings based on plan
      const settingsRows = await sbGet(SB_URL, SB_KEY, 'settings', {
        key: `eq.${PLAN_LIMIT_KEY[plan]}`,
        select: 'value',
      });
      const rawVal = settingsRows[0]?.value;
      dailyLimit = (rawVal != null && !isNaN(parseInt(rawVal, 10)))
        ? parseInt(rawVal, 10)
        : DEFAULTS[plan];

      // 2. Count today's checks (PKT day boundary — UTC+5)
      const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const startOfDayPKT = new Date(Math.floor((nowMs + PKT_OFFSET_MS) / 86400000) * 86400000 - PKT_OFFSET_MS);
      const checkRows = await sbGet(SB_URL, SB_KEY, 'viability_checks', {
        user_id: `eq.${userId}`,
        created_at: `gte.${startOfDayPKT.toISOString()}`,
        select: 'user_id',
      });
      usageCount = checkRows.length;

      // 3. Enforce limit
      if (usageCount >= dailyLimit) {
        return res.status(429).json({
          success: false,
          error: 'Daily limit reached. Upgrade your plan for more checks.',
          usage: { count: usageCount, limit: dailyLimit, remaining: 0 },
        });
      }
    } catch (err) {
      console.error('rate-limit check error:', err);
      // Non-fatal: allow check if limit enforcement fails
    }
  }

  const userMessage = JSON.stringify({ topic, study_design: studyDesign });

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
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 1500,
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

    let result;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error('JSON parse error. Raw response (first 500 chars):', raw?.slice(0, 500));
      return res.status(502).json({ success: false, error: 'AI returned invalid JSON' });
    }

    if (!result || typeof result !== 'object' || !result.overall_verdict) {
      return res.status(502).json({ success: false, error: 'AI returned unexpected format' });
    }

    // Record this check
    if (canLimit) {
      try {
        await sbPost(SB_URL, SB_KEY, 'viability_checks', {
          user_id: userId,
          created_at: new Date().toISOString(),
        });
        usageCount++;
        console.log('viability_checks insert ok | userId:', userId);
      } catch (err) {
        console.error('viability_checks insert failed | userId:', userId, '| error:', err.message);
      }
    } else {
      console.log('viability_checks insert skipped — canLimit is false');
    }

    return res.status(200).json({
      success: true,
      ...result,
      usage: {
        count: usageCount,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - usageCount),
      },
    });

  } catch (err) {
    console.error('check-viability error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/* ── GET /api/check-viability?userId=…&plan=… → quota info ── */
async function handleGetQuota(req, res) {
  const userId = req.query && req.query.userId;
  const rawPlan = req.query && req.query.plan;
  const plan = ['scholar', 'pro'].includes(rawPlan) ? rawPlan : null;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!userId || !SB_URL || !SB_KEY || !plan) {
    return res.status(200).json({ usage: null });
  }

  const PLAN_DEFAULTS = { scholar: 15, pro: 30 };
  const PLAN_LIMIT_KEY = {
    scholar: 'viabilitycheck_scholar_limit',
    pro:     'viabilitycheck_pro_limit',
  };

  try {
    const settingsRows = await sbGet(SB_URL, SB_KEY, 'settings', {
      key: `eq.${PLAN_LIMIT_KEY[plan]}`,
      select: 'value',
    });
    const rawVal = settingsRows[0]?.value;
    const limit = (rawVal != null && !isNaN(parseInt(rawVal, 10)))
      ? parseInt(rawVal, 10)
      : PLAN_DEFAULTS[plan];

    const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const startOfDayPKT = new Date(Math.floor((nowMs + PKT_OFFSET_MS) / 86400000) * 86400000 - PKT_OFFSET_MS);
    const checkRows = await sbGet(SB_URL, SB_KEY, 'viability_checks', {
      user_id: `eq.${userId}`,
      created_at: `gte.${startOfDayPKT.toISOString()}`,
      select: 'user_id',
    });
    const count = checkRows.length;

    return res.status(200).json({
      usage: { count, limit, remaining: Math.max(0, limit - count) },
    });
  } catch (err) {
    console.error('quota-get error:', err);
    return res.status(200).json({ usage: null });
  }
}

/* ── Supabase REST helpers ──────────────────────────────── */
async function sbGet(url, key, table, params) {
  const base = url.replace(/\/+$/, '');
  const endpoint = new URL(`${base}/rest/v1/${table}`);
  Object.entries(params).forEach(([k, v]) => endpoint.searchParams.set(k, v));
  console.log('sbGet URL:', endpoint.toString());
  const r = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`sbGet ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbPost(url, key, table, body) {
  const base = url.replace(/\/+$/, '');
  const endpoint = `${base}/rest/v1/${table}`;
  console.log('sbPost URL:', endpoint);
  const r = await fetch(endpoint, {
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
