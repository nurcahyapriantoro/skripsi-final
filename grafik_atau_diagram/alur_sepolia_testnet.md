---
config:
  layout: fixed
---
flowchart LR
 subgraph LOKAL["Lingkungan Lokal (Pengembang)"]
        H["Hardhat Network\nNode.js v22.10.0\nSolidity v0.8.28"]
        SC["Skrip Pengujian\n(Ethers.js + Mocha/Chai)"]
  end
 subgraph INFURA["Infura RPC Gateway"]
        RPC["Sepolia RPC Endpoint\nhttps://sepolia.infura.io/v3/..."]
  end
 subgraph SEPOLIA["Sepolia Testnet (Chain ID: 11155111)"]
    direction TB
        IV["InsecureVault.sol\n0xAcb0...8E1b"]
        SV["SecureVault.sol\n0x7112...73c6"]
        ATK["Attacker.sol\n0xC717...511C"]
        MV["MutexVault.sol\n(Chain: Sepolia)"]
  end
 subgraph VALIDASI["Hasil Validasi"]
        R1["✅ Serangan berhasil\n(InsecureVault: 2,4 ETH → 0)"]
        R2["✅ Serangan digagalkan\n(SecureVault: REVERT)"]
        R3["📊 Konsumsi gas\n(Sepolia vs Hardhat)"]
  end
    H -- deploy + \ntransaksi\n(lokal) --> SC
    ATK -. attack() .-> IV
    ATK -. percobaan (gagal) .-> SV & MV
    SEPOLIA --> R1 & R2 & R3
    RPC -- broadcast ke jaringan --> SEPOLIA
    SC -- transaksi \nterenkripsi\nmelalui \nprivate key --> RPC

     H:::lokal
     SC:::lokal
     RPC:::infura
     IV:::vuln
     SV:::kontrak
     ATK:::vuln
     MV:::kontrak
     R1:::validasi
     R2:::validasi
     R3:::validasi
    classDef lokal fill:#eeedfe,stroke:#534ab7,color:#26215c
    classDef infura fill:#e1f5ee,stroke:#0f6e56,color:#04342c
    classDef sepolia fill:#e6f1fb,stroke:#185fa5,color:#042c53
    classDef validasi fill:#faeeda,stroke:#ba7517,color:#412402
    classDef kontrak fill:#eaf3de,stroke:#3b6d11,color:#173404
    classDef vuln fill:#fcebeb,stroke:#a32d2d,color:#501313