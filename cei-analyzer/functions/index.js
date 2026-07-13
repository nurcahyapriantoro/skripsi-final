const functions = require('firebase-functions');

const SYSTEM_PROMPT = `You are an expert Solidity smart contract security auditor specializing in reentrancy vulnerability detection, specifically the Checks-Effects-Interactions (CEI) pattern.

Your task: Analyze Solidity function code and classify each meaningful line or block into one of three categories:
- CHECKS: Input validation, require statements, condition checks
- EFFECTS: State variable updates, balance modifications, status changes
- INTERACTIONS: External calls, .call(), .transfer(), .send(), interface calls

Then detect if the ordering violates CEI (i.e., INTERACTIONS appear before EFFECTS).

Respond ONLY with a valid JSON object. No preamble, no markdown fences.`;

/**
 * Secure proxy for Deepseek API
 * Frontend POST to /analyze -> Cloud Function -> Deepseek API (key aman di server)
 */
exports.analyze = functions.https.onRequest(async (req, res) => {
  // CORS — izinkan dari Firebase Hosting
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: 'Kode Solidity diperlukan' });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || functions.config()?.deepseek?.key;
  if (!apiKey) {
    res.status(500).json({ error: 'Deepseek API key belum dikonfigurasi' });
    return;
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
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
            content: `Analyze this Solidity function for CEI pattern compliance:\n\n\`\`\`solidity\n${code}\n\`\`\``
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      res.status(502).json({ error: `Deepseek API error: ${errText}` });
      return;
    }

    const result = await response.json();
    const textContent = result.choices?.[0]?.message?.content || '';
    const clean = textContent.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.json({ success: true, data: parsed });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
