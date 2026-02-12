import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  StopCircle,
  Clock,
  ListChecks,
  Layers,
  RefreshCw,
  Upload,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminOverview() {
  const { getAuthHeader } = useAuth();
  const { settings, fetchSettings } = useTheme();

  const [schedule, setSchedule] = useState([]);
  const [phases, setPhases] = useState([]);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

  const currentItemRef = useRef(null);

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
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
      fetchSettings();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchData, fetchSettings]);

  // Countdown
  useEffect(() => {
    const calculateCountdown = () => {
      const currentItem = schedule.find((item) => item.is_current);
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

  useEffect(() => {
    const currentEl = currentItemRef.current;
    if (settings.auto_scroll && currentEl) {
      currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [schedule, settings.auto_scroll]);

  const currentItem = schedule.find((item) => item.is_current) || null;
  const currentPhase = currentItem ? phases.find((p) => p.id === currentItem.phase_id) : null;
  const currentIndex = schedule.findIndex((item) => item.is_current);

  const formatTime = (num) => String(num).padStart(2, '0');

  const handleControl = async (action) => {
    try {
      await axios.post(`${API}/control/${action}`, {}, getAuthHeader());
      await fetchData();
      await fetchSettings();
      toast.success('Steuerung aktualisiert');
    } catch (error) {
      console.error(error);
      toast.error('Fehler bei der Steuerung');
    }
  };

  const handleSetCurrent = async (itemId) => {
    try {
      await axios.post(`${API}/control/set-current/${itemId}`, {}, getAuthHeader());
      await fetchData();
      await fetchSettings();
      toast.success('Aktueller Eintrag gesetzt');
    } catch (error) {
      console.error(error);
      toast.error('Fehler beim Setzen');
    }
  };

  const handleSyncToExternal = async () => {
    try {
      await axios.post(`${API}/state/sync-to-external`, {}, getAuthHeader());
      toast.success('State an externe API gesendet');
    } catch (error) {
      console.error(error);
      toast.error('Sync fehlgeschlagen');
    }
  };

  const handleSyncFromExternal = async () => {
    try {
      await axios.post(`${API}/state/sync-from-external`, {}, getAuthHeader());
      await fetchData();
      await fetchSettings();
      toast.success('State von externer API geladen');
    } catch (error) {
      console.error(error);
      toast.error('Sync fehlgeschlagen - API nicht erreichbar?');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-overview">
      <div>
        <h1 className="font-heading text-3xl font-bold" style={{ color: settings.text_color }}>
          Übersicht
        </h1>
        <p className="opacity-60" style={{ color: settings.text_color }}>
          Event-Steuerung und Live-Status
        </p>
      </div>

      {/* Control Panel */}
      <Card style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2" style={{ color: settings.text_color }}>
            <Play className="w-5 h-5" />
            Steuerung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleControl('previous')}
              variant="outline"
              style={{ borderColor: settings.primary_color, color: settings.text_color }}
            >
              <SkipBack className="w-4 h-4 mr-2" />
              Zurück
            </Button>

            <Button
              onClick={() => handleControl('pause')}
              variant={settings.is_paused ? 'default' : 'outline'}
              style={{
                backgroundColor: settings.is_paused ? '#f59e0b' : 'transparent',
                borderColor: '#f59e0b',
                color: settings.is_paused ? '#000' : '#f59e0b'
              }}
            >
              {settings.is_paused ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Fortsetzen
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pausieren
                </>
              )}
            </Button>

            <Button onClick={() => handleControl('next')} style={{ backgroundColor: settings.primary_color }}>
              <SkipForward className="w-4 h-4 mr-2" />
              Weiter
            </Button>

            <Button
              onClick={() => handleControl('clear-current')}
              variant="outline"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Stoppen
            </Button>

            <Button
              onClick={async () => {
                await fetchData();
                await fetchSettings();
                toast.success('Aktualisiert');
              }}
              variant="outline"
              style={{ borderColor: settings.primary_color, color: settings.text_color }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Aktualisieren
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t" style={{ borderColor: settings.background_color }}>
            <Button
              onClick={handleSyncToExternal}
              variant="outline"
              style={{ borderColor: settings.primary_color, color: settings.text_color }}
            >
              <Upload className="w-4 h-4 mr-2" />
              An API senden
            </Button>
            <Button
              onClick={handleSyncFromExternal}
              variant="outline"
              style={{ borderColor: settings.primary_color, color: settings.text_color }}
            >
              <Download className="w-4 h-4 mr-2" />
              Von API laden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aktuell + Zeitplan (gleiche Größe) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aktuell */}
        <Card
          className="h-[520px]"
          style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}
        >
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2" style={{ color: settings.text_color }}>
              <Clock className="w-5 h-5" />
              Aktuell
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(520px-76px)]">
            {currentItem ? (
              <div className="h-full flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    {currentPhase && (
                      <Badge style={{ backgroundColor: currentPhase.color, color: '#fff' }}>
                        <Layers className="w-3 h-3 mr-1" />
                        {currentPhase.name}
                      </Badge>
                    )}
                    {settings.is_paused && (
                      <Badge variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                        <Pause className="w-3 h-3 mr-1" />
                        PAUSE
                      </Badge>
                    )}
                  </div>

                  <div>
                    <div className="font-heading text-2xl font-bold" style={{ color: settings.text_color }}>
                      {currentItem.title}
                    </div>
                    {currentItem.description && (
                      <div className="opacity-70 mt-1" style={{ color: settings.text_color }}>
                        {currentItem.description}
                      </div>
                    )}
                    <div className="opacity-60 mt-2" style={{ color: settings.text_color }}>
                      {currentItem.start_time} – {currentItem.end_time}
                    </div>
                  </div>
                </div>

                {settings.show_countdown && !settings.is_paused && (
                  <div className="pt-6">
                    <div className="text-xs uppercase tracking-widest opacity-60" style={{ color: settings.text_color }}>
                      Verbleibend
                    </div>
                    <div
                      className="font-mono text-6xl md:text-7xl font-bold tabular-nums mt-2"
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
              <div className="opacity-60" style={{ color: settings.text_color }}>
                Kein aktueller Eintrag gesetzt.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Zeitplan (scrollbar) */}
        <Card
          className="h-[520px]"
          style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading flex items-center gap-2" style={{ color: settings.text_color }}>
              <ListChecks className="w-5 h-5" />
              Zeitplan
            </CardTitle>
            <Badge variant="outline" style={{ borderColor: settings.background_color, color: settings.text_color, opacity: 0.8 }}>
              {schedule.length} Einträge
            </Badge>
          </CardHeader>

          <CardContent className="h-[calc(520px-76px)] p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {schedule.length === 0 ? (
                  <div className="text-center py-12 opacity-50" style={{ color: settings.text_color }}>
                    Noch keine Einträge vorhanden
                  </div>
                ) : (
                  schedule.map((item, index) => {
                    const isCurrentItem = item.is_current;
                    const isPast = currentIndex > -1 && index < currentIndex;
                    const phase = phases.find((p) => p.id === item.phase_id);

                    return (
                      <div
                        key={item.id}
                        ref={isCurrentItem ? currentItemRef : null}
                        className={`p-4 rounded-sm transition-all ${isCurrentItem ? 'ring-1' : ''}`}
                        style={{
                          backgroundColor: isCurrentItem ? settings.background_color : 'transparent',
                          opacity: isPast ? 0.55 : 1,
                          borderLeft: `4px solid ${isCurrentItem ? (phase?.color || settings.accent_color) : 'transparent'}`,
                          borderColor: isCurrentItem ? (phase?.color || settings.accent_color) : 'transparent'
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
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

                              {isCurrentItem && (
                                <Badge className="text-xs" style={{ backgroundColor: phase?.color || settings.accent_color, color: '#fff' }}>
                                  AKTUELL
                                </Badge>
                              )}
                            </div>

                            <div className="font-heading font-semibold text-lg truncate" style={{ color: settings.text_color }}>
                              {item.title}
                            </div>

                            {item.description && (
                              <div className="text-sm mt-1 opacity-70" style={{ color: settings.text_color }}>
                                {item.description}
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={() => handleSetCurrent(item.id)}
                            variant="outline"
                            className="shrink-0"
                            style={{ borderColor: settings.primary_color, color: settings.text_color }}
                          >
                            Setzen
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
