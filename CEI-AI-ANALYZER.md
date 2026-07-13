# Spesifikasi Teknis: AI-Assisted CEI Pattern Analyzer
## Untuk Skripsi: Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok

**Versi:** 1.0  
**Author:** Nurcahya Priantoro (G6401221049)  
**Konteks:** Modul validasi tambahan untuk skripsi — melengkapi verifikasi statis Slither dengan analisis semantik berbasis LLM terhadap pola Checks-Effects-Interactions (CEI) pada kode Solidity.

---

## 1. Tujuan Fitur

Membangun prototipe **AI-Assisted CEI Pattern Analyzer** yang secara otomatis:

1. Mem-parsing kode Solidity dan mengidentifikasi tiga kategori node logika: **CHECKS**, **EFFECTS**, **INTERACTIONS**
2. Mendeteksi pelanggaran urutan CEI (misalnya: Interactions-before-Effects)
3. Melaporkan lokasi baris yang bermasalah beserta penjelasan mengapa itu berbahaya
4. Membandingkan kontrak InsecureVault vs SecureVault secara side-by-side

Alat ini digunakan untuk **memvalidasi tiga varian kontrak** penelitian (InsecureVault, SecureVault CEI, MutexVault) secara semantik, melengkapi verifikasi statis Slither yang bersifat rule-based.

---

## 2. Stack Teknologi

```
Frontend  : React (JSX) — single file artifact
AI Engine : DeepsekkApiKey (DeepseekV4Pro)
Language  : JavaScript (ES2022+)
Styling   : Tailwind CSS utility classes
Hosting   : Dapat dijalankan sebagai Deepseek Artifact (inline) atau 
            di-export sebagai HTML standalone
```

> **Catatan untuk AI Agent:** Semua logika (API call, parsing, UI) harus dalam **satu file JSX**. Tidak ada backend server. API key Deepseek sudah di-handle oleh environment — jangan hardcode key apapun.

---

## 3. Arsitektur Sistem

```
┌─────────────────────────────────────────────────┐
│                  UI Layer (React)                │
│                                                 │
│  ┌─────────────┐    ┌──────────────────────┐   │
│  │  Code Input │    │   Analysis Result    │   │
│  │  (textarea) │    │   Panel              │   │
│  │             │    │  - CEI Classification│   │
│  │  Solidity   │───▶│  - Violation Alert   │   │
│  │  code paste │    │  - Line Highlights   │   │
│  │             │    │  - Security Score    │   │
│  └─────────────┘    └──────────────────────┘   │
└──────────────────────────┬──────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Deepseek API  │
              │  /v1/messages          │
              │                        │
              │  System Prompt:        │
              │  CEI Expert Analyzer   │
              │                        │
              │  Input: Solidity code  │
              │  Output: JSON analysis │
              └────────────────────────┘
```

---

## 4. Spesifikasi API Call

### 4.1 Endpoint

```javascript
POST https://api.deepseek.com/chat/completions

Headers:
  Content-Type: application/json
  // API key sudah di-handle environment, JANGAN tambahkan header deepseek-api-key
```

### 4.2 Model

```javascript
model: "DeepseekV4Pro",
max_tokens: 1500
```

### 4.3 System Prompt (Gunakan Persis Ini)

```
You are an expert Solidity smart contract security auditor specializing in 
reentrancy vulnerability detection, specifically the Checks-Effects-Interactions 
(CEI) pattern.

Your task: Analyze Solidity function code and classify each meaningful line or 
block into one of three categories:
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
}
```

### 4.4 Contoh User Message

```
Analyze this Solidity function for CEI pattern compliance:

\`\`\`solidity
function withdrawFunds() external {
    uint amount = balances[msg.sender];
    require(amount > 0, "No balance");
    (bool success,) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
    balances[msg.sender] = 0;
}
\`\`\`
```

---

## 5. Spesifikasi UI Lengkap

### 5.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  🔍 CEI Pattern Analyzer — Smart Contract Security   │
│  Nurcahya Priantoro | Skripsi IPB 2026               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [Tab: Single Analysis] [Tab: Compare Contracts]     │
│                                                      │
├────────────────────┬─────────────────────────────────┤
│                    │                                 │
│  SOLIDITY INPUT    │   ANALYSIS RESULT               │
│                    │                                 │
│  ┌──────────────┐  │  Security Score: [██████░░] 45  │
│  │              │  │  Status: ⚠️ VULNERABLE           │
│  │  paste kode  │  │                                 │
│  │  Solidity    │  │  CEI Order Detected:            │
│  │  di sini     │  │  CHECKS → INTERACTIONS → EFFECTS│
│  │              │  │          ^^^^ VIOLATION         │
│  └──────────────┘  │                                 │
│                    │  Classified Lines:              │
│  [Analyze →]       │  L3 [CHECKS]   require(...)     │
│                    │  L5 [INTERACT] .call{value}()   │
│  Quick Load:       │  L7 [EFFECTS]  balances = 0     │
│  [InsecureVault]   │                                 │
│  [SecureVault]     │  Recommendation:                │
│  [MutexVault]      │  Move state update before call  │
│                    │                                 │
└────────────────────┴─────────────────────────────────┘
```

### 5.2 Fitur Tab "Compare Contracts"

Tampilkan **dua textarea side-by-side** (InsecureVault vs SecureVault) dengan:
- Tombol "Compare" yang memanggil API dua kali secara paralel (`Promise.all`)
- Tabel perbandingan hasil: Security Score, CEI Compliant, Vulnerability Type
- Badge: 🔴 VULNERABLE / 🟢 SECURE

### 5.3 Security Score Visual

```javascript
// Warna berdasarkan score
score >= 80  → hijau  (#22c55e)
score >= 50  → kuning (#eab308)  
score < 50   → merah  (#ef4444)
```

### 5.4 Quick Load Contracts

Sertakan preset kode Solidity untuk tiga kontrak penelitian. Contoh preset InsecureVault:

```solidity
// InsecureVault.sol — VULNERABLE (Interactions before Effects)
function withdrawFunds() external {
    uint amount = balances[msg.sender];
    require(amount > 0, "Insufficient balance");
    require(orderStatus == Status.RELEASED, "Order not released");
    
    // VULNERABILITY: External call BEFORE state update
    (bool success,) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
    
    // Too late — reentrancy already exploits this
    balances[msg.sender] = 0;
    orderStatus = Status.COMPLETED;
}
```

Preset SecureVault (CEI Compliant):

```solidity
// SecureVault.sol — SECURE (CEI Pattern)
function withdrawFunds() external {
    // CHECKS
    uint amount = balances[msg.sender];
    require(amount > 0, "Insufficient balance");
    require(orderStatus == Status.RELEASED, "Order not released");
    
    // EFFECTS — state updated BEFORE external call
    balances[msg.sender] = 0;
    orderStatus = Status.COMPLETED;
    
    // INTERACTIONS — external call last
    (bool success,) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

Preset MutexVault:

```solidity
// MutexVault.sol — SECURE via ReentrancyGuard (OpenZeppelin)
// Uses nonReentrant modifier — mutex lock approach
function withdrawFunds() external nonReentrant {
    uint amount = balances[msg.sender];
    require(amount > 0, "Insufficient balance");
    require(orderStatus == Status.RELEASED, "Order not released");
    
    // Interactions before Effects — BUT protected by mutex
    (bool success,) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
    
    balances[msg.sender] = 0;
    orderStatus = Status.COMPLETED;
}
```

---

## 6. Error Handling

```javascript
// Wajib implementasi semua skenario ini:

// 1. API response bukan valid JSON → tampilkan raw text + pesan error
try {
  const parsed = JSON.parse(responseText);
} catch {
  setError("AI response could not be parsed. Raw: " + responseText);
}

// 2. Network error → retry sekali, lalu tampilkan pesan
// 3. Empty input → disable tombol Analyze, tampilkan placeholder hint
// 4. API rate limit → tampilkan pesan "Coba lagi dalam beberapa detik"

// Loading state: tampilkan spinner + teks "Menganalisis pola CEI..."
```

---

## 7. State Management (React)

```javascript
// State yang wajib diimplementasi:
const [solidityCode, setSolidityCode] = useState("");
const [analysisResult, setAnalysisResult] = useState(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);
const [activeTab, setActiveTab] = useState("single"); // "single" | "compare"

// Untuk compare mode:
const [leftCode, setLeftCode] = useState("");
const [rightCode, setRightCode] = useState("");
const [leftResult, setLeftResult] = useState(null);
const [rightResult, setRightResult] = useState(null);
```

---

## 8. Fungsi Core: analyzeWithDeepseek

```javascript
async function analyzeWithDeepseek(solidityCode) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "DeepseekV4Pro",
      max_tokens: 1500,
      system: SYSTEM_PROMPT, // dari Section 4.3
      messages: [
        {
          role: "user",
          content: `Analyze this Solidity function for CEI pattern compliance:\n\n\`\`\`solidity\n${solidityCode}\n\`\`\``
        }
      ]
    })
  });

  const data = await response.json();
  
  // Extract text dari response
  const textContent = data.content
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join("");

  // Parse JSON (strip markdown fences jika ada)
  const clean = textContent.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
```

---

## 9. Output Display Requirements

### 9.1 Classified Lines Table

Tampilkan sebagai tabel dengan kolom:

| Line | Code Snippet | Category | Risk Note |
|------|-------------|----------|-----------|
| 5 | `msg.sender.call{value}...` | 🔴 INTERACTIONS | External call before state update |
| 7 | `balances[msg.sender] = 0` | 🟡 EFFECTS | Updated too late |

Warna badge per kategori:
- **CHECKS** → biru (`#3b82f6`)
- **EFFECTS** → kuning (`#f59e0b`)  
- **INTERACTIONS** → merah jika violation, hijau jika aman (`#ef4444` / `#22c55e`)

### 9.2 CEI Order Flow Visualization

```
Tampilkan sebagai flow horizontal:
[CHECKS] → [INTERACTIONS ⚠️] → [EFFECTS]
              ↑ violation: seharusnya EFFECTS dulu sebelum INTERACTIONS
```

### 9.3 Export Button

Tambahkan tombol **"Export as JSON"** yang mendownload hasil analisis sebagai file `.json` — berguna untuk lampiran skripsi.

---

## 10. Konteks Penelitian (untuk referensi AI Agent)

Fitur ini adalah bagian dari skripsi berjudul:
**"Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok Berbasis Pola Checks-Effects-Interactions"**

- **Program Studi:** Sarjana Ilmu Komputer, IPB
- **NIM:** G6401221049
- **Pembimbing:** Dr. Shelvie Nidya Neyman, S.Kom, M.Si
- **Posisi fitur dalam skripsi:** Subbab 2.X — Prototipe AI-Assisted CEI Pattern Analyzer (kontribusi tools tambahan, melengkapi Slither)
- **Tiga kontrak uji:** InsecureVault (rentan), SecureVault (CEI), MutexVault (OpenZeppelin ReentrancyGuard)
- **Konteks escrow:** Pembeli ↔ Penjual dalam sistem rantai pasok dengan status enum: CREATED → LOCKED → RELEASED → COMPLETED

---

## 11. Checklist Deliverable untuk AI Agent

- [ ] Single file React JSX (tidak ada file terpisah)
- [ ] Tab "Single Analysis" berfungsi penuh
- [ ] Tab "Compare Contracts" dengan dua textarea + Promise.all
- [ ] Tiga preset Quick Load (InsecureVault, SecureVault, MutexVault)
- [ ] Security Score dengan progress bar berwarna
- [ ] Classified Lines Table dengan badge warna per kategori
- [ ] CEI Order Flow Visualization (horizontal flow)
- [ ] Export JSON button
- [ ] Loading state + Error handling lengkap
- [ ] Responsive layout (mobile-friendly)
- [ ] Tidak ada hardcoded API key
- [ ] Tidak menggunakan localStorage/sessionStorage

---

## 12. Catatan Penting untuk AI Agent

1. **Jangan gunakan `<form>` tag** — gunakan `onClick` handler
2. **Semua state dalam React useState** — tidak ada browser storage
3. **API key sudah di-handle environment** — cukup panggil endpoint tanpa header key
4. **Output JSON dari Deepseek mungkin punya markdown fence** — selalu strip ` ```json ` sebelum parse
5. Prioritaskan **fungsionalitas** atas estetika — ini tool akademis
6. Gunakan **Tailwind CSS** untuk styling, bukan CSS custom
7. Import yang diizinkan: `react`, `lucide-react`, `recharts`

---

*Dokumen ini dibuat untuk dikirim ke AI coding agent sebagai spesifikasi lengkap pembangunan fitur CEI Analyzer.*  
*Versi: 1.0 | Terakhir diperbarui: Mei 2026*

---

## 13. Implementasi React App — Integrasi Fitur Detail

### 13.1 Struktur Proyek React (Vite + Tailwind CSS)

```
cei-analyzer/                   # Root React app
├── index.html                  # Entry HTML
├── package.json                # Dependencies (React 19, Vite 8, Tailwind 3)
├── vite.config.js              # Vite config
├── tailwind.config.js          # Tailwind config
├── postcss.config.js           # PostCSS config (Tailwind + Autoprefixer)
├── src/
│   ├── main.jsx                # React root mount
│   ├── index.css               # Tailwind directives (@tailwind base/components/utilities)
│   ├── App.jsx                 # 🔹 Komponen utama CEI Pattern Analyzer (single file)
│   ├── logo_cei.png             # Logo CEI — .png (juga sebagai favicon)
│   └── assets/                 # Static assets (favicon, dll)
└── dist/                       # Production build output
    ├── index.html
    └── assets/
        ├── index-*.css         # Tailwind compiled CSS (~14 KB gzip)
        └── index-*.js          # Bundled React app (~215 KB, 65 KB gzip)
```

### 13.2 Cara Menjalankan

```bash
# Development mode (hot-reload)
cd cei-analyzer
npm run dev
# → http://localhost:5173

# Production build
npm run build

# Preview production build
npm run preview
# → http://localhost:4173
```

### 13.3 Integrasi dengan Proyek Riset Utama

Aplikasi ini berada di subdirektori `cei-analyzer/` dalam proyek riset induk (`reentrancy-research/`).

| Komponen | Path | Fungsi |
|----------|------|--------|
| **React App** | `cei-analyzer/` | CEI Pattern Analyzer frontend |
| **Kontrak Solidity** | `contracts/vulnerable/`, `contracts/secure/`, `contracts/attacker/` | Kontrak uji penelitian |
| **Slither Reports** | `slither/*.json` | Verifikasi statis pembanding |
| **Hardhat Tests** | `test/*.test.js` | Unit test + exploit simulation |
| **Hasil Analisis** | `analysis/results/` | Data gas, opcode, statistik |
| **Presentasi** | `presentation/dashboard.html` | Dashboard visual riset |

**Alur kerja:**
1. Deploy kontrak via Hardhat (`npm run deploy:testnet`)
2. Jalankan exploit + mitigasi via Hardhat tests (`npm test`)
3. Buka CEI Analyzer (`npm run dev` di `cei-analyzer/`)
4. Paste kontrak Solidity → Analisis CEI via Deepseek API
5. Bandingkan hasil dengan Slither reports di `slither/`
6. Export hasil analisis sebagai JSON untuk lampiran skripsi

### 13.4 Fitur Detail yang Diimplementasikan

✅ **Single Analysis Tab** — Textarea input + Quick Load buttons (InsecureVault, SecureVault, MutexVault)  
✅ **Compare Contracts Tab** — Dua textarea side-by-side + Promise.all untuk parallel API call  
✅ **CEI Order Flow** — Visualisasi horizontal flow dengan highlight violation  
✅ **Classified Lines Table** — Warna badge: 🔵 CHECKS, 🟡 EFFECTS, 🔴/🟢 INTERACTIONS  
✅ **Security Score Bar** — Warna progress: 🟢 ≥80, 🟡 ≥50, 🔴 <50  
✅ **Export JSON** — Download hasil analisis sebagai `.json`  
✅ **Loading Spinner** — Animasi saat menunggu response API  
✅ **Error Handling** — Parse error, network error, empty input guard  
✅ **Responsive Layout** — Mobile-friendly (grid collapse on small screens)  
✅ **Dark Theme** — Tailwind `gray-950` background, nyaman untuk akademik  

### 13.5 API Integration

| Item | Detail |
|------|--------|
| **Endpoint** | `POST https://api.deepseek.com/chat/completions` |
| **Model** | `deepseek-chat` |
| **System Prompt** | CEI Expert Analyzer (lihat Section 4.3) |
| **Auth** | `Bearer` token via `VITE_DEEPSEEK_API_KEY` dari `.env` |
| **Max Tokens** | 1500 |
| **Fungsi Core** | `analyzeWithDeepseek(code)` di `App.jsx` |

**Env file:** `cei-analyzer/.env`
```env
VITE_DEEPSEEK_API_KEY=sk-your-key-here
```

**Cara akses di kode:**
```javascript
const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY
// Header Authorization: Bearer ${apiKey}
```

> ⚠️ Vite hanya mengekspos env dengan prefix `VITE_` ke frontend.
> Key disimpan di `cei-analyzer/.env` (bukan root `.env`) agar Vite bisa membacanya.

### 13.6 State React (useState)

```javascript
// Single Analysis
const [solidityCode, setSolidityCode] = useState('');
const [analysisResult, setAnalysisResult] = useState(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);

// Compare Mode
const [leftCode, setLeftCode] = useState(INSECURE_VAULT);
const [rightCode, setRightCode] = useState(SECURE_VAULT);
const [leftResult, setLeftResult] = useState(null);
const [rightResult, setRightResult] = useState(null);
const [isCompareLoading, setIsCompareLoading] = useState(false);

// Tab
const [activeTab, setActiveTab] = useState('single'); // 'single' | 'compare'
```

### 13.7 Preset Kontrak (Quick Load)

Tiga preset tersedia sebagai tombol quick-load:

| Tombol | Kontrak | Status CEI |
|--------|---------|------------|
| `InsecureVault` | Interactions sebelum Effects | 🔴 VULNERABLE |
| `SecureVault` | CEI Pattern (Checks → Effects → Interactions) | 🟢 SECURE |
| `MutexVault` | Interactions sebelum Effects + ReentrancyGuard | 🟢 SECURE (mutex) |

### 13.8 Deployment

Untuk deployment production:
```bash
cd cei-analyzer
npm run build
# Hasil build di folder dist/
# Deploy ke Vercel / Netlify / GitHub Pages
```

---

### 13.9 Perubahan v2.1 — Google Modern Design + API Key Fix

#### 🔑 API Key Fix

| Sebelum | Sesudah |
|---------|---------|
| Tidak ada header Authorization | `Authorization: Bearer ${VITE_DEEPSEEK_API_KEY}` |
| Key tidak bisa dibaca Vite | `.env` dibuat di `cei-analyzer/.env` dengan prefix `VITE_` |
| Model `DeepseekV4Pro` | Model `deepseek-chat` (valid) |
| Tidak ada error handling HTTP | `if (!response.ok)` dengan detail error |

#### 🎨 Google-Inspired Modern Design

| Fitur | Detail |
|-------|--------|
| **Theme** | Light/Dark mode toggle dengan Google color palette |
| **Google Colors** | Blue `#1a73e8`, Red `#d93025`, Green `#188038`, Yellow `#f9ab00` |
| **Dark Mode** | `bg-[#202124]` / `bg-[#292a2d]` — material dark surface |
| **Light Mode** | `bg-white` / `bg-[#f8f9fa]` — Google clean white |
| **Logo** | Google-colored SVG logo (multi-color) |
| **Toggle** | Custom toggle button with sun/moon icon |
| **Typography** | Google Sans (system fallback) + Google Sans Mono untuk code |
| **Cards** | Rounded-xl (`border-radius: 12px`) with Google-style shadows |
| **Tabs** | Material-style underline tabs dengan animasi |
| **Badges** | Google color-coded (light bg + colored text + border) |
| **Score Bar** | Smooth CSS transition (`cubic-bezier` ease-out) |
| **Animation** | `fadeInUp` untuk result panel, `pulse-dot` untuk status |
| **Buttons** | Material ripple effect + scale feedback on click |
| **Scrollbar** | Custom thin scrollbar (matches theme) |
| **Persistence** | Theme disimpan di `localStorage` |

**Komponen visual baru:**
- `ThemeToggle` — Google Material-style switch with sun/moon SVG icons
- `CeiLogo` — Menampilkan `logo_cei.png` dari `/public`
- `PresetButton` — Rounded-full pills with Google accent colors
- `Spinner` — Dual-ring animated spinner
- `Ripple` — Material ripple effect on buttons
- `animate-fade-in-up` — Slide-up fade animation untuk content

#### 📐 Layout Update

```
┌─────────────────────────────────────────────────────────────┐
│  [🔷 CEI Logo]  CEI Pattern Analyzer    [🌙/☀️ Toggle]      │
│  ─────────────────────────────────────────────────────────  │
│  [● Single Analysis]  [⇄ Compare Contracts]                │
├─────────────────────────────────────────────────────────────┤
│  Left Panel (Input)          Right Panel (Result)           │
│  ┌─────────────────────┐    ┌─────────────────────────┐    │
│  │ ● ● ●  filename.sol │    │  function withdrawFunds │    │
│  │ ┌─────────────────┐ │    │  [Vulnerable] [Export]  │    │
│  │ │ Solidity code   │ │    │                         │    │
│  │ │                 │ │    │  Security Score: 45/100 │    │
│  │ │                 │ │    │  ████████░░░░░░░░░░░░  │    │
│  │ └─────────────────┘ │    │                         │    │
│  │ [Analyze →]         │    │  CEI Flow: [CHECKS] →  │    │
│  └─────────────────────┘    │  [INTERACTIONS⚠️] →     │    │
│                              │  [EFFECTS]             │    │
│  Quick Load:                 │                         │    │
│  [InsecureVault] [Secure]    │  ┌───Table──────────┐  │    │
│  [MutexVault]                │  │ Ln │ Snippet │Cat │  │    │
│                              │  └──────────────────┘  │    │
│                              └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

*Bagian 13 ditambahkan untuk dokumentasi integrasi fitur CEI Analyzer ke dalam proyek riset.*  
*Versi: 2.1 — Google Modern Design + API Key Fix + Custom CEI Logo | Mei 2026*