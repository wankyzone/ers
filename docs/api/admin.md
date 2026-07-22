# Admin KYC API

## Overview

The Admin KYC API allows administrators to review runner verification submissions, retrieve uploaded verification documents, and approve or reject KYC applications.

---

# Base Endpoint

```text
/api/admin/kyc
```

---

# Authentication

> **Current Implementation**

Authentication is currently handled by backend development tooling.

> **Future Improvement**

All admin endpoints will require authenticated administrator access using Supabase JWT authentication with role-based authorization.

---

# Endpoints

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/admin/kyc` | Fetch all pending KYC submissions. |
| GET | `/api/admin/kyc/:id/documents` | Retrieve signed URLs for uploaded verification documents. |
| POST | `/api/admin/kyc/:id/approve` | Approve a pending KYC submission. |
| POST | `/api/admin/kyc/:id/reject` | Reject a pending KYC submission. |

---

# Get Pending KYC Applications

## GET `/api/admin/kyc`

Returns every KYC application currently awaiting review.

### Success Response

**HTTP 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "ea002038-8cdb-48bd-92eb-2820d9e81f23",
      "user_id": "223e4567-e89b-42d3-a456-426614174001",
      "full_name": "Test Runner",
      "status": "pending",
      "created_at": "2026-07-22T10:14:40.119018Z"
    }
  ]
}
```

---

# Retrieve Uploaded Documents

## GET `/api/admin/kyc/:id/documents`

Generates temporary signed URLs for the uploaded runner verification documents.

Signed URLs expire automatically after five minutes.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | KYC profile ID |

### Success Response

**HTTP 200**

```json
{
  "success": true,
  "data": {
    "nin": "https://...",
    "proofOfAddress": "https://...",
    "selfie": "https://..."
  }
}
```

### Error Response

**HTTP 500**

```json
{
  "success": false,
  "message": "Unable to generate a document link at this time."
}
```

---

# Approve KYC

## POST `/api/admin/kyc/:id/approve`

Approves a pending runner verification.

### Success Response

**HTTP 200**

```json
{
  "success": true,
  "message": "KYC approved successfully.",
  "data": {
    "id": "ea002038-8cdb-48bd-92eb-2820d9e81f23",
    "status": "approved"
  }
}
```

### Possible Error Responses

```json
{
  "success": false,
  "message": "Only runner accounts can be KYC verified."
}
```

```json
{
  "success": false,
  "message": "Cannot approve a rejected KYC submission."
}
```

---

# Reject KYC

## POST `/api/admin/kyc/:id/reject`

Rejects a pending runner verification.

### Request Body

```json
{
  "reason": "Uploaded documents are unreadable."
}
```

### Success Response

```json
{
  "success": true,
  "message": "KYC rejected successfully.",
  "data": {
    "id": "ea002038-8cdb-48bd-92eb-2820d9e81f23",
    "status": "rejected",
    "rejection_reason": "Uploaded documents are unreadable."
  }
}
```

### Validation Error

```json
{
  "success": false,
  "message": "Rejection reason is required."
}
```

---

# KYC Review Workflow

```text
Administrator
        │
        ▼
GET /api/admin/kyc
        │
        ▼
Select Runner
        │
        ▼
GET /api/admin/kyc/:id/documents
        │
        ▼
View Signed URLs
        │
        ▼
Review Uploaded Documents
        │
        ▼
Approve or Reject
```

---

# Security Notes

- Verification documents are stored in a private Supabase Storage bucket.
- Administrators never receive permanent storage URLs.
- Signed URLs automatically expire after five minutes.
- Document paths remain private within the database.
- Only administrators should have access to these endpoints.

---

# Future Improvements

- JWT authentication.
- Role-based authorization.
- Audit logging for every approval and rejection.
- Pagination for pending KYC submissions.
- Filtering and search.
- Review history.
- Reviewer identity tracking.
- Admin dashboard analytics.