export interface Product {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  price: number;
  costPrice?: number;
  stock: number;
  minStock: number;
  unit: string;
  category?: string;
  imageUrl?: string;
  storeId: string;
  label?: string | null;
}

export interface ProductFormState {
  name: string;
  barcode: string;
  sku: string;
  price: string;
  costPrice: string;
  stock: string;
  minStock: string;
  unit: string;
  category: string;
  imageUrl: string;
  label: string;
}

export const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: "",
  barcode: "",
  sku: "",
  price: "",
  costPrice: "",
  stock: "",
  minStock: "5",
  unit: "pcs",
  category: "",
  imageUrl: "",
  label: "",
};

export const PRODUCT_UNIT_OPTIONS = [
  "pcs",
  "box",
  "lusin",
  "kg",
  "gram",
  "liter",
  "ml",
];

export const PRODUCT_LABEL_OPTIONS = ["", "Best Seller", "Promo", "Baru"];

export const PRODUCT_LABEL_STYLES: Record<string, string> = {
  "Best Seller": "bg-amber-50 text-amber-700",
  Promo: "bg-purple-50 text-purple-700",
  Baru: "bg-blue-50 text-blue-700",
};
