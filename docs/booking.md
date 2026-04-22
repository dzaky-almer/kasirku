# Booking Backend Handoff

Dokumen ini khusus untuk handoff dari backend ke frontend untuk fitur booking `barbershop + cafe`.

Fokus backend:
- public booking tanpa login
- admin booking management
- resource management
- slot availability real-time
- DP booking
- schedule board
- dashboard stats

## 1. File Backend Yang Dibuat

### Prisma / Data Layer
- `prisma/schema.prisma`
- `prisma/migrations/20260421090000_booking_backend_foundation/migration.sql`

### Helper
- `lib/booking.ts`
- `lib/store-access.ts`
- `lib/slug.ts`

### Public API
- `app/api/book/[slug]/route.ts`
- `app/api/book/[slug]/availability/route.ts`
- `app/api/book/[slug]/confirm/route.ts`

### Admin API
- `app/api/booking/route.ts`
- `app/api/booking/[id]/route.ts`
- `app/api/booking/resources/route.ts`
- `app/api/booking/resources/[id]/route.ts`
- `app/api/booking/settings/route.ts`
- `app/api/booking/products/[id]/route.ts`
- `app/api/booking/schedule/route.ts`
- `app/api/booking/dashboard/route.ts`
- `app/api/booking/payments/webhook/route.ts`

### Backend Pendukung
- `app/api/stores/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/products/route.ts`
- `app/api/products/[id]/route.ts`
- `app/api/midtrans/route.ts`

## 2. Model Data Yang Ditambahkan / Diubah

### Store
Field baru:
- `slug`
- `bookingGraceMinutes`
- `bookingOpenTime`
- `bookingCloseTime`
- `bookingSlotMinutes`

### Product
Field baru:
- `bookingEnabled`
- `bookingDurationMin`

### BookingResource
Field:
- `id`
- `storeId`
- `type`
- `name`
- `capacity`
- `description`
- `isActive`
- `createdAt`
- `updatedAt`

### Booking
Field:
- `id`
- `storeId`
- `resourceId`
- `type`
- `source`
- `status`
- `customerName`
- `customerPhone`
- `customerNote`
- `bookingDate`
- `startTime`
- `endTime`
- `pax`
- `areaLabel`
- `barberName`
- `dpAmount`
- `dpStatus`
- `paymentOrderId`
- `paymentStatusRaw`
- `dpPaidAt`
- `checkInAt`
- `completedAt`
- `noShowAt`
- `createdAt`
- `updatedAt`

### BookingItem
Field:
- `id`
- `bookingId`
- `productId`
- `name`
- `itemType`
- `qty`
- `unitPrice`
- `durationMin`
- `createdAt`

## 3. Enum / Value Penting Yang Perlu Frontend Tahu

### Tipe bisnis booking
- `BARBER`
- `CAFE`

### Tipe resource
- `BARBER`
- `AREA`
- `TABLE`
- `ROOM`

### Source booking
- `ONLINE`
- `OFFLINE`

### Status booking
- `PENDING`
- `CONFIRMED`
- `ARRIVED`
- `COMPLETED`
- `NO_SHOW`

### Status DP
- `UNPAID`
- `PAID`
- `WAIVED`
- `FAILED`
- `FORFEITED`

## 4. Fitur Backend Yang Sudah Ditangani

### Reservasi mandiri 24/7
- customer bisa buka endpoint public kapan saja
- slot availability real-time
- tanpa login

### Transparansi & kepastian tempat
- pilih resource spesifik
- validasi kapasitas pax untuk cafe
- slot bentrok otomatis ditolak

### Pre-order layanan / menu
- customer wajib pilih minimal 1 item saat booking online
- item booking disimpan ke `BookingItem`

### DP aman
- DP = total item yang dipilih
- booking online membuat `paymentOrderId`
- ada endpoint konfirmasi pembayaran
- ada webhook Midtrans untuk update status pembayaran
- ada endpoint generate token Snap Midtrans sandbox

### Schedule board admin
- endpoint khusus untuk resource + booking per tanggal

### Dashboard finansial ringkas
- total deposit hari ini
- total booking aktif
- online vs offline counter
- system status

## 5. Public API Contract

### GET `/api/book/:slug`
Dipakai frontend customer untuk ambil data dasar halaman booking.

Response:
```json
{
  "id": "store-id",
  "name": "Cafe Senja",
  "slug": "cafe-senja",
  "type": "cafe",
  "address": "Jl. Mawar",
  "waNumber": "62812xxxx",
  "bookingGraceMinutes": 30,
  "bookingOpenTime": "09:00",
  "bookingCloseTime": "21:00",
  "bookingSlotMinutes": 30,
  "bookingResources": [
    {
      "id": "resource-id",
      "type": "TABLE",
      "name": "Meja Outdoor 01",
      "capacity": 4,
      "description": "Dekat taman"
    }
  ],
  "products": [
    {
      "id": "product-id",
      "name": "Cappuccino",
      "price": 28000,
      "category": "Coffee",
      "bookingDurationMin": null
    }
  ]
}
```

### Data yang ditampilkan frontend customer dari endpoint ini
- nama toko
- tipe toko
- alamat
- nomor WA
- jam operasional booking
- list resource
  - nama tempat / kursi / barber
  - kapasitas
  - deskripsi
- list produk booking
  - nama produk / layanan
  - harga
  - kategori
  - durasi layanan barber

---

### GET `/api/book/:slug/availability?date=YYYY-MM-DD&resourceId=...&pax=...&durationMinutes=...`
Dipakai frontend untuk cek slot real-time.

Response:
```json
{
  "resourceId": "resource-id",
  "slotMinutes": 30,
  "openTime": "09:00",
  "closeTime": "21:00",
  "slots": [
    {
      "time": "09:00",
      "available": true,
      "reason": null
    },
    {
      "time": "09:30",
      "available": false,
      "reason": "Sudah dibooking"
    }
  ]
}
```

### Data yang ditampilkan frontend customer dari endpoint ini
- jam buka
- jam tutup
- interval slot
- list jam
  - jam
  - available / disabled
  - reason

---

### POST `/api/book/:slug`
Dipakai frontend untuk membuat booking online.

Request:
```json
{
  "customerName": "Fachri",
  "customerPhone": "628123456789",
  "customerNote": "Dekat colokan",
  "bookingDate": "2026-04-22",
  "startTime": "19:00",
  "resourceId": "resource-id",
  "pax": 4,
  "items": [
    {
      "productId": "product-id",
      "qty": 1
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "booking": {
    "id": "booking-id",
    "paymentOrderId": "BOOK-xxxx",
    "dpAmount": 28000,
    "status": "PENDING"
  },
  "payment": {
    "orderId": "BOOK-xxxx",
    "grossAmount": 28000
  }
}
```

### Data yang ditampilkan frontend customer sebelum submit
- customer name
- customer phone
- tanggal
- jam
- resource terpilih
- pax
- item yang dipilih
- subtotal DP

### Data yang ditampilkan frontend customer sesudah submit
- booking id
- payment order id
- nominal DP
- status booking

---

### POST `/api/book/:slug/confirm`
Dipakai frontend setelah pembayaran sukses dari Snap / Midtrans.

Request:
```json
{
  "bookingId": "booking-id"
}
```

---

### GET `/api/midtrans?mode=config&storeId=...`
Dipakai frontend untuk ambil konfigurasi Snap.

Response:
```json
{
  "clientKey": "SB-Mid-client-xxxx",
  "isProduction": false
}
```

### POST `/api/midtrans`
Dipakai frontend untuk membuat token Snap Midtrans sandbox.

Request:
```json
{
  "orderId": "BOOK-xxxx",
  "total": 28000,
  "storeId": "store-id",
  "bookingId": "booking-id",
  "itemDetails": [
    {
      "id": "product-id",
      "price": 28000,
      "quantity": 1,
      "name": "Cappuccino"
    }
  ],
  "customer": {
    "first_name": "Fachri",
    "phone": "628123456789"
  }
}
```

Response:
```json
{
  "token": "snap-token",
  "redirectUrl": "https://app.sandbox.midtrans.com/...",
  "orderId": "BOOK-xxxx",
  "clientKey": "SB-Mid-client-xxxx",
  "isProduction": false
}
```

### GET `/api/midtrans?orderId=BOOK-xxxx&storeId=...`
Dipakai frontend/admin untuk cek status pembayaran Midtrans.

## 6. Admin API Contract

### GET `/api/booking?storeId=...&date=...&status=...`
List booking untuk admin dashboard.

Response item:
```json
{
  "id": "booking-id",
  "type": "CAFE",
  "source": "ONLINE",
  "status": "CONFIRMED",
  "customerName": "Fachri",
  "customerPhone": "628123456789",
  "bookingDate": "2026-04-22T00:00:00.000Z",
  "startTime": "19:00",
  "endTime": "19:30",
  "pax": 4,
  "areaLabel": "Meja Outdoor 01",
  "dpAmount": 28000,
  "dpStatus": "PAID",
  "resource": {},
  "items": []
}
```

### Data yang ditampilkan frontend admin
- nama customer
- nomor WA
- source booking
- status booking
- tanggal
- jam mulai / selesai
- pax
- area / barber
- DP amount
- DP status
- list item booking

---

### POST `/api/booking`
Dipakai admin untuk booking offline / walk-in.

Request:
```json
{
  "storeId": "store-id",
  "customerName": "Walk In 1",
  "customerPhone": "62812xxxx",
  "bookingDate": "2026-04-22",
  "startTime": "14:00",
  "resourceId": "resource-id",
  "pax": 2,
  "customerNote": "Walk in",
  "items": [
    {
      "productId": "product-id",
      "name": "Manual menu",
      "qty": 1,
      "unitPrice": 20000
    }
  ]
}
```

---

### GET `/api/booking/:id`
Detail booking tunggal.

### PATCH `/api/booking/:id`
Update status booking.

Request paling umum:
```json
{
  "status": "ARRIVED",
  "dpStatus": "PAID"
}
```

---

### GET `/api/booking/resources?storeId=...`
List seluruh resource admin.

### POST `/api/booking/resources`
Tambah resource baru.

Request:
```json
{
  "storeId": "store-id",
  "type": "TABLE",
  "name": "Meja Outdoor 01",
  "capacity": 4,
  "description": "Dekat taman"
}
```

### PATCH `/api/booking/resources/:id`
Update resource.

Field:
- `isActive`
- `name`
- `capacity`
- `description`

### DELETE `/api/booking/resources/:id`
Hapus resource.

---

### PATCH `/api/booking/settings`
Setting booking per store.

Request:
```json
{
  "storeId": "store-id",
  "bookingGraceMinutes": 30,
  "bookingOpenTime": "09:00",
  "bookingCloseTime": "21:00",
  "bookingSlotMinutes": 30
}
```

### GET `/api/booking/settings?storeId=...`
Dipakai frontend admin untuk mengambil seluruh data pengaturan booking dalam satu request.

Response:
```json
{
  "id": "store-id",
  "name": "Cafe Senja",
  "slug": "cafe-senja",
  "type": "cafe",
  "bookingGraceMinutes": 30,
  "bookingOpenTime": "09:00",
  "bookingCloseTime": "21:00",
  "bookingSlotMinutes": 30,
  "bookingResources": [
    {
      "id": "resource-id",
      "type": "TABLE",
      "name": "Meja Outdoor 01",
      "capacity": 4,
      "description": "Dekat taman",
      "isActive": true
    }
  ],
  "products": [
    {
      "id": "product-id",
      "name": "Cappuccino",
      "price": 28000,
      "category": "Coffee",
      "bookingEnabled": true,
      "bookingDurationMin": null
    }
  ]
}
```

### Frontend admin menampilkan / mengatur:
- toleransi keterlambatan
- jam buka booking
- jam tutup booking
- interval slot
- list resource booking
- list produk / layanan untuk booking

---

### PATCH `/api/booking/products/:id`
Toggle produk agar bisa dipakai di booking.

Request:
```json
{
  "bookingEnabled": true,
  "bookingDurationMin": 60
}
```

### Frontend admin menampilkan:
- nama produk
- harga
- booking enabled
- durasi layanan booking

---

### GET `/api/booking/schedule?storeId=...&date=YYYY-MM-DD`
Dipakai admin untuk board / timeline schedule.

Response:
```json
{
  "date": "2026-04-22",
  "resources": [],
  "bookings": []
}
```

### Data yang ditampilkan frontend admin schedule board
- list resource
- booking per resource
- customer name
- phone
- item booking
- status booking
- source booking
- DP status
- startTime
- endTime

---

### GET `/api/booking/dashboard?storeId=...&date=YYYY-MM-DD`
Dipakai widget dashboard admin.

Response:
```json
{
  "date": "2026-04-22T00:00:00.000Z",
  "totalDeposit": 56000,
  "activeBookings": 8,
  "onlineBookings": 5,
  "offlineBookings": 3,
  "paidDepositCount": 4,
  "systemStatus": "SYNCED"
}
```

### Data yang ditampilkan frontend admin dashboard
- total deposit
- total booking aktif
- total online
- total offline
- total DP paid
- system status

## 7. Aturan Bisnis Yang Harus Diikuti Frontend

### Booking Online
- wajib pilih `resourceId`
- wajib pilih minimal `1 item`
- DP = total item
- frontend harus kirim `pax` untuk cafe
- frontend harus kirim `durationMinutes` saat cek availability barber jika durasi ingin presisi

### Booking Cafe
- frontend disable resource dengan `capacity < pax`
- frontend tampilkan resource spesifik, bukan cuma kategori umum

### Booking Barber
- frontend tampilkan durasi layanan dari `bookingDurationMin`
- backend otomatis tambah buffer 10 menit

### Payment
- frontend ambil `payment.orderId` dan `payment.grossAmount`
- frontend gunakan ke Midtrans Snap
- setelah sukses, frontend panggil `/api/book/:slug/confirm`

## 8. Catatan Integrasi

- Semua admin endpoint butuh session login.
- Semua public endpoint tidak butuh login.
- Store bisa diakses dengan `slug` atau fallback `id`.
- Webhook Midtrans sudah disiapkan di:
  - `/api/booking/payments/webhook`

## 9. Status Implementasi

Sudah dibuat:
- schema
- migration SQL
- helper backend
- public booking API
- admin booking API
- resource CRUD
- booking settings
- product booking config
- schedule board endpoint
- dashboard stats endpoint
- webhook endpoint

Belum saya sentuh di turn ini:
- UI
- page
- komponen frontend
