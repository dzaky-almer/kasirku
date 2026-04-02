"use client"
import { useState } from "react"

type Product = {
  id: number
  name: string
  price: number
}

type CartItem = Product & { qty: number }

export default function KasirPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [bayar, setBayar] = useState(0)
  const [search, setSearch] = useState("")
  const [dark, setDark] = useState(false)
  const [showStruk, setShowStruk] = useState(false)

  const products: Product[] = [
    { id: 1, name: "Kopi", price: 10000 },
    { id: 2, name: "Teh", price: 8000 },
    { id: 3, name: "Roti", price: 5000 },
    { id: 4, name: "Mie Instan", price: 12000 },
  ]

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id)

    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, qty: item.qty + 1 }
          : item
      ))
    } else {
      setCart([...cart, { ...product, qty: 1 }])
    }
  }

  const increaseQty = (id: number) => {
    setCart(cart.map(item =>
      item.id === id ? { ...item, qty: item.qty + 1 } : item
    ))
  }

  const decreaseQty = (id: number) => {
    setCart(cart.map(item =>
      item.id === id ? { ...item, qty: item.qty - 1 } : item
    ).filter(item => item.qty > 0))
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const kembalian = bayar - total

  const formatRupiah = (num: number) => {
    return "Rp " + num.toLocaleString("id-ID")
  }

  const bayarHandler = () => {
    if (cart.length === 0 || bayar < total) return
    setShowStruk(true)
  }

  const reset = () => {
    setCart([])
    setBayar(0)
    setShowStruk(false)
  }

  return (
    <div className={dark ? "dark bg-gray-900 text-white" : ""}>
      <div className="grid grid-cols-3 h-screen">

        {/* PRODUK */}
        <div className="col-span-2 p-6 bg-gray-100 dark:bg-gray-800">
          <div className="flex justify-between mb-4">
            <h1 className="text-2xl font-bold">KasirKu</h1>
            <button onClick={() => setDark(!dark)}>
              {dark ? "☀️" : "🌙"}
            </button>
          </div>

          {/* SEARCH */}
          <input
            type="text"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-2 mb-4 rounded-lg border"
          />

          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className="bg-white dark:bg-gray-700 p-4 rounded-xl shadow cursor-pointer"
              >
                <h2>{p.name}</h2>
                <p>{formatRupiah(p.price)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CART */}
        <div className="p-6 border-l bg-white dark:bg-gray-900 flex flex-col">
          <h2 className="text-xl font-bold mb-4">Cart</h2>

          <div className="flex-1 overflow-auto">
            {cart.map(item => (
              <div key={item.id} className="mb-3">
                <p>{item.name}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => decreaseQty(item.id)}>-</button>
                  <span>{item.qty}</span>
                  <button onClick={() => increaseQty(item.id)}>+</button>
                </div>
                <p className="text-sm">
                  {formatRupiah(item.price * item.qty)}
                </p>
              </div>
            ))}
          </div>

          {/* TOTAL */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-bold">
              {formatRupiah(total)}
            </h3>

            <input
              type="number"
              placeholder="Uang bayar"
              value={bayar || ""}
              onChange={(e) => setBayar(Number(e.target.value))}
              className="w-full p-2 border rounded mt-2"
            />

            {bayar > 0 && (
              <p className={kembalian < 0 ? "text-red-500" : "text-green-500"}>
                {kembalian < 0
                  ? "Uang kurang"
                  : "Kembalian: " + formatRupiah(kembalian)}
              </p>
            )}

            <button
              onClick={bayarHandler}
              className="w-full bg-blue-500 text-white p-2 mt-3 rounded"
            >
              Bayar
            </button>
          </div>
        </div>
      </div>

      {/* STRUK */}
      {showStruk && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg w-80 text-black">
            <h2 className="text-center font-bold mb-2">STRUK</h2>

            {cart.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.name} x{item.qty}</span>
                <span>{formatRupiah(item.price * item.qty)}</span>
              </div>
            ))}

            <hr className="my-2" />

            <p>Total: {formatRupiah(total)}</p>
            <p>Bayar: {formatRupiah(bayar)}</p>
            <p>Kembali: {formatRupiah(kembalian)}</p>

            <button
              onClick={reset}
              className="w-full bg-green-500 text-white p-2 mt-3 rounded"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  )
}