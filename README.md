# Reentrancy Attack Mitigation Research
**Researcher:** Nurcahya Priantoro (G6401221049)  
**Institution:** Institut Pertanian Bogor — Computer Science  
**Supervisor:** Dr. Shelvie Nidya Neyman, S.Kom, M.Si

## Overview
Proof-of-Concept implementation for the thesis:
"Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok Berbasis Pola Checks-Effects-Interactions"

## Quick Start
```bash
npm install
npm run compile
npm test
```

## Project Structure
See `MasterMind.md` for the full directory structure and architecture.

## Contracts
- `InsecureVault.sol` — Deliberately vulnerable supply chain escrow
- `SecureVault.sol` — CEI-mitigated escrow (manual implementation)
- `MutexVault.sol` — Mutex lock escrow (OpenZeppelin ReentrancyGuard)
- `Attacker.sol` — Malicious exploit contract

## Running Static Analysis
```bash
cd slither && ./run_slither.sh
```

## Running Statistical Analysis
```bash
node analysis/collect_gas_data.js
node analysis/opcode_trace.js
python3 analysis/statistical_analysis.py
```
