import matplotlib.pyplot as plt
import numpy as np

# Data Siklus Escrow Lengkap
kategori = [
    'Deploy\nKontrak', 
    'createOrder()', 
    'depositFunds()', 
    'confirmDelivery()', 
    'withdrawFunds()', 
    'Total\n(Operasional)', 
    'Total\n(Ops + Deploy)' # Teks disingkat sedikit agar lebih ringkas
]

gas_cei = [597229, 95421, 94333, 30440, 29950, 250144, 847373]
gas_mutex = [652666, 95421, 94333, 30440, 32363, 252557, 905223]

x = np.arange(len(kategori))
lebar = 0.35  

# Canvas 14x8 dengan resolusi tinggi untuk ruang lebih luas
fig, ax = plt.subplots(figsize=(14, 8), dpi=300)

rects1 = ax.bar(x - lebar/2, gas_cei, lebar, label='SecureVault (Pola CEI)', color='#1f77b4', edgecolor='black')
rects2 = ax.bar(x + lebar/2, gas_mutex, lebar, label='MutexVault', color='#aec7e8', edgecolor='black')

# Ukuran font label dan judul dikecilkan agar proporsional
ax.set_ylabel('Konsumsi Gas (Unit Gas)', fontsize=10, fontweight='bold')
ax.set_title('Perbandingan Konsumsi Gas pada Siklus Escrow Lengkap', fontsize=12, fontweight='bold', pad=15)

# --- PERBAIKAN OVERLAP SUMBU X ---
ax.set_xticks(x)
# Teks sumbu X dimiringkan 45 derajat dan rata kanan untuk jarak maksimal
ax.set_xticklabels(kategori, fontsize=8.5, rotation=45, ha='right')

# --- PERBAIKAN FORMAT SUMBU Y ---
# Mematikan format scientific (1e6) agar angka terlihat utuh
ax.ticklabel_format(style='plain', axis='y')
ax.tick_params(axis='y', labelsize=10)
# Batas atas dinaikkan ke 1.100.000 agar grafik tertinggi aman
ax.set_ylim(0, 1100000)
ax.grid(axis='y', linestyle='--', alpha=0.5)

# --- PERBAIKAN ANGKA DI ATAS BALOK ---
def tambah_label_angka(rects):
    for rect in rects:
        tinggi = rect.get_height()
        # Jika nilai sangat kecil, letakkan lebih tinggi agar tidak menempel garis
        offset_y = 8 if tinggi > 50000 else 15

        ax.annotate(f'{tinggi:,}'.replace(',', '.'),
                    xy=(rect.get_x() + rect.get_width() / 2, tinggi),
                    xytext=(0, offset_y),
                    textcoords="offset points",
                    ha='center', va='bottom',
                    fontsize=7, # Font lebih kecil untuk hindari tabrakan
                    fontweight='bold', color='#333333')

tambah_label_angka(rects1)
tambah_label_angka(rects2)

# Legenda dirapikan
ax.legend(loc='upper left', fontsize=10)

# Adjust spacing untuk margin yang lebih baik (hindari label terpotong)
plt.subplots_adjust(left=0.08, right=0.95, top=0.93, bottom=0.15)
plt.tight_layout()
plt.savefig('grafik_atau_diagram/grafik_siklus_escrow_lengkap_rapi.png', dpi=300, bbox_inches='tight')
print("[OK] Grafik berhasil disimpan ke: grafik_atau_diagram/grafik_siklus_escrow_lengkap_rapi.png")