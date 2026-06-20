import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../ThemeContext.js";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { generateHomebrewItem, generateWorld, refineWorld, worldToText } from "../lib/ai.js";
import SessionsTab from "../components/SessionsTab.jsx";
import EncountersTab from "../components/EncountersTab.jsx";
import NpcsTab from "../components/NpcsTab.jsx";
import OracleTab from "../components/OracleTab.jsx";

const KINDS = [
  { value: "any", label: "Surprise me" },
  { value: "weapon", label: "Weapon" },
  { value: "armor or shield", label: "Armor / Shield" },
  { value: "wondrous item", label: "Wondrous item" },
  { value: "potion or consumable", label: "Potion / Consumable" },
  { value: "ring", label: "Ring" },
  { value: "staff, wand or rod", label: "Staff / Wand / Rod" },
];

const RARITY_COLOR = {
  common: "#9ca3af", uncommon: "#22c55e", rare: "#3b82f6", "very rare": "#a855f7", legendary: "#f59e0b",
};

const BLANK_WORLD = { overview: "", factions: [], locations: [], npcs: [], hooks: [] };

const hasWorld = (w) =>
  Boolean(w && (w.overview || w.factions?.length || w.locations?.length || w.npcs?.length || w.hooks?.length));

// Coerce a possibly-partial saved world into the full editable shape.
const normalizeWorld = (w) => ({
  overview: w?.overview || "",
  factions: Array.isArray(w?.factions) ? w.factions : [],
  locations: Array.isArray(w?.locations) ? w.locations : [],
  npcs: Array.isArray(w?.npcs) ? w.npcs : [],
  hooks: Array.isArray(w?.hooks) ? w.hooks : [],
});

// Object-array sections and the fields each entry edits.
const ENTRY_SECTIONS = [
  { key: "factions", label: "Factions", singular: "faction", blank: { name: "", description: "" },
    fields: [{ k: "name", ph: "Name", area: false }, { k: "description", ph: "Description", area: true }] },
  { key: "locations", label: "Locations", singular: "location", blank: { name: "", description: "" },
    fields: [{ k: "name", ph: "Name", area: false }, { k: "description", ph: "Description", area: true }] },
  { key: "npcs", label: "Notable NPCs", singular: "NPC", blank: { name: "", role: "", description: "" },
    fields: [{ k: "name", ph: "Name", area: false }, { k: "role", ph: "Role / title", area: false }, { k: "description", ph: "Description", area: true }] },
];

// ── A rendered homebrew item card ───────────────────────────────────────────
function ItemCard({ item, t }) {
  const rc = RARITY_COLOR[item.rarity] || t.accent;
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, background: t.panelAlt }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 17 }}>{item.name}</strong>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#fff", background: rc, padding: "3px 9px", borderRadius: 100 }}>{item.rarity}</span>
      </div>
      <div style={{ color: t.textMid, fontSize: 13, fontStyle: "italic", marginTop: 2 }}>{item.type}{item.attunement ? " (requires attunement)" : ""}</div>
      {item.description && <p style={{ color: t.text, fontSize: 14, lineHeight: 1.55, marginTop: 10, marginBottom: 0 }}>{item.description}</p>}
      {item.mechanics && <p style={{ color: t.textMid, fontSize: 14, lineHeight: 1.55, marginTop: 10, marginBottom: 0, whiteSpace: "pre-wrap" }}>{item.mechanics}</p>}
      {item.lore_tie && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.border}`, fontSize: 12.5, color: t.textDim }}>
          <span style={{ color: t.accent, fontWeight: 700 }}>Lore tie · </span>{item.lore_tie}
        </div>
      )}
    </div>
  );
}

// ── Read-only render of a structured campaign world ─────────────────────────
function WorldView({ world, t }) {
  if (!hasWorld(world)) return null;
  const heading = (txt) => (<div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: t.accent, marginBottom: 6 }}>{txt}</div>);
  const entry = (name, role, desc, i) => (
    <div key={i} style={{ marginBottom: 8 }}>
      <span style={{ fontWeight: 700, color: t.text }}>{name}</span>
      {role && <span style={{ color: t.textDim, fontSize: 13 }}> · {role}</span>}
      {desc && <div style={{ color: t.textMid, fontSize: 13.5, lineHeight: 1.5 }}>{desc}</div>}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {world.overview && <p style={{ fontSize: 15, lineHeight: 1.6, color: t.text, margin: 0 }}>{world.overview}</p>}
      {!!world.factions?.length && <div>{heading("Factions")}{world.factions.map((f, i) => entry(f.name, null, f.description, i))}</div>}
      {!!world.locations?.length && <div>{heading("Locations")}{world.locations.map((l, i) => entry(l.name, null, l.description, i))}</div>}
      {!!world.npcs?.length && <div>{heading("Notable NPCs")}{world.npcs.map((n, i) => entry(n.name, n.role, n.description, i))}</div>}
      {!!world.hooks?.length && (
        <div>{heading("Plot hooks")}
          <ul style={{ margin: 0, paddingLeft: 18, color: t.textMid, fontSize: 13.5, lineHeight: 1.6 }}>{world.hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ── Editable world form ─────────────────────────────────────────────────────
function WorldEditor({ draft, onChange, t }) {
  const input = { background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", color: t.text, fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const heading = (txt) => (<div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: t.accent, marginBottom: 8 }}>{txt}</div>);
  const addBtn = { background: "transparent", color: t.accent, border: `1px dashed ${t.border}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700, width: "100%" };
  const delBtn = { position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 6, border: `1px solid ${t.border}`, background: t.panel, color: t.textDim, cursor: "pointer", fontSize: 14, lineHeight: 1 };

  const setList = (key, list) => onChange({ ...draft, [key]: list });
  const updItem = (key, i, patch) => setList(key, draft[key].map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const addItem = (key, blank) => setList(key, [...(draft[key] || []), { ...blank }]);
  const delItem = (key, i) => setList(key, draft[key].filter((_, j) => j !== i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        {heading("Overview")}
        <textarea value={draft.overview} onChange={(e) => onChange({ ...draft, overview: e.target.value })} rows={3}
          placeholder="A few sentences setting the premise, tone, and central tension." style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
      </div>

      {ENTRY_SECTIONS.map((sec) => (
        <div key={sec.key}>
          {heading(sec.label)}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(draft[sec.key] || []).map((item, i) => (
              <div key={i} style={{ position: "relative", border: `1px solid ${t.border}`, borderRadius: 10, padding: 10, paddingRight: 38, background: t.panelAlt, display: "flex", flexDirection: "column", gap: 6 }}>
                <button onClick={() => delItem(sec.key, i)} title="Remove" style={delBtn}>×</button>
                {sec.fields.map((f) => (
                  f.area
                    ? <textarea key={f.k} value={item[f.k] || ""} onChange={(e) => updItem(sec.key, i, { [f.k]: e.target.value })} rows={2} placeholder={f.ph} style={{ ...input, resize: "vertical", lineHeight: 1.45 }} />
                    : <input key={f.k} value={item[f.k] || ""} onChange={(e) => updItem(sec.key, i, { [f.k]: e.target.value })} placeholder={f.ph} style={{ ...input, fontWeight: f.k === "name" ? 700 : 400 }} />
                ))}
              </div>
            ))}
            <button onClick={() => addItem(sec.key, sec.blank)} style={addBtn}>+ Add {sec.singular}</button>
          </div>
        </div>
      ))}

      <div>
        {heading("Plot hooks")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(draft.hooks || []).map((h, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={h} onChange={(e) => setList("hooks", draft.hooks.map((x, j) => (j === i ? e.target.value : x)))} placeholder="A one-line adventure hook." style={input} />
              <button onClick={() => delItem("hooks", i)} title="Remove" style={{ ...delBtn, position: "static", flexShrink: 0 }}>×</button>
            </div>
          ))}
          <button onClick={() => setList("hooks", [...(draft.hooks || []), ""])} style={addBtn}>+ Add hook</button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const t = useTheme();
  const { user, configured } = useAuth();

  const [campaigns, setCampaigns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  // Campaign management (rename / delete)
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // DM notes (freeform lore)
  const [loreDraft, setLoreDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesFlash, setNotesFlash] = useState(false);

  // World: AI builder + manual editor
  const [builderOpen, setBuilderOpen] = useState(false);
  const [wGenre, setWGenre] = useState("");
  const [wTone, setWTone] = useState("");
  const [wSeed, setWSeed] = useState("");
  const [buildingWorld, setBuildingWorld] = useState(false);
  const [worldError, setWorldError] = useState("");
  const [editing, setEditing] = useState(false);
  const [worldDraft, setWorldDraft] = useState(null);
  const [savingWorld, setSavingWorld] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState("");

  // Item generator
  const [genKind, setGenKind] = useState("any");
  const [genRequest, setGenRequest] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [draftItem, setDraftItem] = useState(null);
  const [savingItem, setSavingItem] = useState(false);

  const [homebrew, setHomebrew] = useState([]);

  // Party (characters linked to campaigns)
  const [myChars, setMyChars] = useState([]);
  const [charsError, setCharsError] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSel, setLinkSel] = useState("");

  // Sub-tab within the selected campaign
  const [tab, setTab] = useState("world");
  const [sessionCount, setSessionCount] = useState(0);
  const [encounterCount, setEncounterCount] = useState(0);
  const [npcCount, setNpcCount] = useState(0);

  const selected = campaigns.find((c) => c.id === selectedId) || null;
  const party = myChars.filter((c) => c.campaign_id === selectedId);
  const available = myChars.filter((c) => !c.campaign_id);
  const world = selected && hasWorld(selected.world) ? selected.world : null;

  const loadCampaigns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: true });
    setCampaigns(data || []);
    setLoading(false);
    if (data && data.length && !selectedId) setSelectedId(data[0].id);
  }, [user, selectedId]);

  useEffect(() => { loadCampaigns(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the user's characters once (lightweight columns) for party linking.
  useEffect(() => {
    if (!user) { setMyChars([]); return; }
    let cancelled = false;
    supabase.from("characters").select("id,name,race,class,level,campaign_id")
      .then(({ data, error }) => { if (cancelled) return; setMyChars(data || []); setCharsError(error ? error.message : null); });
    return () => { cancelled = true; };
  }, [user]);

  async function linkCharacter(id) {
    if (!id || !selected) return;
    const { error } = await supabase.from("characters").update({ campaign_id: selected.id }).eq("id", id);
    if (!error) {
      setMyChars((cs) => cs.map((c) => (c.id === id ? { ...c, campaign_id: selected.id } : c)));
      setLinkOpen(false); setLinkSel("");
    }
  }

  async function unlinkCharacter(id) {
    const { error } = await supabase.from("characters").update({ campaign_id: null }).eq("id", id);
    if (!error) setMyChars((cs) => cs.map((c) => (c.id === id ? { ...c, campaign_id: null } : c)));
  }

  useEffect(() => {
    setDraftItem(null); setGenError("");
    setWorldError(""); setBuilderOpen(false); setEditing(false); setWorldDraft(null);
    setWGenre(""); setWTone(""); setWSeed("");
    setRenaming(false); setConfirmingDelete(false);
    setLinkOpen(false); setLinkSel("");
    setRefineText(""); setRefineError("");
    setTab("world"); setSessionCount(0); setEncounterCount(0); setNpcCount(0);
    if (!selected) { setLoreDraft(""); setHomebrew([]); return; }
    setLoreDraft(selected.lore || "");
    let cancelled = false;
    supabase.from("homebrew_items").select("*").eq("campaign_id", selected.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) setHomebrew(data || []); });
    supabase.from("game_sessions").select("id", { count: "exact", head: true }).eq("campaign_id", selected.id)
      .then(({ count }) => { if (!cancelled) setSessionCount(count || 0); });
    supabase.from("encounters").select("id", { count: "exact", head: true }).eq("campaign_id", selected.id)
      .then(({ count }) => { if (!cancelled) setEncounterCount(count || 0); });
    supabase.from("npcs").select("id", { count: "exact", head: true }).eq("campaign_id", selected.id)
      .then(({ count }) => { if (!cancelled) setNpcCount(count || 0); });
    return () => { cancelled = true; };
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createCampaign() {
    const name = newName.trim();
    if (!name) return;
    const { data } = await supabase.from("campaigns").insert({ user_id: user.id, name, lore: "", world: {} }).select().single();
    if (data) { setCampaigns((cs) => [...cs, data]); setSelectedId(data.id); setNewName(""); }
  }

  async function renameCampaign() {
    const name = renameDraft.trim();
    if (!name || !selected) return;
    setSavingName(true);
    const { error } = await supabase.from("campaigns").update({ name, updated_at: new Date().toISOString() }).eq("id", selected.id);
    setSavingName(false);
    if (!error) {
      setCampaigns((cs) => cs.map((c) => (c.id === selected.id ? { ...c, name } : c)));
      setRenaming(false);
    }
  }

  async function deleteCampaign() {
    if (!selected) return;
    setDeleting(true);
    const { error } = await supabase.from("campaigns").delete().eq("id", selected.id);
    setDeleting(false);
    if (!error) {
      const remaining = campaigns.filter((c) => c.id !== selected.id);
      setCampaigns(remaining);
      setConfirmingDelete(false);
      setSelectedId(remaining[0]?.id ?? null);
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    const { error } = await supabase.from("campaigns").update({ lore: loreDraft, updated_at: new Date().toISOString() }).eq("id", selected.id);
    setSavingNotes(false);
    if (!error) {
      setCampaigns((cs) => cs.map((c) => (c.id === selected.id ? { ...c, lore: loreDraft } : c)));
      setNotesFlash(true); setTimeout(() => setNotesFlash(false), 1600);
    }
  }

  async function buildWorld() {
    if (!selected) return;
    setBuildingWorld(true); setWorldError("");
    try {
      const w = await generateWorld({ genre: wGenre, tone: wTone, seed: wSeed, name: selected.name });
      // Drop the generated world straight into the editor for review/tweak.
      setWorldDraft(normalizeWorld(w)); setEditing(true); setBuilderOpen(false);
    } catch (err) {
      setWorldError(err.message || "Generation failed.");
    } finally {
      setBuildingWorld(false);
    }
  }

  async function refineWorldDraft() {
    if (!worldDraft || !refineText.trim()) return;
    setRefining(true); setRefineError("");
    try {
      const updated = await refineWorld({ world: worldDraft, instruction: refineText });
      setWorldDraft(normalizeWorld(updated));
      setRefineText("");
    } catch (err) {
      setRefineError(err.message || "Refine failed.");
    } finally {
      setRefining(false);
    }
  }

  function startEdit() { setWorldDraft(normalizeWorld(selected.world || {})); setEditing(true); setBuilderOpen(false); setRefineText(""); setRefineError(""); }
  function startBlank() { setWorldDraft({ ...BLANK_WORLD }); setEditing(true); setBuilderOpen(false); }
  function cancelEdit() { setEditing(false); setWorldDraft(null); setWorldError(""); setRefineText(""); setRefineError(""); }

  async function saveWorld() {
    if (!worldDraft || !selected) return;
    setSavingWorld(true);
    const { error } = await supabase.from("campaigns").update({ world: worldDraft, updated_at: new Date().toISOString() }).eq("id", selected.id);
    setSavingWorld(false);
    if (!error) {
      setCampaigns((cs) => cs.map((c) => (c.id === selected.id ? { ...c, world: worldDraft } : c)));
      setEditing(false); setWorldDraft(null);
    } else {
      setWorldError(error.message || "Couldn't save. Did you run the `world` column migration?");
    }
  }

  async function generate() {
    if (!selected) return;
    setGenerating(true); setGenError(""); setDraftItem(null);
    try {
      const lore = world ? worldToText(world, loreDraft) : loreDraft;
      const item = await generateHomebrewItem({ lore, kind: genKind, request: genRequest });
      setDraftItem(item);
    } catch (err) {
      setGenError(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveItem() {
    if (!draftItem || !selected) return;
    setSavingItem(true);
    const { data } = await supabase.from("homebrew_items").insert({ campaign_id: selected.id, user_id: user.id, name: draftItem.name, kind: draftItem.type, data: draftItem }).select().single();
    setSavingItem(false);
    if (data) { setHomebrew((h) => [data, ...h]); setDraftItem(null); }
  }

  async function deleteItem(id) {
    await supabase.from("homebrew_items").delete().eq("id", id);
    setHomebrew((h) => h.filter((x) => x.id !== id));
  }

  // ── Gates ─────────────────────────────────────────────────────────────────
  if (!configured) return <Centered t={t} title="Campaigns" body="Accounts aren't configured on this build yet, so campaigns can't be saved. Add your Supabase keys to enable sign-in." />;
  if (!user) return <Centered t={t} title="Campaigns" body="Sign in to create a campaign, build its world, and generate homebrew that stays true to your setting." />;

  const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 });
  const ghostBtn = { background: "transparent", color: t.textMid, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 };
  const input = { background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", color: t.text, fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const sectionWrap = { marginTop: 28, paddingTop: 20, borderTop: `1px solid ${t.border}` };
  const fieldLabel = { display: "block", fontSize: 12, color: t.textDim, marginBottom: 4 };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px", display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ── Campaign list ── */}
      <aside style={{ flex: "1 1 240px", minWidth: 220 }}>
        <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>Campaigns</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {loading && <div style={{ color: t.textDim, fontSize: 14 }}>Loading…</div>}
          {!loading && campaigns.length === 0 && <div style={{ color: t.textDim, fontSize: 14 }}>No campaigns yet. Create your first below.</div>}
          {campaigns.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)} style={{
              textAlign: "left", border: `1px solid ${c.id === selectedId ? t.accent : t.border}`,
              background: c.id === selectedId ? t.accentSoft : t.panel, color: c.id === selectedId ? t.accent : t.textMid,
              borderRadius: 8, padding: "10px 12px", cursor: "pointer", fontSize: 14, fontWeight: 600,
            }}>
              {c.name}
              {hasWorld(c.world) && <span title="Has a world" style={{ float: "right", opacity: 0.7 }}>🌐</span>}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createCampaign(); }} placeholder="New campaign name" style={{ ...input, flex: 1 }} />
          <button onClick={createCampaign} disabled={!newName.trim()} style={{ ...btn(t.accent), opacity: newName.trim() ? 1 : 0.5 }}>+</button>
        </div>
      </aside>

      {/* ── Selected campaign ── */}
      <section style={{ flex: "3 1 480px", minWidth: 300 }}>
        {!selected ? (
          <div style={{ color: t.textDim, fontSize: 15, paddingTop: 40 }}>Select or create a campaign to begin.</div>
        ) : (
          <>
            {/* ── Dashboard header ── */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {renaming ? (
                  <>
                    <input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") renameCampaign(); if (e.key === "Escape") setRenaming(false); }}
                      style={{ ...input, fontSize: 20, fontWeight: 700, maxWidth: 360 }} />
                    <button onClick={renameCampaign} disabled={savingName || !renameDraft.trim()} style={{ ...btn(t.accent), opacity: savingName || !renameDraft.trim() ? 0.5 : 1 }}>{savingName ? "Saving…" : "Save"}</button>
                    <button onClick={() => setRenaming(false)} style={ghostBtn}>Cancel</button>
                  </>
                ) : (
                  <>
                    <h1 style={{ fontSize: 26, margin: 0 }}>{selected.name}</h1>
                    <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                      <button onClick={() => { setRenameDraft(selected.name); setRenaming(true); setConfirmingDelete(false); }} style={ghostBtn}>Rename</button>
                      <button onClick={() => setConfirmingDelete(true)} style={{ ...ghostBtn, color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}>Delete</button>
                    </div>
                  </>
                )}
              </div>

              {confirmingDelete && (
                <div style={{ marginTop: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 14, color: t.text, marginBottom: 10, lineHeight: 1.5 }}>
                    Delete <strong>{selected.name}</strong>? This permanently removes its world{homebrew.length ? ` and ${homebrew.length} saved homebrew item${homebrew.length > 1 ? "s" : ""}` : ""}.
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={deleteCampaign} disabled={deleting} style={{ ...btn("#ef4444"), opacity: deleting ? 0.6 : 1 }}>{deleting ? "Deleting…" : "Delete campaign"}</button>
                    <button onClick={() => setConfirmingDelete(false)} style={ghostBtn}>Cancel</button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <Chip t={t} label="World" value={world ? "Built" : "Not yet"} on={!!world} onClick={() => setTab("world")} />
                <Chip t={t} label="Homebrew" value={`${homebrew.length} item${homebrew.length === 1 ? "" : "s"}`} on={homebrew.length > 0} onClick={() => setTab("homebrew")} />
                <Chip t={t} label="Characters" value={`${party.length} linked`} on={party.length > 0} onClick={() => setTab("party")} />
                <Chip t={t} label="Sessions" value={`${sessionCount}`} on={sessionCount > 0} onClick={() => setTab("sessions")} />
                <Chip t={t} label="Encounters" value={`${encounterCount}`} on={encounterCount > 0} onClick={() => setTab("encounters")} />
                <Chip t={t} label="NPCs" value={`${npcCount}`} on={npcCount > 0} onClick={() => setTab("npcs")} />
              </div>
            </div>

            {/* ── Sub-tabs ── */}
            <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${t.border}`, marginBottom: 4 }}>
              {[["world", "🌐 World"], ["party", "👥 Party"], ["sessions", "📅 Sessions"], ["encounters", "⚔️ Encounters"], ["npcs", "🧑 NPCs"], ["oracle", "🔮 Oracle"], ["homebrew", "✨ Homebrew"]].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} style={{
                  background: "transparent", border: "none", borderBottom: `2px solid ${tab === key ? t.accent : "transparent"}`,
                  color: tab === key ? t.accent : t.textMid, padding: "10px 14px", cursor: "pointer", fontSize: 14, fontWeight: 700, marginBottom: -1,
                }}>{label}</button>
              ))}
            </div>

            {/* ── Party tab ── */}
            {tab === "party" && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 18, margin: 0 }}>👥 Party</h2>
                {available.length > 0 && !linkOpen && <button onClick={() => setLinkOpen(true)} style={ghostBtn}>+ Link a character</button>}
              </div>

              {linkOpen && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={linkSel} onChange={(e) => setLinkSel(e.target.value)} style={{ ...input, width: "auto", cursor: "pointer", flex: "1 1 200px" }}>
                    <option value="">Choose a character…</option>
                    {available.map((c) => <option key={c.id} value={c.id}>{c.name}{[c.race, c.class].filter(Boolean).length ? ` — ${[c.race, c.class].filter(Boolean).join(" ")}` : ""}</option>)}
                  </select>
                  <button onClick={() => linkCharacter(linkSel)} disabled={!linkSel} style={{ ...btn(t.accent), opacity: linkSel ? 1 : 0.5 }}>Link</button>
                  <button onClick={() => { setLinkOpen(false); setLinkSel(""); }} style={ghostBtn}>Cancel</button>
                </div>
              )}

              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {party.length === 0 && !linkOpen && (
                  <div style={{ color: charsError ? "#ef4444" : t.textDim, fontSize: 14, lineHeight: 1.5 }}>
                    {charsError
                      ? "Couldn't load your characters — the party feature needs the new `campaign_id` column. Run the latest migration in Supabase (see schema.sql), then reload."
                      : available.length === 0 && myChars.length === 0 ? "No characters yet — create one on the Characters page, then link it here."
                      : available.length === 0 ? "All your characters are linked elsewhere."
                      : "No characters linked yet."}
                  </div>
                )}
                {party.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", background: t.panelAlt }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: t.textDim }}>{[c.race, c.class].filter(Boolean).join(" ")}{c.level ? ` · Level ${c.level}` : ""}</div>
                    </div>
                    <button onClick={() => unlinkCharacter(c.id)} style={ghostBtn}>Unlink</button>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* ── World tab ── */}
            {tab === "world" && (<>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>🌐 World</h2>
              {!editing && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {world && <button onClick={startEdit} style={ghostBtn}>Edit</button>}
                  <button onClick={() => setBuilderOpen((o) => !o)} style={ghostBtn}>{builderOpen ? "Close" : world ? "Rebuild with AI" : "✨ Build with AI"}</button>
                  {!world && <button onClick={startBlank} style={ghostBtn}>Create by hand</button>}
                </div>
              )}
            </div>

            {/* AI builder panel */}
            {builderOpen && !editing && (
              <div style={{ marginTop: 14, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, background: t.panel }}>
                <p style={{ marginTop: 0, color: t.textMid, fontSize: 14, lineHeight: 1.5 }}>Give the AI a little direction; it drafts a world you can then edit before saving.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><label style={fieldLabel}>Genre / flavor</label><input value={wGenre} onChange={(e) => setWGenre(e.target.value)} placeholder="e.g. dark fantasy, sword & sorcery" style={input} /></div>
                  <div><label style={fieldLabel}>Tone</label><input value={wTone} onChange={(e) => setWTone(e.target.value)} placeholder="e.g. grim, mythic, hopeful" style={input} /></div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={fieldLabel}>Seed idea (optional)</label>
                  <textarea value={wSeed} onChange={(e) => setWSeed(e.target.value)} rows={2} placeholder="A sentence or two to anchor the setting — a place, a conflict, an image." style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <button onClick={buildWorld} disabled={buildingWorld} style={{ ...btn(t.accent), opacity: buildingWorld ? 0.6 : 1 }}>{buildingWorld ? "Building world…" : "✨ Generate world"}</button>
                </div>
                {worldError && <ErrBox t={t}>{worldError}</ErrBox>}
              </div>
            )}

            {/* Editor */}
            {editing && worldDraft && (
              <div style={{ marginTop: 14, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, background: t.panel }}>
                {/* Ask-AI refine bar */}
                <div style={{ border: `1px solid ${t.accentSoft}`, background: t.accentSoft, borderRadius: 10, padding: 12, marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: t.accent, marginBottom: 6 }}>🔮 Ask the AI to tweak this world</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      value={refineText}
                      onChange={(e) => setRefineText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !refining && refineText.trim()) refineWorldDraft(); }}
                      placeholder='e.g. "make the Drowned Choir more sympathetic" or "add a desert trade-city"'
                      style={{ ...input, flex: "1 1 220px" }}
                    />
                    <button onClick={refineWorldDraft} disabled={refining || !refineText.trim()} style={{ ...btn(t.accent), opacity: refining || !refineText.trim() ? 0.6 : 1 }}>
                      {refining ? "Reworking…" : "Apply"}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMid, marginTop: 6 }}>It rewrites the draft below — review and edit, then Save world.</div>
                  {refineError && <ErrBox t={t}>{refineError}</ErrBox>}
                </div>

                <WorldEditor draft={worldDraft} onChange={setWorldDraft} t={t} />
                {worldError && <ErrBox t={t}>{worldError}</ErrBox>}
                <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                  <button onClick={saveWorld} disabled={savingWorld} style={{ ...btn(t.accent), opacity: savingWorld ? 0.6 : 1 }}>{savingWorld ? "Saving…" : "Save world"}</button>
                  <button onClick={cancelEdit} style={ghostBtn}>Cancel</button>
                  <button onClick={() => { setEditing(false); setWorldDraft(null); setBuilderOpen(true); }} style={ghostBtn}>Start over with AI</button>
                </div>
              </div>
            )}

            {/* Read-only world */}
            {!editing && world && <div style={{ marginTop: 14 }}><WorldView world={world} t={t} /></div>}

            {/* Empty state */}
            {!editing && !world && !builderOpen && (
              <div style={{ marginTop: 14, color: t.textDim, fontSize: 14, lineHeight: 1.6 }}>
                No world yet. <strong style={{ color: t.textMid }}>Build with AI</strong> for a fast draft, or <strong style={{ color: t.textMid }}>Create by hand</strong> to write it yourself.
              </div>
            )}

            {/* ── DM notes ── */}
            <div style={sectionWrap}>
              <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 6 }}>📝 DM notes</h2>
              <p style={{ color: t.textDim, fontSize: 13, marginTop: 0, marginBottom: 8 }}>Freeform extras — house rules, secrets, anything the AI should also weave in.</p>
              <textarea value={loreDraft} onChange={(e) => setLoreDraft(e.target.value)} rows={4} placeholder="Optional notes…" style={{ ...input, resize: "vertical", lineHeight: 1.55 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                <button onClick={saveNotes} disabled={savingNotes || loreDraft === (selected.lore || "")} style={{ ...btn(t.accent), opacity: savingNotes || loreDraft === (selected.lore || "") ? 0.5 : 1 }}>{savingNotes ? "Saving…" : "Save notes"}</button>
                {notesFlash && <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>Saved ✓</span>}
                {loreDraft !== (selected.lore || "") && !notesFlash && <span style={{ color: t.textDim, fontSize: 13 }}>Unsaved changes</span>}
              </div>
            </div>
            </>)}

            {/* ── Homebrew tab ── */}
            {tab === "homebrew" && (<>
            <div style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>✨ Generate homebrew item</h2>
              {!world && !loreDraft.trim() && <p style={{ color: t.textDim, fontSize: 13, marginTop: 0 }}>Tip: build a world or add notes first so items come out on-theme.</p>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "0 0 auto" }}>
                  <label style={fieldLabel}>Type</label>
                  <select value={genKind} onChange={(e) => setGenKind(e.target.value)} style={{ ...input, width: "auto", cursor: "pointer" }}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={fieldLabel}>Direction (optional)</label>
                  <input value={genRequest} onChange={(e) => setGenRequest(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !generating) generate(); }} placeholder="e.g. a reward for the swamp arc, uncommon" style={input} />
                </div>
                <button onClick={generate} disabled={generating} style={{ ...btn(t.accent), opacity: generating ? 0.6 : 1 }}>{generating ? "Conjuring…" : "Generate"}</button>
              </div>
              {genError && <ErrBox t={t}>{genError}</ErrBox>}
              {draftItem && (
                <div style={{ marginTop: 16 }}>
                  <ItemCard item={draftItem} t={t} />
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <button onClick={saveItem} disabled={savingItem} style={{ ...btn(t.accent), opacity: savingItem ? 0.6 : 1 }}>{savingItem ? "Saving…" : "Save to campaign"}</button>
                    <button onClick={generate} disabled={generating} style={ghostBtn}>Reroll</button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Saved homebrew ── */}
            {homebrew.length > 0 && (
              <div style={sectionWrap}>
                <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>Saved homebrew ({homebrew.length})</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {homebrew.map((row) => (
                    <div key={row.id} style={{ position: "relative" }}>
                      <ItemCard item={row.data} t={t} />
                      <button onClick={() => deleteItem(row.id)} title="Delete" style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 6, border: `1px solid ${t.border}`, background: t.panel, color: t.textDim, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>)}

            {/* ── Sessions tab ── */}
            {tab === "sessions" && (
              <SessionsTab campaign={selected} setting={world ? worldToText(world, loreDraft) : loreDraft} party={party} t={t} onCountChange={setSessionCount} />
            )}

            {/* ── Encounters tab ── */}
            {tab === "encounters" && (
              <EncountersTab campaign={selected} setting={world ? worldToText(world, loreDraft) : loreDraft} party={party} t={t} onCountChange={setEncounterCount} />
            )}

            {/* ── NPCs tab ── */}
            {tab === "npcs" && (
              <NpcsTab campaign={selected} setting={world ? worldToText(world, loreDraft) : loreDraft} t={t} onCountChange={setNpcCount} />
            )}

            {/* ── Oracle tab ── */}
            {tab === "oracle" && (
              <OracleTab setting={world ? worldToText(world, loreDraft) : loreDraft} t={t} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Chip({ t, label, value, on, soon, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", flexDirection: "column", border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 12px", background: t.panel, minWidth: 84, opacity: soon ? 0.55 : 1, cursor: onClick ? "pointer" : "default" }}>
      <span style={{ fontSize: 11, color: t.textDim, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: soon ? t.textDim : on ? t.accent : t.textMid }}>{value}</span>
    </div>
  );
}

function ErrBox({ t, children }) {
  return <div style={{ marginTop: 12, color: "#ef4444", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px" }}>{children}</div>;
}

function Centered({ t, title, body }) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 28px", textAlign: "center" }}>
      <h1 style={{ fontSize: 34, marginBottom: 12 }}>{title}</h1>
      <p style={{ color: t.textMid, fontSize: 16, lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}
