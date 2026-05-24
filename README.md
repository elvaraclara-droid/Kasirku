# 🏪 POS — Point of Sale SaaS

Aplikasi kasir modern berbasis React + Supabase dengan sistem lisensi multi-tenant.

## Stack
- **Frontend**: React 18 + Vite
- **Database**: Supabase (PostgreSQL)
- **Auth**: Custom via RPC (tidak pakai Supabase Auth)

## Struktur File
```
pos-app/
├── src/
│   ├── main.jsx          # Entry point
│   ├── App.jsx           # Router utama
│   ├── LoginPage.jsx     # Login kasir + daftar toko
│   ├── KasirPage.jsx     # Layar kasir utama
│   ├── OwnerDashboard.jsx# Kelola toko & lisensi
│   ├── supabaseClient.js # Semua fungsi database
│   └── paketConfig.js    # Konfigurasi paket lisensi
├── pos_schema.sql        # Schema database Supabase
├── .env.example          # Template environment
└── index.html
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Isi environment
Salin `.env.example` → `.env` lalu isi:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. Jalankan schema SQL
Buka **Supabase Dashboard** → **SQL Editor** → paste isi `pos_schema.sql` → Run.

### 4. Jalankan dev server
```bash
npm run dev
```

### 5. Build untuk production
```bash
npm run build
```

## Login Default Owner
- Username: `owner_pos`
- Password: `ganti_password_ini`

> ⚠️ Ganti password owner segera setelah deploy via Supabase Dashboard → Table Editor → tabel `owner`.

## Paket Lisensi
| Paket | Harga | Produk | Kasir | Cabang |
|---|---|---|---|---|
| Starter | Rp 250.000/th | 500 | 2 | 1 |
| Growth | Rp 350.000/th | 2.000 | 5 | 2 |
| Professional | Rp 450.000/th | 10.000 | 10 | 5 |
| Enterprise | Rp 600.000/th | 50.000 | 20 | 10 |
| Lifetime | Rp 1.000.000 | ∞ | ∞ | ∞ |

## Deploy ke Vercel / Netlify
1. Push repo ke GitHub
2. Connect repo di Vercel/Netlify
3. Tambahkan environment variables (`VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`)
4. Deploy otomatis
