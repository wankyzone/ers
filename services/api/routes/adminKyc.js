import express from "express";
import {
  getPendingKycs,
  approveKyc,
  rejectKyc,
} from "../services/kycService.js";

import {
  getRunnerDocuments,
} from "../services/storageService.js";

console.log("✅ adminKyc.js loaded");

const router = express.Router();

/**
 * GET /admin/kyc
 * Fetch all pending KYC submissions
 */
router.get("/", async (req, res) => {
  try {
    const result = await getPendingKycs();

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /admin/kyc/:id/documents
 */
router.get("/:id/documents", async (req, res) => {
  try {
    const result = await getRunnerDocuments(req.params.id);

    res.status(200).json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /admin/kyc/:id/approve
 */
router.post("/:id/approve", async (req, res) => {
  console.log("Approve endpoint hit:", req.params.id);

  try {
    const result = await approveKyc(req.params.id);

    res.status(200).json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /admin/kyc/:id/reject
 */
router.post("/:id/reject", async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required.",
      });
    }

    const result = await rejectKyc(req.params.id, reason);

    res.status(200).json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;