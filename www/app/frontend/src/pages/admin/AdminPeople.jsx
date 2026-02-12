import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Plus,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Pencil,
  User,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPeople() {
  const { getAuthHeader } = useAuth();
  const { settings } = useTheme();

  const [view, setView] = useState("people");

  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);

  // People form
  const [personName, setPersonName] = useState("");

  // Groups UI
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  // Dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null); // group object | null

  // Group form inside dialog
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]); // array of person ids
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // ================= LOAD =================

  const loadAll = async () => {
    const [pRes, gRes] = await Promise.all([
      axios.get(`${API}/people`),
      axios.get(`${API}/groups`),
    ]);
    setPeople(Array.isArray(pRes.data) ? pRes.data : []);
    setGroups(Array.isArray(gRes.data) ? gRes.data : []);
  };

  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  // ================= HELPERS =================

  const peopleById = useMemo(() => {
    const m = new Map();
    for (const p of people) m.set(String(p.id), p);
    return m;
  }, [people]);

  const resolveMemberNames = (memberIds) => {
    if (!Array.isArray(memberIds) || memberIds.length === 0) return [];
    return memberIds
      .map((id) => peopleById.get(String(id))?.name)
      .filter(Boolean);
  };

  const toggleExpanded = (groupId) => {
    setExpandedGroups((prev) => {
      const n = new Set(prev);
      const id = String(groupId);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const resetGroupForm = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupMembers([]);
    setMemberDropdownOpen(false);
    setMemberSearch("");
  };

  const openCreateGroupDialog = () => {
    resetGroupForm();
    setGroupDialogOpen(true);
  };

  const openEditGroupDialog = (g) => {
    setEditingGroup(g);
    setGroupName(g?.name || "");
    setGroupMembers(Array.isArray(g?.members) ? g.members.map(String) : []);
    setMemberDropdownOpen(false);
    setMemberSearch("");
    setGroupDialogOpen(true);
  };

  const filteredPeople = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => (p.name || "").toLowerCase().includes(q));
  }, [people, memberSearch]);

  const toggleMember = (personId) => {
    const id = String(personId);
    setGroupMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ================= PEOPLE =================

  const addPerson = async () => {
    if (!personName.trim()) return;

    try {
      await axios.post(`${API}/people`, { name: personName }, getAuthHeader());
      setPersonName("");
      await loadAll();
      toast.success("Person hinzugefügt");
    } catch {
      toast.error("Fehler beim Hinzufügen");
    }
  };

  const deletePerson = async (id) => {
    if (!confirm("Person wirklich löschen?")) return;

    try {
      await axios.delete(`${API}/people/${id}`, getAuthHeader());
      await loadAll();
      toast.success("Person gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  // ================= GROUPS =================
  // WICHTIG: Backend erwartet "member_ids" (dein Backend-Code).
  // Daher senden wir member_ids und lesen member_ids ODER members tolerant.
  const normalizeGroup = (g) => {
    const member_ids = Array.isArray(g?.member_ids)
      ? g.member_ids.map(String)
      : Array.isArray(g?.members)
      ? g.members.map(String)
      : [];
    return { ...g, member_ids };
  };

  const saveGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      toast.error("Bitte Gruppennamen angeben");
      return;
    }

    const payload = {
      name,
      member_ids: groupMembers.map(String),
    };

    try {
      if (editingGroup?.id) {
        await axios.put(
          `${API}/groups/${editingGroup.id}`,
          payload,
          getAuthHeader()
        );
        toast.success("Gruppe aktualisiert");
      } else {
        await axios.post(`${API}/groups`, payload, getAuthHeader());
        toast.success("Gruppe erstellt");
      }

      setGroupDialogOpen(false);
      resetGroupForm();
      await loadAll();
    } catch (e) {
      toast.error("Fehler beim Speichern");
    }
  };

  const deleteGroup = async (id) => {
    if (!confirm("Gruppe wirklich löschen?")) return;

    try {
      await axios.delete(`${API}/groups/${id}`, getAuthHeader());
      await loadAll();
      toast.success("Gruppe gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  // ================= RENDER =================

  return (
    <div className="space-y-6">
      {/* SWITCH */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <button
            onClick={() => setView("people")}
            className={`px-4 py-2 rounded ${
              view === "people" ? "bg-blue-600 text-white" : "opacity-60"
            }`}
          >
            Personen
          </button>

          <button
            onClick={() => setView("groups")}
            className={`px-4 py-2 rounded ${
              view === "groups" ? "bg-blue-600 text-white" : "opacity-60"
            }`}
          >
            Gruppen
          </button>
        </div>

        {/* TOP RIGHT BUTTON (only groups view) */}
        {view === "groups" && (
          <Button onClick={openCreateGroupDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Gruppe erstellen
          </Button>
        )}
      </div>

      {/* ================= PEOPLE VIEW ================= */}
      {view === "people" && (
        <>
          <Card style={{ backgroundColor: settings.surface_color }}>
            <CardHeader>
              <CardTitle style={{ color: settings.text_color }}>
                Neue Person
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <div className="flex-1">
                <Label style={{ color: settings.text_color }}>Name</Label>
                <Input
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="z.B. Technik Max"
                  style={{
                    backgroundColor: settings.background_color,
                    color: settings.text_color,
                    borderColor: settings.surface_color,
                  }}
                />
              </div>
              <Button
                onClick={addPerson}
                style={{ backgroundColor: settings.primary_color }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Hinzufügen
              </Button>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: settings.surface_color }}>
            <CardContent className="space-y-2 p-4">
              {people.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded"
                  style={{ backgroundColor: settings.background_color }}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" style={{ color: settings.text_color }} />
                    <span style={{ color: settings.text_color }}>{p.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePerson(p.id)}
                    style={{ color: "#ef4444" }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {people.length === 0 && (
                <p className="opacity-50 text-center" style={{ color: settings.text_color }}>
                  Noch keine Personen vorhanden
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ================= GROUPS VIEW ================= */}
      {view === "groups" && (
        <>
          <Card style={{ backgroundColor: settings.surface_color }}>
            <CardHeader>
              <CardTitle style={{ color: settings.text_color }}>
                Gruppen
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-2 p-4">
              {groups.map((raw) => {
                const g = normalizeGroup(raw);
                const gid = String(g.id);
                const expanded = expandedGroups.has(gid);
                const memberNames = resolveMemberNames(g.member_ids);

                return (
                  <div
                    key={g.id}
                    className="p-3 rounded border"
                    style={{
                      backgroundColor: settings.background_color,
                      borderColor: settings.surface_color,
                      color: settings.text_color,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => toggleExpanded(g.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span className="font-semibold">{g.name}</span>
                          <span className="opacity-60 text-sm">
                            ({memberNames.length})
                          </span>
                        </div>
                        <div className="text-sm opacity-60 mt-1">
                          {memberNames.length > 0
                            ? memberNames.slice(0, 4).join(", ") +
                              (memberNames.length > 4 ? " …" : "")
                            : "Keine Mitglieder"}
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpanded(g.id)}
                          style={{ color: settings.text_color }}
                          title="Aufklappen"
                        >
                          {expanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditGroupDialog(g)}
                          style={{ color: settings.text_color }}
                          title="Bearbeiten"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteGroup(g.id)}
                          style={{ color: "#ef4444" }}
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {expanded && (
                      <div
                        className="mt-3 pt-3 border-t space-y-2"
                        style={{ borderColor: settings.surface_color }}
                      >
                        <div className="text-sm font-semibold opacity-80">
                          Mitglieder:
                        </div>

                        {memberNames.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {memberNames.map((n) => (
                              <span
                                key={n}
                                className="px-2 py-1 rounded text-xs"
                                style={{
                                  backgroundColor: settings.surface_color,
                                  color: settings.text_color,
                                  border: `1px solid ${settings.surface_color}`,
                                }}
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm opacity-60">—</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {groups.length === 0 && (
                <p className="opacity-50 text-center" style={{ color: settings.text_color }}>
                  Noch keine Gruppen vorhanden
                </p>
              )}
            </CardContent>
          </Card>

          {/* CREATE / EDIT GROUP DIALOG */}
          <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
            <DialogContent
              style={{
                backgroundColor: settings.surface_color,
                borderColor: settings.surface_color,
              }}
            >
              <DialogHeader>
                <DialogTitle style={{ color: settings.text_color }}>
                  {editingGroup ? "Gruppe bearbeiten" : "Gruppe erstellen"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label style={{ color: settings.text_color }}>Gruppenname *</Label>
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="z.B. Technik"
                    style={{
                      backgroundColor: settings.background_color,
                      borderColor: settings.surface_color,
                      color: settings.text_color,
                    }}
                  />
                </div>

                {/* Multi-select dropdown */}
                <div className="space-y-2">
                  <Label style={{ color: settings.text_color }}>Mitglieder</Label>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMemberDropdownOpen((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded border"
                      style={{
                        backgroundColor: settings.background_color,
                        borderColor: settings.surface_color,
                        color: settings.text_color,
                      }}
                    >
                      <span className="opacity-80 text-sm">
                        {groupMembers.length === 0
                          ? "Mitglieder auswählen"
                          : `${groupMembers.length} ausgewählt`}
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-70" />
                    </button>

                    {memberDropdownOpen && (
                      <div
                        className="absolute z-50 mt-2 w-full rounded border shadow-lg overflow-hidden"
                        style={{
                          backgroundColor: settings.surface_color,
                          borderColor: settings.surface_color,
                        }}
                      >
                        <div className="p-2 border-b" style={{ borderColor: settings.background_color }}>
                          <Input
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="Suchen…"
                            style={{
                              backgroundColor: settings.background_color,
                              borderColor: settings.surface_color,
                              color: settings.text_color,
                            }}
                          />
                        </div>

                        <div className="max-h-64 overflow-auto">
                          {filteredPeople.map((p) => {
                            const pid = String(p.id);
                            const checked = groupMembers.includes(pid);

                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleMember(pid)}
                                className="w-full flex items-center justify-between px-3 py-2 hover:opacity-80"
                                style={{ color: settings.text_color }}
                              >
                                <span className="flex items-center gap-2">
                                  <span
                                    className="w-4 h-4 rounded border flex items-center justify-center"
                                    style={{
                                      borderColor: settings.background_color,
                                      backgroundColor: checked
                                        ? settings.primary_color
                                        : "transparent",
                                    }}
                                  >
                                    {checked && <Check className="w-3 h-3 text-white" />}
                                  </span>
                                  {p.name}
                                </span>
                              </button>
                            );
                          })}

                          {filteredPeople.length === 0 && (
                            <div className="p-3 text-sm opacity-60" style={{ color: settings.text_color }}>
                              Keine Treffer
                            </div>
                          )}
                        </div>

                        <div className="p-2 border-t flex justify-between items-center"
                          style={{ borderColor: settings.background_color }}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setGroupMembers([]);
                              setMemberSearch("");
                            }}
                            style={{ color: settings.text_color }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Leeren
                          </Button>

                          <Button
                            type="button"
                            onClick={() => setMemberDropdownOpen(false)}
                            style={{ backgroundColor: settings.primary_color }}
                          >
                            Fertig
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {groupMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {resolveMemberNames(groupMembers).map((n) => (
                        <span
                          key={n}
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: settings.background_color,
                            color: settings.text_color,
                            border: `1px solid ${settings.surface_color}`,
                          }}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setGroupDialogOpen(false);
                      resetGroupForm();
                    }}
                    style={{
                      borderColor: settings.background_color,
                      color: settings.text_color,
                    }}
                  >
                    Abbrechen
                  </Button>

                  <Button
                    type="button"
                    onClick={saveGroup}
                    style={{ backgroundColor: settings.primary_color }}
                  >
                    {editingGroup ? "Speichern" : "Erstellen"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
