// Main Application Router
const app = {
    currentPage: null,
    hotelId: 1, // Demo hotel ID
    publicMenuState: {
        items: [],
        filter: 'all',
        search: ''
    },
    orderFilters: {
        search: '',
        status: 'all'
    },
    selectedOrders: new Set(),

    async init() {
        console.log('App initializing...', window.location.pathname);
        const storedHotelId = parseInt(localStorage.getItem('hotelId') || '1');
        if (!Number.isNaN(storedHotelId)) this.hotelId = storedHotelId;
        await this.ensureHotelContext();
        this.router();
        this.setupEventListeners();
    },

    async ensureHotelContext() {
        // If hotelId already set, keep it
        if (this.hotelId && this.hotelId !== 1) return;
        try {
            const hotels = await api.get('/api/hotels');
            if (hotels && hotels.length) {
                const h = hotels[0];
                this.hotelId = h.id;
                localStorage.setItem('hotelId', String(h.id));
                if (h.slug) {
                    localStorage.setItem('mockHotelSlug', h.slug);
                }
                if (h.name) {
                    localStorage.setItem('mockBusinessName', h.name);
                }
            }
        } catch (err) {
            console.warn('ensureHotelContext failed', err && err.message ? err.message : err);
        }
    },

    router() {
        const path = window.location.pathname;
        const hash = window.location.hash.slice(1) || 'dashboard';
        console.log('Router called:', { path, hash });

        const urlParams = new URLSearchParams(window.location.search);
        const queryMenu = urlParams.get('menu');

        // Public menu (no auth)
        if (path.includes('/menu/') || queryMenu) {
            this.loadPublicMenu();
            return;
        }

        // Auth pages
        if (path.includes('login.html')) {
            this.loadLogin();
            return;
        }
        if (path.includes('register.html')) {
            this.loadRegister();
            return;
        }

        // Admin area
        if (path.includes('/admin/')) {
            // When not authenticated, go to onboarding
        if (!auth.isAuthenticated()) {
            try { localStorage.setItem('useMockBackend', 'true'); } catch {}
            window.location.hash = '#onboarding';
            this.loadOnboarding();
            return;
        }

            // Default hash if none
            const targetHash = hash || 'dashboard';
            switch (targetHash) {
                case 'dashboard':
                    this.loadDashboard();
                    break;
                case 'tables':
                    this.loadTables();
                    break;
                case 'orders':
                    this.loadOrders();
                    break;
                case 'onboarding':
                    this.loadOnboarding();
                    break;
                case 'menu':
                    this.loadMenu();
                    break;
                case 'profile':
                    this.loadProfile();
                    break;
                default:
                    this.loadDashboard();
                    break;
            }
            return;
        }

        // Default to public menu
        window.location.href = '/menu/demo-coffee?table=1';
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

    showLoading() {
        return '<div class="loading"><div class="spinner"></div></div>';
    },

    async loadPublicMenu() {
        console.log('loadPublicMenu called');
        document.getElementById('app').innerHTML = this.showLoading();
        
        const urlParams = new URLSearchParams(window.location.search);
        const tableNumber = parseInt(urlParams.get('table') || '1');
        // Support both /menu/<slug> and root with ?menu=<slug>
        const slugFromQuery = (urlParams.get('menu') || '').trim();
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const slugFromPath = pathParts[0] === 'menu' ? pathParts[1] : pathParts[pathParts.length - 1];
        const hotelSlug = slugFromQuery || slugFromPath;

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
                    <p style="color: var(--text-light); margin-top: 0.5rem; font-size: 0.875rem;">VÃ©rifiez que le serveur backend est dÃ©marrÃ© et que l'hÃ´tel existe.</p>
                </div>
            `;
        }
    },

    renderPublicMenu(hotel, menu, tableNumber) {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const categories = [
            'all',
            ...Array.from(new Set(menu.map(item => (item.category || 'Autres').toLowerCase())))
        ];
        this.publicMenuState = {
            items: menu,
            filter: 'all',
            search: ''
        };
        
        document.getElementById('app').innerHTML = `
            <div class="client-menu">
                <div class="menu-hero" style="background-image: url('/img/headermenu.jpg');">
                    <div class="menu-hero__overlay"></div>
                    <div class="menu-hero__content">
                        <p class="menu-hero__eyebrow">QR Coffee · Table ${tableNumber}</p>
                        <h1 class="menu-hero__title">${hotel.name}</h1>
                        <p class="menu-hero__subtitle">It's a great day for coffee</p>
                        <span class="menu-hero__badge">Commande mobile</span>
                    </div>
                </div>

                <div class="menu-panel">
                    <div class="menu-tabs">
                        ${categories.map(cat => `
                            <button class="menu-tab ${cat === 'all' ? 'active' : ''}" data-filter="${cat}">
                                ${cat === 'all' ? 'Tous' : cat.replace(/_/g, ' ')}
                            </button>
                        `).join('')}
                    </div>

                    <div class="menu-search">
                        <input type="text" id="menu-search" placeholder="Rechercher un cafe, un dessert, etc.">
                        <span class="menu-search__icon">&#128269;</span>
                    </div>

                    <div id="menu-items-container" class="menu-items-grid"></div>
                </div>

                <button class="cart-toggle" onclick="app.toggleCart()">&#128722;
                    ${cart.length > 0 ? `<span class="cart-badge">${cart.reduce((sum, item) => sum + item.quantity, 0)}</span>` : ``}
                </button>
                
                <div class="cart-sidebar" id="cart-sidebar">
                    <div class="cart-header">
                        <h2 class="cart-title">Votre commande</h2>
                        <button onclick="app.toggleCart()" class="modal-close">&times;</button>
                    </div>
                    <div class="cart-body" id="cart-body"></div>
                    <div class="cart-footer" id="cart-footer"></div>
                </div>
            </div>
        `;

        this.setupPublicMenuInteractions();
        this.renderPublicMenuItems();
        this.updateCart();
    },

    setupPublicMenuInteractions() {
        const tabs = document.querySelectorAll('.menu-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.publicMenuState.filter = tab.dataset.filter || 'all';
                this.renderPublicMenuItems();
            });
        });

        const searchInput = document.getElementById('menu-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.publicMenuState.search = e.target.value;
                this.renderPublicMenuItems();
            });
        }
    },

    renderPublicMenuItems() {
        const container = document.getElementById('menu-items-container');
        if (!container) return;
        const { items, filter, search } = this.publicMenuState;
        const searchTerm = search.trim().toLowerCase();

        const filtered = items.filter(item => {
            const matchesFilter = filter === 'all' || (item.category || '').toLowerCase() === filter;
            const matchesSearch = !searchTerm || `${item.name || ''} ${(item.description || '')}`.toLowerCase().includes(searchTerm);
            return matchesFilter && matchesSearch;
        });

        if (!filtered.length) {
            container.innerHTML = `
                <div class="menu-empty">
                    <p>Aucun article ne correspond Ã  votre recherche.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(item => `
            <article class="menu-card ${!item.available ? 'menu-card--disabled' : ''}">
                <div class="menu-card__media">
                    <span>${(item.name || '?').charAt(0)}</span>
                </div>
                <div class="menu-card__info">
                    <div class="menu-card__title-row">
                        <div>
                            <h3 class="menu-card__name">${item.name}</h3>
                            <p class="menu-card__desc">${item.description || 'DÃ©couvrez une saveur artisanale.'}</p>
                        </div>
                        ${item.category ? `<span class="menu-card__chip">${item.category}</span>` : ''}
                    </div>
                    <div class="menu-card__meta">
                        <div class="menu-card__price">€${parseFloat(item.price).toFixed(2)}</div>
                        ${item.available ? `
                            <button class="menu-card__add" onclick="event.stopPropagation(); app.addToCart(${item.id}, '${(item.name || '').replace(/'/g, "\\'")}', ${item.price}, '${(item.description || '').replace(/'/g, "\\'")}')">
                                +
                            </button>
                        ` : '<span class="menu-card__soldout">Indisponible</span>'}
                    </div>
                </div>
            </article>
        `).join('');
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
        this.showNotification(`${name} ajoutÃ© au panier`, 'success');
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
                            <button class="quantity-btn" onclick="app.updateCartQuantity(${item.id}, -1)">-</button>
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
        const slugFromQuery = (urlParams.get('menu') || '').trim();
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const slugFromPath = pathParts[0] === 'menu' ? pathParts[1] : pathParts[pathParts.length - 1];
        const hotelSlug = slugFromQuery || slugFromPath;
        
        // Get hotel ID from menu data
        const menuData = await api.get(`/api/menu/${hotelSlug}`);
        const hotelId = menuData.hotel.id;

        const items = cart.map(item => ({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            qty: item.quantity
        }));
        const total = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);

        try {
            await api.post('/api/order/public', {
                hotelId,
                tableNumber,
                items,
                total,
                customerNote : ''
            });

            localStorage.removeItem('cart');
            this.updateCart();
            this.toggleCart();
            this.showNotification('Commande passÃ©e avec succÃ¨s!', 'success');
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            this.showNotification('Erreur lors de la commande: ' + error.message, 'error');
        }
    },

    // Admin pages will be loaded here
    async loadLogin() {
        const container = document.getElementById('app');
        if (!container) {
            // If the static page doesn't have the #app container, just stop to avoid runtime errors.
            return;
        }
        container.innerHTML = `
            <div class="auth-page auth-page--hero">
                <div class="auth-visual auth-visual--full" style="background-image: url('/img/backlog.jpg');">
                    <div class="auth-visual__overlay"></div>
                    <div class="auth-visual__content">
                        <p class="auth-eyebrow">QR Coffee</p>
                        <h1>Rejoignez votre espace barista</h1>
                        <p>GÃ©rez vos tables, vos commandes et votre menu depuis un seul tableau de bord.</p>
                        <div class="auth-highlights">
                            <span>âš¡ Commandes en temps rÃ©el</span>
                            <span>ðŸ“± QR Codes intelligents</span>
                            <span>ðŸ‘¥ Multi-hÃ´tels</span>
                        </div>
                    </div>
                </div>
                <div class="auth-card auth-card--floating">
                    <div class="auth-card__header">
                        <pa class="auth-card__eyebrow">Tableau de bord</p>
                        <h2>Connexion Admin</h2>
                        <p class="auth-card__subtitle">Renseignez vos accÃ¨s pour continuer</p>
                    </div>
                    <form id="login-form" class="auth-form" onsubmit="app.handleLogin(event)">
                        <label class="auth-label">Email</label>
                        <div class="auth-input">
                            <span>ðŸ“§</span>
                            <input type="email" name="email" value="admin@example.com" required>
                        </div>
                        <label class="auth-label">Mot de passe</label>
                        <div class="auth-input">
                            <span>ðŸ”’</span>
                            <input type="password" name="password" required>
                        </div>
                        <button type="submit" class="auth-submit">Se connecter</button>
                        <p class="auth-demo">DÃ©mo : admin@example.com / password</p>
                        <p class="auth-footer">
                            Pas encore de compte ?
                            <a href="/admin/register.html">CrÃ©er un compte</a>
                        </p>
                    </form>
                </div>
            </div>
        `;
    },

    async loadRegister() {
        const container = document.getElementById('app');
        if (!container) {
            return;
        }
        container.innerHTML = `
            <div class="auth-page auth-page--hero">
                <div class="auth-visual auth-visual--full" style="background-image: url('/img/backlog.jpg');">
                    <div class="auth-visual__overlay"></div>
                    <div class="auth-visual__content">
                        <p class="auth-eyebrow">QR Coffee</p>
                        <h1>CrÃ©ez votre espace barista</h1>
                        <p>Invitez votre Ã©quipe, pilotez vos menus et dÃ©ployez vos QR codes dÃ¨s aujourd'hui.</p>
                        <div class="auth-highlights">
                            <span>ðŸš€ Onboarding rapide</span>
                            <span>ðŸ“Š Statistiques en direct</span>
                            <span>ðŸ” AccÃ¨s sÃ©curisÃ©</span>
                        </div>
                    </div>
                </div>
                <div class="auth-card auth-card--floating">
                    <div class="auth-card__header">
                        <p class="auth-card__eyebrow">Bienvenue</p>
                        <h2>CrÃ©er un compte</h2>
                        <p class="auth-card__subtitle">Renseignez vos informations pour dÃ©marrer</p>
                    </div>
                    <form id="register-form" class="auth-form" onsubmit="app.handleRegister(event)">
                        <label class="auth-label">Nom du business</label>
                        <div class="auth-input">
                            <span>ðŸ�¢</span>
                            <input type="text" name="businessName" placeholder="Ex: Mon CafÃ©" required>
                        </div>
                        <label class="auth-label">Nom</label>
                        <div class="auth-input">
                            <span>ðŸ‘¤</span>
                            <input type="text" name="name" required>
                        </div>
                        <label class="auth-label">Email</label>
                        <div class="auth-input">
                            <span>ðŸ“§</span>
                            <input type="email" name="email" required>
                        </div>
                        <label class="auth-label">Mot de passe</label>
                        <div class="auth-input">
                            <span>ðŸ”’</span>
                            <input type="password" name="password" minlength="6" required>
                        </div>
                        <label class="auth-label">Confirmer le mot de passe</label>
                        <div class="auth-input">
                            <span>ðŸ”’</span>
                            <input type="password" name="confirmPassword" required>
                        </div>
                        <small style="color: var(--text-light); text-align: center;">Minimum 6 caractÃ¨res</small>
                        <button type="submit" class="auth-submit">CrÃ©er le compte</button>
                        <p class="auth-footer">
                            DÃ©jÃ  un compte ?
                            <a href="/admin/login.html">Se connecter</a>
                        </p>
                    </form>
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
        const businessName = (formData.get('businessName') || '').toString().trim() || 'Mon Cafe';

        if (password !== confirmPassword) {
            this.showNotification('Les mots de passe ne correspondent pas', 'error');
            return;
        }

        try {
            const reg = await auth.register(name, email, password);
            this.showNotification('Compte créé avec succès !', 'success');
            if (reg && reg.token) auth.setToken(reg.token);

            try {
                const onboard = await api.post('/api/hotels/onboarding', {
                    businessName,
                    location: '',
                    businessPhone: '',
                    personalPhone: '',
                    tablesCount: 5
                });
                if (onboard?.id) {
                    this.hotelId = onboard.id;
                    localStorage.setItem('hotelId', String(onboard.id));
                }
                if (onboard?.slug) {
                    localStorage.setItem('mockHotelSlug', onboard.slug);
                }
                localStorage.setItem('mockBusinessName', businessName);
                this.showNotification('Business créé', 'success');
            } catch (err) {
                this.showNotification('Compte créé, mais erreur onboarding: ' + (err.message || 'échec'), 'error');
            }

            setTimeout(() => {
                window.location.hash = '#dashboard';
                this.router();
            }, 500);
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
            this.showNotification('Connexion rÃ©ussie', 'success');
            setTimeout(() => {
                window.location.hash = '#dashboard';
                window.location.pathname = '/admin/';
                this.router();
            }, 500);
        } catch (error) {
            this.showNotification('Erreur de connexion: ' + error.message, 'error');
        }
    },

    // Onboarding
    async loadOnboarding() {
        const container = document.getElementById('app');
        if (!container) return;
        const storedName = localStorage.getItem('mockBusinessName') || 'Mon Café';
        const storedSlug = localStorage.getItem('mockHotelSlug') || storedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const storedLocation = localStorage.getItem('mockBusinessLocation') || '';
        const businessPhone = localStorage.getItem('mockBusinessPhone') || '';
        const personalPhone = localStorage.getItem('mockPersonalPhone') || '';
        container.innerHTML = `
            <div class="onboarding-page container">
                <div class="card" style="max-width: 720px; margin: 2rem auto; padding: 2rem;">
                    <h1 style="margin-bottom: 0.5rem;">Paramètres du business</h1>
                    <p style="color: var(--text-light); margin-bottom: 1.5rem;">Renseigne ton établissement pour générer les QR et personnaliser le menu.</p>
                    <form id="onboarding-form">
                        <div class="form-group">
                            <label class="form-label">Nom du business</label>
                            <input type="text" name="businessName" class="form-input" value="${storedName}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Localisation / Adresse</label>
                            <input type="text" name="location" class="form-input" value="${storedLocation}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Téléphone du business</label>
                            <input type="text" name="businessPhone" class="form-input" value="${businessPhone}" placeholder="+33...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Téléphone personnel</label>
                            <input type="text" name="personalPhone" class="form-input" value="${personalPhone}" placeholder="+33...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nombre de tables (1-50)</label>
                            <input type="number" name="tablesCount" class="form-input" value="5" min="1" max="50" required>
                        </div>
                        <div class="form-actions" style="display:flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                            <button type="button" class="btn btn-outline" onclick="window.location.hash='#dashboard'; app.router();">Plus tard</button>
                            <button type="submit" class="btn btn-primary">Valider et créer</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const form = document.getElementById('onboarding-form');
        form?.addEventListener('submit', (e) => this.handleOnboardingSubmit(e));
    },

    async handleOnboardingSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const payload = {
            businessName: formData.get('businessName') || '',
            location: formData.get('location') || '',
            businessPhone: formData.get('businessPhone') || '',
            personalPhone: formData.get('personalPhone') || '',
            tablesCount: parseInt(formData.get('tablesCount') || '5', 10) || 5
        };
        try {
            const res = await api.post('/api/hotels/onboarding', payload);
            // persist for mock/public menu
            if (typeof window.setMockBusinessProfile === 'function') {
                window.setMockBusinessProfile({
                    name: res.name || payload.businessName,
                    slug: res.slug,
                    location: payload.location,
                    businessPhone: payload.businessPhone,
                    personalPhone: payload.personalPhone
                });
            }
            if (res.id) {
                this.hotelId = res.id;
                localStorage.setItem('hotelId', String(res.id));
            }
            if (res.slug) {
                localStorage.setItem('mockHotelSlug', res.slug);
            }
            if (payload.businessName) {
                localStorage.setItem('mockBusinessName', payload.businessName);
            }
            this.showNotification('Business créé', 'success');
            window.location.hash = '#dashboard';
            this.router();
        } catch (err) {
            this.showNotification('Erreur onboarding: ' + (err.message || 'échec'), 'error');
        }
    },
    computeOrderTotal(order) {
        // Use stored total if present; otherwise recompute from items
        if (order && order.total && !isNaN(parseFloat(order.total))) {
            return parseFloat(order.total);
        }
        const items = (order?.items || []).map((it) => ({
            price: parseFloat(it.price || 0),
            qty: it.qty || it.quantity || 1
        }));
        return items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);
    },

    normalizeOrders(orders = []) {
        return (orders || []).map((o) => ({
            ...o,
            total: this.computeOrderTotal(o),
            items: (o.items || []).map((it) => ({
                ...it,
                price: parseFloat(it.price || 0),
                qty: it.qty || it.quantity || 1
            }))
        }));
    },

    // Dashboard, Tables, Orders, Menu, Profile pages will be implemented
    async loadDashboard() {
        document.getElementById('app').innerHTML = this.showLoading();
        
        try {
            const [hotel, tables, ordersRaw] = await Promise.all([
                api.get(`/api/hotels/${this.hotelId}`),
                api.get(`/api/hotels/${this.hotelId}/tables`),
                api.get(`/api/hotels/${this.hotelId}/orders`)
            ]);
            const orders = this.normalizeOrders(ordersRaw);

            // Recompute unread/status from actual orders to avoid stale counters
            const tablesWithOrders = tables.map((table) => {
                const relatedOrders = orders.filter(
                    (o) => o.tableId === table.id || o.tableNumber === table.number
                );
                const unread = relatedOrders.filter((o) => o.status === 'new').length;
                return {
                    ...table,
                    unreadOrders: unread,
                    status: unread > 0 ? 'new' : (table.status || 'idle')
                };
            });

            // Garder la version recalculÃ©e pour d'autres handlers (ex: click sur table)
            this.currentTables = tablesWithOrders;

            const activeTables = tablesWithOrders.filter(t => t.status !== 'idle').length;
            const unreadOrders = tablesWithOrders.reduce((sum, t) => sum + (t.unreadOrders || 0), 0);

            this.renderAdminLayout('Dashboard', `
                <div class="page-header">
                    <h1 class="page-title">Dashboard — ${hotel.name}</h1>
                </div>
                
                <div class="grid grid-4 mb-lg">
                    <div class="card">
                        <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">Tables Actives</h3>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${activeTables}/${tables.length}</div>
                    </div>
                    <div class="card">
                        <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">Nouvelles Commandes</h3>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--error);">${unreadOrders}</div>
                    </div>
                    <div class="card">
                        <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">Temps d'attente</h3>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--warning);">12min</div>
                    </div>
                    <div class="card">
                        <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">Clients Aujourd'hui</h3>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--success);">24</div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Tables Actives</h2>
                    </div>
                    <div class="grid grid-4" id="tables-grid">
                        ${tablesWithOrders.map(table => `
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
            const socketInstance = await connectSocket(this.hotelId);
            socketInstance.off('order:new');
            socketInstance.on('order:new', (payload) => {
                this.showNotification(`Nouvelle commande - Table ${payload.tableNumber}`, 'info');
                this.loadOrders();
            });
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
            // Recupérer toutes les commandes pour cette table
            const orders = this.normalizeOrders(await api.get(`/api/hotels/${this.hotelId}/orders`));
            const tableOrders = orders.filter(order => 
                order.tableId === tableId || order.tableNumber === tableNumber
            ).filter(order => order.status === 'new' || order.status === 'preparing');
            
            if (tableOrders.length === 0) {
                // Si aucune commande rÃ©elle, remettre les compteurs de la table pour ne pas afficher de badge trompeur
                if (Array.isArray(this.currentTables)) {
                    const target = this.currentTables.find(t => t.id === tableId || t.number === tableNumber);
                    if (target) {
                        target.unreadOrders = 0;
                        target.status = 'idle';
                        this.loadOrders();
                    }
                }
                this.showNotification('Aucune commande active pour cette table', 'info');
                return;
            }

            // Creer le modal flottant
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
                                                <th style="padding: 0.5rem; text-align: center; font-weight: 600;">QtÃ©</th>
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
                                        <strong>Note :</strong> ${order.customerInfo.note}
                                    </div>
                                ` : ''}
                                
                                <div style="display: flex; gap: var(--spacing-sm); justify-content: flex-end; margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 2px solid var(--border);">
                                    ${order.status === 'new' ? `
                                        <button class="btn btn-success" onclick="app.confirmOrder(${order.id}, ${tableId}, ${tableNumber})">
                                            âœ“ Confirmer la commande
                                        </button>
                                        <button class="btn btn-primary" onclick="app.updateOrderStatus(${order.id}, 'preparing'); this.closest('.table-orders-modal').remove(); setTimeout(() => app.loadDashboard(), 500);">
                                            Commencer la prÃ©paration
                                        </button>
                                    ` : order.status === 'preparing' ? `
                                        <button class="btn btn-success" onclick="app.updateOrderStatus(${order.id}, 'served'); this.closest('.table-orders-modal').remove(); setTimeout(() => app.loadDashboard(), 500);">
                                            âœ“ Marquer comme servi
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
            
            // Animation d'entrÃ©e
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
            this.showNotification(`Commande #${orderId} confirmÃ©e - Table ${tableNumber}`, 'success');
            
            // Fermer le modal et recharger le dashboard
            document.querySelector('.table-orders-modal')?.remove();
            this.loadOrders();
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
                            <a href="#dashboard" class="navbar-brand">QR Coffee</a>
                            <nav>
                                <ul class="navbar-nav">
                                    <li><a href="#dashboard" class="navbar-link ${currentHash === '#dashboard' ? 'active' : ''}" data-nav="dashboard">Dashboard</a></li>
                                    <li><a href="#tables" class="navbar-link ${currentHash === '#tables' ? 'active' : ''}" data-nav="tables">Tables</a></li>
                                    <li><a href="#orders" class="navbar-link ${currentHash === '#orders' ? 'active' : ''}" data-nav="orders">Commandes</a></li>
                                    <li><a href="#menu" class="navbar-link ${currentHash === '#menu' ? 'active' : ''}" data-nav="menu">Menu</a></li>
                                    <li><a href="#profile" class="navbar-link ${currentHash === '#profile' ? 'active' : ''}" data-nav="profile">Profil</a></li>
                                    <li><a href="#" class="navbar-link" data-logout>Deconnexion</a></li>
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
            const tables = await api.get(`/api/hotels/${this.hotelId}/tables`);
            
            this.renderAdminLayout('Tables', `
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 class="page-title">Tables</h1>
                    </div>
                    <button class="btn btn-primary" onclick="app.showAddTableModal()">Ajouter une table</button>
                </div>
                

                <div class="tables-3d-grid" id="tables-grid">
                    ${tables.map(table => `
                        <article class="table-card ${table.unreadOrders > 0 ? 'table-card--alert' : ''}" data-table-id="${table.id}">
                            ${table.unreadOrders > 0 ? `<span class="table-card__alert">${table.unreadOrders}</span>` : ''}
                            <div class="table-card__header">
                                <div>
                                    <p class="table-card__eyebrow">Table</p>
                                    <h3 class="table-card__title">#${table.number}</h3>
                                </div>
                                <span class="status-chip status-${table.status || 'idle'}">${this.getTableStatusLabel(table.status)}</span>
                            </div>
                            <div class="table-card__visual table-card__visual--img">
                                <img src="/img/cap.png" alt="Table ${table.number}" class="table-illustration">
                            </div>
                            <div class="table-card__stats">
                                <div>
                                    <span class="stat-label">Commandes</span>
                                    <strong>${table.unreadOrders || 0}</strong>
                                </div>
                                <div>
                                    <span class="stat-label">Statut</span>
                                    <strong>${this.getTableStatusLabel(table.status)}</strong>
                                </div>
                                <div>
                                    <span class="stat-label">Identifiant</span>
                                    <strong>#${table.id}</strong>
                                </div>
                            </div>
                            <div class="table-card__actions">
                                <button class="btn btn-sm btn-outline" onclick="app.editTable(${table.id}, ${table.number}, '${table.status || 'idle'}')">Modifier</button>
                                <button class="btn btn-sm btn-outline" onclick="app.viewQRCode(${table.id})">QR Code</button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteTable(${table.id})">Supprimer</button>
                            </div>
                        </article>
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
            // Charger filtres persistés
            if (!this.orderFilters) {
                try {
                    const stored = localStorage.getItem('ordersFilters');
                    this.orderFilters = stored ? JSON.parse(stored) : { search: '', status: 'all' };
                } catch {
                    this.orderFilters = { search: '', status: 'all' };
                }
            }

            const orders = this.normalizeOrders(await api.get(`/api/hotels/${this.hotelId}/orders`));
            this.ordersData = orders; // conserve la liste brute pour filtres/recherche/tri
            this.selectedOrders = this.selectedOrders || new Set();
            const filteredOrders = this.filterOrdersList(orders);
            const hasSelection = this.selectedOrders.size > 0;
            
            this.renderAdminLayout('Commandes', `
                <div class="page-header">
                    <h1 class="page-title">Commandes</h1>
                </div>
                
                <div class="orders-toolbar">
                    <div class="orders-search">
                        <input type="text" id="order-search" placeholder="Rechercher un cafe, un dessert, etc.">
                    </div>
                    <div class="orders-filters">
                        <select id="order-status-filter">
                            <option value="all"${this.orderFilters.status === 'all' ? ' selected' : ''}>Tous les statuts</option>
                            <option value="new"${this.orderFilters.status === 'new' ? ' selected' : ''}>Nouvelles commandes</option>
                            <option value="preparing"${this.orderFilters.status === 'preparing' ? ' selected' : ''}>En prÃ©paration</option>
                            <option value="served"${this.orderFilters.status === 'served' ? ' selected' : ''}>Servies</option>
                            <option value="cancelled"${this.orderFilters.status === 'cancelled' ? ' selected' : ''}>AnnulÃ©es</option>
                        </select>
                    </div>
                    <div class="orders-actions">
                        <button class="btn btn-outline" data-orders-selection ${hasSelection ? '' : 'disabled'} onclick="app.clearOrderSelection()">Tout dÃ©sÃ©lectionner</button>
                        <button class="btn btn-danger" data-orders-selection ${hasSelection ? '' : 'disabled'} onclick="app.deleteSelectedOrders()">Supprimer la sÃ©lection</button>
                    </div>
                </div>
                
                <div class="card">
                    <table class="table orders-table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>ID</th>
                                <th>Table</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Statut</th>
                                <th>Heure</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="orders-table-body">
                            ${filteredOrders.map((order) => this.renderOrderRow(order)).join('')}
                        </tbody>
                    </table>
                </div>
            `);
            
            this.setupOrdersFilters();
            this.renderOrdersTable();
            this.updateOrdersSelectionUI();

            // Setup socket for real-time updates
            const socketInstance = await connectSocket(this.hotelId);
            socketInstance.off('order:new');
            socketInstance.on('order:new', (payload) => {
                this.showNotification(`Nouvelle commande - Table ${payload.tableNumber}`, 'info');
                this.loadOrders();
            });
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

    filterOrdersList(orders) {
        const term = (this.orderFilters.search || '').trim().toLowerCase();
        const status = this.orderFilters.status || 'all';
        const canonicalTerm = term.replace(/\s+/g, '');
        const termIsNumber = term && !isNaN(Number(term));
        const tablePattern = term.match(/^table\s*#?\s*(\d+)/i);
        const tableFromPattern = tablePattern ? Number(tablePattern[1]) : null;
        return orders.filter((order) => {
            const matchesStatus = status === 'all' || order.status === status;
            const items = order.items || [];
            const tableNumber = order.tableNumber || '';
            const blobParts = [
                `${order.id}`,
                order.status || '',
                tableNumber,
                `table${tableNumber}`,
                `table-${tableNumber}`,
                `table #${tableNumber}`,
                parseFloat(order.total || 0).toFixed(2),
                (order.customerInfo && order.customerInfo.note) || '',
                ...items.map((it) => it.name || ''),
            ];
            const blob = blobParts.join(' ').toLowerCase().replace(/\s+/g, '');
            const matchesSearch =
                !term ||
                blob.includes(canonicalTerm) ||
                (termIsNumber && (Number(tableNumber) === Number(term) || Number(order.id) === Number(term))) ||
                (tableFromPattern !== null && Number(tableNumber) === tableFromPattern);
            return matchesStatus && matchesSearch;
        });
    },

    setupOrdersFilters() {
        const searchInput = document.getElementById('order-search');
        const statusFilter = document.getElementById('order-status-filter');
        if (searchInput) {
            searchInput.value = this.orderFilters.search;
            searchInput.addEventListener('input', (e) => {
                this.orderFilters.search = e.target.value;
                localStorage.setItem('ordersFilters', JSON.stringify(this.orderFilters));
                this.renderOrdersTable();
            });
        }
        if (statusFilter) {
            statusFilter.value = this.orderFilters.status;
            statusFilter.addEventListener('change', (e) => {
                this.orderFilters.status = e.target.value;
                localStorage.setItem('ordersFilters', JSON.stringify(this.orderFilters));
                this.renderOrdersTable();
            });
        }
    },

    renderOrdersTable() {
        const tbody = document.getElementById('orders-table-body');
        if (!tbody) return;
        const orders = this.ordersData || [];
        if (!this.selectedOrders) this.selectedOrders = new Set();
        const existingIds = new Set(orders.map(o => o.id));
        this.selectedOrders = new Set(Array.from(this.selectedOrders).filter(id => existingIds.has(id)));
        const filteredOrders = this.filterOrdersList(orders);
        if (!filteredOrders.length) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:1.5rem; color: var(--text-light);">Aucune commande trouvée</td></tr>`;
        } else {
            tbody.innerHTML = filteredOrders.map((order) => this.renderOrderRow(order)).join('');
        }
        this.updateOrdersSelectionUI();
    },

    toggleOrderSelection(orderId, checked) {
        if (!this.selectedOrders) this.selectedOrders = new Set();
        if (checked) {
            this.selectedOrders.add(orderId);
        } else {
            this.selectedOrders.delete(orderId);
        }
        this.renderOrdersTable();
    },

    renderOrderRow(order) {
        const checked = this.selectedOrders && this.selectedOrders.has(order.id);
        return `
            <tr id="order-row-${order.id}" class="${checked ? 'selected-order-row' : ''}">
                <td>
                    <input type="checkbox" class="order-select-checkbox" id="order-select-${order.id}" ${checked ? 'checked' : ''} onchange="app.toggleOrderSelection(${order.id}, this.checked)">
                </td>
                <td>#${order.id}</td>
                <td>Table ${order.tableNumber || 'N/A'}</td>
                <td>${(order.items || []).length} items</td>
                <td>€${parseFloat(order.total).toFixed(2)}</td>
                <td><span class="badge badge-${this.getOrderStatusColor(order.status)}">${order.status}</span></td>
                <td>${order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : ''}</td>
                <td class="orders-row-actions">
                    <button type="button" class="btn btn-sm btn-primary" onclick="app.viewOrderDetails(${order.id})">Détails</button>
                    ${order.status === 'new' ? `<button type="button" class="btn btn-sm btn-success" onclick="app.updateOrderStatus(${order.id}, 'preparing')">Préparer</button>` : ''}
                    ${order.status === 'preparing' ? `<button type="button" class="btn btn-sm btn-success" onclick="app.updateOrderStatus(${order.id}, 'served')">Servir</button>` : ''}
                    <button type="button" class="btn btn-sm btn-danger" onclick="app.deleteOrder(${order.id})">Supprimer</button>
                </td>
            </tr>
        `;
    },

    updateOrdersSelectionUI() {
        const hasSelection = this.selectedOrders && this.selectedOrders.size > 0;
        document.querySelectorAll('[data-orders-selection]').forEach((btn) => {
            btn.disabled = !hasSelection;
        });
    },

    clearOrderSelection() {
        this.selectedOrders = new Set();
        this.renderOrdersTable();
    },

        async deleteSelectedOrders() {
        if (!this.selectedOrders || this.selectedOrders.size === 0) return;
        if (!confirm('Supprimer les commandes sélectionnées ?')) return;
        try {
            const ids = Array.from(this.selectedOrders);
            await Promise.all(ids.map((id) => api.delete(`/api/hotels/orders/${id}`)));
            this.ordersData = (this.ordersData || []).filter(order => !this.selectedOrders.has(order.id));
            this.selectedOrders.clear();
            this.showNotification('Commandes supprimées', 'success');
            this.renderOrdersTable();
            const goOrders = (window.location.hash || '').includes('orders');
            goOrders ? this.loadOrders() : this.loadDashboard();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

        async deleteOrder(orderId) {
        if (!confirm('Supprimer cette commande ?')) return;
        try {
            await api.delete(`/api/hotels/orders/${orderId}`);
            if (this.selectedOrders) this.selectedOrders.delete(orderId);
            this.ordersData = (this.ordersData || []).filter(order => order.id !== orderId);
            this.showNotification('Commande supprimée', 'success');
            this.renderOrdersTable();
            const goOrders = (window.location.hash || '').includes('orders');
            goOrders ? this.loadOrders() : this.loadDashboard();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    getTableStatusLabel(status) {
        const labels = {
            idle: 'Disponible',
            new: 'Nouvelle commande',
            in_progress: 'Service en cours',
            served: 'Servie'
        };
        return labels[status] || 'Disponible';
    },

    async loadMenu() {
        document.getElementById('app').innerHTML = this.showLoading();
        
        try {
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
            const orders = this.normalizeOrders(await api.get(`/api/hotels/${this.hotelId}/orders`));
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
                        <h2 class="modal-title">DÃ©tails de la commande #${order.id}</h2>
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
                                    <th>QuantitÃ©</th>
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
                        ${order.customerInfo?.note ? `<p style="margin-top: 1rem;"><strong>Note :</strong> ${order.customerInfo.note}</p>` : ''}
                    </div>
                    <div class="modal-footer">
                        ${order.status === 'new' ? `<button class="btn btn-success" onclick="app.updateOrderStatus(${order.id}, 'preparing'); this.closest('.modal-overlay').remove();">Commencer la prÃ©paration</button>` : ''}
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
            if (this.ordersData) {
                const target = this.ordersData.find(order => order.id === orderId);
                if (target) target.status = status;
                this.renderOrdersTable();
            }
            const modal = document.querySelector('.table-orders-modal');
            const goOrders = (window.location.hash || '').includes('orders');
            if (modal) {
                setTimeout(() => {
                    modal.remove();
                    goOrders ? this.loadOrders() : this.loadDashboard();
                }, 500);
            } else {
                goOrders ? this.loadOrders() : this.loadDashboard();
            }
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    // Table management methods
    async viewQRCode(tableId) {
        try {
            const response = await api.get(`/api/hotels/tables/${this.hotelId}/${tableId}/qrcode`);
            const qrSrc = response.qrPath || response.url || response.qrUrl || '';
            const targetUrl = response.qrUrl || response.menuUrl || response.url || '';
            this.showQRCodeModal(qrSrc, targetUrl);
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    showQRCodeModal(imagePath, targetUrl) {
        const menuUrl = targetUrl || '';
        const qrImgSrc = imagePath ? this.resolveQrAsset(imagePath) : this.buildQrFromUrl(menuUrl);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">QR Code</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <img src="${qrImgSrc}" alt="QR Code" style="width: 100%; max-width: 300px; display: block; margin: 0 auto;">
                    ${menuUrl ? `<p style="margin-top:1rem; font-size:0.85rem; text-align:center; color:var(--text-light); word-break:break-all;">${menuUrl}</p>` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="window.open('${qrImgSrc}', '_blank')">TÃ©lÃ©charger</button>
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    resolveQrAsset(value) {
        if (!value) return '';
        if (/^https?:\/\//i.test(value)) return value;
        if (/^(data:|blob:)/i.test(value)) return value;
        return `${API_BASE_URL}${value}`;
    },

    buildQrFromUrl(url) {
        if (!url) return '';
        return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(url)}`;
    },

    async deleteTable(tableId) {
        if (!confirm('ÃŠtes-vous sÃ»r de vouloir supprimer cette table?')) return;
        
        try {
            await api.delete(`/api/hotels/${this.hotelId}/tables/${tableId}`);
            this.showNotification('Table supprimÃ©e', 'success');
            this.loadTables();
        } catch (error) {
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    },

    async deleteMenuItem(itemId) {
        if (!confirm('ÃŠtes-vous sÃ»r de vouloir supprimer cet item?')) return;
        
        try {
            await api.delete(`/api/hotels/${this.hotelId}/menu/${itemId}`);
            this.showNotification('Item supprimÃ©', 'success');
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
                            <label class="form-label">NumÃ©ro de table</label>
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
                this.showNotification('Table modifiÃ©e', 'success');
            } else {
                await api.post(`/api/hotels/${this.hotelId}/tables`, data);
                this.showNotification('Table ajoutÃ©e', 'success');
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
                            <label class="form-label">CatÃ©gorie</label>
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
                this.showNotification('Item modifiÃ©', 'success');
            } else {
                await api.post(`/api/hotels/${this.hotelId}/menu`, data);
                this.showNotification('Item ajoutÃ©', 'success');
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


























