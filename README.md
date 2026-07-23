# Calendar App

An installable Progressive Web App for personal scheduling, reminders, availability checking, and calendar management.

## Features

- Create, edit, delete, reschedule, and complete appointments.
- Quick creation for today, tomorrow, next week, and next month.
- Custom date and time scheduling.
- Daily, weekly, monthly, and agenda calendar views.
- Daily, weekly, and monthly recurring appointments.
- Conflict detection before saving appointments.
- Available free time slots from 8 AM to 8 PM.
- Dashboard with today schedule, upcoming appointments, missed count, busy hours, and completion progress.
- Search and category filtering.
- Appointment categories, colors, tags, notes, attachment references, priority, and location.
- Productivity insights and category statistics.
- Offline support with a service worker.
- Local browser storage.
- Optional local PIN lock.
- Light and dark theme support.

## Run Locally

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Install On iPhone

1. Deploy this repository with GitHub Pages or another HTTPS host.
2. Open the HTTPS link in Safari on your iPhone.
3. Tap Share.
4. Tap Add to Home Screen.
5. Open Calendar App from the new Home Screen icon.

## GitHub Pages

In the repository settings:

1. Go to Settings.
2. Open Pages.
3. Set Source to Deploy from a branch.
4. Select the `main` branch and `/root`.
5. Save.

Your app will be available at:

```text
https://gha1210.github.io/Calendar-app/
```

## Notification Note

The app can request browser notification permission and schedule reminders while active. For guaranteed reminders when the PWA is fully closed, add a backend push notification service in a future version.
