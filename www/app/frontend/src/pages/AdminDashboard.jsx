import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminSchedule from '@/pages/admin/AdminSchedule';
import AdminPhases from '@/pages/admin/AdminPhases';
import AdminPeople from '@/pages/admin/AdminPeople';
import AdminGroups from '@/pages/admin/AdminGroups';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminMessages from '@/pages/admin/AdminMessages';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  LayoutDashboard,
  CalendarDays,
  Layers,
  Users,
  Shield,
  Settings,
  LogOut,
  MessageSquare
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { settings, fetchSettings } = useTheme();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const linkBase = 'flex items-center gap-2 px-3 py-2 rounded-md transition border';
  const linkInactive = { borderColor: 'transparent', color: settings.text_color, opacity: 0.75 };
  const linkActive = {
    borderColor: settings.primary_color,
    color: settings.text_color,
    opacity: 1,
    backgroundColor: settings.background_color
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: settings.background_color }}>
      <aside
        className="w-72 p-4 border-r"
        style={{ borderColor: settings.surface_color, backgroundColor: settings.surface_color }}
      >
        <div className="mb-4">
          <div className="font-heading text-xl font-bold" style={{ color: settings.text_color }}>
            Admin
          </div>
          <div className="text-sm opacity-60" style={{ color: settings.text_color }}>
            {settings.event_name || 'Event'}
          </div>
        </div>

        <nav className="space-y-2">
          <NavLink to="/admin" end className={linkBase} style={({ isActive }) => (isActive ? linkActive : linkInactive)}>
            <LayoutDashboard className="w-4 h-4" />
            Übersicht
          </NavLink>

          <NavLink to="/admin/schedule" className={linkBase} style={({ isActive }) => (isActive ? linkActive : linkInactive)}>
            <CalendarDays className="w-4 h-4" />
            Zeitplan
          </NavLink>

          <NavLink to="/admin/phases" className={linkBase} style={({ isActive }) => (isActive ? linkActive : linkInactive)}>
            <Layers className="w-4 h-4" />
            Phasen
          </NavLink>

          <NavLink to="/admin/message" className={linkBase} style={({ isActive }) => (isActive ? linkActive : linkInactive)}>
            <MessageSquare className="w-4 h-4" />
            Nachrichten
          </NavLink>

          <NavLink to="/admin/people" className={linkBase} style={({ isActive }) => (isActive ? linkActive : linkInactive)}>
            <Users className="w-4 h-4" />
            Personen
          </NavLink>

          <NavLink to="/admin/groups" className={linkBase} style={({ isActive }) => (isActive ? linkActive : linkInactive)}>
            <Shield className="w-4 h-4" />
            Gruppen
          </NavLink>

          <NavLink to="/admin/settings" className={linkBase} style={({ isActive }) => (isActive ? linkActive : linkInactive)}>
            <Settings className="w-4 h-4" />
            Settings
          </NavLink>
        </nav>

        <div className="mt-6 pt-4 border-t" style={{ borderColor: settings.background_color }}>
          <Button
            variant="outline"
            className="w-full"
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
            onClick={() => {
              try {
                logout?.();
              } finally {
                navigate('/admin');
              }
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <Card className="p-6" style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}>
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/schedule" element={<AdminSchedule />} />
            <Route path="/phases" element={<AdminPhases />} />
            <Route path="/message" element={<AdminMessages />} />
            <Route path="/people" element={<AdminPeople />} />
            <Route path="/groups" element={<AdminGroups />} />
            <Route path="/settings" element={<AdminSettings />} />
          </Routes>
        </Card>
      </main>
    </div>
  );
}
