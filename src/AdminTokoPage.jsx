// src/AdminTokoPage.jsx
// ══════════════════════════════════════════════════════════════
// Halaman Admin Toko — untuk role admin_toko
// Fitur: Produk, Kategori, Kasir, Cabang, Laporan
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from "react";
import {
  fetchProduk, tambahProduk, updateProduk, hapusProduk,
  fetchKategori, tambahKategori, updateKategori, hapusKategori,
  fetchKasirByToko, tambahKasir, updateKasir, hapusKasir,
  fetchCabangByToko, tambahCabang, updateCabang, hapusCabang,
  fetchTransaksi, rekapHarian,
  countProdukAktif, countKasirAktif,
  updateProfilToko, uploadLogoToko, getLogoToko,
} from "./supabaseClient";
import { formatRupiah } from "./paketConfig";

// ── Style constants ───────────────────────────────────────────
const BG   = "#0F172A";
const CARD = "#1E293B";
const BORDER = "#334155";
const TEXT  = "#F1F5F9";
const MUTED = "#94A3B8";
const ACCENT = "#6366F1";

const S = {
  wrap:    { minHeight:"100vh", background:BG, color:TEXT, fontFamily:"Inter,sans-serif" },
  header:  { background:CARD, borderBottom:`1px solid ${BORDER}`, padding:"12px 24px",
             display:"flex", alignItems:"center", justifyContent:"space-between" },
  nav:     { display:"flex", gap:4, padding:"16px 24px 0", borderBottom:`1px solid ${BORDER}`,
             background:CARD },
  navBtn:  (active) => ({
             padding:"10px 20px", border:"none", cursor:"pointer", fontSize:14, fontWeight:600,
             background:"transparent", borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
             color: active ? ACCENT : MUTED, transition:"all .2s",
           }),
  content: { padding:24, maxWidth:1100, margin:"0 auto" },
  card:    { background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:20, marginBottom:16 },
  btn:     (color="#6366F1") => ({
             padding:"8px 16px", background:color, color:"#fff", border:"none",
             borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600,
           }),
  btnSm:   (color="#6366F1") => ({
             padding:"5px 12px", background:color, color:"#fff", border:"none",
             borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600,
           }),
  inp:     { width:"100%", padding:"9px 12px", background:"#0F172A", border:`1px solid ${BORDER}`,
             borderRadius:8, color:TEXT, fontSize:13, boxSizing:"border-box" },
  lbl:     { fontSize:12, color:MUTED, marginBottom:4, display:"block" },
  table:   { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th:      { textAlign:"left", padding:"10px 12px", borderBottom:`1px solid ${BORDER}`,
             color:MUTED, fontWeight:600, fontSize:12 },
  td:      { padding:"10px 12px", borderBottom:`1px solid ${BORDER}` },
  err:     { background:"#450a0a", color:"#fca5a5", padding:"10px 14px", borderRadius:8,
             fontSize:13, marginBottom:12 },
  modal:   { position:"fixed", inset:0, background:"rgba(0,0,0,.7)", display:"flex",
             alignItems:"center", justifyContent:"center", zIndex:1000 },
  modalBox:{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:28,
             width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto" },
  row2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
};

// ── Modal Form helper ─────────────────────────────────────────
function Field({ label, children }) {
  return <div style={{ marginBottom:14 }}>
    <label style={S.lbl}>{label}</label>
    {children}
  </div>;
}

// ══════════════════════════════════════════════════════════════
// TAB: PRODUK
// ══════════════════════════════════════════════════════════════
function TabProduk({ auth }) {
  const { tokoId, maksProduk } = auth;
  const [produkList, setProdukList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null); // null | 'tambah' | produk (edit)
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, k] = await Promise.all([
        fetchProduk(tokoId, { aktifSaja: false }),
        fetchKategori(tokoId),
      ]);
      setProdukList(p);
      setKategoriList(k);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [tokoId]);

  useEffect(() => { load(); }, [load]);

  function openTambah() {
    setForm({ nama:"", harga_jual:"", harga_modal:"", stok:"0", satuan:"pcs",
              kategori_id:"", kode_sku:"", stok_minimum:"0", aktif:true });
    setModal("tambah");
  }

  function openEdit(p) {
    setForm({ ...p, kategori_id: p.kategori_id || "" });
    setModal(p);
  }

  async function handleSave() {
    if (!form.nama || !form.harga_jual) { setErr("Nama dan harga wajib diisi."); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        tokoId, nama: form.nama,
        hargaJual: Number(form.harga_jual),
        hargaModal: Number(form.harga_modal) || 0,
        stok: Number(form.stok) || 0,
        stokMinimum: Number(form.stok_minimum) || 0,
        satuan: form.satuan || "pcs",
        kodeSku: form.kode_sku || "",
        kategoriId: form.kategori_id || null,
        aktif: form.aktif !== false,
      };
      if (modal === "tambah") {
        await tambahProduk(payload);
      } else {
        await updateProduk(modal.id, payload);
      }
      setModal(null);
      load();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleHapus(id) {
    if (!confirm("Nonaktifkan produk ini?")) return;
    try { await hapusProduk(id); load(); }
    catch(e) { setErr(e.message); }
  }

  const filtered = produkList.filter(p =>
    p.nama.toLowerCase().includes(search.toLowerCase()) ||
    (p.kode_sku || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0, fontSize:18 }}>Manajemen Produk</h2>
          <p style={{ margin:"4px 0 0", color:MUTED, fontSize:13 }}>
            {produkList.filter(p=>p.aktif).length} aktif
            {maksProduk ? ` / ${maksProduk} maks` : ""}
          </p>
        </div>
        <button style={S.btn()} onClick={openTambah}>+ Tambah Produk</button>
      </div>

      {err && <div style={S.err}>{err}</div>}

      <input style={{ ...S.inp, marginBottom:12 }} placeholder="Cari nama / SKU..."
        value={search} onChange={e => setSearch(e.target.value)} />

      <div style={S.card}>
        {loading ? <p style={{ color:MUTED }}>Memuat...</p> : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Nama</th>
                <th style={S.th}>SKU</th>
                <th style={S.th}>Harga Jual</th>
                <th style={S.th}>Stok</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, color:MUTED, textAlign:"center" }}>
                  Belum ada produk
                </td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={S.td}>
                    <div style={{ fontWeight:600 }}>{p.nama}</div>
                    {p.kategori?.nama && <div style={{ fontSize:11, color:MUTED }}>{p.kategori.nama}</div>}
                  </td>
                  <td style={S.td}>{p.kode_sku || "—"}</td>
                  <td style={S.td}>{formatRupiah(p.harga_jual)}</td>
                  <td style={{ ...S.td, color: p.stok <= p.stok_minimum ? "#F87171" : TEXT }}>
                    {p.stok} {p.satuan}
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99,
                      background: p.aktif ? "#052e16" : "#1c1917",
                      color: p.aktif ? "#4ade80" : MUTED }}>
                      {p.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td style={S.td}>
                    <button style={S.btnSm()} onClick={() => openEdit(p)}>Edit</button>
                    {" "}
                    <button style={S.btnSm("#EF4444")} onClick={() => handleHapus(p.id)}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal tambah/edit */}
      {modal !== null && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <h3 style={{ margin:"0 0 20px" }}>{modal === "tambah" ? "Tambah Produk" : "Edit Produk"}</h3>
            {err && <div style={S.err}>{err}</div>}
            <Field label="Nama Produk *">
              <input style={S.inp} value={form.nama || ""} onChange={e => setForm(f=>({...f,nama:e.target.value}))} />
            </Field>
            <div style={S.row2}>
              <Field label="Harga Jual *">
                <input style={S.inp} type="number" value={form.harga_jual || ""} onChange={e => setForm(f=>({...f,harga_jual:e.target.value}))} />
              </Field>
              <Field label="Harga Modal">
                <input style={S.inp} type="number" value={form.harga_modal || ""} onChange={e => setForm(f=>({...f,harga_modal:e.target.value}))} />
              </Field>
            </div>
            <div style={S.row2}>
              <Field label="Stok">
                <input style={S.inp} type="number" value={form.stok ?? 0} onChange={e => setForm(f=>({...f,stok:e.target.value}))} />
              </Field>
              <Field label="Stok Minimum">
                <input style={S.inp} type="number" value={form.stok_minimum ?? 0} onChange={e => setForm(f=>({...f,stok_minimum:e.target.value}))} />
              </Field>
            </div>
            <div style={S.row2}>
              <Field label="Satuan">
                <input style={S.inp} value={form.satuan || "pcs"} onChange={e => setForm(f=>({...f,satuan:e.target.value}))} />
              </Field>
              <Field label="Kode SKU">
                <input style={S.inp} value={form.kode_sku || ""} onChange={e => setForm(f=>({...f,kode_sku:e.target.value}))} />
              </Field>
            </div>
            <Field label="Kategori">
              <select style={S.inp} value={form.kategori_id || ""} onChange={e => setForm(f=>({...f,kategori_id:e.target.value}))}>
                <option value="">-- Tanpa Kategori --</option>
                {kategoriList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </Field>
            {modal !== "tambah" && (
              <Field label="Status">
                <select style={S.inp} value={form.aktif ? "1" : "0"} onChange={e => setForm(f=>({...f,aktif:e.target.value==="1"}))}>
                  <option value="1">Aktif</option>
                  <option value="0">Nonaktif</option>
                </select>
              </Field>
            )}
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
              <button style={S.btn("#475569")} onClick={() => { setModal(null); setErr(""); }}>Batal</button>
              <button style={S.btn()} onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: KATEGORI
// ══════════════════════════════════════════════════════════════
function TabKategori({ auth }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nama:"", warna:"#6B7280" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setList(await fetchKategori(auth.tokoId)); }
    catch(e) { setErr(e.message); }
  }, [auth.tokoId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.nama) { setErr("Nama kategori wajib diisi."); return; }
    setSaving(true); setErr("");
    try {
      if (modal === "tambah") await tambahKategori({ tokoId: auth.tokoId, nama: form.nama, warna: form.warna });
      else await updateKategori(modal.id, { nama: form.nama, warna: form.warna });
      setModal(null);
      load();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:18 }}>Kategori Produk</h2>
        <button style={S.btn()} onClick={() => { setForm({ nama:"", warna:"#6B7280" }); setModal("tambah"); }}>+ Tambah</button>
      </div>
      {err && <div style={S.err}>{err}</div>}
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Nama</th>
            <th style={S.th}>Warna</th>
            <th style={S.th}>Aksi</th>
          </tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={3} style={{ ...S.td, color:MUTED, textAlign:"center" }}>Belum ada kategori</td></tr>}
            {list.map(k => (
              <tr key={k.id}>
                <td style={S.td}><span style={{ color:k.warna, fontWeight:700 }}>{k.nama}</span></td>
                <td style={S.td}><span style={{ background:k.warna, borderRadius:4, padding:"2px 10px", fontSize:11 }}>{k.warna}</span></td>
                <td style={S.td}>
                  <button style={S.btnSm()} onClick={() => { setForm(k); setModal(k); }}>Edit</button>
                  {" "}
                  <button style={S.btnSm("#EF4444")} onClick={async () => {
                    if (!confirm("Hapus kategori ini?")) return;
                    try { await hapusKategori(k.id); load(); } catch(e) { setErr(e.message); }
                  }}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal !== null && (
        <div style={S.modal}><div style={S.modalBox}>
          <h3 style={{ margin:"0 0 20px" }}>{modal === "tambah" ? "Tambah Kategori" : "Edit Kategori"}</h3>
          {err && <div style={S.err}>{err}</div>}
          <Field label="Nama Kategori *">
            <input style={S.inp} value={form.nama} onChange={e => setForm(f=>({...f,nama:e.target.value}))} />
          </Field>
          <Field label="Warna">
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="color" value={form.warna} onChange={e => setForm(f=>({...f,warna:e.target.value}))}
                style={{ width:44, height:36, border:"none", borderRadius:6, cursor:"pointer", background:"none" }} />
              <input style={{ ...S.inp, flex:1 }} value={form.warna} onChange={e => setForm(f=>({...f,warna:e.target.value}))} />
            </div>
          </Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button style={S.btn("#475569")} onClick={() => { setModal(null); setErr(""); }}>Batal</button>
            <button style={S.btn()} onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: KASIR
// ══════════════════════════════════════════════════════════════
function TabKasir({ auth }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setList(await fetchKasirByToko(auth.tokoId)); }
    catch(e) { setErr(e.message); }
  }, [auth.tokoId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.username || (!modal?.id && !form.password)) { setErr("Username dan password wajib diisi."); return; }
    setSaving(true); setErr("");
    try {
      if (!modal?.id) {
        await tambahKasir({ tokoId: auth.tokoId, username: form.username, password: form.password, nama: form.nama || form.username, role: form.role || "kasir" });
      } else {
        await updateKasir(modal.id, { nama: form.nama, password: form.password || undefined, role: form.role, aktif: form.aktif !== false });
      }
      setModal(null); load();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0, fontSize:18 }}>Manajemen Kasir</h2>
          <p style={{ margin:"4px 0 0", color:MUTED, fontSize:13 }}>
            {list.filter(k=>k.aktif).length} aktif
            {auth.maksKasir ? ` / ${auth.maksKasir} maks` : ""}
          </p>
        </div>
        <button style={S.btn()} onClick={() => { setForm({ username:"", password:"", nama:"", role:"kasir", aktif:true }); setModal({}); }}>+ Tambah Kasir</button>
      </div>
      {err && <div style={S.err}>{err}</div>}
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Nama</th>
            <th style={S.th}>Username</th>
            <th style={S.th}>Role</th>
            <th style={S.th}>Status</th>
            <th style={S.th}>Aksi</th>
          </tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} style={{ ...S.td, color:MUTED, textAlign:"center" }}>Belum ada kasir</td></tr>}
            {list.map(k => (
              <tr key={k.id}>
                <td style={S.td}>{k.nama || k.username}</td>
                <td style={S.td}>{k.username}</td>
                <td style={S.td}>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99,
                    background: k.role === "admin_toko" ? "#1e1b4b" : "#0c1a2e",
                    color: k.role === "admin_toko" ? "#a5b4fc" : "#7dd3fc" }}>
                    {k.role === "admin_toko" ? "Admin" : "Kasir"}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99,
                    background: k.aktif ? "#052e16" : "#1c1917",
                    color: k.aktif ? "#4ade80" : MUTED }}>
                    {k.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td style={S.td}>
                  <button style={S.btnSm()} onClick={() => { setForm({ ...k, password:"" }); setModal(k); }}>Edit</button>
                  {" "}
                  <button style={S.btnSm("#EF4444")} onClick={async () => {
                    if (!confirm("Hapus kasir ini?")) return;
                    try { await hapusKasir(k.id); load(); } catch(e) { setErr(e.message); }
                  }}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal !== null && (
        <div style={S.modal}><div style={S.modalBox}>
          <h3 style={{ margin:"0 0 20px" }}>{!modal?.id ? "Tambah Kasir" : "Edit Kasir"}</h3>
          {err && <div style={S.err}>{err}</div>}
          <Field label="Nama"><input style={S.inp} value={form.nama||""} onChange={e=>setForm(f=>({...f,nama:e.target.value}))} /></Field>
          <Field label="Username *"><input style={S.inp} value={form.username||""} disabled={!!modal?.id} onChange={e=>setForm(f=>({...f,username:e.target.value}))} /></Field>
          <Field label={modal?.id ? "Password Baru (kosongkan jika tidak diubah)" : "Password *"}>
            <input style={S.inp} type="password" value={form.password||""} onChange={e=>setForm(f=>({...f,password:e.target.value}))} />
          </Field>
          <Field label="Role">
            <select style={S.inp} value={form.role||"kasir"} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
              <option value="kasir">Kasir</option>
              <option value="admin_toko">Admin Toko</option>
            </select>
          </Field>
          {modal?.id && (
            <Field label="Status">
              <select style={S.inp} value={form.aktif?"1":"0"} onChange={e=>setForm(f=>({...f,aktif:e.target.value==="1"}))}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </Field>
          )}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button style={S.btn("#475569")} onClick={() => { setModal(null); setErr(""); }}>Batal</button>
            <button style={S.btn()} onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: LAPORAN
// ══════════════════════════════════════════════════════════════
function TabLaporan({ auth }) {
  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(today);
  const [rekap, setRekap] = useState(null);
  const [transaksiList, setTransaksiList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const [r, t] = await Promise.all([
        rekapHarian(auth.tokoId, tanggal),
        fetchTransaksi(auth.tokoId, { tanggalDari: tanggal, tanggalSampai: tanggal, limit: 50 }),
      ]);
      setRekap(r);
      setTransaksiList(t.data || []);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [tanggal]);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:18 }}>Laporan Harian</h2>
        <input type="date" style={{ ...S.inp, width:"auto" }} value={tanggal} onChange={e => setTanggal(e.target.value)} />
      </div>
      {err && <div style={S.err}>{err}</div>}
      {rekap && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:16 }}>
          {[
            { label:"Total Transaksi", val: rekap.total_transaksi, color:"#818CF8" },
            { label:"Total Penjualan", val: formatRupiah(rekap.total_penjualan), color:"#34D399" },
            { label:"Tunai",           val: formatRupiah(rekap.total_tunai), color:"#60A5FA" },
            { label:"Non Tunai",       val: formatRupiah(rekap.total_non_tunai), color:"#F472B6" },
            { label:"Laba Kotor",      val: formatRupiah(rekap.total_laba_kotor), color:"#FBBF24" },
          ].map(item => (
            <div key={item.label} style={{ ...S.card, margin:0, textAlign:"center" }}>
              <div style={{ fontSize:12, color:MUTED, marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:item.color }}>{item.val}</div>
            </div>
          ))}
        </div>
      )}
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>No. Transaksi</th>
            <th style={S.th}>Kasir</th>
            <th style={S.th}>Metode</th>
            <th style={S.th}>Total</th>
            <th style={S.th}>Waktu</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ ...S.td, color:MUTED, textAlign:"center" }}>Memuat...</td></tr>}
            {!loading && transaksiList.length === 0 && (
              <tr><td colSpan={5} style={{ ...S.td, color:MUTED, textAlign:"center" }}>Belum ada transaksi hari ini</td></tr>
            )}
            {transaksiList.map(t => (
              <tr key={t.id}>
                <td style={S.td}><span style={{ fontFamily:"monospace", color:"#818CF8" }}>{t.nomor_transaksi}</span></td>
                <td style={S.td}>{t.kasir?.nama || "—"}</td>
                <td style={S.td}>{t.metode_bayar}</td>
                <td style={S.td}>{formatRupiah(t.total)}</td>
                <td style={S.td}>{new Date(t.created_at).toLocaleTimeString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// TAB: PROFIL TOKO
// ══════════════════════════════════════════════════════════════
function TabProfil({ auth, onProfilUpdated }) {
  const { tokoId } = auth;
  const [form, setForm]       = useState({ nama: auth.namaToko || "", alamat: "", telepon: "", email: "" });
  const [logoPreview, setLogoPreview] = useState(auth.logoUrl || null);
  const [logoFile, setLogoFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [err, setErr]         = useState("");

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("Logo maksimal 2 MB."); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.nama.trim()) { setErr("Nama toko wajib diisi."); return; }
    setLoading(true); setErr(""); setSuccess("");
    try {
      await updateProfilToko(tokoId, {
        nama:     form.nama.trim(),
        alamat:   form.alamat.trim(),
        telepon:  form.telepon.trim(),
        email:    form.email.trim(),
      });
      if (logoFile) {
        const reader = new FileReader();
        await new Promise((res, rej) => {
          reader.onload = async (ev) => {
            try { await uploadLogoToko(tokoId, ev.target.result); res(); }
            catch(e) { rej(e); }
          };
          reader.readAsDataURL(logoFile);
        });
      }
      setSuccess("Profil toko berhasil disimpan!");
      onProfilUpdated?.({ namaToko: form.nama.trim(), logoUrl: logoPreview });
    } catch(e) {
      setErr(e.message || "Gagal menyimpan profil.");
    }
    setLoading(false);
  }

  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:20 }}>🏪 Profil Toko</h2>

      {err     && <div style={S.err}>{err}</div>}
      {success && <div style={{ background:"#052e16", color:"#4ade80", padding:"10px 14px", borderRadius:8, fontSize:13, marginBottom:12 }}>{success}</div>}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        {/* Logo */}
        <div style={S.card}>
          <div style={{ fontWeight:600, marginBottom:16 }}>Logo Toko</div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
            <div style={{ width:120, height:120, borderRadius:16, border:`2px dashed ${BORDER}`,
                          background:"#0F172A", display:"flex", alignItems:"center", justifyContent:"center",
                          overflow:"hidden" }}>
              {logoPreview
                ? <img src={logoPreview} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <span style={{ fontSize:40 }}>🏪</span>
              }
            </div>
            <label style={{ cursor:"pointer" }}>
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={handleFileChange} />
              <span style={{ ...S.btn(), fontSize:12, padding:"7px 16px" }}>📷 Pilih Logo</span>
            </label>
            <div style={{ fontSize:11, color:MUTED, textAlign:"center" }}>PNG/JPG, maks 2 MB<br/>Tampil di struk & header kasir</div>
            {logoPreview && (
              <button style={{ ...S.btnSm("#EF4444") }} onClick={() => { setLogoPreview(null); setLogoFile(null); }}>
                🗑 Hapus Logo
              </button>
            )}
          </div>
        </div>

        {/* Info Toko */}
        <div style={S.card}>
          <div style={{ fontWeight:600, marginBottom:16 }}>Informasi Toko</div>
          <Field label="Nama Toko *">
            <input style={S.inp} value={form.nama}
              onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
              placeholder="Nama toko Anda" />
          </Field>
          <Field label="Alamat">
            <input style={S.inp} value={form.alamat}
              onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))}
              placeholder="Alamat toko (opsional)" />
          </Field>
          <Field label="Telepon / WhatsApp">
            <input style={S.inp} value={form.telepon}
              onChange={e => setForm(f => ({ ...f, telepon: e.target.value }))}
              placeholder="08xxxxxxxxxx" />
          </Field>
          <Field label="Email">
            <input style={S.inp} value={form.email} type="email"
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@toko.com" />
          </Field>
        </div>
      </div>

      <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}>
        <button style={{ ...S.btn("#22C55E"), padding:"10px 28px", fontSize:14 }}
          onClick={handleSave} disabled={loading}>
          {loading ? "Menyimpan..." : "💾 Simpan Profil"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN: AdminTokoPage
// ══════════════════════════════════════════════════════════════
const TABS = [
  { id:"produk",    label:"📦 Produk" },
  { id:"kategori",  label:"🏷️ Kategori" },
  { id:"kasir",     label:"👤 Kasir" },
  { id:"laporan",   label:"📊 Laporan" },
  { id:"profil",    label:"🏪 Profil Toko" },
];

export default function AdminTokoPage({ auth, onLogout }) {
  const [tab, setTab] = useState("produk");
  const [authState, setAuthState] = useState(auth);
  function handleProfilUpdated(updated) { setAuthState(a => ({ ...a, ...updated })); }

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {authState.logoUrl && <img src={authState.logoUrl} alt="logo" style={{ width:32, height:32, borderRadius:8, objectFit:"cover" }} />}
            <div style={{ fontWeight:700, fontSize:16 }}>{authState.namaToko}</div>
          </div>
          <div style={{ fontSize:12, color:MUTED }}>Admin: {auth.namaKasir || auth.username}</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:12, color:"#4ade80", background:"#052e16", padding:"4px 10px", borderRadius:99 }}>
            ✅ {auth.paket || "Aktif"}
          </span>
          <button style={S.btn("#EF4444")} onClick={onLogout}>Keluar</button>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={S.nav}>
        {TABS.map(t => (
          <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={S.content}>
        {tab === "produk"   && <TabProduk   auth={auth} />}
        {tab === "kategori" && <TabKategori auth={auth} />}
        {tab === "kasir"    && <TabKasir    auth={auth} />}
        {tab === "laporan"  && <TabLaporan  auth={auth} />}
        {tab === "profil"   && <TabProfil   auth={authState} onProfilUpdated={handleProfilUpdated} />}
      </div>
    </div>
  );
}
