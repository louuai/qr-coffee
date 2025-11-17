// Simple API helper (frontend-backup)
// - Uses local mock data by default (no backend needed)
// - You can disable the mock via window.setUseMockBackend(false)

const { protocol, hostname } = window.location;
const storedApiBase = (localStorage.getItem('apiBaseUrl') || '').trim();
const configuredApiBase = (window.API_BASE_URL || storedApiBase || '').trim();

const safeProtocol = protocol.startsWith('http') ? protocol : 'http:';
// API backend par défaut sur port 3000 (à ajuster via setApiBaseUrl si besoin)
const safeHost = hostname || 'localhost';
const defaultPort = 3000;
const API_BASE_URL = configuredApiBase || `${safeProtocol}//${safeHost}:${defaultPort}`;
const SOCKET_URL = API_BASE_URL;

let mockMode = false;
// Mode mock activé par défaut (évite les erreurs si le backend n'est pas lancé).
// Pour forcer le backend réel : setUseMockBackend(false) dans la console.
const storedUseMock = localStorage.getItem('useMockBackend');
const useMockFlag = typeof window !== 'undefined' && window.FORCE_MOCK_API
  ? true
  : storedUseMock === 'false'
    ? false
    : true;

console.log('API_BASE_URL resolved to:', API_BASE_URL);
if (useMockFlag) console.log('Mock backend actif (useMockBackend=true)');

const getMockHotelSlug = () => {
  return (localStorage.getItem('mockHotelSlug') || defaultMockState.hotels[0].slug || 'demo-coffee').trim();
};
const getMockBusinessName = () => {
  return (localStorage.getItem('mockBusinessName') || defaultMockState.hotels[0].name || 'Demo Coffee').trim();
};
const getMenuBaseUrl = () => {
  return (localStorage.getItem('mockMenuBase') || window.location.origin || 'http://localhost:5173').replace(/\/admin.*/i, '');
};

// --- Mock data/state ---
const MOCK_STORAGE_KEY = 'mockBackendDataV1';
const mockUserKey = () => (localStorage.getItem('userEmail') || 'default').toLowerCase();
const mockKey = () => `${MOCK_STORAGE_KEY}:${mockUserKey()}`;
const defaultMockState = {
  hotels: [{ id: 1, slug: 'demo-coffee', name: 'Demo Coffee', description: 'Cafe demo', phone: '+00 000 000', address: '123 Demo St', location: '123 Demo St', businessPhone: '+00 000 000', personalPhone: '+00 000 000' }],
  tables: [
    { id: 1, hotelId: 1, number: 1, status: 'idle', unreadOrders: 0 },
    { id: 2, hotelId: 1, number: 2, status: 'new', unreadOrders: 1 },
  ],
  menu: [
    { id: 1, hotelId: 1, name: 'Espresso', price: 2.5, category: 'coffee', description: 'Court et serre', available: true },
    { id: 2, hotelId: 1, name: 'Cappuccino', price: 3.5, category: 'coffee', description: 'Avec mousse', available: true },
    { id: 3, hotelId: 1, name: 'Cheesecake', price: 4.0, category: 'dessert', description: 'Classique', available: true },
  ],
  orders: [
    {
      id: 1,
      hotelId: 1,
      tableId: 2,
      tableNumber: 2,
      status: 'new',
      total: 7.0,
      unread: true,
      customerInfo: { note: 'Sucre en plus' },
      items: [
        { name: 'Espresso', price: 2.5, qty: 1 },
        { name: 'Cappuccino', price: 3.5, qty: 1 },
      ],
      createdAt: new Date().toISOString(),
    },
  ],
  nextIds: { hotel: 2, table: 3, order: 2, menu: 4 },
};

const mockApi = {
  load() {
    try {
      // If user-specific key is available, clean legacy shared key to isolate data
      const userKey = mockUserKey();
      if (userKey !== 'default' && localStorage.getItem(MOCK_STORAGE_KEY)) {
        localStorage.removeItem(MOCK_STORAGE_KEY);
      }
      const raw = localStorage.getItem(mockKey());
      if (!raw) {
        const base = JSON.parse(JSON.stringify(defaultMockState));
        base.hotels[0].slug = getMockHotelSlug();
        base.hotels[0].name = getMockBusinessName();
        return base;
      }
      const parsed = JSON.parse(raw);
      const merged = { ...defaultMockState, ...parsed };
      if (merged.hotels?.[0]) {
        merged.hotels[0].slug = getMockHotelSlug();
        merged.hotels[0].name = getMockBusinessName();
      }
      return merged;
    } catch {
      const base = JSON.parse(JSON.stringify(defaultMockState));
      base.hotels[0].slug = getMockHotelSlug();
      base.hotels[0].name = getMockBusinessName();
      return base;
    }
  },
  save(state) {
    localStorage.setItem(mockKey(), JSON.stringify(state));
  },
  parseBody(raw) {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  },
  slugify(name) {
    return (name || 'business')
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'business';
  },
  defaultMenuUrl(tableNumber = 1) {
    const baseUrl = getMenuBaseUrl();
    const hotelSlug = getMockHotelSlug() || 'demo-coffee';
    // Use root + query to avoid server-side routing requirements
    return `${baseUrl}/?menu=${encodeURIComponent(hotelSlug)}&table=${tableNumber}`;
  },
  qrForTable(tableNumber = 1) {
    const target = this.defaultMenuUrl(tableNumber);
    return {
      qrUrl: target,
      url: `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(target)}`,
      qrPath: `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(target)}`,
    };
  },
  handle(endpoint, method = 'GET', rawBody) {
    const body = this.parseBody(rawBody);
    const state = this.load();
    const notFound = () => { throw new Error('Mock API: endpoint non géré (' + endpoint + ')'); };

    // Auth
    if (endpoint.startsWith('/api/auth/login')) {
      return { token: 'mock-token', user: { id: 1, name: 'Demo Admin', email: body.email || 'demo@example.com' } };
    }
    if (endpoint.startsWith('/api/auth/register')) {
      return { token: 'mock-token', user: { id: 1, name: body.name || 'Demo Admin', email: body.email } };
    }

    // Onboarding (mock)
    if (endpoint.startsWith('/api/hotels/onboarding')) {
      const name = body.businessName || 'Mon Cafe';
      const slug = body.slug || this.slugify(name);
      const state = this.load();
      const id = state.nextIds.hotel++ || 1;
      const tablesCount = Number(body.tablesCount || 5);
      const hotel = {
        id,
        slug,
        name,
        address: body.location || '',
        location: body.location || '',
        businessPhone: body.businessPhone || '',
        personalPhone: body.personalPhone || '',
        tablesCount,
        ownerId: 1,
      };
      state.hotels.push(hotel);
      for (let i = 1; i <= tablesCount; i++) {
        state.tables.push({ id: state.nextIds.table++, hotelId: id, number: i, status: 'idle', unreadOrders: 0 });
      }
      this.save(state);
      return { id, slug, name };
    }

    // Hotels list (mock, scoped to single user context)
    if (endpoint === '/api/hotels' && method === 'GET') {
      const state = this.load();
      return state.hotels;
    }

    // Tables by hotel (mock)
    const hotelTablesMatch = endpoint.match(/^\/api\/hotels\/(\d+)\/tables$/);
    if (hotelTablesMatch && method === 'GET') {
      const hotelId = Number(hotelTablesMatch[1]);
      const state = this.load();
      return state.tables.filter((t) => t.hotelId === hotelId);
    }

    // Orders by hotel (mock)
    const hotelOrdersMatch = endpoint.match(/^\/api\/hotels\/(\d+)\/orders$/);
    if (hotelOrdersMatch && method === 'GET') {
      const hotelId = Number(hotelOrdersMatch[1]);
      const state = this.load();
      return state.orders.filter((o) => o.hotelId === hotelId);
    }

    // Public menu
    const menuMatch = endpoint.match(/^\/api\/menu\/(.+)/);
    if (menuMatch && method === 'GET') {
      const hotel = state.hotels.find((h) => h.slug === menuMatch[1]) || state.hotels[0];
      if (!hotel) notFound();
      return { hotel, menu: state.menu.filter((m) => m.hotelId === hotel.id) };
    }

    // Hotel details
    const hotelMatch = endpoint.match(/^\/api\/hotels\/(\d+)$/);
    if (hotelMatch && method === 'GET') {
      const hotelId = Number(hotelMatch[1]);
      const hotel = state.hotels.find((h) => h.id === hotelId);
      if (!hotel) notFound();
      return hotel;
    }

    // Tables
    const tablesMatch = endpoint.match(/^\/api\/hotels\/(\d+)\/tables$/);
    if (tablesMatch) {
      const hotelId = Number(tablesMatch[1]);
      if (method === 'GET') return state.tables.filter((t) => t.hotelId === hotelId);
      if (method === 'POST') {
        const newTable = {
          id: state.nextIds.table++,
          hotelId,
          number: Number(body.number) || state.nextIds.table,
          status: body.status || 'idle',
          unreadOrders: 0,
        };
        state.tables.push(newTable);
        this.save(state);
        return newTable;
      }
    }

    const tableMatch = endpoint.match(/^\/api\/hotels\/(\d+)\/tables\/(\d+)$/);
    if (tableMatch) {
      const tableId = Number(tableMatch[2]);
      const table = state.tables.find((t) => t.id === tableId);
      if (!table) notFound();
      if (method === 'PUT') {
        Object.assign(table, body);
        this.save(state);
        return table;
      }
      if (method === 'DELETE') {
        state.tables = state.tables.filter((t) => t.id !== tableId);
        this.save(state);
        return { success: true };
      }
    }

    // Menu CRUD
    const hotelMenuMatch = endpoint.match(/^\/api\/hotels\/(\d+)\/menu$/);
    if (hotelMenuMatch) {
      const hotelId = Number(hotelMenuMatch[1]);
      if (method === 'GET') return state.menu.filter((m) => m.hotelId === hotelId);
      if (method === 'POST') {
        const newItem = { id: state.nextIds.menu++, hotelId, available: true, ...body };
        state.menu.push(newItem);
        this.save(state);
        return newItem;
      }
    }

    const menuItemMatch = endpoint.match(/^\/api\/hotels\/(\d+)\/menu\/(\d+)$/);
    if (menuItemMatch) {
      const itemId = Number(menuItemMatch[2]);
      const item = state.menu.find((m) => m.id === itemId);
      if (!item) notFound();
      if (method === 'PUT') {
        Object.assign(item, body);
        this.save(state);
        return item;
      }
      if (method === 'DELETE') {
        state.menu = state.menu.filter((m) => m.id !== itemId);
        this.save(state);
        return { success: true };
      }
    }

    // Orders
    const ordersMatch = endpoint.match(/^\/api\/hotels\/(\d+)\/orders$/);
    if (ordersMatch && method === 'GET') return state.orders.filter((o) => o.hotelId === Number(ordersMatch[1]));

    const orderStatusMatch = endpoint.match(/^\/api\/hotels\/orders\/(\d+)\/status$/);
    if (orderStatusMatch && method === 'PUT') {
      const orderId = Number(orderStatusMatch[1]);
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) notFound();
      order.status = body.status || order.status;
      if (order.status === 'served') {
        const table = state.tables.find((t) => t.id === order.tableId);
        if (table) table.unreadOrders = Math.max((table.unreadOrders || 1) - 1, 0);
      }
      this.save(state);
      return order;
    }

    const orderDeleteMatch = endpoint.match(/^\/api\/hotels\/orders\/(\d+)$/);
    if (orderDeleteMatch && method === 'DELETE') {
      const orderId = Number(orderDeleteMatch[1]);
      state.orders = state.orders.filter((o) => o.id !== orderId);
      this.save(state);
      return { success: true };
    }

    // Public order creation
    if (endpoint.startsWith('/api/order/public') && method === 'POST') {
      const tableNumber = Number(body.tableNumber || 1);
      const hotelId = Number(body.hotelId || 1);
      const table = state.tables.find((t) => t.number === tableNumber && t.hotelId === hotelId);
      const items = (body.items || []).map((it) => ({
        ...it,
        price: parseFloat(it.price || 0),
        qty: it.qty || it.quantity || 1
      }));
      const computedTotal = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0);
      const newOrder = {
        id: state.nextIds.order++,
        hotelId,
        tableId: table ? table.id : null,
        tableNumber,
        status: 'new',
        total: body.total || computedTotal,
        items,
        customerInfo: body.customerInfo || {},
        createdAt: new Date().toISOString(),
      };
      state.orders.push(newOrder);
      if (table) {
        table.unreadOrders = (table.unreadOrders || 0) + 1;
        table.status = 'new';
      }
      this.save(state);
      return { success: true, order: newOrder };
    }

    // QR code endpoint
    const qrMatch = endpoint.match(/^\/api\/hotels\/tables\/(\d+)\/(\d+)\/qrcode$/);
    if (qrMatch && method === 'GET') {
      const tableNumber = Number(qrMatch[2]);
      return this.qrForTable(tableNumber);
    }

    return notFound();
  },
};

// Helpers to toggle config from console
window.setApiBaseUrl = function (url) {
  try {
    if (url) localStorage.setItem('apiBaseUrl', url);
    else localStorage.removeItem('apiBaseUrl');
    window.location.reload();
  } catch (err) {
    console.error('Failed to persist apiBaseUrl override', err);
  }
};

window.setUseMockBackend = function (value) {
  try {
    localStorage.setItem('useMockBackend', value ? 'true' : 'false');
    window.location.reload();
  } catch (err) {
    console.error('Failed to set useMockBackend', err);
  }
};

// Modifier dynamiquement le slug de l'hôtel mock (pour tester plusieurs admins/menus)
window.setMockHotelSlug = function (slug) {
  try {
    if (slug) {
      localStorage.setItem('mockHotelSlug', slug);
    } else {
      localStorage.removeItem('mockHotelSlug');
    }
    window.location.reload();
  } catch (err) {
    console.error('Failed to set mockHotelSlug', err);
  }
};

// Définir le profil business mock (nom, slug, contacts)
window.setMockBusinessProfile = function ({ name, slug, location, businessPhone, personalPhone } = {}) {
  try {
    if (name) localStorage.setItem('mockBusinessName', name);
    if (slug) localStorage.setItem('mockHotelSlug', slug);
    if (location) localStorage.setItem('mockBusinessLocation', location);
    if (businessPhone) localStorage.setItem('mockBusinessPhone', businessPhone);
    if (personalPhone) localStorage.setItem('mockPersonalPhone', personalPhone);
    window.location.reload();
  } catch (err) {
    console.error('Failed to set mockBusinessProfile', err);
  }
};

// Définir la base publique pour les liens/QR (ex: http://localhost:3000 si tu utilises le serveur statique)
window.setMockMenuBase = function (baseUrl) {
  try {
    if (baseUrl) {
      localStorage.setItem('mockMenuBase', baseUrl.replace(/\/$/, ''));
    } else {
      localStorage.removeItem('mockMenuBase');
    }
    window.location.reload();
  } catch (err) {
    console.error('Failed to set mockMenuBase', err);
  }
};

// API helper
const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (useMockFlag) {
      mockMode = true;
      window.MOCK_API_ACTIVE = true;
      return mockApi.handle(endpoint, options.method || 'GET', options.body);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try { error = JSON.parse(errorText); } catch { error = { error: errorText || 'Request failed' }; }
        throw new Error(error.error || 'Request failed');
      }
      return response.json();
    } catch (err) {
      console.warn('API request failed, fallback mock:', err.message || err);
      mockMode = true;
      window.MOCK_API_ACTIVE = true;
      try { localStorage.setItem('useMockBackend', 'true'); } catch {}
      return mockApi.handle(endpoint, options.method || 'GET', options.body);
    }
  },
  get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
  post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); },
  put(endpoint, data) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
};

// Socket.io connection
let socket = null;
function connectSocket(hotelId) {
  if (mockMode) {
    return Promise.resolve({ on() {}, off() {}, emit() {}, disconnect() {} });
  }
  return new Promise((resolve) => {
    const init = () => {
      if (socket) socket.disconnect();
      socket = io(SOCKET_URL, { transports: ['websocket'] });
      socket.emit('joinHotel', hotelId);
      resolve(socket);
    };
    if (typeof io === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.1/socket.io.min.js';
      document.head.appendChild(script);
      script.onload = init;
    } else {
      init();
    }
  });
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
