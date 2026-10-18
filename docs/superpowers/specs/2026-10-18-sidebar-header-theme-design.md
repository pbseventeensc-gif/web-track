# Rencana Desain & Arsitektur UI: Perombakan Sidebar, Header, dan Konfigurasi Warna Tailwind/CSS Utama

**Tanggal:** 2026-10-18  
**Referensi Utama:** `design-system/MASTER.md` & `design-system/web-track/MASTER.md`  
**Gaya Visual:** Swiss Minimalism & Soft Pastel Operational Dashboard (Density 8/10, Motion 5/10, Variance 7/10)

---

## 1. Tujuan & Prinsip Utama (Intent & Why)
Merombak komponen struktural utama aplikasi (**Header**, **Sidebar**, serta **Konfigurasi Warna/Tipografi Tailwind & CSS**) agar selaras penuh dengan token pada `design-system/MASTER.md` dan preferensi warna lembut (*soft pastel tonal surfaces*, tanpa warna solid yang mencolok), menggunakan terminologi bahasa Indonesia profesional, serta menjamin **tidak ada perubahan sedikit pun pada fungsi navigasi maupun izin akses (permission) menu** untuk seluruh peran pengguna.

---

## 2. Batasan & Jaminan Fungsional (Strict Constraints)
1. **Keutuhan Fungsi Navigasi & Hak Akses Menu (100% Preserved):**
   - **Mode Cabang (`isBranchMode`)**: Tetap langsung merender `<KawanLamaTab isDarkMode={isDarkMode} currentUser={currentBranch} isBranchMode={true} />` tanpa menampilkan sidebar internal.
   - **Peran `outbound_role`**: Hanya menampilkan grup *Divisi Pengiriman* dengan menu `outbound` (*Stasiun Pengiriman*), serta kelas responsif `hidden lg:block`.
   - **Peran `checker_role`**: Hanya menampilkan grup *Divisi Pemeriksaan Mutu* dengan menu `checker` (*Stasiun Pemeriksa*), serta kelas responsif `hidden lg:block`.
   - **Peran `packing_role`**: Hanya menampilkan grup *Divisi Pengemasan* dengan menu `paking` (*Stasiun Pengemasan*), serta kelas responsif `hidden lg:block`.
   - **Peran `currentKawanLamaAdmin`**: Menampilkan 3 menu khusus (`label`, `kawan_lama`, `custom_modules`).
   - **Peran `admin` (Administrator Operasional)**: Menampilkan Kelompok 1 (*Produksi & Pemantauan*: `dashboard`, `desk_print`, `design`, `produksi`, `finishing`, `paking`, `close_project`, `pengiriman`) dan Kelompok 2 (*Modul Proyek & Distribusi*: `label`, `kawan_lama` dengan logika kunci `isLocked = item.id === 'kawan_lama' && !currentAdmin`, serta `custom_modules`).
   - **State & Handler**: `activeTab`, `setActiveTab`, `isSidebarCollapsed`, `setIsSidebarCollapsed`, `toggleTheme`, `showScanModal`, dan ketiga tombol keluar sesi (`kl_branch_session`, `kl_special_admin_session`, `kl_admin_session`) tidak boleh berubah perilakunya.
2. **Tanpa Warna Solid (`No Solid Fills`)**:
   - Seluruh elemen di Header dan Sidebar menggunakan permukaan *soft pastel* (`#EFF6FF`, `#E9EFF8`, `#FFF7ED`, `#ECFDF5`, `#FFF1F2`) dengan teks kontras tinggi (`>= 4.5:1`) dan garis tepi halus (`#BFDBFE`, `#DBEAFE`, `#E2E8F0`).
3. **Tipografi Presisi (`Fira Sans` & `Fira Code`)**:
   - Menggunakan `Fira Sans` / `Plus Jakarta Sans` untuk teks navigasi dan antarmuka, serta `Fira Code` untuk label kategori, indikator status, angka, dan kode teknis.

---

## 3. Rincian Perubahan Teknis

### A. Konfigurasi CSS & Tailwind (`src/index.css` & `tailwind.config.js`)
1. **Variabel CSS Global (`:root` & `.dark` di `src/index.css`)**:
   - Mendaftarkan seluruh variabel dari `MASTER.md`:
     - `--color-primary: #2563EB`, `--color-primary-soft: #EFF6FF`
     - `--color-secondary: #3B82F6`
     - `--color-accent: #EA580C`, `--color-accent-soft: #FFF7ED`
     - `--color-background: #F4F8FD`, `--color-foreground: #1E3A8A`
     - `--color-card: #FFFFFF`, `--color-card-foreground: #1E293B`
     - `--color-muted: #E9EFF8`, `--color-muted-foreground: #475569`
     - `--color-border: #BFDBFE`, `--color-destructive: #DC2626`, `--color-ring: #2563EB`
     - Token jarak (`--space-xs` s.d. `--space-3xl`) dan bayangan (`--shadow-sm` s.d. `--shadow-xl`).
   - Menyediakan nilai ekuivalen untuk `.dark` agar mode gelap tetap lembut di mata (`#0A0F1D`, `#111827`, `#1E293B`).
   - Menambahkan dukungan `@media (prefers-reduced-motion: reduce)` sesuai daftar periksa `MASTER.md`.
2. **Ekstensi Tema Tailwind (`tailwind.config.js`)**:
   - Menambahkan keluarga fon `sans`, `mono`, dan `heading` (`Fira Code`).
   - Menambahkan alias warna berbasis variabel CSS (`master-bg`, `master-card`, `master-muted`, `master-border`, `master-primary`, `master-foreground`, `master-accent`) agar komponen dapat menggunakannya secara konsisten.

### B. Perombakan Header (`src/App.jsx`)
1. **Identitas & Status Operasional (Kiri)**:
   - Kotak penampung logo dengan latar `#EFF6FF` (`bg-blue-50/90 dark:bg-blue-950/40`) dan border `#BFDBFE` (`border-blue-200/80 dark:border-blue-800/60`).
   - Lencana kode sistem di atas judul menggunakan `Fira Code` (`PORTAL OPERASIONAL TERPADU`) diikuti judul utama `Sistem Pemantauan Produksi & Distribusi`.
   - Indikator sesi aktif berbentuk kapsul pastel lembut dengan titik status hijau zamrud (`bg-emerald-400`).
2. **Konteks Modul Aktif & Tindakan Cepat (Tengah/Kanan)**:
   - Menampilkan indikator modul yang sedang dibuka saat ini (misal: *Modul Aktif: Dasbor Operasional*) beserta ringkasan jumlah SPK terdaftar dalam lencana `Fira Code` (`bg-[#E9EFF8] text-[#1E40AF] border border-[#BFDBFE]/80`).
   - Menyediakan tombol pintasan `Pemindai QC` (membuka `ScanQCModal` yang sudah ada) untuk pengguna admin internal, berdampingan dengan tombol pengubah tema (`Mode Gelap` / `Mode Terang`) dan tombol keluar sesi beraksen merah muda lembut (`bg-rose-50/90 text-rose-700 border-rose-200/80`).

### C. Perombakan Sidebar (`src/App.jsx`)
1. **Kepala Sidebar**:
   - Menampilkan label `NAVIGASI UTAMA` dengan fon `Fira Code` serta lencana jumlah menu yang tersedia sesuai hak akses pengguna.
   - Tombol pelipat sidebar (`Ringkas Navigasi` / `Perluas Navigasi`) dengan bingkai lembut `#BFDBFE` dan efek sorot halus.
2. **Grup & Item Navigasi**:
   - Setiap grup memiliki pemisah visual halus dan label kategori `Fira Code`.
   - Setiap tombol menu memiliki:
     - Bilah aksen vertikal lembut di sisi kiri saat aktif (`before:w-1 before:bg-blue-500/80`).
     - Kotak ikon berukuran `w-7 h-7 rounded-lg` dengan permukaan pastel lembut (`bg-blue-100/80 text-blue-700` saat aktif, `bg-slate-100/80 text-slate-500` saat tidak aktif).
     - Permukaan tombol aktif menggunakan warna `#EFF6FF` (`bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]`) untuk peran standar, atau palet lembut khusus stasiun kerja (`amber-50/90` untuk Checker, `indigo-50/90` untuk Outbound).
3. **Kaki Sidebar (Footer Status)**:
   - Saat sidebar diperluas (`!isSidebarCollapsed`), menampilkan kartu ringkas berlatar `#E9EFF8`/60 yang memuat informasi hak akses aktif dan indikator sinkronisasi *real-time* Supabase.
