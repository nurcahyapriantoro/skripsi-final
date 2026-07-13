flowchart TB
 subgraph USER["👤 Pengguna"]
        U1["Tempel kode Solidity\n(fungsi withdrawFunds)"]
  end
 subgraph FRONTEND["🖥️ React Frontend\n(antarmuka web)"]
        F1["Form input kode Solidity"]
        F2["Tampilan hasil:\n• Klasifikasi per baris\n• Skor keamanan 0–100\n• Rekomendasi perbaikan"]
  end
 subgraph API["☁️ DeepSeek API\n(model: deepseek-chat)"]
        A1["System prompt:\nAuditor Solidity CEI Pattern\nOutput format: JSON terstruktur"]
        A2["Klasifikasi setiap baris:\nCHECKS / EFFECTS / INTERACTIONS"]
        A3["Evaluasi urutan CEI\n→ hitung skor keamanan"]
  end
 subgraph OUTPUT["Hasil Analisis"]
        O1["Skor tinggi (≈100)\nUrutan CHECKS→EFFECTS→INTERACTIONS\n✅ CEI terpenuhi"]
        O2["Skor rendah (≈0–30)\nUrutan INTERACTIONS sebelum EFFECTS\n❌ Rentan reentrancy"]
  end
    U1 --> F1
    F1 -- "HTTP POST\nJSON {code: ...}" --> A1
    A1 --> A2
    A2 --> A3
    A3 -- Response JSON\n{lines[], score, recommendation} --> F2
    F2 --> O1 & O2

     U1:::user
     F1:::front
     F2:::front
     A1:::api
     A2:::api
     A3:::api
     O1:::out
     O2:::out
    classDef user fill:#eeedfe,stroke:#534ab7,color:#26215c
    classDef front fill:#e1f5ee,stroke:#0f6e56,color:#04342c
    classDef api fill:#e6f1fb,stroke:#185fa5,color:#042c53
    classDef out fill:#faeeda,stroke:#ba7517,color:#412402
    style FRONTEND fill:transparent