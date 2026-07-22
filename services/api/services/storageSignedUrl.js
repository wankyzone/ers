import supabase from "../supabase.js";

const BUCKET = "runner-verification";

export async function generateSignedUrl(path) {
  console.info("[storageSignedUrl] generateSignedUrl:start", {
    path,
    operation: "signed url generation",
  });

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 5);

  if (error) {
    console.error("[storageSignedUrl] generateSignedUrl:failed", {
      path,
      operation: "signed url generation",
    });

    throw new Error("Unable to generate a document link at this time.");
  }

  console.info("[storageSignedUrl] generateSignedUrl:success", {
    path,
    operation: "signed url generation",
    error,
  });

  return data.signedUrl;
}