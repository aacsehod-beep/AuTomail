# Aurora University — Bulk Mail System

A full-stack Node.js + React application to send bulk emails to students — attendance reports, circulars, announcements, exam notices, fee reminders, events, and more.

---

## Quick Start

### 1. Install dependencies
```
npm install
```

### 2. Configure environment
```
cp .env.example .env
```
Edit `.env` and add your **SendGrid API key**:
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
SENDER_EMAIL=no-reply@aurora.edu
SENDER_NAME=Aurora University
```

### 3. Run (development)
```
npm run dev
```
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

### 4. Production build
```
npm run build
npm start
```

---

## Features

| Feature | Description |
|---|---|
| 📊 Attendance Mailer | Upload xlsx → select sections → send per-student attendance reports |
| 📨 Bulk Mailer | Circulars, announcements, exam notices, events, fee reminders, custom HTML |
| 👥 Section Filtering | Select one or all sections to target |
| ⚠️ Threshold Filter | Only mail students below attendance % |
| 📝 Templates | Save & reuse email templates |
| ⏰ Scheduler | Schedule campaigns for future date/time |
| 📈 Dashboard | Analytics: send rates, trends, section breakdown |
| 🗒️ Logs | Full paginated send history with CSV export |
| 🔄 Real-time Progress | Live SSE progress bar with cancel support |

---

## Sheet Format (Attendance)

| Row | Content |
|---|---|
| Row 7 | Week/period info (e.g., "Week 12, March 2026") |
| Row 8 | Subject headers at columns 5, 8, 11, 14, 17, 20 |
| Row 9+ | Student data: Col 2=Name, Col 3=RegNo, Col 4=Email, Col 7/10/13/16/19/22=Attendance % |

---

## Mail Types Supported

- `attendance` — Personalised attendance report per student
- `circular` — Official circular with reference number
- `announcement` — General announcements
- `event` — Event notices
- `exam` — Exam timetable / notices
- `holiday` — Holiday notifications
- `fee` / `fee_reminder` — Fee payment reminders with itemized dues
- `general` — Plain general message
- `custom` — Full custom HTML with template variables
