import { uploadFile } from "./storageUpload.js";
import {
    getPendingKyc,
    updateDocumentPaths,
    getKycById,
} from "./storageQueries.js";
import { generateSignedUrl } from "./storageSignedUrl.js";

export async function uploadRunnerDocuments(userId, files) {
  const nin = files?.nin?.[0];
  const proofOfAddress = files?.proofOfAddress?.[0];
  const selfie = files?.selfie?.[0];

  if (!nin && !proofOfAddress && !selfie) {
    return {
      success: false,
      message: "At least one document is required.",
    };
  }

  // Only allow uploads to a pending KYC application
  const kyc = await getPendingKyc(userId);

  const paths = {};

  if (nin) {
    paths.nin = await uploadFile(
      userId,
      "nin",
      nin
    );
  }

  if (proofOfAddress) {
    paths.proofOfAddress = await uploadFile(
      userId,
      "proof_of_address",
      proofOfAddress
    );
  }

  if (selfie) {
    paths.selfie = await uploadFile(
      userId,
      "selfie",
      selfie
    );
  }

  const updated = await updateDocumentPaths(
    kyc.id,
    paths
  );

  return {
    success: true,
    message: "Documents uploaded successfully.",
    kyc: updated,
  };
}

export async function getRunnerDocuments(kycId) {
  const kyc = await getKycById(kycId);

  return {
    success: true,
    data: {
      nin: kyc.nin_document_url
        ? await generateSignedUrl(kyc.nin_document_url)
        : null,

      proofOfAddress: kyc.proof_of_address_url
        ? await generateSignedUrl(kyc.proof_of_address_url)
        : null,

      selfie: kyc.selfie_url
        ? await generateSignedUrl(kyc.selfie_url)
        : null,
    },
  };
}