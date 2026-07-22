import express from "express";
import multer from "multer";
import { uploadRunnerDocuments } from "../services/storageService.js";

const router = express.Router();
const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        `Unsupported file type. Allowed types: ${allowedMimeTypes.join(", ")}`
      ),
      false
    );
  },
});

const uploadFields = upload.fields([
  {
    name: "nin",
    maxCount: 1,
  },
  {
    name: "proofOfAddress",
    maxCount: 1,
  },
  {
    name: "selfie",
    maxCount: 1,
  },
]);

router.post(
  "/upload",
  (req, res, next) => {
    uploadFields(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      next();
    });
  },
  async (req, res) => {
    try {
      const userId = req.headers["x-user-id"];

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "Missing x-user-id header.",
        });
      }

      const result = await uploadRunnerDocuments(
        userId,
        req.files
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

export default router;