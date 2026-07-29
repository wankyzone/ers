# Wanky Protect v1
## Identity & Security Platform Architecture

**Status:** Approved for Implementation

**Version:** 1.0

**Owner:** Wanky Technologies

**Primary Consumer:** ERS (Errand Runner System)

---

# Vision

Wanky Protect is the identity and security platform for every product built by Wanky Technologies.

Rather than creating separate authentication systems for each application, Wanky Protect provides a unified security layer responsible for authentication, authorization, identity, audit logging, and future security capabilities.

ERS is the first product to consume Wanky Protect.

Future Wanky products—including Wanky OS, Wanky Cloud, Wanky Pet, and internal administration tools—will build on the same identity platform.

---

# Mission

Provide secure, scalable and reusable identity infrastructure.

Every protected request within the Wanky ecosystem should be authenticated, authorized and auditable.

---

# Core Principles

## 1. Never Trust The Client

Clients never determine identity.

Identity is established only through verified server-side authentication.

---

## 2. Authentication Before Authorization

The platform first proves **who** the user is.

Only afterwards does it determine **what** the user may do.

---

## 3. Authorization Is Server Controlled

Roles are loaded from trusted backend data.

Clients cannot elevate permissions by modifying requests.

---

## 4. Every Important Action Is Auditable

Authentication should generate security events that can later power:

- Login History
- Device Trust
- Suspicious Activity Detection
- Risk Scoring
- Wanky Protect Dashboard

---

## 5. Reusable Across Products

Authentication logic must never contain ERS-specific assumptions.

Every component should be reusable by future Wanky products.

---

# Architecture

```text
                Mobile Apps
               Web Applications
             Admin Dashboard
             Future Products
                     │
                     ▼
              Wanky Protect
                     │
    ┌────────────────┼────────────────┐
    │                │                │
Authentication   Authorization   Session Services
    │                │                │
    └────────────────┼────────────────┘
                     │
             Security Events
                     │
              Audit Logger
                     │
                 Supabase
```

---

# Request Lifecycle

```text
Incoming Request

↓

Authentication

↓

JWT Verification

↓

Load User Profile

↓

Authorization

↓

Validation

↓

Business Logic

↓

Database

↓

Response
```

---

# Identity Model

Every authenticated request exposes:

```javascript
req.user = {
    id,
    email,
    role
}
```

The request object becomes the single source of truth for authenticated identity.

---

# Supported Roles

Client

Runner

Admin

Future roles can be introduced without modifying authentication.

---

# Module Structure

```text
services/api/

modules/
└── protect/
    ├── authenticate.js
    ├── authorize.js
    ├── authService.js
    ├── sessionService.js
    ├── permissions.js
    ├── audit.js
    ├── events.js
    ├── constants.js
    └── index.js
```

---

# Authentication Flow

User

↓

Supabase Authentication

↓

JWT Issued

↓

Authorization Header

↓

Wanky Protect

↓

Verify JWT

↓

Load Profile

↓

Attach req.user

↓

Business Logic

---

# Authorization Flow

Authenticated User

↓

Load Role

↓

Permission Evaluation

↓

Allow

or

Reject

---

# Security Events

Version 1 introduces the event pipeline.

Examples:

- User Logged In
- Token Verified
- Authentication Failed
- Unauthorized Access
- Forbidden Access
- Session Expired

Future releases will persist these events.

---

# Audit Logging

Version 1 establishes the interface.

Future versions will record:

- Timestamp
- User
- Device
- IP Address
- User Agent
- Endpoint
- Action
- Result

---

# Future Roadmap

## Version 1

- JWT Authentication
- RBAC
- Middleware
- Session Validation

---

## Version 2

- Refresh Tokens
- Device Trust
- Login History
- Audit Storage

---

## Version 3

- MFA
- Risk Engine
- Security Dashboard
- Threat Detection

---

## Version 4

Standalone Wanky Protect Platform

Identity services shared across every Wanky product.

---

# Success Criteria

A request is considered trusted only when:

- JWT is valid
- User exists
- Session is valid
- Required role is present
- Ownership checks pass

Otherwise the request is rejected.

---

# Design Goals

- Secure by default
- Simple to extend
- Framework agnostic
- Product agnostic
- Fully reusable
- Production ready

---

# Motto

Build security once.

Protect every product.