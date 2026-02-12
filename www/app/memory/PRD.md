# Event Dashboard PRD

## Original Problem Statement
Event-Dashboard für Veranstaltungen mit:
- Zuschauer-Dashboard (/) - öffentlich, Zeitplan und Countdown
- Crew-Dashboard (/crew) - mehr Details inkl. Notizen
- Admin-Bereich (/admin/*) - Login, Zeitplan-Verwaltung, Phasen, Einstellungen

Features: Live-Farbwechsel nach Phase, Auto-Scroll, Countdown, Passwortschutz, Drag&Drop Zeitplan, Pausenmodus, JETZT starten, Notizen, Theme/Farben anpassbar, N8N IP-Benachrichtigung.

## User Personas
1. **Zuschauer**: Sieht aktuellen Programmpunkt und Zeitplan auf Monitoren/Handys
2. **Crew-Mitglieder**: Benötigen zusätzliche Infos wie Notizen zu jedem Eintrag
3. **Event-Organisator**: Verwaltet Zeitplan, Phasen und Einstellungen

## Core Requirements (Static)
- Responsive Design (Handy, Surface, Monitor)
- Dunkles Theme (Standard), anpassbar
- Optimiert für Raspberry Pi 3
- N8N Webhook bei Startup für IP-Benachrichtigung

## Implementation Status (2026-01-11)

### ✅ Implemented
- [x] Backend API (FastAPI + MongoDB)
- [x] Admin Auth (JWT, Username/Password)
- [x] Zeitplan CRUD mit Drag&Drop Reorder
- [x] Phasen-Verwaltung mit Farbkodierung
- [x] Event-Einstellungen (Name, Datum, Farben)
- [x] Steuerung (Next, Previous, Pause, JETZT starten)
- [x] Zuschauer-Dashboard mit Live-Countdown
- [x] Crew-Dashboard mit Notizen-Panel
- [x] Admin-Panel mit allen Verwaltungsseiten
- [x] Auto-Scroll zum aktuellen Eintrag
- [x] N8N Webhook Benachrichtigung bei Startup
- [x] Responsive Design für alle Geräte

### Default Credentials
- Admin: `admin` / `admin123`

### API Endpoints
- GET/PUT `/api/settings` - Event-Einstellungen
- GET/POST/PUT/DELETE `/api/phases` - Phasen
- GET/POST/PUT/DELETE `/api/schedule` - Zeitplan
- POST `/api/schedule/reorder` - Zeitplan sortieren
- POST `/api/control/next|previous|pause|set-current|clear-current`
- POST `/api/auth/login` - Admin Login

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ Core Dashboard Views
- ✅ Admin CRUD Operations
- ✅ Live Status Updates

### P1 (High Priority) - TODO
- [ ] WebSocket für Echtzeit-Updates (statt Polling)
- [ ] Backup/Export Zeitplan als JSON

### P2 (Nice to Have)
- [ ] Mehrere Events gleichzeitig verwalten
- [ ] QR-Code für schnellen Zugriff
- [ ] Sound-Benachrichtigung bei Wechsel

## Next Tasks
1. N8N Workflow für Telegram-Benachrichtigung konfigurieren
2. Raspberry Pi Setup (siehe README)
3. Event-spezifische Anpassungen
