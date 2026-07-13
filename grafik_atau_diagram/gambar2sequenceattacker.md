sequenceDiagram
    autonumber
    actor Penyerang as Penyerang
    participant A as Attacker.sol
    participant IV as InsecureVault.sol

    Note over Penyerang,IV: Setup: Penyerang deposit 0,1 ETH<br/>Saldo vault = 2,4 ETH (honeypot)

    Penyerang->>A: memanggil attack()
    A->>IV: withdrawFunds()
    Note right of IV: CHECKS: require(balance > 0) ✓<br/>balance = 0,1 ETH → lolos
    IV-->>A: .call{value: 0,1 ETH}("")
    Note right of IV: ⚠️ State BELUM diperbarui<br/>balances[attacker] masih 0,1 ETH

    loop 24x iterasi reentrancy (sampai vault kosong)
        A->>IV: receive() memanggil withdrawFunds()
        Note right of IV: CHECKS: require(balance > 0) ✓<br/>masih lolos karena state lama
        IV-->>A: .call{value: 0,1 ETH}("")
    end

    Note right of IV: Gas habis / vault kosong → berhenti
    IV->>IV: balances[attacker] = 0
    Note over Penyerang,IV: Hasil: vault terkuras 2,4 ETH → 0 ETH<br/>Keuntungan ilegal penyerang: 2,3 ETH