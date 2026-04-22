import type {
  AvailabilityResponse,
  BookingDashboardStats,
  BookingListItem,
  BookingResource,
  BookingSettingsResponse,
  BookingScheduleResponse,
  PublicBookingPayload,
  PublicStoreBookingData,
} from "@/lib/booking/types";

async function request<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : "Terjadi kesalahan saat memproses permintaan.";
    throw new Error(message);
  }

  return payload as T;
}

export const bookingApi = {
  getSettings(storeId: string) {
    return request<BookingSettingsResponse>(`/api/booking/settings?storeId=${storeId}`);
  },
  updateSettings(payload: {
    storeId: string;
    bookingOpenTime: string;
    bookingCloseTime: string;
    bookingSlotMinutes: number;
    bookingGraceMinutes: number;
  }) {
    return request<BookingSettingsResponse>("/api/booking/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  getResources(storeId: string) {
    return request<{ resources: BookingResource[] }>(`/api/booking/resources?storeId=${storeId}`);
  },
  createResource(payload: Partial<BookingResource> & { storeId: string }) {
    return request<BookingResource>("/api/booking/resources", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateResource(id: string, payload: Partial<BookingResource> & { storeId?: string }) {
    return request<BookingResource>(`/api/booking/resources/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteResource(id: string) {
    return request<{ success?: boolean }>(`/api/booking/resources/${id}`, {
      method: "DELETE",
    });
  },
  updateProduct(id: string, payload: { bookingEnabled?: boolean; bookingDurationMin?: number | null }) {
    return request(`/api/booking/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  getBookingList(storeId: string, filters?: { date?: string; status?: string }) {
    const params = new URLSearchParams({ storeId });
    if (filters?.date) params.set("date", filters.date);
    if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
    return request<BookingListItem[]>(`/api/booking?${params.toString()}`);
  },
  getBookingDetail(id: string) {
    return request<BookingListItem>(`/api/booking/${id}`);
  },
  updateBookingStatus(id: string, payload: { status?: string; dpStatus?: string }) {
    return request<BookingListItem>(`/api/booking/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  getDashboard(storeId: string, date: string) {
    return request<BookingDashboardStats>(`/api/booking/dashboard?storeId=${storeId}&date=${date}`);
  },
  getSchedule(storeId: string, date: string) {
    return request<BookingScheduleResponse>(`/api/booking/schedule?storeId=${storeId}&date=${date}`);
  },
  getPublicStore(slug: string) {
    return request<PublicStoreBookingData>(`/api/book/${slug}`);
  },
  getAvailability(slug: string, params: URLSearchParams) {
    return request<AvailabilityResponse>(`/api/book/${slug}/availability?${params.toString()}`);
  },
  createPublicBooking(slug: string, payload: PublicBookingPayload) {
    return request<{
      booking: BookingListItem;
      payment: { orderId: string; grossAmount: number };
    }>(`/api/book/${slug}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  confirmPublicBooking(slug: string, bookingId: string) {
    return request(`/api/book/${slug}/confirm`, {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    });
  },
  getMidtransConfig(storeId?: string) {
    const params = new URLSearchParams({ mode: "config" });
    if (storeId) params.set("storeId", storeId);
    return request<{ clientKey: string; isProduction: boolean }>(`/api/midtrans?${params.toString()}`);
  },
  createMidtransTransaction(payload: {
    bookingId: string;
    orderId: string;
    total: number;
    storeId: string;
    itemDetails: Array<{ id: string; price: number; quantity: number; name: string }>;
    customer: { first_name: string; phone: string };
  }) {
    return request<{ token: string; redirectUrl: string | null; clientKey: string; isProduction: boolean }>(
      "/api/midtrans",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },
};
