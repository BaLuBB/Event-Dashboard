import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [settings, setSettings] = useState({
    event_name: "Event Dashboard",
    event_date: "",
    primary_color: "#3b82f6",
    accent_color: "#ef4444",
    background_color: "#09090b",
    surface_color: "#18181b",
    text_color: "#fafafa",
    is_paused: false,
    current_item_id: null,
    show_countdown: true,
    auto_scroll: true
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // Poll for settings changes every 5 seconds
    const interval = setInterval(fetchSettings, 5000);
    return () => clearInterval(interval);
  }, []);

  // Apply CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--event-primary', settings.primary_color);
    root.style.setProperty('--event-accent', settings.accent_color);
    root.style.setProperty('--event-background', settings.background_color);
    root.style.setProperty('--event-surface', settings.surface_color);
    root.style.setProperty('--event-text', settings.text_color);
  }, [settings]);

  return (
    <ThemeContext.Provider value={{ settings, setSettings, fetchSettings, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
