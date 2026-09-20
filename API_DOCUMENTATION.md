# Task Commission Platform - Frontend API Documentation (Next.js)

This document contains full API documentation, TypeScript data types, request/response payloads, authentication workflow, and Next.js integration code snippets for frontend development.

---

## 1. General API Overview

- **Base URL**: `http://localhost:4000/api/v1` (Environment Variable: `NEXT_PUBLIC_API_BASE_URL`)
- **Swagger Interactive API Docs**: `http://localhost:4000/api/docs`
- **Default Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <accessToken>` (Required for all protected endpoints)
- **File Upload Header**:
  - `Content-Type: multipart/form-data`

---

## 2. Global Error Payload Structure

All validation and HTTP errors return standard JSON responses:

### 400 Bad Request (Validation Error Example)
```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "invitationCode",
      "messages": ["Invitation code is mandatory for registration"]
    }
  ]
}
```

### Generic Error Response (401, 403, 404, 409)
```json
{
  "statusCode": 401,
  "message": "Invalid or expired access token",
  "error": "Unauthorized"
}
```

---

## 3. TypeScript Interfaces & Data Models

Copy these interfaces into your Next.js project (e.g. `@/types/api.ts`):

```typescript
export type Role = 'ADMIN' | 'AGENT' | 'USER';
export type AccountType = 'MAIN' | 'TRAINING';
export type TaskStatus = 'GENERATED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TransactionType = 'CREDIT' | 'DEBIT';

export interface User {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: Role;
  accountType: AccountType;
  balance: number | string;
  invitationCode: string;
  parentUserId?: string | null;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TodayTaskProgress {
  totalGeneratedToday: number;
  completedToday: number;
  dailyLimit: number; // Default 33
  remainingToday: number;
}

export interface UserProfileResponse extends User {
  parentUser?: {
    id: string;
    username: string;
    email: string | null;
  } | null;
  childAccounts?: Array<{
    id: string;
    username: string;
    accountType: AccountType;
    balance: number | string;
  }>;
  invitedBy?: {
    id: string;
    username: string;
  } | null;
  _count?: {
    invitees: number;
  };
  todayTaskProgress: TodayTaskProgress;
}

export interface Product {
  id: string;
  title: string;
  image: string;
  price: number | string;
  commissionRate: number | string; // Default 2%
  commission: number | string;     // Calculated amount: price * commissionRate / 100
  isHomeProduct: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductTask {
  id: string;
  userId: string;
  productId: string;
  priceSnapshot: number | string;
  commissionSnapshot: number | string;
  earnedCommission: number | string | null;
  rating: number | null;
  comment: string | null;
  status: TaskStatus;
  generatedAt: string;
  completedAt: string | null;
  product: Product;
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface UserTasksResponse {
  activeTask: ProductTask | null;
  recentCompleted: ProductTask[];
}
```

---

## 4. API Endpoints Reference

### A. Authentication (`/api/v1/auth`)

#### 1. Register User
- **Method & Path**: `POST /api/v1/auth/register`
- **Auth Guard**: Public
- **Description**: Registers a new user account. An active referrer `invitationCode` is mandatory.

**Request Body**:
```json
{
  "username": "johndoe",
  "password": "password123",
  "email": "john@example.com",
  "phone": "+1234567890",
  "invitationCode": "INVITE123"
}
```

**Success Response (201 Created)**:
```json
{
  "user": {
    "id": "u123-uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "role": "USER",
    "accountType": "MAIN",
    "balance": "0.00",
    "invitationCode": "NEWINV1",
    "createdAt": "2026-09-16T23:00:00.000Z"
  },
  "accessToken": "eyJhbGciOi..."
}
```

---

#### 2. Login User
- **Method & Path**: `POST /api/v1/auth/login`
- **Auth Guard**: Public
- **Description**: Authenticates user using email and password.

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200 OK)**:
```json
{
  "user": {
    "id": "u123-uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "role": "USER",
    "accountType": "MAIN",
    "balance": "150.00",
    "invitationCode": "NEWINV1"
  },
  "accessToken": "eyJhbGciOi..."
}
```

---

### B. User Profile (`/api/v1/profile`)

#### 4. Get Current User Profile
- **Method & Path**: `GET /api/v1/profile`
- **Auth Guard**: Bearer JWT Required
- **Description**: Returns logged-in user profile, current balance, linked accounts, and today's task execution progress.

**Headers**:
`Authorization: Bearer <accessToken>`

**Success Response (200 OK)**:
```json
{
  "id": "u123-uuid",
  "username": "johndoe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "role": "USER",
  "accountType": "MAIN",
  "balance": "250.00",
  "invitationCode": "NEWINV1",
  "parentUserId": null,
  "parentUser": null,
  "childAccounts": [
    {
      "id": "child-uuid",
      "username": "trainee_john",
      "accountType": "TRAINING",
      "balance": "100.00"
    }
  ],
  "invitedBy": {
    "id": "ref-uuid",
    "username": "sponsor_user"
  },
  "_count": {
    "invitees": 3
  },
  "createdAt": "2026-09-16T23:00:00.000Z",
  "todayTaskProgress": {
    "totalGeneratedToday": 5,
    "completedToday": 4,
    "dailyLimit": 33,
    "remainingToday": 28
  }
}
```

---

### C. Tasks Workflow (`/api/v1/tasks`)

#### 5. Generate New Task
- **Method & Path**: `POST /api/v1/tasks/generate`
- **Auth Guard**: Bearer JWT Required
- **Description**: Randomly picks an active product where `price <= user.balance` and creates a new task snapshot with `TaskStatus.GENERATED`.
- **Rules**:
  - Max 33 tasks per day per user.
  - Cannot generate if user already has an active pending task (`PENDING` or `IN_PROGRESS`).

**Success Response (201 Created)**:
```json
{
  "id": "task-111-uuid",
  "userId": "u123-uuid",
  "productId": "prod-555-uuid",
  "priceSnapshot": "99.99",
  "commissionSnapshot": "10.50",
  "earnedCommission": null,
  "rating": null,
  "comment": null,
  "status": "GENERATED",
  "generatedAt": "2026-09-16T23:30:00.000Z",
  "completedAt": null,
  "product": {
    "id": "prod-555-uuid",
    "title": "Wireless Noise Canceling Headphones",
    "image": "/uploads/img-1726500000.jpg",
    "price": "99.99",
    "commissionRate": "10.50",
    "isHomeProduct": true,
    "isActive": true
  }
}
```

---

#### 6. Start Task
- **Method & Path**: `POST /api/v1/tasks/:id/start`
- **Auth Guard**: Bearer JWT Required
- **Description**: Locks the task into status `PENDING` and debits the product `priceSnapshot` from user's balance.

**URL Parameter**: `id` - Task ID

**Success Response (200 OK)**:
```json
{
  "task": {
    "id": "task-111-uuid",
    "userId": "u123-uuid",
    "productId": "prod-555-uuid",
    "priceSnapshot": "99.99",
    "commissionSnapshot": "10.50",
    "status": "IN_PROGRESS",
    "product": {
      "id": "prod-555-uuid",
      "title": "Wireless Noise Canceling Headphones",
      "image": "/uploads/img-1726500000.jpg",
      "price": "99.99",
      "commissionRate": "10.50"
    }
  },
  "updatedBalance": "150.01"
}
```

---

#### 7. Submit Task Review
- **Method & Path**: `POST /api/v1/tasks/:id/submit`
- **Auth Guard**: Bearer JWT Required
- **Description**: Submits rating (1 to 5) and optional comment. Updates task status to `COMPLETED`, refunds `priceSnapshot` + credits `earnedCommission` (`priceSnapshot * commissionRate / 100`) back to user's wallet.

**URL Parameter**: `id` - Task ID

**Request Body**:
```json
{
  "rating": 5,
  "comment": "Outstanding quality, very satisfied!"
}
```

**Success Response (200 OK)**:
```json
{
  "task": {
    "id": "task-111-uuid",
    "userId": "u123-uuid",
    "productId": "prod-555-uuid",
    "priceSnapshot": "99.99",
    "commissionSnapshot": "10.50",
    "earnedCommission": "10.50",
    "rating": 5,
    "comment": "Outstanding quality, very satisfied!",
    "status": "COMPLETED",
    "completedAt": "2026-09-16T23:35:00.000Z",
    "product": {
      "id": "prod-555-uuid",
      "title": "Wireless Noise Canceling Headphones"
    }
  },
  "earnedCommission": "10.50",
  "updatedBalance": "260.50"
}
```

---

#### 8. Get User Tasks List
- **Method & Path**: `GET /api/v1/tasks`
- **Auth Guard**: Bearer JWT Required
- **Description**: Returns current active pending task (`GENERATED` or `IN_PROGRESS`) and up to 20 most recently completed tasks.

**Success Response (200 OK)**:
```json
{
  "activeTask": {
    "id": "task-111-uuid",
    "status": "IN_PROGRESS",
    "priceSnapshot": "99.99",
    "commissionSnapshot": "10.50",
    "product": { ... }
  },
  "recentCompleted": [
    {
      "id": "task-100-uuid",
      "status": "COMPLETED",
      "earnedCommission": "15.00",
      "rating": 5,
      "completedAt": "2026-09-16T22:00:00.000Z",
      "product": { ... }
    }
  ]
}
```

---

#### 8.1. Get Only Pending Task
- **Method & Path**: `GET /api/v1/tasks/pending`
- **Auth Guard**: Bearer JWT Required
- **Description**: Returns only the current pending task (`GENERATED` or `IN_PROGRESS`) for the logged-in user, or `null` if no pending task exists.

**Success Response (200 OK)**:
```json
{
  "id": "task-111-uuid",
  "userId": "u123-uuid",
  "productId": "prod-555-uuid",
  "stepNumber": 1,
  "priceSnapshot": "99.99",
  "commissionSnapshot": "10.50",
  "earnedCommission": null,
  "rating": null,
  "comment": null,
  "status": "IN_PROGRESS",
  "generatedAt": "2026-09-16T23:30:00.000Z",
  "completedAt": null,
  "product": {
    "id": "prod-555-uuid",
    "title": "Wireless Noise Canceling Headphones",
    "image": "/uploads/img-1726500000.jpg",
    "price": "99.99",
    "commissionRate": "10.50",
    "isHomeProduct": true,
    "isActive": true
  }
}
```

---


### D. Public Products Catalog (`/api/v1/products`)

#### 9. Get Home Products Only
- **Method & Path**: `GET /api/v1/products/home` or `GET /api/v1/home-products`
- **Auth Guard**: Public / None
- **Description**: Returns a list of all active marketplace products flagged for home display (`isHomeProduct: true` and `isActive: true`).

**Success Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "prod-555-uuid",
      "title": "Wireless Noise Canceling Headphones",
      "image": "http://localhost:4000/uploads/img-1726500000.jpg",
      "price": "99.99",
      "commissionRate": "2.00",
      "commission": "2.00",
      "isHomeProduct": true,
      "isActive": true,
      "createdAt": "2026-09-17T10:00:00.000Z",
      "updatedAt": "2026-09-17T10:00:00.000Z"
    }
  ],
  "timestamp": "2026-09-19T10:10:00.000Z"
}
```

---

### E. Admin & Agent Portal (`/api/v1/admin`)

> **Note**: Requires role `ADMIN` or `AGENT` (except Onboard Agent which requires `ADMIN`).

#### 9. Image Upload
- **Method & Path**: `POST /api/v1/admin/upload`
- **Auth Guard**: Bearer JWT (`ADMIN` or `AGENT`)
- **Content-Type**: `multipart/form-data`

**Form Body**: `file` (binary image file - JPEG, PNG, WEBP, GIF)

**Success Response (201 Created)**:
```json
{
  "url": "/uploads/img-1726500000-123456789.png"
}
```

---

#### 10. Create Marketplace Product
- **Method & Path**: `POST /api/v1/admin/products`
- **Auth Guard**: Bearer JWT (`ADMIN` or `AGENT`)
- **Content-Type**: `multipart/form-data` OR `application/json`
- **Features**:
  - Direct image upload in the same request via form field `image` (binary file)
  - Default `commissionRate` is **2%** if not passed
  - `commission` is automatically calculated (`price * commissionRate / 100`, e.g. Price 200$, Rate 2% => Commission 4.00$)

**Request Body Example (`multipart/form-data` or `json`)**:
```json
{
  "title": "Smart Watch Ultra",
  "price": 200.00,
  "commissionRate": 2.0,
  "isHomeProduct": true,
  "isActive": true
}
```
*(Plus attach image binary file in `image` field, or pass `"image": "/uploads/..."` in JSON)*

**Success Response (201 Created)**:
```json
{
  "id": "prod-uuid",
  "title": "Smart Watch Ultra",
  "image": "/uploads/img-1726500000-123456789.png",
  "price": "200.00",
  "commissionRate": "2.00",
  "commission": "4.00",
  "isHomeProduct": true,
  "isActive": true,
  "createdAt": "2026-09-17T10:00:00.000Z",
  "updatedAt": "2026-09-17T10:00:00.000Z"
}
```

---

#### 11. Update Marketplace Product
- **Method & Path**: `PUT /api/v1/admin/products/:id`
- **Auth Guard**: Bearer JWT (`ADMIN` or `AGENT`)

**Request Body (All fields optional)**:
```json
{
  "title": "Updated Smart Watch Ultra",
  "price": 179.99,
  "isActive": true
}
```

**Success Response (200 OK)**: Returns updated `Product` object.

---

#### 12. List Marketplace Products (Paginated)
- **Method & Path**: `GET /api/v1/admin/products`
- **Auth Guard**: Bearer JWT (`ADMIN` or `AGENT`)
- **Query Parameters**:
  - `search` (optional): Filter product title (case-insensitive)
  - `isHomeProduct` (optional): Filter by featured status (`true` or `false`)
  - `isActive` (optional): Filter by active status (`true` or `false`)
  - `page` (optional): default `1`
  - `limit` (optional): default `10`

**Example URL**: `/api/v1/admin/products?search=watch&isActive=true&page=1&limit=10`

**Success Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "prod-uuid",
      "title": "Smart Watch Ultra",
      "image": "http://localhost:4000/uploads/img-1726500000-123456789.png",
      "price": "200.00",
      "commissionRate": "2.00",
      "commission": "4.00",
      "isHomeProduct": true,
      "isActive": true,
      "createdAt": "2026-09-17T10:00:00.000Z",
      "updatedAt": "2026-09-17T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```


---

#### 13. Search / Query Users List
- **Method & Path**: `GET /api/v1/admin/users`
- **Auth Guard**: Bearer JWT (`ADMIN` or `AGENT`)
- **Query Parameters**:
  - `search` (optional): Filter username/email/phone/invitationCode
  - `role` (optional): `'ADMIN' | 'AGENT' | 'USER'`
  - `accountType` (optional): `'MAIN' | 'TRAINING'`
  - `page` (optional): default `1`
  - `limit` (optional): default `20`

**Example URL**: `/api/v1/admin/users?search=john&role=USER&page=1&limit=10`

**Success Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "u123-uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "role": "USER",
      "accountType": "MAIN",
      "balance": "250.00",
      "invitationCode": "NEWINV1",
      "parentUserId": null,
      "isActive": true,
      "createdAt": "2026-09-16T23:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

#### 14. Adjust User Balance (Credit/Debit)
- **Method & Path**: `POST /api/v1/admin/users/:id/balance`
- **Auth Guard**: Bearer JWT (`ADMIN` or `AGENT`)
- **URL Parameter**: `id` - Target User ID

**Request Body**:
```json
{
  "type": "CREDIT",
  "amount": 50.00,
  "note": "Top-up reward bonus for promotional milestone"
}
```

**Success Response (201 Created)**:
```json
{
  "user": {
    "id": "u123-uuid",
    "username": "johndoe",
    "balance": "300.00",
    "accountType": "MAIN"
  },
  "transaction": {
    "id": "tx-999-uuid",
    "userId": "u123-uuid",
    "type": "CREDIT",
    "amount": "50.00",
    "balanceBefore": "250.00",
    "balanceAfter": "300.00",
    "referenceType": "ADMIN_ADJUSTMENT",
    "note": "Top-up reward bonus for promotional milestone",
    "createdAt": "2026-09-16T23:40:00.000Z"
  }
}
```

---

#### 15. Create Linked Training Account
- **Method & Path**: `POST /api/v1/admin/users/:id/training-account`
- **Auth Guard**: Bearer JWT (`ADMIN` or `AGENT`)
- **URL Parameter**: `id` - Parent User ID

**Request Body**:
```json
{
  "username": "trainee_john",
  "password": "trainPass123",
  "email": "trainee@example.com",
  "phone": "+1555000111",
  "initialBalance": 100.00
}
```

**Success Response (201 Created)**: Returns created training user object linked to `parentUserId`.

---

#### 16. Onboard Agent Account
- **Method & Path**: `POST /api/v1/admin/agents`
- **Auth Guard**: Bearer JWT (`ADMIN` only)

**Request Body**:
```json
{
  "username": "agent_smith",
  "password": "agentPass123",
  "email": "agent@example.com",
  "phone": "+1987654321"
}
```

**Success Response (201 Created)**: Returns new agent user object.

---

#### 17. Update User Profile
- **Method & Path**: `PUT /api/v1/admin/users/:id`
- **Auth Guard**: Bearer JWT (`ADMIN` or `AGENT`)
- **URL Parameter**: `id` - Target User ID

**Request Body** (All fields optional):
```json
{
  "username": "johndoe_updated",
  "email": "john.updated@example.com",
  "phone": "+1234567890",
  "password": "newPassword123",
  "role": "USER",
  "accountType": "MAIN",
  "balance": 150.00,
  "isActive": true
}
```

**Success Response (200 OK)**:
```json
{
  "id": "u123-uuid",
  "username": "johndoe_updated",
  "email": "john.updated@example.com",
  "phone": "+1234567890",
  "role": "USER",
  "accountType": "MAIN",
  "balance": "150.00",
  "invitationCode": "NEWINV1",
  "parentUserId": null,
  "isActive": true,
  "createdAt": "2026-09-16T23:00:00.000Z",
  "updatedAt": "2026-09-19T08:20:00.000Z"
}
```

---

#### 18. Delete User Account
- **Method & Path**: `DELETE /api/v1/admin/users/:id`
- **Auth Guard**: Bearer JWT (`ADMIN` or `AGENT`)
- **URL Parameter**: `id` - Target User ID to delete

**Success Response (200 OK)**:
```json
{
  "message": "User deleted successfully",
  "id": "u123-uuid"
}
```

---

## 5. Next.js API Client Boilerplate Example

You can implement an Axios API Client (`@/lib/api-client.ts`) with automatic token refresh in Next.js:

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response Interceptor: Handle Token Expiration & Refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 6. Complete Commission Task Execution Flow in Next.js

Below is an example flow for the task commission execution cycle in a Next.js page or component:

```typescript
import { apiClient } from '@/lib/api-client';
import { ProductTask, UserTasksResponse, UserProfileResponse } from '@/types/api';

export async function runTaskLifecycle() {
  // 1. Fetch User Profile to verify balance & remaining today tasks
  const { data: profile } = await apiClient.get<UserProfileResponse>('/profile');
  if (profile.todayTaskProgress.remainingToday <= 0) {
    alert('Daily limit reached!');
    return;
  }

  // 2. Generate new Task
  const { data: generatedTask } = await apiClient.post<ProductTask>('/tasks/generate');
  console.log('Task Generated:', generatedTask.id);

  // 3. User clicks "Start Task" -> Debits user balance
  const { data: startResult } = await apiClient.post<{ task: ProductTask; updatedBalance: string }>(
    `/tasks/${generatedTask.id}/start`
  );
  console.log('Task Started! New Balance:', startResult.updatedBalance);

  // 4. User submits rating/review -> Refunds price + adds commission
  const { data: submitResult } = await apiClient.post<{
    task: ProductTask;
    earnedCommission: string;
    updatedBalance: string;
  }>(`/tasks/${generatedTask.id}/submit`, {
    rating: 5,
    comment: 'Great product and quick process!',
  });

  console.log('Task Completed! Commission Earned:', submitResult.earnedCommission);
  console.log('Updated Balance:', submitResult.updatedBalance);
}
```
