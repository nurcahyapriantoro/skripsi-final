const fs = require('fs');
const app = fs.readFileSync('./src/App.jsx', 'utf8');

// Check for Tx inside string quotes (single or double)
const singleQuotes = (app.match(/'<Tx path=[^']*'/g) || []).length;
console.log('Tx in single quotes:', singleQuotes, singleQuotes === 0 ? 'CLEAN' : 'ISSUES');

// Count total Tx usages
const totalTx = (app.match(/Tx path=/g) || []).length;
console.log('Total Tx usages:', totalTx);

console.log('\nRemaining hardcoded Indonesian checks:');
const checks = [
  ['Mengimplementasikan', 'Objective/benefits description'],
  ['Attacker memanfaatkan fungsi', 'Exploit description'],
  ['Ketika smart contract mengirim', 'Mechanism description'],
  ['3.6 juta ETH', 'Impact description'],
  ['zero dependency', 'Case study insight'],
  ['tidak perlu import', 'Case study insight 2'],
  ['tidak ada overhead', 'Case study insight 3'],
  ['TIDAK vulnerable', 'Mutex callout'],
  ['memblokir panggilan', 'Mutex callout 2'],
];
checks.forEach(([text, desc]) => {
  const cnt = (app.match(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (cnt > 0) console.log('  LEFT: "' + text + '" (' + desc + ') - ' + cnt + 'x');
  else console.log('  OK: "' + text + '" (' + desc + ')');
});
