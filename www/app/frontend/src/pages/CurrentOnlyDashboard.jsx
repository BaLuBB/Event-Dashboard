import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useTheme } from '@/context/ThemeContext';
import { Clock, Calendar, Pause, Play, Bell, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function getClientId() {
  const key = 'viewer_client_id';
  let v = localStorage.getItem(key);
  if (!v) {
    v = `client_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    localStorage.setItem(key, v);
  }
  return v;
}

export default function CurrentOnlyDashboard() {
  const { settings } = useTheme();

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
      setSchedule(scheduleRes.data || []);
      setPhases(phasesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
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
      if (!currentItem || settings.is_paused) {
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
  }, [schedule, settings.is_paused]);

  const currentItem = schedule.find(item => item.is_current);
  const currentPhase = currentItem && phases.find(p => p.id === currentItem.phase_id);

  const formatTime = (num) => String(num).padStart(2, '0');

  const handleAck = async () => {
    try {
      await axios.post(
        `${API}/message/ack`,
        { client_id: clientId },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setShowPopup(false); // sofort lokal schließen
    } catch (e) {
      console.error('ACK failed:', e);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: settings.background_color }}
      data-testid="current-only-dashboard"
    >
      {/* POPUP OVERLAY */}
      {showPopup && message?.text && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden"
            style={{ borderColor: settings.surface_color, backgroundColor: settings.surface_color }}
          >
            <div className="p-5 md:p-6 flex items-start gap-4">
              <div
                className="p-3 rounded-xl shrink-0"
                style={{ backgroundColor: settings.primary_color }}
              >
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

                <p className="mt-2 text-base md:text-lg leading-relaxed" style={{ color: settings.text_color, opacity: 0.9 }}>
                  {message.text}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs md:text-sm opacity-60" style={{ color: settings.text_color }}>
                    {message.created ? new Date(message.created).toLocaleString('de-DE') : ''}
                  </span>

                  <Button
                    onClick={handleAck}
                    style={{ backgroundColor: settings.primary_color }}
                  >
                    OK
                  </Button>
                </div>
              </div>
            </div>

            <div
              className="h-1"
              style={{ backgroundColor: currentPhase?.color || settings.accent_color }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="p-4 md:p-6 border-b" style={{ borderColor: settings.surface_color }}>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl md:text-4xl font-bold tracking-tight" style={{ color: settings.text_color }}>
            {settings.event_name}
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

      {/* Main (nur Current + Countdown) */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        {currentItem ? (
          <div className="w-full max-w-5xl text-center" ref={currentItemRef}>
            {currentPhase && (
              <Badge className="mb-6 px-5 py-2" style={{ backgroundColor: currentPhase.color, color: '#fff' }}>
                <span className="inline-block w-2 h-2 rounded-full bg-white mr-2" />
                {currentPhase.name}
              </Badge>
            )}

            <h2 className="font-heading text-5xl md:text-7xl lg:text-8xl font-bold mb-6" style={{ color: settings.text_color }}>
              {currentItem.title}
            </h2>

            {currentItem.description && (
              <p className="text-lg md:text-2xl mb-8 opacity-80" style={{ color: settings.text_color }}>
                {currentItem.description}
              </p>
            )}

            <div className="text-xl md:text-2xl mb-10 opacity-60" style={{ color: settings.text_color }}>
              <Clock className="inline-block w-5 h-5 mr-2" />
              {currentItem.start_time} - {currentItem.end_time}
            </div>

            {settings.show_countdown && !settings.is_paused && (
              <div className="mt-6">
                <p className="text-sm uppercase tracking-widest mb-3 opacity-60" style={{ color: settings.text_color }}>
                  Verbleibend
                </p>
                <div
                  className="text-6xl md:text-8xl lg:text-9xl font-bold"
                  style={{ color: currentPhase?.color || settings.accent_color }}
                >
                  {formatTime(countdown.hours)}
                  <span className="mx-3 opacity-60">:</span>
                  {formatTime(countdown.minutes)}
                  <span className="mx-3 opacity-60">:</span>
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
      </main>
    </div>
  );
}

