# Arbebus App Store Privacy Checklist

## App Store Connect privacy answers

Declare only data actually collected/transmitted by the app and SDKs. Apple requires privacy answers for data collected by the app and third-party partners.

### Recommended current Arbebus label

- **Location / Precise Location**: Used for app functionality: route planning, nearby stops, walking guidance, stop alerts. Not sold. Not used for third-party advertising.
- **Identifiers / Device token**: Push notification token, used only to deliver trip notifications.
- **Diagnostics**: Only if Sentry/analytics is enabled. Use app functionality / diagnostics, not tracking.
- **Usage Data**: Only if analytics is enabled. Use product analytics, not advertising.

## Tracking

Set tracking to **No** unless you add ad SDKs or cross-app tracking.

## Required URLs

- Privacy Policy URL: use `docs/PRIVACY_POLICY_LT.md` and/or public website page.
- Privacy Choices URL: optional; recommended if user accounts/analytics opt-out is added.

## Build notes

Background location and notifications require TestFlight/development build validation. Expo Go is not enough for iOS background execution testing.
