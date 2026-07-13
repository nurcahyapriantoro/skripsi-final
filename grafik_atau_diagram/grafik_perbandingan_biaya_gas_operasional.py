import matplotlib.pyplot as plt
import numpy as np

# Data 30 iterasi
jumlah_iterasi = 30
iterasi = np.arange(1, jumlah_iterasi + 1)

gas_cei = np.full(jumlah_iterasi, 29950) 
gas_mutex = np.full(jumlah_iterasi, 32363)

# Setup canvas buat word A4
fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)

# Plot garis
ax.plot(iterasi, gas_mutex, marker='o', color='#aec7e8', linewidth=2, markersize=5, label='MutexVault (32.363)')
ax.plot(iterasi, gas_cei, marker='s', color='#1f77b4', linewidth=2, markersize=5, label='SecureVault / CEI (29.950)')

# Label sumbu dan judul
ax.set_xlabel('Nomor Iterasi Pengujian', fontsize=11, fontweight='bold')
ax.set_ylabel('Konsumsi Gas (Unit Gas)', fontsize=11, fontweight='bold')
ax.set_title('Konsumsi Gas withdrawFunds() 30 Iterasi', fontsize=13, fontweight='bold', pad=20)

# Bikin rapih sumbu x dan y
ax.set_xticks(np.arange(1, 31, 2))
ax.set_ylim(25000, 37000) 
ax.grid(True, linestyle='--', alpha=0.5)
ax.legend(loc='lower right', fontsize=10)

# --- BAGIAN BARU: NAMPILIN SELISIH ---
# Bikin panah dua arah warna merah di tengah (iterasi ke-15)
ax.annotate('', xy=(15, 32363), xytext=(15, 29950),
            arrowprops=dict(arrowstyle='<->', color='red', lw=1.5))

# Taro teks selisihnya di sebelah kanan panah biar enak dibaca
ax.text(15.5, 31156, 'Selisih:\n2.413 Gas\n(7,46%)', 
        va='center', ha='left', fontsize=10, fontweight='bold', color='red')

# Kotak keterangan deterministik digeser ke kiri atas biar nggak ketabrak teks selisih
ax.text(6, 35500, "Sifat Deterministik Hardhat:\nSimpangan Baku = 0", ha='center', va='center', fontsize=10, 
        fontstyle='italic', bbox=dict(facecolor='white', alpha=0.9, edgecolor='gray', boxstyle='round,pad=0.5'))

# Rapihin dan save
plt.tight_layout()
plt.savefig('grafik_stabilitas_dengan_selisih.png', dpi=300)
plt.show()