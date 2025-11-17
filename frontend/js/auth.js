// frontend/js/auth.js
// Authentication Helper Functions (vanilla JS)
const auth = {
  tokenKey: 'token',

  isAuthenticated() {
    return !!localStorage.getItem(this.tokenKey);
  },

  getToken() {
    return localStorage.getItem(this.tokenKey);
  },

  setToken(token) {
    if (token) localStorage.setItem(this.tokenKey, token);
  },

  clearToken() {
    localStorage.removeItem(this.tokenKey);
  },

  async login(email, password) {
    console.log('Login attempt:', { email, password: '***' });
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data?.message || data?.error || 'Login failed';
        throw new Error(message);
      }
      // backend likely returns { token: '...' } or { data: { token: '...' } }
      const token = data.token || data?.data?.token;
      if (!token) throw new Error('No token returned');
      this.setToken(token);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  async register(name, email, password) {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Register failed');
    return data;
  },

  logout() {
    this.clearToken();
    if (typeof disconnectSocket === 'function') disconnectSocket();
    window.location.href = '/admin/login.html';
  },
};
