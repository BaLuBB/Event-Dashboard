import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useTheme } from '@/context/ThemeContext';
import { Clock, Calendar, Pause, Play, Bell, X, Users, Layers, StickyNote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ---- Client-ID (separat für Crew) ----
function getClientId() {
  const key = 'crew_client_id';
  let v = localStorage.getItem(key);
  if (!v) {
    v = `crew_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    localStorage.setItem(key, v);
  }
  return v;
}

// --- Popup "dismiss" helpers (damit Polling es nicht sofort wieder öffnet) ---
function getDismissKey(msg) {
  const created = msg?.created ? String(msg.created) : '';
  const text = msg?.text ? String(msg.text) : '';
  return `${created}__${text}`;
}

function getDismissStoreKey(clientId) {
  return `crew_dismissed_msg_${clientId}`;
}

// --- kleine Helper ---
const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
const joinNice = (arr) => uniq(arr).join(', ');

export default function CrewDashboard() {
  const { settings } = useTheme();

  const [schedule, setSchedule] = useState([]);
  const [phases, setPhases] = useState([]);
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);

  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  const [message, setMessage] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  const currentItemRef = useRef(null);
  const clientId = useMemo(() => getClientId(), []);

  const fetchData = useCallback(async () => {
    try {
      // Crew bekommt mehr Daten, aber ist robust, falls Endpoints fehlen.
      const results = await Promise.allSettled([
        axios.get(`${API}/schedule`),
        axios.get(`${API}/phases`),
        axios.get(`${API}/people`),
        axios.get(`${API}/groups`)
      ]);

      const [scheduleRes, phasesRes, peopleRes, groupsRes] = results;

      if (scheduleRes.status === 'fulfilled') setSchedule(scheduleRes.value.data || []);
      if (phasesRes.status === 'fulfilled') setPhases(phasesRes.value.data || []);
      if (peopleRes.status === 'fulfilled') setPeople(peopleRes.value.data || []);
      if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, []);

  const fetchMessage = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/message`, { params: { client_id: clientId } });
      const msg = res.data;
      setMessage(msg);

      const dismissedKey = localStorage.getItem(getDismissStoreKey(clientId));
      const currentKey = getDismissKey(msg);

      const shouldShow = Boolean(
        msg?.active &&
          msg?.text &&
          currentKey &&
          currentKey !== dismissedKey
      );

      setShowPopup(shouldShow);
    } catch (e) {
      console.error('Failed to fetch message:', e);
    }
  }, [clientId]);

  useEffect(() => {
    fetchData();
    fetchMessage();
    const interval = setInterval(() => {
      fetchData();
      fetchMessage();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchData, fetchMessage]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const calculateCountdown = () => {
      const currentItem = schedule.find((item) => item.is_current);
      if (!currentItem || settings.is_paused) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const now = new Date();
      const [endHours, endMinutes] = String(currentItem.end_time || '00:00')
        .split(':')
        .map(Number);

      const endTime = new Date();
      endTime.setHours(endHours || 0, endMinutes || 0, 0, 0);

      const diff = endTime.getTime() - now.getTime();
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({ hours, minutes, seconds });
      } else {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [schedule, settings.is_paused]);

  useEffect(() => {
    if (settings.auto_scroll && currentItemRef.current) {
      currentItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [schedule, settings.auto_scroll]);

  const currentItem = schedule.find((item) => item.is_current);
  const currentPhase = currentItem && phases.find((p) => p.id === currentItem.phase_id);
  const currentIndex = schedule.findIndex((item) => item.is_current);

  const formatTime = (num) => String(num).padStart(2, '0');

  const resolvePeopleNames = (ids) => {
    const idSet = new Set((ids || []).map(String));
    const names = people
      .filter((p) => idSet.has(String(p.id)))
      .map((p) => p.name || p.display_name || p.username || p.title)
      .filter(Boolean);

    // Fallback: wenn Backend nur IDs liefert oder people endpoint fehlt
    if (names.length === 0 && (ids || []).length > 0) return (ids || []).map(String);
    return names;
  };

  const resolveGroupNames = (ids) => {
    const idSet = new Set((ids || []).map(String));
    const names = groups
      .filter((g) => idSet.has(String(g.id)))
      .map((g) => g.name || g.title)
      .filter(Boolean);

    if (names.length === 0 && (ids || []).length > 0) return (ids || []).map(String);
    return names;
  };

  const handleAck = async () => {
    try {
      const key = getDismissKey(message);
      localStorage.setItem(getDismissStoreKey(clientId), key);

      setShowPopup(false);
      setMessage((prev) => (prev ? { ...prev, active: false } : prev));

      await axios.post(
        `${API}/message/ack`,
        { client_id: clientId },
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      console.error('ACK failed:', e);
    }
  };

  const crewPeople = currentItem ? resolvePeopleNames(currentItem.people) : [];
  const crewGroups = currentItem ? resolveGroupNames(currentItem.groups) : [];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: settings.background_color }}
      data-testid="crew-dashboard"
    >
      {/* POPUP OVERLAY (Design identisch zu ViewerDashboard) */}
      {showPopup && message?.text && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden"
            style={{ borderColor: settings.surface_color, backgroundColor: settings.surface_color }}
          >
            <div className="p-5 md:p-6 flex items-start gap-4">
              <div className="p-3 rounded-xl shrink-0" style={{ backgroundColor: settings.primary_color }}>
                <Bell className="w-6 h-6 text-white" />
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-heading text-xl md:text-2xl font-bold" style={{ color: settings.text_color }}>
                    Nachricht
                  </h3>
                  <button
                    onClick={handleAck}
                    className="opacity-70 hover:opacity-100 transition"
                    aria-label="Schließen"
                    title="Schließen"
                  >
                    <X className="w-5 h-5" style={{ color: settings.text_color }} />
                  </button>
                </div>

                <p
                  className="mt-2 text-base md:text-lg leading-relaxed"
                  style={{ color: settings.text_color, opacity: 0.9 }}
                >
                  {message.text}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs md:text-sm opacity-60" style={{ color: settings.text_color }}>
                    {message.created ? new Date(message.created).toLocaleString('de-DE') : ''}
                  </span>

                  <Button onClick={handleAck} style={{ backgroundColor: settings.primary_color }}>
                    OK
                  </Button>
                </div>
              </div>
            </div>

            <div className="h-1" style={{ backgroundColor: currentPhase?.color || settings.accent_color }} />
          </div>
        </div>
      )}

      {/* Header (Design identisch) */}
      <header className="p-4 md:p-6 border-b" style={{ borderColor: settings.surface_color }}>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl md:text-4xl font-bold tracking-tight" style={{ color: settings.text_color }}>
            {settings.event_name} <span className="opacity-60">• Crew</span>
          </h1>

          <div className="flex items-center gap-4">
            <div className="font-mono text-xl md:text-2xl font-bold tabular-nums" style={{ color: settings.text_color }}>
              {currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>

            {settings.event_date && (
              <div className="flex items-center gap-2 text-sm md:text-base" style={{ color: settings.text_color }}>
                <Calendar className="w-4 h-4" />
                <span>{settings.event_date}</span>
              </div>
            )}

            {settings.is_paused && (
              <Badge
                variant="outline"
                className="animate-pulse"
                style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
              >
                <Pause className="w-3 h-3 mr-1" />
                PAUSE
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Current Item (Crew-Details) */}
        <div className="lg:w-1/2 p-6 md:p-8 flex flex-col justify-center items-center">
          {currentItem ? (
            <div className="w-full max-w-xl text-center">
              {currentPhase && (
                <Badge className="mb-4 px-4 py-1" style={{ backgroundColor: currentPhase.color, color: '#fff' }}>
                  <span className="inline-block w-2 h-2 rounded-full bg-white mr-2" />
                  {currentPhase.name}
                </Badge>
              )}

              <h2 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold mb-4" style={{ color: settings.text_color }}>
                {currentItem.title}
              </h2>

              {currentItem.description && (
                <p className="text-lg md:text-xl mb-6 opacity-80" style={{ color: settings.text_color }}>
                  {currentItem.description}
                </p>
              )}

              <div className="text-xl md:text-2xl mb-6 opacity-60" style={{ color: settings.text_color }}>
                <Clock className="inline-block w-5 h-5 mr-2" />
                {currentItem.start_time} - {currentItem.end_time}
              </div>

              {/* Crew-Zuordnung */}
              <div
                className="mt-4 rounded-2xl border p-4 text-left"
                style={{ borderColor: settings.surface_color, backgroundColor: settings.surface_color }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: settings.primary_color }}>
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-heading font-semibold text-lg" style={{ color: settings.text_color }}>
                      Zuständig
                    </div>

                    <div className="mt-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <Users className="w-4 h-4 mt-0.5 opacity-70" style={{ color: settings.text_color }} />
                        <div style={{ color: settings.text_color, opacity: 0.9 }}>
                          <span className="opacity-70">Personen:</span>{' '}
                          {crewPeople.length ? joinNice(crewPeople) : <span className="opacity-60">—</span>}
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Layers className="w-4 h-4 mt-0.5 opacity-70" style={{ color: settings.text_color }} />
                        <div style={{ color: settings.text_color, opacity: 0.9 }}>
                          <span className="opacity-70">Gruppen:</span>{' '}
                          {crewGroups.length ? joinNice(crewGroups) : <span className="opacity-60">—</span>}
                        </div>
                      </div>

                      {currentItem.notes && (
                        <div className="flex items-start gap-2">
                          <StickyNote className="w-4 h-4 mt-0.5 opacity-70" style={{ color: settings.text_color }} />
                          <div style={{ color: settings.text_color, opacity: 0.9 }}>
                            <span className="opacity-70">Notizen:</span>{' '}
                            <span className="whitespace-pre-wrap">{currentItem.notes}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {settings.show_countdown && !settings.is_paused && (
                <div className="mt-8">
                  <p className="text-sm uppercase tracking-widest mb-2 opacity-60" style={{ color: settings.text_color }}>
                    Verbleibend
                  </p>
                  <div
                    className="text-5xl md:text-7xl lg:text-8xl font-bold font-mono tabular-nums"
                    style={{
                      color: currentPhase?.color || settings.accent_color,
                      fontVariantNumeric: "tabular-nums",
                      fontFeatureSettings: '"zero" 1'
                    }}

                    style={{ color: currentPhase?.color || settings.accent_color }}
                  >
                    {formatTime(countdown.hours)}
                    <span className="mx-2 opacity-60">:</span>
                    {formatTime(countdown.minutes)}
                    <span className="mx-2 opacity-60">:</span>
                    {formatTime(countdown.seconds)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <Play className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: settings.text_color }} />
              <h2 className="font-heading text-3xl md:text-4xl font-bold opacity-50" style={{ color: settings.text_color }}>
                Warte auf Start...
              </h2>
            </div>
          )}
        </div>

        {/* Schedule (Design identisch zu ViewerDashboard) */}
        <div className="lg:w-1/2 border-t lg:border-t-0 lg:border-l" style={{ borderColor: settings.surface_color }}>
          <div className="p-4 md:p-6 border-b" style={{ borderColor: settings.surface_color }}>
            <h3 className="font-heading text-xl font-semibold tracking-wide" style={{ color: settings.text_color }}>
              ZEITPLAN
            </h3>
          </div>

          <ScrollArea className="h-[50vh] lg:h-[calc(100vh-180px)]">
            <div className="p-4 space-y-2">
              {schedule.map((item, index) => {
                const isCurrentItem = item.is_current;
                const isPast = currentIndex > -1 && index < currentIndex;
                const phase = phases.find((p) => p.id === item.phase_id);

                const itemPeople = resolvePeopleNames(item.people);
                const itemGroups = resolveGroupNames(item.groups);

                return (
                  <div
                    key={item.id}
                    ref={isCurrentItem ? currentItemRef : null}
                    className={`p-4 rounded-sm transition-all ${isCurrentItem ? 'ring-1' : ''}`}
                    style={{
                      backgroundColor: isCurrentItem ? settings.surface_color : 'transparent',
                      opacity: isPast ? 0.5 : 1,
                      borderLeft: `4px solid ${isCurrentItem ? (phase?.color || settings.accent_color) : 'transparent'}`
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm" style={{ color: settings.text_color, opacity: 0.6 }}>
                            {item.start_time} - {item.end_time}
                          </span>
                          {phase && (
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: phase.color, color: phase.color }}
                            >
                              {phase.name}
                            </Badge>
                          )}
                        </div>

                        <h4 className="font-heading font-semibold text-lg" style={{ color: settings.text_color }}>
                          {item.title}
                        </h4>

                        {item.description && (
                          <p className="text-sm mt-1 opacity-70" style={{ color: settings.text_color }}>
                            {item.description}
                          </p>
                        )}

                        {/* Crew-Zusatzinfos im Listeneintrag */}
                        {(itemPeople.length > 0 || itemGroups.length > 0) && (
                          <div className="mt-2 text-xs opacity-70" style={{ color: settings.text_color }}>
                            {itemPeople.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" />
                                <span>{joinNice(itemPeople)}</span>
                              </div>
                            )}
                            {itemGroups.length > 0 && (
                              <div className="flex items-center gap-2 mt-1">
                                <Layers className="w-3.5 h-3.5" />
                                <span>{joinNice(itemGroups)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {isCurrentItem && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: phase?.color || settings.accent_color }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {schedule.length === 0 && (
                <div className="text-center py-12 opacity-50" style={{ color: settings.text_color }}>
                  Noch keine Einträge vorhanden
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </main>
    </div>
  );
}
