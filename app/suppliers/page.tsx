"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useDemoMode } from "@/lib/demo";

interface SessionUser {
  storeId?: string;
}

interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    products: number;
    stockMovements: number;
  };
}

interface SupplierDetail extends Supplier {
  products: Array<{
    id: string;
    name: string;
    stock: number;
    unit: string;
    category?: string | null;
  }>;
  stockMovements: Array<{
    id: string;
    type: "IN" | "OUT" | "ADJUSTMENT";
    reason: string;
    qtyChange: number;
    newStock: number;
    createdAt: string;
    product?: {
      id: string;
      name: string;
      unit: string;
    } | null;
  }>;
}

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function SuppliersPage() {
  const { data: session } = useSession();
  const { demoStoreId, isDemoMode } = useDemoMode();
  const sessionUser = (session?.user ?? {}) as SessionUser;
  const storeId = isDemoMode ? demoStoreId : sessionUser.storeId ?? "";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDetail | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 2200);
  }

  const fetchSuppliers = useCallback(async (nextSelectedId?: string) => {
    if (!storeId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers?storeId=${storeId}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error();
      setSuppliers(data);

      setSelectedId((prev) => nextSelectedId ?? prev ?? data[0]?.id ?? "");
    } catch {
      showToast("Gagal memuat supplier", "err");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const fetchSupplierDetail = useCallback(async (id: string) => {
    if (!id) {
      setSelectedSupplier(null);
      return;
    }

    setDetailLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat detail supplier");
      setSelectedSupplier(data);
    } catch (error) {
      setSelectedSupplier(null);
      showToast(error instanceof Error ? error.message : "Gagal memuat detail supplier", "err");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!storeId) {
      setSuppliers([]);
      setSelectedSupplier(null);
      return;
    }

    fetchSuppliers();
  }, [fetchSuppliers, storeId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedSupplier(null);
      return;
    }

    fetchSupplierDetail(selectedId);
  }, [fetchSupplierDetail, selectedId]);

  function openCreateModal() {
    setEditingSupplier(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
    });
    setShowModal(true);
  }

  async function handleSaveSupplier() {
    if (!storeId || !form.name.trim()) return;

    setLoading(true);
    try {
      const payload = {
        storeId,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };

      const res = await fetch(
        editingSupplier ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers",
        {
          method: editingSupplier ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan supplier");

      const nextSelectedId = editingSupplier?.id ?? data?.id ?? selectedId;
      setShowModal(false);
      setForm(emptyForm);
      await fetchSuppliers(nextSelectedId);
      await fetchSupplierDetail(nextSelectedId);
      showToast(editingSupplier ? "Supplier diperbarui" : "Supplier ditambahkan");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menyimpan supplier", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(supplier: Supplier) {
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !supplier.isActive }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal memperbarui status supplier");

      await fetchSuppliers(supplier.id);
      await fetchSupplierDetail(supplier.id);
      showToast(supplier.isActive ? "Supplier dinonaktifkan" : "Supplier diaktifkan");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memperbarui supplier", "err");
    }
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    const confirmed = window.confirm(`Hapus supplier ${supplier.name}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus supplier");

      const nextSuppliers = suppliers.filter((item) => item.id !== supplier.id);
      setSuppliers(nextSuppliers);
      const nextSelectedId = nextSuppliers[0]?.id ?? "";
      setSelectedId(nextSelectedId);
      showToast("Supplier dihapus");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menghapus supplier", "err");
    }
  }

  const filteredSuppliers = suppliers
    .filter((supplier) => {
      const matchSearch =
        supplier.name.toLowerCase().includes(search.toLowerCase()) ||
        (supplier.phone ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (supplier.email ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && supplier.isActive) ||
        (statusFilter === "inactive" && !supplier.isActive);
      return matchSearch && matchStatus;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeCount = suppliers.filter((supplier) => supplier.isActive).length;
  const totalProducts = suppliers.reduce((sum, supplier) => sum + (supplier._count?.products ?? 0), 0);

  return (
    <div className="flex-1 min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Master Supplier</h1>
            <p className="text-sm text-gray-400 mt-1">Kelola supplier, relasi produk, dan riwayat stok terbaru.</p>
          </div>
          <button onClick={openCreateModal} className="px-4 py-2 text-sm font-medium text-white bg-amber-700 rounded-xl hover:bg-amber-800 transition-colors">
            Tambah Supplier
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total supplier", value: suppliers.length, sub: "master data" },
            { label: "Supplier aktif", value: activeCount, sub: "siap dipakai" },
            { label: "Produk terkait", value: totalProducts, sub: "produk terhubung" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400">{card.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[380px,1fr] gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari supplier..."
                  className="flex-1 px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-xl outline-none focus:border-amber-400"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
                  className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400"
                >
                  <option value="all">Semua</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>
              <p className="text-xs text-gray-400">{filteredSuppliers.length} supplier ditemukan</p>
            </div>

            <div className="max-h-[620px] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-sm text-gray-400 text-center">Memuat supplier...</div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="p-6 text-sm text-gray-400 text-center">Belum ada supplier yang cocok.</div>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    onClick={() => setSelectedId(supplier.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                      selectedId === supplier.id ? "bg-amber-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{supplier.name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {supplier.phone || supplier.email || "Belum ada kontak"}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        supplier.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {supplier.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                      <span>{supplier._count?.products ?? 0} produk</span>
                      <span>{supplier._count?.stockMovements ?? 0} pergerakan</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            {detailLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">Memuat detail supplier...</div>
            ) : !selectedSupplier ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">Pilih supplier untuk melihat detail.</div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">{selectedSupplier.name}</h2>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        selectedSupplier.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {selectedSupplier.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {selectedSupplier.phone || selectedSupplier.email || "Kontak belum diisi"}
                    </p>
                    {selectedSupplier.address ? (
                      <p className="text-sm text-gray-500 mt-2">{selectedSupplier.address}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditModal(selectedSupplier)} className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50">
                      Edit
                    </button>
                    <button onClick={() => handleToggleActive(selectedSupplier)} className="px-3 py-2 text-sm text-amber-800 border border-amber-200 rounded-xl hover:bg-amber-50">
                      {selectedSupplier.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button onClick={() => handleDeleteSupplier(selectedSupplier)} className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50">
                      Hapus
                    </button>
                  </div>
                </div>

                {selectedSupplier.notes ? (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">Catatan</p>
                    <p className="text-sm text-gray-700">{selectedSupplier.notes}</p>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-400">Produk terhubung</p>
                    <p className="text-xl font-semibold text-gray-900 mt-1">{selectedSupplier.products.length}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-400">Riwayat stok terbaru</p>
                    <p className="text-xl font-semibold text-gray-900 mt-1">{selectedSupplier.stockMovements.length}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500">Produk Supplier</p>
                      <span className="text-[10px] text-gray-400">{selectedSupplier.products.length} item</span>
                    </div>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {selectedSupplier.products.length === 0 ? (
                        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-400">Belum ada produk yang memakai supplier ini.</div>
                      ) : (
                        selectedSupplier.products.map((product) => (
                          <div key={product.id} className="border border-gray-100 rounded-xl p-3">
                            <p className="text-sm font-medium text-gray-800">{product.name}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {product.category || "Tanpa kategori"} · {product.stock} {product.unit}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500">Riwayat Stok</p>
                      <span className="text-[10px] text-gray-400">10 terbaru</span>
                    </div>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {selectedSupplier.stockMovements.length === 0 ? (
                        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-400">Belum ada pergerakan stok dari supplier ini.</div>
                      ) : (
                        selectedSupplier.stockMovements.map((movement) => (
                          <div key={movement.id} className="border border-gray-100 rounded-xl p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{movement.product?.name ?? "Produk"}</p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {movement.reason} · {new Date(movement.createdAt).toLocaleString("id-ID")}
                                </p>
                              </div>
                              <span className={`text-xs font-semibold ${
                                movement.qtyChange >= 0 ? "text-emerald-600" : "text-red-500"
                              }`}>
                                {movement.qtyChange >= 0 ? "+" : ""}{movement.qtyChange}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2">Stok akhir {movement.newStock}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-[460px]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-gray-900">
                {editingSupplier ? "Edit Supplier" : "Tambah Supplier"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">x</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nama supplier</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-xl outline-none focus:border-amber-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="Telepon"
                  className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-xl outline-none focus:border-amber-400"
                />
                <input
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="Email"
                  className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-xl outline-none focus:border-amber-400"
                />
              </div>
              <input
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Alamat"
                className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-xl outline-none focus:border-amber-400"
              />
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Catatan"
                className="w-full px-3 py-2 text-sm text-black border border-gray-200 rounded-xl outline-none focus:border-amber-400 resize-none"
              />
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleSaveSupplier} disabled={loading || !form.name.trim()} className="flex-1 py-2 text-sm text-white bg-amber-700 rounded-xl hover:bg-amber-800 disabled:opacity-40">
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-white text-xs px-4 py-2.5 rounded-full z-50 ${toast.type === "err" ? "bg-red-500" : "bg-gray-900"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
