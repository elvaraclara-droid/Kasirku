// src/paketConfig.js
// ══════════════════════════════════════════════════════════════
// KONFIGURASI PAKET LISENSI — POS (Point of Sale)
// ══════════════════════════════════════════════════════════════
//
// Field per paket:
//   id          — key unik, harus sama dengan nilai kolom 'paket' di tabel lisensi
//   nama        — label tampilan di UI
//   durasi      — hari aktif sejak tgl_mulai (null = selamanya)
//   maksProduk  — maks item di master produk (null = unlimited)
//   maksKasir   — maks akun kasir aktif (null = unlimited)
//   maksCabang  — maks outlet/cabang (null = unlimited)
//   harga       — angka rupiah (untuk kalkulasi & tampilan)
//   hargaStr    — string tampilan harga
//   deskripsi   — subtitle card di Owner Dashboard
//   warna       — hex warna aksen paket
//   warnaLight  — hex warna aksen transparan (background card saat dipilih)
//   popular     — tampilkan badge "POPULER" (opsional)
// ══════════════════════════════════════════════════════════════

export const PAKET_LIST = [
  {
    id:          "starter",
    nama:        "🥉 Starter",
    durasi:      365,
    maksProduk:  500,
    maksKasir:   2,
    maksCabang:  1,
    harga:       250000,
    hargaStr:    "Rp 250.000 / tahun",
    deskripsi:   "Untuk toko kecil & warung",
    warna:       "#CD7F32",
    warnaLight:  "#CD7F3222",
  },
  {
    id:          "growth",
    nama:        "🥈 Growth",
    durasi:      365,
    maksProduk:  2000,
    maksKasir:   5,
    maksCabang:  2,
    harga:       350000,
    hargaStr:    "Rp 350.000 / tahun",
    deskripsi:   "Untuk toko berkembang dengan beberapa kasir",
    warna:       "#94A3B8",
    warnaLight:  "#94A3B822",
  },
  {
    id:          "professional",
    nama:        "🥇 Professional",
    durasi:      365,
    maksProduk:  10000,
    maksKasir:   10,
    maksCabang:  5,
    harga:       450000,
    hargaStr:    "Rp 450.000 / tahun",
    deskripsi:   "Untuk toko menengah aktif & multi-cabang",
    warna:       "#F59E0B",
    warnaLight:  "#F59E0B22",
  },
  {
    id:          "enterprise",
    nama:        "💎 Enterprise",
    durasi:      365,
    maksProduk:  50000,
    maksKasir:   20,
    maksCabang:  10,
    harga:       600000,
    hargaStr:    "Rp 600.000 / tahun",
    deskripsi:   "Untuk bisnis besar dengan banyak outlet",
    warna:       "#3B82F6",
    warnaLight:  "#3B82F622",
  },
  {
    id:          "lifetime",
    nama:        "🚀 Lifetime",
    durasi:      null,     // null = selamanya
    maksProduk:  null,     // null = unlimited
    maksKasir:   null,     // null = unlimited
    maksCabang:  null,     // null = unlimited
    harga:       1000000,
    hargaStr:    "Rp 1.000.000 (selamanya)",
    deskripsi:   "Akses penuh tanpa batas waktu & kuota",
    warna:       "#8B5CF6",
    warnaLight:  "#8B5CF622",
    popular:     true,
  },
];


// ── Helper: ambil paket berdasarkan id ────────────────────────
export function getPaketById(id) {
  return PAKET_LIST.find(p => p.id === id) || null;
}


// ── Helper: format rupiah ─────────────────────────────────────
export function formatRupiah(angka) {
  if (angka === null || angka === undefined) return "-";
  return "Rp " + Number(angka).toLocaleString("id-ID");
}


// ── Helper: hitung tanggal expired dari tgl_mulai + durasi ───
// Mengembalikan string 'YYYY-MM-DD' atau null jika lifetime.
export function hitungTglExpired(tglMulai, durasi) {
  if (!durasi) return null; // lifetime
  const d = new Date(tglMulai);
  d.setDate(d.getDate() + durasi);
  return d.toISOString().slice(0, 10);
}


// ── Helper: sisa hari lisensi ─────────────────────────────────
// Mengembalikan integer hari, atau null jika lifetime.
export function sisaHari(tglExpired) {
  if (!tglExpired) return null; // lifetime
  return Math.ceil((new Date(tglExpired) - new Date()) / (1000 * 60 * 60 * 24));
}


// ── Helper: status lisensi untuk badge UI ─────────────────────
// Mengembalikan { label, warna, warnaLatar }
export function statusLisensi(tglExpired) {
  if (!tglExpired) {
    return { label: "🚀 Lifetime",     warna: "#A78BFA", warnaLatar: "#2e1065" };
  }
  const sisa = sisaHari(tglExpired);
  if (sisa < 0)   return { label: "Expired",             warna: "#EF4444", warnaLatar: "#450a0a" };
  if (sisa <= 7)  return { label: `⚠️ ${sisa} hari lagi`, warna: "#F59E0B", warnaLatar: "#451A03" };
  if (sisa <= 30) return { label: `🕐 ${sisa} hari lagi`, warna: "#FBBF24", warnaLatar: "#3b2800" };
  return           { label: `✅ Aktif`,                   warna: "#4ade80", warnaLatar: "#052e16" };
}


// ── Helper: cek apakah kuota masih tersedia ───────────────────
// Dipakai sebelum tambah produk/kasir/cabang baru.
// jumlahSaatIni = data dari DB, maks = dari lisensi aktif toko.
// null pada maks = unlimited → selalu boleh.
export function cekKuota(jumlahSaatIni, maks) {
  if (maks === null || maks === undefined) return { boleh: true, pesan: "" };
  if (jumlahSaatIni >= maks) {
    return {
      boleh: false,
      pesan: `Kuota penuh (${jumlahSaatIni}/${maks}). Upgrade paket untuk menambah lebih.`,
    };
  }
  return { boleh: true, pesan: "" };
}


// ── Helper: label kuota untuk tampilan di UI ──────────────────
export function labelKuota(jumlah, maks) {
  if (maks === null || maks === undefined) return `${jumlah} / ∞`;
  return `${jumlah} / ${maks}`;
}


// ── Ringkasan fitur per paket (untuk halaman pricing / modal) ─
export const FITUR_LIST = [
  { key: "maksProduk",  label: "Produk",   icon: "📦" },
  { key: "maksKasir",   label: "Kasir",    icon: "👤" },
  { key: "maksCabang",  label: "Cabang",   icon: "🏪" },
  { key: "durasi",      label: "Durasi",   icon: "📅" },
];

export function labelFitur(paket, key) {
  const val = paket[key];
  if (val === null || val === undefined) return "Unlimited";
  if (key === "durasi") return `${val} hari`;
  return val.toLocaleString("id-ID");
}
