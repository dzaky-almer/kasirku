// components/ImageUpload.tsx
"use client";

import { useState } from "react";
import { uploadProductImage } from "@/lib/product-image";

interface Props {
  value?: string;
  onChange: (url: string) => void;
  onError?: (message: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

export default function ImageUpload({
  value,
  onChange,
  onError,
  onUploadingChange,
}: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    onUploadingChange?.(true);
    try {
      const url = await uploadProductImage(file);
      onChange(url);
    } catch (err) {
      console.error("Upload gagal:", err);
      onError?.(err instanceof Error ? err.message : "Upload gambar gagal. Coba lagi.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Preview */}
      <div className="w-16 h-16 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
        {value ? (
          <img src={value} alt="preview" className="w-full h-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-300" fill="none" strokeWidth={1.5}>
            <path d="M4 16l4-4 4 4 4-6 4 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
          </svg>
        )}
      </div>

      {/* Upload button */}
      <div className="flex-1">
        <label className="cursor-pointer">
          <div className={`px-3 py-2 text-xs border border-dashed border-gray-300 rounded-lg text-center transition-colors ${uploading ? "opacity-50" : "hover:border-amber-400 hover:text-amber-700"}`}>
            {uploading ? "Mengupload..." : value ? "Ganti Gambar" : "Upload Gambar"}
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
        <p className="text-[10px] text-gray-400 mt-1">JPG, PNG, WEBP. Maks 2MB.</p>
      </div>
    </div>
  );
}
