"use client"
import { useEffect, useState } from "react"

type Product = {
  id: number
  name: string
  price: number
}

type CartItem = Product & { qty: number }

export default function KasirPage() {
  const [mounted, setMounted] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    setTimeout(() => setLoading(false), 800)
  }, [])

  if (!mounted) return null

  const products: Product[] = [
    { id: 1, name: "Kopi", price: 10000 },
    { id: 2, name: "Teh", price: 8000 },
    { id: 3, name: "Roti", price: 5000 },
    { id: 4, name: "Mie Instan", price: 12000 },
  ]

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const add = (p: Product) => {
    const exist = cart.find(i => i.id === p.id)
    if (exist) {
      setCart(cart.map(i =>
        i.id === p.id ? { ...i, qty: i.qty + 1 } : i
      ))
    } else {
      setCart([...cart, { ...p, qty: 1 }])
    }
  }

  const inc = (id: number) =>
    setCart(cart.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i))

  const dec = (id: number) =>
    setCart(cart
      .map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i)
      .filter(i => i.qty > 0)
    )

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)

  return (
    <div className="flex h-screen bg-[#0f172a] text-white">

      {/* LEFT */}
      <div className="flex-1 p-6">
        <h1 className="text-xl mb-6">Kasir</h1>

        <input
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-6 p-2 rounded bg-white/10 outline-none"
        />

        <div className="grid grid-cols-2 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-white/10 animate-pulse rounded-xl"
                />
              ))
            : filtered.map(p => (
                <div
                  key={p.id}
                  onClick={() => add(p)}
                  className="p-4 bg-white/5 rounded-xl 
                  hover:bg-white/10 
                  hover:scale-[1.03] 
                  transition duration-200 cursor-pointer"
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-gray-400">
                    Rp {p.price}
                  </p>
                </div>
              ))
          }
        </div>
      </div>

      {/* RIGHT */}
      <div className="w-80 p-6 border-l border-white/10 flex flex-col">
        <h2 className="mb-4">Cart</h2>

        <div className="flex-1 overflow-auto">
          {cart.map(i => (
            <div key={i.id} className="mb-4">
              <p className="font-medium">{i.name}</p>

              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => dec(i.id)}
                  className="px-2 bg-white/10 rounded hover:bg-white/20"
                >
                  -
                </button>

                <span>{i.qty}</span>

                <button
                  onClick={() => inc(i.id)}
                  className="px-2 bg-white/10 rounded hover:bg-white/20"
                >
                  +
                </button>
              </div>

              <p className="text-sm text-gray-400">
                Rp {i.price * i.qty}
              </p>
            </div>
          ))}
        </div>

        {/* TOTAL */}
        <div className="border-t border-white/10 pt-4">
          <p className="text-sm text-gray-400">Total</p>
          <h3 className="text-xl mb-4">Rp {total}</h3>

          <button className="w-full bg-white text-black py-2 rounded-lg hover:opacity-90 transition">
            Bayar
          </button>
        </div>
      </div>

    </div>
  )
}