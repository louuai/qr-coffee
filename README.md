# rasops-qr — QR Coffee Ordering System (MVP)

This repository contains a full-stack minimal MVP for a QR-based coffee ordering system.

Structure
- backend: Express + TypeScript + Sequelize (MySQL)
- frontend: React + Vite + TypeScript + TailwindCSS
- docker-compose.yml for dev environment

Quick start (dev, requires Docker)

1. Copy env example:

```powershell
cp .env.example .env
# edit .env to match your environment
```

2. Start dev stack:

```powershell
docker-compose up --build
```

3. Backend: http://localhost:3000
   Frontend: http://localhost:5173

Notes
- Backend seeds demo data on `npm run seed` (or run via docker entrypoint).
- QR PNGs are written to `backend/public/qrcodes/` and served statically.

See each package README for more details.
