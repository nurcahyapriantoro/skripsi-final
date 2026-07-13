# Lampiran 17. Kode Sumber AI-Assisted CEI Pattern Analyzer

> **Cross-reference:** Mendukung **Bab 3.6 (Pengembangan Prototipe AI-Assisted CEI Pattern Analyzer Tools)**, **Bab 4.5 (Prototipe AI-Assisted CEI Pattern Analyzer Tools)**, **Tabel 11 (Perbandingan Slither vs AI)**, dan **Lampiran 8 (Desain System Prompt DeepSeek API)**.
>
> **Repositori:**
> - Frontend React: [`cei-analyzer/src/App.jsx`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/cei-analyzer/src/App.jsx)
> - Serverless proxy: [`cei-analyzer-api/api/analyze.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/cei-analyzer-api/api/analyze.js)
> - Live: https://cei-analyzer.web.app/
>
> Lampiran ini memuat cuplikan kode sumber utama. Kode lengkap (2000+ baris) tersedia di repositori.

---

## 17.1 Arsitektur Sistem (Gambar 3 di skripsi)

```
┌─────────────────────────┐                ┌──────────────────────────┐                ┌──────────────────┐
│  Browser (cei-analyzer  │   POST /api/   │   Vercel Serverless       │   Bearer Token  │   DeepSeek API   │
│      .web.app)          │   analyze      │   Function                │   DEEPSEEK_      │   (deepseek-     │
│                         │ ─────────────► │   (cei-analyzer-api       │   API_KEY        │   chat)          │
│  - React + Vite         │                │    .vercel.app)           │ ──────────────► │                  │
│  - Tailwind CSS         │                │   - SYSTEM_PROMPT inline  │                 │                  │
│  - Hasil: Security      │ ◄───────────── │   - CORS whitelist       │ ◄────────────── │                  │
│    Score, CEI Flow,     │   JSON         │   - JSON schema strict    │   JSON          │                  │
│    Classified Lines     │                │                          │                 │                  │
└─────────────────────────┘                └──────────────────────────┘                └──────────────────┘
```

**Penjelasan alur:**
1. User paste kode Solidity di `cei-analyzer.web.app` (Firebase Hosting, Spark).
2. Frontend POST kode ke Vercel Function endpoint.
3. Vercel Function menambahkan `Authorization: Bearer <DEEPSEEK_API_KEY>` (env var, encrypted).
4. DeepSeek mengembalikan JSON terstruktur sesuai schema di `SYSTEM_PROMPT`.
5. Frontend render hasil: Security Score, CEI Flow, tabel baris terklasifikasi, rekomendasi.

---

## 17.2 System Prompt dengan JSON Schema (Lampiran 8 + kode di App.jsx)

**Lokasi:** [`cei-analyzer/src/App.jsx` baris 14–44](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/cei-analyzer/src/App.jsx#L14)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/cei-analyzer/src/App.jsx

```javascript
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
```

**Penjelasan:**
- **Identitas:** Auditor keamanan Solidity spesialis reentrancy.
- **Tiga kategori:** CHECKS, EFFECTS, INTERACTIONS — sesuai definisi di Bab 2.5.1.
- **Deteksi ordering:** Tandai `is_vulnerable = true` jika INTERACTIONS sebelum EFFECTS.
- **JSON schema:** Output deterministik untuk parsing frontend (no markdown fences).
- **9 field output:**
  - `function_name`, `is_vulnerable`, `vulnerability_type`
  - `security_score` (0–100, 100 = fully secure)
  - `cei_order_detected` vs `expected_order` (untuk visualisasi flow)
  - `classified_lines` (per-baris dengan risk_note)
  - `violation_summary`, `recommendation`, `is_cei_compliant`

---

## 17.3 Handler API (Vercel Serverless Function)

**Lokasi:** [`cei-analyzer-api/api/analyze.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/cei-analyzer-api/api/analyze.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/cei-analyzer-api/api/analyze.js
**Fungsi:** Proxy aman antara frontend dan DeepSeek API. Kunci API disimpan sebagai env var di Vercel (encrypted), **tidak pernah terekspos ke klien**.

```javascript
const SYSTEM_PROMPT = `You are an expert Solidity smart contract security auditor...`;

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
```

**Penjelasan blok:**
- **`ALLOWED_ORIGINS`:** CORS whitelist — hanya origin tertentu yang boleh akses.
- **`setCors(res, origin)`:** Set header CORS hanya untuk origin yang diizinkan.
- **Preflight `OPTIONS` (L51–54):** Response 204 tanpa body untuk CORS preflight.
- **Validasi `code` (L63–65):** Tolak request tanpa body `code`.
- **Env var `DEEPSEEK_API_KEY` (L70–72):** Kunci dibaca dari `process.env` (di-set via Vercel dashboard). Tidak pernah di-hardcode.
- **Upstream fetch (L77–93):** Kirim ke DeepSeek dengan model `deepseek-chat`, max_tokens 1500.
- **Parse JSON (L102–105):** Hapus markdown fences (` ```json `, ` ``` `), parse ke objek.
- **Response (L107):** `{ success: true, data: parsed }` ke frontend.

---

## 17.4 Frontend — Fungsi Pemanggil API (App.jsx)

**Lokasi:** [`cei-analyzer/src/App.jsx` baris 474–488](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/cei-analyzer/src/App.jsx#L474)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/cei-analyzer/src/App.jsx

```javascript
// ─── API ───
const analyzeWithDeepseek = useCallback(async (code) => {
  const response = await fetch('https://cei-analyzer-api.vercel.app/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error')
    throw new Error(`API error (${response.status}): ${errText}`)
  }
  const data = await response.json()
  if (!data.success) throw new Error(data.error || 'Analysis failed')
  return data.data
}, [])
```

**Penjelasan:**
- **`useCallback`:** Memoization agar fungsi tidak dibuat ulang tiap render.
- **`fetch` ke Vercel endpoint:** Bukan langsung ke DeepSeek (kunci disembunyikan).
- **Validasi `data.success`:** Lempar error jika Vercel mengembalikan `success: false`.
- **Return `data.data`:** Mengembalikan objek analisis (security_score, classified_lines, dst).

---

## 17.5 Preset Kontrak (3 Varian) di Frontend

**Lokasi:** [`cei-analyzer/src/App.jsx` baris 47–110](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/cei-analyzer/src/App.jsx#L47)
**Tujuan:** Menyediakan contoh kode siap-pakai untuk demo "Compare 3 Contracts" (Bab 4.5.1).

```javascript
// ─── Preset Contracts ───
const INSECURE_VAULT = `// InsecureVault.sol — VULNERABLE (Interactions before Effects)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
enum Status { CREATED, LOCKED, RELEASED, COMPLETED }
contract InsecureVault {
    mapping(address => uint) public balances;
    Status public orderStatus;
    function withdrawFunds() external {
        uint amount = balances[msg.sender];
        require(amount > 0, "Insufficient balance");
        require(orderStatus == Status.RELEASED, "Order not released");
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
    }
}`;

const SECURE_VAULT = `// SecureVault.sol — CEI Pattern (Effects BEFORE Interactions)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
enum Status { CREATED, LOCKED, RELEASED, COMPLETED }
contract SecureVault {
    mapping(address => uint) public balances;
    Status public orderStatus;
    function withdrawFunds() external {
        uint amount = balances[msg.sender];
        require(amount > 0, "Insufficient balance");
        require(orderStatus == Status.RELEASED, "Order not released");
        balances[msg.sender] = 0;  // ← EFFECTS FIRST
        (bool success,) = msg.sender.call{value: amount}("");  // ← INTERACTIONS LAST
        require(success, "Transfer failed");
    }
}`;

const MUTEX_VAULT = `// MutexVault.sol — OpenZeppelin nonReentrant (CEI violated but protected)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
enum Status { CREATED, LOCKED, RELEASED, COMPLETED }
contract MutexVault is ReentrancyGuard {
    mapping(address => uint) public balances;
    Status public orderStatus;
    function withdrawFunds() external nonReentrant {
        uint amount = balances[msg.sender];
        require(amount > 0, "Insufficient balance");
        require(orderStatus == Status.RELEASED, "Order not released");
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
    }
}`;
```

**Penjelasan:**
- **`INSECURE_VAULT`:** Preset untuk uji InsecureVault (vulnerable).
- **`SECURE_VAULT`:** Preset untuk uji SecureVault (CEI aman).
- **`MUTEX_VAULT`:** Preset untuk uji MutexVault (CEI violated tapi dilindungi `nonReentrant`). Demonstrasi kemampuan AI membedakan keduanya (Bab 4.5.2).

---

## 17.6 Konfigurasi & Deployment

### Frontend (Firebase Hosting)
- **Build:** `npm run build` di `cei-analyzer/` → output di `dist/`.
- **Deploy:** `firebase deploy --only hosting --project cei-analyzer` (Spark plan, gratis).
- **URL:** https://cei-analyzer.web.app/

### Backend (Vercel)
- **Project:** `cahyos-projects-f6bc3e17/cei-analyzer-api`
- **URL:** https://cei-analyzer-api.vercel.app/api/analyze
- **Env var:** `DEEPSEEK_API_KEY` (encrypted, di-set via Vercel dashboard atau `vercel env add`).
- **Plan:** Vercel Hobby (gratis, 100 GB-jam fungsi/bulan + 100 GB egress).

### Biaya
- **Firebase Hosting:** $0 (Spark)
- **Vercel:** $0 (Hobby, dalam free-tier)
- **DeepSeek API:** Pay-as-you-go (~$0,0001 per analisis)

— **Akhir Lampiran 17** —
