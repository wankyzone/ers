# KYC API

## Overview

The KYC (Know Your Customer) API manages the runner verification process in ERS.

Before a runner can begin accepting errands, they must complete identity verification. The verification process creates a pending KYC profile that is later updated when the required documents are uploaded through the Storage API.

---

## Endpoint

### Start Runner Verification

**POST** `/api/kyc/verify`

Creates a pending KYC verification record for the authenticated runner.

---

## Authentication

> **Current Implementation**

Authentication is temporarily handled using the `x-user-id` request header during backend development.

| Header | Required | Description |
|---------|----------|-------------|
| `x-user-id` | Yes | The authenticated user's ID. |

> **Future Improvement**
>
> The `x-user-id` header will be replaced with Supabase JWT authentication before production.

---

## Request Body

**Content-Type**

```text
application/json
```

### Example Request

```json
{
  "fullName": "Test Runner",
  "phone": "08012345678",
  "bvn": "12345678901",
  "bankCode": "058",
  "accountNumber": "1234567890",
  "accountName": "Test Runner"
}
```

### Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fullName` | string | Yes | Runner's full legal name. |
| `phone` | string | Yes | Runner's phone number. |
| `bvn` | string | Yes | Bank Verification Number. |
| `bankCode` | string | Yes | Bank code. |
| `accountNumber` | string | Yes | Bank account number. |
| `accountName` | string | Yes | Bank account holder's name. |

> **Note**
>
> The request schema should always match the backend implementation. Update this document whenever the API changes.

---

## Success Response

**HTTP 200**

```json
{
  "success": true,
  "message": "KYC profile created successfully.",
  "data": {
    "id": "ea002038-8cdb-48bd-92eb-2820d9e81f23",
    "user_id": "223e4567-e89b-42d3-a456-426614174001",
    "full_name": "Test Runner",
    "phone": "08012345678",
    "bvn": "12345678901",
    "bank_code": "058",
    "account_number": "1234567890",
    "account_name": "Test Runner",
    "status": "pending",
    "created_at": "2026-07-22T10:14:40.119018Z",
    "rejection_reason": null,
    "rejected_at": null,
    "nin_document_url": null,
    "proof_of_address_url": null,
    "selfie_url": null
  }
}
```

---

## Error Responses

### Missing Authentication Header

**HTTP 401**

```json
{
  "success": false,
  "message": "Missing x-user-id header."
}
```

---

### User Not Found

**HTTP 400**

```json
{
  "success": false,
  "message": "User not found"
}
```

---

### Missing Required Fields

**HTTP 400**

```json
{
  "success": false,
  "message": "Missing required KYC fields."
}
```

---

### Already Approved

**HTTP 400**

```json
{
  "success": false,
  "message": "KYC has already been approved and cannot be modified."
}
```

---

### Previously Rejected

**HTTP 400**

```json
{
  "success": false,
  "message": "KYC was rejected. Please contact support before resubmitting."
}
```

---

### Failed to Check Existing KYC

**HTTP 400**

```json
{
  "success": false,
  "message": "Failed to check existing KYC."
}
```

---

### Failed to Submit KYC

**HTTP 400**

```json
{
  "success": false,
  "message": "Failed to submit KYC."
}
```

---

### Failed to Update KYC

**HTTP 400**

```json
{
  "success": false,
  "message": "Failed to update KYC."
}
```

---

### Internal Server Error

**HTTP 500**

```json
{
  "success": false,
  "message": "Internal server error."
}
```

---

## Example Request

```bash
curl -X POST http://localhost:3000/api/kyc/verify \
  -H "Content-Type: application/json" \
  -H "x-user-id: 223e4567-e89b-42d3-a456-426614174001" \
  -d '{
    "fullName":"Test Runner",
    "phone":"08012345678",
    "bvn":"12345678901",
    "bankCode":"058",
    "accountNumber":"1234567890",
    "accountName":"Test Runner"
  }'
```

---

## Verification Flow

```text
Client
    │
    ▼
POST /api/kyc/verify
    │
    ▼
Validate User
    │
    ▼
Validate Required Fields
    │
    ▼
Check Existing KYC
    │
    ├───────────────┐
    ▼               │
Create New KYC      │
    │               │
    ▼               │
Return KYC Profile  │
                    │
Existing Pending? ──┘
        │
        ▼
Update Existing KYC
        │
        ▼
Return Updated Profile
        │
        ▼
Client Uploads Documents
        │
        ▼
Storage API
```

---

## KYC Status Lifecycle

| Status | Description |
|---------|-------------|
| `pending` | Verification has been submitted and is awaiting review. |
| `approved` | Runner has been verified and can begin accepting errands. |
| `rejected` | Verification failed and requires manual resubmission after contacting support. |

---

## Relationship with the Storage API

The KYC API works together with the Storage API.

1. Create a pending KYC profile using `/api/kyc/verify`.
2. Upload supporting documents using `/api/storage/upload`.
3. Store the uploaded document paths in the KYC profile.
4. Allow administrators to retrieve signed document URLs.
5. Approve or reject the runner's verification.

---

## Security Notes

- Only authenticated users can create or update their own KYC profile.
- KYC profiles are always associated with the authenticated user.
- Sensitive documents are uploaded through the Storage API, not this endpoint.
- Internal database errors are never exposed beyond generic API messages.
- Private document URLs are generated using signed URLs.

---

## Future Improvements

- Replace `x-user-id` with Supabase JWT authentication.
- Add request schema validation using Zod or Joi.
- Introduce centralized error handling middleware.
- Record KYC audit history.
- Notify runners when verification status changes.
- Add API versioning.