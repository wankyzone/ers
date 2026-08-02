<div align="center">

# ERS

### Africa's Trusted Errand Marketplace

Connect with verified runners to complete errands, deliveries, shopping, pickups, and everyday tasks—quickly, securely, and reliably.

<p>
  <a href="https://ers.wankysoftware.com">Website</a>
  •
  <a href="#">Documentation</a>
  •
  <a href="#">API Reference</a>
  •
  <a href="#">Roadmap</a>
</p>

![GitHub stars](https://img.shields.io/github/stars/wankysoftware/ers?style=flat-square)
![GitHub license](https://img.shields.io/github/license/wankysoftware/ers?style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/wankysoftware/ers?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square)
![React Native](https://img.shields.io/badge/React%20Native-Expo-000000?style=flat-square)

</div>

---

# About ERS

ERS is a modern errand marketplace connecting clients with verified runners.

Whether it's purchasing groceries, delivering packages, picking up documents, or completing everyday errands, ERS provides a secure platform powered by identity verification, real-time tracking, escrow payments, and transparent ratings.

Our mission is simple:

> **Make everyday errands effortless while creating opportunities for thousands of independent runners across Africa.**

---

# Features

## ✅ Verified Runners

Every runner completes identity verification before accepting errands.

- Government ID verification
- Address verification
- Emergency contact
- Manual approval workflow

---

## 📍 Live Tracking

Track every errand from pickup to completion.

- Live location updates
- ETA tracking
- Delivery confirmation

---

## 💬 In-App Communication

Everything stays inside ERS.

- Secure messaging
- Voice calling
- Status updates

---

## 💳 Secure Payments

Payments remain protected until the errand is completed.

- Escrow workflow
- Paystack integration
- Instant payouts

---

## ⭐ Ratings & Reviews

Trust is built after every completed errand.

- Customer ratings
- Runner ratings
- Performance history

---

## 🛡 Admin Control Center

Manage the entire marketplace from one dashboard.

- Runner verification
- User management
- Errand management
- Analytics
- Platform monitoring
- Dispute resolution

---

# Project Status

| Module | Status |
|---------|--------|
| Authentication | ✅ Complete |
| Authorization | ✅ Complete |
| Runner Verification (KYC) | ✅ Complete |
| Mobile App | 🚧 In Progress |
| Admin Dashboard | 🚧 Sprint 5 |
| Marketplace Engine | 🚧 Planned |
| Payments | 🚧 Planned |
| Notifications | 🚧 Planned |

---

# Architecture

```
                 Mobile App (Expo)

                       │

                 Express API

                       │

        ┌──────────────┴──────────────┐
        │                             │
    Supabase                      BullMQ
(Auth + Database)              Background Jobs

        │                             │
        ├──────────────┐              │
        │              │              │
 Azure Blob      Paystack       Redis Queue
   Storage        Payments
```

---

# Repository Structure

```
apps/
├── mobile                 # Expo React Native app
├── admin                  # Next.js Admin Dashboard

packages/
├── backend                # Express API
├── shared                 # Shared Types
├── ui                     # Shared Components
└── emails                 # Email Templates

supabase/
docs/
scripts/
```

---

# Technology Stack

| Layer | Technology |
|--------|------------|
| Mobile | React Native + Expo |
| Admin Dashboard | Next.js |
| Backend | Express.js |
| Database | Supabase |
| Authentication | Supabase Auth |
| Payments | Paystack |
| Storage | Azure Blob Storage |
| Queue | BullMQ + Redis |
| Maps | Google Maps |
| Language | TypeScript |

---

# Getting Started

## 1. Clone the repository

```bash
git clone https://github.com/wankysoftware/ers.git
cd ers
```

## 2. Install dependencies

```bash
pnpm install
```

## 3. Configure Environment Variables

Create a `.env` file in the project root (or copy from `.env.example` if available).

Example:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PAYSTACK_SECRET_KEY=your_paystack_secret
JWT_SECRET=your_jwt_secret
```

> Additional environment variables may be required depending on the services you are running.

## 4. Start the development server

```bash
pnpm dev
```

---

# Available Scripts

```bash
pnpm dev          # Start development

pnpm build        # Build project

pnpm lint         # Run linter

pnpm test         # Run tests
```

---

# Roadmap

- ✅ Sprint 1
- ✅ Sprint 2
- ✅ Sprint 3
- ✅ Sprint 4 — Authentication, Authorization & Runner Verification
- 🚧 Sprint 5 — Admin Control Center
- ⏳ Sprint 6 — Marketplace Engine
- ⏳ Sprint 7 — Payments
- ⏳ Sprint 8 — Notifications & Loyalty

---

# Contributing

We welcome contributions from developers, designers, and product thinkers.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push your branch.
5. Open a Pull Request.
6. Address automated review feedback.
7. Merge after approval.

---

# Security

If you discover a security vulnerability, please contact us privately before opening a public issue.

---

# License

This project is licensed under the MIT License.

---

<div align="center">

### Built by Wanky Technologies Ltd

**Building Africa's Most Trusted Errand Platform.**

</div>
