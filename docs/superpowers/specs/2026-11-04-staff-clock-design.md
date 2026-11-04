# Staff clock in / out (selfie)

Snack Island has two staff, **Shai** and **Den**, who share one staff login. Clock-in and clock-out use a name dropdown plus a selfie. Punch time is the capture (or typed override) time, not when someone later approves.

## Screens

- **Clock** (`/clock`) — staff (role 1). Pick Shai or Den. Large current time (Asia/Manila). Only the next action: Clock in *or* Clock out. After tap: time stays left; camera + **Capture clock in/out** on the right. Selfie required. Time starts at capture. Status note: waiting / approved / declined. After 10 hours on the clock they can **Request OT**. Time keeps running while OT waits for approval.
- **Attendance** (`/attendance`) — admin and auditor. Same table: in, out, OT, photo links (centered modal), pencil (edit times), trash (delete), Add missed punch, Approve/Decline in and out. Both roles see photos.

## Rules

- One open shift per person. Second clock-in is blocked until they clock out (or in is declined).
- Both people may be clocked in at once. Independent of POS Start Day / End of Day.
- A shift that crosses midnight is one session.
- OT is recorded only if staff tap **Request OT** on Clock. Minimum 2 hours (10 hours on the clock). Time keeps running while admin/auditor approve or decline; late approve does not change punch time or OT hours (`max(0, hours − 8)`). No request, declined, or under 2 hours → OT is not recorded.
- Clock-in declined: not on the clock; they may clock in again (new row).
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
