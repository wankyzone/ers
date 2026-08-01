<div align="center">

# ERS

### The trusted platform for getting anything done.

Connect with verified runners to complete errands, deliveries, shopping, pickups, and everyday tasks—quickly, securely, and reliably.

<p>
  <a href="https://ers.wankysoftware.com">Website</a>
  ·
  <a href="#">Documentation</a>
  ·
  <a href="#">API Reference</a>
  ·
  <a href="#">Roadmap</a>
</p>

![GitHub stars](https://img.shields.io/github/stars/wankysoftware/ers?style=flat-square)
![GitHub license](https://img.shields.io/github/license/wankysoftware/ers?style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/wankysoftware/ers?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square)
![React Native](https://img.shields.io/badge/React%20Native-Expo-000000?style=flat-square)

</div>

---

## Built for trust.

ERS is a modern errand marketplace that connects clients with verified runners.

Whether it's picking up groceries, delivering packages, purchasing items, or completing everyday errands, ERS provides a secure platform powered by identity verification, real-time tracking, escrow payments, and transparent ratings.

Our mission is simple:

> **Make everyday errands effortless while creating opportunities for thousands of independent runners.**

---

# Features

### ✅ Verified Runners

Every runner completes identity verification before accepting jobs.

- Government ID verification
- Address verification
- Emergency contact
- Manual review process

---

### 📍 Live Tracking

Know exactly where your runner is from pickup to delivery.

- Real-time location
- ETA updates
- Delivery confirmation

---

### 💬 In-app Communication

Everything stays inside ERS.

- Secure messaging
- Voice calling
- Status updates

---

### 💳 Secure Payments

Payments are protected until the errand is completed.

- Escrow workflow
- Paystack integration
- Instant payout support

---

### ⭐ Ratings & Reviews

Trust is earned through every completed errand.

- Customer ratings
- Runner ratings
- Performance metrics

---

### 🛡 Admin Dashboard

Powerful tools for managing the marketplace.

- Runner verification
- User management
- Analytics
- Dispute handling
- Platform monitoring

---

# Architecture

```
apps/
├── mobile        # Expo React Native App
├── admin         # Next.js Admin Dashboard

packages/
├── backend       # Express API
├── shared        # Shared Types
├── ui            # Shared Components
└── emails        # Email Templates
```

---

# Technology Stack

| Layer | Technology |
|--------|------------|
| Mobile | React Native + Expo |
| Admin | Next.js |
| Backend | Express.js |
| Database | Supabase |
| Authentication | Supabase Auth |
| Payments | Paystack |
| Storage | Azure Blob Storage |
| Maps | Google Maps |
| Queue | BullMQ + Redis |
| Language | TypeScript |

---

# Getting Started

Clone the repository

```bash
git clone https://github.com/wankysoftware/ers.git
```

Install dependencies

```bash
pnpm install
```

Start development

```bash
pnpm dev
```

---

# Repository Structure

```
ERS
│
├── apps
│   ├── mobile
│   └── admin
│
├── packages
│   ├── backend
│   ├── shared
│   ├── ui
│   └── emails
│
├── supabase
├── docs
└── scripts
```

---

# Current Status

ERS is currently under active development.

Current focus includes:

- Runner Verification
- Client App
- Runner App
- Payments
- Admin Dashboard
- Analytics
- Notifications

---

# Vision

We're building more than an errand app.

ERS aims to become Africa's most trusted marketplace for on-demand services by combining technology, identity, logistics, and trust into one platform.

---

# Contributing

We welcome contributions from developers, designers, and product thinkers.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

---

# Security

If you discover a security vulnerability, please contact us privately before opening a public issue.

---

# License

This project is licensed under the MIT License.

---

<div align="center">

Built with ❤️ by **Wanky Technologies Ltd**

**Building Africa's Most Trusted Errand Platform**

</div>
