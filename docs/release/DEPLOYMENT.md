# Phoenix Talent OS — Deployment Guide

יעד: שרת on-premise / VM יחיד עם FastAPI backend + Next.js frontend, מאחורי nginx + HTTPS.

## ארכיטקטורת ה-deployment

```
HTTPS (443)
   ↓
nginx (reverse proxy, SSL termination)
   ↓
Next.js  :3000  (phoenix-frontend.service)
   ↓ rewrites
FastAPI  :8010  (phoenix-backend.service)
   ↓
SQLite   /opt/phoenix/backend/phoenix_enterprise.db
```

## דרישות שרת

- Ubuntu 22.04 LTS (או דומה)
- Python 3.11+, Node.js 20+, npm
- nginx, certbot
- systemd
- משתמש `phoenix` ייעודי: `useradd -m -s /bin/bash phoenix`

## משתני סביבה (`backend/.env`)

| משתנה | חובה? | תיאור |
|--------|--------|--------|
| `JWT_SECRET` | **חובה** | סוד חתימת JWT. בלעדיו הבקאנד מסרב להפעיל. |
| `JWT_TTL_MINUTES` | אופציונלי | אורך חיי token (ברירת מחדל 120) |
| `ADMIN_API_TOKEN` | אופציונלי | טוקן אדמין ל-header `X-Admin-Token` |
| `SESSION_UNLOCK_PIN` | אופציונלי | PIN לזרימת unlock הישנה |
| `MAX_UPLOAD_MB` | אופציונלי | תקרת גודל קובץ העלאה (ברירת מחדל 10) |
| `MAX_INGEST_ERROR_RATE` | אופציונלי | סף שגיאות מותר ב-ingestion (0.0–1.0) |
| `COOKIE_SECURE` | אופציונלי | 1 ל-HTTPS, 0 ל-dev בלבד |

ייצור `JWT_SECRET`:
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## משתני סביבה (`phoenix-dashboard/.env.production`)

| משתנה | תיאור |
|--------|--------|
| `BACKEND_INTERNAL_URL` | URL פנימי לבקאנד (`http://127.0.0.1:8010` ב-VM יחיד) |

## תהליך התקנה ראשונית

1. **קלון + תלויות**
   ```bash
   sudo mkdir -p /opt/phoenix && sudo chown phoenix:phoenix /opt/phoenix
   sudo -u phoenix git clone <repo> /opt/phoenix
   cd /opt/phoenix/backend
   sudo -u phoenix python3 -m venv .venv
   sudo -u phoenix .venv/bin/pip install -r requirements.txt
   cd /opt/phoenix/phoenix-dashboard
   sudo -u phoenix npm ci
   sudo -u phoenix npm run build
   ```

2. **env files**
   ```bash
   sudo -u phoenix cp /opt/phoenix/backend/.env.example /opt/phoenix/backend/.env
   sudo -u phoenix cp /opt/phoenix/phoenix-dashboard/.env.production.example /opt/phoenix/phoenix-dashboard/.env.production
   # ערוך את שני הקבצים — בעיקר JWT_SECRET
   sudo -u phoenix nano /opt/phoenix/backend/.env
   ```

3. **systemd units**
   ```bash
   sudo cp /opt/phoenix/deploy/phoenix-backend.service /etc/systemd/system/
   sudo cp /opt/phoenix/deploy/phoenix-frontend.service /etc/systemd/system/
   sudo chmod +x /opt/phoenix/backend/scripts/start.sh
   sudo chmod +x /opt/phoenix/deploy/backup.sh /opt/phoenix/deploy/smoke.sh
   sudo systemctl daemon-reload
   sudo systemctl enable --now phoenix-backend phoenix-frontend
   sudo systemctl status phoenix-backend phoenix-frontend
   ```

4. **nginx + SSL**
   קובץ `/etc/nginx/sites-available/phoenix`:
   ```nginx
   server {
       listen 443 ssl http2;
       server_name phoenix.example.com;

       ssl_certificate     /etc/letsencrypt/live/phoenix.example.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/phoenix.example.com/privkey.pem;

       client_max_body_size 25M;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host              $host;
           proxy_set_header X-Real-IP         $remote_addr;
           proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   server {
       listen 80;
       server_name phoenix.example.com;
       return 301 https://$host$request_uri;
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/phoenix /etc/nginx/sites-enabled/
   sudo certbot --nginx -d phoenix.example.com
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **גיבוי יומי**
   ```bash
   sudo crontab -e
   # הוסף:
   0 2 * * * /opt/phoenix/deploy/backup.sh >> /var/log/phoenix-backup.log 2>&1
   ```

## אימות (smoke test)

```bash
/opt/phoenix/deploy/smoke.sh https://phoenix.example.com
```

ידני:
```bash
curl -i https://phoenix.example.com/healthz
curl -i https://phoenix.example.com/readyz
curl -i https://phoenix.example.com/
```

## עדכונים שוטפים

```bash
cd /opt/phoenix
sudo -u phoenix git pull
cd backend && sudo -u phoenix .venv/bin/pip install -r requirements.txt
cd ../phoenix-dashboard && sudo -u phoenix npm ci && sudo -u phoenix npm run build
sudo systemctl restart phoenix-backend phoenix-frontend
/opt/phoenix/deploy/smoke.sh https://phoenix.example.com
```

## שחזור מגיבוי

```bash
sudo systemctl stop phoenix-backend
sudo -u phoenix cp /var/backups/phoenix/db_<STAMP>.db.gz /tmp/
gunzip /tmp/db_<STAMP>.db.gz
sudo -u phoenix mv /tmp/db_<STAMP>.db /opt/phoenix/backend/phoenix_enterprise.db
sudo systemctl start phoenix-backend
/opt/phoenix/deploy/smoke.sh https://phoenix.example.com
```

## Troubleshooting

| תסמין | בדיקה |
|--------|--------|
| Backend לא עולה | `journalctl -u phoenix-backend -n 50` — אם רואים "JWT_SECRET is not set" → ערוך `.env` |
| 502 ב-nginx | `systemctl status phoenix-frontend`, ודא שפורט 3000 מאזין |
| Login נכשל עם 500 | בדוק שהקוקיז נשלחים כ-Secure (`COOKIE_SECURE=1` + HTTPS) |
| Upload מחזיר 413 | הגדל `client_max_body_size` ב-nginx ו-`MAX_UPLOAD_MB` ב-`.env` |
