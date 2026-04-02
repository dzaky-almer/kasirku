"use client";

import { useState } from "react";
import { utils, writeFile } from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Transaction {
  item: string;
  time: string;
  qty: number;
  amount: number;
}

const sampleTransactions: Transaction[] = [
  { item: "Kopi Susu Gula Aren", time: "14:22", qty: 2, amount: 54000 },
  { item: "Americano Hot", time: "13:58", qty: 1, amount: 28000 },
  { item: "Matcha Latte + Croissant", time: "13:11", qty: 2, amount: 78000 },
  { item: "Es Kopi Hitam", time: "12:45", qty: 3, amount: 63000 },
  { item: "Cappuccino", time: "12:10", qty: 1, amount: 32000 },
];

function formatRupiah(amount: number) {
  return "Rp " + amount.toLocaleString("id-ID");
}

export default function LaporanPage() {
  const [transactions, setTransactions] = useState(sampleTransactions);

  const exportExcel = () => {
    const ws = utils.json_to_sheet(
      transactions.map((t, i) => ({
        No: i + 1,
        Produk: t.item,
        Waktu: t.time,
        Qty: t.qty,
        Total: t.amount,
      }))
    );
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Laporan");
    writeFile(wb, "Laporan_Transaksi.xlsx");
  };

  const exportPDF = () => {
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text("Laporan Transaksi", 14, 15);

  // ⚡ Perbaikan: pakai autoTable(doc, {...})
  autoTable(doc, {
    head: [["No", "Produk", "Waktu", "Qty", "Total"]],
    body: transactions.map((t, i) => [
      i + 1,
      t.item,
      t.time,
      t.qty,
      formatRupiah(t.amount),
    ]),
    startY: 20,
    theme: "grid",
    headStyles: { fillColor: [250, 204, 21] },
    styles: { fontSize: 10 },
  });

  doc.save("Laporan_Transaksi.pdf");
};

  return (
    <div className="p-5">
      <h1 className="text-lg text-black font-medium mb-4">Laporan Penjualan</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={exportExcel}
          className="px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors"
        >
          Export Excel
        </button>
        <button
          onClick={exportPDF}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Export PDF
        </button>
      </div>

      <table className="w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-gray-100 text-xs text-gray-600">
          <tr>
            <th className="px-3 py-2">No</th>
            <th className="px-3 py-2">Produk</th>
            <th className="px-3 py-2">Waktu</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Total</th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-gray-50">
          {transactions.map((t, i) => (
            <tr key={i} className="hover:bg-gray-50 text-black">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{t.item}</td>
              <td className="px-3 py-2">{t.time}</td>
              <td className="px-3 py-2">{t.qty}</td>
              <td className="px-3 py-2">{formatRupiah(t.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}