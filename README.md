# UEL EVNT PASS

QR check-in for university events. Create an event, import your attendee spreadsheet, hand out QR passes, and scan them at the door from any phone or laptop camera — fully offline-capable.

**Stack:** React 18 + Vite + TypeScript · Tailwind CSS · shadcn-style UI (Radix primitives) · lucide-react · `html5-qrcode` (scanning) · `qrcode` / `qrcode.react` (generation) · `xlsx` (import/export) · `jspdf` + `jszip` (pass downloads) · Dexie (IndexedDB) · PWA service worker.

---

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173  (also exposed on your LAN with --host)
```

> **Camera access needs HTTPS (or localhost).** To test the scanner on a phone on the same Wi-Fi, use a tunnel such as `npx localtunnel --port 5173` or `ngrok http 5173`, or just deploy (below) — Vercel/Netlify serve HTTPS automatically.

Production build and preview:

```bash
npm run build
npm run preview
```

---

## Deploy for free

### Vercel
1. Push the folder to a GitHub repo.
2. [vercel.com/new](https://vercel.com/new) → import the repo. Vercel auto-detects Vite.
3. Build command `npm run build`, output `dist` (defaults). `vercel.json` already rewrites all routes to `index.html` so `/scan/<id>` deep links work.

Or from the CLI: `npx vercel`.

### Netlify
1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**.
2. `netlify.toml` already sets the build command, publish dir and SPA redirect.

Or drag-and-drop the `dist/` folder onto Netlify Drop after `npm run build`.

---

## How to use it (organizer flow)

1. **Create an event** – title, date, location, organizer, optional capacity.
2. **Import attendees** – drop an `.xlsx` / `.csv`. Confirm which columns are *Full Name*, *Email*, *Student/Ticket ID* (auto-guessed). Every attendee gets a unique QR token.
3. **Download passes** – *PDF* (6 per A4 page, ready to print or email) or *ZIP* of PNGs (one per attendee + `index.csv` for mail-merge).
4. **At the door** – open **Scan** (or share the `/scan/<eventId>` link). Tap *Start camera*, point at a pass:
   - 🟢 **Checked in** – full-screen green, chime + vibration, timestamp recorded
   - 🟡 **Already checked in at HH:MM:SS** – amber warning, double-beep
   - 🔴 **QR not recognized** – red error, low buzz
   - Manual search below the camera checks anyone in with one tap; *Walk-in* adds an unregistered guest and checks them in.
5. **Export** – *Export attendance report (.xlsx)* with name, status, exact check-in time and a summary sheet.

---

## Data & offline behaviour

- **Everything is stored in the browser's IndexedDB** (Dexie). No account, no server. Data survives reloads and works with no connection.
- The app is a **PWA**: once loaded, the whole app shell is cached, so the scanner page opens even with no signal. On a phone, "Add to Home Screen" for a full-screen door-staff app.
- Every check-in is also appended to an **outbox**. If you set `VITE_SYNC_URL` (see `.env.example`), the outbox is POSTed as JSON whenever the browser comes back online, and queued while offline. With no URL set, everything simply stays local.
- **Important consequence:** the guest list lives on the device that imported it. For multiple door staff on different phones, either import the same sheet on each device, or plug in a shared backend (see below).

### Plugging in Supabase / Firebase (optional)

`src/lib/sync.ts` → replace `pushBatch()` with your client call, and `src/lib/db.ts` is the single place all reads/writes go through, so swapping Dexie for a remote table is contained. The QR payload format (`EPC|<eventId>|<token>`) and `qrToken` index are the only things the scanner needs.

---

## Project structure

```
uel-evnt-pass/
├── index.html
├── package.json
├── vite.config.ts            # React + PWA plugin, "@/" alias
├── tailwind.config.js        # Slate/Indigo theme tokens
├── tsconfig.json
├── vercel.json / netlify.toml
├── .env.example              # VITE_SYNC_URL (optional)
├── public/                   # favicon + PWA icons
└── src/
    ├── main.tsx              # mounts app, registers SW, starts sync listener
    ├── App.tsx               # routes: /  /event/:id  /scan/:id
    ├── index.css             # Tailwind + CSS variables
    ├── hooks/useOnline.ts
    ├── lib/
    │   ├── db.ts             # Dexie schema, check-in logic, QR payload format
    │   ├── importers.ts      # xlsx/csv parsing, column guessing, import, walk-ins
    │   ├── exporters.ts      # .xlsx report, PDF passes, ZIP passes
    │   ├── sync.ts           # offline outbox + flush-on-reconnect
    │   ├── audio.ts          # Web Audio chimes + vibration
    │   └── utils.ts          # cn(), token generator, date formatting
    ├── components/
    │   ├── ui/               # shadcn-style Button, Input, Card, Badge, Dialog, Progress, Select, Label
    │   ├── AppShell.tsx      # header with online/offline pill
    │   ├── StatCards.tsx     # Total / Checked In / Pending / Walk-ins + progress bar
    │   ├── FileDropzone.tsx
    │   ├── ColumnMapper.tsx  # column-mapping confirmation dialog
    │   ├── AttendeeTable.tsx # searchable list, status badges, QR preview, undo
    │   ├── WalkInDialog.tsx
    │   └── ScanResultOverlay.tsx  # green / amber / red full-screen verdicts
    └── pages/
        ├── Dashboard.tsx     # event list + create dialog
        ├── EventDashboard.tsx
        └── Scanner.tsx       # mobile-first camera + manual fallback
```

---

## Spreadsheet format

Any column names work — you map them on import. A typical sheet:

| Full Name    | Email                  | Student ID |
|--------------|------------------------|------------|
| Aisha Khan   | aisha@university.edu   | 2023-0412  |
| Ben Okafor   | ben.o@university.edu   | 2023-0587  |

Rows without a name are skipped; rows whose ID or email already exist in the event are skipped as duplicates. If there is no ID column, one is generated.

---

## Notes

- Camera flip, pause-while-showing-result and a 3-second duplicate-scan debounce are built in.
- Scanning also accepts a bare token (without the `EPC|…` prefix), so passes generated elsewhere from the exported `index.csv` still work.
- Browser support: Chrome/Edge/Safari (iOS 15+) and Firefox. iOS requires the page to be served over HTTPS for the camera.
