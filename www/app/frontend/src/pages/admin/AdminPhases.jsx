import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Save, X, Palette } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const presetColors = [
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#71717a'
];

export default function AdminPhases() {
  const { getAuthHeader } = useAuth();
  const { settings } = useTheme();
  const [phases, setPhases] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6',
    order: 0
  });

  const fetchPhases = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/phases`);
      setPhases(response.data);
    } catch (error) {
      console.error('Failed to fetch phases:', error);
    }
  }, []);

  useEffect(() => {
    fetchPhases();
  }, [fetchPhases]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingPhase) {
        await axios.put(
          `${API}/phases/${editingPhase.id}`,
          formData,
          getAuthHeader()
        );
        toast.success('Phase aktualisiert');
      } else {
        await axios.post(`${API}/phases`, { ...formData, order: phases.length }, getAuthHeader());
        toast.success('Phase erstellt');
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchPhases();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleEdit = (phase) => {
    setEditingPhase(phase);
    setFormData({
      name: phase.name,
      color: phase.color,
      order: phase.order
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Phase wirklich löschen?')) return;
    
    try {
      await axios.delete(`${API}/phases/${id}`, getAuthHeader());
      toast.success('Phase gelöscht');
      fetchPhases();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const resetForm = () => {
    setEditingPhase(null);
    setFormData({
      name: '',
      color: '#3b82f6',
      order: 0
    });
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="admin-phases">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold" style={{ color: settings.text_color }}>
            Phasen
          </h1>
          <p className="opacity-60" style={{ color: settings.text_color }}>
            Event-Phasen für die Farbkodierung
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={openNewDialog}
              style={{ backgroundColor: settings.primary_color }}
              data-testid="add-phase-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Neue Phase
            </Button>
          </DialogTrigger>
          <DialogContent style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}>
            <DialogHeader>
              <DialogTitle className="font-heading" style={{ color: settings.text_color }}>
                {editingPhase ? 'Phase bearbeiten' : 'Neue Phase'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label style={{ color: settings.text_color }}>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. Live, Pause, Ende"
                  style={{ backgroundColor: settings.background_color, borderColor: settings.surface_color, color: settings.text_color }}
                  required
                  data-testid="phase-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: settings.text_color }}>Farbe</Label>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded border-2"
                    style={{ backgroundColor: formData.color, borderColor: settings.surface_color }}
                  />
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10"
                    data-testid="phase-color-input"
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded transition-transform hover:scale-110 ${
                        formData.color === color ? 'ring-2 ring-white' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  style={{ borderColor: settings.surface_color, color: settings.text_color }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Abbrechen
                </Button>
                <Button type="submit" style={{ backgroundColor: settings.primary_color }} data-testid="phase-save-button">
                  <Save className="w-4 h-4 mr-2" />
                  Speichern
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {phases.map((phase) => (
          <Card 
            key={phase.id} 
            className="overflow-hidden"
            style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}
            data-testid={`phase-card-${phase.id}`}
          >
            <div className="h-2" style={{ backgroundColor: phase.color }} />
            <CardHeader className="pb-2">
              <CardTitle className="font-heading flex items-center justify-between" style={{ color: settings.text_color }}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: phase.color }}
                  />
                  {phase.name}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(phase)}
                    style={{ color: settings.text_color }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(phase.id)}
                    style={{ color: '#ef4444' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 opacity-50" style={{ color: settings.text_color }} />
                <code className="text-sm opacity-60" style={{ color: settings.text_color }}>
                  {phase.color}
                </code>
              </div>
            </CardContent>
          </Card>
        ))}

        {phases.length === 0 && (
          <Card style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }} className="col-span-full">
            <CardContent className="text-center py-12">
              <p className="opacity-50" style={{ color: settings.text_color }}>
                Keine Phasen vorhanden. Erstelle die erste Phase!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
