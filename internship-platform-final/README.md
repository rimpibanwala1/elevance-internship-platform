# Internship Platform — Final Build

This project is an integrated implementation of the six internship assignment areas:

1. Public Space: posts, media upload, likes, comments, shares, saves, reports, follow/friend requests, mentions, hashtags, privacy, friend-based daily posting limits, duplicate/spam/content validation, edit/delete window, notifications and personalized ordering.
2. Account recovery: email/mobile reset request, 24-hour cooldown, OTP expiry/attempt controls, generated letters-only temporary password, forced password change and audit history.
3. Subscriptions: Free/Bronze/Silver/Gold plans, monthly application quotas, payment window enforcement, Razorpay Test Mode integration, payment/subscription history and internship application enforcement.
4. Premium Resume Builder: premium access, email OTP, ₹50 payment flow, ATS templates, color/font selection, profile photo, PDF generation, multiple saved versions and default resume.
5. Languages: English, Spanish, Hindi, Portuguese, Chinese and French. French requires email OTP. Language changes are audited.
6. Login security: Chrome/new-device OTP verification, mobile login time window (10 AM–1 PM IST), trusted devices, IP/browser/device/location logging, sessions and sign-out-other-devices.

## Run

### 1. PostgreSQL
Create a database named `internship_platform` (or use your existing DB).

The backend automatically runs `backend/schema.sql` at startup and adds missing columns/tables.

### 2. Backend
```bash
cd backend
npm install
copy .env.example .env
npm run dev
```
On macOS/Linux use `cp .env.example .env`.

Fill your DB values and a strong JWT secret. For local demonstration, keep `PAYMENT_MODE=mock`. Set `DEV_SHOW_OTP=true` only for local testing; OTPs are then returned to the UI as demo OTPs. For a real email flow, configure SMTP and set `DEV_SHOW_OTP=false`.

For Razorpay Test Mode:
- set `PAYMENT_MODE=razorpay`
- add `RAZORPAY_KEY_ID`
- add `RAZORPAY_KEY_SECRET`

For mobile OTP delivery, configure `SMS_WEBHOOK_URL` with your approved SMS provider endpoint.

### 3. Frontend
```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```
Use `cp` instead of `copy` on macOS/Linux.

Open the Vite URL shown in the terminal (normally `http://localhost:5173`, or `http://localhost:5174` if 5173 is busy). The backend accepts both local Vite ports.

## Demo behavior
- Public Space Share records the share, opens a share dialog, supports device sharing when available, and provides a copyable deep link that opens the selected post.
- The app includes a common Back button for page-to-page navigation.
- Resume Builder provides preview, multiple ATS templates, paid generation, PDF download tracking and default-resume selection.

## Important
Never commit `.env` or real API/payment credentials. The provided `.env.example` contains placeholders only.

## Demo notes
The local mock payment mode is deliberately included so the complete application can be demonstrated without exposing real payment credentials. When Razorpay Test Mode credentials are configured, the same UI switches to Razorpay Checkout and verifies the payment signature on the backend.
