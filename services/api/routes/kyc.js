import express from "express";
import { submitKyc } from "../services/kycService.js";
import { authenticate,
         authorize,
 } from "../modules/protect/index.js";

const router = express.Router();

/**
 * POST /api/kyc/verify
 *
 * Protected by Wanky Protect.
 *
 * Identity is derived from a verified Supabase JWT.
 * Client-supplied user IDs are not trusted.
 */
router.post(
  "/verify",
   authenticate,
   authorize("runner"),
   async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await submitKyc(userId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("KYC verification error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

export default router;