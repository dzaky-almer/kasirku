"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { utils, writeFile } from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface TxnItem {
  productId: string;
  qty: number;
  price: number;
  product?: { name: string };
}

interface Transaction {
  id: string;
  total: number;
  createdAt: string;
  items: TxnItem[];
}

interface Summary {
  totalRevenue: number;
  totalTransactions: number;
  totalItems: number;
}

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function toInputDate(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function LaporanPage() {
  const { data: session, status } = useSession();
  const storeId = (session?.user as any)?.storeId ?? "";

  const [date, setDate] = useState<string>(toInputDate(new Date()));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading" || !storeId) return;
    fetchLaporan(date);
  }, [storeId, status, date]);

  async function fetchLaporan(targetDate: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reports?storeId=${storeId}&date=${targetDate}`);
      if (!res.ok) throw new Error("Gagal fetch laporan");
      const data = await res.json();
      setTransactions(data.transactions ?? []);
      setSummary(data.summary ?? null);
    } catch {
      setError("Gagal memuat laporan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function buildRows() {
    const rows: {
      no: number;
      waktu: string;
      idTrx: string;
      namaProduk: string;
      qty: number;
      harga: number;
      subtotal: number;
    }[] = [];
    let no = 1;
    for (const trx of transactions) {
      for (const item of trx.items) {
        rows.push({
          no: no++,
          waktu: new Date(trx.createdAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          idTrx: trx.id.slice(0, 8),
          namaProduk: item.product?.name ?? "-",
          qty: item.qty,
          harga: item.price,
          subtotal: item.qty * item.price,
        });
      }
    }
    return rows;
  }

  function exportExcel() {
    const rows = buildRows();
    const ws = utils.json_to_sheet(
      rows.map((r) => ({
        No: r.no,
        Waktu: r.waktu,
        "ID Transaksi": r.idTrx,
        "Nama Produk": r.namaProduk,
        Qty: r.qty,
        "Harga Satuan": r.harga,
        Subtotal: r.subtotal,
      }))
    );
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Laporan");
    writeFile(wb, `Laporan_${date}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(13);
    doc.text(`Laporan Penjualan — ${date}`, 14, 15);
    if (summary) {
      doc.setFontSize(10);
      doc.text(
        `Total Omzet: ${formatRupiah(summary.totalRevenue)}   Transaksi: ${summary.totalTransactions}   Item: ${summary.totalItems}`,
        14,
        23
      );
    }
    const rows = buildRows();
    autoTable(doc, {
      head: [["No", "Waktu", "ID Trx", "Nama Produk", "Qty", "Harga", "Subtotal"]],
      body: rows.map((r) => [
        r.no,
        r.waktu,
        r.idTrx,
        r.namaProduk,
        r.qty,
        formatRupiah(r.harga),
        formatRupiah(r.subtotal),
      ]),
      startY: summary ? 30 : 22,
      theme: "grid",
      headStyles: { fillColor: [146, 64, 14] },
      styles: { fontSize: 9 },
    });
    doc.save(`Laporan_${date}.pdf`);
  }

  const rows = buildRows();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-900">Laporan Penjualan</span>
          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              disabled={rows.length === 0}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export Excel
            </button>
            <button
              onClick={exportPDF}
              disabled={rows.length === 0}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export PDF
            </button>
          </div>
        </header>

        <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-4 flex-shrink-0">
          <label className="text-xs text-gray-500">Tanggal</label>
          <input
            type="date"
            value={date}
            max={toInputDate(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 text-sm text-black border border-gray-200 rounded-lg outline-none focus:border-amber-400 transition-colors"
          />
          {summary && (
            <div className="flex items-center gap-4 ml-4">
              <div className="text-xs text-gray-500">
                Omzet: <span className="font-medium text-gray-800">{formatRupiah(summary.totalRevenue)}</span>
              </div>
              <div className="text-xs text-gray-500">
                Transaksi: <span className="font-medium text-gray-800">{summary.totalTransactions}</span>
              </div>
              <div className="text-xs text-gray-500">
                Item: <span className="font-medium text-gray-800">{summary.totalItems}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-5 py-3">NO</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">WAKTU</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">ID TRANSAKSI</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">NAMA PRODUK</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">QTY</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">HARGA</th>
                  <th className="text-left text-[10px] font-medium text-gray-400 tracking-wider px-4 py-3">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                      Memuat laporan...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                      Tidak ada transaksi pada tanggal ini.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={`${r.idTrx}-${r.no}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm text-gray-500">{r.no}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.waktu}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.idTrx}...</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.namaProduk}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.qty}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatRupiah(r.harga)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-amber-700">{formatRupiah(r.subtotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>

              {rows.length > 0 && summary && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={6} className="px-5 py-3 text-xs font-medium text-gray-500 text-right">
                      Total Omzet
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-amber-700">
                      {formatRupiah(summary.totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}