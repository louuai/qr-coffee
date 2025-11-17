// Authentication Helper Functions
const auth = {
    isAuthenticated() {
        return !!localStorage.getItem('token');
    },

    getToken() {
        return localStorage.getItem('token');
    },

    setToken(token) {
        localStorage.setItem('token', token);
    },

    clearToken() {
        localStorage.removeItem('token');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('hotelId');
        localStorage.removeItem('mockHotelSlug');
        localStorage.removeItem('mockBusinessName');
    },

    async login(email, password) {
        console.log('Login attempt:', { email, password: '***' });
        try {
            const response = await api.post('/api/auth/login', { email, password });
            console.log('Login success:', response);
            this.setToken(response.token);
            if (response.user?.email || email) {
                localStorage.setItem('userEmail', response.user?.email || email);
            }
            return response;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async register(name, email, password) {
        const response = await api.post('/api/auth/register', { name, email, password });
        if (response.token) {
            this.setToken(response.token);
        }
        if (response.user?.email || email) {
            localStorage.setItem('userEmail', response.user?.email || email);
        }
        return response;
    },

    logout() {
        this.clearToken();
        // Disconnect socket if exists
        if (typeof disconnectSocket === 'function') {
            disconnectSocket();
        }
        window.location.href = '/admin/login.html';
    }
};
