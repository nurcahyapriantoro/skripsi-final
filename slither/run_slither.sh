#!/bin/bash
echo "=== Running Slither on InsecureVault ==="
slither ../contracts/vulnerable/InsecureVault.sol \
  --solc-remaps "@openzeppelin=../node_modules/@openzeppelin" \
  --detect reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events \
  --json insecure_vault_report.json \
  --print human-summary

echo ""
echo "=== Running Slither on SecureVault ==="
slither ../contracts/secure/SecureVault.sol \
  --solc-remaps "@openzeppelin=../node_modules/@openzeppelin" \
  --detect reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events \
  --json secure_vault_report.json \
  --print human-summary

echo ""
echo "=== Running Slither on MutexVault ==="
slither ../contracts/secure/MutexVault.sol \
  --solc-remaps "@openzeppelin=../node_modules/@openzeppelin" \
  --detect reentrancy-eth,reentrancy-no-eth \
  --json mutex_vault_report.json \
  --print human-summary

echo ""
echo "=== Slither analysis complete. See JSON reports in slither/ directory ==="
