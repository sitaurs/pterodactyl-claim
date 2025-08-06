# Panduan Instalasi WA-Ptero-Claim di VPS Ubuntu

Panduan ini menjelaskan langkah demi langkah untuk menyiapkan aplikasi **WA-Ptero-Claim** pada VPS Ubuntu hingga siap digunakan dengan Nginx sebagai reverse proxy.

## 1. Persiapan Server

```bash
# Update dan instal paket dasar
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential

# Instal Node.js 20.x dan pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm

# Instal Redis dan Nginx
sudo apt install -y redis-server nginx
sudo systemctl enable --now redis-server
```

## 2. Clone Repository

```bash
cd /var/www
sudo git clone <REPO_URL> wa-ptero-claim
cd wa-ptero-claim
```

> Ganti `<REPO_URL>` dengan URL Git repository yang valid.

## 3. Instal Dependensi

```bash
# Instal dependensi untuk seluruh workspace
pnpm install

# Dependensi tambahan untuk bot
cd apps/bot
pnpm add @whiskeysockets/baileys axios dotenv express qrcode-terminal winston
pnpm add -D @types/express @types/node rimraf tsx typescript
cd ../../

# Dependensi tambahan untuk frontend
cd apps/frontend
pnpm add axios framer-motion react-hook-form react-hot-toast
cd ../../
```

## 4. Konfigurasi Environment

Salin file contoh dan sesuaikan nilainya.

```bash
cp apps/backend/.env.example apps/backend/.env
nano apps/backend/.env

cp apps/bot/.env.example apps/bot/.env
nano apps/bot/.env
```

Variabel penting yang perlu diisi:
- `PT_APP_BASE_URL`, `PT_APP_API_KEY`, `PT_NODE_ID`
- `INTERNAL_SECRET`
- `TARGET_GROUP_ID` (ID grup WhatsApp)
- `BACKEND_WEBHOOK_URL`

## 5. Build Project

```bash
# Build semua paket
pnpm build
```

## 6. Menjalankan Aplikasi dengan PM2

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.json
pm2 save
```

Perintah di atas akan menjalankan backend dan bot sesuai pengaturan di `ecosystem.config.json`.

## 7. Menjalankan Frontend

```bash
cd apps/frontend
pnpm build
PORT=3001 pnpm start &
cd ../../
```

## 8. Konfigurasi Nginx

Buat konfigurasi reverse proxy untuk frontend dan backend.

```bash
sudo tee /etc/nginx/sites-available/wa-ptero-claim <<'NGINX'
server {
    listen 80;
    server_name example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/wa-ptero-claim /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Ganti `example.com` dengan domain milik Anda.

## 9. Otomatis Mulai Saat Boot

```bash
pm2 startup systemd
sudo systemctl enable nginx
sudo systemctl enable redis-server
```

## 10. Selesai

Aplikasi sekarang siap digunakan. Frontend dapat diakses melalui `http://example.com` dan semua permintaan ke `/api` akan diteruskan ke backend.
