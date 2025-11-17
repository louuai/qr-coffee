import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { AuthProvider } from './contexts/AuthContext';
import { HotelProvider } from './contexts/HotelContext';
import { AppShell } from './components/layout/AppShell';
import MenuPage from './pages/public/Menu';
import AdminLogin from './pages/admin/Login';
import AdminRegister from './pages/admin/Register';
import Dashboard from './pages/admin/Dashboard';
import Tables from './pages/admin/Tables';
import Menu from './pages/admin/Menu';
import Profile from './pages/admin/Profile';
import ProtectedRoute from './components/auth/ProtectedRoute';

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, sans-serif',
  headings: {
    fontFamily: 'Inter, sans-serif',
  },
});

function App() {
  return (
    <BrowserRouter>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications />
        <AuthProvider>
          <HotelProvider>
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/menu/:hotelSlug" element={<MenuPage />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/register" element={<AdminRegister />} />
            
            {/* Admin routes with AppShell */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="tables" element={<Tables />} />
              <Route path="menu" element={<Menu />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            </Routes>
          </HotelProvider>
        </AuthProvider>
      </MantineProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

