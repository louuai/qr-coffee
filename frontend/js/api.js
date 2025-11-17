// API Configuration
const API_BASE_URL = window.location.origin.includes('localhost:3000') 
    ? 'http://localhost:3000' 
    : window.location.origin;
const SOCKET_URL = window.location.origin.includes('localhost:3000')
    ? 'http://localhost:3000'
    : window.location.origin;

// API Helper Functions
const api = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        console.log('API Request:', endpoint, options.method || 'GET');
        console.log('Headers:', headers);
        if (options.body) {
            console.log('Body:', options.body);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        console.log('Response status:', response.status, response.statusText);

        if (response.status === 401) {
            try { localStorage.removeItem('token'); } catch {}
            // If we're in admin area, bounce to login
            if (window.location.pathname.startsWith('/admin')) {
                window.location.href = '/admin/login.html';
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            let error;
            try {
                error = JSON.parse(errorText);
            } catch {
                error = { error: errorText || 'Request failed' };
            }
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

// Socket.io connection
let socket = null;

function connectSocket(hotelId) {
    if (socket) {
        socket.disconnect();
    }
    
    // Load socket.io from CDN if not already loaded
    if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.1/socket.io.min.js';
        document.head.appendChild(script);
        script.onload = () => {
            socket = io(SOCKET_URL, { transports: ['websocket'] });
            socket.emit('joinHotel', hotelId);
            return socket;
        };
    } else {
        socket = io(SOCKET_URL, { transports: ['websocket'] });
        socket.emit('joinHotel', hotelId);
        return socket;
    }
}

function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

