---
config:
  layout: fixed
---
flowchart LR
 subgraph INSECURE["❌ InsecureVault (Rentan)"]
    direction TB
        I1["1. CHECKS\nrequire(balance > 0)"]
        I2["2. INTERACTIONS\n.call{value: amount}()"]
        I3["3. EFFECTS\nbalances[msg.sender] = 0"]
        I4(["⚠️ Celah Reentrancy\nState belum diperbarui\nsaat call dieksekusi"])
  end
 subgraph CEI["✅ SecureVault (Pola CEI)"]
    direction TB
        C1["1. CHECKS\nrequire(balance > 0)"]
        C2["2. EFFECTS\nbalances[msg.sender] = 0"]
        C3["3. INTERACTIONS\n.call{value: amount}()"]
        C4(["🛡️ Aman\nState sudah = 0\nsebelum call"])
  end
 subgraph MUTEX["✅ MutexVault (Mutex Lock)"]
    direction TB
        M1["1. CHECKS\nrequire(balance > 0)"]
        M2["2. LOCK\n_status = ENTERED\n+2 SSTORE +1 SLOAD"]
        M3["3. INTERACTIONS\n.call{value: amount}()"]
        M4["4. EFFECTS\nbalances[msg.sender] = 0"]
        M5["5. UNLOCK\n_status = NOT_ENTERED\n+1 SSTORE"]
        M6(["🛡️ Aman\nReentry diblokir\noleh status kunci"])
  end
    I1 --> I2
    I2 -.-> I4
    C1 --> C2
    C2 --> C3
    C3 -.-> C4
    M3 --> M4
    M4 --> M5
    M5 -.-> M6
    I4 --> I3
    M1 --> M2
    M2 --> M3

     I1:::vuln
     I2:::vuln
     I3:::vuln
     I4:::warn
     C1:::safe
     C2:::safe
     C3:::safe
     C4:::warn
     M1:::mutex
     M2:::mutex
     M3:::mutex
     M4:::mutex
     M5:::mutex
     M6:::warn
    classDef vuln fill:#fff0ee,stroke:#d85a30,color:#4A1B0C
    classDef safe fill:#e1f5ee,stroke:#0f6e56,color:#04342C
    classDef mutex fill:#e6f1fb,stroke:#185fa5,color:#042C53
    classDef warn fill:#faeeda,stroke:#ba7517,color:#412402
    style I4 stroke:#D50000
    style C4 stroke:#00C853
    style M6 stroke:#00C853
    style CEI fill:transparent,stroke:transparent
    style MUTEX stroke:transparent,fill:transparent
    style INSECURE stroke:transparent,fill:transparent