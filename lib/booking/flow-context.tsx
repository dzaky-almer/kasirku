"use client";

import { createContext, useContext, useMemo, useReducer } from "react";
import type { BookingProduct, BookingResource, PublicStoreBookingData } from "@/lib/booking/types";

type SelectedItem = {
  productId: string;
  qty: number;
};

type BookingFlowState = {
  store: PublicStoreBookingData | null;
  date: string;
  resourceId: string;
  slot: string;
  pax: number;
  items: SelectedItem[];
  customerName: string;
  customerPhone: string;
  customerNote: string;
};

type BookingFlowContextValue = BookingFlowState & {
  resource: BookingResource | null;
  selectedProducts: Array<BookingProduct & { qty: number }>;
  totalAmount: number;
  totalDuration: number;
  setStore: (store: PublicStoreBookingData) => void;
  setDate: (date: string) => void;
  setResourceId: (resourceId: string) => void;
  setSlot: (slot: string) => void;
  setPax: (pax: number) => void;
  toggleProduct: (productId: string) => void;
  setProductQty: (productId: string, qty: number) => void;
  setCustomerField: (field: "customerName" | "customerPhone" | "customerNote", value: string) => void;
  resetSelectionAfterBooking: () => void;
};

const initialState: BookingFlowState = {
  store: null,
  date: "",
  resourceId: "",
  slot: "",
  pax: 2,
  items: [],
  customerName: "",
  customerPhone: "",
  customerNote: "",
};

type Action =
  | { type: "setStore"; payload: PublicStoreBookingData }
  | { type: "setDate"; payload: string }
  | { type: "setResourceId"; payload: string }
  | { type: "setSlot"; payload: string }
  | { type: "setPax"; payload: number }
  | { type: "toggleProduct"; payload: string }
  | { type: "setProductQty"; payload: { productId: string; qty: number } }
  | { type: "setCustomerField"; payload: { field: "customerName" | "customerPhone" | "customerNote"; value: string } }
  | { type: "resetSelectionAfterBooking" };

function reducer(state: BookingFlowState, action: Action): BookingFlowState {
  switch (action.type) {
    case "setStore":
      return {
        ...state,
        store: action.payload,
        resourceId: state.resourceId || action.payload.bookingResources[0]?.id || "",
      };
    case "setDate":
      return { ...state, date: action.payload, slot: "" };
    case "setResourceId":
      return { ...state, resourceId: action.payload, slot: "" };
    case "setSlot":
      return { ...state, slot: action.payload };
    case "setPax":
      return { ...state, pax: Math.max(1, action.payload) };
    case "toggleProduct": {
      const exists = state.items.find((item) => item.productId === action.payload);
      return {
        ...state,
        slot: "",
        items: exists
          ? state.items.filter((item) => item.productId !== action.payload)
          : [...state.items, { productId: action.payload, qty: 1 }],
      };
    }
    case "setProductQty":
      return {
        ...state,
        slot: "",
        items: state.items.map((item) =>
          item.productId === action.payload.productId
            ? { ...item, qty: Math.max(1, action.payload.qty) }
            : item
        ),
      };
    case "setCustomerField":
      return { ...state, [action.payload.field]: action.payload.value };
    case "resetSelectionAfterBooking":
      return {
        ...state,
        slot: "",
        items: [],
        customerName: "",
        customerPhone: "",
        customerNote: "",
      };
    default:
      return state;
  }
}

const BookingFlowContext = createContext<BookingFlowContextValue | null>(null);

export function BookingFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<BookingFlowContextValue>(() => {
    const resource = state.store?.bookingResources.find((entry) => entry.id === state.resourceId) ?? null;
    const selectedProducts =
      state.store?.products
        .filter((product) => state.items.some((item) => item.productId === product.id))
        .map((product) => ({
          ...product,
          qty: state.items.find((item) => item.productId === product.id)?.qty ?? 1,
        })) ?? [];

    return {
      ...state,
      resource,
      selectedProducts,
      totalAmount: selectedProducts.reduce((sum, item) => sum + item.price * item.qty, 0),
      totalDuration: selectedProducts.reduce(
        (sum, item) => sum + (item.bookingDurationMin ?? state.store?.bookingSlotMinutes ?? 30) * item.qty,
        0
      ),
      setStore: (store) => dispatch({ type: "setStore", payload: store }),
      setDate: (date) => dispatch({ type: "setDate", payload: date }),
      setResourceId: (resourceId) => dispatch({ type: "setResourceId", payload: resourceId }),
      setSlot: (slot) => dispatch({ type: "setSlot", payload: slot }),
      setPax: (pax) => dispatch({ type: "setPax", payload: pax }),
      toggleProduct: (productId) => dispatch({ type: "toggleProduct", payload: productId }),
      setProductQty: (productId, qty) => dispatch({ type: "setProductQty", payload: { productId, qty } }),
      setCustomerField: (field, value) => dispatch({ type: "setCustomerField", payload: { field, value } }),
      resetSelectionAfterBooking: () => dispatch({ type: "resetSelectionAfterBooking" }),
    };
  }, [state]);

  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>;
}

export function useBookingFlow() {
  const context = useContext(BookingFlowContext);
  if (!context) {
    throw new Error("useBookingFlow must be used inside BookingFlowProvider");
  }
  return context;
}
