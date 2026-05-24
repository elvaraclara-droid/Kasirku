// src/App.jsx
// ══════════════════════════════════════════════════════════════
// ROUTER UTAMA — POS SaaS
// Flow:
//   LoginPage → (kasir) → BukaSesiPage → KasirPage
//             → (owner) → OwnerDashboard
// ══════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import LoginPage     from "./LoginPage";
import KasirPage     from "./KasirPage";
import OwnerDashboard from "./OwnerDashboard";
import { bukaSesiKasir, fetchSesiAktif } from "./supabaseClient";
import { formatRupiah, statusLisensi, sisaHari } from "./paketConfig";

// ── session storage keys ──────────────────────────────────────
const KEY_AUTH = "pos_auth";
const KEY_SESI = "pos_sesi";

// ── Helper persist ────────────────────────────────────────────
function saveSession(auth, sesi) {
  sessionStorage.setItem(KEY_AUTH, JSON.stringify(auth));
  if (sesi) sessionStorage.setItem(KEY_SESI, JSON.stringify(sesi));
  else sessionStorage.removeItem(KEY_SESI);
}
function loadSession() {
  try {
    const auth = JSON.parse(sessionStorage.getItem(KEY_AUTH) || "null");
    const sesi = JSON.parse(sessionStorage.getItem(KEY_SESI) || "null");
    return { auth, sesi };
  } catch { return { auth: null, sesi: null }; }
}

// ══════════════════════════════════════════════════════════════
// HALAMAN: BUKA SESI KASIR
// Ditampilkan antara login dan layar kasir utama
// ══════════════════════════════════════════════════════════════
function BukaSesiPage({ auth, onSesiDibuka, onLogout }) {
  const [modal, setModal]   = useState(false);
  const [cabangId, setCabangId] = useState(null);
  const [modal_awal, setModalAwal] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");
  const [checking, setChecking] = useState(true);

  const S = {
    root:  { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
              background:"#080E1A", padding:16 },
    card:  { background:"#0F172A", border:"1px solid #1E293B", borderRadius:18,
              padding:32, maxWidth:420, width:"100%", textAlign:"center" },
    inp:   { width:"100%", boxSizing:"border-box", background:"#1E293B", border:"1px solid #334155",
              borderRadius:10, padding:"10px 12px", color:"#E2E8F0", fontSize:14, outline:"none", marginBottom:10 },
    cta:   { background:"linear-gradient(135deg,#3B82F6,#6366F1)", color:"#fff", border:"none",
              borderRadius:12, padding:"11px", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%" },
    ghost: { background:"transparent", border:"1px solid #1E293B", color:"#94A3B8",
              borderRadius:10, padding:"9px", cursor:"pointer", fontSize:13, width:"100%", marginTop:8 },
  };

  // Cek apakah ada sesi aktif yang belum ditutup
  useEffect(() => {
    async function cek() {
      const sesi = await fetchSesiAktif(auth.kasirId).catch(() => null);
      if (sesi) onSesiDibuka(sesi);
      else setChecking(false);
    }
    cek();
  }, []);

  async function handleBuka() {
    setLoading(true); setErr("");
    try {
      const sesi = await bukaSesiKasir({
        tokoId:   auth.tokoId,
        cabangId: cabangId || null,
        kasirId:  auth.kasirId,
        modalAwal: Number(modal_awal) || 0,
      });
      onSesiDibuka(sesi);
    } catch (e) {
      setErr(e.message || "Gagal membuka sesi.");
    }
    setLoading(false);
  }

  if (checking) {
    return (
      <div style={S.root}>
        <div style={{ color:"#475569", fontSize:14 }}>Memeriksa sesi...</div>
      </div>
    );
  }

  const status = statusLisensi(auth.tglExpired);
  const sisa   = sisaHari(auth.tglExpired);

  return (
    <div style={S.root}>
      <div style={S.card}>
        {auth.logoUrl && (
          <img src={auth.logoUrl} alt="logo"
            style={{ width:64, height:64, borderRadius:12, objectFit:"cover", marginBottom:12 }} />
        )}
        <h2 style={{ color:"#E2E8F0", margin:"0 0 4px" }}>{auth.namaToko}</h2>
        <p style={{ color:"#64748B", fontSize:13, margin:"0 0 16px" }}>
          Halo, <strong style={{ color:"#94A3B8" }}>{auth.namaKasir}</strong>!
        </p>

        {/* Status lisensi */}
        <div style={{ background: status.warnaLatar, border:`1px solid ${status.warna}44`,
          borderRadius:10, padding:"8px 14px", marginBottom:20, display:"inline-block" }}>
          <span style={{ color: status.warna, fontWeight:700, fontSize:13 }}>{status.label}</span>
          {sisa !== null && sisa <= 30 && sisa >= 0 && (
            <div style={{ fontSize:11, color:"#64748B", marginTop:2 }}>
              Lisensi habis {sisa} hari lagi — hubungi admin untuk perpanjangan
            </div>
          )}
        </div>

        {/* Paket info */}
        <div style={{ background:"#1E293B", borderRadius:10, padding:"10px 14px", marginBottom:20,
          display:"flex", justifyContent:"space-around", fontSize:12 }}>
          <div>
            <div style={{ color:"#64748B" }}>Paket</div>
            <div style={{ color:"#E2E8F0", fontWeight:700, textTransform:"capitalize" }}>{auth.paket}</div>
          </div>
          <div>
            <div style={{ color:"#64748B" }}>Produk maks</div>
            <div style={{ color:"#E2E8F0", fontWeight:700 }}>{auth.maksProduk ?? "∞"}</div>
          </div>
          <div>
            <div style={{ color:"#64748B" }}>Kasir maks</div>
            <div style={{ color:"#E2E8F0", fontWeight:700 }}>{auth.maksKasir ?? "∞"}</div>
          </div>
        </div>

        {err && (
          <div style={{ background:"#450A0A", color:"#F87171", borderRadius:8,
            padding:"8px 12px", fontSize:13, marginBottom:12 }}>{err}</div>
        )}

        <label style={{ display:"block", fontSize:12, color:"#94A3B8", marginBottom:6, textAlign:"left" }}>
          Modal Awal (opsional)
        </label>
        <input
          style={S.inp}
          type="number" min="0"
          placeholder="0"
          value={modal_awal}
          onChange={e => setModalAwal(e.target.value)}
        />

        <button style={{ ...S.cta, opacity: loading ? 0.6 : 1 }}
          onClick={handleBuka} disabled={loading}>
          {loading ? "Membuka sesi..." : "🟢  Buka Kasir"}
        </button>
        <button style={S.ghost} onClick={onLogout}>Keluar</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [auth,  setAuth]  = useState(null);   // data sesi kasir/owner
  const [role,  setRole]  = useState(null);   // 'kasir' | 'owner'
  const [sesi,  setSesi]  = useState(null);   // sesi kasir aktif

  // Restore dari sessionStorage (refresh halaman tidak logout)
  useEffect(() => {
    const { auth: a, sesi: s } = loadSession();
    if (a) {
      setAuth(a);
      setRole(a._role || "kasir");
      if (s) setSesi(s);
    }
  }, []);

  // ── Callback dari LoginPage ──────────────────────────────
  function handleLogin(loginRole, data) {
    const authData = { ...data, _role: loginRole };
    setAuth(authData);
    setRole(loginRole);
    setSesi(null);
    saveSession(authData, null);
  }

  // ── Callback dari BukaSesiPage ───────────────────────────
  function handleSesiDibuka(sesiData) {
    setSesi(sesiData);
    saveSession(auth, sesiData);
  }

  // ── Callback dari KasirPage (tutup sesi) ─────────────────
  function handleTutupSesi() {
    setSesi(null);
    saveSession(auth, null);
    // Kembali ke BukaSesiPage
  }

  // ── Logout ───────────────────────────────────────────────
  function handleLogout() {
    setAuth(null);
    setRole(null);
    setSesi(null);
    sessionStorage.removeItem(KEY_AUTH);
    sessionStorage.removeItem(KEY_SESI);
  }

  // ══════════════════════════════════════════════════════════
  // ROUTING
  // ══════════════════════════════════════════════════════════

  // Belum login
  if (!auth) return <LoginPage onLogin={handleLogin} />;

  // Owner
  if (role === "owner") {
    return <OwnerDashboard auth={auth} onLogout={handleLogout} />;
  }

  // Kasir — belum buka sesi
  if (role === "kasir" && !sesi) {
    return (
      <BukaSesiPage
        auth={auth}
        onSesiDibuka={handleSesiDibuka}
        onLogout={handleLogout}
      />
    );
  }

  // Kasir — sesi aktif → layar kasir utama
  return (
    <KasirPage
      auth={auth}
      sesi={sesi}
      onLogout={handleLogout}
      onTutupSesi={handleTutupSesi}
    />
  );
}
