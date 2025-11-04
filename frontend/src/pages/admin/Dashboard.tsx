import React, { useEffect, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

export default function AdminDashboard() {
  const [tables, setTables] = useState<any[]>([]);
  const [hotel, setHotel] = useState<any>(null);
  const hotelId = 1; // demo hotel

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('token');
      const r = await axios.get(`/api/hotels/${hotelId}`, { headers: { Authorization: `Bearer ${token}` } });
      setHotel(r.data);
      const t = await axios.get(`/api/hotels/${hotelId}/tables`, { headers: { Authorization: `Bearer ${token}` } });
      setTables(t.data);
    }
    load();
    const socket = io('/', { transports: ['websocket'] });
    socket.emit('joinHotel', hotelId);
    socket.on('order:new', (payload: any) => {
      // highlight table
      setTables((prev) => prev.map((p) => (p.number === payload.tableNumber ? { ...p, status: 'new', unreadOrders: (p.unreadOrders || 0) + 1 } : p)));
    });
    return () => socket.disconnect();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Admin Dashboard — {hotel?.name}</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
        {tables.map((t) => (
          <div key={t.id} className={`p-3 border rounded ${t.status === 'new' ? 'bg-blue-100' : ''}`}>
            <div>Table {t.number}</div>
            <div className="text-sm text-gray-600">Unread: {t.unreadOrders || 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
