# Wallet Address & Withdrawal Management - Technical Specification & API Documentation

## 1. Context & Feature Breakdown (Screenshot Analysis)

Based on the provided UI screenshots for **Crate & Barrel Dashboard**, this specification outlines the technical implementation for two core financial modules:

1. **Wallet Address Management (`/dashboard/wallet`)**:
   - **Network Selector**: Interactive toggles for networks (`TRC20 (Tron)`, `ERC20 (Ethereum)`, `BTC (Bitcoin)`).
   - **Address Input & Save**: Text input for the crypto wallet address with format validation, success indicator (`✓ TRC20 (Tron) address added`), and submit button.
   - **Bound Addresses List**: Overview section listing saved network addresses and their status (`✓ Added`).

2. **Withdrawal Request System (`/dashboard/withdraw`)**:
   - **Withdrawal Amount Input**: Field for custom withdrawal amounts.
   - **Quick Amount Preset Pills**: Fast selection buttons (`$100`, `$150`, `$200`, `$1,000`, `$1,500`, `$2,000`).
   - **Network Selection**: Select target payout network.
   - **Live Wallet Preview Box**: Displays saved wallet details (`trc20 Wallet: dfasdf`). Warns if no address is set for the selected network.
   - **Submission & Flow**: Triggers backend withdrawal request, locks/deducts balance, and submits for Admin approval.
*(Note: As requested, the "Available Balance" header card has been excluded from both pages' UI design).*

---

## 2. Database Schema Design (Prisma ORM)

Update `prisma/schema.prisma` with the following enums and models:

```prisma
enum CryptoNetwork {
  TRC20
  ERC20
  BTC
}

enum WithdrawalStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

model WalletAddress {
  id        String        @id @default(uuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  network   CryptoNetwork
  address   String
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@unique([userId, network])
  @@index([userId])
}

model WithdrawalRequest {
  id              String           @id @default(uuid())
  userId          String
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  network         CryptoNetwork
  walletAddress   String
  amount          Decimal          @db.Decimal(12, 2)
  status          WithdrawalStatus @default(PENDING)
  rejectionReason String?
  processedAt     DateTime?
  processedById   String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([userId, status])
  @@index([status])
}
```

### Updates to Existing `User` Model:
```prisma
model User {
  // ... existing fields
  walletAddresses   WalletAddress[]
  withdrawals       WithdrawalRequest[]
}
```

---

## 3. API Endpoint Specifications

All endpoints are prefixed with `/api/v1`. Authentication requires header `Authorization: Bearer <JWT_ACCESS_TOKEN>`.

### A. Wallet Management APIs

#### 1. Get User Wallet Addresses
- **Endpoint**: `GET /api/v1/wallet/addresses`
- **Access**: User
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "w-101",
      "network": "TRC20",
      "address": "T9x...123",
      "updatedAt": "2026-09-22T12:00:00.000Z"
    },
    {
      "id": "w-102",
      "network": "ERC20",
      "address": "0x71C...89",
      "updatedAt": "2026-09-22T12:05:00.000Z"
    }
  ]
}
```

#### 2. Save / Update Wallet Address (Upsert)
- **Endpoint**: `POST /api/v1/wallet/addresses`
- **Access**: User
- **Request Body DTO**:
```json
{
  "network": "TRC20",
  "address": "T9x...123"
}
```
- **Validation Rules**:
  - `network`: Must be valid enum (`TRC20`, `ERC20`, `BTC`).
  - `address`: Must pass network-specific format regex (e.g. TRC20 starts with `T` and is 34 characters).
- **Response (200 OK / 201 Created)**:
```json
{
  "success": true,
  "message": "TRC20 address updated successfully",
  "data": {
    "id": "w-101",
    "network": "TRC20",
    "address": "T9x...123",
    "updatedAt": "2026-09-22T12:00:00.000Z"
  }
}
```

---

### B. Withdrawal Request APIs

#### 1. Request Withdrawal
- **Endpoint**: `POST /api/v1/withdrawals`
- **Access**: User
- **Request Body DTO**:
```json
{
  "amount": 100.00,
  "network": "TRC20"
}
```
- **Business Logic & Guards**:
  - Verify user active state (`isActive === true`).
  - Verify user has a saved wallet address for the requested `network`.
  - Check `amount >= MIN_WITHDRAWAL_LIMIT` (e.g., $10.00).
  - Verify `amount <= user.balance`.
  - Check if user already has an active `PENDING` request (optional policy).
  - Execute within Prisma transaction: deduct user balance, create transaction ledger entry, create withdrawal record.
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Withdrawal request submitted successfully",
  "data": {
    "id": "req-999",
    "amount": "100.00",
    "network": "TRC20",
    "walletAddress": "T9x...123",
    "status": "PENDING",
    "createdAt": "2026-09-22T22:50:00.000Z"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Insufficient balance / Wallet address not bound for network.
  - `422 Unprocessable Entity`: Validation failed.

#### 2. Get User Withdrawal History
- **Endpoint**: `GET /api/v1/withdrawals/history`
- **Access**: User
- **Query Params**: `page=1`, `limit=10`, `status=PENDING`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "req-999",
      "amount": "100.00",
      "network": "TRC20",
      "walletAddress": "T9x...123",
      "status": "PENDING",
      "createdAt": "2026-09-22T22:50:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### C. Admin Management APIs

#### 1. List All Withdrawal Requests
- **Endpoint**: `GET /api/v1/admin/withdrawals`
- **Access**: Admin (`RolesGuard(ADMIN)`)
- **Query Params**: `page`, `limit`, `status`, `search` (username/email)

#### 2. Approve Withdrawal Request
- **Endpoint**: `PATCH /api/v1/admin/withdrawals/:id/approve`
- **Access**: Admin (`RolesGuard(ADMIN)`)
- **Response**: Sets status to `APPROVED`, records `processedAt` and `processedById`.

#### 3. Reject Withdrawal Request (With Refund)
- **Endpoint**: `PATCH /api/v1/admin/withdrawals/:id/reject`
- **Access**: Admin (`RolesGuard(ADMIN)`)
- **Request Body**:
```json
{
  "reason": "Invalid wallet address format"
}
```
- **Business Logic**:
  - Reverts user balance (`User.balance + amount`).
  - Log `Transaction` (type `CREDIT`, referenceType `WITHDRAWAL_REFUND`).
  - Sets withdrawal status to `REJECTED`.

---

## 4. Implementation Best Practices & Security Guidelines

1. **Atomic Financial Transactions**:
   All balance updates must be wrapped inside `prisma.$transaction()` to guarantee data integrity, preventing double-spending and race conditions.

2. **Network Address Regex Validation**:
   - **TRC20**: `/^T[a-zA-Z0-9]{33}$/`
   - **ERC20**: `/^0x[a-fA-F0-9]{40}$/`
   - **BTC**: `/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/`

3. **Frontend UX Standards**:
   - Dynamic quick-select pill buttons updating input state.
   - Responsive notification banners when no address is bound for selected network.
   - Disable submission button during pending API calls or invalid inputs.

4. **Security & Auditing**:
   - Rate limiting on withdrawal submission (`ThrottlerGuard`).
   - Audit logging for admin approval/rejection actions.
