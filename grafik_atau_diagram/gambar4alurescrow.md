stateDiagram
  direction TB
  [*] --> CREATED:deploy kontrak
  CREATED --> LOCKED:depositFunds()<br>[pembeli deposit ETH]
  LOCKED --> RELEASED:confirmDelivery()<br>[pembeli konfirmasi terima barang]
  RELEASED --> COMPLETED:withdrawFunds()<br>[penjual tarik dana]
  COMPLETED --> [*]
  note right of CREATED 
  Pesanan dibuat oleh pembeli.
        Dana belum masuk kontrak.
  end note
  note right of LOCKED 
  Dana pembeli terkunci di kontrak.
        ⚠️ Titik rawan reentrancy:
        withdrawFunds() di sini.
  end note
  note right of RELEASED 
  Pembeli mengonfirmasi
        barang sudah diterima.
        Penjual boleh menarik dana.
  end note
  note right of COMPLETED 
  Dana berhasil ditarik penjual.
        Siklus escrow selesai.
  end note