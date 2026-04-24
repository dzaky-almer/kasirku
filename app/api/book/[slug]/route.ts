import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  bookingTimeOverlaps,
  minutesToTime,
  normalizeBusinessType,
  resolveOperationalBookingDurationMinutes,
  syncOverdueBookings,
  timeToMinutes,
} from "@/lib/booking";

async function getPublicStore(slug: string) {
  return prisma.store.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      address: true,
      waNumber: true,
      bookingGraceMinutes: true,
      bookingOpenTime: true,
      bookingCloseTime: true,
      bookingSlotMinutes: true,
      bookingResources: {
        where: { isActive: true },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: {
          id: true,
          type: true,
          name: true,
          capacity: true,
          description: true,
        },
      },
      products: {
        where: { bookingEnabled: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          price: true,
          category: true,
          bookingDurationMin: true,
        },
      },
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const store = await getPublicStore(slug);

    if (!store) {
      return NextResponse.json({ error: "Store tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(store);
  } catch (error) {
    console.error("Public booking store GET error:", error);
    return NextResponse.json({ error: "Gagal memuat data booking publik" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
    }

    const store = await getPublicStore(slug);
    if (!store) {
      return NextResponse.json({ error: "Store tidak ditemukan" }, { status: 404 });
    }

    await syncOverdueBookings(store.id, store.bookingGraceMinutes ?? 30);

    const {
      customerName,
      customerPhone,
      customerNote,
      bookingDate,
      startTime,
      resourceId,
      pax,
      items,
    } = body as {
      customerName?: string;
      customerPhone?: string;
      customerNote?: string | null;
      bookingDate?: string;
      startTime?: string;
      resourceId?: string;
      pax?: number | null;
      items?: Array<{
        productId?: string;
        qty?: number;
        name?: string;
      }>;
    };

    if (!customerName || !customerPhone || !bookingDate || !startTime || !resourceId) {
      return NextResponse.json(
        { error: "customerName, customerPhone, bookingDate, startTime, dan resourceId wajib diisi" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Minimal harus memilih 1 produk/layanan untuk DP" }, { status: 400 });
    }

    const phone = customerPhone.replace(/\D/g, "");
    if (!phone.startsWith("62")) {
      return NextResponse.json({ error: "No. WhatsApp harus berformat 628xxxxxxxxx" }, { status: 400 });
    }

    const resource = store.bookingResources.find((entry) => entry.id === resourceId);
    if (!resource) {
      return NextResponse.json({ error: "Resource tidak tersedia" }, { status: 400 });
    }

    const businessType = normalizeBusinessType(store.type);
    if (businessType === "CAFE" && resource.capacity && typeof pax === "number" && pax > resource.capacity) {
      return NextResponse.json({ error: "Pax melebihi kapasitas meja/ruangan" }, { status: 400 });
    }

    const bookingDay = new Date(`${bookingDate}T00:00:00.000+07:00`);
    const productIds = items
      .map((item) => item.productId?.trim())
      .filter((item): item is string => Boolean(item));

    const products = await prisma.product.findMany({
      where: {
        storeId: store.id,
        id: { in: productIds },
        bookingEnabled: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        bookingDurationMin: true,
      },
    });

    if (products.length === 0) {
      return NextResponse.json({ error: "Produk booking tidak valid" }, { status: 400 });
    }

    const normalizedItems = items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) return null;

      const qty = typeof item.qty === "number" && item.qty > 0 ? item.qty : 1;
      return {
        productId: product.id,
        name: product.name,
        qty,
        unitPrice: product.price,
        durationMin: businessType === "BARBER" ? product.bookingDurationMin ?? store.bookingSlotMinutes : null,
        itemType: businessType === "BARBER" ? "SERVICE" : "PRODUCT",
      };
    }).filter((item): item is {
      productId: string;
      name: string;
      qty: number;
      unitPrice: number;
      durationMin: number | null;
      itemType: string;
    } => item !== null);

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: "Produk booking tidak valid" }, { status: 400 });
    }

    const dpAmount = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    const durationMinutes = resolveOperationalBookingDurationMinutes(
      businessType,
      store.bookingSlotMinutes,
      normalizedItems
    );

    const sameDayBookings = await prisma.booking.findMany({
      where: {
        storeId: store.id,
        resourceId,
        bookingDate: bookingDay,
        status: {
          in: ["PENDING", "CONFIRMED", "ARRIVED"],
        },
      },
      select: {
        startTime: true,
        type: true,
        items: {
          select: {
            durationMin: true,
          },
        },
      },
    });

    const overlappingBooking = sameDayBookings.find((booking) =>
      bookingTimeOverlaps(
        startTime,
        durationMinutes,
        booking.startTime,
        resolveOperationalBookingDurationMinutes(
          booking.type as "BARBER" | "CAFE",
          store.bookingSlotMinutes,
          booking.items
        )
      )
    );

    if (overlappingBooking) {
      return NextResponse.json({ error: "Slot ini sudah dipakai oleh booking lain" }, { status: 409 });
    }

    const paymentOrderId = `BOOK-${randomUUID()}`;
    const booking = await prisma.booking.create({
      data: {
        storeId: store.id,
        resourceId,
        type: businessType,
        source: "ONLINE",
        status: "PENDING",
        customerName: customerName.trim(),
        customerPhone: phone,
        customerNote: customerNote?.trim() || null,
        bookingDate: bookingDay,
        startTime,
        endTime: minutesToTime(timeToMinutes(startTime) + durationMinutes),
        pax: businessType === "CAFE" && typeof pax === "number" && pax > 0 ? pax : null,
        areaLabel: businessType === "CAFE" ? resource.name : null,
        barberName: businessType === "BARBER" ? resource.name : null,
        dpAmount,
        dpStatus: "UNPAID",
        paymentOrderId,
        items: {
          create: normalizedItems,
        },
      },
      include: {
        resource: true,
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      booking,
      payment: {
        orderId: paymentOrderId,
        grossAmount: dpAmount,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Public booking POST error:", error);
    return NextResponse.json({ error: "Gagal membuat booking publik" }, { status: 500 });
  }
}
