export type BookingResourceType = "BARBER" | "TABLE" | "AREA" | "ROOM";

export interface BookingProduct {
  id: string;
  name: string;
  price: number;
  category: string | null;
  bookingEnabled: boolean;
  bookingDurationMin: number | null;
}

export interface BookingResource {
  id: string;
  type: BookingResourceType;
  name: string;
  capacity: number | null;
  description: string | null;
  isActive: boolean;
}

export interface BookingSettingsResponse {
  id: string;
  name: string;
  slug: string;
  type: string;
  bookingOpenTime: string;
  bookingCloseTime: string;
  bookingSlotMinutes: number;
  bookingGraceMinutes: number;
  bookingResources: BookingResource[];
  products: BookingProduct[];
}

export interface PublicStoreBookingData {
  id: string;
  name: string;
  slug: string;
  type: string;
  address: string | null;
  waNumber: string | null;
  bookingOpenTime: string;
  bookingCloseTime: string;
  bookingSlotMinutes: number;
  bookingGraceMinutes: number | null;
  bookingResources: Array<Omit<BookingResource, "isActive">>;
  products: Array<Omit<BookingProduct, "bookingEnabled">>;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  reason?: string | null;
}

export interface AvailabilityResponse {
  resourceId: string;
  slots: AvailabilitySlot[];
  slotMinutes: number;
  openTime: string;
  closeTime: string;
}

export interface BookingListItem {
  id: string;
  source: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerNote: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string | null;
  pax: number | null;
  dpAmount: number;
  dpStatus: string;
  paymentOrderId: string | null;
  resource: {
    id: string;
    name: string;
    type: string;
  } | null;
  items: Array<{
    id: string;
    productId: string | null;
    name: string;
    itemType: string;
    qty: number;
    unitPrice: number;
    durationMin: number | null;
  }>;
}

export interface BookingDashboardStats {
  date: string;
  totalDeposit: number;
  activeBookings: number;
  onlineBookings: number;
  offlineBookings: number;
  paidDepositCount: number;
  systemStatus: string;
}

export interface BookingScheduleResponse {
  date: string;
  resources: BookingResource[];
  bookings: BookingListItem[];
}

export interface PublicBookingPayload {
  customerName: string;
  customerPhone: string;
  customerNote?: string;
  bookingDate: string;
  startTime: string;
  resourceId: string;
  pax?: number;
  items: Array<{
    productId: string;
    qty: number;
  }>;
}
