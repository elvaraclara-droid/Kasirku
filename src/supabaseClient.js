// src/supabaseClient.js
// ══════════════════════════════════════════════════════════════
// SEMUA FUNGSI DATABASE — POS (Point of Sale)
// ══════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error("❌ VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan di .env");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);


// ══════════════════════════════════════════════════════════════
// OWNER
// ══════════════════════════════════════════════════════════════

/** Login owner via RPC (tidak expose tabel owner ke anon) */
export async function loginOwner(username, password) {
  const { data, error } = await supabase.rpc("cek_login_owner", {
    p_username: username,
    p_password: password,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.berhasil) return null;
  return { username, nama: row.nama_owner };
}

/** Ambil semua toko — via RPC agar tidak kena blok RLS */
export async function fetchAllToko() {
  const { data, error } = await supabase.rpc("owner_get_toko");
  if (error) throw error;
  return data ?? [];
}

/** Aktifkan / nonaktifkan toko — via RPC */
export async function toggleAktifToko(id, aktif) {
  const { error } = await supabase.rpc("owner_toggle_toko", {
    p_id: id,
    p_aktif: aktif,
  });
  if (error) throw error;
}

/** Hapus toko (cascade ke lisensi, kasir, produk, transaksi) — via RPC */
export async function deleteToko(id) {
  const { error } = await supabase.rpc("owner_delete_toko", { p_id: id });
  if (error) throw error;
}

/** Daftarkan toko baru + kasir admin pertama (via RPC — bypass RLS) */
export async function registerToko({
  namaToko, alamat, telepon, email, kode,
  usernameAdmin, passwordAdmin, namaAdmin, paketId,
}) {
  const { data, error } = await supabase.rpc("register_toko", {
    p_kode:           kode.toUpperCase().trim(),
    p_nama:           namaToko,
    p_username_admin: usernameAdmin,
    p_password_admin: passwordAdmin,
    p_nama_admin:     namaAdmin || namaToko,
    p_alamat:         alamat || "",
    p_telepon:        telepon || "",
    p_email:          email || "",
    p_paket:          paketId || "growth",
  });
  if (error) throw error;
  return data?.[0] || data;
}


// ══════════════════════════════════════════════════════════════
// LOGIN KASIR
// ══════════════════════════════════════════════════════════════

/**
 * Login kasir dengan lisensi key (pertama kali / lisensi berubah).
 * Lisensi key disimpan ke DB agar login berikutnya tidak perlu input lagi.
 */
export async function loginKasir(lisensiKey, username, password) {
  const { data, error } = await supabase.rpc("cek_login_kasir_simpan", {
    p_lisensi_key: lisensiKey.toUpperCase().trim(),
    p_username:    username.trim(),
    p_password:    password,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.berhasil) throw new Error(row?.pesan || "Login gagal.");
  return mapSesi(row);
}

/**
 * Login kasir tanpa lisensi key (sudah pernah login, lisensi tersimpan di DB).
 */
export async function loginKasirTanpaLisensi(username, password) {
  const { data, error } = await supabase.rpc("cek_login_kasir_tanpa_lisensi", {
    p_username: username.trim(),
    p_password: password,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.berhasil) throw new Error(row?.pesan || "Login gagal.");
  return mapSesi(row);
}

function mapSesi(row) {
  return {
    kasirId:    row.kasir_id,
    namaKasir:  row.nama_kasir,
    roleKasir:  row.role_kasir,
    tokoId:     row.toko_id,
    namaToko:   row.nama_toko,
    kodeToko:   row.kode_toko,
    logoUrl:    row.logo_url,
    paket:      row.paket,
    tglExpired: row.tgl_expired,
    maksProduk: row.maks_produk,
    maksKasir:  row.maks_kasir,
    maksCabang: row.maks_cabang,
  };
}



// ══════════════════════════════════════════════════════════════
// LISENSI
// ══════════════════════════════════════════════════════════════

/** Generate lisensi key format: LIS-XXXX-XXXX-XXXX */
export function generateLisensiKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `LIS-${seg()}-${seg()}-${seg()}`;
}

/** Ambil semua lisensi (Owner Dashboard) — via RPC */
export async function fetchAllLisensi() {
  const { data, error } = await supabase.rpc("owner_get_lisensi");
  if (error) throw error;
  // Normalisasi ke format yang sama dengan query lama (toko: { nama, kode })
  return (data ?? []).map(l => ({
    ...l,
    id: l.r_id,
    toko_id: l.r_toko_id,
    lisensi_key: l.r_lisensi_key,
    paket: l.r_paket,
    maks_produk: l.r_maks_produk,
    maks_kasir: l.r_maks_kasir,
    maks_cabang: l.r_maks_cabang,
    tgl_mulai: l.r_tgl_mulai,
    tgl_expired: l.r_tgl_expired,
    catatan: l.r_catatan,
    created_at: l.r_created_at,
    toko: { nama: l.r_toko_nama, kode: l.r_toko_kode },
  }));
}

/** Ambil lisensi milik satu toko */
export async function fetchLisensiByToko(tokoId) {
  const { data, error } = await supabase
    .from("lisensi")
    .select("*")
    .eq("toko_id", tokoId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Buat lisensi baru — via RPC */
export async function createLisensi({
  tokoId, lisensiKey, paket,
  maksProduk, maksKasir, maksCabang,
  tglMulai, tglExpired, catatan,
}) {
  const key = lisensiKey || generateLisensiKey();
  const { data, error } = await supabase.rpc("owner_create_lisensi", {
    p_toko_id:     tokoId,
    p_lisensi_key: key,
    p_paket:       paket || "starter",
    p_maks_produk: maksProduk ?? null,
    p_maks_kasir:  maksKasir  ?? null,
    p_maks_cabang: maksCabang ?? null,
    p_tgl_mulai:   tglMulai || new Date().toISOString().slice(0, 10),
    p_tgl_expired: tglExpired || null,
    p_catatan:     catatan || "",
  });
  if (error) throw error;
  return { id: data, lisensi_key: key };
}

/** Update lisensi (perpanjang / upgrade paket) — via RPC */
export async function updateLisensi(id, {
  paket, maksProduk, maksKasir, maksCabang, tglExpired, catatan,
}) {
  const { error } = await supabase.rpc("owner_update_lisensi", {
    p_id:          id,
    p_paket:       paket,
    p_maks_produk: maksProduk ?? null,
    p_maks_kasir:  maksKasir  ?? null,
    p_maks_cabang: maksCabang ?? null,
    p_tgl_expired: tglExpired || null,
    p_catatan:     catatan || "",
  });
  if (error) throw error;
}

/** Hapus lisensi — via RPC */
export async function deleteLisensi(id) {
  const { error } = await supabase.rpc("owner_delete_lisensi", { p_id: id });
  if (error) throw error;
}


// ══════════════════════════════════════════════════════════════
// KASIR (manajemen user per toko)
// ══════════════════════════════════════════════════════════════

/** Ambil semua kasir milik toko — via RPC */
export async function fetchKasirByToko(tokoId) {
  const { data, error } = await supabase.rpc("owner_get_kasir", {
    p_toko_id: tokoId,
  });
  if (error) throw error;
  return (data ?? []).map(k => ({
    id:         k.r_id,
    username:   k.r_username,
    nama:       k.r_nama,
    role:       k.r_role,
    aktif:      k.r_aktif,
    created_at: k.r_created_at,
  }));
}

/** Tambah kasir baru */
export async function tambahKasir({ tokoId, username, password, nama, role = "kasir" }) {
  const { data: existing } = await supabase
    .from("kasir").select("id").eq("toko_id", tokoId).eq("username", username).maybeSingle();
  if (existing) throw new Error("Username sudah digunakan di toko ini.");

  const { data, error } = await supabase
    .from("kasir")
    .insert({ toko_id: tokoId, username, password, nama, role, aktif: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update data kasir */
export async function updateKasir(id, { nama, password, role, aktif }) {
  const updates = { nama, role, aktif, updated_at: new Date().toISOString() };
  if (password) updates.password = password; // hanya update jika diisi
  const { error } = await supabase.from("kasir").update(updates).eq("id", id);
  if (error) throw error;
}

/** Hapus kasir */
export async function hapusKasir(id) {
  const { error } = await supabase.from("kasir").delete().eq("id", id);
  if (error) throw error;
}

/** Owner reset password kasir — via RPC */
export async function ownerResetPasswordKasir(kasirId, passwordBaru) {
  const { error } = await supabase.rpc("owner_reset_password_kasir", {
    p_kasir_id: kasirId,
    p_password: passwordBaru,
  });
  if (error) throw error;
}

/** Hitung jumlah kasir aktif (untuk cek kuota) */
export async function countKasirAktif(tokoId) {
  const { count, error } = await supabase
    .from("kasir")
    .select("id", { count: "exact", head: true })
    .eq("toko_id", tokoId)
    .eq("aktif", true);
  if (error) throw error;
  return count || 0;
}


// ══════════════════════════════════════════════════════════════
// CABANG
// ══════════════════════════════════════════════════════════════

export async function fetchCabangByToko(tokoId) {
  const { data, error } = await supabase
    .from("cabang")
    .select("*")
    .eq("toko_id", tokoId)
    .order("nama");
  if (error) throw error;
  return data;
}

export async function tambahCabang({ tokoId, nama, alamat, telepon }) {
  const { data, error } = await supabase
    .from("cabang")
    .insert({ toko_id: tokoId, nama, alamat: alamat || "", telepon: telepon || "", aktif: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCabang(id, { nama, alamat, telepon, aktif }) {
  const { error } = await supabase
    .from("cabang")
    .update({ nama, alamat, telepon, aktif, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function hapusCabang(id) {
  const { error } = await supabase.from("cabang").delete().eq("id", id);
  if (error) throw error;
}

export async function countCabangAktif(tokoId) {
  const { count, error } = await supabase
    .from("cabang")
    .select("id", { count: "exact", head: true })
    .eq("toko_id", tokoId)
    .eq("aktif", true);
  if (error) throw error;
  return count || 0;
}


// ══════════════════════════════════════════════════════════════
// KATEGORI PRODUK
// ══════════════════════════════════════════════════════════════

export async function fetchKategori(tokoId) {
  const { data, error } = await supabase
    .from("kategori")
    .select("*")
    .eq("toko_id", tokoId)
    .order("nama");
  if (error) throw error;
  return data;
}

export async function tambahKategori({ tokoId, nama, warna }) {
  const { data, error } = await supabase
    .from("kategori")
    .insert({ toko_id: tokoId, nama, warna: warna || "#6B7280" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateKategori(id, { nama, warna }) {
  const { error } = await supabase.from("kategori").update({ nama, warna }).eq("id", id);
  if (error) throw error;
}

export async function hapusKategori(id) {
  const { error } = await supabase.from("kategori").delete().eq("id", id);
  if (error) throw error;
}


// ══════════════════════════════════════════════════════════════
// PRODUK
// ══════════════════════════════════════════════════════════════

/** Ambil semua produk aktif milik toko */
export async function fetchProduk(tokoId, { aktifSaja = true } = {}) {
  let q = supabase
    .from("produk")
    .select("*, kategori(nama, warna)")
    .eq("toko_id", tokoId)
    .order("nama");
  if (aktifSaja) q = q.eq("aktif", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Cari produk berdasarkan nama atau SKU (untuk kasir) */
export async function cariProduk(tokoId, keyword) {
  const { data, error } = await supabase
    .from("produk")
    .select("id, nama, kode_sku, harga_jual, stok, satuan, gambar_url")
    .eq("toko_id", tokoId)
    .eq("aktif", true)
    .or(`nama.ilike.%${keyword}%,kode_sku.ilike.%${keyword}%`)
    .order("nama")
    .limit(20);
  if (error) throw error;
  return data;
}

/** Ambil produk by SKU (untuk scan barcode) */
export async function fetchProdukBySku(tokoId, sku) {
  const { data, error } = await supabase
    .from("produk")
    .select("id, nama, kode_sku, harga_jual, stok, satuan, gambar_url")
    .eq("toko_id", tokoId)
    .eq("kode_sku", sku.trim())
    .eq("aktif", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Tambah produk baru */
export async function tambahProduk({
  tokoId, kategoriId, kodeSku, nama, deskripsi,
  hargaJual, hargaModal, stok, stokMinimum, satuan, gambarUrl,
}) {
  const { data, error } = await supabase
    .from("produk")
    .insert({
      toko_id:      tokoId,
      kategori_id:  kategoriId || null,
      kode_sku:     kodeSku || "",
      nama,
      deskripsi:    deskripsi || "",
      harga_jual:   hargaJual,
      harga_modal:  hargaModal || 0,
      stok:         stok || 0,
      stok_minimum: stokMinimum || 0,
      satuan:       satuan || "pcs",
      gambar_url:   gambarUrl || "",
      aktif:        true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update produk */
export async function updateProduk(id, {
  kategoriId, kodeSku, nama, deskripsi,
  hargaJual, hargaModal, stok, stokMinimum, satuan, gambarUrl, aktif,
}) {
  const { error } = await supabase
    .from("produk")
    .update({
      kategori_id:  kategoriId ?? null,
      kode_sku:     kodeSku,
      nama,
      deskripsi,
      harga_jual:   hargaJual,
      harga_modal:  hargaModal,
      stok,
      stok_minimum: stokMinimum,
      satuan,
      gambar_url:   gambarUrl,
      aktif,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Hapus produk (soft delete → nonaktifkan) */
export async function hapusProduk(id) {
  const { error } = await supabase
    .from("produk")
    .update({ aktif: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Sesuaikan stok manual (pembelian, koreksi) */
export async function adjustStok(tokoId, produkId, { qty, tipe, keterangan, kasirId }) {
  const { data: produk, error: errP } = await supabase
    .from("produk").select("stok").eq("id", produkId).single();
  if (errP) throw errP;

  const stokBaru = produk.stok + qty;
  const { error: errU } = await supabase
    .from("produk")
    .update({ stok: stokBaru, updated_at: new Date().toISOString() })
    .eq("id", produkId);
  if (errU) throw errU;

  const { error: errL } = await supabase.from("stok_log").insert({
    toko_id:      tokoId,
    produk_id:    produkId,
    tipe:         tipe || "penyesuaian",
    qty_sebelum:  produk.stok,
    qty_berubah:  qty,
    qty_sesudah:  stokBaru,
    keterangan:   keterangan || "",
    kasir_id:     kasirId || null,
  });
  if (errL) throw errL;
}

/** Hitung jumlah produk aktif (untuk cek kuota) */
export async function countProdukAktif(tokoId) {
  const { count, error } = await supabase
    .from("produk")
    .select("id", { count: "exact", head: true })
    .eq("toko_id", tokoId)
    .eq("aktif", true);
  if (error) throw error;
  return count || 0;
}


// ══════════════════════════════════════════════════════════════
// SESI KASIR (buka / tutup kasir)
// ══════════════════════════════════════════════════════════════

/** Buka sesi kasir */
export async function bukaSesiKasir({ tokoId, cabangId, kasirId, modalAwal }) {
  const { data, error } = await supabase.rpc("buka_sesi_kasir", {
    p_toko_id:   tokoId,
    p_cabang_id: cabangId || null,
    p_kasir_id:  kasirId,
    p_modal:     modalAwal || 0,
  });
  if (error) throw error;
  // RPC mengembalikan BIGINT (id sesi), wrap jadi object
  return { id: data };
}

/** Tutup sesi kasir — via RPC (bypass RLS) */
export async function tutupSesiKasir(sesiId, { catatan } = {}) {
  const { error } = await supabase.rpc("tutup_sesi_kasir", {
    p_sesi_id: sesiId,
    p_catatan: catatan || "",
  });
  if (error) throw error;
}

/** Ambil sesi aktif kasir (ditutup_at masih null) */
export async function fetchSesiAktif(kasirId) {
  const { data, error } = await supabase
    .from("sesi_kasir")
    .select("*, cabang(nama)")
    .eq("kasir_id", kasirId)
    .is("ditutup_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Riwayat sesi kasir */
export async function fetchRiwayatSesi(tokoId, { limit = 30 } = {}) {
  const { data, error } = await supabase
    .from("sesi_kasir")
    .select("*, kasir(nama), cabang(nama)")
    .eq("toko_id", tokoId)
    .not("ditutup_at", "is", null)
    .order("dibuka_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}


// ══════════════════════════════════════════════════════════════
// TRANSAKSI
// ══════════════════════════════════════════════════════════════

/**
 * Simpan transaksi lengkap (header + items) via RPC — bypass RLS.
 * Trigger di DB akan otomatis mengurangi stok.
 */
export async function simpanTransaksi({
  tokoId, cabangId, kasirId, sesiId,
  items, diskonPersen = 0, diskonNominal = 0,
  pajakPersen = 0, metodeBayar = "tunai",
  bayar = 0, catatan = "",
}) {
  // Hitung total di sisi client
  const subtotal      = items.reduce((s, i) => s + i.subtotal, 0);
  const diskon        = diskonNominal || (subtotal * diskonPersen / 100);
  const setelahDiskon = subtotal - diskon;
  const pajak         = setelahDiskon * pajakPersen / 100;
  const total         = setelahDiskon + pajak;
  const kembalian     = metodeBayar === "tunai" ? Math.max(0, bayar - total) : 0;

  // Siapkan items sebagai JSON untuk RPC
  const itemsJson = items.map(i => ({
    produk_id:     i.produkId || null,
    nama_produk:   i.namaProduk,
    kode_sku:      i.kodeSku || "",
    harga_satuan:  i.hargaSatuan,
    harga_modal:   i.hargaModal || 0,
    qty:           i.qty,
    satuan:        i.satuan || "pcs",
    diskon_persen: i.diskonPersen || 0,
    diskon_nominal:i.diskonNominal || 0,
    subtotal:      i.subtotal,
  }));

  const { data: trxId, error } = await supabase.rpc("simpan_transaksi", {
    p_toko_id:        tokoId,
    p_cabang_id:      cabangId || null,
    p_kasir_id:       kasirId,
    p_sesi_id:        sesiId || null,
    p_subtotal:       subtotal,
    p_diskon_persen:  diskonPersen,
    p_diskon_nominal: diskon,
    p_pajak_persen:   pajakPersen,
    p_pajak_nominal:  pajak,
    p_total:          total,
    p_metode_bayar:   metodeBayar,
    p_bayar:          bayar,
    p_kembalian:      kembalian,
    p_catatan:        catatan,
    p_items:          JSON.stringify(itemsJson),
  });
  if (error) throw error;

  return { id: trxId, total, kembalian };
}

/** Void transaksi (trigger akan kembalikan stok) */
export async function voidTransaksi(id) {
  const { error } = await supabase
    .from("transaksi")
    .update({ status: "void" })
    .eq("id", id)
    .eq("status", "selesai"); // hanya yang selesai bisa di-void
  if (error) throw error;
}

/** Ambil detail transaksi + items (untuk cetak struk ulang) */
export async function fetchDetailTransaksi(id) {
  const { data: trx, error } = await supabase
    .from("transaksi")
    .select("*, kasir(nama), cabang(nama)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: items, error: errI } = await supabase
    .from("transaksi_item")
    .select("*")
    .eq("transaksi_id", id);
  if (errI) throw errI;

  return { ...trx, items };
}

/** Riwayat transaksi toko dengan filter */
export async function fetchTransaksi(tokoId, {
  tanggalDari,
  tanggalSampai,
  kasirId,
  status   = "selesai",
  limit    = 50,
  offset   = 0,
} = {}) {
  let q = supabase
    .from("transaksi")
    .select("*, kasir(nama), cabang(nama)", { count: "exact" })
    .eq("toko_id", tokoId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tanggalDari)   q = q.gte("created_at", tanggalDari + "T00:00:00");
  if (tanggalSampai) q = q.lte("created_at", tanggalSampai + "T23:59:59");
  if (kasirId)       q = q.eq("kasir_id", kasirId);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data, total: count };
}


// ══════════════════════════════════════════════════════════════
// LAPORAN
// ══════════════════════════════════════════════════════════════

/** Rekap penjualan harian via RPC */
export async function rekapHarian(tokoId, tanggal) {
  const { data, error } = await supabase.rpc("rekap_harian", {
    p_toko_id:  tokoId,
    p_tanggal:  tanggal || new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  return data?.[0] || {
    total_transaksi: 0, total_penjualan: 0,
    total_tunai: 0, total_non_tunai: 0, total_laba_kotor: 0,
  };
}

/** Rekap penjualan rentang tanggal (untuk laporan bulanan) */
export async function rekapRentang(tokoId, { tanggalDari, tanggalSampai }) {
  const { data, error } = await supabase
    .from("transaksi")
    .select("created_at, total, metode_bayar, subtotal")
    .eq("toko_id", tokoId)
    .eq("status", "selesai")
    .gte("created_at", tanggalDari + "T00:00:00")
    .lte("created_at", tanggalSampai + "T23:59:59")
    .order("created_at");
  if (error) throw error;
  return data;
}

/** Produk terlaris */
export async function produkTerlaris(tokoId, { tanggalDari, tanggalSampai, limit = 10 } = {}) {
  let q = supabase
    .from("transaksi_item")
    .select("produk_id, nama_produk, qty.sum(), subtotal.sum()")
    .eq("toko_id", tokoId)
    .order("qty_sum", { ascending: false })
    .limit(limit);

  if (tanggalDari || tanggalSampai) {
    const { data: trxIds } = await supabase
      .from("transaksi")
      .select("id")
      .eq("toko_id", tokoId)
      .eq("status", "selesai")
      .gte("created_at", (tanggalDari || "2000-01-01") + "T00:00:00")
      .lte("created_at", (tanggalSampai || "2099-12-31") + "T23:59:59");
    const ids = (trxIds || []).map(t => t.id);
    if (!ids.length) return [];
    q = q.in("transaksi_id", ids);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Stok menipis (stok <= stok_minimum) */
export async function fetchStokMenipis(tokoId) {
  const { data, error } = await supabase
    .from("produk")
    .select("id, nama, kode_sku, stok, stok_minimum, satuan")
    .eq("toko_id", tokoId)
    .eq("aktif", true)
    .filter("stok", "lte", "stok_minimum")
    .order("stok");
  if (error) throw error;
  return data;
}

/** Riwayat stok satu produk */
export async function fetchStokLog(produkId, { limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("stok_log")
    .select("*, kasir(nama)")
    .eq("produk_id", produkId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}


// ══════════════════════════════════════════════════════════════
// IDENTITAS TOKO (logo, nama)
// ══════════════════════════════════════════════════════════════

export async function getLogoToko(tokoId) {
  const { data, error } = await supabase
    .from("toko").select("logo_url").eq("id", tokoId).maybeSingle();
  if (error) throw error;
  return data?.logo_url || null;
}

/** Simpan logo sebagai base64 (atau URL dari Supabase Storage) */
export async function uploadLogoToko(tokoId, logoUrlOrBase64) {
  const { error } = await supabase
    .from("toko")
    .update({ logo_url: logoUrlOrBase64, updated_at: new Date().toISOString() })
    .eq("id", tokoId);
  if (error) throw error;
}

export async function updateProfilToko(tokoId, { nama, alamat, telepon, email }) {
  const { error } = await supabase
    .from("toko")
    .update({ nama, alamat, telepon, email, updated_at: new Date().toISOString() })
    .eq("id", tokoId);
  if (error) throw error;
}
