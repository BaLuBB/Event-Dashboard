import { useEffect, useState } from "react";
import axios from "axios";
import { useTheme } from "@/context/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPeople() {
  const { settings } = useTheme();

  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);

  const fetchData = async () => {
    try {
      const [peopleRes, groupsRes] = await Promise.all([
        axios.get(`${API}/people`),
        axios.get(`${API}/groups`)
      ]);

      setPeople(peopleRes.data);
      setGroups(groupsRes.data);
    } catch (e) {
      console.error("Failed loading people/groups", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold" style={{ color: settings.text_color }}>
          Personen & Gruppen
        </h1>
        <p className="opacity-60" style={{ color: settings.text_color }}>
          Crew-Struktur Übersicht
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* PEOPLE */}
        <Card style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}>
          <CardHeader>
            <CardTitle style={{ color: settings.text_color }}>
              Personen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">

            {people.length === 0 && (
              <p className="opacity-50" style={{ color: settings.text_color }}>
                Keine Personen vorhanden
              </p>
            )}

            {people.map(p => (
              <div
                key={p.id}
                className="p-3 rounded flex justify-between"
                style={{ backgroundColor: settings.background_color }}
              >
                <span style={{ color: settings.text_color }}>
                  {p.name}
                </span>

                {p.tag && (
                  <span className="text-sm opacity-60" style={{ color: settings.text_color }}>
                    {p.tag}
                  </span>
                )}
              </div>
            ))}

          </CardContent>
        </Card>

        {/* GROUPS */}
        <Card style={{ backgroundColor: settings.surface_color, borderColor: settings.surface_color }}>
          <CardHeader>
            <CardTitle style={{ color: settings.text_color }}>
              Gruppen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">

            {groups.length === 0 && (
              <p className="opacity-50" style={{ color: settings.text_color }}>
                Keine Gruppen vorhanden
              </p>
            )}

            {groups.map(g => (
              <div
                key={g.id}
                className="p-3 rounded"
                style={{ backgroundColor: settings.background_color }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: g.color }}
                  />
                  <span style={{ color: settings.text_color }}>
                    {g.name}
                  </span>
                </div>

                <p
                  className="text-xs mt-1 opacity-60"
                  style={{ color: settings.text_color }}
                >
                  Mitglieder: {g.member_ids?.length || 0}
                </p>
              </div>
            ))}

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
