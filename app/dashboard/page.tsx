"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts"

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)

  const data = [
    { name: "Sen", total: 400 },
    { name: "Sel", total: 700 },
    { name: "Rab", total: 300 },
    { name: "Kam", total: 900 },
    { name: "Jum", total: 500 },
  ]

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000)
  }, [])

  return (
    <div className="bg-[#0f172a] text-white min-h-screen p-8">

      <h1 className="text-2xl mb-6">Dashboard</h1>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[1,2,3].map(i => (
          <div key={i} className="p-5 rounded-xl bg-white/5 animate-pulse">
            {loading ? (
              <div className="h-6 bg-white/20 rounded w-20"></div>
            ) : (
              <h2>Data {i}</h2>
            )}
          </div>
        ))}
      </div>

      {/* CHART */}
      <div className="bg-white/5 p-6 rounded-xl">
        <h2 className="mb-4">Penjualan</h2>

        {loading ? (
          <div className="h-40 bg-white/10 animate-pulse rounded"></div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <XAxis dataKey="name" stroke="#ccc" />
              <Tooltip />
              <Bar dataKey="total" fill="#60a5fa" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}