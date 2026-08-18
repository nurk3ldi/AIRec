# Записи — версия 2 (архив)

Календарь-месяц: сетка 7×6, панель дня справа, окно записи, поиск по клиенту.
Снят с `/appointments` **2026-08-18**, чтобы третий вариант проектировался с
чистого листа — прежняя раскладка не должна ничего решать за него.

Раньше здесь же лежала версия 1 (сутки в виде прокручиваемой шкалы времени);
её удалили с диска, она остаётся в коммите `1e0c045`.

## Что внутри

| Файл | Что делал |
| --- | --- |
| `pages/appointments.jsx` | владел тремя состояниями экрана: показанный месяц, выбранный день, записи |
| `components/appointments/MonthCalendar.jsx` | сетка 7×6, всегда шесть строк; выбор месяца и года; выходные дни из графика работы |
| `components/appointments/DayPanel.jsx` | колонка выбранного дня |
| `components/appointments/BookingPanel.jsx` | форма записи, два режима — создание и правка |
| `components/appointments/BookingDetails.jsx` | окно записи: чтение и переход в правку |
| `components/appointments/BookingRow.jsx` | строка записи в колонке дня |
| `components/appointments/CalendarSearch.jsx` | поле поиска в шапке календаря |
| `components/appointments/SearchResults.jsx` | выпадающий список найденного |

## Как вернуть

Дерево папок здесь **повторяет `src/`**, поэтому импорты внутри файлов
(`../lib/api`, `../../lib/dates`) записаны относительно `src/`, а не этой
папки — из архива они никуда не ведут, и это нормально: сюда никто не
импортирует, так что в сборку эти файлы не попадают, а `oxlint` путей не
разрешает и проходит по ним чисто. Возврат — обычное копирование, править
импорты не нужно:

```sh
cp -r src/archive/appointments-v2/pages/. src/pages/
cp -r src/archive/appointments-v2/components/. src/components/
```

…и вернуть маршрут в `src/App.jsx`.

## Что осталось жить в `src/`

Данные — не оформление, и следующий вариант начнётся с них, поэтому здесь их
нет:

- `lib/api.js` — `listAppointments`, `getSlots`, `createAppointment`,
  `updateAppointment`, `deleteAppointment`
- `lib/appointments.js` — `toBlock`, `stateOf`, `statusLabel`, `BOOKING_COLORS`
  (на него ссылается CLAUDE.md как на пример цвета, различающего записи)
- `lib/dates.js` — русские названия месяцев и дней, `monthGrid`, `dayKey`
- `styles/Appointments.module.css` — фон страницы

Бэкенд не тронут: `/appointments`, `/appointments/slots` и архивация записей
работают как работали.
