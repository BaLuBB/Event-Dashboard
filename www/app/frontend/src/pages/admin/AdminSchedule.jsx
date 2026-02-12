import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Save,
  X
} from "lucide-react";

import { toast } from "sonner";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;


// ======================
// SORTABLE ITEM
// ======================

function SortableItem({ item, phases, settings, onEdit, onDelete }) {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const phase = phases.find(p => p.id === item.phase_id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 rounded border-l-4 flex items-start gap-3"
      style={{
        backgroundColor: settings.background_color,
        borderLeftColor: phase?.color || settings.primary_color
      }}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab opacity-60 hover:opacity-100 mt-1"
      >
        <GripVertical className="w-5 h-5" style={{ color: settings.text_color }} />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm opacity-60" style={{ color: settings.text_color }}>
            {item.start_time} - {item.end_time}
          </span>

          {phase && (
            <Badge
              variant="outline"
              style={{ borderColor: phase.color, color: phase.color }}
            >
              {phase.name}
            </Badge>
          )}

          {item.is_current && (
            <Badge style={{ backgroundColor: "#ef4444" }}>LIVE</Badge>
          )}
        </div>

        <h4 className="font-semibold" style={{ color: settings.text_color }}>
          {item.title}
        </h4>

        {item.description && (
          <p className="text-sm opacity-70" style={{ color: settings.text_color }}>
            {item.description}
          </p>
        )}

        {item.notes && (
          <p className="text-xs italic opacity-50 mt-1" style={{ color: settings.text_color }}>
            Notizen vorhanden
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(item)}
          style={{ color: settings.text_color }}
        >
          <Pencil className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item.id)}
          style={{ color: "#ef4444" }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}



// ======================
// MAIN
// ======================

export default function AdminSchedule() {

  const { getAuthHeader } = useAuth();
  const { settings } = useTheme();

  const [schedule, setSchedule] = useState([]);
  const [phases, setPhases] = useState([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    phase_id: "",
    notes: ""
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );


  // ======================
  // LOAD
  // ======================

  const fetchData = useCallback(async () => {
    const [s, p] = await Promise.all([
      axios.get(`${API}/schedule`),
      axios.get(`${API}/phases`)
    ]);

    setSchedule(s.data);
    setPhases(p.data);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  // ======================
  // DRAG SAVE (FIX)
  // ======================

  const handleDragEnd = async (event) => {

    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = schedule.findIndex(i => i.id === active.id);
    const newIndex = schedule.findIndex(i => i.id === over.id);

    const newOrder = arrayMove(schedule, oldIndex, newIndex);

    setSchedule(newOrder);

    try {
      await axios.put(
        `${API}/schedule/reorder`,
        { order: newOrder.map(i => i.id) },
        getAuthHeader()
      );
    } catch {
      console.error("Order save failed");
    }
  };


  // ======================
  // CRUD
  // ======================

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      description: "",
      start_time: "",
      end_time: "",
      phase_id: "",
      notes: ""
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingItem) {
      await axios.put(
        `${API}/schedule/${editingItem.id}`,
        formData,
        getAuthHeader()
      );
      toast.success("Aktualisiert");
    } else {
      await axios.post(
        `${API}/schedule`,
        formData,
        getAuthHeader()
      );
      toast.success("Erstellt");
    }

    setIsDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      start_time: item.start_time,
      end_time: item.end_time,
      phase_id: item.phase_id || "",
      notes: item.notes || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Wirklich löschen?")) return;

    await axios.delete(`${API}/schedule/${id}`, getAuthHeader());
    fetchData();
  };


  // ======================
  // UI
  // ======================

  return (
    <div className="space-y-6">

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold" style={{ color: settings.text_color }}>
          Zeitplan
        </h1>

        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          style={{ backgroundColor: settings.primary_color }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Neuer Punkt
        </Button>
      </div>


      <Card style={{ backgroundColor: settings.surface_color }}>
        <CardContent className="p-4">

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >

            <SortableContext
              items={schedule.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >

              <div className="space-y-2">

                {schedule.map(item => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    phases={phases}
                    settings={settings}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}

                {schedule.length === 0 && (
                  <p className="opacity-50 text-center" style={{ color: settings.text_color }}>
                    Noch keine Einträge
                  </p>
                )}

              </div>

            </SortableContext>

          </DndContext>

        </CardContent>
      </Card>


      {/* SIMPLE POPUP */}

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

          <div
            className="p-6 rounded w-[400px] space-y-4"
            style={{ backgroundColor: settings.surface_color }}
          >

            <form onSubmit={handleSubmit} className="space-y-3">

              <Input
                placeholder="Titel"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
              />

              <Textarea
                placeholder="Beschreibung"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>

              <select
                value={formData.phase_id}
                onChange={e => setFormData({ ...formData, phase_id: e.target.value })}
                className="w-full rounded px-3 py-2"
                style={{
                  backgroundColor: settings.background_color,
                  color: settings.text_color
                }}
              >
                <option value="">Phase wählen</option>
                {phases.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <Textarea
                placeholder="Crew-Notizen"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />

              <div className="flex justify-end gap-2 pt-2">

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Abbrechen
                </Button>

                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  Speichern
                </Button>

              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
