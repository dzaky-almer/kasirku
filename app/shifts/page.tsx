"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Shift {
  id: string;
  opening_cash: number;
  total_sales: number;
}

export default function ShiftsPage() {
  const { data: session } = useSession();
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [notes, setNotes] = useState("");
  

  const fetchShift = async () => {
    const res = await fetch("/api/shifts/current");
    const data = await res.json();
    setOpenShift(data);
  };

  useEffect(() => {
    fetchShift();
  }, []);

const handleOpenShift = async () => {
  const userId = session?.user?.id;
  const storeId = (session?.user as any)?.storeId;

  if (!userId || !storeId) {
    alert("Session belum siap 😭");
    return;
  }

  const res = await fetch("/api/shifts/open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", 
    },
    body: JSON.stringify({
      opening_cash: openingCash,
      userId,
      storeId,
    }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    alert(data?.error || "Gagal buka shift 😭");
    return;
  }

  setOpenShift(data);
};

  const handleCloseShift = async () => {
    if (!openShift) return;

    await fetch("/api/shifts/close", {
      method: "POST",
      body: JSON.stringify({
        shiftId: openShift.id,
        closing_cash: closingCash,
        notes,
      }),
    });

    setOpenShift(null);
  };

  const expected =
    (openShift?.opening_cash || 0) + (openShift?.total_sales || 0);

  const diff = closingCash - (expected || 0);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6 text-gray-900">Shift Kasir</h1>

      {/* OPEN SHIFT */}
      {!openShift && (
        <div className="bg-white shadow-lg rounded-2xl p-6 max-w-md">
          <h2 className="text-lg font-medium mb-4 text-gray-900">Buka Shift</h2>

          <input
            type="number"
            placeholder="Uang awal"
            className="w-full border p-2 rounded mb-4 text-gray-400 focus:text-gray-900 focus:border-amber-400 transition-colors"
            onChange={(e) => setOpeningCash(Number(e.target.value))}
          />

          <button
            onClick={handleOpenShift}
            className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
          >
            Buka Shift
          </button>
        </div>
      )}

      {/* ACTIVE SHIFT */}
      {openShift && (
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* INFO CARD */}
          <div className="bg-white shadow-lg rounded-2xl p-6">
            <h2 className="text-lg font-medium mb-4 text-gray-900">Shift Aktif</h2>

            <div className="space-y-2 text-gray-700">
              <p>
                💰 Opening Cash:{" "}
                <span className="font-semibold">
                  {openShift.opening_cash}
                </span>
              </p>

              <p>
                📈 Total Sales:{" "}
                <span className="font-semibold text-green-600">
                  {openShift.total_sales}
                </span>
              </p>

              <p>
                💵 Expected Cash:{" "}
                <span className="font-semibold">
                  {expected}
                </span>
              </p>
            </div>
          </div>

          {/* CLOSE SHIFT */}
          <div className="bg-white shadow-lg rounded-2xl p-6">
            <h2 className="text-lg font-medium mb-4 text-gray-900">Tutup Shift</h2>

            <input
              type="number"
              placeholder="Uang akhir"
              className="w-full border p-2 rounded mb-3 text-gray-400 focus:text-gray-900 focus:border-amber-400 transition-colors"
              onChange={(e) => setClosingCash(Number(e.target.value))}
            />

            <textarea
              placeholder="Catatan"
              className="w-full border p-2 rounded mb-3 text-gray-400 focus:text-gray-900 focus:border-amber-400 transition-colors"
              onChange={(e) => setNotes(e.target.value)}
            />

            {/* SELISIH */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-gray-700">
              <p>
                Selisih:{" "}
                <span
                  className={`font-bold ${
                    diff < 0 ? "text-red-500" : "text-green-600"
                  }`}
                >
                  {diff}
                </span>
              </p>
            </div>

            <button
              onClick={handleCloseShift}
              className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600"
            >
              Tutup Shift
            </button>
          </div>
        </div>
      )}
    </div>
  );
}