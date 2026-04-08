"use client";

import { useEffect, useState } from "react";

interface Shift {
  id: string;
  opening_cash: number;
  closing_cash: number | null;
  total_sales: number;
  total_transactions: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

export default function ShiftsPage() {
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [notes, setNotes] = useState("");

  // ambil shift aktif
  const fetchShift = async () => {
    const res = await fetch("/api/shifts/current");
    const data = await res.json();
    setOpenShift(data);
  };

  useEffect(() => {
    fetchShift();
  }, []);

  // buka shift
  const openShiftHandler = async () => {
    const res = await fetch("/api/shifts/open", {
      method: "POST",
      body: JSON.stringify({
        opening_cash: openingCash,
        userId: "USER_ID_KAMU"
      })
    });

    const data = await res.json();
    setOpenShift(data);
  };

  // tutup shift
  const closeShiftHandler = async () => {
  if (!openShift) return;

  // 💰 hitung expected cash
  const expected = openShift.opening_cash + openShift.total_sales;

  // 💰 selisih
  const diff = closingCash - expected;

  // tampilkan ke user
  alert(`Selisih kas: ${diff}`);

    const res = await fetch("/api/shifts/close", {
      method: "POST",
      body: JSON.stringify({
        shiftId: openShift?.id,
        closing_cash: closingCash,
        notes
      })
    });

    await res.json();
    setOpenShift(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Shift Kasir</h1>

      {!openShift ? (
        <div>
          <h3>Buka Shift</h3>
          <input
            type="number"
            placeholder="Uang awal"
            onChange={(e) => setOpeningCash(Number(e.target.value))}
          />
          <button onClick={openShiftHandler}>Buka Shift</button>
        </div>
      ) : (
        <div>
          <h3>Shift Aktif</h3>
          <p>Opening Cash: {openShift.opening_cash}</p>

          <h3>Tutup Shift</h3>
          <input
            type="number"
            placeholder="Uang akhir"
            onChange={(e) => setClosingCash(Number(e.target.value))}
          />

          <textarea
            placeholder="Catatan"
            onChange={(e) => setNotes(e.target.value)}
          />

          <button onClick={closeShiftHandler}>Tutup Shift</button>
        </div>
      )}
    </div>
  );
}