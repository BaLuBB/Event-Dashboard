import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();
  const { settings } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/admin/dashboard');
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      toast.success('Erfolgreich angemeldet');
      navigate('/admin/dashboard');
    } catch (err) {
      setError('Ungültige Anmeldedaten');
      toast.error('Anmeldung fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: settings.background_color }}>
        <div className="animate-pulse" style={{ color: settings.text_color }}>Laden...</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: settings.background_color }}
      data-testid="admin-login"
    >
      <Card 
        className="w-full max-w-md"
        style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}
      >
        <CardHeader className="text-center">
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: settings.primary_color }}
          >
            <Lock className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="font-heading text-2xl" style={{ color: settings.text_color }}>
            Admin Login
          </CardTitle>
          <CardDescription style={{ color: settings.text_color, opacity: 0.6 }}>
            Melde dich an, um das Event zu verwalten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div 
                className="p-3 rounded flex items-center gap-2 text-sm"
                style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username" style={{ color: settings.text_color }}>
                Benutzername
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: settings.text_color, opacity: 0.5 }} />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="pl-10"
                  style={{ 
                    backgroundColor: settings.background_color, 
                    borderColor: settings.surface_color,
                    color: settings.text_color
                  }}
                  data-testid="username-input"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" style={{ color: settings.text_color }}>
                Passwort
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: settings.text_color, opacity: 0.5 }} />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  style={{ 
                    backgroundColor: settings.background_color, 
                    borderColor: settings.surface_color,
                    color: settings.text_color
                  }}
                  data-testid="password-input"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full font-heading"
              disabled={isLoading}
              style={{ backgroundColor: settings.primary_color }}
              data-testid="login-button"
            >
              {isLoading ? 'Anmelden...' : 'Anmelden'}
            </Button>
          </form>

          
        </CardContent>
      </Card>
    </div>
  );
}
