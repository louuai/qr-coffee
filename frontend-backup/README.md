# Frontend - QR Coffee Ordering System

## Structure

Le frontend a été entièrement refait en HTML/CSS/JavaScript pur, remplaçant l'ancien frontend React.

### Structure des fichiers

```
frontend/
├── index.html          # Page principale (router)
├── css/
│   └── style.css       # Styles CSS modernes (thème café)
├── js/
│   ├── api.js          # Fonctions API et Socket.io
│   ├── auth.js         # Gestion de l'authentification
│   └── app.js          # Application principale et router
├── admin/
│   └── login.html      # Page de connexion admin
├── Dockerfile          # Configuration Docker (nginx)
├── nginx.conf          # Configuration nginx
└── README.md           # Ce fichier
```

## Fonctionnalités

### Pages publiques
- **Menu client** (`/menu/{hotelSlug}?table={numero}`)
  - Affichage du menu par catégories
  - Panier avec sidebar
  - Passage de commande

### Pages admin
- **Login** (`/admin/login.html`)
- **Dashboard** (`/admin/#dashboard`)
  - Statistiques en temps réel
  - Vue des tables actives
  - Notifications Socket.io
- **Tables** (`/admin/#tables`)
  - Gestion des tables
  - Visualisation des QR codes
  - Statuts des tables
- **Commandes** (`/admin/#orders`)
  - Liste des commandes
  - Gestion des statuts
  - Notifications temps réel
- **Menu** (`/admin/#menu`)
  - Gestion des items du menu
  - Catégories
  - Disponibilité
- **Profil** (`/admin/#profile`)

## Design

Le design utilise un thème café avec:
- Couleurs: Marron, beige, crème
- Typographie: Playfair Display (titres) + Inter (corps)
- Animations douces et transitions
- Responsive design (mobile-first)
- Cards, badges, modals modernes

## API

Le frontend communique avec le backend via:
- Base URL: `http://localhost:3000`
- Authentification: JWT Bearer tokens
- WebSockets: Socket.io pour les notifications temps réel

## Développement

### Local (sans Docker)
1. Servir les fichiers avec un serveur HTTP simple
2. Configurer CORS si nécessaire
3. S'assurer que le backend est accessible sur `http://localhost:3000`

### Docker
Le frontend est servi via nginx dans un conteneur Docker.

```bash
docker-compose up frontend
```

## Notes

- Les anciens fichiers React sont conservés dans `src/` mais ne sont plus utilisés
- Le router utilise des hash fragments (`#dashboard`, `#tables`, etc.)
- Les données sont stockées dans localStorage (panier, token)
- Socket.io est chargé dynamiquement depuis CDN

