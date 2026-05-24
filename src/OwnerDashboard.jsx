// src/OwnerDashboard.jsx
// ══════════════════════════════════════════════════════════════
// OWNER DASHBOARD — POS SaaS
// Props:
//   auth      — { username, nama }
//   onLogout  — callback logout
// ══════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import {
  fetchAllToko, toggleAktifToko, deleteToko, registerToko,
  fetchAllLisensi, createLisensi, updateLisensi, deleteLisensi, generateLisensiKey,
  fetchKasirByToko, ownerResetPasswordKasir,
} from "./supabaseClient";
import { PAKET_LIST, getPaketById, formatRupiah, hitungTglExpired, sisaHari, statusLisensi } from "./paketConfig";

// ── Style tokens ──────────────────────────────────────────────
const S = {
  root:      { minHeight:"100vh", background:"#080E1A", color:"#E2E8F0",
               fontFamily:"'DM Sans','Segoe UI',sans-serif" },
  header:    { background:"#0B1120", borderBottom:"1px solid #1A2744",
               position:"sticky", top:0, zIndex:100 },
  inner:     { maxWidth:1280, margin:"0 auto", padding:"11px 20px",
               display:"flex", alignItems:"center", justifyContent:"space-between" },
  main:      { maxWidth:1280, margin:"0 auto", padding:"24px 20px" },
  card:      { background:"#0F172A", border:"1px solid #1E293B", borderRadius:16, padding:22 },
  cardTitle: { fontSize:17, fontWeight:800, color:"#E2E8F0", margin:"0 0 4px" },
  cta:       { background:"linear-gradient(135deg,#3B82F6,#6366F1)", color:"#fff", border:"none",
               borderRadius:10, padding:"8px 18px", fontSize:13, fontWeight:700, cursor:"pointer" },
  ctaGreen:  { background:"linear-gradient(135deg,#10B981,#059669)", color:"#fff", border:"none",
               borderRadius:10, padding:"8px 18px", fontSize:13, fontWeight:700, cursor:"pointer" },
  ghost:     { background:"transparent", border:"1px solid #1E293B", color:"#94A3B8",
               borderRadius:10, padding:"7px 14px", cursor:"pointer", fontSize:13 },
  th:        { padding:"10px 12px", textAlign:"left", fontSize:11, color:"#475569",
               fontWeight:700, borderBottom:"1px solid #1E293B", whiteSpace:"nowrap" },
  td:        { padding:"10px 12px", fontSize:13, color:"#94A3B8", whiteSpace:"nowrap" },
  tr:        { borderBottom:"1px solid #0B112088" },
  inp:       { width:"100%", background:"#0B1120", border:"1px solid #1E293B", color:"#E2E8F0",
               borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", boxSizing:"border-box" },
  lbl:       { fontSize:12, color:"#475569", fontWeight:600, display:"block", marginBottom:4 },
  fg:        { marginBottom:12 },
  err:       { background:"#450A0A", color:"#F87171", borderRadius:8,
               padding:"8px 12px", fontSize:13, marginBottom:10 },
  ok:        { background:"#052e16", color:"#4ade80", borderRadius:8,
               padding:"8px 12px", fontSize:13, marginBottom:10 },
};

// ── Kartu pilih paket ─────────────────────────────────────────
function PaketCard({ paket, selected, onSelect }) {
  const aktif = selected === paket.id;
  return (
    <div onClick={() => onSelect(paket.id)} style={{
      border: `2px solid ${aktif ? paket.warna : "#1E293B"}`,
      background: aktif ? paket.warnaLight : "#0B1120",
      borderRadius:12, padding:"12px 14px", cursor:"pointer", position:"relative", transition:"all 0.15s",
    }}>
      {paket.popular && (
        <div style={{ position:"absolute", top:-9, right:10, background:"#8B5CF6",
          color:"#fff", fontSize:9, fontWeight:800, borderRadius:20, padding:"2px 8px" }}>POPULER</div>
      )}
      <div style={{ fontWeight:800, fontSize:13, color: aktif ? paket.warna : "#E2E8F0", marginBottom:2 }}>{paket.nama}</div>
      <div style={{ fontSize:11, color:"#475569", marginBottom:6 }}>{paket.deskripsi}</div>
      <div style={{ fontSize:14, fontWeight:900, color: paket.warna, marginBottom:4 }}>{paket.hargaStr}</div>
      <div style={{ fontSize:11, color:"#64748B", lineHeight:1.9 }}>
        📦 {paket.maksProduk ?? "∞"} produk<br/>
        👤 {paket.maksKasir  ?? "∞"} kasir<br/>
        🏪 {paket.maksCabang ?? "∞"} cabang<br/>
        📅 {paket.durasi ? `${paket.durasi} hari` : "Selamanya"}
      </div>
    </div>
  );
}

// ── Overlay wrapper ───────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODAL: Tambah / Edit Lisensi
// ══════════════════════════════════════════════════════════════
function ModalLisensi({ tokoList, lisensiEdit, onSave, onClose }) {
  const isEdit    = !!lisensiEdit;
  const initPaket = lisensiEdit ? (getPaketById(lisensiEdit.paket) || PAKET_LIST[0]) : PAKET_LIST[1];

  const [tokoId,     setTokoId]     = useState(lisensiEdit?.toko_id || "");
  const [lisensiKey, setLisensiKey] = useState(lisensiEdit?.lisensi_key || generateLisensiKey());
  const [paketId,    setPaketId]    = useState(initPaket.id);
  const [tglMulai,   setTglMulai]   = useState(lisensiEdit?.tgl_mulai || new Date().toISOString().slice(0,10));
  const [catatan,    setCatatan]    = useState(lisensiEdit?.catatan || "");
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState("");

  const paket      = getPaketById(paketId);
  const tglExpired = paket?.durasi ? hitungTglExpired(tglMulai, paket.durasi) : null;

  async function handleSave() {
    if (!isEdit && !tokoId) { setErr("Pilih toko terlebih dahulu."); return; }
    setLoading(true); setErr("");
    try {
      await onSave({
        id:         lisensiEdit?.id,
        tokoId,
        lisensiKey,
        paket:      paketId,
        maksProduk: paket?.maksProduk ?? null,
        maksKasir:  paket?.maksKasir  ?? null,
        maksCabang: paket?.maksCabang ?? null,
        tglMulai,
        tglExpired,
        catatan,
      });
      onClose();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...S.card, width:"100%", maxWidth:580, maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ ...S.cardTitle, margin:0 }}>{isEdit ? "✏️ Edit Lisensi" : "➕ Tambah Lisensi"}</h3>
          <button style={{ ...S.ghost, padding:"4px 10px" }} onClick={onClose}>✕</button>
        </div>

        {!isEdit && (
          <div style={S.fg}>
            <label style={S.lbl}>Toko</label>
            <select style={S.inp} value={tokoId} onChange={e => setTokoId(e.target.value)}>
              <option value="">-- Pilih Toko --</option>
              {tokoList.map(t => (
                <option key={t.id} value={t.id}>{t.nama} ({t.kode})</option>
              ))}
            </select>
          </div>
        )}

        {/* Pilih Paket */}
        <div style={S.fg}>
          <label style={S.lbl}>Pilih Paket</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:6 }}>
            {PAKET_LIST.map(p => (
              <PaketCard key={p.id} paket={p} selected={paketId} onSelect={setPaketId} />
            ))}
          </div>
        </div>

        {/* Ringkasan paket */}
        {paket && (
          <div style={{ background:"#0B1120", border:`1px solid ${paket.warna}44`,
            borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:11, color:"#475569", fontWeight:700, marginBottom:6 }}>RINGKASAN PAKET</div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:13 }}>
              <span style={{ color:"#E2E8F0" }}>📦 <strong>{paket.nama}</strong></span>
              <span style={{ color:"#94A3B8" }}>📦 {paket.maksProduk ?? "∞"} produk</span>
              <span style={{ color:"#94A3B8" }}>👤 {paket.maksKasir  ?? "∞"} kasir</span>
              <span style={{ color:"#94A3B8" }}>🏪 {paket.maksCabang ?? "∞"} cabang</span>
              <span style={{ color: paket.warna, fontWeight:700 }}>{paket.hargaStr}</span>
            </div>
            {tglExpired && (
              <div style={{ fontSize:12, color:"#475569", marginTop:6 }}>
                Expired: <strong style={{ color:"#E2E8F0" }}>
                  {new Date(tglExpired).toLocaleDateString("id-ID", { day:"2-digit", month:"long", year:"numeric" })}
                </strong>
              </div>
            )}
            {!tglExpired && (
              <div style={{ fontSize:12, color:"#A78BFA", marginTop:6, fontWeight:700 }}>🚀 Berlaku selamanya</div>
            )}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={S.fg}>
            <label style={S.lbl}>Tanggal Mulai</label>
            <input style={S.inp} type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} />
          </div>
          <div style={S.fg}>
            <label style={S.lbl}>Lisensi Key</label>
            <div style={{ display:"flex", gap:6 }}>
              <input style={{ ...S.inp, fontFamily:"monospace", fontSize:11, letterSpacing:1 }}
                value={lisensiKey}
                onChange={e => setLisensiKey(e.target.value.toUpperCase())}
                readOnly={isEdit} />
              {!isEdit && (
                <button style={{ ...S.ghost, padding:"6px 8px", fontSize:13 }}
                  title="Generate ulang"
                  onClick={() => setLisensiKey(generateLisensiKey())}>🔄</button>
              )}
            </div>
          </div>
        </div>

        <div style={S.fg}>
          <label style={S.lbl}>Catatan (opsional)</label>
          <input style={S.inp} placeholder="mis: Transfer 24 Mei 2026 — BCA"
            value={catatan} onChange={e => setCatatan(e.target.value)} />
        </div>

        {err && <div style={S.err}>{err}</div>}

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button style={S.ghost} onClick={onClose}>Batal</button>
          <button style={S.ctaGreen} onClick={handleSave} disabled={loading}>
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat Lisensi"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ══════════════════════════════════════════════════════════════
// MODAL: Daftarkan Toko Baru (dari Owner)
// ══════════════════════════════════════════════════════════════
function ModalDaftarToko({ onSave, onClose }) {
  const [form, setForm] = useState({
    namaToko:"", alamat:"", kode:"", telepon:"",
    namaAdmin:"", username:"", password:"",
  });
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  async function handleSave() {
    const { namaToko, kode, username, password } = form;
    if (!namaToko || !kode || !username || !password)
      { setErr("Nama toko, kode, username, dan password wajib diisi."); return; }
    if (password.length < 6)
      { setErr("Password minimal 6 karakter."); return; }
    setLoading(true); setErr("");
    try {
      await onSave(form);
      onClose();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...S.card, width:"100%", maxWidth:500, maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ ...S.cardTitle, margin:0 }}>🏪 Daftarkan Toko Baru</h3>
          <button style={{ ...S.ghost, padding:"4px 10px" }} onClick={onClose}>✕</button>
        </div>

        {err && <div style={S.err}>{err}</div>}

        <div style={S.fg}>
          <label style={S.lbl}>Nama Toko *</label>
          <input style={S.inp} value={form.namaToko}
            onChange={e => setForm(f => ({ ...f, namaToko: e.target.value }))}
            placeholder="Toko Sumber Jaya" />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={S.fg}>
            <label style={S.lbl}>Kode Unik Toko *</label>
            <input style={S.inp} value={form.kode}
              onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))}
              placeholder="TK001" maxLength={20} />
          </div>
          <div style={S.fg}>
            <label style={S.lbl}>Telepon</label>
            <input style={S.inp} value={form.telepon}
              onChange={e => setForm(f => ({ ...f, telepon: e.target.value }))}
              placeholder="0812xxxx" />
          </div>
        </div>
        <div style={S.fg}>
          <label style={S.lbl}>Alamat</label>
          <input style={S.inp} value={form.alamat}
            onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))}
            placeholder="Jl. Contoh No. 1, Kota" />
        </div>

        <hr style={{ border:"none", borderTop:"1px solid #1E293B", margin:"12px 0" }} />
        <p style={{ color:"#94A3B8", fontSize:11, marginBottom:12 }}>Akun admin toko:</p>

        <div style={S.fg}>
          <label style={S.lbl}>Nama Admin</label>
          <input style={S.inp} value={form.namaAdmin}
            onChange={e => setForm(f => ({ ...f, namaAdmin: e.target.value }))}
            placeholder="Nama pemilik / admin" />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={S.fg}>
            <label style={S.lbl}>Username *</label>
            <input style={S.inp} value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="admin_toko1" />
          </div>
          <div style={S.fg}>
            <label style={S.lbl}>Password *</label>
            <input style={S.inp} type="text" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Min. 6 karakter" />
          </div>
        </div>

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:4 }}>
          <button style={S.ghost} onClick={onClose}>Batal</button>
          <button style={S.cta} onClick={handleSave} disabled={loading}>
            {loading ? "Mendaftarkan..." : "Daftarkan Toko"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ══════════════════════════════════════════════════════════════
// MODAL: Reset Password Kasir
// ══════════════════════════════════════════════════════════════
function ModalResetKasir({ toko, onClose }) {
  const [kasirList,    setKasirList]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedId,   setSelectedId]   = useState("");
  const [passBaru,     setPassBaru]     = useState("");
  const [resLoading,   setResLoading]   = useState(false);
  const [msg,          setMsg]          = useState("");

  useEffect(() => {
    fetchKasirByToko(toko.id)
      .then(data => { setKasirList(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [toko.id]);

  async function handleReset() {
    if (!selectedId) { setMsg("❌ Pilih kasir."); return; }
    if (passBaru.length < 6) { setMsg("❌ Password minimal 6 karakter."); return; }
    setResLoading(true); setMsg("");
    try {
      await ownerResetPasswordKasir(Number(selectedId), passBaru);
      setMsg("✅ Password berhasil direset!");
      setPassBaru("");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) { setMsg("❌ " + (e.message || "Gagal.")); }
    setResLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...S.card, width:"100%", maxWidth:420 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:"#E2E8F0" }}>🔑 Reset Password Kasir</div>
            <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>{toko.nama}</div>
          </div>
          <button style={{ background:"none", border:"none", color:"#475569", fontSize:20, cursor:"pointer" }} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ color:"#475569", fontSize:13, textAlign:"center", padding:20 }}>Memuat kasir...</div>
        ) : (
          <>
            <div style={S.fg}>
              <label style={S.lbl}>Pilih Kasir</label>
              <select style={S.inp} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                <option value="">-- Pilih kasir --</option>
                {kasirList.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.nama || k.username} ({k.role === "admin_toko" ? "Admin" : "Kasir"})
                  </option>
                ))}
              </select>
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Password Baru</label>
              <input style={S.inp} type="text" placeholder="Minimal 6 karakter"
                value={passBaru} onChange={e => setPassBaru(e.target.value)} />
            </div>

            {msg && (
              <div style={{
                background: msg.startsWith("✅") ? "#052e16" : "#2d0a0a",
                border: `1px solid ${msg.startsWith("✅") ? "#16a34a" : "#ef4444"}`,
                borderRadius:8, padding:"8px 12px", fontSize:13, marginBottom:12,
                color: msg.startsWith("✅") ? "#4ade80" : "#f87171",
              }}>{msg}</div>
            )}

            <div style={{ display:"flex", gap:8 }}>
              <button style={{ ...S.ghost, flex:1 }} onClick={onClose}>Batal</button>
              <button style={{ flex:2, background:"linear-gradient(135deg,#F59E0B,#D97706)",
                border:"none", borderRadius:10, padding:10, color:"#fff", fontWeight:700,
                cursor:"pointer", fontSize:14, opacity: resLoading ? 0.6 : 1 }}
                onClick={handleReset} disabled={resLoading}>
                {resLoading ? "Mereset..." : "🔑 Reset Password"}
              </button>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function OwnerDashboard({ auth, onLogout }) {
  const [tab,          setTab]          = useState("toko");
  const [tokoList,     setTokoList]     = useState([]);
  const [lisensiList,  setLisensiList]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState("semua");

  // Modal state
  const [modalLisensi, setModalLisensi] = useState(false);
  const [lisensiEdit,  setLisensiEdit]  = useState(null);
  const [modalToko,    setModalToko]    = useState(false);
  const [modalReset,   setModalReset]   = useState(null); // toko object

  const [copied, setCopied] = useState(null);

  // ── Load data ──────────────────────────────────────────────
  async function load() {
    setLoading(true);
    try {
      const [t, l] = await Promise.all([fetchAllToko(), fetchAllLisensi()]);
      setTokoList(t);
      setLisensiList(l);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Actions ────────────────────────────────────────────────
  async function handleToggle(id, aktif) {
    await toggleAktifToko(id, aktif);
    setTokoList(prev => prev.map(t => t.id === id ? { ...t, aktif } : t));
  }

  async function handleDeleteToko(id, nama) {
    if (!window.confirm(`Hapus toko "${nama}"?\n\nSemua data produk, transaksi, kasir, dan lisensi akan terhapus permanen.`)) return;
    setLoading(true);
    try {
      await deleteToko(id);
      setTokoList(prev => prev.filter(t => t.id !== id));
      setLisensiList(prev => prev.filter(l => l.toko_id !== id));
    } catch (e) { alert("Gagal: " + e.message); }
    setLoading(false);
  }

  async function handleDaftarToko(form) {
    await registerToko({
      namaToko:      form.namaToko,
      alamat:        form.alamat,
      telepon:       form.telepon,
      kode:          form.kode,
      usernameAdmin: form.username,
      passwordAdmin: form.password,
      namaAdmin:     form.namaAdmin || form.namaToko,
    });
    await load();
  }

  async function handleSaveLisensi({ id, tokoId, lisensiKey, paket,
    maksProduk, maksKasir, maksCabang, tglMulai, tglExpired, catatan }) {
    if (id) {
      await updateLisensi(id, { paket, maksProduk, maksKasir, maksCabang, tglExpired, catatan });
    } else {
      await createLisensi({ tokoId, lisensiKey, paket, maksProduk, maksKasir, maksCabang, tglMulai, tglExpired, catatan });
    }
    const l = await fetchAllLisensi();
    setLisensiList(l);
  }

  async function handleDeleteLisensi(id, key) {
    if (!window.confirm(`Hapus lisensi "${key}"?`)) return;
    await deleteLisensi(id);
    setLisensiList(prev => prev.filter(l => l.id !== id));
  }

  function copyKey(key) {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // ── Derived stats ──────────────────────────────────────────
  const totalAktif   = tokoList.filter(t => t.aktif).length;
  const totalPending = tokoList.filter(t => !t.aktif).length;
  const totalExpired = lisensiList.filter(l => l.tgl_expired && sisaHari(l.tgl_expired) < 0).length;
  const totalSegera  = lisensiList.filter(l => { const s = sisaHari(l.tgl_expired); return s !== null && s >= 0 && s <= 7; }).length;

  const tokoFiltered = tokoList.filter(t =>
    filter === "semua" ? true : filter === "aktif" ? t.aktif : !t.aktif
  );

  // Untuk tiap toko, ambil lisensi aktif terdekat expired
  const today = new Date().toISOString().slice(0, 10);
  function getLisensiAktif(tokoId) {
    return lisensiList
      .filter(l => l.toko_id === tokoId && (!l.tgl_expired || l.tgl_expired >= today))
      .sort((a, b) => (b.tgl_expired || "9999") > (a.tgl_expired || "9999") ? 1 : -1)[0];
  }

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div style={S.root}>
      {/* Modals */}
      {modalLisensi && (
        <ModalLisensi
          tokoList={tokoList}
          lisensiEdit={lisensiEdit}
          onSave={handleSaveLisensi}
          onClose={() => { setModalLisensi(false); setLisensiEdit(null); }}
        />
      )}
      {modalToko && (
        <ModalDaftarToko
          onSave={handleDaftarToko}
          onClose={() => setModalToko(false)}
        />
      )}
      {modalReset && (
        <ModalResetKasir
          toko={modalReset}
          onClose={() => setModalReset(null)}
        />
      )}

      {/* Header */}
      <header style={S.header}>
        <div style={S.inner}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:26 }}>🏪</span>
            <div>
              <div style={{ fontWeight:800, fontSize:14 }}>OWNER DASHBOARD</div>
              <div style={{ fontSize:11, color:"#475569" }}>Manajemen Toko & Lisensi POS</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:13, color:"#475569" }}>Halo, {auth.nama || auth.username}</span>
            <button style={S.ghost} onClick={load} disabled={loading}>🔄 Refresh</button>
            <button style={{ ...S.ghost, borderColor:"#EF444444", color:"#EF4444" }} onClick={onLogout}>Keluar</button>
          </div>
        </div>
      </header>

      <main style={S.main}>

        {/* ── Stat Cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:20 }}>
          {[
            ["Total Toko",      tokoList.length, "#3B82F6", "🏪"],
            ["Aktif",           totalAktif,      "#10B981", "✅"],
            ["Pending",         totalPending,    "#F59E0B", "⏳"],
            ["Lisensi Expired", totalExpired,    "#EF4444", "❌"],
            ["Segera Expired",  totalSegera,     "#F97316", "⚠️"],
          ].map(([lbl, val, col, icon]) => (
            <div key={lbl} style={{ background:"#0F172A", border:"1px solid #1E293B", borderRadius:14, padding:16 }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
              <div style={{ fontSize:24, fontWeight:900, color:col }}>{val}</div>
              <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* Alert banners */}
        {totalPending > 0 && (
          <div style={{ background:"#451A03", border:"1px solid #F59E0B44", borderRadius:12,
            padding:"12px 16px", marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>⚠️</span>
            <div>
              <div style={{ color:"#F59E0B", fontWeight:700 }}>{totalPending} toko menunggu aktivasi</div>
              <div style={{ color:"#92400e", fontSize:12 }}>Aktifkan toko yang sudah membayar</div>
            </div>
            <button style={{ ...S.cta, marginLeft:"auto", background:"#F59E0B" }}
              onClick={() => { setTab("toko"); setFilter("pending"); }}>Lihat →</button>
          </div>
        )}
        {totalExpired > 0 && (
          <div style={{ background:"#450a0a", border:"1px solid #EF444444", borderRadius:12,
            padding:"12px 16px", marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>❌</span>
            <div>
              <div style={{ color:"#EF4444", fontWeight:700 }}>{totalExpired} lisensi expired</div>
              <div style={{ color:"#7f1d1d", fontSize:12 }}>Toko tidak bisa login hingga diperpanjang</div>
            </div>
            <button style={{ ...S.cta, marginLeft:"auto", background:"#EF4444" }}
              onClick={() => setTab("lisensi")}>Kelola →</button>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
          {[["toko","🏪 Toko"],["lisensi","🔑 Lisensi"],["paket","📦 Daftar Paket"]].map(([t,lbl]) => (
            <button key={t}
              style={{ ...S.ghost, fontWeight:700, ...(tab===t ? { background:"#1E3A5F", color:"#60A5FA", borderColor:"#1E3A5F" } : {}) }}
              onClick={() => setTab(t)}>{lbl}</button>
          ))}
        </div>

        {/* ══ TAB: TOKO ══ */}
        {tab === "toko" && (
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              marginBottom:16, flexWrap:"wrap", gap:10 }}>
              <div>
                <h2 style={S.cardTitle}>🏪 Daftar Toko</h2>
                <p style={{ color:"#475569", fontSize:13, margin:0 }}>{tokoFiltered.length} toko</p>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["semua","aktif","pending"].map(f => (
                  <button key={f}
                    style={{ ...S.ghost, ...(filter===f ? { background:"#1E3A5F", color:"#60A5FA", borderColor:"#1E3A5F" } : {}) }}
                    onClick={() => setFilter(f)}>
                    {f === "semua" ? "Semua" : f === "aktif" ? "Aktif" : "Pending"}
                  </button>
                ))}
                <button style={S.cta} onClick={() => setModalToko(true)}>➕ Daftar Toko</button>
              </div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    {["No","Nama Toko","Kode","Tgl Daftar","Status","Paket Aktif","Lisensi","Aksi"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={8} style={{ ...S.td, textAlign:"center", padding:30, color:"#475569" }}>Memuat...</td></tr>
                  )}
                  {!loading && tokoFiltered.length === 0 && (
                    <tr><td colSpan={8} style={{ ...S.td, textAlign:"center", padding:30, color:"#475569" }}>Belum ada toko.</td></tr>
                  )}
                  {tokoFiltered.map((t, i) => {
                    const lis = getLisensiAktif(t.id);
                    const st  = lis ? statusLisensi(lis.tgl_expired) : null;
                    const pk  = lis ? getPaketById(lis.paket) : null;
                    return (
                      <tr key={t.id} style={S.tr}>
                        <td style={S.td}>{i + 1}</td>
                        <td style={{ ...S.td, fontWeight:600, color:"#E2E8F0" }}>
                          {t.nama}
                          {t.telepon && <div style={{ fontSize:11, color:"#475569" }}>{t.telepon}</div>}
                        </td>
                        <td style={S.td}>
                          <span style={{ background:"#1E293B", color:"#60A5FA", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                            {t.kode}
                          </span>
                        </td>
                        <td style={S.td}>{t.created_at ? new Date(t.created_at).toLocaleDateString("id-ID") : "-"}</td>
                        <td style={S.td}>
                          <span style={{ background: t.aktif ? "#052e16" : "#451A03",
                            color: t.aktif ? "#4ade80" : "#F59E0B",
                            borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                            {t.aktif ? "✅ Aktif" : "⏳ Pending"}
                          </span>
                        </td>
                        <td style={S.td}>
                          {pk
                            ? <span style={{ color: pk.warna, fontWeight:700, fontSize:12 }}>{pk.nama}</span>
                            : t.paket_pilihan
                              ? <span>
                                  <span style={{ color: getPaketById(t.paket_pilihan)?.warna || "#F59E0B", fontWeight:700, fontSize:12 }}>
                                    {getPaketById(t.paket_pilihan)?.nama || t.paket_pilihan}
                                  </span>
                                  <span style={{ color:"#F59E0B", fontSize:10, marginLeft:4 }}>(belum bayar)</span>
                                </span>
                              : <span style={{ color:"#334155", fontSize:11 }}>—</span>}
                        </td>
                        <td style={S.td}>
                          {st
                            ? <span style={{ background: st.warnaLatar, color: st.warna, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{st.label}</span>
                            : <span style={{ color:"#334155", fontSize:11 }}>Belum ada</span>}
                        </td>
                        <td style={S.td}>
                          <div style={{ display:"flex", gap:4 }}>
                            {t.aktif
                              ? <button style={{ ...S.ghost, padding:"4px 9px", fontSize:11, color:"#F59E0B", borderColor:"#F59E0B44" }}
                                  onClick={() => handleToggle(t.id, false)}>Nonaktifkan</button>
                              : <button style={{ ...S.cta, padding:"4px 12px", fontSize:11 }}
                                  onClick={() => handleToggle(t.id, true)}>Aktifkan</button>}
                            <button style={{ ...S.ghost, padding:"4px 9px", fontSize:11, color:"#60A5FA", borderColor:"#60A5FA33" }}
                              onClick={() => setModalReset(t)}>🔑 Kasir</button>
                            <button style={{ ...S.ghost, padding:"4px 9px", fontSize:11, color:"#10B981", borderColor:"#10B98133" }}
                              onClick={() => { setLisensiEdit(null); setModalLisensi(true); }}>+ Lisensi</button>
                            <button style={{ ...S.ghost, padding:"4px 9px", fontSize:11, color:"#EF4444", borderColor:"#EF444433" }}
                              onClick={() => handleDeleteToko(t.id, t.nama)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB: LISENSI ══ */}
        {tab === "lisensi" && (
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              marginBottom:16, flexWrap:"wrap", gap:10 }}>
              <div>
                <h2 style={S.cardTitle}>🔑 Manajemen Lisensi</h2>
                <p style={{ color:"#475569", fontSize:13, margin:0 }}>{lisensiList.length} lisensi terdaftar</p>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button style={S.ctaGreen} onClick={() => { setLisensiEdit(null); setModalLisensi(true); }}>
                  ➕ Tambah Lisensi
                </button>
              </div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    {["No","Toko","Lisensi Key","Paket","Produk","Kasir","Cabang","Tgl Mulai","Expired","Status","Aksi"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={11} style={{ ...S.td, textAlign:"center", padding:30, color:"#475569" }}>Memuat...</td></tr>
                  )}
                  {!loading && lisensiList.length === 0 && (
                    <tr><td colSpan={11} style={{ ...S.td, textAlign:"center", padding:30, color:"#475569" }}>Belum ada lisensi.</td></tr>
                  )}
                  {lisensiList.map((l, i) => {
                    const st = statusLisensi(l.tgl_expired);
                    const pk = getPaketById(l.paket);
                    return (
                      <tr key={l.id} style={S.tr}>
                        <td style={S.td}>{i + 1}</td>
                        <td style={{ ...S.td, color:"#E2E8F0", fontWeight:600 }}>
                          {l.toko?.nama || "—"}
                          <div style={{ fontSize:11, color:"#475569" }}>{l.toko?.kode}</div>
                        </td>
                        <td style={S.td}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ fontFamily:"monospace", fontSize:11, color:"#93C5FD", letterSpacing:1 }}>
                              {l.lisensi_key}
                            </span>
                            <button title="Salin"
                              style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, padding:2 }}
                              onClick={() => copyKey(l.lisensi_key)}>
                              {copied === l.lisensi_key ? "✅" : "📋"}
                            </button>
                          </div>
                          {l.catatan && <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>{l.catatan}</div>}
                        </td>
                        <td style={S.td}>
                          <span style={{ color: pk?.warna || "#94A3B8", fontWeight:700, fontSize:12 }}>
                            {pk?.nama || l.paket}
                          </span>
                        </td>
                        <td style={S.td}>{l.maks_produk ?? "∞"}</td>
                        <td style={S.td}>{l.maks_kasir  ?? "∞"}</td>
                        <td style={S.td}>{l.maks_cabang ?? "∞"}</td>
                        <td style={S.td}>{l.tgl_mulai ? new Date(l.tgl_mulai).toLocaleDateString("id-ID") : "-"}</td>
                        <td style={S.td}>{l.tgl_expired ? new Date(l.tgl_expired).toLocaleDateString("id-ID") : "∞ Selamanya"}</td>
                        <td style={S.td}>
                          <span style={{ background: st.warnaLatar, color: st.warna, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div style={{ display:"flex", gap:4 }}>
                            <button style={{ ...S.ghost, padding:"4px 10px", fontSize:11, color:"#60A5FA", borderColor:"#60A5FA44" }}
                              onClick={() => { setLisensiEdit(l); setModalLisensi(true); }}>✏️ Edit</button>
                            <button style={{ ...S.ghost, padding:"4px 9px", fontSize:11, color:"#EF4444", borderColor:"#EF444433" }}
                              onClick={() => handleDeleteLisensi(l.id, l.lisensi_key)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB: DAFTAR PAKET ══ */}
        {tab === "paket" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:16, marginBottom:20 }}>
              {PAKET_LIST.map(p => (
                <div key={p.id} style={{ background:"#0F172A", border:`2px solid ${p.warna}44`, borderRadius:16, padding:22, position:"relative" }}>
                  {p.popular && (
                    <div style={{ position:"absolute", top:-10, right:14, background:"#8B5CF6",
                      color:"#fff", fontSize:10, fontWeight:800, borderRadius:20, padding:"2px 10px" }}>POPULER</div>
                  )}
                  <div style={{ fontSize:20, fontWeight:900, color: p.warna, marginBottom:4 }}>{p.nama}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:"#E2E8F0", marginBottom:4 }}>{p.hargaStr}</div>
                  <div style={{ fontSize:12, color:"#475569", marginBottom:14 }}>{p.deskripsi}</div>
                  <div style={{ fontSize:13, color:"#94A3B8", lineHeight:2 }}>
                    ✅ {p.maksProduk  ? `${p.maksProduk} produk`   : "Unlimited produk"}<br/>
                    ✅ {p.maksKasir   ? `${p.maksKasir} kasir`     : "Unlimited kasir"}<br/>
                    ✅ {p.maksCabang  ? `${p.maksCabang} cabang`   : "Unlimited cabang"}<br/>
                    ✅ {p.durasi      ? `Berlaku ${p.durasi} hari` : "Berlaku selamanya"}<br/>
                    ✅ Laporan penjualan<br/>
                    ✅ Manajemen stok & produk
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, borderColor:"#1E3A5F" }}>
              <h3 style={{ ...S.cardTitle, fontSize:14, marginBottom:10 }}>📋 Alur Aktivasi Toko</h3>
              <div style={{ color:"#475569", fontSize:13, lineHeight:2.2 }}>
                1. Toko mendaftar di halaman <strong style={{ color:"#60A5FA" }}>Daftar Toko</strong> (atau Owner daftarkan manual via tombol ➕)<br/>
                2. Toko memilih paket & melakukan pembayaran ke Owner<br/>
                3. Owner buka tab <strong style={{ color:"#4ade80" }}>Lisensi</strong> → klik <strong style={{ color:"#4ade80" }}>Tambah Lisensi</strong> → pilih toko & paket<br/>
                4. Lisensi key otomatis ter-generate — salin & kirim ke toko<br/>
                5. Kembali ke tab <strong style={{ color:"#4ade80" }}>Toko</strong> → klik <strong style={{ color:"#4ade80" }}>Aktifkan</strong>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
