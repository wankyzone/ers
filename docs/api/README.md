# ERS API Documentation

Welcome to the ERS Backend API documentation.

This directory contains the developer documentation for the backend services that power the Errand Runner System (ERS).

---

## Current Documentation

| Document | Description |
|----------|-------------|
| `kyc.md` | Runner verification workflow and KYC profile creation |
| `storage.md` | Secure document upload and storage |
| `admin.md` | Administrative document retrieval |

---

## Current API Flow

```text
Runner
   │
   ▼
POST /api/kyc/verify
   │
   ▼
Create Pending Verification
   │
   ▼
POST /api/storage/upload
   │
   ▼
Upload Verification Documents
   │
   ▼
Administrator
   │
   ▼
GET /api/admin/kyc/:id/documents
   │
   ▼
Generate Signed URLs
```

---

## Authentication

The current backend uses the temporary `x-user-id` request header during development.

Before production, this will be replaced with:

- Supabase Authentication
- JWT verification middleware
- Role-based authorization
- Admin access control

---

## Storage Architecture

ERS follows a secure storage model:

- Documents are stored in a private Supabase Storage bucket.
- Database records contain storage object paths only.
- Signed URLs are generated only when access is required.
- Public URLs are never stored.

---

## Error Handling

The API follows these principles:

- Consistent JSON responses.
- User-friendly error messages.
- Internal provider errors are never exposed.
- Contextual server-side logging for debugging.

---

## Security

Current security features include:

- Private storage buckets
- Signed URL generation
- Upload validation
- File size limits
- MIME type validation

Planned improvements include:

- JWT authentication
- Role-based authorization
- Rate limiting
- Malware scanning
- Audit logging

---

## Development Status

| Module | Status |
|---------|--------|
| KYC API | ✅ Complete |
| Storage API | ✅ Complete |
| Admin API | ✅ Complete |

---

## Documentation Standards

When adding new endpoints:

1. Document the endpoint before merging.
2. Include request and response examples.
3. List all status codes.
4. Document authentication requirements.
5. Keep documentation synchronized with implementation.

Following these standards ensures the documentation remains accurate and useful as ERS evolves.