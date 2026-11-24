import express from "express";
import multer from "multer";
import { uploadRunnerDocuments } from "../services/storageService.js";
import {
  authenticate,
  authorizeRunnerApplication,
} from "../modules/protect/index.js";

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

function hasValidContentSignature(file) {
  const { buffer, mimetype } = file;

  if (mimetype === "image/jpeg") {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  }

  if (mimetype === "image/png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }

  if (mimetype === "image/webp") {
    return buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";
  }

  if (mimetype === "application/pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  return false;
}

router.post(
  "/upload",
  authenticate,
  authorizeRunnerApplication(),
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
  (req, res, next) => {
    const files = Object.values(req.files ?? {}).flat();

    if (files.some((file) => !hasValidContentSignature(file))) {
      return res.status(400).json({
        success: false,
        message: "Uploaded document content does not match its file type.",
      });
    }

    next();
  },
  async (req, res) => {
    try {
      const result = await uploadRunnerDocuments(
        req.user.id,
        req.files
      );

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Unable to upload documents at this time.",
      });
    }
  }
);

export default router;