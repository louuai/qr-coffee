# Changements - Migration vers HTML/CSS

## Résumé des modifications

Le frontend a été entièrement refait en HTML/CSS/JavaScript pur, remplaçant l'ancien frontend React.

## Nouvelle structure

### Frontend
- **HTML/CSS/JS pur** : Plus de React, TypeScript, ou Vite
- **Nginx** : Serveur web statique pour servir les fichiers
- **Design moderne** : Thème café avec animations et responsive design
- **Router client-side** : Navigation via hash fragments

### Fichiers créés
```
frontend/
├── index.html              # Page principale avec router
├── css/
│   └── style.css          # Styles CSS complets (thème café)
├── js/
│   ├── api.js             # Fonctions API et Socket.io
│   ├── auth.js            # Gestion authentification
│   └── app.js             # Application principale et router
├── admin/
│   └── login.html         # Page de connexion admin
├── Dockerfile             # Configuration nginx
├── nginx.conf             # Configuration nginx
└── README.md              # Documentation
```

## Backend - Routes ajoutées

### Nouvelles routes API
- `POST /api/hotels/:id/tables` - Créer une table
- `PUT /api/hotels/:id/tables/:tableId` - Modifier une table
- `DELETE /api/hotels/:id/tables/:tableId` - Supprimer une table
- `GET /api/hotels/:id/menu` - Récupérer le menu
- `POST /api/hotels/:id/menu` - Créer un item menu
- `PUT /api/hotels/:id/menu/:itemId` - Modifier un item menu
- `DELETE /api/hotels/:id/menu/:itemId` - Supprimer un item menu
- `GET /api/hotels/:id/orders` - Récupérer les commandes
- `PUT /api/hotels/orders/:orderId/status` - Mettre à jour le statut d'une commande

## Fonctionnalités

### Pages publiques
- **Menu client** : Affichage du menu par catégories, panier, commande
- **QR Code** : Accès via `/menu/{hotelSlug}?table={numero}`

### Pages admin
- **Login** : Connexion avec JWT
- **Dashboard** : Statistiques en temps réel, tables actives
- **Tables** : Gestion des tables, visualisation QR codes
- **Commandes** : Liste des commandes, gestion des statuts
- **Menu** : Gestion des items du menu
- **Profil** : Gestion du profil utilisateur

## Design

### Thème café
- Couleurs : Marron (#8B4513), beige, crème
- Typographie : Playfair Display (titres) + Inter (corps)
- Animations : Transitions douces, hover effects
- Responsive : Mobile-first, adaptatif

### Composants
- Cards modernes avec ombres
- Badges colorés pour les statuts
- Modals avec animations
- Sidebar panier pour le menu public
- Notifications toast
- Tables responsive

## Configuration

### Docker
- Frontend : Nginx sur port 80 (mappé à 5173)
- Backend : Express sur port 3000
- Base de données : MySQL sur port 3306

### Développement
```bash
docker-compose up --build
```

- Frontend : http://localhost:5173
- Backend : http://localhost:3000
- Menu public : http://localhost:5173/menu/demo-coffee?table=1
- Admin : http://localhost:5173/admin/login.html

### Comptes de démonstration
- Email : admin@example.com
- Password : password

## Notes importantes

1. **Anciens fichiers React** : Conservés dans `frontend/src/` mais non utilisés
2. **Router** : Utilise des hash fragments (#dashboard, #tables, etc.)
3. **Stockage** : localStorage pour le panier et le token
4. **Socket.io** : Chargé dynamiquement depuis CDN
5. **CORS** : Configuré dans le backend pour accepter les requêtes du frontend

## Prochaines étapes (optionnel)

- [ ] Implémenter les modals pour ajouter/modifier tables et menu items
- [ ] Ajouter la gestion complète du profil utilisateur
- [ ] Améliorer les détails des commandes
- [ ] Ajouter des filtres et recherche
- [ ] Implémenter les statistiques avancées

