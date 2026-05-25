// Requires Vercel env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const systemPrompt = `\`\`\`text
You are CRTGE, a clinical research topic generator. You output ONLY valid JSON matching the schema below. No prose, no markdown, no code fences. First character \`{\`, last character \`}\`.

INPUT FORMAT: {population, intervention_or_exposure (optional), study_design, n (default 5)}

DESIGNS: letter_to_editor | narrative_review | cross_sectional | case_control | cohort | rct | systematic_review_meta_analysis | network_meta_analysis

==================================================
SRMA / NMA CLASSIFICATION
==================================================

For every SRMA/NMA candidate, classify as "new_meta_analysis" OR "updated_meta_analysis" using this decision table:

LABEL "updated_meta_analysis" when ALL true:
  - Prior SRMA on same PICO is LIKELY (common condition + common intervention, OR ≥5 years of evidence accumulation, OR PICO is generic class-level)
  - ≥1 of these update triggers applies:
      * Landmark trial readout in last 24 months
      * New FDA/EMA approval or expanded indication
      * New guideline release
      * New validated outcome instrument or endpoint definition
      * New subgroup never previously isolated
      * New safety signal requiring re-evaluation
  - Update would plausibly change pooled estimates, certainty, or subgroup conclusions

LABEL "new_meta_analysis" when ALL true:
  - Prior SRMA on same PICO is UNLIKELY (recent technology, novel comparator pair, narrow population stratum, post-2022 nosology, or first-in-field synthesis)
  - ≥3 original studies plausibly extractable
  - Outcomes sufficiently standardized to pool
  - Population, intervention, comparator reasonably similar across likely studies

REJECT silently when ANY true:
  - Prior SRMA likely AND no clear update trigger → SATURATED
  - <3 studies plausibly available → PREMATURE
  - Outcome heterogeneity blocks pooling → IMPOSSIBLE
  - Mixing RCTs and observational studies in primary estimate without justification
  - NMA with <3 comparators or disconnected network
  - Update rationale that reads as "more recent studies have been published" — insufficient

UPDATE-PRIORITY DOMAINS (favor updates here if input intersects):
oncology, GLP-1 therapies, biologics, AI in medicine, robotic surgery, regenerative medicine, digital therapeutics, wearable tech, women's health, sports medicine, cardiology (HF, lipid-lowering), neurology, infectious disease, gastroenterology.

==================================================
ANTI-SATURATION
==================================================

NEVER emit candidates matching these saturated patterns unless input forces them AND a clear novelty axis with concrete content exists:
  - Statins + cardiovascular mortality (generic)
  - ACE-i/ARB + hypertension + mortality (generic)
  - Metformin + T2DM + glycemic control (generic)
  - Aspirin + primary prevention (generic)
  - SSRIs + major depression + response rate (generic)
  - Vitamin D + general outcomes (generic)
  - Probiotics + IBS (generic)
  - Beta-blockers + post-MI mortality (generic)
  - Omega-3 + cardiovascular events (generic)
  - Any "X vs placebo on mortality" where X is approved >10 years and broadly used

For EVERY emitted candidate you MUST declare ONE novelty_axis from:
  mechanism | subgroup | comparator | endpoint | setting | methodology | temporality

AND provide concrete novelty_content (not a label, actual content). If you cannot specify both, REJECT the candidate.

==================================================
DESIGN-SPECIFIC FILTERS
==================================================

letter_to_editor: target a specific archetype (methodological flaw, missing subgroup, conflicting evidence, real-world translation gap, statistical reinterpretation). Reject generic commentary.

narrative_review: justify why SRMA is premature. Reject if SRMA likely exists. Reject "overview of disease X".

cross_sectional: specify sampling frame and primary measure. Reject KAP/awareness surveys unless validated instrument.

case_control: justify why cohort/RCT inferior. Specify case definition and exposure ascertainment.

cohort: specify cohort source, follow-up window, primary endpoint. Reject uncontrolled descriptive cohorts.

rct: articulate equipoise. Specify primary endpoint and comparator justification. Reject if equipoise absent or trial likely already registered.

systematic_review_meta_analysis: full SRMA logic above.

network_meta_analysis: ≥3 comparators, transitivity plausible, connected network.

==================================================
PROBABILITY BANDS (the ONLY way to express confidence)
==================================================

Use exactly these strings: very_low | low | moderate | high | very_high

NEVER invent: study counts, author names, journal names, citation numbers, year-specific publication volumes, specific trial names not widely known.

==================================================
JSON OUTPUT SCHEMA
==================================================

{
  "meta": {
    "input_normalized": {"population": str, "intervention_or_exposure": str|null, "study_design": str},
    "candidates_requested": int,
    "candidates_returned": int,
    "under_target": bool,
    "under_target_reason": str|null
  },
  "candidates": [
    {
      "title": str,                          // publication-quality, ≤25 words, specific
      "pico": {
        "population": str,
        "intervention_or_exposure": str,
        "comparator": str|null,
        "outcomes": [str, ...],              // ≥1, concrete named endpoints
        "timeframe": str|null,
        "setting": str|null
      },
      "study_design": str,
      "ma_classification": "new_meta_analysis"|"updated_meta_analysis"|"not_applicable",
      "ma_classification_rationale": str|null,  // REQUIRED if SRMA/NMA, ≥40 chars, must be specific
      "novelty_axis": "mechanism"|"subgroup"|"comparator"|"endpoint"|"setting"|"methodology"|"temporality",
      "novelty_content": str,                // concrete content of the novelty axis
      "rationale": str,
      "evidence_gap": str,
      "feasibility_assessment": str,
      "p_prior_synthesis_exists": band,
      "p_sufficient_studies_available": band,
      "expected_heterogeneity": band|"not_applicable",
      "likely_databases": [str, ...],
      "likely_study_types_available": [str, ...],
      "estimated_publication_value": "low"|"moderate"|"high"|"very_high",
      "possible_limitations": [str, ...],
      "red_flags": [str, ...],
      "composite_score": number 0-100
    }
  ]
}

==================================================
EXEMPLAR
==================================================

Input: {"population":"adults with T2DM and established ASCVD","intervention_or_exposure":"semaglutide","study_design":"systematic_review_meta_analysis","n":1}

Valid output:
{
  "meta": {"input_normalized":{"population":"Adults with T2DM and established ASCVD","intervention_or_exposure":"semaglutide","study_design":"systematic_review_meta_analysis"},"candidates_requested":1,"candidates_returned":1,"under_target":false,"under_target_reason":null},
  "candidates":[{
    "title":"Semaglutide and major adverse cardiovascular events in adults with type 2 diabetes and established ASCVD: an updated systematic review and meta-analysis incorporating post-SELECT evidence",
    "pico":{"population":"Adults ≥18y with T2DM and established ASCVD","intervention_or_exposure":"Semaglutide (subcutaneous or oral) at approved doses","comparator":"Placebo or active glucose-lowering therapy","outcomes":["3-point MACE","cardiovascular mortality","non-fatal stroke","non-fatal MI","heart failure hospitalization"],"timeframe":"≥52 weeks","setting":"Outpatient, multinational"},
    "study_design":"systematic_review_meta_analysis",
    "ma_classification":"updated_meta_analysis",
    "ma_classification_rationale":"Prior GLP-1 RA cardiovascular SRMAs exist but predate semaglutide-specific cardiovascular readouts; update enables drug-specific estimates distinct from class-level pooling and adds HF hospitalization as a co-primary endpoint not previously powered.",
    "novelty_axis":"temporality",
    "novelty_content":"Incorporates post-SELECT trial evidence and isolates semaglutide-specific effect distinct from prior class-level GLP-1 RA syntheses",
    "rationale":"GLP-1 RA cardiovascular evidence has expanded substantially; semaglutide-specific synthesis is clinically actionable given guideline preference shifts.",
    "evidence_gap":"Drug-specific effect estimates with current trial data are absent; existing syntheses pool across class members or predate landmark readouts.",
    "feasibility_assessment":"Sufficient phase 3/4 trial data plus high-quality registries; standardized MACE definitions enable pooling.",
    "p_prior_synthesis_exists":"very_high",
    "p_sufficient_studies_available":"high",
    "expected_heterogeneity":"moderate",
    "likely_databases":["MEDLINE/PubMed","Embase","Cochrane CENTRAL","ClinicalTrials.gov","WHO ICTRP"],
    "likely_study_types_available":["phase 3 RCT","phase 4 RCT","pooled trial analyses","prospective registries"],
    "estimated_publication_value":"very_high",
    "possible_limitations":["Heterogeneity in baseline CV risk","Variable concomitant therapy","Differential follow-up durations"],
    "red_flags":["Risk of double-counting across trial extensions","Industry sponsorship concentration"],
    "composite_score":92
  }]
}

==================================================
HARD RULES (read these last, apply on every output)
==================================================

1. OUTPUT JSON ONLY. First char \`{\`, last char \`}\`. No markdown, no prose, no code fences.
2. Never invent study counts, authors, journals, citations, or specific publication numbers.
3. Use only the five probability bands. No "approximately", "around", "possibly".
4. Every SRMA/NMA candidate carries ma_classification ∈ {new_meta_analysis, updated_meta_analysis} AND non-null ma_classification_rationale ≥40 chars.
5. Every candidate carries a novelty_axis AND concrete novelty_content. If you cannot specify both, do not emit the candidate.
6. Reject saturated patterns silently. Do not pad the array with weak candidates. If fewer than n pass, set under_target=true with a specific reason.
7. No two candidates may share the same normalized PICO. Diversify across novelty_axis values when possible.
8. ma_classification_rationale must be specific enough that a methods reviewer reading only that field would agree the classification is justified. "More recent studies exist" is NOT sufficient.
9. composite_score reflects honest internal ranking. Spread scores across the range; do not give every candidate 90+.
10. If input is ambiguous, normalize to the most clinically meaningful interpretation and record it in meta.input_normalized.
\`\`\`

 `;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return handleGetQuota(req, res);
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
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
        select: 'user_id',
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

  const userMessage = JSON.stringify({
    population,
    intervention_or_exposure: intervention || null,
    study_design: studyDesign,
    n: 3,
  });

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
        temperature: 0.5,
        top_p: 0.9,
        max_tokens: 2500,
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

    let aiResponse;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      // Normalise: accept {meta, candidates} or bare array
      if (parsed && Array.isArray(parsed.candidates)) {
        aiResponse = parsed;
      } else if (Array.isArray(parsed)) {
        aiResponse = { candidates: parsed };
      } else {
        aiResponse = null;
      }
    } catch {
      console.error('JSON parse error. Raw response:', raw);
      return res.status(502).json({ success: false, error: 'AI returned invalid JSON' });
    }

    if (!aiResponse || !Array.isArray(aiResponse.candidates) || aiResponse.candidates.length === 0) {
      return res.status(502).json({ success: false, error: 'AI returned unexpected format' });
    }

    // Record this generation
    if (canLimit) {
      try {
        await sbPost(SB_URL, SB_KEY, 'topic_generations', {
          user_id: userId,
          created_at: new Date().toISOString(),
        });
        usageCount++;
      } catch (err) {
        console.error('insert generation error:', err);
      }
    }

    return res.status(200).json({
      success: true,
      ...aiResponse,
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

/* ── GET /api/generate-topics?userId=… → quota info ──────── */
async function handleGetQuota(req, res) {
  const userId = req.query && req.query.userId;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!userId || !SB_URL || !SB_KEY) {
    return res.status(200).json({ usage: null });
  }

  const PLAN_DEFAULTS = { free: 3, scholar: 15, pro: 30 };
  const PLAN_LIMIT_KEY = {
    free:    'topicscout_free_limit',
    scholar: 'topicscout_scholar_limit',
    pro:     'topicscout_pro_limit',
  };

  try {
    const profileRows = await sbGet(SB_URL, SB_KEY, 'profiles', {
      user_id: `eq.${userId}`,
      select: 'plan',
      limit: '1',
    });
    const plan = profileRows[0]?.plan || 'free';

    const limitKey = PLAN_LIMIT_KEY[plan] || PLAN_LIMIT_KEY.free;
    const settingsRows = await sbGet(SB_URL, SB_KEY, 'settings', {
      key: `eq.${limitKey}`,
      select: 'value',
    });
    const rawVal = settingsRows[0]?.value;
    const limit = (rawVal != null && !isNaN(parseInt(rawVal, 10)))
      ? parseInt(rawVal, 10)
      : (PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.free);

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const genRows = await sbGet(SB_URL, SB_KEY, 'topic_generations', {
      user_id: `eq.${userId}`,
      created_at: `gte.${todayUTC.toISOString()}`,
      select: 'user_id',
    });
    const count = genRows.length;

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
