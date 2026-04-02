"use client"
import { useState } from "react"

type Product = {
  id: number
  name: string
  price: number
  stock: number
}

export default function ProdukPage() {
  const [products, setProducts] = useState<Product[]>([
    { id: 1, name: "Kopi", price: 10000, stock: 10 },
    { id: 2, name: "Teh", price: 8000, stock: 3 },
    { id: 3, name: "Roti", price: 5000, stock: 0 },
  ])

  return (
    <div className="bg-[#0f172a] text-white min-h-screen p-8">

      <h1 className="text-2xl mb-6">Produk & Stok</h1>

      <div className="grid gap-4">
        {products.map(p => (
          <div
            key={p.id}
            className="flex justify-between items-center p-4 rounded-xl bg-white/5 hover:bg-white/10 transition"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-gray-400">
                Rp {p.price}
              </p>
            </div>

            <div className="text-right">
              <p
                className={
                  p.stock === 0
                    ? "text-red-500"
                    : p.stock < 5
                    ? "text-yellow-400"
                    : "text-green-400"
                }
              >
                Stok: {p.stock}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}