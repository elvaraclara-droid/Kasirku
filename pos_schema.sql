-- ══════════════════════════════════════════════════════════════
-- POS (Point of Sale) — SUPABASE SCHEMA
-- Adopsi arsitektur dari PPDB Asesmen Bakat & Minat
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════
--
-- URUTAN TABEL (ikuti urutan ini, jangan dibalik):
--   1. owner          — akun Anda sebagai penjual SaaS
--   2. toko           — setiap pelanggan/tenant
--   3. lisensi        — paket & masa aktif per toko
--   4. kasir          — user login per toko
--   5. cabang         — outlet/lokasi per toko
--   6. kategori       — kategori produk per toko
--   7. produk         — master produk per toko
--   8. sesi_kasir     — buka/tutup shift kasir
--   9. transaksi      — header transaksi penjualan
--  10. transaksi_item — detail item per transaksi
--  11. stok_log       — riwayat perubahan stok
-- ══════════════════════════════════════════════════════════════


-- ── 1. Tabel: owner ───────────────────────────────────────────
-- Akun Anda (penjual SaaS). Biasanya hanya 1 baris.
CREATE TABLE IF NOT EXISTS owner (
  id         SERIAL PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,            -- bcrypt hash di produksi
  nama       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed akun owner default — GANTI SEGERA SETELAH DEPLOY
INSERT INTO owner (username, password, nama)
VALUES ('owner_pos', 'ganti_password_ini', 'Owner POS')
ON CONFLICT (username) DO NOTHING;


-- ── 2. Tabel: toko ────────────────────────────────────────────
-- Setiap pelanggan yang membeli lisensi = 1 baris di sini.
CREATE TABLE IF NOT EXISTS toko (
  id           BIGSERIAL PRIMARY KEY,
  kode         TEXT UNIQUE NOT NULL,   -- kode unik toko, mis: 'TK-001'
  nama         TEXT NOT NULL,
  alamat       TEXT DEFAULT '',
  telepon      TEXT DEFAULT '',
  email        TEXT DEFAULT '',
  logo_url     TEXT DEFAULT '',        -- URL logo dari Supabase Storage
  aktif        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toko_kode ON toko(kode);


-- ── 3. Tabel: lisensi ─────────────────────────────────────────
-- Satu toko bisa punya riwayat lisensi. Yang aktif = expired_at NULL atau > NOW().
CREATE TABLE IF NOT EXISTS lisensi (
  id             BIGSERIAL PRIMARY KEY,
  toko_id        BIGINT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  lisensi_key    TEXT UNIQUE NOT NULL,     -- key yang diberikan ke pelanggan
  paket          TEXT NOT NULL,            -- 'starter','growth','professional','enterprise','lifetime'
  -- Batas kuota sesuai paket (NULL = unlimited)
  maks_produk    INTEGER,                  -- NULL = unlimited
  maks_kasir     INTEGER,                  -- NULL = unlimited
  maks_cabang    INTEGER,                  -- NULL = unlimited
  -- Masa aktif
  tgl_mulai      DATE NOT NULL DEFAULT CURRENT_DATE,
  tgl_expired    DATE,                     -- NULL = lifetime
  -- Meta
  catatan        TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lisensi_toko    ON lisensi(toko_id);
CREATE INDEX IF NOT EXISTS idx_lisensi_key     ON lisensi(lisensi_key);
CREATE INDEX IF NOT EXISTS idx_lisensi_expired ON lisensi(tgl_expired);


-- ── 4. Tabel: kasir ───────────────────────────────────────────
-- User yang bisa login ke POS. Terikat ke satu toko.
CREATE TABLE IF NOT EXISTS kasir (
  id         BIGSERIAL PRIMARY KEY,
  toko_id    BIGINT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  username   TEXT NOT NULL,
  password   TEXT NOT NULL,              -- bcrypt hash di produksi
  nama       TEXT DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'kasir', -- 'admin_toko' | 'kasir'
  aktif      BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (toko_id, username)             -- username unik per toko
);

CREATE INDEX IF NOT EXISTS idx_kasir_toko ON kasir(toko_id);

-- Seed admin toko contoh — akan diisi saat owner membuat toko baru
-- INSERT dilakukan oleh aplikasi, bukan di sini


-- ── 5. Tabel: cabang ──────────────────────────────────────────
-- Outlet/lokasi fisik. Toko kecil cukup 1 cabang (cabang utama).
CREATE TABLE IF NOT EXISTS cabang (
  id         BIGSERIAL PRIMARY KEY,
  toko_id    BIGINT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  nama       TEXT NOT NULL,              -- 'Cabang Utama', 'Cabang Selatan', dst
  alamat     TEXT DEFAULT '',
  telepon    TEXT DEFAULT '',
  aktif      BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cabang_toko ON cabang(toko_id);


-- ── 6. Tabel: kategori ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kategori (
  id         BIGSERIAL PRIMARY KEY,
  toko_id    BIGINT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  nama       TEXT NOT NULL,
  warna      TEXT DEFAULT '#6B7280',     -- hex color untuk UI
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kategori_toko ON kategori(toko_id);


-- ── 7. Tabel: produk ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produk (
  id           BIGSERIAL PRIMARY KEY,
  toko_id      BIGINT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  kategori_id  BIGINT REFERENCES kategori(id) ON DELETE SET NULL,
  kode_sku     TEXT DEFAULT '',           -- barcode / SKU
  nama         TEXT NOT NULL,
  deskripsi    TEXT DEFAULT '',
  harga_jual   NUMERIC(15,2) NOT NULL DEFAULT 0,
  harga_modal  NUMERIC(15,2) DEFAULT 0,   -- untuk kalkulasi laba
  stok         INTEGER NOT NULL DEFAULT 0,
  stok_minimum INTEGER DEFAULT 0,         -- alert stok menipis
  satuan       TEXT DEFAULT 'pcs',        -- 'pcs','kg','liter', dst
  gambar_url   TEXT DEFAULT '',
  aktif        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produk_toko     ON produk(toko_id);
CREATE INDEX IF NOT EXISTS idx_produk_sku      ON produk(toko_id, kode_sku);
CREATE INDEX IF NOT EXISTS idx_produk_kategori ON produk(kategori_id);
CREATE INDEX IF NOT EXISTS idx_produk_nama     ON produk USING gin(to_tsvector('indonesian', nama));


-- ── 8. Tabel: sesi_kasir ──────────────────────────────────────
-- Rekap buka/tutup kasir per shift. Dasar laporan per shift.
CREATE TABLE IF NOT EXISTS sesi_kasir (
  id              BIGSERIAL PRIMARY KEY,
  toko_id         BIGINT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  cabang_id       BIGINT REFERENCES cabang(id) ON DELETE SET NULL,
  kasir_id        BIGINT NOT NULL REFERENCES kasir(id) ON DELETE CASCADE,
  modal_awal      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_penjualan NUMERIC(15,2) DEFAULT 0,  -- dihitung saat tutup kasir
  total_tunai     NUMERIC(15,2) DEFAULT 0,
  total_non_tunai NUMERIC(15,2) DEFAULT 0,
  jumlah_transaksi INTEGER DEFAULT 0,
  catatan         TEXT DEFAULT '',
  dibuka_at       TIMESTAMPTZ DEFAULT NOW(),
  ditutup_at      TIMESTAMPTZ,              -- NULL = sesi masih buka
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesi_kasir_toko  ON sesi_kasir(toko_id);
CREATE INDEX IF NOT EXISTS idx_sesi_kasir_kasir ON sesi_kasir(kasir_id);
CREATE INDEX IF NOT EXISTS idx_sesi_dibuka      ON sesi_kasir(dibuka_at DESC);


-- ── 9. Tabel: transaksi ───────────────────────────────────────
-- Header setiap transaksi penjualan.
CREATE TABLE IF NOT EXISTS transaksi (
  id              BIGSERIAL PRIMARY KEY,
  toko_id         BIGINT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  cabang_id       BIGINT REFERENCES cabang(id) ON DELETE SET NULL,
  kasir_id        BIGINT REFERENCES kasir(id) ON DELETE SET NULL,
  sesi_id         BIGINT REFERENCES sesi_kasir(id) ON DELETE SET NULL,
  nomor_transaksi TEXT NOT NULL,            -- 'TRX-20250524-0001'
  -- Totals
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  diskon_persen   NUMERIC(5,2) DEFAULT 0,
  diskon_nominal  NUMERIC(15,2) DEFAULT 0,
  pajak_persen    NUMERIC(5,2) DEFAULT 0,  -- mis: 11 untuk PPN 11%
  pajak_nominal   NUMERIC(15,2) DEFAULT 0,
  total           NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Pembayaran
  metode_bayar    TEXT NOT NULL DEFAULT 'tunai', -- 'tunai'|'qris'|'transfer'|'debit'|'kredit'
  bayar           NUMERIC(15,2) DEFAULT 0,
  kembalian       NUMERIC(15,2) DEFAULT 0,
  -- Status
  status          TEXT NOT NULL DEFAULT 'selesai', -- 'selesai'|'void'|'pending'
  catatan         TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trx_toko    ON transaksi(toko_id);
CREATE INDEX IF NOT EXISTS idx_trx_nomor   ON transaksi(toko_id, nomor_transaksi);
CREATE INDEX IF NOT EXISTS idx_trx_tanggal ON transaksi(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trx_sesi    ON transaksi(sesi_id);
CREATE INDEX IF NOT EXISTS idx_trx_status  ON transaksi(toko_id, status);


-- ── 10. Tabel: transaksi_item ─────────────────────────────────
-- Detail item per transaksi. Harga disimpan snapshot (bukan FK harga produk)
-- agar laporan historis tetap akurat meski harga produk berubah.
CREATE TABLE IF NOT EXISTS transaksi_item (
  id              BIGSERIAL PRIMARY KEY,
  transaksi_id    BIGINT NOT NULL REFERENCES transaksi(id) ON DELETE CASCADE,
  toko_id         BIGINT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  produk_id       BIGINT REFERENCES produk(id) ON DELETE SET NULL,
  -- Snapshot saat transaksi terjadi
  nama_produk     TEXT NOT NULL,
  kode_sku        TEXT DEFAULT '',
  harga_satuan    NUMERIC(15,2) NOT NULL,
  harga_modal     NUMERIC(15,2) DEFAULT 0,
  qty             NUMERIC(10,3) NOT NULL DEFAULT 1, -- support desimal (kg, liter)
  satuan          TEXT DEFAULT 'pcs',
  diskon_persen   NUMERIC(5,2) DEFAULT 0,
  diskon_nominal  NUMERIC(15,2) DEFAULT 0,
  subtotal        NUMERIC(15,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_transaksi ON transaksi_item(transaksi_id);
CREATE INDEX IF NOT EXISTS idx_item_toko      ON transaksi_item(toko_id);
CREATE INDEX IF NOT EXISTS idx_item_produk    ON transaksi_item(produk_id);


-- ── 11. Tabel: stok_log ───────────────────────────────────────
-- Riwayat setiap perubahan stok. Berguna untuk audit & laporan stok.
CREATE TABLE IF NOT EXISTS stok_log (
  id           BIGSERIAL PRIMARY KEY,
  toko_id      BIGINT NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
  produk_id    BIGINT NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
  tipe         TEXT NOT NULL, -- 'penjualan'|'pembelian'|'penyesuaian'|'void'
  qty_sebelum  INTEGER NOT NULL,
  qty_berubah  INTEGER NOT NULL,  -- negatif = stok berkurang
  qty_sesudah  INTEGER NOT NULL,
  referensi_id BIGINT,             -- transaksi_id atau lainnya
  keterangan   TEXT DEFAULT '',
  kasir_id     BIGINT REFERENCES kasir(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stok_log_produk ON stok_log(produk_id);
CREATE INDEX IF NOT EXISTS idx_stok_log_toko   ON stok_log(toko_id);
CREATE INDEX IF NOT EXISTS idx_stok_log_tipe   ON stok_log(tipe);


-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Pola: anon key hanya untuk login. Semua operasi data via service_role.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE owner          ENABLE ROW LEVEL SECURITY;
ALTER TABLE toko           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lisensi        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasir          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cabang         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategori       ENABLE ROW LEVEL SECURITY;
ALTER TABLE produk         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesi_kasir     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_log       ENABLE ROW LEVEL SECURITY;

-- service_role bisa semua (dipakai dari aplikasi setelah login)
CREATE POLICY "service_all_owner"          ON owner          FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_toko"           ON toko           FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_lisensi"        ON lisensi        FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_kasir"          ON kasir          FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_cabang"         ON cabang         FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_kategori"       ON kategori       FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_produk"         ON produk         FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_sesi_kasir"     ON sesi_kasir     FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_transaksi"      ON transaksi      FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_transaksi_item" ON transaksi_item FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_stok_log"       ON stok_log       FOR ALL TO service_role USING (true);


-- ══════════════════════════════════════════════════════════════
-- RPC FUNCTIONS
-- Dipanggil via supabase.rpc() — aman, tidak expose tabel ke anon
-- ══════════════════════════════════════════════════════════════

-- ── Fungsi: Login Owner ───────────────────────────────────────
CREATE OR REPLACE FUNCTION cek_login_owner(p_username TEXT, p_password TEXT)
RETURNS TABLE(berhasil BOOLEAN, nama_owner TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (password = p_password) AS berhasil,
    nama
  FROM owner
  WHERE username = p_username
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION cek_login_owner TO anon;


-- ── Fungsi: Login Kasir (dengan validasi lisensi aktif) ───────
CREATE OR REPLACE FUNCTION cek_login_kasir(
  p_lisensi_key TEXT,
  p_username    TEXT,
  p_password    TEXT
)
RETURNS TABLE(
  berhasil       BOOLEAN,
  pesan          TEXT,
  kasir_id       BIGINT,
  nama_kasir     TEXT,
  role_kasir     TEXT,
  toko_id        BIGINT,
  nama_toko      TEXT,
  kode_toko      TEXT,
  logo_url       TEXT,
  paket          TEXT,
  tgl_expired    DATE,
  maks_produk    INTEGER,
  maks_kasir     INTEGER,
  maks_cabang    INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_lisensi  lisensi%ROWTYPE;
  v_toko     toko%ROWTYPE;
  v_kasir    kasir%ROWTYPE;
BEGIN
  -- 1. Cari lisensi
  SELECT * INTO v_lisensi
  FROM lisensi
  WHERE lisensi_key = p_lisensi_key
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Kode lisensi tidak ditemukan.'::TEXT,
      NULL::BIGINT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
      NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- 2. Cek expired
  IF v_lisensi.tgl_expired IS NOT NULL AND v_lisensi.tgl_expired < CURRENT_DATE THEN
    RETURN QUERY SELECT FALSE, 'Lisensi sudah expired. Hubungi penjual untuk perpanjangan.'::TEXT,
      NULL::BIGINT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
      NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- 3. Cari toko
  SELECT * INTO v_toko FROM toko WHERE id = v_lisensi.toko_id AND aktif = TRUE LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Toko tidak aktif atau tidak ditemukan.'::TEXT,
      NULL::BIGINT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
      NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- 4. Cari kasir
  SELECT * INTO v_kasir
  FROM kasir
  WHERE toko_id = v_toko.id AND username = p_username AND aktif = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Username tidak ditemukan atau tidak aktif.'::TEXT,
      NULL::BIGINT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
      NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- 5. Cek password
  IF v_kasir.password != p_password THEN
    RETURN QUERY SELECT FALSE, 'Password salah.'::TEXT,
      NULL::BIGINT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::DATE,
      NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- 6. Semua OK — kembalikan data sesi
  RETURN QUERY SELECT
    TRUE,
    'Login berhasil.'::TEXT,
    v_kasir.id,
    v_kasir.nama,
    v_kasir.role,
    v_toko.id,
    v_toko.nama,
    v_toko.kode,
    v_toko.logo_url,
    v_lisensi.paket,
    v_lisensi.tgl_expired,
    v_lisensi.maks_produk,
    v_lisensi.maks_kasir,
    v_lisensi.maks_cabang;
END;
$$;
GRANT EXECUTE ON FUNCTION cek_login_kasir TO anon;


-- ── Fungsi: Generate nomor transaksi otomatis ─────────────────
-- Format: TRX-YYYYMMDD-NNNN (reset setiap hari per toko)
CREATE OR REPLACE FUNCTION generate_nomor_transaksi(p_toko_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_tanggal TEXT;
  v_urutan  INTEGER;
  v_nomor   TEXT;
BEGIN
  v_tanggal := TO_CHAR(NOW(), 'YYYYMMDD');

  SELECT COUNT(*) + 1 INTO v_urutan
  FROM transaksi
  WHERE toko_id = p_toko_id
    AND DATE(created_at) = CURRENT_DATE;

  v_nomor := 'TRX-' || v_tanggal || '-' || LPAD(v_urutan::TEXT, 4, '0');
  RETURN v_nomor;
END;
$$;
GRANT EXECUTE ON FUNCTION generate_nomor_transaksi TO service_role;


-- ── Fungsi: Rekap penjualan harian ───────────────────────────
CREATE OR REPLACE FUNCTION rekap_harian(p_toko_id BIGINT, p_tanggal DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  total_transaksi  BIGINT,
  total_penjualan  NUMERIC,
  total_tunai      NUMERIC,
  total_non_tunai  NUMERIC,
  total_laba_kotor NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(t.id)                                          AS total_transaksi,
    COALESCE(SUM(t.total), 0)                           AS total_penjualan,
    COALESCE(SUM(CASE WHEN t.metode_bayar = 'tunai' THEN t.total ELSE 0 END), 0) AS total_tunai,
    COALESCE(SUM(CASE WHEN t.metode_bayar != 'tunai' THEN t.total ELSE 0 END), 0) AS total_non_tunai,
    COALESCE(SUM(
      (SELECT SUM((ti.harga_satuan - ti.harga_modal) * ti.qty)
       FROM transaksi_item ti WHERE ti.transaksi_id = t.id)
    ), 0)                                                AS total_laba_kotor
  FROM transaksi t
  WHERE t.toko_id = p_toko_id
    AND DATE(t.created_at) = p_tanggal
    AND t.status = 'selesai';
END;
$$;
GRANT EXECUTE ON FUNCTION rekap_harian TO service_role;


-- ══════════════════════════════════════════════════════════════
-- TRIGGER: auto-update stok setelah transaksi selesai
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_kurangi_stok()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_item        transaksi_item%ROWTYPE;
  v_stok_lama   INTEGER;
BEGIN
  -- Hanya proses jika status berubah jadi 'selesai'
  IF NEW.status = 'selesai' AND (OLD.status IS DISTINCT FROM 'selesai') THEN
    FOR v_item IN
      SELECT * FROM transaksi_item WHERE transaksi_id = NEW.id
    LOOP
      IF v_item.produk_id IS NOT NULL THEN
        SELECT stok INTO v_stok_lama FROM produk WHERE id = v_item.produk_id;

        -- Kurangi stok
        UPDATE produk
        SET stok = stok - v_item.qty::INTEGER,
            updated_at = NOW()
        WHERE id = v_item.produk_id;

        -- Catat di stok_log
        INSERT INTO stok_log (
          toko_id, produk_id, tipe,
          qty_sebelum, qty_berubah, qty_sesudah,
          referensi_id, keterangan
        ) VALUES (
          NEW.toko_id, v_item.produk_id, 'penjualan',
          v_stok_lama, -(v_item.qty::INTEGER), v_stok_lama - v_item.qty::INTEGER,
          NEW.id, 'Transaksi ' || NEW.nomor_transaksi
        );
      END IF;
    END LOOP;
  END IF;

  -- Jika transaksi di-void, kembalikan stok
  IF NEW.status = 'void' AND OLD.status = 'selesai' THEN
    FOR v_item IN
      SELECT * FROM transaksi_item WHERE transaksi_id = NEW.id
    LOOP
      IF v_item.produk_id IS NOT NULL THEN
        SELECT stok INTO v_stok_lama FROM produk WHERE id = v_item.produk_id;

        UPDATE produk
        SET stok = stok + v_item.qty::INTEGER,
            updated_at = NOW()
        WHERE id = v_item.produk_id;

        INSERT INTO stok_log (
          toko_id, produk_id, tipe,
          qty_sebelum, qty_berubah, qty_sesudah,
          referensi_id, keterangan
        ) VALUES (
          NEW.toko_id, v_item.produk_id, 'void',
          v_stok_lama, v_item.qty::INTEGER, v_stok_lama + v_item.qty::INTEGER,
          NEW.id, 'VOID: ' || NEW.nomor_transaksi
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER after_transaksi_status
  AFTER UPDATE OF status ON transaksi
  FOR EACH ROW EXECUTE FUNCTION trg_kurangi_stok();

-- Trigger untuk transaksi INSERT langsung dengan status 'selesai'
CREATE OR REPLACE FUNCTION trg_kurangi_stok_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_item      transaksi_item%ROWTYPE;
  v_stok_lama INTEGER;
BEGIN
  IF NEW.status = 'selesai' THEN
    FOR v_item IN
      SELECT * FROM transaksi_item WHERE transaksi_id = NEW.id
    LOOP
      IF v_item.produk_id IS NOT NULL THEN
        SELECT stok INTO v_stok_lama FROM produk WHERE id = v_item.produk_id;
        UPDATE produk SET stok = stok - v_item.qty::INTEGER, updated_at = NOW()
        WHERE id = v_item.produk_id;
        INSERT INTO stok_log (toko_id, produk_id, tipe, qty_sebelum, qty_berubah, qty_sesudah, referensi_id, keterangan)
        VALUES (NEW.toko_id, v_item.produk_id, 'penjualan', v_stok_lama, -(v_item.qty::INTEGER), v_stok_lama - v_item.qty::INTEGER, NEW.id, 'Transaksi ' || NEW.nomor_transaksi);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_transaksi_insert
  AFTER INSERT ON transaksi
  FOR EACH ROW EXECUTE FUNCTION trg_kurangi_stok_insert();


-- ══════════════════════════════════════════════════════════════
-- SELESAI.
-- Langkah berikutnya:
--   1. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env
--   2. Gunakan service_role key di server / RPC untuk semua operasi data
--   3. Ganti password owner default di tabel 'owner'
--   4. Buat toko pertama dan lisensinya via Owner Dashboard
-- ══════════════════════════════════════════════════════════════
