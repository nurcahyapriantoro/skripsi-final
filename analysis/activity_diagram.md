```mermaid
flowchart TD
    subgraph "InsecureVault (Rentan)"
        A1[withdrawFunds dipanggil] --> A2[amount = balances[msg.sender]]
        A2 --> A3{amount > 0?}
        A3 -->|No| A4[Revert]
        A3 -->|Yes| A5[msg.sender.call{value: amount}]
        A5 --> A6[balances[msg.sender] = 0]
        A6 --> A7[Dana terkirim ✅]
        style A5 fill:#ffcccc,stroke:#ff0000
        linkStyle 3 stroke:#ff0000,stroke-width:2px
    end

    subgraph "SecureVault / MutexVault (Termitigasi - CEI)"
        B1[withdrawFunds dipanggil] --> B2[amount = balances[msg.sender]]
        B2 --> B3{amount > 0?}
        B3 -->|No| B4[Revert]
        B3 -->|Yes| B5[balances[msg.sender] = 0]
        B5 --> B6[msg.sender.call{value: amount}]
        B6 --> B7[Dana terkirim ✅]
        style B5 fill:#ccffcc,stroke:#00cc00
        linkStyle 8 stroke:#00cc00,stroke-width:2px
    end
```
