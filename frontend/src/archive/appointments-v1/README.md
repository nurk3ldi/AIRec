# Записи — вариант 1 (архив)

The first build of the `/appointments` page, set aside on **2026-08-17** so a
second version could be designed from a blank page. Nothing here is imported by
the running app; the folder mirrors `frontend/src/` so restoring is a move back
to the same paths.

## What's in it

| Archived file | Belongs at |
| --- | --- |
| `pages/appointments.jsx` | `src/pages/appointments.jsx` |
| `components/appointments/*.jsx` | `src/components/appointments/` |
| `styles/Appointments.module.css` | `src/styles/Appointments.module.css` |

## What was deliberately *not* archived

`lib/dates.js`, `lib/appointments.js`, `lib/schedule.js` and the appointment
calls in `lib/api.js` stayed where they are. They are data and rules, not this
page's design — Russian month names, `toBlock`, the overlap-lane layout and
`closedRanges` are as true for a second version as for this one, and
`lib/schedule.js` is used by the Бизнес page regardless.

`styles/Appointments.module.css` is the exception: a copy is here because the
live one was repainted white for the empty page, and the archived version is
the one that matches these components.

## What this version did

One card holding everything: a toolbar (date badge, «Сегодня» stepper,
день/неделя switch, client search, «+ Запись»), a mini-month, a live
«Сейчас / Дальше» panel, and a 24-hour scrolling grid at 256px an hour with a
sticky day header, a live "now" line, side-by-side lanes for overlapping
bookings, and closed hours washed out from the working week.

Two dialogs: creating a booking (service → day → free slot, times only ever
offered by `GET /appointments/slots`), and opening one (status switch, the
booking as one readable line, and a full edit form).

Search hung under the toolbar's field and looked through the whole history by
name or phone, split into «Предстоящие» and «Прошедшие».

## To restore

Move the three groups back to the paths in the table above and repaint
`Appointments.module.css` from the archived copy. The backend it talks to has
not changed.
