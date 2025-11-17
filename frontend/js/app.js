// Main Application Router
const app = {
    currentPage: null,
    hotelId: null, // Will be loaded dynamically

    async init() {
        console.log('App initializing...', window.location.pathname);
        
        // Load hotel ID if authenticated
        if (auth.isAuthenticated() && !this.hotelId) {
            try {
                const hotels = await api.get('/api/hotels');
                if (hotels && hotels.length > 0) {
                    this.hotelId = hotels[0].id;
                    console.log('Loaded hotel ID:', this.hotelId);
                }
            } catch (error) {
                console.error('Failed to load hotel:', error);
            }
        }
        
        this.router();
        this.setupEventListeners();
    },

    async loadHistory() {
        document.getElementById('app').innerHTML = this.showLoading();
        try {
            await this.ensureHotelId();
            const now = new Date();
            const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            const data = await api.get(`/api/hotels/${this.hotelId}/history?month=${ym}`);
            this.renderAdminLayout('Historique', `
                <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;">
                    <div>
                        <h1 class="page-title">Historique Mensuel</h1>
                        <p class="page-subtitle">Statistiques agrégées par mois et export CSV</p>
                    </div>
                    <div style="display:flex;gap:.5rem;align-items:center;">
                        <input type="month" id="hist-month" value="${data.month}" class="search-input" style="min-width: 200px;" />
                        <button class="btn btn-primary" id="hist-refresh">Actualiser</button>
                        <button class="btn btn-outline" id="hist-export">Exporter CSV</button>
                    </div>
                </div>
                <div class="grid grid-3 mb-lg">
                    <div class="card"><div class="card-header"><h2 class="card-title">Commandes</h2></div><div class="card-body"><div style="font-size:2rem;font-weight:700;">${data.totalOrders}</div></div></div>
                    <div class="card"><div class="card-header"><h2 class="card-title">Servies</h2></div><div class="card-body"><div style="font-size:2rem;font-weight:700;color:var(--success);">${data.served}</div></div></div>
                    <div class="card"><div class="card-header"><h2 class="card-title">Annulées</h2></div><div class="card-body"><div style="font-size:2rem;font-weight:700;color:var(--error);">${data.cancelled}</div></div></div>
                </div>
                <div class="grid grid-2">
                    <div class="card"><div class="card-header"><h2 class="card-title">Chiffre d'affaires</h2></div><div class="card-body"><div style="font-size:2rem;font-weight:700;color:var(--primary);">€${Number(data.revenue||0).toFixed(2)}</div></div></div>
                    <div class="card"><div class="card-header"><h2 class="card-title">Temps moyen (servies)</h2></div><div class="card-body"><div style="font-size:2rem;font-weight:700;color:var(--warning);">${data.avgWaitMinutes} min</div></div></div>
                </div>
            `);
            // Wire actions
            const monthEl = document.getElementById('hist-month');
            document.getElementById('hist-refresh')?.addEventListener('click', async ()=>{
                const m = (monthEl as HTMLInputElement).value || ym;
                const d = await api.get(`/api/hotels/${this.hotelId}/history?month=${m}`);
                window.location.hash = '#history';
                // simple reload
                this.loadHistory();
            });
            document.getElementById('hist-export')?.addEventListener('click', async ()=>{
                const m = (monthEl as HTMLInputElement).value || ym;
                const r = await api.get(`/api/hotels/${this.hotelId}/export-csv?month=${m}`);
                if (r?.path) { window.open(r.path, '_blank'); }
            });
        } catch (error) {
            document.getElementById('app').innerHTML = `<div class="container"><p>Erreur: ${error.message}</p></div>`;
        }
    },

    // Modern, clean tables view with filters and search
    renderTablesModern(tables) {
        this.renderAdminLayout('Tables', `
            <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;">
                <div>
                    <h1 class="page-title">Tables</h1>
                    <p class="page-subtitle">Gérez vos tables avec des filtres et actions rapides</p>
                </div>
                <button class="btn btn-primary" onclick="app.showAddTableModal()">Ajouter une table</button>
            </div>

            <div class="tables-toolbar">
                <div class="filter-group" role="tablist" aria-label="Filtrer par statut">
                    <button class="filter-pill is-active" data-filter="all">Toutes</button>
                    <button class="filter-pill" data-filter="new">Nouvelles</button>
                    <button class="filter-pill" data-filter="in_progress">En cours</button>
                    <button class="filter-pill" data-filter="served">Servies</button>
                    <button class="filter-pill" data-filter="idle">Libres</button>
                </div>
                <div class="right-group">
                    <input id="tables-search" class="search-input" placeholder="Rechercher une table..." />
                </div>
            </div>

            <div class="cards-grid" id="tables-grid">
                ${tables.map(table => `
                    <div class="table-card" data-table-id="${table.id}" data-status="${table.status}" data-number="${table.number}">
                        <div class="table-card-header">
                            <div class="table-card-title">
                                <div class="table-avatar">${table.number}</div>
                                <div class="title">Table ${table.number}</div>
                            </div>
                            <span class="badge badge-${this.getStatusColor(table.status)}">${(table.status||'').replace('_',' ')}</span>
                        </div>
                        <div class="table-card-body">
                            <div class="meta">
                                ${table.unreadOrders > 0 ? `<span class="chip chip-info">${table.unreadOrders} nouvelle${table.unreadOrders>1?'s':''}</span>` : '<span class="chip chip-gray">Aucune commande</span>'}
                            </div>
                        </div>
                        <div class="table-card-footer">
                            <button class="btn btn-sm btn-outline" onclick="app.viewQRCode(${table.id})">QR Code</button>
                            <button class="btn btn-sm btn-outline" onclick="app.editTable(${table.id}, ${table.number}, '${table.status}')">Modifier</button>
                            <button class="btn btn-sm btn-danger" onclick="app.deleteTable(${table.id})">Supprimer</button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <script>
            (function(){
              const pills = document.querySelectorAll('.filter-pill');
              const search = document.getElementById('tables-search');
              let currentFilter = 'all';
              function applyFilters(){
                const q = (search.value || '').toLowerCase().trim();
                document.querySelectorAll('.table-card').forEach(el => {
                  const status = el.getAttribute('data-status');
                  const number = (el.getAttribute('data-number') || '').toLowerCase();
                  const matchesFilter = currentFilter === 'all' || status === currentFilter;
                  const label = ('table '+number).toLowerCase();
                  const matchesSearch = !q || label.includes(q) || number.includes(q);
                  el.style.display = (matchesFilter && matchesSearch) ? '' : 'none';
                });
              }
              pills.forEach(p => p.addEventListener('click', () => {
                pills.forEach(x => x.classList.remove('is-active'));
                p.classList.add('is-active');
                currentFilter = p.getAttribute('data-filter');
                applyFilters();
              }));
              search.addEventListener('input', applyFilters);
            })();
            </script>
        `);
    },

    router() {
        const path = window.location.pathname;
        const hash = window.location.hash.slice(1) || 'dashboard';
        
        console.log('Router called:', { path, hash });
        
        if (path.includes('/menu/')) {
            console.log('Loading public menu...');
            this.loadPublicMenu();
            return;
        } else if (path.includes('login.html') || (path === '/admin/' && !auth.isAuthenticated())) {
            this.loadLogin();
            return;
        } else if (path.includes('register.html')) {
            this.loadRegister();
            return;
        } else if (path.includes('/admin/')) {
            // Si on est sur /admin/ sans hash, rediriger vers dashboard
            if (!hash && path === '/admin/' || path === '/admin/index.html') {
                if (!auth.isAuthenticated()) {
                    window.location.href = '/admin/login.html';
                    return;
                }
                window.location.hash = '#dashboard';
                this.loadDashboard();
                return;
            }
            
            if (!auth.isAuthenticated()) {
                window.location.href = '/admin/login.html';
                return;
            }
            
            switch(hash) {
                case 'dashboard':
                    this.loadDashboard();
                    break;
                case 'tables':
                    this.loadTables();
                    break;
                case 'orders':
                    this.loadOrders();
                    break;
                case 'history':
                    this.loadHistory();
                    break;
                case 'menu':
                    this.loadMenu();
                    break;
                case 'profile':
                    this.loadProfile();
                    break;
                default:
                    this.loadDashboard();
            }
        } else if (hash) {
            // Si on a un hash mais pas de path /admin/, rediriger
            if (!auth.isAuthenticated()) {
                window.location.href = '/admin/login.html';
                return;
            }
            window.location.pathname = '/admin/';
            this.router();
        } else {
            // Default to public menu or redirect
            window.location.href = '/menu/demo-coffee?table=1';
        }
    },

    setupEventListeners() {
        // Navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-nav]')) {
                e.preventDefault();
                const page = e.target.getAttribute('data-nav');
                window.location.hash = page;
                this.router();
            }
        });

        // Logout
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-logout]')) {
                e.preventDefault();
                auth.logout();
            }
        });
    },

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;">×</button>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    },

    // Big, prominent banner for new orders with sound
    ensureAlertAudio() {
        if (this._alertAudio) return this._alertAudio;
        try {
            // Short beep base64 to avoid external asset
            const src = 'data:audio/wav;base64,UklGRhQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAZGF0YQgAAAAA/////wAAAP///wAAAP///wAAAP///wAAAP///wAAAP///wAAAP8=';
            const audio = new Audio(src);
            audio.volume = 0.6;
            this._alertAudio = audio;
        } catch {}
        return this._alertAudio;
    },

    showOrderBanner(payload) {
        const tableNumber = payload?.tableNumber ?? payload?.table_id ?? payload?.table;
        const id = 'order-banner';
        let el = document.getElementById(id);
        const now = new Date();
        const title = 'Nouvelle commande';
        const sub = tableNumber ? `Table ${tableNumber} • ${now.toLocaleTimeString()}` : now.toLocaleTimeString();

        const html = `
          <div class="ob-inner">
            <div class="ob-head">
              <div style="display:flex; align-items:center; gap:10px;">
                <div class="ob-icon">🍽️</div>
                <div>
                  <div class="ob-title">${title}</div>
                  <div class="ob-sub">${sub}</div>
                </div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="document.getElementById('${id}')?.remove()">Fermer</button>
            </div>
            <div class="ob-actions">
              <button class="btn btn-primary btn-sm" onclick="window.location.hash='#orders'; document.getElementById('${id}')?.remove()">Voir les commandes</button>
            </div>
          </div>
          <div class="ob-pulse"></div>
        `;

        if (!el) {
          el = document.createElement('div');
          el.id = id;
          el.className = 'order-banner';
          document.body.appendChild(el);
        }
        el.innerHTML = html;
        requestAnimationFrame(() => el.classList.add('show'));
        try { this.ensureAlertAudio()?.play?.(); } catch {}
        if (navigator?.vibrate) { try { navigator.vibrate(150); } catch {} }
        clearTimeout(this._obTimer);
        this._obTimer = setTimeout(() => { el?.classList.remove('show'); setTimeout(() => el?.remove(), 300); }, 8000);
    },

    async ensureHotelId() {
        if (!this.hotelId) {
            const hotels = await api.get('/api/hotels');
            if (hotels && hotels.length > 0) {
                this.hotelId = hotels[0].id;
            } else {
                throw new Error('Aucun hôtel trouvé. Veuillez créer un hôtel d\'abord.');
            }
        }
        return this.hotelId;
    },

    showLoading() {
        return '<div class="loading"><div class="spinner"></div></div>';
    },

    async loadPublicMenu() {
        console.log('loadPublicMenu called');
        document.getElementById('app').innerHTML = this.showLoading();
        
        const urlParams = new URLSearchParams(window.location.search);
        const tableNumber = parseInt(urlParams.get('table') || '1');
        const pathParts = window.location.pathname.split('/');
        const hotelSlug = pathParts[pathParts.length - 1];

        console.log('Loading menu for:', { hotelSlug, tableNumber });

        try {
            const data = await api.get(`/api/menu/${hotelSlug}`);
            console.log('Menu data received:', data);
            this.renderPublicMenu(data.hotel, data.menu, tableNumber);
        } catch (error) {
            console.error('Error loading menu:', error);
            document.getElementById('app').innerHTML = `
                <div class="container" style="padding: 2rem; text-align: center;">
                    <h1 style="color: var(--error);">Erreur</h1>
                    <p style="color: var(--text-light); margin-top: 1rem;">${error.message}</p>
                    <p style="color: var(--text-light); margin-top: 0.5rem; font-size: 0.875rem;">Vérifiez que le serveur backend est démarré et que l'hôtel existe.</p>
                </div>
            `;
        }
    },

    renderPublicMenu(hotel, menu, tableNumber) {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        
        document.getElementById('app').innerHTML = `
            <div class="public-menu">
                <div class="public-header">
                    <div class="container">
                        <h1>${hotel.name}</h1>
                        <p>Table ${tableNumber}</p>
                    </div>
                </div>
                
                <div class="menu-section">
                    <div class="container">
                        <div id="menu-content"></div>
                    </div>
                </div>
                
                <button class="cart-toggle" onclick="app.toggleCart()">
                    🛒
                    ${cart.length > 0 ? `<span class="cart-badge">${cart.reduce((sum, item) => sum + item.quantity, 0)}</span>` : ''}
                </button>
                
                <div class="cart-sidebar" id="cart-sidebar">
                    <div class="cart-header">
                        <h2 class="cart-title">Panier</h2>
                        <button onclick="app.toggleCart()" class="modal-close">×</button>
                    </div>
                    <div class="cart-body" id="cart-body"></div>
                    <div class="cart-footer" id="cart-footer"></div>
                </div>
            </div>
        `;

        // Group menu by category
        const menuByCategory = {};
        menu.forEach(item => {
            if (!menuByCategory[item.category]) {
                menuByCategory[item.category] = [];
            }
            menuByCategory[item.category].push(item);
        });

        const menuContent = document.getElementById('menu-content');
        menuContent.innerHTML = Object.keys(menuByCategory).map(category => `
            <div class="menu-category">
                <h2 class="category-title">${category}</h2>
                <div class="menu-items">
                    ${menuByCategory[category].map(item => `
                        <div class="menu-item-card ${!item.available ? 'disabled' : ''}" 
                             onclick="${item.available ? `app.addToCart(${item.id}, '${item.name}', ${item.price}, '${item.description}')` : ''}">
                            <div class="menu-item-name">${item.name}</div>
                            <div class="menu-item-description">${item.description || ''}</div>
                            <div class="menu-item-footer">
                                <div class="menu-item-price">€${parseFloat(item.price).toFixed(2)}</div>
                                ${item.available ? '<button class="btn btn-primary btn-sm">Ajouter</button>' : '<span class="badge badge-error">Indisponible</span>'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        this.updateCart();
    },

    addToCart(itemId, name, price, description) {
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const existingItem = cart.find(item => item.id === itemId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ id: itemId, name, price, description, quantity: 1 });
        }
        
        localStorage.setItem('cart', JSON.stringify(cart));
        this.updateCart();
        this.showNotification(`${name} ajouté au panier`, 'success');
    },

    removeFromCart(itemId) {
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        cart = cart.filter(item => item.id !== itemId);
        localStorage.setItem('cart', JSON.stringify(cart));
        this.updateCart();
    },

    updateCartQuantity(itemId, delta) {
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const item = cart.find(i => i.id === itemId);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                this.removeFromCart(itemId);
                return;
            }
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        this.updateCart();
    },

    updateCart() {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const cartBody = document.getElementById('cart-body');
        const cartFooter = document.getElementById('cart-footer');
        const cartToggle = document.querySelector('.cart-toggle');
        
        if (cartToggle) {
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            const badge = cartToggle.querySelector('.cart-badge');
            if (totalItems > 0) {
                if (!badge) {
                    const badgeEl = document.createElement('span');
                    badgeEl.className = 'cart-badge';
                    badgeEl.textContent = totalItems;
                    cartToggle.appendChild(badgeEl);
                } else {
                    badge.textContent = totalItems;
                }
            } else if (badge) {
                badge.remove();
            }
        }

        if (cartBody) {
            if (cart.length === 0) {
                cartBody.innerHTML = '<p class="text-center" style="color: var(--text-light); padding: 2rem;">Votre panier est vide</p>';
            } else {
                cartBody.innerHTML = cart.map(item => `
                    <div class="cart-item">
                        <div class="cart-item-info">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-price">€${parseFloat(item.price).toFixed(2)} × ${item.quantity}</div>
                        </div>
                        <div class="cart-item-controls">
                            <button class="quantity-btn" onclick="app.updateCartQuantity(${item.id}, -1)">−</button>
                            <span class="quantity-value">${item.quantity}</span>
                            <button class="quantity-btn" onclick="app.updateCartQuantity(${item.id}, 1)">+</button>
                            <button class="btn btn-danger btn-sm" onclick="app.removeFromCart(${item.id})" style="margin-left: 0.5rem;">×</button>
                        </div>
                    </div>
                `).join('');
            }
        }

        if (cartFooter) {
            const total = cart.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
            cartFooter.innerHTML = `
                <div class="cart-total">
                    <span>Total:</span>
                    <span>€${total.toFixed(2)}</span>
                </div>
                <div class="cart-actions">
                    <button class="btn btn-primary" onclick="app.checkout()" style="width: 100%;">Commander</button>
                </div>
            `;
        }
    },

    toggleCart() {
        const sidebar = document.getElementById('cart-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    },

    async checkout() {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        if (cart.length === 0) {
            this.showNotification('Votre panier est vide', 'error');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const tableNumber = parseInt(urlParams.get('table') || '1');
        const pathParts = window.location.pathname.split('/');
        const hotelSlug = pathParts[pathParts.length - 1];
        
        // Get hotel ID from menu data
        const menuData = await api.get(`/api/menu/${hotelSlug}`);
        const hotelId = menuData.hotel.id;

        const items = cart.map(item => ({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            qty: item.quantity
        }));

        try {
            await api.post('/api/order/public', {
                hotelId,
                tableNumber,
                items,
                customerNote: ''
            });

            localStorage.removeItem('cart');
            this.updateCart();
            this.toggleCart();
            this.showNotification('Commande passée avec succès!', 'success');
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            this.showNotification('Erreur lors de la commande: ' + error.message, 'error');
        }
    },

    // Admin pages will be loaded here
    async loadLogin() {
        document.getElementById('app').innerHTML = `
            <div class="admin-layout">
                <div class="admin-main">
                    <div class="container" style="max-width: 400px; margin-top: 4rem;">
                        <div class="card">
                            <div class="card-header">
                                <h1 class="card-title text-center">Connexion Admin</h1>
                            </div>
                            <form id="login-form" onsubmit="app.handleLogin(event)">
                                <div class="form-group">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-input" name="email" value="admin@example.com" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Mot de passe</label>
                                    <input type="password" class="form-input" name="password" required>
                                </div>
                                <button type="submit" class="btn btn-primary" style="width: 100%;">Se connecter</button>
                            </form>
                            <div style="margin-top: 1rem; text-align: center; color: var(--text-light); font-size: 0.875rem;">
                                <p>Démo: admin@example.com / password</p>
                                <p style="margin-top: 0.5rem;">
                                    <a href="/admin/register.html" style="color: var(--primary); text-decoration: none;">Créer un compte</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadRegister() {
        document.getElementById('app').innerHTML = `
            <div class="admin-layout">
                <div class="admin-main">
                    <div class="container" style="max-width: 400px; margin-top: 4rem;">
                        <div class="card">
                            <div class="card-header">
                                <h1 class="card-title text-center">Créer un compte</h1>
                            </div>
                            <form id="register-form" onsubmit="app.handleRegister(event)">
                                <div class="form-group">
                                    <label class="form-label">Nom</label>
                                    <input type="text" class="form-input" name="name" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-input" name="email" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Mot de passe</label>
                                    <input type="password" class="form-input" name="password" minlength="6" required>
                                    <small style="color: var(--text-light); font-size: 0.75rem;">Minimum 6 caractères</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Confirmer le mot de passe</label>
                                    <input type="password" class="form-input" name="confirmPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary" style="width: 100%;">Créer le compte</button>
                            </form>
                            <div style="margin-top: 1rem; text-align: center; color: var(--text-light); font-size: 0.875rem;">
                                <p>
                                    <a href="/admin/login.html" style="color: var(--primary); text-decoration: none;">Déjà un compte ? Se connecter</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');

        if (password !== confirmPassword) {
            this.showNotification('Les mots de passe ne correspondent pas', 'error');
            return;
        }

        try {
            await auth.register(name, email, password);
            this.showNotification('Compte créé avec succès !', 'success');
            setTimeout(() => {
                window.location.href = '/admin/login.html';
            }, 1500);
        } catch (error) {
            this.showNotification('Erreur lors de la création: ' + error.message, 'error');
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            await auth.login(email, password);
            this.showNotification('Connexion réussie', 'success');
            setTimeout(() => {
                window.location.hash = '#dashboard';
                window.location.pathname = '/admin/';
                this.router();
            }, 500);
        } catch (error) {
            this.showNotification('Erreur de connexion: ' + error.message, 'error');
        }
    },

    // Dashboard, Tables, Orders, Menu, Profile pages will be implemented
    async loadDashboard() {
        document.getElementById('app').innerHTML = this.showLoading();
        
        try {
            await this.ensureHotelId();
            
            const [hotel, tables] = await Promise.all([
                api.get(`/api/hotels/${this.hotelId}`),
                api.get(`/api/hotels/${this.hotelId}/tables`)
            ]);

            const activeTables = tables.filter(t => t.status !== 'idle').length;
            const unreadOrders = tables.reduce((sum, t) => sum + (t.unreadOrders || 0), 0);

            this.renderAdminLayout('Dashboard', `
                <div class="page-header">
                    <h1 class="page-title">Dashboard — ${hotel.name}</h1>
                </div>
                
                <div class="grid grid-4 mb-lg">
                    <div class="card" id="kpi-active">
                        <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">Tables Actives</h3>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${activeTables}/${tables.length}</div>
                    </div>
                    <div class="card" id="kpi-new">
                        <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">Nouvelles Commandes</h3>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--error);">${unreadOrders}</div>
                    </div>
                    <div class="card" id="kpi-wait">
                        <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">Temps d'attente</h3>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--warning);">—</div>
                    </div>
                    <div class="card" id="kpi-customers">
                        <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">Clients Aujourd'hui</h3>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--success);">—</div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Tables Actives</h2>
                    </div>
                    <div class="grid grid-4" id="tables-grid">
                        ${tables.map(table => `
                            <div class="card dashboard-table-card ${table.unreadOrders > 0 ? 'has-new-orders' : ''}" 
                                 style="text-align: center; cursor: pointer; transition: all 0.3s ease; ${table.status === 'new' ? 'border: 2px solid var(--info);' : ''}"
                                 onclick="app.showTableOrders(${table.id}, ${table.number}, ${table.unreadOrders || 0})">
                                <h3 style="margin-bottom: 0.5rem;">Table ${table.number}</h3>
                                <span class="badge badge-${this.getStatusColor(table.status)}">${table.status}</span>
                                ${table.unreadOrders > 0 ? `
                                    <div style="margin-top: 0.5rem; color: var(--info); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                        <span class="notification-dot"></span>
                                        <span>${table.unreadOrders} nouvelle${table.unreadOrders > 1 ? 's' : ''} commande${table.unreadOrders > 1 ? 's' : ''}</span>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `);

            // Setup socket for real-time updates
            connectSocket(this.hotelId);
            if (socket) {
                socket.on('order:new', (payload) => {
                    this.showOrderBanner(payload);
                    this.loadDashboard();
                });
            }
            // Load dynamic KPIs from backend
            try {
                const k = await api.get(`/api/hotels/${this.hotelId}/kpis`);
                const k1 = document.querySelector('#kpi-active div:nth-child(2)');
                const k2 = document.querySelector('#kpi-new div:nth-child(2)');
                const k3 = document.querySelector('#kpi-wait div:nth-child(2)');
                const k4 = document.querySelector('#kpi-customers div:nth-child(2)');
                if (k1) k1.textContent = `${k.activeTables}/${k.totalTables}`;
                if (k2) k2.textContent = `${k.newOrders}`;
                if (k3) k3.textContent = `${k.avgWaitMinutes}min`;
                if (k4) k4.textContent = `${k.customersToday}`;
            } catch (e) { console.warn('Failed to load KPIs', e); }
        } catch (error) {
            document.getElementById('app').innerHTML = `<div class="container"><p>Erreur: ${error.message}</p></div>`;
        }
    },

    getStatusColor(status) {
        const colors = {
            'idle': 'gray',
            'new': 'info',
            'in_progress': 'warning',
            'served': 'success'
        };
        return colors[status] || 'gray';
    },

    async showTableOrders(tableId, tableNumber, unreadCount) {
        try {
            // Récupérer toutes les commandes pour cette table
            const orders = await api.get(`/api/hotels/${this.hotelId}/orders`);
            const tableOrders = orders.filter(order => 
                order.tableId === tableId || order.tableNumber === tableNumber
            ).filter(order => order.status === 'new' || order.status === 'preparing');
            
            if (tableOrders.length === 0) {
                this.showNotification('Aucune commande active pour cette table', 'info');
                return;
            }

            // Créer le modal flottant
            const modal = document.createElement('div');
            modal.className = 'modal-overlay table-orders-modal';
            modal.innerHTML = `
                <div class="modal" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white;">
                        <h2 class="modal-title" style="color: white;">
                            Table ${tableNumber}
                            ${unreadCount > 0 ? `<span class="badge" style="background: rgba(255,255,255,0.2); color: white; margin-left: 0.5rem; padding: 0.25rem 0.75rem;">${unreadCount} nouvelle${unreadCount > 1 ? 's' : ''}</span>` : ''}
                        </h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white;">×</button>
                    </div>
                    <div class="modal-body" style="padding: var(--spacing-lg);">
                        ${tableOrders.map(order => `
                            <div class="order-card" style="margin-bottom: var(--spacing-md); padding: var(--spacing-md); border: 2px solid var(--border); border-radius: var(--radius-md); background: var(--surface);">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-md);">
                                    <div>
                                        <h3 style="margin: 0 0 0.5rem 0; color: var(--text); font-size: 1.25rem;">Commande #${order.id}</h3>
                                        <span class="badge badge-${this.getOrderStatusColor(order.status)}">${order.status}</span>
                                        <p style="margin: 0.5rem 0 0 0; color: var(--text-light); font-size: 0.875rem;">
                                            ${new Date(order.createdAt).toLocaleString('fr-FR')}
                                        </p>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">€${parseFloat(order.total).toFixed(2)}</div>
                                    </div>
                                </div>
                                
                                <div style="margin-bottom: var(--spacing-md);">
                                    <h4 style="margin: 0 0 var(--spacing-sm) 0; color: var(--text); font-size: 1rem; font-weight: 600;">Articles:</h4>
                                    <table class="table" style="width: 100%; border-collapse: collapse;">
                                        <thead>
                                            <tr style="background: var(--background);">
                                                <th style="padding: 0.5rem; text-align: left; font-weight: 600;">Article</th>
                                                <th style="padding: 0.5rem; text-align: center; font-weight: 600;">Qté</th>
                                                <th style="padding: 0.5rem; text-align: right; font-weight: 600;">Prix</th>
                                                <th style="padding: 0.5rem; text-align: right; font-weight: 600;">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(order.items || []).map(item => `
                                                <tr style="border-bottom: 1px solid var(--border);">
                                                    <td style="padding: 0.75rem 0.5rem;">
                                                        <div style="font-weight: 600;">${item.name || 'N/A'}</div>
                                                        ${item.description ? `<div style="font-size: 0.875rem; color: var(--text-light);">${item.description}</div>` : ''}
                                                    </td>
                                                    <td style="padding: 0.75rem 0.5rem; text-align: center;">${item.qty || item.quantity || 1}</td>
                                                    <td style="padding: 0.75rem 0.5rem; text-align: right;">€${parseFloat(item.price || 0).toFixed(2)}</td>
                                                    <td style="padding: 0.75rem 0.5rem; text-align: right; font-weight: 600;">
                                                        €${(parseFloat(item.price || 0) * (item.qty || item.quantity || 1)).toFixed(2)}
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                        <tfoot>
                                            <tr style="background: var(--background); font-weight: 700;">
                                                <td colspan="3" style="padding: 0.75rem 0.5rem; text-align: right;">Total:</td>
                                                <td style="padding: 0.75rem 0.5rem; text-align: right; font-size: 1.1rem; color: var(--primary);">
                                                    €${parseFloat(order.total || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                
                                ${order.customerInfo?.note ? `
                                    <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-sm); background: var(--background); border-radius: var(--radius-sm);">
                                        <strong>Note:</strong> ${order.customerInfo.note}
                                    </div>
                                ` : ''}
                                
                                <div style="display: flex; gap: var(--spacing-sm); justify-content: flex-end; margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 2px solid var(--border);">
                                    ${order.status === 'new' ? `
                                        <button class="btn btn-success" onclick="app.confirmOrder(${order.id}, ${tableId}, ${tableNumber})">
                                            ✓ Confirmer la commande
                                        </button>
                                        <button class="btn btn-primary" onclick="app.updateOrderStatus(${order.id}, 'preparing'); this.closest('.table-orders-modal').remove(); setTimeout(() => app.loadDashboard(), 500);">
                                            Commencer la préparation
                                        </button>
                                    ` : order.status === 'preparing' ? `
                                        <button class="btn btn-success" onclick="app.updateOrderStatus(${order.id}, 'served'); this.closest('.table-orders-modal').remove(); setTimeout(() => app.loadDashboard(), 500);">
                                            ✓ Marquer comme servi
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-outline" onclick="app.updateOrderStatus(${order.id}, 'cancelled'); this.closest('.order-card').style.opacity='0.5';">
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-footer" style="padding: var(--spacing-md); border-top: 2px solid var(--border); background: var(--background);">
                        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()" style="width: 100%;">Fermer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Animation d'entrée
            setTimeout(() => {
                modal.style.opacity = '1';
            }, 10);
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
            console.error('Error loading table orders:', error);
        }
    },

    async confirmOrder(orderId, tableId, tableNumber) {
        try {
            await api.put(`/api/hotels/orders/${orderId}/status`, { status: 'preparing' });
            this.showNotification(`Commande #${orderId} confirmée - Table ${tableNumber}`, 'success');
            
            // Fermer le modal et recharger le dashboard
            document.querySelector('.table-orders-modal')?.remove();
            this.loadDashboard();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    renderAdminLayout(title, content) {
        const currentHash = window.location.hash || '#dashboard';
        document.getElementById('app').innerHTML = `
            <div class="admin-layout">
                <div class="admin-header">
                    <div class="navbar">
                        <div class="navbar-content container">
                            <a href="#dashboard" class="navbar-brand">☕ QR Coffee</a>
                            <nav>
                                <ul class="navbar-nav">
                                    <li><a href="#dashboard" class="navbar-link ${currentHash === '#dashboard' ? 'active' : ''}" data-nav="dashboard">Dashboard</a></li>
                                    <li><a href="#tables" class="navbar-link ${currentHash === '#tables' ? 'active' : ''}" data-nav="tables">Tables</a></li>
                                    <li><a href="#orders" class="navbar-link ${currentHash === '#orders' ? 'active' : ''}" data-nav="orders">Commandes</a></li>
                                    <li><a href="#history" class="navbar-link ${currentHash === '#history' ? 'active' : ''}" data-nav="history">Historique</a></li>
                                    <li><a href="#menu" class="navbar-link ${currentHash === '#menu' ? 'active' : ''}" data-nav="menu">Menu</a></li>
                                    <li><a href="#profile" class="navbar-link ${currentHash === '#profile' ? 'active' : ''}" data-nav="profile">Profil</a></li>
                                    <li><a href="#" class="navbar-link" data-logout>Déconnexion</a></li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                </div>
                
                <div class="admin-main">
                    <div class="container">
                        ${content}
                    </div>
                </div>
            </div>
        `;
    },

    async loadTables() {
        document.getElementById('app').innerHTML = this.showLoading();
        
        try {
            await this.ensureHotelId();
            const tables = await api.get(`/api/hotels/${this.hotelId}/tables`);
            // New modern rendering
            this.renderTablesModern(tables);
            return;
            
            this.renderAdminLayout('Tables', `
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 class="page-title">Tables</h1>
                    </div>
                    <button class="btn btn-primary" onclick="app.showAddTableModal()">Ajouter une table</button>
                </div>
                
                <div class="tables-3d-grid" id="tables-grid">
                    ${tables.map(table => `
                        <div class="ti-card ${table.unreadOrders > 0 ? 'ti-new' : ''}" data-table-id="${table.id}" tabindex="0">
                            <div class="ti-media">
                                <img src="data:image/svg+xml;base64,${btoa(`
                                    <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
                                        <!-- Table Base (Pied central) -->
                                        <rect x="90" y="150" width="20" height="30" rx="10" fill="#5D4037" opacity="0.9"/>
                                        <rect x="88" y="145" width="24" height="6" rx="3" fill="#3E2723"/>
                                        
                                        <!-- Table Cloth (Nappe) -->
                                        <ellipse cx="100" cy="80" rx="75" ry="50" fill="#F5E6D3"/>
                                        <ellipse cx="100" cy="80" rx="75" ry="50" fill="none" stroke="#E8DDD4" stroke-width="2"/>
                                        
                                        <!-- Festoon (Feston) -->
                                        <path d="M 30 105 Q 40 115, 50 110 Q 60 115, 70 110 Q 80 115, 90 110 Q 100 115, 110 110 Q 120 115, 130 110 Q 140 115, 150 110 Q 160 115, 170 110" 
                                              stroke="#F5E6D3" stroke-width="3" fill="none"/>
                                        
                                        <!-- Chairs -->
                                        <rect x="30" y="140" width="28" height="35" rx="4" fill="#3E2723"/>
                                        <rect x="28" y="130" width="32" height="8" rx="4" fill="#5D4037"/>
                                        <rect x="38" y="165" width="12" height="10" rx="2" fill="#8B4513"/>
                                        
                                        <rect x="142" y="140" width="28" height="35" rx="4" fill="#3E2723"/>
                                        <rect x="140" y="130" width="32" height="8" rx="4" fill="#5D4037"/>
                                        <rect x="150" y="165" width="12" height="10" rx="2" fill="#8B4513"/>
                                        
                                        <!-- Decorations on table -->
                                        <!-- Green Bottle -->
                                        <rect x="75" y="55" width="8" height="28" rx="4" fill="#66BB6A"/>
                                        <rect x="77" y="65" width="4" height="10" rx="1" fill="#5D4037" opacity="0.8"/>
                                        
                                        <!-- Blue Vase with Red Roses -->
                                        <ellipse cx="115" cy="75" rx="10" ry="12" fill="#42A5F5"/>
                                        <ellipse cx="115" cy="62" rx="8" ry="6" fill="#F44336"/>
                                        
                                        <!-- Wine Glasses -->
                                        <path d="M 50 60 L 52 75 L 54 75 L 56 60 Z" fill="rgba(255,255,255,0.8)" stroke="#E0E0E0" stroke-width="0.5"/>
                                        <circle cx="53" cy="78" r="3" fill="rgba(255,255,255,0.8)" stroke="#E0E0E0" stroke-width="0.5"/>
                                        
                                        <path d="M 144 60 L 146 75 L 148 75 L 150 60 Z" fill="rgba(255,255,255,0.8)" stroke="#E0E0E0" stroke-width="0.5"/>
                                        <circle cx="147" cy="78" r="3" fill="rgba(255,255,255,0.8)" stroke="#E0E0E0" stroke-width="0.5"/>
                                    </svg>
                                `)}" alt="Table ${table.number}"/>
                                ${table.unreadOrders > 0 ? `<div class="ti-badge">${table.unreadOrders}</div>` : ''}
                                ${table.status === 'new' || table.status === 'in_progress' ? '<div class="ti-reserve-flag">RESERVE</div>' : ''}
                                <span class="ti-number">Table ${table.number}</span>
                            </div>
                            <!-- Table Info Overlay -->
                            <div class="table-info-overlay">
                                <div class="table-info-header">
                                    <h3 class="table-number">Table ${table.number}</h3>
                                    <span class="table-status-badge badge badge-${this.getStatusColor(table.status)}">${table.status}</span>
                                </div>
                                <div class="table-info-actions">
                                    <button class="btn btn-sm btn-outline" onclick="app.editTable(${table.id}, ${table.number}, '${table.status}')" title="Modifier">✏️</button>
                                    <button class="btn btn-sm btn-outline" onclick="app.viewQRCode(${table.id})" title="QR Code">📱</button>
                                    <button class="btn btn-sm btn-danger" onclick="app.deleteTable(${table.id})" title="Supprimer">🗑️</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `);
        } catch (error) {
            document.getElementById('app').innerHTML = `<div class="container"><p>Erreur: ${error.message}</p></div>`;
        }
    },

    async loadOrders() {
        document.getElementById('app').innerHTML = this.showLoading();
        
        try {
            await this.ensureHotelId();
            const orders = await api.get(`/api/hotels/${this.hotelId}/orders`);
            
            this.renderAdminLayout('Commandes', `
                <div class="page-header">
                    <h1 class="page-title">Commandes</h1>
                </div>
                
                <div class="card">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Table</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Statut</th>
                                <th>Heure</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.map(order => `
                                <tr>
                                    <td>#${order.id}</td>
                                    <td>Table ${order.tableNumber || 'N/A'}</td>
                                    <td>${order.items.length} items</td>
                                    <td>€${parseFloat(order.total).toFixed(2)}</td>
                                    <td><span class="badge badge-${this.getOrderStatusColor(order.status)}">${order.status}</span></td>
                                    <td>${new Date(order.createdAt).toLocaleTimeString()}</td>
                                    <td>
                                        <button class="btn btn-sm btn-primary" onclick="app.viewOrderDetails(${order.id})">Détails</button>
                                        ${order.status === 'new' ? `<button class="btn btn-sm btn-success" onclick="app.updateOrderStatus(${order.id}, 'preparing')">Préparer</button>` : ''}
                                        ${order.status === 'preparing' ? `<button class="btn btn-sm btn-success" onclick="app.updateOrderStatus(${order.id}, 'served')">Servir</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `);

            // Setup socket for real-time updates
            connectSocket(this.hotelId);
            if (socket) {
                socket.on('order:new', (payload) => {
                    this.showOrderBanner(payload);
                    this.loadOrders();
                });
            }
        } catch (error) {
            document.getElementById('app').innerHTML = `<div class="container"><p>Erreur: ${error.message}</p></div>`;
        }
    },

    getOrderStatusColor(status) {
        const colors = {
            'new': 'info',
            'preparing': 'warning',
            'served': 'success',
            'cancelled': 'error'
        };
        return colors[status] || 'gray';
    },

    async loadMenu() {
        document.getElementById('app').innerHTML = this.showLoading();
        
        try {
            await this.ensureHotelId();
            const items = await api.get(`/api/hotels/${this.hotelId}/menu`);
            
            this.renderAdminLayout('Menu', `
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 class="page-title">Menu</h1>
                    </div>
                    <button class="btn btn-primary" onclick="app.showAddMenuItemModal()">Ajouter un item</button>
                </div>
                
                <div class="grid grid-3" id="menu-grid">
                    ${items.map(item => `
                        <div class="card menu-item-card">
                            <div class="menu-item-header">
                                <h3 class="menu-item-title">${item.name}</h3>
                                <div class="menu-item-actions">
                                    <button class="btn btn-sm btn-outline" onclick="app.editMenuItem(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.price}, '${item.category || 'Coffee'}', '${(item.description || '').replace(/'/g, "\\'")}', ${item.available})">Modifier</button>
                                    <button class="btn btn-sm btn-danger" onclick="app.deleteMenuItem(${item.id})">Supprimer</button>
                                </div>
                            </div>
                            <div class="menu-item-body">
                                <p class="menu-item-description">${item.description || ''}</p>
                            </div>
                            <div class="menu-item-footer">
                                <div class="menu-item-badges">
                                    <span class="badge badge-primary">${item.category}</span>
                                    ${!item.available ? '<span class="badge badge-error">Indisponible</span>' : ''}
                                </div>
                                <div class="menu-item-price">€${parseFloat(item.price).toFixed(2)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `);
        } catch (error) {
            document.getElementById('app').innerHTML = `<div class="container"><p>Erreur: ${error.message}</p></div>`;
        }
    },

    async loadProfile() {
        this.renderAdminLayout('Profil', `
            <div class="page-header">
                <h1 class="page-title">Profil</h1>
            </div>
            
            <div class="card">
                <p>Gestion du profil utilisateur</p>
            </div>
        `);
    },

    // Order management methods
    async viewOrderDetails(orderId) {
        try {
            const orders = await api.get(`/api/hotels/${this.hotelId}/orders`);
            const order = orders.find(o => o.id === orderId);
            if (!order) {
                this.showNotification('Commande non trouvée', 'error');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Détails de la commande #${order.id}</h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 1rem;">
                            <p><strong>Table:</strong> ${order.tableNumber || 'N/A'}</p>
                            <p><strong>Statut:</strong> <span class="badge badge-${this.getOrderStatusColor(order.status)}">${order.status}</span></p>
                            <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                        </div>
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Quantité</th>
                                    <th>Prix unitaire</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(order.items || []).map(item => `
                                    <tr>
                                        <td>${item.name || 'N/A'}</td>
                                        <td>${item.qty || item.quantity || 1}</td>
                                        <td>€${parseFloat(item.price || 0).toFixed(2)}</td>
                                        <td>€${(parseFloat(item.price || 0) * (item.qty || item.quantity || 1)).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3" style="text-align: right;"><strong>Total:</strong></td>
                                    <td><strong>€${parseFloat(order.total || 0).toFixed(2)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                        ${order.customerInfo?.note ? `<p style="margin-top: 1rem;"><strong>Note:</strong> ${order.customerInfo.note}</p>` : ''}
                    </div>
                    <div class="modal-footer">
                        ${order.status === 'new' ? `<button class="btn btn-success" onclick="app.updateOrderStatus(${order.id}, 'preparing'); this.closest('.modal-overlay').remove();">Commencer la préparation</button>` : ''}
                        ${order.status === 'preparing' ? `<button class="btn btn-success" onclick="app.updateOrderStatus(${order.id}, 'served'); this.closest('.modal-overlay').remove();">Marquer comme servi</button>` : ''}
                        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    async updateOrderStatus(orderId, status) {
        try {
            await api.put(`/api/hotels/orders/${orderId}/status`, { status });
            this.showNotification('Statut mis à jour', 'success');
            
            // Si on est dans le modal, le fermer et recharger
            const modal = document.querySelector('.table-orders-modal');
            if (modal) {
                setTimeout(() => {
                    modal.remove();
                    this.loadDashboard();
                }, 500);
            } else {
                this.loadOrders();
            }
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    // Table management methods
    async viewQRCode(tableId) {
        try {
            const response = await api.get(`/api/hotels/tables/${this.hotelId}/${tableId}/qrcode`);
            this.showQRCodeModal(response.qrPath);
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    showQRCodeModal(qrPath) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">QR Code</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <img src="${API_BASE_URL}${qrPath}" alt="QR Code" style="width: 100%; max-width: 300px; display: block; margin: 0 auto;">
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="window.open('${API_BASE_URL}${qrPath}', '_blank')">Télécharger</button>
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async deleteTable(tableId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette table?')) return;
        
        try {
            await api.delete(`/api/hotels/${this.hotelId}/tables/${tableId}`);
            this.showNotification('Table supprimée', 'success');
            this.loadTables();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    async deleteMenuItem(itemId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet item?')) return;
        
        try {
            await api.delete(`/api/hotels/${this.hotelId}/menu/${itemId}`);
            this.showNotification('Item supprimé', 'success');
            this.loadMenu();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    showAddTableModal() {
        this.showTableModal(null, null, null);
    },

    editTable(tableId, number, status) {
        this.showTableModal(tableId, number, status);
    },

    showTableModal(tableId, number, status) {
        const isEdit = !!tableId;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'Modifier' : 'Ajouter'} une table</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <form id="table-form" onsubmit="app.handleSaveTable(event, ${tableId || 'null'})">
                        <div class="form-group">
                            <label class="form-label">Numéro de table</label>
                            <input type="number" class="form-input" name="number" value="${number || ''}" min="1" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Statut</label>
                            <select class="form-select" name="status">
                                <option value="idle" ${status === 'idle' ? 'selected' : ''}>Idle</option>
                                <option value="new" ${status === 'new' ? 'selected' : ''}>New</option>
                                <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                                <option value="served" ${status === 'served' ? 'selected' : ''}>Served</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                            <button type="submit" class="btn btn-primary">${isEdit ? 'Modifier' : 'Ajouter'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async handleSaveTable(e, tableId) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            number: parseInt(formData.get('number')),
            status: formData.get('status')
        };

        try {
            if (tableId) {
                await api.put(`/api/hotels/${this.hotelId}/tables/${tableId}`, data);
                this.showNotification('Table modifiée', 'success');
            } else {
                await api.post(`/api/hotels/${this.hotelId}/tables`, data);
                this.showNotification('Table ajoutée', 'success');
            }
            document.querySelector('.modal-overlay')?.remove();
            this.loadTables();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    showAddMenuItemModal() {
        this.showMenuItemModal(null, '', '', 'Coffee', '', true);
    },

    editMenuItem(itemId, name, price, category, description, available) {
        this.showMenuItemModal(itemId, name, price, category, description, available);
    },

    showMenuItemModal(itemId, name, price, category, description, available) {
        const isEdit = !!itemId;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'Modifier' : 'Ajouter'} un item du menu</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <form id="menu-item-form" onsubmit="app.handleSaveMenuItem(event, ${itemId || 'null'})">
                        <div class="form-group">
                            <label class="form-label">Nom</label>
                            <input type="text" class="form-input" name="name" value="${name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Prix (€)</label>
                            <input type="number" class="form-input" name="price" value="${price || ''}" step="0.01" min="0" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Catégorie</label>
                            <select class="form-select" name="category">
                                <option value="Coffee" ${category === 'Coffee' ? 'selected' : ''}>Coffee</option>
                                <option value="Bakery" ${category === 'Bakery' ? 'selected' : ''}>Bakery</option>
                                <option value="Drinks" ${category === 'Drinks' ? 'selected' : ''}>Drinks</option>
                                <option value="Desserts" ${category === 'Desserts' ? 'selected' : ''}>Desserts</option>
                                <option value="Main" ${category === 'Main' ? 'selected' : ''}>Main</option>
                                <option value="Appetizer" ${category === 'Appetizer' ? 'selected' : ''}>Appetizer</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea class="form-textarea" name="description">${description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" name="available" ${available !== false ? 'checked' : ''} style="width: auto;">
                                Disponible
                            </label>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
                            <button type="submit" class="btn btn-primary">${isEdit ? 'Modifier' : 'Ajouter'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async handleSaveMenuItem(e, itemId) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            price: parseFloat(formData.get('price')),
            category: formData.get('category'),
            description: formData.get('description'),
            available: formData.get('available') === 'on'
        };

        try {
            if (itemId) {
                await api.put(`/api/hotels/${this.hotelId}/menu/${itemId}`, data);
                this.showNotification('Item modifié', 'success');
            } else {
                await api.post(`/api/hotels/${this.hotelId}/menu`, data);
                this.showNotification('Item ajouté', 'success');
            }
            document.querySelector('.modal-overlay')?.remove();
            this.loadMenu();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.init();
    });
} else {
    app.init();
}

// Handle hash changes
window.addEventListener('hashchange', () => {
    app.router();
});
