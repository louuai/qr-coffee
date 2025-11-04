import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';

export default function MenuPage() {
  const { hotelSlug } = useParams();
  const [q] = useSearchParams();
  const table = Number(q.get('table') || 1);
  const [menu, setMenu] = useState<any[]>([]);
  const [hotel, setHotel] = useState<any>(null);

  useEffect(() => {
    axios.get(`/api/menu/${hotelSlug}`).then((r) => {
      setHotel(r.data.hotel);
      setMenu(r.data.menu || []);
    });
  }, [hotelSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{hotel?.name || 'Menu'}</h1>
      <div className="mt-4">Table: <strong>{table}</strong></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {menu.map((m) => (
          <div key={m.id} className="p-4 border rounded">
            <div className="font-semibold">{m.name} — ${m.price}</div>
            <div className="text-sm text-gray-600">{m.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
