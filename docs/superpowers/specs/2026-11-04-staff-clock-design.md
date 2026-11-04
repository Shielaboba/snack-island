# Staff clock in / out (selfie)

Snack Island has two staff, **Shai** and **Den**, who share one staff login. Clock-in and clock-out use a name dropdown plus a selfie. Punch time is the capture (or typed override) time, not when someone later approves.

## Screens

- **Clock** (`/clock`) — staff (role 1). Pick Shai or Den. Large current time (Asia/Manila). Only the next action: Clock in *or* Clock out. After tap: time stays left; camera + **Capture clock in/out** on the right. Selfie required. Time starts at capture. Status note: waiting / approved / declined. They can **Request OT** if they clocked in before **2:00 PM**, or after **10:00 PM** (Asia/Manila). Clock-out asks if they have ≥ 2 extra hours and never requested. Time keeps running while OT waits for approval.
- **Attendance** (`/attendance`) — admin and auditor. Same table: in, out, OT, photo links (centered modal), pencil (edit times), trash (delete), Add missed punch, **Payroll Calculator**, Approve/Decline in and out, **Record OT** when staff did not request it. Both roles see photos. Payroll Calculator: staff, start/end date, rate per day, deduction. Each closed session with approved clock-in and clock-out is 1 day. 2 hours of approved OT = half of the daily rate. Pending punches and pending OT are not paid.

## Rules

- One open shift per person. Second clock-in is blocked until they clock out (or in is declined).
- Both people may be clocked in at once. Independent of POS Start Day / End of Day.
- A shift that crosses midnight is one session.
- OT hours are `max(0, hours − 8)` (early in and late out are the same pool). Recorded only if requested or if admin/auditor tap **Record OT**. Staff can request after an early clock-in (before 2:00 PM) or after 10:00 PM. Minimum 2 hours past 8. Time keeps running while OT is pending. No request, declined, or under 2 hours → OT is not recorded unless admin/auditor record it.
- Clock-in declined: not on the clock; they may clock in again (new row). Clock status follows the open shift, not a previous declined punch.
- Clock-out declined: still on the clock; they may capture out again (overwrites pending/declined out).
- Admin/auditor typed times are overrides (no selfie, status approved). Forgot in, forgot out, or wrong time.
- Delete confirms; photos for that shift are removed.
- Selfies compressed before upload: JPEG, max 720px long side, quality ~0.7.

## Data

New table `staff_clock_shifts` only. New storage bucket `staff-clock-photos`. No FKs to orders/expenses/sessions.

| Column | Meaning |
|---|---|
| staff_name | `Shai` or `Den` |
| clock_in_at / clock_out_at | Punch timestamps |
| clock_in_photo_path / clock_out_photo_path | Storage paths (null on override) |
| clock_in_status / clock_out_status | `pending` \| `approved` \| `declined` |
| clock_in_override / clock_out_override | Typed by admin/auditor |
| ot_requested / ot_status / ot_requested_at | Staff OT request; `pending` \| `approved` \| `declined` |

App-level role gating on routes. RLS open like other POS tables in this project.

## Calls

- Declined clock-in → not open; new punch is a new row.
- Declined clock-out → still open; recapture overwrites out fields as pending.
