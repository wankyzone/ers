import supabase from "../supabase.js";

const BUCKET = "runner-verification";

function buildStoragePath(userId, folder, filename) {
  const timestamp = Date.now();
  const safeName = filename.replace(/\s+/g, "-");

  return `${userId}/${folder}/${timestamp}-${safeName}`;
}

export async function uploadFile(userId, folder, file) {
  const path = buildStoragePath(
    userId,
    folder,
    file.originalname
  );

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    console.error(
      "[storageUpload] Supabase upload failed",
       {
        userId,
        folder,
        filename: file.originalname,
        error,
       }
      );
    throw new Error("Unable to upload document at this time.");
  }

  return path;
}