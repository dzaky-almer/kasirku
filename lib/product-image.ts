import { supabase } from "@/lib/supabase";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "jpg";
}

export async function uploadProductImage(file: File) {
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Maks 2MB");
  }

  const ext = getFileExtension(file.name);
  const fileName = `${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("products")
    .upload(fileName, file, { upsert: true });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("products").getPublicUrl(fileName);
  return data.publicUrl;
}
