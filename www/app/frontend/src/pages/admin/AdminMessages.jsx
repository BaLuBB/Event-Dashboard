import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bell, Users, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// All: vorhandene Endpoints
const ALL = {
  get: `${API}/message`,
  post: `${API}/message`,
  clear: `${API}/message/clear`
};

// Crew: benötigt Backend-Endpunkte (siehe unten)
const CREW = {
  get: `${API}/message/crew`,
  post: `${API}/message/crew`,
  clear: `${API}/message/crew/clear`
};

export default function AdminMessages() {
  const { getAuthHeader } = useAuth();
  const { settings } = useTheme();

  const [allMsg, setAllMsg] = useState(null);
  const [crewMsg, setCrewMsg] = useState(null);

  const [allText, setAllText] = useState('');
  const [crewText, setCrewText] = useState('');

  const fetchAll = useCallback(async () => {
    const res = await axios.get(ALL.get, { params: { client_id: 'admin_panel' } });
    setAllMsg(res.data || null);
  }, []);

  const fetchCrew = useCallback(async () => {
    const res = await axios.get(CREW.get, { params: { client_id: 'admin_panel' } });
    setCrewMsg(res.data || null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      await Promise.all([fetchAll(), fetchCrew()]);
    } catch (e) {
      console.error(e);
      toast.error('Konnte Nachrichten nicht laden (Backend?)');
    }
  }, [fetchAll, fetchCrew]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const postAll = async () => {
    const text = allText.trim();
    if (!text) return toast.error('Bitte Text eingeben');
    try {
      await axios.post(
        ALL.post,
        { text },
        { headers: { 'Content-Type': 'application/json', ...(getAuthHeader()?.headers || {}) } }
      );
      setAllText('');
      await fetchAll();
      toast.success('Nachricht (Alle) gesendet');
    } catch (e) {
      console.error(e);
      toast.error('Senden (Alle) fehlgeschlagen');
    }
  };

  const clearAll = async () => {
    try {
      await axios.post(
        ALL.clear,
        {},
        { headers: { 'Content-Type': 'application/json', ...(getAuthHeader()?.headers || {}) } }
      );
      await fetchAll();
      toast.success('Nachricht (Alle) geschlossen');
    } catch (e) {
      console.error(e);
      toast.error('Schließen (Alle) fehlgeschlagen');
    }
  };

  const postCrew = async () => {
    const text = crewText.trim();
    if (!text) return toast.error('Bitte Text eingeben');
    try {
      await axios.post(
        CREW.post,
        { text },
        { headers: { 'Content-Type': 'application/json', ...(getAuthHeader()?.headers || {}) } }
      );
      setCrewText('');
      await fetchCrew();
      toast.success('Nachricht (Crew) gesendet');
    } catch (e) {
      console.error(e);
      toast.error('Senden (Crew) fehlgeschlagen (Backend-Endpunkte fehlen?)');
    }
  };

  const clearCrew = async () => {
    try {
      await axios.post(
        CREW.clear,
        {},
        { headers: { 'Content-Type': 'application/json', ...(getAuthHeader()?.headers || {}) } }
      );
      await fetchCrew();
      toast.success('Nachricht (Crew) geschlossen');
    } catch (e) {
      console.error(e);
      toast.error('Schließen (Crew) fehlgeschlagen (Backend-Endpunkte fehlen?)');
    }
  };

  const StatusBlock = ({ msg }) => {
    if (!msg?.text) {
      return (
        <div className="opacity-60" style={{ color: settings.text_color }}>
          Keine aktive Nachricht.
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="opacity-90" style={{ color: settings.text_color }}>
          {msg.text}
        </div>
        <div className="text-xs opacity-60" style={{ color: settings.text_color }}>
          {msg.created ? new Date(msg.created).toLocaleString('de-DE') : ''}
        </div>
        {msg.active ? (
          <Badge style={{ backgroundColor: settings.primary_color, color: '#fff' }}>AKTIV</Badge>
        ) : (
          <Badge variant="outline" style={{ borderColor: settings.background_color, color: settings.text_color, opacity: 0.8 }}>
            INAKTIV
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="admin-messages">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold" style={{ color: settings.text_color }}>
            Nachrichten
          </h1>
          <p className="opacity-60" style={{ color: settings.text_color }}>
            Nachrichten an alle oder nur an die Crew
          </p>
        </div>

        <Button
          onClick={refresh}
          variant="outline"
          style={{ borderColor: settings.primary_color, color: settings.text_color }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ALL */}
        <Card style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2" style={{ color: settings.text_color }}>
              <Bell className="w-5 h-5" />
              Nachricht für alle
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: settings.text_color }}>Text</Label>
              <Input value={allText} onChange={(e) => setAllText(e.target.value)} placeholder="Nachricht an alle..." />
              <div className="flex gap-2 flex-wrap">
                <Button onClick={postAll} style={{ backgroundColor: settings.primary_color }}>
                  Senden
                </Button>
                <Button
                  onClick={clearAll}
                  variant="outline"
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Für alle schließen
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2" style={{ borderColor: settings.background_color }}>
              <div className="text-sm font-semibold" style={{ color: settings.text_color }}>
                Aktueller Status
              </div>
              <StatusBlock msg={allMsg} />
            </div>
          </CardContent>
        </Card>

        {/* CREW */}
        <Card style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2" style={{ color: settings.text_color }}>
              <Users className="w-5 h-5" />
              Nachricht nur für Crew
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: settings.text_color }}>Text</Label>
              <Input value={crewText} onChange={(e) => setCrewText(e.target.value)} placeholder="Nachricht an Crew..." />
              <div className="flex gap-2 flex-wrap">
                <Button onClick={postCrew} style={{ backgroundColor: settings.primary_color }}>
                  Senden
                </Button>
                <Button
                  onClick={clearCrew}
                  variant="outline"
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Crew schließen
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2" style={{ borderColor: settings.background_color }}>
              <div className="text-sm font-semibold" style={{ color: settings.text_color }}>
                Aktueller Status
              </div>
              <StatusBlock msg={crewMsg} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs opacity-60" style={{ color: settings.text_color }}>
        Hinweis: Die Crew-Nachricht braucht Backend-Endpunkte unter /api/message/crew (siehe unten).
      </div>
    </div>
  );
}
