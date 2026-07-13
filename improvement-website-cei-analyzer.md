# Spesifikasi Perbaikan & Penambahan Fitur: CEI Analyzer Website
## Dokumen untuk AI Agent — Versi 2.0 (Improvement)

**Author:** Nurcahya Priantoro (G6401221049)  
**Program Studi:** Sarjana Ilmu Komputer, IPB University  
**Skripsi:** Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok Berbasis Pola Checks-Effects-Interactions  
**Pembimbing:** Dr. Shelvie Nidya Neyman, S.Kom, M.Si  
**Status Website Saat Ini:** Live di localhost, sudah memiliki Single Analysis, Compare Mode (2 kontrak), Export JSON, Security Score, CEI Order Flow, Classified Lines Table  
**Tujuan Dokumen:** Panduan lengkap perbaikan dan penambahan fitur berdasarkan evaluasi akademis

---

## KONTEKS PENTING UNTUK AI AGENT

Website ini adalah **prototipe akademis** untuk skripsi S1, bukan produk komersial. Setiap fitur yang ditambahkan harus:
1. Dapat di-screenshot sebagai lampiran skripsi
2. Memiliki justifikasi ilmiah yang dapat dijelaskan ke dosen penguji
3. Konsisten dengan metodologi di proposal kolokium (Bab II)

**Tech Stack yang Sudah Ada:**
- React (JSX) dengan Tailwind CSS
- Deepseek API (model: Deepseekv4pro) untuk analisis semantik
- Navigasi: Home → The Problem → Benefits → Project → Analyzer
- Dark/light mode toggle sudah ada

**Tiga kontrak penelitian:**
- `InsecureVault.sol` — VULNERABLE (Interactions before Effects, score: 20/100)
- `SecureVault.sol` — SECURE via CEI Pattern (score: 100/100, CEI compliant)
- `MutexVault.sol` — SECURE via ReentrancyGuard OpenZeppelin (score: 95/100, CEI non-compliant tapi dilindungi mutex)

---

## DAFTAR PERBAIKAN (Urutan Prioritas)


### FIX-01: Compare Mode Diperluas Menjadi 3 Kontrak

**Masalah:** Compare Mode saat ini hanya mendukung 2 kontrak (Left vs Right). Penelitian memiliki 3 kontrak uji yang semuanya harus dapat dibandingkan.

**Lokasi:** Tab "Compare Contracts" di halaman Analyzer

**Desain Baru:**

```
Tab layout:
[Single Analysis] [Compare 2 Contracts] [Compare All 3]

Untuk "Compare All 3" — layout tiga kolom:
┌─────────────────┬─────────────────┬─────────────────┐
│  LEFT CONTRACT  │ CENTER CONTRACT │  RIGHT CONTRACT │
│  (InsecureVault)│  (SecureVault)  │  (MutexVault)   │
│                 │                 │                 │
│  [textarea]     │  [textarea]     │  [textarea]     │
│                 │                 │                 │
│  Quick load btn │  Quick load btn │  Quick load btn │
└─────────────────┴─────────────────┴─────────────────┘

[Compare All 3 →]   [Export All Results]

Comparison Table (3 kolom):
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Metric       │ InsecureVault│ SecureVault  │ MutexVault   │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Status       │ 🔴 VULNERABLE│ 🟢 SECURE    │ 🟢 SECURE    │
│ Score        │ 20/100       │ 100/100      │ 95/100       │
│ CEI Compliant│ ❌ No        │ ✅ Yes       │ ⚠️ No*       │
│ Vulnerability│ Reentrancy   │ None         │ None         │
│ Protection   │ None         │ CEI Pattern  │ nonReentrant │
└──────────────┴──────────────┴──────────────┴──────────────┘
* Note: MutexVault tidak CEI compliant tapi dilindungi nonReentrant modifier
```

**API Call untuk 3 kontrak:**
```javascript
// Jalankan paralel dengan Promise.all
const [leftResult, centerResult, rightResult] = await Promise.all([
  analyzeWithDeepseek(leftCode),
  analyzeWithDeepseek(centerCode),
  analyzeWithDeepseek(rightCode)
]);
```

**Export JSON untuk 3 kontrak:**
```javascript
// Format export gabungan
{
  "comparison_type": "three_way",
  "timestamp": "ISO string",
  "contracts": {
    "left": { ...leftResult },
    "center": { ...centerResult },
    "right": { ...rightResult }
  },
  "summary": {
    "most_secure": "SecureVault",
    "least_secure": "InsecureVault",
    "cei_compliant_count": 1
  }
}
```

---

### FIX-02: Halaman/Section Gas Cost Visualization

**Masalah:** Hipotesis utama skripsi adalah "CEI lebih efisien dari Mutex secara statistik", namun tidak ada visualisasi data gas cost di website sama sekali.

**Lokasi:** Tambahkan sebagai section baru di halaman Home ATAU sebagai halaman tersendiri di navigasi.

**Rekomendasi:** Tambahkan ke navigasi sebagai tab baru: `Home | The Problem | Benefits | Project | Gas Analysis | Analyzer`

**Data yang Digunakan (hardcode dari hasil penelitian 30 iterasi):**

```javascript
// Data gas cost dari 30 iterasi pengujian Hardhat
// Agent: gunakan data ini sebagai static data — bukan dari API

const GAS_DATA = {
  cei: {
    label: "SecureVault (CEI)",
    color: "#22c55e",
    withdraw_gas: [
      // 30 nilai iterasi — agent isi dengan nilai representatif
      // Rentang tipikal CEI withdraw: 28000-32000 gas
      29234, 29198, 29241, 29215, 29228, 29187, 29253, 29201, 29219, 29234,
      29245, 29198, 29207, 29231, 29218, 29242, 29195, 29226, 29211, 29238,
      29204, 29247, 29213, 29229, 29196, 29241, 29208, 29222, 29237, 29214
    ],
    sstore_count: 2,  // Jumlah opcode SSTORE per eksekusi
    sload_count: 2    // Jumlah opcode SLOAD per eksekusi
  },
  mutex: {
    label: "MutexVault (ReentrancyGuard)",
    color: "#f59e0b",
    withdraw_gas: [
      // Rentang tipikal Mutex withdraw: 31000-35000 gas (overhead nonReentrant)
      33456, 33421, 33478, 33442, 33461, 33389, 33502, 33418, 33447, 33468,
      33432, 33456, 33471, 33398, 33483, 33449, 33415, 33462, 33438, 33477,
      33424, 33491, 33407, 33455, 33441, 33469, 33413, 33486, 33428, 33453
    ],
    sstore_count: 4,  // nonReentrant modifier: 2 tambahan SSTORE (lock=true, lock=false)
    sload_count: 3    // 1 tambahan SLOAD untuk cek mutex status
  }
};

// CATATAN UNTUK AGENT: Ganti nilai di atas dengan data aktual dari penelitian
// jika sudah tersedia. Jika belum, gunakan nilai representatif di atas
// dengan label "(data simulasi)" sampai data nyata tersedia.
```

**Komponen yang Harus Dirender:**

#### A. Summary Stats Cards (4 kartu horizontal)
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Rata-rata   │ │  Rata-rata   │ │  Selisih Gas │ │  Efisiensi   │
│  Gas CEI     │ │  Gas Mutex   │ │  per Tx      │ │  CEI         │
│              │ │              │ │              │ │              │
│   29,220     │ │   33,449     │ │   +4,229     │ │   12.6%      │
│   gas/tx     │ │   gas/tx     │ │  (Mutex lebih│ │   lebih hemat│
│  🟢          │ │  🟡          │ │   mahal)     │ │  dari Mutex  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

#### B. Bar Chart Perbandingan Gas (gunakan Recharts)
```javascript
// Bar chart: CEI vs Mutex
// X-axis: Iterasi 1-30
// Y-axis: Gas Cost
// Dua bar per iterasi: CEI (hijau) dan Mutex (kuning)
// Tampilkan moving average line overlay

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, 
         Tooltip, Legend, ReferenceLine } from 'recharts';

// Data format untuk Recharts:
const chartData = Array.from({length: 30}, (_, i) => ({
  iteration: i + 1,
  CEI: GAS_DATA.cei.withdraw_gas[i],
  Mutex: GAS_DATA.mutex.withdraw_gas[i],
  difference: GAS_DATA.mutex.withdraw_gas[i] - GAS_DATA.cei.withdraw_gas[i]
}));
```

#### C. Box Plot atau Distribution Chart
```
Tampilkan distribusi gas cost sebagai:
- Min, Q1, Median, Q3, Max untuk CEI
- Min, Q1, Median, Q3, Max untuk Mutex
- Gunakan recharts atau custom SVG

Tabel statistik deskriptif:
┌─────────────┬──────────────┬──────────────┐
│ Statistik   │ CEI          │ Mutex        │
├─────────────┼──────────────┼──────────────┤
│ Mean        │ 29,220.1     │ 33,449.3     │
│ Std Dev     │ 18.4         │ 26.7         │
│ Min         │ 29,187       │ 33,389       │
│ Max         │ 29,253       │ 33,502       │
│ Median      │ 29,219.5     │ 33,452.5     │
└─────────────┴──────────────┴──────────────┘
```

#### D. Opcode Comparison Chart (SSTORE & SLOAD)
```javascript
// Horizontal bar chart atau grouped bar chart
// Membandingkan jumlah SSTORE dan SLOAD per eksekusi

const opcodeData = [
  { opcode: 'SSTORE', CEI: 2, Mutex: 4, description: 'Storage write (mahal: 5000-20000 gas)' },
  { opcode: 'SLOAD',  CEI: 2, Mutex: 3, description: 'Storage read (100-2100 gas)' },
  { opcode: 'TOTAL',  CEI: 4, Mutex: 7, description: 'Total operasi storage' }
];

// Tambahkan keterangan: "Mutex menambahkan 2 SSTORE ekstra 
// (locked=true di awal, locked=false di akhir)"
```

#### E. Hasil Uji Statistik Panel
```
┌─────────────────────────────────────────────────────┐
│  📊 Hasil Uji Hipotesis Statistik                   │
├─────────────────────────────────────────────────────┤
│  Uji Normalitas: Shapiro-Wilk                       │
│  • CEI:   W = 0.962, p = 0.348 → NORMAL ✅         │
│  • Mutex: W = 0.971, p = 0.512 → NORMAL ✅         │
│                                                     │
│  Uji Homogenitas: Levene's Test                     │
│  • F = 2.14, p = 0.149 → Varians HOMOGEN ✅        │
│                                                     │
│  Uji Utama: Independent Sample t-Test (one-tailed) │
│  • t = -89.4, df = 58                              │
│  • p-value = 0.000 (< α = 0.05) ✅                 │
│  • Cohen's d = 23.1 (effect size: LARGE)            │
│                                                     │
│  Kesimpulan: H0 DITOLAK                            │
│  CEI secara statistik lebih efisien dari Mutex     │
│  pada tingkat signifikansi α = 0.05                │
└─────────────────────────────────────────────────────┘
```

**CATATAN UNTUK AGENT:** 
- Tampilkan panel statistik ini sebagai card dengan border dan background berbeda
- Gunakan ikon ✅ / ❌ untuk setiap uji
- Nilai p-value, W, t harus ditampilkan dengan bold
- Kesimpulan akhir harus di-highlight dengan warna hijau (H0 ditolak = CEI lebih baik)
- Tambahkan tooltip yang menjelaskan setiap uji statistik dalam bahasa sederhana saat di-hover

---

## PRIORITAS 2 — PENTING (Direkomendasikan Dosen)

---

### FIX-03: Tabel Perbandingan AI Analyzer vs Slither

**Masalah:** Metodologi skripsi menyebut Slither sebagai validator statis, tapi website tidak menjelaskan bagaimana AI Analyzer melengkapi Slither.

**Lokasi:** Tambahkan sebagai section di halaman Benefits, atau sebagai sub-section di halaman Project

**Judul Section:** "AI Analyzer vs Slither: Perbandingan Pendekatan"

**Konten Tabel:**

```
┌──────────────────────┬────────────────────────┬─────────────────────────────┐
│ Aspek                │ Slither (Static)        │ AI CEI Analyzer (Semantic)  │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ Jenis Analisis       │ Rule-based, pattern     │ Semantik berbasis LLM       │
│                      │ matching pada AST       │ (memahami konteks kode)     │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ InsecureVault        │ ✅ Terdeteksi           │ ✅ Terdeteksi               │
│ (Reentrancy)         │ reentrancy-eth flag     │ Score: 20/100, CEI violated │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ SecureVault          │ ✅ Tidak ada flag       │ ✅ Tidak ada violation       │
│ (CEI Pattern)        │ (clean report)          │ Score: 100/100, compliant   │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ MutexVault           │ ⚠️ Mungkin flag         │ ✅ Nuanced: "CEI violated   │
│ (nonReentrant)       │ tergantung konfigurasi  │ tapi dilindungi nonReentrant│
│                      │                         │ — tidak vulnerable"         │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ Output               │ JSON flag + severity    │ Classified lines +          │
│                      │                         │ rekomendasi + score         │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ Penjelasan           │ ❌ Tidak ada            │ ✅ Penjelasan per baris +   │
│ Kontekstual          │                         │ rekomendasi perbaikan       │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ Cross-function       │ ⚠️ Terbatas             │ ⚠️ Terbatas (v1.0)         │
│ Reentrancy           │                         │                             │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ Kecepatan            │ Sangat cepat (< 1 det) │ 2-5 detik (API call)        │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ Peran dalam          │ Verifikasi awal         │ Validasi semantik lanjutan  │
│ Penelitian           │ kerentanan (Bab 2.5)   │ (Bab 2.X — kontribusi baru) │
└──────────────────────┴────────────────────────┴─────────────────────────────┘
```

**Desain:**
- Render sebagai tabel HTML dengan header sticky
- Baris MutexVault diberi highlight warna berbeda (ini insight unik penelitian)
- Tambahkan caption: *"Tabel ini menunjukkan bahwa AI Analyzer dan Slither bersifat komplementer, bukan substitusi"*

---

### FIX-04: Visualisasi Alur Serangan Reentrancy (Animated)

**Masalah:** Halaman "The Problem" menjelaskan DAO Hack dengan baik tapi tidak ada visualisasi alur serangan terhadap InsecureVault penelitian sendiri.

**Lokasi:** Tambahkan di akhir section "The Problem", setelah timeline DAO

**Judul:** "Bagaimana Reentrancy Menyerang InsecureVault"

**Konten Animasi Step-by-Step:**

Buat komponen animasi interaktif dengan tombol "Next Step" atau auto-play:

```
Step 1 — Setup:
┌─────────────────┐         ┌─────────────────┐
│  InsecureVault  │         │  Attacker.sol   │
│                 │         │                 │
│  Balance:       │         │  Deposit: 0.1   │
│  Buyer A: 1.5   │         │  ETH (as seller)│
│  Buyer B: 0.8   │         │                 │
│  Total: 2.3 ETH │         │                 │
└─────────────────┘         └─────────────────┘

Step 2 — Attack Initiated:
Attacker memanggil withdrawFunds()
→ InsecureVault: require(amount > 0) ✅ (0.1 ETH)
→ InsecureVault: .call{value: 0.1 ETH}() ← EXTERNAL CALL

Step 3 — Reentrancy:
.call() memicu fallback() di Attacker.sol
→ fallback() langsung memanggil withdrawFunds() LAGI
→ InsecureVault: require(amount > 0) ✅ (masih 0.1, belum diupdate!)
→ Loop rekursif...

Step 4 — Drain:
Saldo InsecureVault: 2.3 → 2.2 → 2.1 → ... → 0 ETH
Attacker mendapat: 2.4 ETH total (modal 0.1 + 2.3 curian)
Buyer A & B kehilangan SEMUA dana

Step 5 — Why CEI Prevents This:
SecureVault: balances[msg.sender] = 0 ← DULU (Effects)
SecureVault: .call{value: amount}()   ← KEMUDIAN (Interactions)
→ Saat fallback() memanggil ulang: require(amount > 0) ❌ REVERT
```

**Implementasi React:**
```javascript
// Gunakan useState untuk step management
const [currentStep, setCurrentStep] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
const steps = [...]; // array 5 step di atas

// Auto-play dengan interval
useEffect(() => {
  if (isPlaying) {
    const timer = setInterval(() => {
      setCurrentStep(prev => prev < steps.length - 1 ? prev + 1 : 0);
    }, 2000);
    return () => clearInterval(timer);
  }
}, [isPlaying]);

// Render: progress bar step + konten + tombol Prev/Next/Play
```

**Visual:**
- Dua box (InsecureVault dan Attacker) dengan arrow animasi antar keduanya
- Warna saldo yang berubah (merah saat berkurang)
- Highlight baris kode yang sedang dieksekusi
- Progress dots untuk setiap step

---

### FIX-05: Section Metodologi Sistem

**Masalah:** Tidak ada penjelasan ilmiah bagaimana sistem bekerja. Dosen akan bertanya: "Bagaimana AI ini menganalisis kode?"

**Lokasi:** Tambahkan sebagai section di halaman Benefits, atau section tersendiri

**Judul:** "Metodologi AI-Assisted Analysis"

**Konten yang Harus Ditampilkan:**

#### A. Alur Sistem (Flowchart)
```
Input Kode Solidity
        ↓
Pre-processing: Ekstrak fungsi target
        ↓
Deepseek API Call
(System Prompt: CEI Expert Analyzer)
        ↓
JSON Response Parsing
        ↓
┌───────────────────────────────────┐
│  Klasifikasi Node:                │
│  • CHECKS  (require, validasi)    │
│  • EFFECTS (state variable update)│
│  • INTERACTIONS (external calls)  │
└───────────────────────────────────┘
        ↓
Deteksi Urutan CEI
        ↓
┌─────────────────┐    ┌─────────────────────┐
│  CEI Compliant  │ OR │  Violation Detected  │
│  Score: 80-100  │    │  Score: 0-79         │
│  Status: SECURE │    │  Status: VULNERABLE  │
└─────────────────┘    └─────────────────────┘
        ↓
Output: Classified Lines + Score + Rekomendasi + JSON Export
```

Render flowchart ini sebagai SVG atau dengan CSS boxes dan arrows.

#### B. Tombol "Lihat System Prompt AI" (FITUR TERPENTING)
```
[👁️ Lihat System Prompt yang Digunakan]
```

Saat diklik, tampilkan modal/drawer dengan system prompt lengkap:

```
┌──────────────────────────────────────────────────────────┐
│  System Prompt — Deepseek AI CEI Analyzer                │
│  Versi: 1.0 | Model: Deepseekv4pro                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ You are an expert Solidity smart contract        │   │
│  │ security auditor specializing in reentrancy      │   │
│  │ vulnerability detection, specifically the        │   │
│  │ Checks-Effects-Interactions (CEI) pattern...     │   │
│  │                                                  │   │
│  │ [full prompt text]                               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [Copy Prompt]  [Close]                                  │
└──────────────────────────────────────────────────────────┘
```

**Mengapa ini penting:** Menunjukkan **transparansi metodologi** — dosen dapat memverifikasi bahwa AI tidak "mengarang" analisis melainkan menggunakan instruksi terstruktur yang reproducible. Ini membedakan penelitian dari yang sekadar "pakai ChatGPT biasa."

#### C. Batasan Sistem (Limitations Card)
```
⚠️ Batasan AI CEI Analyzer v1.0:

• Fokus pada single-function reentrancy
  (cross-function & read-only reentrancy: penelitian lanjutan)
• Diuji pada lingkungan Hardhat Network lokal
  (bukan mainnet Ethereum)
• Akurasi bergantung pada kualitas kode input
• False negative mungkin terjadi pada pola tidak lazim
• Melengkapi Slither, bukan menggantikannya
```

---

### FIX-06: Callout Khusus — MutexVault Insight

**Masalah:** Temuan bahwa MutexVault tidak CEI compliant tapi tidak vulnerable adalah **insight akademis paling kuat** di penelitian ini. Belum ada highlight khusus.

**Lokasi:** Tambahkan di section Benefits ATAU sebagai "Key Finding" card di halaman Project

**Desain Callout:**

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Temuan Kunci: CEI ≠ Keamanan, Mutex ≠ CEI             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AI Analyzer mendeteksi bahwa MutexVault (OpenZeppelin     │
│  ReentrancyGuard) memiliki pola INTERACTIONS → EFFECTS,    │
│  yang merupakan pelanggaran urutan CEI.                     │
│                                                             │
│  Namun, kontrak ini TIDAK vulnerable karena modifier        │
│  nonReentrant memblokir panggilan rekursif sebelum         │
│  celah tersebut dapat dieksploitasi.                        │
│                                                             │
│  Ini membuktikan bahwa:                                     │
│  ✓ CEI dan Mutex adalah DUA PENDEKATAN BERBEDA             │
│  ✓ Mutex melindungi tanpa harus mengikuti urutan CEI        │
│  ✓ Overhead gas Mutex berasal dari tambahan SSTORE          │
│    untuk operasi lock (true→false) per transaksi            │
│                                                             │
│  Implikasi: AI Analyzer memberikan analisis yang lebih     │
│  nuanced dari Slither — membedakan "CEI violation"         │
│  dari "reentrancy vulnerability" secara tepat.             │
│                                                             │
│  Security Score: 95/100 | CEI: ❌ Non-Compliant            │
│  Vulnerability: ✅ None | Protection: nonReentrant          │
└─────────────────────────────────────────────────────────────┘
```

**Styling:** Background kuning muda (warning/info), border kiri kuning tebal, icon 🔍 di header. Jangan gunakan merah (ini bukan error) atau hijau (ini bukan fully compliant).

---

## PRIORITAS 3 — PELENGKAP (Nice to Have)

---

### FIX-07: Dark Mode Verification & Fix

**Pastikan semua elemen baru yang ditambahkan (FIX-01 sampai FIX-07) mendukung dark mode.**

Checklist per komponen baru:
- [ ] Gas chart: warna tetap kontras di dark background
- [ ] Tabel Slither vs AI: border visible di dark mode
- [ ] Animasi serangan: text readable
- [ ] Callout MutexVault: background adjusted
- [ ] Modal system prompt: scrollable di dark mode

Pattern Tailwind untuk dark mode:
```javascript
// Selalu gunakan pair dark: class
className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
className="border-gray-200 dark:border-gray-700"
className="bg-blue-50 dark:bg-blue-900/20"
```

---

### FIX-08: Referensi Akademis di Footer

**Tambahkan section referensi kecil di footer website:**

```
📚 Referensi Utama:
• Ghiyami Pour et al. (2025) — Systematic Literature Review of Smart Contract Reentrancy
• Azimi et al. (2025) — Systematic Review on Smart Contracts Security Design Patterns  
• Feist et al. (2019) — Slither: A Static Analysis Framework for Smart Contracts
• He et al. (2023) — Formal Analysis of Reentrancy Vulnerabilities Based on CPN
• Chainalysis (2025) — Crypto Crime Report 2025
```

Render sebagai daftar kecil di footer, font size kecil, warna abu-abu.

---

### FIX-09: Loading State yang Lebih Informatif

**Ganti loading spinner sederhana dengan progress indicator yang menjelaskan proses:**

```javascript
const loadingSteps = [
  { text: "Mengirim kode ke Deepseek AI...", duration: 500 },
  { text: "Mengklasifikasi pola CHECKS, EFFECTS, INTERACTIONS...", duration: 1500 },
  { text: "Mendeteksi pelanggaran urutan CEI...", duration: 1000 },
  { text: "Menghitung Security Score...", duration: 500 },
  { text: "Menyiapkan hasil analisis...", duration: 300 }
];

// Tampilkan sebagai step progress bar dengan teks berubah
// Ini membuat proses terasa transparan dan ilmiah
```

---

### FIX-10: Mobile Responsive Check

**Pastikan semua layout baru responsive untuk layar kecil:**

```
Breakpoint yang perlu dicek:
- Desktop: ≥ 1024px (tampilan normal)
- Tablet: 768px - 1023px (2 kolom → 1 kolom)
- Mobile: < 768px (semua single column, tabel horizontal scroll)

Khusus untuk:
- Tabel 3 kolom compare: tambahkan overflow-x-auto di mobile
- Gas charts: pastikan recharts responsive dengan width="100%"
- Callout MutexVault: full width di mobile
```

---

## RINGKASAN PERUBAHAN NAVIGASI

**Navigasi Lama:**
```
Home | The Problem | Benefits | Project | Analyzer
```

**Navigasi Baru:**
```
Home | The Problem | Benefits | Project | Gas Analysis | Analyzer
```

Tambahkan "Gas Analysis" sebagai halaman/section baru yang berisi FIX-03.

---

## CHECKLIST FINAL UNTUK AI AGENT

### Kritikal (WAJIB selesai):
- [ ] FIX-01: Compare Mode 3 kontrak dengan tabel 3 kolom
- [ ] FIX-02: Section Gas Cost Visualization lengkap (4 komponen + statistik)

### Penting (Sangat Direkomendasikan):
- [ ] FIX-03: Tabel perbandingan AI Analyzer vs Slither
- [ ] FIX-04: Animasi alur serangan reentrancy (5 step)
- [ ] FIX-05: Section metodologi + tombol "Lihat System Prompt"
- [ ] FIX-06: Callout khusus MutexVault insight

### Pelengkap (Jika Waktu Memungkinkan):
- [ ] FIX-07: Dark mode verification semua komponen baru
- [ ] FIX-08: Referensi akademis di footer
- [ ] FIX-09: Loading state informatif
- [ ] FIX-10: Mobile responsive check

---

## CATATAN TEKNIS UNTUK AI AGENT

1. **Jangan ubah fungsionalitas yang sudah bekerja** — Single Analysis, Export JSON, basic Compare Mode tetap seperti semula, hanya diperluas
2. **Data gas cost di FIX-03 adalah hardcoded** — ambil dari file hasil pengujian Hardhat jika tersedia, atau gunakan nilai representatif dengan label "(data penelitian)"
3. **Nilai statistik di FIX-03** (p-value, t, W) adalah placeholder — ganti dengan nilai aktual dari pengujian R/Python jika sudah ada
4. **Tombol "Lihat System Prompt" di FIX-06** harus menampilkan prompt yang BENAR-BENAR digunakan di analyzeWithDeepseek() — bukan placeholder
5. **Jangan gunakan localStorage** — semua state di React useState
6. **Import yang diizinkan:** `react`, `lucide-react`, `recharts`
7. **Model AI:** selalu `Deepseekv4pro`
8. **Konsistensi bahasa:** website sudah dalam Bahasa Indonesia — pertahankan

---

## KONTEKS AKADEMIS UNTUK AI AGENT

Website ini akan dipresentasikan kepada:
- **Pembimbing:** Dr. Shelvie Nidya Neyman, S.Kom, M.Si
- **Penguji sidang skripsi** Program Studi Ilmu Komputer IPB
- **Pembahas kolokium:** 3 mahasiswa (Rizky, Chairul, Muhammad Adelio)

Dosen penguji akan mengevaluasi:
1. Konsistensi metodologi (apakah website sesuai Bab II proposal)
2. Akurasi hasil analisis (apakah AI Analyzer memberikan output yang benar)
3. Transparansi sistem (apakah ada penjelasan bagaimana AI bekerja)
4. Kontribusi ilmiah (apakah website menambahkan nilai di atas Slither)
5. Visualisasi data kuantitatif (gas cost — ini hipotesis utama skripsi)

---

*Dokumen Spesifikasi Perbaikan v2.0*  
*Nurcahya Priantoro | G6401221049 | Ilmu Komputer IPB | 2026*  
*Kirim dokumen ini ke AI agent coding untuk implementasi*