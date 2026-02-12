import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Save, Palette, Eye, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminSettings() {
  const { getAuthHeader } = useAuth();
  const { settings, fetchSettings } = useTheme();

  const [formData, setFormData] = useState(null);
  const [passwordData, setPasswordData] = useState({ username: "", password: "" });
  const [isSaving, setIsSaving] = useState(false);

  const normalizedSettings = useMemo(() => {
    if (!settings) return null;

    return {
      ...settings,

      event_name: settings.event_name ?? settings.eventName ?? "Event Dashboard",
      event_date: settings.event_date ?? settings.eventDate ?? "",

      show_countdown: Boolean(
        settings.show_countdown ?? settings.showCountdown ?? true
      ),
      auto_scroll: Boolean(settings.auto_scroll ?? settings.autoScroll ?? false),
      auto_advance: Boolean(
        settings.auto_advance ?? settings.autoAdvance ?? true
      ),
    };
  }, [settings]);

  useEffect(() => {
    if (!normalizedSettings) return;
    setFormData(normalizedSettings);
  }, [normalizedSettings]);

  const handleSaveSettings = async () => {
    if (!formData) return;
    setIsSaving(true);
    try {
      await axios.put(`${API}/settings`, formData, getAuthHeader());
      await fetchSettings();
      toast.success("Einstellungen gespeichert");
    } catch (error) {
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!passwordData.password) {
      toast.error("Bitte Passwort eingeben");
      return;
    }

    try {
      await axios.post(
        `${API}/auth/change-password`,
        passwordData,
        getAuthHeader()
      );
      toast.success("Passwort geändert");
      setPasswordData({ username: "", password: "" });
    } catch (error) {
      toast.error("Fehler beim Ändern des Passworts");
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await axios.get(`${API}/backup`, getAuthHeader());
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `backup-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      toast.error("Backup Download fehlgeschlagen");
    }
  };

  const handleRestoreBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await axios.post(`${API}/backup/restore`, data, getAuthHeader());

      toast.success("Backup erfolgreich wiederhergestellt");
      window.location.reload();
    } catch (e) {
      toast.error("Backup Import fehlgeschlagen");
    } finally {
      // erlaubt denselben File erneut zu wählen
      event.target.value = "";
    }
  };

  const resetToDefaults = () => {
    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        primary_color: "#3b82f6",
        accent_color: "#ef4444",
        background_color: "#09090b",
        surface_color: "#18181b",
        text_color: "#fafafa",
      };
    });
  };

  if (!settings || !formData) return null;

  return (
    <div className="space-y-6" data-testid="admin-settings">
      <div>
        <h1
          className="font-heading text-3xl font-bold"
          style={{ color: settings.text_color }}
        >
          Einstellungen
        </h1>
        <p className="opacity-60" style={{ color: settings.text_color }}>
          Event und Design konfigurieren
        </p>
      </div>

      {/* Event Settings */}
      <Card
        style={{
          backgroundColor: settings.surface_color,
          borderColor: settings.surface_color,
        }}
      >
        <CardHeader>
          <CardTitle
            className="font-heading flex items-center gap-2"
            style={{ color: settings.text_color }}
          >
            <Eye className="w-5 h-5" />
            Event-Einstellungen
          </CardTitle>
          <CardDescription
            style={{ color: settings.text_color, opacity: 0.6 }}
          >
            Grundlegende Event-Informationen
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: settings.text_color }}>Event-Name</Label>
              <Input
                value={formData.event_name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, event_name: e.target.value }))
                }
                style={{
                  backgroundColor: settings.background_color,
                  borderColor: settings.surface_color,
                  color: settings.text_color,
                }}
                data-testid="event-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: settings.text_color }}>Event-Datum</Label>
              <Input
                type="date"
                value={formData.event_date}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, event_date: e.target.value }))
                }
                style={{
                  backgroundColor: settings.background_color,
                  borderColor: settings.surface_color,
                  color: settings.text_color,
                }}
                data-testid="event-date-input"
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-3 border-t pt-4">
            <Button onClick={handleDownloadBackup} type="button">
              📥 Backup herunterladen
            </Button>

            <Label
              className="inline-flex items-center justify-center cursor-pointer"
              style={{ color: settings.text_color }}
            >
              <Input
                type="file"
                accept="application/json"
                onChange={handleRestoreBackup}
                className="hidden"
              />
              <span className="px-4 py-2 rounded bg-green-600 text-white">
                📤 Backup wiederherstellen
              </span>
            </Label>
          </div>

          <Separator style={{ backgroundColor: settings.background_color }} />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label style={{ color: settings.text_color }}>
                  Countdown anzeigen
                </Label>
                <p
                  className="text-sm opacity-60"
                  style={{ color: settings.text_color }}
                >
                  Zeigt den verbleibenden Countdown im Zuschauer-View
                </p>
              </div>
              <Switch
                checked={!!formData.show_countdown}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, show_countdown: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label style={{ color: settings.text_color }}>Auto-Scroll</Label>
                <p
                  className="text-sm opacity-60"
                  style={{ color: settings.text_color }}
                >
                  Scrollt automatisch zum aktuellen Eintrag
                </p>
              </div>
              <Switch
                checked={!!formData.auto_scroll}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, auto_scroll: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label style={{ color: settings.text_color }}>
                  Auto-Advance
                </Label>
                <p
                  className="text-sm opacity-60"
                  style={{ color: settings.text_color }}
                >
                  Wechselt automatisch zum nächsten Eintrag wenn die Zeit
                  abgelaufen ist
                </p>
              </div>
              <Switch
                checked={!!formData.auto_advance}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, auto_advance: checked }))
                }
                data-testid="auto-advance-switch"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Color Settings */}
      <Card
        style={{
          backgroundColor: settings.surface_color,
          borderColor: settings.surface_color,
        }}
      >
        <CardHeader>
          <CardTitle
            className="font-heading flex items-center gap-2"
            style={{ color: settings.text_color }}
          >
            <Palette className="w-5 h-5" />
            Farben
          </CardTitle>
          <CardDescription
            style={{ color: settings.text_color, opacity: 0.6 }}
          >
            Passe das Design an dein Event an
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { key: "primary_color", label: "Primärfarbe" },
              { key: "accent_color", label: "Akzentfarbe" },
              { key: "background_color", label: "Hintergrund" },
              { key: "surface_color", label: "Oberfläche" },
              { key: "text_color", label: "Text" },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label style={{ color: settings.text_color }}>{label}</Label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded border"
                    style={{
                      backgroundColor: formData[key],
                      borderColor: settings.surface_color,
                    }}
                  />
                  <Input
                    type="color"
                    value={formData[key]}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, [key]: e.target.value }))
                    }
                    className="w-16 h-10"
                    data-testid={`${key}-input`}
                  />
                </div>
                <code
                  className="text-xs opacity-50"
                  style={{ color: settings.text_color }}
                >
                  {formData[key]}
                </code>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              style={{
                borderColor: settings.surface_color,
                color: settings.text_color,
              }}
              type="button"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Standard zurücksetzen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card
        style={{
          backgroundColor: formData.background_color,
          borderColor: formData.surface_color,
        }}
      >
        <CardHeader>
          <CardTitle className="font-heading" style={{ color: formData.text_color }}>
            Vorschau
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="p-4 rounded"
            style={{ backgroundColor: formData.surface_color }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: formData.primary_color }}
              />
              <span style={{ color: formData.text_color }}>Primärfarbe</span>
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: formData.accent_color }}
              />
              <span style={{ color: formData.text_color }}>Akzentfarbe</span>
            </div>

            <p style={{ color: formData.text_color }}>
              So sieht der Text auf der Oberfläche aus.
            </p>

            <Button className="mt-4" style={{ backgroundColor: formData.primary_color }}>
              Beispiel-Button
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveSettings}
          disabled={isSaving}
          style={{ backgroundColor: settings.primary_color }}
          data-testid="save-settings-button"
          type="button"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Speichern..." : "Einstellungen speichern"}
        </Button>
      </div>

      <Separator style={{ backgroundColor: settings.surface_color }} />

      {/* Password Change */}
      <Card
        style={{
          backgroundColor: settings.surface_color,
          borderColor: settings.surface_color,
        }}
      >
        <CardHeader>
          <CardTitle
            className="font-heading flex items-center gap-2"
            style={{ color: settings.text_color }}
          >
            <Lock className="w-5 h-5" />
            Passwort ändern
          </CardTitle>
          <CardDescription
            style={{ color: settings.text_color, opacity: 0.6 }}
          >
            Ändere das Admin-Passwort
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: settings.text_color }}>
                Neues Passwort
              </Label>
              <Input
                type="password"
                value={passwordData.password}
                onChange={(e) =>
                  setPasswordData((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="••••••••"
                style={{
                  backgroundColor: settings.background_color,
                  borderColor: settings.surface_color,
                  color: settings.text_color,
                }}
                data-testid="new-password-input"
              />
            </div>

            <Button
              type="submit"
              variant="outline"
              style={{
                borderColor: settings.primary_color,
                color: settings.text_color,
              }}
            >
              <Lock className="w-4 h-4 mr-2" />
              Passwort ändern
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
