// src/LoginPage.jsx
// ══════════════════════════════════════════════════════════════
// HALAMAN LOGIN — POS SaaS
// Tab: Kasir (login toko) | Daftar (toko baru) | Owner (hidden)
// Props:
//   onLogin(role, data) — dipanggil setelah login berhasil
//                         role: 'kasir' | 'owner'
// ══════════════════════════════════════════════════════════════
import { useState } from "react";
import { loginKasir, loginKasirTanpaLisensi, loginOwner, registerToko } from "./supabaseClient";
import { PAKET_LIST } from "./paketConfig";

const WA_NUMBER = "6285156392033"; // ganti nomor WA Anda

const S = {
  root:    { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
             background:"#080E1A", padding:16 },
  card:    { background:"#0F172A", border:"1px solid #1E293B", borderRadius:18, padding:28,
             maxWidth:460, width:"100%" },
  title:   { fontSize:22, fontWeight:900, margin:"8px 0 4px", color:"#E2E8F0" },
  sub:     { color:"#475569", fontSize:13, margin:0 },
  tabRow:  { display:"flex", gap:4, background:"#1E293B", borderRadius:10, padding:4, marginBottom:20 },
  tabBtn:  (aktif) => ({ flex:1, border:"none", cursor:"pointer", fontSize:12, fontWeight:600,
             background: aktif ? "#0F172A" : "transparent",
             color: aktif ? "#E2E8F0" : "#94A3B8", borderRadius:8, padding:"8px" }),
  fg:      { marginBottom:12 },
  lbl:     { display:"block", fontSize:12, color:"#94A3B8", marginBottom:5, fontWeight:600 },
  inp:     { width:"100%", boxSizing:"border-box", background:"#1E293B", border:"1px solid #334155",
             borderRadius:10, padding:"10px 12px", color:"#E2E8F0", fontSize:14, outline:"none" },
  cta:     { background:"linear-gradient(135deg,#3B82F6,#6366F1)", color:"#fff", border:"none",
             borderRadius:12, padding:"11px 28px", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%" },
  ghost:   { background:"transparent", border:"1px solid #1E293B", color:"#94A3B8", borderRadius:10,
             padding:"8px 15px", cursor:"pointer", fontSize:13, width:"100%", marginTop:8 },
  err:     { background:"#450A0A", color:"#F87171", borderRadius:8, padding:"8px 12px", fontSize:13, marginBottom:10 },
  ok:      { background:"#052e16", color:"#4ade80", borderRadius:8, padding:"8px 12px", fontSize:13, marginBottom:10 },
  badge:   { display:"inline-block", background:"#1E3A5F", color:"#60A5FA", borderRadius:20,
             padding:"4px 16px", fontSize:12, fontWeight:700, letterSpacing:1 },
  divider: { border:"none", borderTop:"1px solid #1E293B", margin:"14px 0" },
  waCard:  { display:"flex", alignItems:"center", gap:10, background:"#052e16",
             border:"1px solid #16a34a44", borderRadius:10, padding:"10px 14px",
             marginBottom:12, textDecoration:"none" },
};

export default function LoginPage({ onLogin }) {
  const [mode,    setMode]    = useState("kasir"); // kasir | daftar | owner
  const [logoHit, setLogoHit]= useState(0);
  const [showOwner, setShowOwner] = useState(false);

  // Login kasir
  const [lisensi, setLisensi] = useState("");
  const [user,    setUser]    = useState("");
  const [pass,    setPass]    = useState("");

  // Registrasi
  const [reg, setReg] = useState({
    namaToko:"", alamat:"", kode:"",
    namaAdmin:"", username:"", password:"", konfirmasi:"",
    paketId:"growth",
  });

  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const [ok,      setOk]      = useState("");

  // Klik logo 5x → tampilkan tab Owner
  function handleLogoClick() {
    const next = logoHit + 1;
    setLogoHit(next);
    if (next >= 5) { setShowOwner(true); setLogoHit(0); }
  }

  function resetForm() { setLisensi(""); setUser(""); setPass(""); setErr(""); setOk(""); }

  // ── Login kasir ────────────────────────────────────────────
  async function tryLoginKasir() {
    if (!user || !pass) { setErr("Username dan password wajib diisi."); return; }
    setLoading(true); setErr("");
    try {
      let sesi;
      if (lisensi) {
        // Ada lisensi → simpan ke DB
        sesi = await loginKasir(lisensi, user, pass);
      } else {
        // Tanpa lisensi → pakai yang tersimpan di DB
        sesi = await loginKasirTanpaLisensi(user, pass);
      }
      onLogin("kasir", sesi);
    } catch (e) {
      setErr(e.message || "Login gagal.");
    }
    setLoading(false);
  }

  // ── Login owner ────────────────────────────────────────────
  async function tryLoginOwner() {
    if (!user || !pass) { setErr("Isi username dan password."); return; }
    setLoading(true); setErr("");
    try {
      const data = await loginOwner(user, pass);
      if (!data) throw new Error("Username atau password salah.");
      onLogin("owner", data);
    } catch (e) {
      setErr(e.message || "Login gagal.");
    }
    setLoading(false);
  }

  // ── Registrasi toko ────────────────────────────────────────
  async function tryDaftar() {
    setErr(""); setOk("");
    const { namaToko, kode, username, password, konfirmasi, namaAdmin } = reg;
    if (!namaToko || !kode || !username || !password)
      { setErr("Semua field wajib diisi."); return; }
    if (password !== konfirmasi)
      { setErr("Password dan konfirmasi tidak cocok."); return; }
    if (password.length < 6)
      { setErr("Password minimal 6 karakter."); return; }

    setLoading(true);
    try {
      await registerToko({
        namaToko, alamat: reg.alamat, kode,
        usernameAdmin: username, passwordAdmin: password,
        namaAdmin: namaAdmin || namaToko,
        paketId: reg.paketId,
      });
      const paket = PAKET_LIST.find(p => p.id === reg.paketId);
      setOk(`✅ Pendaftaran berhasil! Paket: ${paket?.nama}. Toko akan diaktifkan setelah pembayaran dikonfirmasi.`);
      setReg({ namaToko:"", alamat:"", kode:"", namaAdmin:"", username:"", password:"", konfirmasi:"", paketId:"growth" });
    } catch (e) {
      setErr(e.message || "Pendaftaran gagal.");
    }
    setLoading(false);
  }

  function waLink(paket) {
    const pk = PAKET_LIST.find(p => p.id === paket);
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
      `Halo admin, saya ingin berlangganan paket ${pk?.nama} (${pk?.hargaStr}) untuk toko kami.`
    )}`;
  }

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div style={S.root}>
      <div style={S.card}>

        {/* Logo & judul */}
        <div style={{ textAlign:"center", marginBottom:22 }}>
          <div
            style={{ fontSize:44, cursor:"pointer", userSelect:"none", lineHeight:1 }}
            onClick={handleLogoClick}
          >🏪</div>
          <h1 style={S.title}>POS — Point of Sale</h1>
          <p style={S.sub}>Sistem kasir modern untuk toko Anda</p>
        </div>

        {/* Tab */}
        <div style={S.tabRow}>
          <button style={S.tabBtn(mode==="kasir")}  onClick={() => { setMode("kasir");  resetForm(); }}>Login Kasir</button>
          <button style={S.tabBtn(mode==="daftar")} onClick={() => { setMode("daftar"); resetForm(); }}>Daftar Toko</button>
          {showOwner && (
            <button style={{ ...S.tabBtn(mode==="owner"), color: mode==="owner" ? "#A78BFA" : "#6366F1" }}
              onClick={() => { setMode("owner"); resetForm(); }}>🔐 Owner</button>
          )}
        </div>

        {/* ── LOGIN KASIR ── */}
        {mode === "kasir" && (
          <div>
            {err && <div style={S.err}>{err}</div>}

            <div style={S.fg}>
              <label style={S.lbl}>
                Kode Lisensi
                <span style={{ color:"#475569", fontWeight:400, marginLeft:6 }}>
                  (opsional jika sudah pernah login)
                </span>
              </label>
              <input style={S.inp} value={lisensi}
                onChange={e => setLisensi(e.target.value.toUpperCase())}
                placeholder="LIS-XXXX-XXXX-XXXX — kosongkan jika sudah tersimpan" />
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Username</label>
              <input style={S.inp} value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="Username kasir" />
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Password</label>
              <input style={S.inp} type="password" value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Password"
                onKeyDown={e => e.key === "Enter" && tryLoginKasir()} />
            </div>

            <button style={{ ...S.cta, opacity: loading ? 0.6 : 1 }}
              onClick={tryLoginKasir} disabled={loading}>
              {loading ? "Memverifikasi..." : "Masuk →"}
            </button>

            <hr style={S.divider} />
            <div style={{ textAlign:"center" }}>
              <span style={{ color:"#60A5FA", fontSize:12, cursor:"pointer" }}
                onClick={() => { setMode("daftar"); resetForm(); }}>
                Belum punya akun? Daftar toko baru
              </span>
            </div>
          </div>
        )}

        {/* ── DAFTAR TOKO ── */}
        {mode === "daftar" && (
          <div>
            <div style={{ marginBottom:16 }}>
              <div style={S.badge}>✦ Pendaftaran Toko Baru</div>
              <p style={{ color:"#475569", fontSize:12, marginTop:8 }}>
                Setelah mendaftar, toko diaktifkan dalam 1×24 jam setelah pembayaran dikonfirmasi.
              </p>
              <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer" style={S.waCard}>
                <span style={{ fontSize:22 }}>💬</span>
                <div>
                  <div style={{ color:"#4ade80", fontWeight:700, fontSize:13 }}>Hubungi Admin via WhatsApp</div>
                  <div style={{ color:"#16a34a", fontSize:12 }}>Konfirmasi pembayaran & aktivasi toko</div>
                </div>
                <span style={{ marginLeft:"auto", color:"#4ade80", fontSize:12, fontWeight:700 }}>Chat →</span>
              </a>
            </div>

            {err && <div style={S.err}>{err}</div>}
            {ok  && (
              <div>
                <div style={S.ok}>{ok}</div>
                <a href={waLink(reg.paketId)} target="_blank" rel="noopener noreferrer" style={S.waCard}>
                  <span style={{ fontSize:20 }}>💬</span>
                  <div>
                    <div style={{ color:"#4ade80", fontWeight:700, fontSize:12 }}>Konfirmasi pembayaran via WhatsApp</div>
                    <div style={{ color:"#16a34a", fontSize:11 }}>Klik untuk chat langsung dengan admin</div>
                  </div>
                  <span style={{ marginLeft:"auto", color:"#4ade80", fontSize:12, fontWeight:700 }}>Chat →</span>
                </a>
                <button style={S.ghost} onClick={() => { setMode("kasir"); resetForm(); }}>← Login</button>
              </div>
            )}

            {!ok && (
              <>
                {/* Pilih Paket */}
                <div style={S.fg}>
                  <label style={S.lbl}>Pilih Paket *</label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {PAKET_LIST.map(p => (
                      <div key={p.id}
                        onClick={() => setReg(r => ({ ...r, paketId: p.id }))}
                        style={{
                          border: `2px solid ${reg.paketId === p.id ? p.warna : "#1E293B"}`,
                          background: reg.paketId === p.id ? p.warna + "22" : "#0B1120",
                          borderRadius:10, padding:"10px 12px", cursor:"pointer", position:"relative",
                        }}>
                        {p.popular && (
                          <div style={{ position:"absolute", top:-8, right:8, background:"#8B5CF6",
                            color:"#fff", fontSize:9, fontWeight:800, borderRadius:20, padding:"1px 8px" }}>
                            POPULER
                          </div>
                        )}
                        <div style={{ fontWeight:800, fontSize:13, color: reg.paketId===p.id ? p.warna : "#E2E8F0" }}>
                          {p.nama}
                        </div>
                        <div style={{ fontSize:12, color: p.warna, fontWeight:700 }}>{p.hargaStr}</div>
                        <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>
                          {p.maksProduk ?? "∞"} produk · {p.maksKasir ?? "∞"} kasir · {p.durasi ? p.durasi+"hr" : "Lifetime"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Link WA per paket */}
                <a href={waLink(reg.paketId)} target="_blank" rel="noopener noreferrer" style={S.waCard}>
                  <span style={{ fontSize:20 }}>💬</span>
                  <div>
                    <div style={{ color:"#4ade80", fontWeight:700, fontSize:12 }}>
                      Bayar paket {PAKET_LIST.find(p => p.id===reg.paketId)?.nama} via WhatsApp
                    </div>
                    <div style={{ color:"#16a34a", fontSize:11 }}>
                      {PAKET_LIST.find(p => p.id===reg.paketId)?.hargaStr}
                    </div>
                  </div>
                  <span style={{ marginLeft:"auto", color:"#4ade80", fontSize:12, fontWeight:700 }}>Chat →</span>
                </a>

                <hr style={S.divider} />

                <div style={S.fg}>
                  <label style={S.lbl}>Nama Toko *</label>
                  <input style={S.inp} value={reg.namaToko}
                    onChange={e => setReg(r => ({ ...r, namaToko: e.target.value }))}
                    placeholder="Toko Sumber Jaya" />
                </div>
                <div style={S.fg}>
                  <label style={S.lbl}>Alamat Toko</label>
                  <input style={S.inp} value={reg.alamat}
                    onChange={e => setReg(r => ({ ...r, alamat: e.target.value }))}
                    placeholder="Jl. Contoh No. 1" />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                  <div style={S.fg}>
                    <label style={S.lbl}>Kode Unik Toko *</label>
                    <input style={S.inp} value={reg.kode}
                      onChange={e => setReg(r => ({ ...r, kode: e.target.value.toUpperCase() }))}
                      placeholder="TK001" maxLength={20} />
                  </div>
                  <div style={S.fg}>
                    <label style={S.lbl}>Nama PIC / Pemilik</label>
                    <input style={S.inp} value={reg.namaAdmin}
                      onChange={e => setReg(r => ({ ...r, namaAdmin: e.target.value }))}
                      placeholder="Nama lengkap" />
                  </div>
                </div>

                <hr style={S.divider} />
                <p style={{ color:"#94A3B8", fontSize:11, marginBottom:12 }}>Akun admin untuk login:</p>

                <div style={S.fg}>
                  <label style={S.lbl}>Username Admin *</label>
                  <input style={S.inp} value={reg.username}
                    onChange={e => setReg(r => ({ ...r, username: e.target.value }))}
                    placeholder="Buat username unik" />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                  <div style={S.fg}>
                    <label style={S.lbl}>Password *</label>
                    <input style={S.inp} type="password" value={reg.password}
                      onChange={e => setReg(r => ({ ...r, password: e.target.value }))}
                      placeholder="Min. 6 karakter" />
                  </div>
                  <div style={S.fg}>
                    <label style={S.lbl}>Konfirmasi *</label>
                    <input style={S.inp} type="password" value={reg.konfirmasi}
                      onChange={e => setReg(r => ({ ...r, konfirmasi: e.target.value }))}
                      placeholder="Ulangi password" />
                  </div>
                </div>

                <button style={{ ...S.cta, opacity: loading ? 0.6 : 1 }}
                  onClick={tryDaftar} disabled={loading}>
                  {loading ? "Mendaftar..." : "Daftar Toko →"}
                </button>
                <button style={S.ghost} onClick={() => { setMode("kasir"); resetForm(); }}>
                  ← Kembali ke Login
                </button>
              </>
            )}
          </div>
        )}

        {/* ── OWNER (hidden) ── */}
        {mode === "owner" && (
          <div>
            <div style={{ marginBottom:14 }}>
              <div style={S.badge}>🔐 Owner Dashboard</div>
            </div>
            {err && <div style={S.err}>{err}</div>}
            <div style={S.fg}>
              <label style={S.lbl}>Username Owner</label>
              <input style={S.inp} value={user}
                onChange={e => setUser(e.target.value)} placeholder="Username owner" />
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Password</label>
              <input style={S.inp} type="password" value={pass}
                onChange={e => setPass(e.target.value)} placeholder="Password"
                onKeyDown={e => e.key === "Enter" && tryLoginOwner()} />
            </div>
            <button style={{ ...S.cta, opacity: loading ? 0.6 : 1 }}
              onClick={tryLoginOwner} disabled={loading}>
              {loading ? "Memverifikasi..." : "Login Owner →"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
