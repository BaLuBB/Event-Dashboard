import { useEffect, useState } from "react";
import axios from "axios";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminGroups() {
  const { settings } = useTheme();

  const [groups, setGroups] = useState([]);
  const [people, setPeople] = useState([]);
  const [newGroup, setNewGroup] = useState("");

  const fetchData = async () => {
    try {
      const [g, p] = await Promise.all([
        axios.get(`${API}/groups`),
        axios.get(`${API}/people`)
      ]);

      setGroups(g.data);
      setPeople(p.data);
    } catch {
      toast.error("Fehler beim Laden");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // =====================
  // CREATE GROUP
  // =====================

  const createGroup = async () => {
    if (!newGroup.trim()) return;

    try {
      await axios.post(`${API}/groups`, { name: newGroup });
      setNewGroup("");
      fetchData();
      toast.success("Gruppe erstellt");
    } catch {
      toast.error("Fehler");
    }
  };

  // =====================
  // DELETE GROUP
  // =====================

  const deleteGroup = async (id) => {
    if (!confirm("Gruppe löschen?")) return;

    await axios.delete(`${API}/groups/${id}`);
    fetchData();
  };

  // =====================
  // TOGGLE PERSON
  // =====================

  const togglePerson = async (group, personId) => {
    const exists = group.member_ids.includes(personId);

    const updated = {
      ...group,
      member_ids: exists
        ? group.member_ids.filter(id => id !== personId)
        : [...group.member_ids, personId]
    };

    await axios.put(`${API}/groups/${group.id}`, updated);
    fetchData();
  };

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-3xl font-bold" style={{ color: settings.text_color }}>
          Gruppen
        </h1>
        <p className="opacity-60" style={{ color: settings.text_color }}>
          Personen zu Gruppen zuordnen
        </p>
      </div>

      {/* Create */}

      <Card style={{ backgroundColor: settings.surface_color }}>
        <CardContent className="flex gap-3 p-4">
          <Input
            placeholder="Neue Gruppe"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            style={{
              backgroundColor: settings.background_color,
              color: settings.text_color
            }}
          />

          <Button
            onClick={createGroup}
            style={{ backgroundColor: settings.primary_color }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Hinzufügen
          </Button>
        </CardContent>
      </Card>

      {/* Groups */}

      <div className="space-y-4">

        {groups.map(group => (

          <Card
            key={group.id}
            style={{ backgroundColor: settings.surface_color }}
          >

            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle style={{ color: settings.text_color }}>
                {group.name}
              </CardTitle>

              <Button
                variant="ghost"
                onClick={() => deleteGroup(group.id)}
                style={{ color: "#ef4444" }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-2">

              {people.map(person => (
                <div
                  key={person.id}
                  className="flex items-center gap-3"
                >
                  <Checkbox
                    checked={group.member_ids.includes(person.id)}
                    onCheckedChange={() =>
                      togglePerson(group, person.id)
                    }
                  />

                  <span style={{ color: settings.text_color }}>
                    {person.name}
                  </span>
                </div>
              ))}

              {people.length === 0 && (
                <p className="opacity-50" style={{ color: settings.text_color }}>
                  Keine Personen vorhanden
                </p>
              )}

            </CardContent>

          </Card>
        ))}

        {groups.length === 0 && (
          <p className="opacity-50" style={{ color: settings.text_color }}>
            Noch keine Gruppen erstellt
          </p>
        )}

      </div>
    </div>
  );
}
