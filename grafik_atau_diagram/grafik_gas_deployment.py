import matplotlib.pyplot as plt
import numpy as np

# Data dari Tabel 8 (Kontrak Attacker telah dihapus)
nama_kontrak = [
    'SecureVault\n(CEI - Baseline)', 
    'InsecureVault\n(Rentan)', 
    'MutexVault\n(ReentrancyGuard)'
]
gas_deployment = [597229, 604725, 652666]

# Membuat canvas dengan resolusi tinggi (300 DPI) agar standar cetak skripsi tajam
fig, ax = plt.subplots(figsize=(8, 5.5), dpi=300)

# Penyesuaian warna untuk 3 kontrak tersisa
warna = ['#1f77b4', '#ff9896', '#aec7e8']
garis_tepi = 'black'

# Plot grafik batang (lebar batang disesuaikan menjadi 0.4 agar pas dengan 3 data)
bars = ax.bar(nama_kontrak, gas_deployment, color=warna, edgecolor=garis_tepi, width=0.4)

# Label sumbu Y dan Judul Grafik
ax.set_ylabel('Biaya Gas Deployment (Unit Gas)', fontsize=11, fontweight='bold')
ax.set_title('Perbandingan Biaya Gas Deployment Antar Kontrak', fontsize=13, fontweight='bold', pad=20)

# --- PERBAIKAN UKURAN FONT ---
# Mengecilkan ukuran tulisan pada sumbu X menjadi 9.5 agar lebih rapi
ax.tick_params(axis='x', labelsize=9.5)
ax.tick_params(axis='y', labelsize=10)

# Batas atas sumbu Y diatur ke 750.000 agar ada sisa ruang di atas batang tertinggi
ax.set_ylim(550000, 700000)
ax.grid(axis='y', linestyle='--', alpha=0.5)

# Menampilkan label angka di atas setiap batang dengan format titik untuk ribuan Indonesia
for bar in bars:
    tinggi = bar.get_height()
    ax.annotate(f'{tinggi:,}'.replace(',', '.'), 
                xy=(bar.get_x() + bar.get_width() / 2, tinggi),
                xytext=(0, 6),  # Jarak teks dari ujung atas batang
                textcoords="offset points",
                ha='center', va='bottom', fontsize=10, fontweight='bold')

# Menyesuaikan tata letak agar elemen tidak saling bertumpuk
plt.tight_layout()

# Menyimpan hasil grafik dalam format gambar resolusi tinggi
plt.savefig('grafik_biaya_deployment_skripsi.png', dpi=300)
plt.show()