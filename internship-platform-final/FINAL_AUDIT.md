# Final Internship Platform Audit

This build is a consolidated implementation pass against the six assignment areas.

## Included in this pass
- Public Space: friends/follow, friend-based post limits, public/friends privacy, text/media posts, duplicate prevention, rate limiting, likes, comments, shares, saves, reports, views, mentions, notifications, search/feed prioritization, edit/delete controls.
- Profile: editable profile details plus persistent profile picture upload/remove (JPG/PNG/WEBP/GIF, 5 MB).
- Forgot Password: email/mobile lookup, 24-hour request restriction, OTP expiry/attempt controls, temporary letters-only password, forced password change, reset history.
- Subscriptions: Free/Bronze/Silver/Gold quotas, Razorpay Test Mode support, mock mode, payment window enforcement, payment verification, invoices/history, renewal/cancellation, duplicate payment protection.
- Internship Applications: quota enforcement, history, optional generated-resume attachment.
- Premium Resume Builder: subscription gate, email OTP, ₹50 generation flow, Razorpay/mock payment, PDF generation, 5 ATS templates, color/font selection, preview, profile photo, versions, default resume, invoice and download tracking.
- Languages: English, Spanish, Hindi, Portuguese, Chinese, French; French OTP; preference persistence and language history.
- Login Security: browser/OS/device/IP/location logging, Chrome OTP, mobile 10 AM–1 PM IST restriction, trusted devices, active sessions, sign out other devices.
- Database: startup schema/migrations for legacy column compatibility.

## Configuration required for live integrations
- PostgreSQL credentials in `backend/.env`
- Razorpay Test Mode keys for real test checkout
- SMTP credentials for real email delivery
- Optional SMS webhook for real SMS delivery
- `DEV_SHOW_OTP=true` is intended for local/demo testing; set it to `false` when real OTP delivery is configured.

## Verification performed
- All backend JavaScript files pass Node syntax checking.
- The final browser build still needs to be run in the user's local environment because dependency installation/browser integration depends on the local machine and PostgreSQL configuration.
