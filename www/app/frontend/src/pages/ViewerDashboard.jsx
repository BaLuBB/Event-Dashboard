import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useTheme } from '@/context/ThemeContext';
import { Clock, Calendar, Pause, Play, Bell, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fallback, damit Viewer NIE "schwarz/leer" wird, wenn settings kurz fehlen
const DEFAULT_SETTINGS = {
  event_name: 'Event',
  event_date: '',
  background_color: '#0b0f1a',
  surface_color: '#111827',
  text_color: '#e5e7eb',
  primary_color: '#7c3aed',
  accent_color: '#22c55e',
  is_paused: false,
  show_countdown: true,
  auto_scroll: true,
};

function getClientId() {
  const key = 'viewer_client_id';
  let v = localStorage.getItem(key);
  if (!v) {
    v = `client_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    localStorage.setItem(key, v);
  }
  return v;
}

export default function ViewerDashboard() {
  const { settings } = useTheme();
  const s = settings || DEFAULT_SETTINGS; // <- wichtiger Fix

  const [schedule, setSchedule] = useState([]);
  const [phases, setPhases] = useState([]);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  const [message, setMessage] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  const currentItemRef = useRef(null);
  const clientId = useMemo(() => getClientId(), []);

  const fetchData = useCallback(async () => {
    try {
      const [scheduleRes, phasesRes] = await Promise.all([
        axios.get(`${API}/schedule`),
        axios.get(`${API}/phases`)
      ]);
      setSchedule(Array.isArray(scheduleRes.data) ? scheduleRes.data : []);
      setPhases(Array.isArray(phasesRes.data) ? phasesRes.data : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // NICHT resetten, damit UI nicht flackert/leer wird
    }
  }, []);

  const fetchMessage = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/message`, { params: { client_id: clientId } });
      setMessage(res.data);
      setShowPopup(Boolean(res.data?.active && res.data?.text));
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
      const currentItem = schedule.find(item => item.is_current);
      if (!currentItem || s.is_paused) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const now = new Date();
      const [endHours, endMinutes] = String(currentItem.end_time || '00:00').split(':').map(Number);
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
  }, [schedule, s.is_paused]);

  useEffect(() => {
    if (s.auto_scroll && currentItemRef.current) {
      currentItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [schedule, s.auto_scroll]);

  const currentItem = schedule.find(item => item.is_current);
  const currentPhase = currentItem && phases.find(p => p.id === currentItem.phase_id);
  const currentIndex = schedule.findIndex(item => item.is_current);

  const formatTime = (num) => String(num).padStart(2, '0');

  const handleAck = async () => {
    try {
      await axios.post(
        `${API}/message/ack`,
        { client_id: clientId },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setShowPopup(false);
    } catch (e) {
      console.error('ACK failed:', e);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: s.background_color }}
      data-testid="viewer-dashboard"
    >
      {/* POPUP OVERLAY */}
      {showPopup && message?.text && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden"
            style={{ borderColor: s.surface_color, backgroundColor: s.surface_color }}
          >
            <div className="p-5 md:p-6 flex items-start gap-4">
              <div
                className="p-3 rounded-xl shrink-0"
                style={{ backgroundColor: s.primary_color }}
              >
                <Bell className="w-6 h-6 text-white" />
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-heading text-xl md:text-2xl font-bold" style={{ color: s.text_color }}>
                    Nachricht
                  </h3>
                  <button
                    onClick={handleAck}
                    className="opacity-70 hover:opacity-100 transition"
                    aria-label="Schließen"
                    title="Schließen"
                  >
                    <X className="w-5 h-5" style={{ color: s.text_color }} />
                  </button>
                </div>

                <p className="mt-2 text-base md:text-lg leading-relaxed" style={{ color: s.text_color, opacity: 0.9 }}>
                  {message.text}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs md:text-sm opacity-60 font-mono tabular-nums" style={{ color: s.text_color }}>
                    {message.created ? new Date(message.created).toLocaleString('de-DE') : ''}
                  </span>

                  <Button
                    onClick={handleAck}
                    style={{ backgroundColor: s.primary_color }}
                  >
                    OK
                  </Button>
                </div>
              </div>
            </div>

            <div
              className="h-1"
              style={{ backgroundColor: currentPhase?.color || s.accent_color }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="p-4 md:p-6 border-b" style={{ borderColor: s.surface_color }}>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl md:text-4xl font-bold tracking-tight" style={{ color: s.text_color }}>
            {s.event_name}
          </h1>

          <div className="flex items-center gap-4">
            {/* Uhrzeit -> Zahlen-Font erzwingen */}
            <div className="font-mono tabular-nums text-xl md:text-2xl font-bold tabular-nums" style={{ color: s.text_color }}>
              {currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>

            {s.event_date && (
              <div className="flex items-center gap-2 text-sm md:text-base" style={{ color: s.text_color }}>
                <Calendar className="w-4 h-4" />
                <span className="font-mono tabular-nums">{s.event_date}</span>
              </div>
            )}

            {s.is_paused && (
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
        {/* Current Item */}
        <div className="lg:w-1/2 p-6 md:p-8 flex flex-col justify-center items-center">
          {currentItem ? (
            <div className="w-full max-w-xl text-center">
              {currentPhase && (
                <Badge className="mb-4 px-4 py-1" style={{ backgroundColor: currentPhase.color, color: '#fff' }}>
                  <span className="inline-block w-2 h-2 rounded-full bg-white mr-2" />
                  {currentPhase.name}
                </Badge>
              )}

              <h2 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold mb-4" style={{ color: s.text_color }}>
                {currentItem.title}
              </h2>

              {currentItem.description && (
                <p className="text-lg md:text-xl mb-6 opacity-80" style={{ color: s.text_color }}>
                  {currentItem.description}
                </p>
              )}

              {/* Zeiten -> Zahlen-Font */}
              <div className="text-xl md:text-2xl mb-8 opacity-60 font-mono tabular-nums" style={{ color: s.text_color }}>
                <Clock className="inline-block w-5 h-5 mr-2" />
                {currentItem.start_time} - {currentItem.end_time}
              </div>

              {s.show_countdown && !s.is_paused && (
                <div className="mt-8">
                  <p className="text-sm uppercase tracking-widest mb-2 opacity-60" style={{ color: s.text_color }}>
                    Verbleibend
                  </p>

                  {/* Countdown -> Zahlen-Font ERZWINGEN */}
                  <div
                    className="font-mono tabular-nums text-5xl md:text-7xl lg:text-8xl font-bold"
                    style={{ color: currentPhase?.color || s.accent_color }}
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
              <Play className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: s.text_color }} />
              <h2 className="font-heading text-3xl md:text-4xl font-bold opacity-50" style={{ color: s.text_color }}>
                Warte auf Start...
              </h2>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="lg:w-1/2 border-t lg:border-t-0 lg:border-l" style={{ borderColor: s.surface_color }}>
          <div className="p-4 md:p-6 border-b" style={{ borderColor: s.surface_color }}>
            <h3 className="font-heading text-xl font-semibold tracking-wide" style={{ color: s.text_color }}>
              ZEITPLAN
            </h3>
          </div>

          <ScrollArea className="h-[50vh] lg:h-[calc(100vh-180px)]">
            <div className="p-4 space-y-2">
              {schedule.map((item, index) => {
                const isCurrentItem = item.is_current;
                const isPast = currentIndex > -1 && index < currentIndex;
                const phase = phases.find(p => p.id === item.phase_id);

                return (
                  <div
                    key={item.id}
                    ref={isCurrentItem ? currentItemRef : null}
                    className={`p-4 rounded-sm transition-all ${isCurrentItem ? 'ring-1' : ''}`}
                    style={{
                      backgroundColor: isCurrentItem ? s.surface_color : 'transparent',
                      opacity: isPast ? 0.5 : 1,
                      borderLeft: `4px solid ${isCurrentItem ? (phase?.color || s.accent_color) : 'transparent'}`
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono tabular-nums" style={{ color: s.text_color, opacity: 0.6 }}>
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
                        <h4 className="font-heading font-semibold text-lg" style={{ color: s.text_color }}>
                          {item.title}
                        </h4>
                        {item.description && (
                          <p className="text-sm mt-1 opacity-70" style={{ color: s.text_color }}>
                            {item.description}
                          </p>
                        )}
                      </div>
                      {isCurrentItem && (
                        <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: phase?.color || s.accent_color }} />
                      )}
                    </div>
                  </div>
                );
              })}

              {schedule.length === 0 && (
                <div className="text-center py-12 opacity-50" style={{ color: s.text_color }}>
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
