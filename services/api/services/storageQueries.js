import supabase from "../supabase.js";

export async function getPendingKyc(userId) {
  console.info("[storageQueries] getPendingKyc:start", {
    userId,
    operation: "kyc lookup",
  });

  const { data, error } = await supabase
    .from("kyc_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .single();

  if (error) {
    console.error("[storageQueries] getPendingKyc:failed", {
      userId,
      operation: "kyc lookup",
    });
    throw new Error("Unable to load KYC information at this time.");
  }

  console.info("[storageQueries] getPendingKyc:success", {
    userId,
    operation: "kyc lookup",
    error,
  });

  return data;
}

export async function updateDocumentPaths(
  kycId,
  paths
) {
  console.info("[storageQueries] updateDocumentPaths:start", {
    kycId,
    operation: "document update",
  });

  const { data, error } = await supabase
    .from("kyc_profiles")
    .update({
      nin_document_url: paths.nin,
      proof_of_address_url: paths.proofOfAddress,
      selfie_url: paths.selfie,
    })
    .eq("id", kycId)
    .select()
    .single();

  if (error) {
    console.error("[storageQueries] updateDocumentPaths:failed", {
      kycId,
      operation: "document update",
    });
    throw new Error("Unable to update document information at this time.");
  }

  console.info("[storageQueries] updateDocumentPaths:success", {
    kycId,
    operation: "document update",
  });

  return data;
}

export async function getKycById(kycId) {
  console.info("[storageQueries] getKycById:start", {
    kycId,
    operation: "kyc lookup",
  });

  const { data, error } = await supabase
    .from("kyc_profiles")
    .select("*")
    .eq("id", kycId)
    .single();

  if (error) {
    console.error("[storageQueries] getKycById:failed", {
      kycId,
      operation: "kyc lookup",
    });
    throw new Error("Unable to load KYC information at this time.");
  }

  console.info("[storageQueries] getKycById:success", {
    kycId,
    operation: "kyc lookup",
  });

  return data;
}