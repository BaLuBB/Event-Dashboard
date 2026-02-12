import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

// ======================
// DATA DIRECTORY
// ======================
const DATA_DIR = path.resolve("./data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ======================
// HELPERS
// ======================
function filePath(name) {
  return path.join(DATA_DIR, name);
}

function load(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    fs.writeFileSync(p, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function save(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function id() {
  return String(Date.now());
}

// ======================
// DEFAULTS
// ======================
const defaultSettings = {
  event_name: "Event",
  event_date: "",
  background_color: "#0b0b0f",
  surface_color: "#12121a",
  text_color: "#ffffff",
  primary_color: "#7c3aed",
  accent_color: "#22c55e",
  is_paused: false,
  auto_advance: false,
  auto_scroll: true,
  show_countdown: true,
};

const defaultMessage = {
  id: null,
  text: "",
  active: false,
  created: null,
  acked_by: [],
};

// ======================
// STATE
// ======================
let settings = load("settings.json", defaultSettings);
let schedule = load("schedule.json", []);
let phases = load("phases.json", []);
let people = load("people.json", []);
let groups = load("groups.json", []);

let message = load("message.json", defaultMessage);

// ======================
// HEALTH
// ======================
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ======================
// SETTINGS
// ======================
app.get("/api/settings", (_req, res) => {
  res.json(settings);
});

app.post("/api/settings", (req, res) => {
  settings = { ...settings, ...(req.body || {}) };
  save("settings.json", settings);
  res.json(settings);
});

// ======================
// PHASES
// ======================
app.get("/api/phases", (_req, res) => res.json(phases));

app.post("/api/phases", (req, res) => {
  const body = req.body || {};
  const phase = {
    id: id(),
    name: String(body.name || "Phase"),
    color: String(body.color || "#71717a"),
  };
  phases.push(phase);
  save("phases.json", phases);
  res.json(phase);
});

app.put("/api/phases/:id", (req, res) => {
  const pid = String(req.params.id);
  const i = phases.findIndex((p) => String(p.id) === pid);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  phases[i] = { ...phases[i], ...(req.body || {}) };
  save("phases.json", phases);
  res.json(phases[i]);
});

app.delete("/api/phases/:id", (req, res) => {
  const pid = String(req.params.id);
  phases = phases.filter((p) => String(p.id) !== pid);
  save("phases.json", phases);
  res.json({ success: true });
});

// ======================
// PEOPLE
// ======================
app.get("/api/people", (_req, res) => res.json(people));

app.post("/api/people", (req, res) => {
  const body = req.body || {};
  const person = {
    id: id(),
    name: String(body.name || "Person"),
    role: String(body.role || ""),
    color: String(body.color || ""),
  };
  people.push(person);
  save("people.json", people);
  res.json(person);
});

app.put("/api/people/:id", (req, res) => {
  const pid = String(req.params.id);
  const i = people.findIndex((p) => String(p.id) === pid);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  people[i] = { ...people[i], ...(req.body || {}) };
  save("people.json", people);
  res.json(people[i]);
});

app.delete("/api/people/:id", (req, res) => {
  const pid = String(req.params.id);
  people = people.filter((p) => String(p.id) !== pid);
  save("people.json", people);
  res.json({ success: true });
});

// ======================
// GROUPS
// ======================
app.get("/api/groups", (_req, res) => res.json(groups));

app.post("/api/groups", (req, res) => {
  const body = req.body || {};
  const group = {
    id: id(),
    name: String(body.name || "Gruppe"),
    color: String(body.color || ""),
  };
  groups.push(group);
  save("groups.json", groups);
  res.json(group);
});

app.put("/api/groups/:id", (req, res) => {
  const gid = String(req.params.id);
  const i = groups.findIndex((g) => String(g.id) === gid);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  groups[i] = { ...groups[i], ...(req.body || {}) };
  save("groups.json", groups);
  res.json(groups[i]);
});

app.delete("/api/groups/:id", (req, res) => {
  const gid = String(req.params.id);
  groups = groups.filter((g) => String(g.id) !== gid);
  save("groups.json", groups);
  res.json({ success: true });
});

// ======================
// SCHEDULE
// ======================
app.get("/api/schedule", (_req, res) => res.json(schedule));

app.post("/api/schedule", (req, res) => {
  const body = req.body || {};
  const item = {
    id: id(),
    title: String(body.title || "Eintrag"),
    description: String(body.description || ""),
    start_time: String(body.start_time || "00:00"),
    end_time: String(body.end_time || "00:00"),
    phase_id: String(body.phase_id || ""),
    notes: String(body.notes || ""),
    is_current: Boolean(body.is_current || false),
    people: Array.isArray(body.people) ? body.people : [],
    groups: Array.isArray(body.groups) ? body.groups : [],
  };
  if (item.is_current) {
    schedule = schedule.map((x) => ({ ...x, is_current: false }));
  }
  schedule.push(item);
  save("schedule.json", schedule);
  res.json(item);
});

app.put("/api/schedule/:id", (req, res) => {
  const sid = String(req.params.id);
  const i = schedule.findIndex((s) => String(s.id) === sid);
  if (i === -1) return res.status(404).json({ error: "Not found" });

  const next = { ...schedule[i], ...(req.body || {}) };
  if (next.is_current) {
    schedule = schedule.map((x) => ({ ...x, is_current: String(x.id) === sid }));
    save("schedule.json", schedule);
    return res.json(schedule.find((x) => String(x.id) === sid));
  }

  schedule[i] = next;
  save("schedule.json", schedule);
  res.json(schedule[i]);
});

app.delete("/api/schedule/:id", (req, res) => {
  const sid = String(req.params.id);
  schedule = schedule.filter((s) => String(s.id) !== sid);
  save("schedule.json", schedule);
  res.json({ success: true });
});

// ======================
// CONTROL
// ======================
function getCurrentIndex() {
  return schedule.findIndex((s) => s.is_current);
}

app.post("/api/control/pause", (_req, res) => {
  settings.is_paused = !Boolean(settings.is_paused);
  save("settings.json", settings);
  res.json({ success: true, is_paused: settings.is_paused });
});

app.post("/api/control/clear-current", (_req, res) => {
  schedule = schedule.map((s) => ({ ...s, is_current: false }));
  save("schedule.json", schedule);
  res.json({ success: true });
});

app.post("/api/control/set-current/:id", (req, res) => {
  const sid = String(req.params.id);
  const exists = schedule.some((s) => String(s.id) === sid);
  if (!exists) return res.status(404).json({ error: "Not found" });

  schedule = schedule.map((s) => ({ ...s, is_current: String(s.id) === sid }));
  save("schedule.json", schedule);
  res.json({ success: true });
});

app.post("/api/control/next", (_req, res) => {
  const idx = getCurrentIndex();
  const nextIdx = idx < 0 ? 0 : Math.min(schedule.length - 1, idx + 1);
  schedule = schedule.map((s, i) => ({ ...s, is_current: i === nextIdx }));
  save("schedule.json", schedule);
  res.json({ success: true });
});

app.post("/api/control/previous", (_req, res) => {
  const idx = getCurrentIndex();
  const prevIdx = idx <= 0 ? 0 : idx - 1;
  schedule = schedule.map((s, i) => ({ ...s, is_current: i === prevIdx }));
  save("schedule.json", schedule);
  res.json({ success: true });
});

// ======================
// MESSAGE (Admin -> Clients)
// - ack ist PRO CLIENT, NICHT global
// - clear ist NUR Admin (global aus)
// ======================
app.get("/api/message", (req, res) => {
  const clientId = String(req.query.client_id || "");
  if (!message.active) return res.json(message);

  if (clientId && Array.isArray(message.acked_by) && message.acked_by.includes(clientId)) {
    // Client hat bereits bestätigt -> für ihn so tun als sei es nicht aktiv
    return res.json({ ...message, active: false });
  }

  res.json(message);
});

app.post("/api/message", (req, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: "Text fehlt" });
  }

  message = {
    id: Date.now(),
    text: String(text).trim(),
    active: true,
    created: nowIso(),
    acked_by: [],
  };

  save("message.json", message);
  res.json(message);
});

app.post("/api/message/ack", (req, res) => {
  const { client_id } = req.body || {};
  const cid = String(client_id || "").trim();
  if (!cid) return res.status(400).json({ error: "client_id fehlt" });

  if (!Array.isArray(message.acked_by)) message.acked_by = [];
  if (!message.acked_by.includes(cid)) message.acked_by.push(cid);

  save("message.json", message);
  res.json({ success: true });
});

app.post("/api/message/clear", (_req, res) => {
  message.active = false;
  save("message.json", message);
  res.json({ success: true });
});

// ======================
// START
// ======================
app.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ BACKEND LISTENING http://127.0.0.1:${PORT}`);
});
