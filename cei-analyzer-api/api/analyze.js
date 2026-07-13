const SYSTEM_PROMPT = `You are an expert Solidity smart contract security auditor specializing in reentrancy vulnerability detection, specifically the Checks-Effects-Interactions (CEI) pattern.

Your task: Analyze Solidity function code and classify each meaningful line or block into one of three categories:
- CHECKS: Input validation, require statements, condition checks
- EFFECTS: State variable updates, balance modifications, status changes
- INTERACTIONS: External calls, .call(), .transfer(), .send(), interface calls

Then detect if the ordering violates CEI (i.e., INTERACTIONS appear before EFFECTS).

Respond ONLY with a valid JSON object. No preamble, no markdown fences.

JSON schema:
{
  "function_name": "string",
  "is_vulnerable": boolean,
  "vulnerability_type": "string or null",
  "security_score": number (0-100, 100 = fully secure),
  "cei_order_detected": ["CHECKS"|"EFFECTS"|"INTERACTIONS", ...],
  "expected_order": ["CHECKS", "EFFECTS", "INTERACTIONS"],
  "classified_lines": [
    {
      "line_number": number,
      "code_snippet": "string",
      "category": "CHECKS"|"EFFECTS"|"INTERACTIONS"|"OTHER",
      "risk_note": "string or null"
    }
  ],
  "violation_summary": "string or null",
  "recommendation": "string or null",
  "is_cei_compliant": boolean
}`;

const ALLOWED_ORIGINS = [
  'https://cei-analyzer.web.app',
  'https://cei-analyzer.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

function setCors(res, origin) {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  setCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code } = req.body || {};
  if (!code) {
    res.status(400).json({ error: 'Kode Solidity diperlukan' });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DEEPSEEK_API_KEY belum dikonfigurasi di server' });
    return;
  }

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze this Solidity function for CEI pattern compliance:\n\n\`\`\`solidity\n${code}\n\`\`\``,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => 'Unknown error');
      res.status(502).json({ error: `Deepseek API error: ${errText}` });
      return;
    }

    const result = await upstream.json();
    const textContent = result.choices?.[0]?.message?.content || '';
    const clean = textContent.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}