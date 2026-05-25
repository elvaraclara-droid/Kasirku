// src/KasirPage.jsx
// ══════════════════════════════════════════════════════════════
// LAYAR KASIR UTAMA — POS
// Props:
//   auth       — object sesi dari loginKasir()
//   sesi       — object sesi kasir aktif dari bukaSesiKasir()
//   onLogout   — callback saat kasir logout
//   onTutupSesi — callback saat kasir tutup sesi
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from "react";
import {
  cariProduk,
  fetchProdukBySku,
  fetchKategori,
  fetchProduk,
  simpanTransaksi,
  voidTransaksi,
  fetchDetailTransaksi,
  rekapHarian,
  tutupSesiKasir,
} from "./supabaseClient";
import { formatRupiah, statusLisensi } from "./paketConfig";

// ── Konstanta metode bayar ────────────────────────────────────
const METODE_BAYAR = [
  { id: "tunai",    label: "Tunai",    icon: "💵" },
  { id: "qris",     label: "QRIS",     icon: "📱" },
  { id: "transfer", label: "Transfer", icon: "🏦" },
  { id: "debit",    label: "Debit",    icon: "💳" },
];

// ── Style tokens (dark theme — cocok untuk layar kasir) ───────
const C = {
  bg:        "#0A0F1A",
  surface:   "#0F172A",
  surfaceHi: "#1E293B",
  border:    "#1E293B",
  borderHi:  "#334155",
  text:      "#E2E8F0",
  textMuted: "#64748B",
  textSub:   "#94A3B8",
  accent:    "#3B82F6",
  accentHi:  "#60A5FA",
  success:   "#10B981",
  danger:    "#EF4444",
  warning:   "#F59E0B",
};

const S = {
  // Layout
  root:      { display:"flex", height:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans','Segoe UI',sans-serif", overflow:"hidden" },
  left:      { flex:"1 1 0", display:"flex", flexDirection:"column", borderRight:`1px solid ${C.border}`, overflow:"hidden" },
  right:     { width:380, display:"flex", flexDirection:"column", overflow:"hidden" },

  // Header
  header:    { background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"10px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0 },

  // Produk area
  searchWrap:{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  searchInp: { width:"100%", background:C.surfaceHi, border:`1px solid ${C.border}`, color:C.text, borderRadius:10, padding:"10px 14px", fontSize:14, outline:"none", boxSizing:"border-box" },
  kategoriBar:{ display:"flex", gap:6, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, overflowX:"auto", flexShrink:0 },
  katBtn:    (aktif) => ({ background: aktif ? C.accent : C.surfaceHi, color: aktif ? "#fff" : C.textSub, border:"none", borderRadius:20, padding:"5px 14px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }),
  gridProduk:{ flex:1, overflowY:"auto", padding:16, display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))", gap:10, alignContent:"start" },
  cardProduk:(disabled) => ({
    background: disabled ? "#0F172A88" : C.surface,
    border: `1px solid ${disabled ? C.border : C.borderHi}`,
    borderRadius:12, padding:"12px 10px", cursor: disabled ? "not-allowed" : "pointer",
    textAlign:"center", transition:"all 0.15s", opacity: disabled ? 0.5 : 1,
  }),

  // Keranjang (kanan)
  cartHeader:{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  cartList:  { flex:1, overflowY:"auto", padding:"8px 0" },
  cartItem:  { padding:"10px 16px", display:"flex", gap:10, alignItems:"flex-start", borderBottom:`1px solid ${C.border}88` },
  cartTotal: { borderTop:`1px solid ${C.border}`, padding:"14px 16px", flexShrink:0 },

  // Input & Button
  inp:       { background:C.surfaceHi, border:`1px solid ${C.border}`, color:C.text, borderRadius:8, padding:"6px 10px", fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" },
  btn:       (color, outline) => ({
    background: outline ? "transparent" : color,
    color: outline ? color : "#fff",
    border: `1px solid ${color}`,
    borderRadius:10, padding:"10px 0", fontSize:14, fontWeight:700,
    cursor:"pointer", width:"100%", transition:"opacity 0.15s",
  }),
  btnSm:     (color) => ({ background:color, color:"#fff", border:"none", borderRadius:6, padding:"4px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }),
  ghost:     { background:"transparent", border:`1px solid ${C.border}`, color:C.textSub, borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer" },

  // Badge
  badge:     (color, bg) => ({ background:bg, color, borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700, display:"inline-block" }),
};

// ══════════════════════════════════════════════════════════════
// KOMPONEN UTAMA
// ══════════════════════════════════════════════════════════════
export default function KasirPage({ auth, sesi, onLogout, onTutupSesi }) {
  // ── State produk & pencarian ─────────────────────────────
  const [keyword,     setKeyword]     = useState("");
  const [produkList,  setProdukList]  = useState([]);
  const [kategoriList,setKategoriList]= useState([]);
  const [katAktif,    setKatAktif]    = useState("semua");
  const [loadProduk,  setLoadProduk]  = useState(false);

  // ── State keranjang ──────────────────────────────────────
  const [keranjang,   setKeranjang]   = useState([]);
  const [diskon,      setDiskon]      = useState({ tipe:"nominal", nilai:0 }); // tipe: 'nominal'|'persen'
  const [pajak,       setPajak]       = useState(0);
  const [metodeBayar, setMetodeBayar] = useState("tunai");
  const [bayar,       setBayar]       = useState("");

  // ── State UI ─────────────────────────────────────────────
  const [modal,        setModal]       = useState(null); // null | 'bayar' | 'struk' | 'rekap' | 'void'
  const [lastTrx,      setLastTrx]     = useState(null);
  const [loading,      setLoading]     = useState(false);
  const [rekap,        setRekap]       = useState(null);
  const [rekapLoading, setRekapLoading]= useState(false);
  const [err,          setErr]         = useState("");

  const searchRef = useRef(null);

  // ── Load kategori & produk awal ──────────────────────────
  useEffect(() => {
    loadKategori();
    loadSemuaProduk();
    searchRef.current?.focus();
  }, []);

  async function loadKategori() {
    const data = await fetchKategori(auth.tokoId).catch(() => []);
    setKategoriList(data);
  }

  async function loadSemuaProduk() {
    setLoadProduk(true);
    const data = await fetchProduk(auth.tokoId, { aktifSaja: true }).catch(() => []);
    setProdukList(data);
    setLoadProduk(false);
  }

  // ── Pencarian produk (debounce 300ms) ────────────────────
  const searchTimer = useRef(null);
  function handleKeyword(val) {
    setKeyword(val);
    clearTimeout(searchTimer.current);
    if (!val.trim()) { loadSemuaProduk(); return; }
    searchTimer.current = setTimeout(async () => {
      setLoadProduk(true);
      const data = await cariProduk(auth.tokoId, val.trim()).catch(() => []);
      setProdukList(data);
      setLoadProduk(false);
    }, 300);
  }

  // ── Scan barcode (Enter di input pencarian) ──────────────
  async function handleScanEnter(e) {
    if (e.key !== "Enter" || !keyword.trim()) return;
    const produk = await fetchProdukBySku(auth.tokoId, keyword.trim()).catch(() => null);
    if (produk) { tambahKeKeranjang(produk); setKeyword(""); }
  }

  // ── Produk yang ditampilkan (filter kategori) ────────────
  const produkTampil = katAktif === "semua"
    ? produkList
    : produkList.filter(p => p.kategori_id === katAktif);

  // ── Keranjang: tambah item ───────────────────────────────
  const tambahKeKeranjang = useCallback((produk) => {
    if (produk.stok <= 0) return;
    setKeranjang(prev => {
      const idx = prev.findIndex(i => i.produkId === produk.id);
      if (idx >= 0) {
        const updated = [...prev];
        const item = updated[idx];
        if (item.qty >= produk.stok) return prev; // jangan melebihi stok
        updated[idx] = { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * item.hargaSatuan };
        return updated;
      }
      return [...prev, {
        produkId:   produk.id,
        namaProduk: produk.nama,
        kodeSku:    produk.kode_sku,
        hargaSatuan:Number(produk.harga_jual),
        hargaModal: Number(produk.harga_modal || 0),
        stokMaks:   produk.stok,
        qty:        1,
        satuan:     produk.satuan || "pcs",
        diskonPersen:  0,
        diskonNominal: 0,
        subtotal:   Number(produk.harga_jual),
      }];
    });
  }, []);

  // ── Keranjang: update qty ────────────────────────────────
  function setQty(produkId, qty) {
    const q = Math.max(0, parseInt(qty) || 0);
    if (q === 0) { hapusItem(produkId); return; }
    setKeranjang(prev => prev.map(i =>
      i.produkId === produkId
        ? { ...i, qty: Math.min(q, i.stokMaks), subtotal: Math.min(q, i.stokMaks) * i.hargaSatuan }
        : i
    ));
  }

  // ── Keranjang: hapus item ────────────────────────────────
  function hapusItem(produkId) {
    setKeranjang(prev => prev.filter(i => i.produkId !== produkId));
  }

  // ── Kalkulasi total ──────────────────────────────────────
  const subtotal = keranjang.reduce((s, i) => s + i.subtotal, 0);
  const nilaiDiskon = diskon.tipe === "persen"
    ? subtotal * (diskon.nilai / 100)
    : diskon.nilai;
  const setelahDiskon = Math.max(0, subtotal - nilaiDiskon);
  const nilaiPajak    = setelahDiskon * (pajak / 100);
  const total         = setelahDiskon + nilaiPajak;
  const kembalian     = metodeBayar === "tunai"
    ? Math.max(0, Number(bayar || 0) - total)
    : 0;

  // ── Buka modal bayar ─────────────────────────────────────
  function bukaBayar() {
    if (!keranjang.length) return;
    setBayar(metodeBayar === "tunai" ? String(Math.ceil(total / 1000) * 1000) : "");
    setErr("");
    setModal("bayar");
  }

  // ── Proses pembayaran ────────────────────────────────────
  async function prosesBayar() {
    if (!keranjang.length) return;
    if (metodeBayar === "tunai" && Number(bayar) < total) {
      setErr("Jumlah bayar kurang dari total."); return;
    }
    setLoading(true); setErr("");
    try {
      const trx = await simpanTransaksi({
        tokoId:       auth.tokoId,
        cabangId:     sesi?.cabang_id || null,
        kasirId:      auth.kasirId,
        sesiId:       sesi?.id || null,
        items:        keranjang,
        diskonPersen: diskon.tipe === "persen" ? diskon.nilai : 0,
        diskonNominal:nilaiDiskon,
        pajakPersen:  pajak,
        metodeBayar,
        bayar:        Number(bayar || total),
        catatan:      "",
      });
      setLastTrx({ ...trx, kembalian, totalDibayar: total, metode_bayar: metodeBayar, bayar: Number(bayar || total), items: keranjang.map(i => ({ produk_id: i.produkId, nama_produk: i.namaProduk, qty: i.qty, subtotal: i.subtotal })) });
      resetKeranjang();
      setModal("struk");
    } catch (e) {
      setErr(e.message || "Gagal menyimpan transaksi.");
    }
    setLoading(false);
  }

  function resetKeranjang() {
    setKeranjang([]);
    setDiskon({ tipe:"nominal", nilai:0 });
    setPajak(0);
    setMetodeBayar("tunai");
    setBayar("");
  }

  // ── Load rekap harian ────────────────────────────────────
  async function loadRekap() {
    setRekapLoading(true);
    const data = await rekapHarian(auth.tokoId).catch(() => null);
    setRekap(data);
    setRekapLoading(false);
    setModal("rekap");
  }

  // ── Tutup sesi ───────────────────────────────────────────
  async function handleTutupSesi() {
    if (!window.confirm("Tutup sesi kasir sekarang?")) return;
    setLoading(true);
    try {
      const hasil = await tutupSesiKasir(sesi.id);
      onTutupSesi?.(hasil);
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  }

  // ── Status lisensi ───────────────────────────────────────
  const statusLis = statusLisensi(auth.tglExpired);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div style={S.root}>

      {/* ── PANEL KIRI: Produk ── */}
      <div style={S.left}>

        {/* Header */}
        <div style={S.header}>
          {auth.logoUrl && (
            <img src={auth.logoUrl} alt="logo" style={{ width:32, height:32, borderRadius:8, objectFit:"cover" }} />
          )}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{auth.namaToko}</div>
            <div style={{ fontSize:11, color:C.textMuted }}>{auth.namaKasir} • {sesi?.cabang?.nama || "Kasir"}</div>
          </div>
          <span style={S.badge(statusLis.warna, statusLis.warnaLatar)}>{statusLis.label}</span>
          <button style={S.ghost} onClick={loadRekap}>📊 Rekap</button>
          <button style={S.ghost} onClick={handleTutupSesi}>Tutup Kasir</button>
          <button style={{ ...S.ghost, borderColor:C.danger, color:C.danger }} onClick={onLogout}>Keluar</button>
        </div>

        {/* Pencarian / Scan */}
        <div style={S.searchWrap}>
          <input
            ref={searchRef}
            style={S.searchInp}
            placeholder="🔍  Cari nama produk atau scan barcode..."
            value={keyword}
            onChange={e => handleKeyword(e.target.value)}
            onKeyDown={handleScanEnter}
          />
        </div>

        {/* Filter Kategori */}
        <div style={S.kategoriBar}>
          <button style={S.katBtn(katAktif === "semua")} onClick={() => setKatAktif("semua")}>
            Semua
          </button>
          {kategoriList.map(k => (
            <button key={k.id} style={S.katBtn(katAktif === k.id)} onClick={() => setKatAktif(k.id)}>
              {k.nama}
            </button>
          ))}
        </div>

        {/* Grid Produk */}
        <div style={S.gridProduk}>
          {loadProduk && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", color:C.textMuted, padding:40 }}>Memuat produk...</div>
          )}
          {!loadProduk && produkTampil.length === 0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", color:C.textMuted, padding:40 }}>
              {keyword ? "Produk tidak ditemukan." : "Belum ada produk."}
            </div>
          )}
          {produkTampil.map(p => {
            const habis = p.stok <= 0;
            return (
              <div
                key={p.id}
                style={S.cardProduk(habis)}
                onClick={() => !habis && tambahKeKeranjang(p)}
              >
                {p.gambar_url ? (
                  <img src={p.gambar_url} alt={p.nama}
                    style={{ width:"100%", height:70, objectFit:"cover", borderRadius:8, marginBottom:8 }} />
                ) : (
                  <div style={{ width:"100%", height:70, background:C.surfaceHi, borderRadius:8, marginBottom:8,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>
                    📦
                  </div>
                )}
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:2, lineHeight:1.3,
                  display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                  {p.nama}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:C.accent, marginBottom:4 }}>
                  {formatRupiah(p.harga_jual)}
                </div>
                {habis ? (
                  <span style={S.badge(C.danger, "#450a0a")}>Habis</span>
                ) : (
                  <span style={{ fontSize:10, color:C.textMuted }}>Stok: {p.stok}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PANEL KANAN: Keranjang ── */}
      <div style={S.right}>

        {/* Header keranjang */}
        <div style={S.cartHeader}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontWeight:700, fontSize:15 }}>🛒 Keranjang</span>
            {keranjang.length > 0 && (
              <button style={S.btnSm(C.danger)} onClick={resetKeranjang}>Kosongkan</button>
            )}
          </div>
          <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>
            {keranjang.length} item
          </div>
        </div>

        {/* List keranjang */}
        <div style={S.cartList}>
          {keranjang.length === 0 && (
            <div style={{ textAlign:"center", color:C.textMuted, padding:"40px 20px", fontSize:13 }}>
              Klik produk untuk menambahkan
            </div>
          )}
          {keranjang.map((item, idx) => (
            <div key={item.produkId} style={S.cartItem}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:2,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {item.namaProduk}
                </div>
                <div style={{ fontSize:12, color:C.textMuted }}>{formatRupiah(item.hargaSatuan)} / {item.satuan}</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.accent, marginTop:2 }}>
                  {formatRupiah(item.subtotal)}
                </div>
              </div>
              {/* Qty control */}
              <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                <button style={S.btnSm(C.surfaceHi)} onClick={() => setQty(item.produkId, item.qty - 1)}>−</button>
                <input
                  style={{ ...S.inp, width:42, textAlign:"center", padding:"4px 0", fontSize:13 }}
                  value={item.qty}
                  onChange={e => setQty(item.produkId, e.target.value)}
                />
                <button style={S.btnSm(C.surfaceHi)} onClick={() => setQty(item.produkId, item.qty + 1)}>+</button>
                <button style={S.btnSm(C.danger)} onClick={() => hapusItem(item.produkId)}>✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Total & Bayar */}
        <div style={S.cartTotal}>
          {/* Diskon */}
          <div style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.textMuted, width:60 }}>Diskon</span>
            <select
              style={{ ...S.inp, width:80, padding:"5px 6px" }}
              value={diskon.tipe}
              onChange={e => setDiskon(d => ({ ...d, tipe: e.target.value }))}
            >
              <option value="nominal">Rp</option>
              <option value="persen">%</option>
            </select>
            <input
              style={{ ...S.inp, flex:1 }}
              type="number" min="0"
              placeholder="0"
              value={diskon.nilai || ""}
              onChange={e => setDiskon(d => ({ ...d, nilai: Number(e.target.value) || 0 }))}
            />
          </div>

          {/* Pajak */}
          <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.textMuted, width:60 }}>Pajak %</span>
            <input
              style={{ ...S.inp, flex:1 }}
              type="number" min="0" max="100"
              placeholder="0"
              value={pajak || ""}
              onChange={e => setPajak(Number(e.target.value) || 0)}
            />
          </div>

          {/* Ringkasan */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginBottom:10 }}>
            {nilaiDiskon > 0 && (
              <>
                <Row label="Subtotal" val={formatRupiah(subtotal)} />
                <Row label="Diskon" val={`− ${formatRupiah(nilaiDiskon)}`} color={C.success} />
              </>
            )}
            {nilaiPajak > 0 && (
              <Row label={`Pajak ${pajak}%`} val={formatRupiah(nilaiPajak)} />
            )}
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
              <span style={{ fontWeight:700, fontSize:15 }}>Total</span>
              <span style={{ fontWeight:800, fontSize:18, color:C.accent }}>{formatRupiah(total)}</span>
            </div>
          </div>

          <button
            style={{ ...S.btn(C.accent), opacity: keranjang.length ? 1 : 0.4 }}
            onClick={bukaBayar}
            disabled={!keranjang.length}
          >
            Bayar
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL: PEMBAYARAN
      ══════════════════════════════════════════════════════ */}
      {modal === "bayar" && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ ...modalCard, maxWidth:420 }}>
            <ModalHeader title="💳 Pembayaran" onClose={() => setModal(null)} />

            {/* Metode bayar */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
              {METODE_BAYAR.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMetodeBayar(m.id)}
                  style={{
                    background: metodeBayar === m.id ? C.accent : C.surfaceHi,
                    color: metodeBayar === m.id ? "#fff" : C.textSub,
                    border: `1px solid ${metodeBayar === m.id ? C.accent : C.border}`,
                    borderRadius:10, padding:"10px 0", fontSize:13, fontWeight:600, cursor:"pointer",
                  }}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            {/* Ringkasan total */}
            <div style={{ background:C.surfaceHi, borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
              {nilaiDiskon > 0 && <Row label="Subtotal" val={formatRupiah(subtotal)} />}
              {nilaiDiskon > 0 && <Row label="Diskon" val={`− ${formatRupiah(nilaiDiskon)}`} color={C.success} />}
              {nilaiPajak > 0  && <Row label={`Pajak ${pajak}%`} val={formatRupiah(nilaiPajak)} />}
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
                <span style={{ fontWeight:700, fontSize:16 }}>Total</span>
                <span style={{ fontWeight:800, fontSize:20, color:C.accent }}>{formatRupiah(total)}</span>
              </div>
            </div>

            {/* Input bayar (tunai saja) */}
            {metodeBayar === "tunai" && (
              <>
                <label style={{ fontSize:12, color:C.textMuted, display:"block", marginBottom:6 }}>Jumlah Bayar</label>
                <input
                  style={{ ...S.inp, fontSize:18, fontWeight:700, textAlign:"right", padding:"10px 14px", marginBottom:8 }}
                  type="number" autoFocus
                  value={bayar}
                  onChange={e => setBayar(e.target.value)}
                />
                {/* Quick nominal */}
                <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                  {[total, 50000, 100000, 200000].filter((v,i,a) => a.indexOf(v)===i).map(v => (
                    <button key={v} style={{ ...S.ghost, flex:1, fontSize:11 }} onClick={() => setBayar(String(v))}>
                      {v === total ? "Pas" : formatRupiah(v).replace("Rp ","").replace(".000","rb")}
                    </button>
                  ))}
                </div>
                {Number(bayar) >= total && (
                  <div style={{ background:"#052e16", borderRadius:8, padding:"8px 12px", marginBottom:12,
                    display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:C.success }}>Kembalian</span>
                    <span style={{ fontSize:16, fontWeight:800, color:C.success }}>{formatRupiah(kembalian)}</span>
                  </div>
                )}
              </>
            )}

            {err && <ErrBox msg={err} />}

            <button
              style={{ ...S.btn(C.success), marginTop:4 }}
              onClick={prosesBayar}
              disabled={loading}
            >
              {loading ? "Memproses..." : "✓  Konfirmasi Bayar"}
            </button>
          </div>
        </Overlay>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: STRUK
      ══════════════════════════════════════════════════════ */}
      {modal === "struk" && lastTrx && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ ...modalCard, maxWidth:360 }}>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:32, marginBottom:4 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:700 }}>Transaksi Berhasil</div>
              <div style={{ fontSize:12, color:C.textMuted }}>{lastTrx.nomor_transaksi}</div>
            </div>

            {/* Struk mini */}
            <div style={{ background:C.surfaceHi, borderRadius:10, padding:"12px 14px", marginBottom:14, fontSize:12 }}>
              <div style={{ textAlign:"center", fontWeight:700, marginBottom:8, color:C.text }}>{auth.namaToko}</div>
              <div style={{ borderTop:`1px dashed ${C.border}`, marginBottom:8 }} />
              {lastTrx.items?.map((item, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ color:C.textSub, flex:1 }}>{item.nama_produk} x{item.qty}</span>
                  <span style={{ color:C.text }}>{formatRupiah(item.subtotal)}</span>
                </div>
              ))}
              <div style={{ borderTop:`1px dashed ${C.border}`, marginTop:8, paddingTop:8 }}>
                <Row label="Total" val={formatRupiah(lastTrx.totalDibayar)} />
                {lastTrx.metode_bayar === "tunai" && (
                  <>
                    <Row label="Bayar" val={formatRupiah(lastTrx.bayar)} />
                    <Row label="Kembalian" val={formatRupiah(lastTrx.kembalian)} color={C.success} />
                  </>
                )}
              </div>
              <div style={{ borderTop:`1px dashed ${C.border}`, marginTop:8, paddingTop:8, textAlign:"center", color:C.textMuted, fontSize:11 }}>
                Terima kasih telah berbelanja!
              </div>
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <button style={{ ...S.btn(C.accent, true), flex:1 }} onClick={() => window.print()}>🖨 Cetak</button>
              <button style={{ ...S.btn(C.success), flex:1 }} onClick={() => setModal(null)}>Transaksi Baru</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: REKAP HARIAN
      ══════════════════════════════════════════════════════ */}
      {modal === "rekap" && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ ...modalCard, maxWidth:420 }}>
            <ModalHeader title="📊 Rekap Hari Ini" onClose={() => setModal(null)} />
            {rekapLoading ? (
              <div style={{ textAlign:"center", color:C.textMuted, padding:30 }}>Memuat...</div>
            ) : rekap ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <RekapCard label="Total Transaksi"  val={rekap.total_transaksi + " trx"}    icon="🧾" />
                <RekapCard label="Total Penjualan"  val={formatRupiah(rekap.total_penjualan)} icon="💰" accent />
                <RekapCard label="Tunai"            val={formatRupiah(rekap.total_tunai)}     icon="💵" />
                <RekapCard label="Non-Tunai"        val={formatRupiah(rekap.total_non_tunai)} icon="💳" />
                <RekapCard label="Laba Kotor"       val={formatRupiah(rekap.total_laba_kotor)} icon="📈" color={C.success} />
              </div>
            ) : (
              <div style={{ textAlign:"center", color:C.textMuted, padding:30 }}>Gagal memuat rekap.</div>
            )}
          </div>
        </Overlay>
      )}

    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SUB-KOMPONEN
// ══════════════════════════════════════════════════════════════

const modalCard = {
  background: "#0F172A",
  border: `1px solid #1E293B`,
  borderRadius: 16,
  padding: 24,
  width: "100%",
  maxHeight: "92vh",
  overflowY: "auto",
};

function Overlay({ children, onClose }) {
  return (
    <div
      style={{ position:"fixed", inset:0, background:"#00000088", zIndex:200,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:"#E2E8F0" }}>{title}</h3>
      <button
        style={{ background:"transparent", border:"1px solid #1E293B", color:"#64748B",
          borderRadius:8, padding:"4px 10px", cursor:"pointer" }}
        onClick={onClose}
      >✕</button>
    </div>
  );
}

function Row({ label, val, color }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:13 }}>
      <span style={{ color:"#64748B" }}>{label}</span>
      <span style={{ color: color || "#E2E8F0" }}>{val}</span>
    </div>
  );
}

function ErrBox({ msg }) {
  return (
    <div style={{ background:"#450a0a", color:"#EF4444", borderRadius:8,
      padding:"8px 12px", fontSize:13, marginBottom:12 }}>
      {msg}
    </div>
  );
}

function RekapCard({ label, val, icon, accent, color }) {
  return (
    <div style={{ background:"#1E293B", borderRadius:10, padding:"12px 14px",
      display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontSize:13, color:"#94A3B8" }}>{icon} {label}</span>
      <span style={{ fontSize:15, fontWeight:700, color: color || (accent ? "#3B82F6" : "#E2E8F0") }}>
        {val}
      </span>
    </div>
  );
}
