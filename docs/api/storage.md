# Storage API

## Overview

The Storage API is responsible for securely uploading and retrieving runner verification documents for the ERS (Errand Runner System) KYC workflow.

All uploaded documents are stored in a private Supabase Storage bucket. Only the storage object paths are persisted in the database. Document access is provided through short-lived signed URLs generated on demand.

---

## Endpoint

### Upload Runner Documents

**POST** `/api/storage/upload`

Uploads the required KYC documents for a runner.

---

## Authentication

> **Current Implementation**

Authentication is temporarily handled using the `x-user-id` request header during backend development.

| Header | Required | Description |
|---------|----------|-------------|
| `x-user-id` | Yes | The authenticated user's ID. |

> **Future Improvement**
>
> This header will be replaced with Supabase JWT authentication before production.

---

## Content Type

```
multipart/form-data
```

---

## Form Fields

| Field | Required | Description |
|--------|----------|-------------|
| `nin` | Yes | National Identification Number document |
| `proofOfAddress` | Yes | Proof of residence document |
| `selfie` | Yes | Selfie photograph for identity verification |

---

## Supported File Types

The following MIME types are accepted:

- image/jpeg
- image/png
- image/webp
- application/pdf

Any other file type will be rejected.

---

## File Size Limit

Maximum size per uploaded file:

```
5 MB
```

---

## Success Response

**HTTP 200**

```json
{
  "success": true,
  "message": "Documents uploaded successfully.",
  "data": {
    "kycId": "uuid",
    "documents": {
      "nin": "...",
      "proofOfAddress": "...",
      "selfie": "..."
    }
  }
}
```

> **Note**
>
> The database stores storage object paths rather than public URLs.

---

## Error Responses

### Missing User Header

**HTTP 400**

```json
{
  "success": false,
  "message": "Missing x-user-id header."
}
```

---

### Unsupported File Type

**HTTP 400**

```json
{
  "success": false,
  "message": "Unsupported file type."
}
```

---

### File Too Large

**HTTP 400**

```json
{
  "success": false,
  "message": "File too large."
}
```

---

### Upload Failure

**HTTP 500**

```json
{
  "success": false,
  "message": "Unable to upload document at this time."
}
```

Internal storage provider errors are intentionally not exposed to API consumers.

---

## Example Request

```bash
curl -X POST http://localhost:4000/api/storage/upload \
  -H "x-user-id: USER_UUID" \
  -F "nin=@nin.pdf" \
  -F "proofOfAddress=@utility-bill.pdf" \
  -F "selfie=@selfie.jpg"
```

---

## Storage Flow

```
Client
    │
    ▼
POST /api/storage/upload
    │
    ▼
Validate Request
    │
    ▼
Validate File Type
    │
    ▼
Validate File Size
    │
    ▼
Upload to Private Storage Bucket
    │
    ▼
Persist Storage Object Paths
    │
    ▼
Return Success Response
```

---

## Security Notes

- All documents are stored in a private Supabase Storage bucket.
- Storage object paths are persisted instead of signed URLs.
- Signed URLs are generated only when an authorized administrator requests access.
- Upload validation includes file type restrictions and maximum file size limits.
- User-facing errors do not expose internal storage provider details.

---

## Future Improvements

- Replace `x-user-id` with Supabase JWT authentication.
- Add role-based authorization middleware.
- Introduce malware scanning for uploaded files.
- Add image optimization and compression.
- Support resumable uploads for large documents.