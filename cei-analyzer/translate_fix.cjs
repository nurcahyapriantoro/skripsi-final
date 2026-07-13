const fs = require('fs');
let app = fs.readFileSync('./src/App.jsx', 'utf8');
let tr = fs.readFileSync('./src/translations.js', 'utf8');
let totalCount = 0;

function rep(hardcoded, txPath) {
  const esc = hardcoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const count = (app.match(new RegExp(esc, 'g')) || []).length;
  if (count > 0) {
    app = app.split(hardcoded).join(txPath);
    totalCount += count;
    console.log('  Replaced ' + count + 'x: ' + hardcoded.slice(0, 50));
  } else {
    console.log('  SKIP (not found): ' + hardcoded.slice(0, 50));
  }
}

console.log('=== REPLACING HARDCODED TEXT ===');

// AI vs Slither
rep('Aspek', '<Tx path="aiSlither.aspect" />');
rep("'Kecepatan'", "<Tx path=\"aiSlither.speedLabel\" />");
rep("'Peran Penelitian'", "<Tx path=\"aiSlither.roleLabel\" />");
rep("'Rule-based, pattern matching pada AST'", "<Tx path=\"aiSlither.ruleBasedSlither\" />");
rep("'Semantik berbasis LLM (memahami konteks kode)'", "<Tx path=\"aiSlither.semanticAI\" />");
rep("'✅ Terdeteksi reentrancy-eth flag'", "<Tx path=\"aiSlither.insecureSlither\" />");
rep("'✅ Tidak ada flag (clean report)'", "<Tx path=\"aiSlither.secureSlither\" />");
rep("'✅ Score: 100/100, CEI compliant'", "<Tx path=\"aiSlither.secureAI\" />");
rep("'⚠️ Mungkin false positive'", "<Tx path=\"aiSlither.mutexSlither\" />");
rep('✅ Nuanced: "CEI violated tapi dilindungi nonReentrant"', '<Tx path="aiSlither.mutexAI" />');
rep("'JSON flag + severity'", "<Tx path=\"aiSlither.outputSlither\" />");
rep("'Classified lines + rekomendasi + score'", "<Tx path=\"aiSlither.outputAI\" />");
rep("'❌ Tidak ada'", "<Tx path=\"aiSlither.contextSlither\" />");
rep("'✅ Penjelasan per baris + rekomendasi'", "<Tx path=\"aiSlither.contextAI\" />");
rep("'2-5 detik (API call)'", "<Tx path=\"aiSlither.speedAI\" />");
rep("'✅ Score: 20/100, CEI violated'", "<Tx path=\"aiSlither.insecureAI\" />");

// Project info - direct text replacements
rep('Program Studi', '<Tx path="project.info1" />');
rep('Ilmu Komputer IPB', '<Tx path="project.info1v" />');
rep('Peneliti', '<Tx path="project.info2" />');
rep('Pembimbing', '<Tx path="project.info3" />');
rep('Tahun', '<Tx path="project.info4" />');

// Gas description
rep('Data dari 30 iterasi pengujian Hardhat (lingkungan EVM deterministik) — divalidasi dengan transaksi on-chain di Sepolia Testnet. Hardhat menghasilkan nilai identik karena state & parameter konstan, wajar untuk EVM lokal (proposal Section 2.8).', '<Tx path="gas.desc" />');

// Opcode table
rep('Keterangan', '<Tx path="opcode.description" />');
rep('Storage write (mahal: ~5000-20000 gas)', '<Tx path="opcode.sstoreDesc" />');
rep('Storage read (~100-2100 gas)', '<Tx path="opcode.sloadDesc" />');
rep('Total instruksi opcode per eksekusi', '<Tx path="opcode.totalDesc" />');
rep('Mutex menambahkan 2 SSTORE ekstra (locked=true di awal, locked=false di akhir) dan 1 SLOAD tambahan untuk cek mutex status.', 'Mutex <Tx path="opcode.overheadNote" />');

// Statistical test section
rep('📊 Hasil Uji Hipotesis', '<Tx path="gas.testTitleFull" />');
rep('Perbandingan Opcode Storage', '<Tx path="gas.opcodeCompTitle" />');
rep('Kasus Khusus: Data Konstan (Zero Variance)', '<Tx path="gas.specialCase" />');
rep('Hasil Uji Utama (Perbandingan Deterministik)', '<Tx path="gas.mainResult" />');
rep('CEI: 30/30 iterasi = 29.950 gas (std dev = 0) — DETERMINISTIK', '<Tx path="gas.ceiConstResult" />');
rep('Mutex: 30/30 iterasi = 32.363 gas (std dev = 0) — DETERMINISTIK', '<Tx path="gas.mutexConstResult" />');
rep('Karena semua nilai identik, uji statistik parametrik tidak diperlukan.', '<Tx path="gas.noTestNeeded" />');
rep('CEI secara deterministik LEBIH RENDAH dari Mutex (29.950 < 32.363)', 'CEI <Tx path="gas.deterministicLower" /> (29.950 < 32.363)');
rep('CEI: SSTORE=1, SLOAD=1, Total Opcodes=132 per eksekusi', '<Tx path="gas.ceiOpcodes" />');
rep('Mutex: SSTORE=3, SLOAD=2, Total Opcodes=165 per eksekusi', '<Tx path="gas.mutexOpcodes" />');
rep('Mutex menambah 2 SSTORE (lock/unlock) + 1 SLOAD + 33 opcode ekstra', '<Tx path="gas.mutexExtra" />');
rep('CEI Mean = 29.950 gas | Mutex Mean = 32.363 gas', '<Tx path="gas.meanComparison" />');
rep('Selisih: 32.363 - 29.950 = 2.413 gas (7.46% lebih hemat)', '<Tx path="gas.savingsDiff" />');
rep('p-value < 0.000 (one-tailed, deterministic) — H₀ DITOLAK ✅', '<Tx path="gas.pValue" />');
rep("Cohen's d = inf (effect size deterministik — sangat besar)", '<Tx path="gas.cohensD" />');
rep('Kesimpulan: H₀ DITOLAK', '<Tx path="gas.conclusion" />');

// Exploit section brief descriptions (these need to match exactly)
rep('Exploitation: <Tx path="problem.exploit" /></strong> <Tx path="problem.exploitDesc" /></p>', '<Tx path="problem.exploitDesc" />');

// Save
fs.writeFileSync('./src/App.jsx', app);
console.log('\nTotal replacements: ' + totalCount);
console.log('Done!');
