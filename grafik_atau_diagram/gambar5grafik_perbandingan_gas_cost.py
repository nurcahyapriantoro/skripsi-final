import matplotlib.pyplot as plt
import numpy as np

# Data dari hasil pengujian gas
kategori = ['withdrawFunds()\n(Per Transaksi)', 'Gas Deployment\n(Satu Kali)', 'Total Siklus Escrow\n(Ops + Deploy)']
gas_cei = [29950, 597229, 847373]
gas_mutex = [32363, 652666, 905223]

x = np.arange(len(kategori))
lebar_batang = 0.35  

# Bikin canvas resolusi tinggi biar nggak pecah pas diprint di kertas A4
fig, ax = plt.subplots(figsize=(9, 6), dpi=300)

# Plot batangnya
rects1 = ax.bar(x - lebar_batang/2, gas_cei, lebar_batang, label='Pola CEI', color='#1f77b4', edgecolor='black')
rects2 = ax.bar(x + lebar_batang/2, gas_mutex, lebar_batang, label='Mutex Lock (ReentrancyGuard)', color='#aec7e8', edgecolor='black')

# Label dan Judul
ax.set_ylabel('Konsumsi Gas (Unit Gas)', fontsize=12, fontweight='bold')
ax.set_title('Perbandingan Biaya Gas: Pola CEI vs Mutex Lock', fontsize=14, fontweight='bold', pad=20)
ax.set_xticks(x)
ax.set_xticklabels(kategori, fontsize=11)

# --- BAGIAN YANG DIPERBAIKI ---
# Kita set paksa batas maksimal sumbu Y jadi 1.100.000
# Biar ada ruang kosong sekitar 20% di atas batang tertinggi buat tempat legenda dan angka
ax.set_ylim(0, 1100000) 

# Legenda ditaruh di kiri atas
ax.legend(fontsize=11, loc='upper left')
ax.grid(axis='y', linestyle='--', alpha=0.5)

# Fungsi buat nampilin angka di atas batang
def tambah_label(rects):
    for rect in rects:
        tinggi = rect.get_height()
        ax.annotate(f'{tinggi:,}',
                    xy=(rect.get_x() + rect.get_width() / 2, tinggi),
                    xytext=(0, 6),  # Jaraknya dinaikin sedikit biar nggak terlalu nempel sama garis batang
                    textcoords="offset points",
                    ha='center', va='bottom', fontsize=10, fontweight='bold')

tambah_label(rects1)
tambah_label(rects2)

# Rapihin layout biar nggak ada yang kepotong
plt.tight_layout()

# Save otomatis jadi file gambar
plt.savefig('grafik_gas_skripsi_revisi.png', dpi=300) 
plt.show()