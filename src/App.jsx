// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

/**
 * ✅ API base
 * DEV:  "/api/"   (Vite proxy rewrites to /lachmajun_cards/projects/)
 * PROD: "{BASE_URL}projects/"  (BASE_URL is your Vite base, e.g. "/lachmajun_cards/")
 */
const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "/api/" : `${import.meta.env.BASE_URL || "/"}projects/`;

const TRANSLATE_ENDPOINT = `${API_BASE}translate.php`;
const DB_ENDPOINT = `${API_BASE}cards.php`;

const UNIT_OPTIONS = ["ל-100 גרם", "ליח׳"];

const OPTION_PRESETS = [
  "",
  "אינו מכיל גלוטן אך מיוצר בסביבה המכילה גלוטן",
  "טבעוני",
  "בשר חלק חול לפי שיטת בית יוסף",
  "צמחוני",
  "ללא חשש תולעים",
  "עוף מהדרין",
  "חדש",
];

const CSV_HEADERS = [
  "is_selected",
  "line_1",
  "line_2",
  "line_3",
  "english_name",
  "option_1",
  "option_2",
  "option_3",
  "price",
  "unit",
  "alergonim_1",
  "alergonim_2",
  "alergonim_3",
];

/* =========================
   ✅ ALLERGENS (UI shows LABEL, DB/CSV keeps PATH)
   ========================= */
const ALERGENS = {
  GLUTEN: {
    key: "GLUTEN",
    label: "גלוטן",
    path: "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-01.png",
  },
  VEGAN: {
    key: "VEGAN",
    label: "טבעוני",
    path: "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-02.png",
  },
  VEGETARIAN: {
    key: "VEGETARIAN",
    label: "צמחוני",
    path: "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-03.png",
  },
};
const ALERGEN_LIST = Object.values(ALERGENS);

/* =========================
   Helpers
   ========================= */
function makeClientId() {
  return crypto?.randomUUID?.() || `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cleanSpaces(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForSearch(s) {
  return cleanSpaces(String(s ?? "")).toLowerCase();
}

function finalOption(preset, custom) {
  const c = (custom ?? "").trim();
  return c ? c : (preset ?? "").trim();
}

function combineLines(line1, line2, line3) {
  return [line1, line2, line3]
    .map((v) => (v ?? "").toString().trim())
    .filter(Boolean)
    .join(" ");
}

/** Map note text -> allergen PATH (or empty) */
function allergenFromNote(note) {
  const t = cleanSpaces(note);
  if (!t) return "";
  if (t.startsWith("אינו מכיל גלוטן")) return ALERGENS.GLUTEN.path;
  if (t === "טבעוני") return ALERGENS.VEGAN.path;
  if (t === "צמחוני") return ALERGENS.VEGETARIAN.path;
  return "";
}

/** PATH -> LABEL (for UI only) */
function allergenPathToLabel(path) {
  const p = cleanSpaces(path);
  if (!p) return "";
  const found = ALERGEN_LIST.find((a) => a.path === p);
  return found ? found.label : "ידני";
}

/** LABEL -> PATH */
function allergenLabelToPath(label) {
  const l = cleanSpaces(label);
  if (!l) return "";
  const found = ALERGEN_LIST.find((a) => a.label === l);
  return found ? found.path : "";
}

function toBool(v, def = false) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s) return def;
  return s === "true" || s === "1" || s === "yes" || s === "כן";
}

/** Accept CSV/Excel values for alergonim: TRUE/FALSE or a path */
function toAlergonValue(v) {
  const s = cleanSpaces(v);
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "true" || low === "1" || low === "yes" || low === "כן") return ALERGENS.GLUTEN.path;
  if (low === "false" || low === "0" || low === "no" || low === "לא") return "";
  return s; // already a path
}

/**
 * ✅ Empty row rule:
 * do NOT save if line_1+line_2+line_3+english_name+price+unit are ALL empty
 */
function isRowEmptyForDB(r) {
  const l1 = cleanSpaces(r.line_1);
  const l2 = cleanSpaces(r.line_2);
  const l3 = cleanSpaces(r.line_3);
  const en = cleanSpaces(r.english_name);
  const price = cleanSpaces(r.price);
  const unit = cleanSpaces(r.unit);
  return !l1 && !l2 && !l3 && !en && !price && !unit;
}

function isNumericLike(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return /^-?\d+(\.\d+)?$/.test(s);
}

function compareValues(a, b, dir) {
  if (isNumericLike(a) && isNumericLike(b)) return (Number(a) - Number(b)) * dir;
  const as = normalizeForSearch(a);
  const bs = normalizeForSearch(b);
  return as.localeCompare(bs) * dir;
}

/** ✅ Always parse response as text first (handles 404 HTML etc.) */
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Server returned NOT JSON. First 200 chars:\n${text.slice(0, 200)}`);
  }

  if (!res.ok || !data?.ok) {
    throw new Error(data?.details || data?.error || `HTTP ${res.status}`);
  }
  return data;
}

/* =========================
   ✅ Approx width warning for 9.5cm (font-based approximation)
   ========================= */
const MAX_CM = 9.5;
const FONT_PT = 35;
const PT_TO_CM = 0.0352778; // 1pt ~ 0.0352778cm
const EM_CM = FONT_PT * PT_TO_CM;

const NARROW = new Set(["י", "ו", "ן"]);
const VERY_WIDE = new Set([
  "מ",
  "ש",
  "ת",
  "ח",
  "ק",
  "ם",
  "פ",
  "צ",
  "ץ",
  "ג",
  "ד",
  "ר",
  "ב",
  "כ",
  "ך",
]);

function estimateTextCm(text) {
  const t = String(text ?? "");
  let sum = 0;

  for (const ch of t) {
    if (ch === " ") sum += 0.28;
    else if (NARROW.has(ch)) sum += 0.33;
    else if (/[0-9]/.test(ch)) sum += 0.52;
    else if (/[A-Za-z]/.test(ch)) sum += 0.55;
    else if (VERY_WIDE.has(ch)) sum += 0.62;
    else sum += 0.55;
  }

  return sum * EM_CM;
}

function formatCm(n) {
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(1);
}

/* =========================
   ✅ Row model
   ========================= */
function emptyRow() {
  return {
    id: null,
    client_id: makeClientId(),

    is_selected: false, // checkbox

    line_1: "",
    line_2: "",
    line_3: "",
    english_name: "",

    option_1_preset: "",
    option_1_custom: "",
    option_2_preset: "",
    option_2_custom: "",
    option_3_preset: "",
    option_3_custom: "",

    price: "",
    unit: "",

    alergonim_1: "",
    alergonim_2: "",
    alergonim_3: "",

    alergonim_1_locked: false,
    alergonim_2_locked: false,
    alergonim_3_locked: false,

    alergonim_1_mode: "auto",
    alergonim_2_mode: "auto",
    alergonim_3_mode: "auto",

    is_new: false, // only one allowed at a time (draft row)
    dirty: false, // ✅ changed locally but not saved to server
  };
}

function normalizeImportedRow(raw) {
  const r = emptyRow();

  if (raw?.id !== undefined && raw?.id !== null && String(raw.id).trim() !== "") {
    const n = Number(raw.id);
    r.id = Number.isFinite(n) ? n : null;
  }

  // typo support
  if (raw?.english_anme && !raw?.english_name) raw.english_name = raw.english_anme;

  // basic fields
  r.is_selected = toBool(raw?.is_selected, false);
  r.line_1 = String(raw?.line_1 ?? "");
  r.line_2 = String(raw?.line_2 ?? "");
  r.line_3 = String(raw?.line_3 ?? "");
  r.english_name = String(raw?.english_name ?? "");
  r.price = String(raw?.price ?? "");
  r.unit = String(raw?.unit ?? "");

  // options (import supports option_1..3)
  r.option_1_custom = String(raw?.option_1 ?? raw?.option_1_custom ?? "");
  r.option_2_custom = String(raw?.option_2 ?? raw?.option_2_custom ?? "");
  r.option_3_custom = String(raw?.option_3 ?? raw?.option_3_custom ?? "");

  // allergens as path
  r.alergonim_1 = toAlergonValue(raw?.alergonim_1 ?? "");
  r.alergonim_2 = toAlergonValue(raw?.alergonim_2 ?? "");
  r.alergonim_3 = toAlergonValue(raw?.alergonim_3 ?? "");

  // lock if imported has value
  r.alergonim_1_locked = !!cleanSpaces(r.alergonim_1);
  r.alergonim_2_locked = !!cleanSpaces(r.alergonim_2);
  r.alergonim_3_locked = !!cleanSpaces(r.alergonim_3);

  r.alergonim_1_mode =
    r.alergonim_1_locked && allergenPathToLabel(r.alergonim_1) === "ידני" ? "manual" : "auto";
  r.alergonim_2_mode =
    r.alergonim_2_locked && allergenPathToLabel(r.alergonim_2) === "ידני" ? "manual" : "auto";
  r.alergonim_3_mode =
    r.alergonim_3_locked && allergenPathToLabel(r.alergonim_3) === "ידני" ? "manual" : "auto";

  // smart auto-fill from note if not locked
  for (const i of [1, 2, 3]) {
    const lockKey = `alergonim_${i}_locked`;
    const valKey = `alergonim_${i}`;
    const modeKey = `alergonim_${i}_mode`;
    if (!r[lockKey]) {
      const note = finalOption(r[`option_${i}_preset`], r[`option_${i}_custom`]);
      r[valKey] = allergenFromNote(note);
      r[modeKey] = "auto";
    }
  }

  // always have a client id
  r.client_id = r.client_id || makeClientId();

  // imported file = local changes (not yet saved)
  r.dirty = true;
  r.is_new = !r.id;

  return r;
}

/* =========================
   ✅ Login (center of screen)
   ========================= */
function Login({ onSuccess }) {
  const [user, setUser] = useState("1234");
  const [pass, setPass] = useState("1234");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function doLogin() {
    setBusy(true);
    setErr("");
    try {
      const data = await fetchJson(DB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username: user, password: pass }),
      });
      onSuccess(data.token);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="loginScreen">
      <div className="loginCard">
        <h2>Admin Login</h2>

        <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="username" />

        <input
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="password"
          type="password"
        />

        <button onClick={doLogin} disabled={busy}>
          {busy ? "..." : "Login"}
        </button>

        {err && <div className="loginErr">{err}</div>}
      </div>

      <style>{`
        html, body { margin:0; padding:0; height:100%; }
        .loginScreen{
          min-height:100vh;
          width:100vw;
          display:grid;
          place-items:center;
          background:#f5f6f8;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        }
        .loginCard{
          width:320px;
          background:#fff;
          border-radius:14px;
          padding:16px;
          border:1px solid #ddd;
          box-shadow:0 12px 30px rgba(0,0,0,0.1);
          display:grid;
          gap:10px;
        }
        .loginCard h2{ margin:0 0 6px 0; text-align:center; }
        .loginCard input{
          height:38px;
          border-radius:10px;
          border:1px solid #ccc;
          padding:0 10px;
          font-size:14px;
        }
        .loginCard button{
          height:40px;
          border-radius:10px;
          border:none;
          background:#0b63ff;
          color:#fff;
          font-weight:800;
          cursor:pointer;
        }
        .loginErr{
          color:#b00020;
          font-size:12px;
          font-weight:800;
          text-align:center;
        }
        @media (prefers-color-scheme: dark){
          .loginScreen{ background:#0f1115; }
          .loginCard{ background:#151923; border-color:#2a3142; color:#fff; }
          .loginCard input{ background:#0f1115; color:#fff; border-color:#2a3142; }
        }
      `}</style>
    </div>
  );
}

/* =========================
   ✅ App wrapper
   ========================= */
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("cards_admin_token") || "");

  if (!token) {
    return (
      <Login
        onSuccess={(t) => {
          setToken(t);
          localStorage.setItem("cards_admin_token", t);
        }}
      />
    );
  }

  return (
    <AdminPanel
      token={token}
      onLogout={() => {
        setToken("");
        localStorage.removeItem("cards_admin_token");
      }}
    />
  );
}

/* =========================
   ✅ Admin panel
   ========================= */
function AdminPanel({ token, onLogout }) {
  const [rows, setRows] = useState(() => {
    const r = emptyRow();
    r.is_new = true; // draft row
    return [r];
  });

  const [busy, setBusy] = useState(false);
  const [rtl, setRtl] = useState(true);

  // When loading DB: all unchecked by default
  const [forceUncheckOnLoad, setForceUncheckOnLoad] = useState(true);
  const [translateOnlyIfEmpty, setTranslateOnlyIfEmpty] = useState(true);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  const fileRef = useRef(null);

  // Balloon state for “save to add new row”
  const [balloonForClientId, setBalloonForClientId] = useState("");
  const balloonTimerRef = useRef(null);

  // Backups
  const [backups, setBackups] = useState([]);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [restorePickId, setRestorePickId] = useState("");

  // ✅ Duplicates filter (only by line_1+line_2+line_3)
  const [dupOnly, setDupOnly] = useState(false);
  const [dupClientIds, setDupClientIds] = useState([]);

  const allChecked = useMemo(() => rows.length > 0 && rows.every((r) => !!r.is_selected), [rows]);
  const noneChecked = useMemo(() => rows.every((r) => !r.is_selected), [rows]);
  const mixedChecked = useMemo(() => !(allChecked || noneChecked), [allChecked, noneChecked]);

  // Pending new row (only 1 allowed)
  const pendingNewRow = useMemo(() => rows.find((r) => r.is_new && !r.id), [rows]);

  const dirtyCount = useMemo(
    () => rows.filter((r) => !!r.dirty && !!r.id && !r.is_new).length,
    [rows]
  );
  const newCount = useMemo(
    () => rows.filter((r) => r.is_new && !r.id && !isRowEmptyForDB(r)).length,
    [rows]
  );

  function showBalloon(clientId) {
    setBalloonForClientId(clientId);
    if (balloonTimerRef.current) clearTimeout(balloonTimerRef.current);
    balloonTimerRef.current = setTimeout(() => setBalloonForClientId(""), 2200);
  }

  useEffect(() => {
    return () => {
      if (balloonTimerRef.current) clearTimeout(balloonTimerRef.current);
    };
  }, []);

  function markDirty(row) {
    // new row always dirty
    if (row.is_new && !row.id) return true;
    // existing row -> dirty when changed
    return true;
  }

  function updateCell(index, key, value) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index], [key]: value };
      row.dirty = markDirty(row);
      next[index] = row;
      return next;
    });
  }

  /** Option change + auto allergen if not locked */
  function setOptionValue(rowIndex, optionIndex, preset, custom) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };

      row[`option_${optionIndex}_preset`] = preset;
      row[`option_${optionIndex}_custom`] = custom;

      const lockKey = `alergonim_${optionIndex}_locked`;
      const valKey = `alergonim_${optionIndex}`;
      const modeKey = `alergonim_${optionIndex}_mode`;

      if (!row[lockKey]) {
        const note = finalOption(preset, custom);
        row[valKey] = allergenFromNote(note);
        row[modeKey] = "auto";
      }

      row.dirty = markDirty(row);
      next[rowIndex] = row;
      return next;
    });
  }

  /** Set allergen by LABEL (UI) */
  function setAlergonLabel(rowIndex, allergenIndex, label) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };

      const valKey = `alergonim_${allergenIndex}`;
      const lockKey = `alergonim_${allergenIndex}_locked`;
      const modeKey = `alergonim_${allergenIndex}_mode`;

      const l = cleanSpaces(label);

      if (!l) {
        // cleared => unlock + auto from note
        row[lockKey] = false;
        row[modeKey] = "auto";
        const note = finalOption(
          row[`option_${allergenIndex}_preset`],
          row[`option_${allergenIndex}_custom`]
        );
        row[valKey] = allergenFromNote(note);
      } else if (l === "ידני") {
        row[lockKey] = true;
        row[modeKey] = "manual";
        if (!cleanSpaces(row[valKey])) row[valKey] = "";
      } else {
        row[valKey] = allergenLabelToPath(l);
        row[lockKey] = true;
        row[modeKey] = "auto";
      }

      row.dirty = markDirty(row);
      next[rowIndex] = row;
      return next;
    });
  }

  /** Manual PATH */
  function setAlergonManualPath(rowIndex, allergenIndex, path) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };

      const valKey = `alergonim_${allergenIndex}`;
      const lockKey = `alergonim_${allergenIndex}_locked`;
      const modeKey = `alergonim_${allergenIndex}_mode`;

      row[valKey] = String(path ?? "");
      row[lockKey] = true;
      row[modeKey] = "manual";

      row.dirty = markDirty(row);
      next[rowIndex] = row;
      return next;
    });
  }

  function unlockAlergon(rowIndex, allergenIndex) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };

      const valKey = `alergonim_${allergenIndex}`;
      const lockKey = `alergonim_${allergenIndex}_locked`;
      const modeKey = `alergonim_${allergenIndex}_mode`;

      row[lockKey] = false;
      row[modeKey] = "auto";

      const note = finalOption(
        row[`option_${allergenIndex}_preset`],
        row[`option_${allergenIndex}_custom`]
      );
      row[valKey] = allergenFromNote(note);

      row.dirty = markDirty(row);
      next[rowIndex] = row;
      return next;
    });
  }

  /** Build payload for DB */
  const dbPayload = useMemo(() => {
    return rows.map((r) => ({
      id: r.id ?? null,
      client_id: r.client_id,
      is_selected: r.is_selected ? 1 : 0,
      line_1: r.line_1,
      line_2: r.line_2,
      line_3: r.line_3,
      english_name: cleanSpaces(r.english_name),
      option_1: finalOption(r.option_1_preset, r.option_1_custom),
      option_2: finalOption(r.option_2_preset, r.option_2_custom),
      option_3: finalOption(r.option_3_preset, r.option_3_custom),
      price: r.price,
      unit: r.unit,
      alergonim_1: r.alergonim_1 || "",
      alergonim_2: r.alergonim_2 || "",
      alergonim_3: r.alergonim_3 || "",
    }));
  }, [rows]);

  /** Build rows for export CSV */
  const exportRows = useMemo(() => {
    return rows.map((r) => ({
      is_selected: r.is_selected ? "TRUE" : "FALSE",
      line_1: r.line_1,
      line_2: r.line_2,
      line_3: r.line_3,
      english_name: cleanSpaces(r.english_name),
      option_1: finalOption(r.option_1_preset, r.option_1_custom),
      option_2: finalOption(r.option_2_preset, r.option_2_custom),
      option_3: finalOption(r.option_3_preset, r.option_3_custom),
      price: r.price,
      unit: r.unit,
      alergonim_1: r.alergonim_1 || "",
      alergonim_2: r.alergonim_2 || "",
      alergonim_3: r.alergonim_3 || "",
    }));
  }, [rows]);

  /** Save checkbox “all” */
  function toggleCheckAll(nextValue) {
    const msg = nextValue
      ? "האם לסמן את כל השורות כ-שמור?\nזה ידרוס את המצב הקיים של כל השורות."
      : "האם לבטל שמירה לכל השורות?\nזה ידרוס את המצב הקיים של כל השורות.";
    const ok = window.confirm(msg);
    if (!ok) return;
    setRows((prev) =>
      prev.map((r) => {
        const nr = { ...r, is_selected: !!nextValue };
        nr.dirty = markDirty(nr);
        return nr;
      })
    );
  }

  /** Add NEW row (only 1 unsaved at a time), NEW row at TOP */
  function addNewRow() {
    if (pendingNewRow) {
      showBalloon(pendingNewRow.client_id);
      return;
    }
    const r = emptyRow();
    r.is_new = true;
    r.dirty = true;
    setRows((prev) => [r, ...prev.map((x) => ({ ...x, is_new: false }))]);
  }

  /** Clear fields in NEW row */
  function clearNewRow(clientId) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.client_id !== clientId) return r;
        const fresh = emptyRow();
        fresh.client_id = r.client_id;
        fresh.is_new = true;
        fresh.dirty = true;
        return fresh;
      })
    );
  }

  /** ✅ Delete row: remove locally AND (if has id) delete on server */
  async function deleteRow(index) {
    const r = rows[index];
    if (!r) return;

    const ok = window.confirm("למחוק את השורה הזו?\nהמחיקה היא קבועה.");
    if (!ok) return;

    // if row exists in server -> delete there
    if (r.id) {
      setBusy(true);
      try {
        await fetchJson(DB_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "delete_one", id: Number(r.id) }),
        });
      } catch (e) {
        alert(`שגיאת מחיקה בשרת: ${e?.message || e}`);
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }

    // remove from UI
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  /** Import Excel/CSV */
  async function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const imported = (parsed.data || []).map((r) => normalizeImportedRow(r));
      setRows(
        imported.length
          ? imported.map((x) => ({ ...x, is_new: !x.id, dirty: true }))
          : [Object.assign(emptyRow(), { is_new: true, dirty: true })]
      );
      return;
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const imported = (json || []).map((r) => normalizeImportedRow(r));
      setRows(
        imported.length
          ? imported.map((x) => ({ ...x, is_new: !x.id, dirty: true }))
          : [Object.assign(emptyRow(), { is_new: true, dirty: true })]
      );
      return;
    }

    alert("Please upload a .csv or .xlsx file");
  }

  /** Translate */
  async function translateToEnglish(text) {
    const clean = cleanSpaces(text);
    if (!clean) return "";

    const res = await fetch(TRANSLATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
    });

    if (!res.ok) throw new Error(`Translate endpoint failed: HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.ok) throw new Error(data?.error || "Translation failed");
    return cleanSpaces(data.translated);
  }

  async function autoTranslateRow(index) {
    const r = rows[index];
    const combined = combineLines(r.line_1, r.line_2, r.line_3);
    if (!combined) return;
    if (translateOnlyIfEmpty && cleanSpaces(r.english_name)) return;

    const translated = await translateToEnglish(combined);
    updateCell(index, "english_name", translated);
  }

  async function autoTranslateAll() {
    setBusy(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await autoTranslateRow(i);
      }
    } catch (err) {
      alert(`Translate error: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  /** Export */
  function downloadCSV() {
    const csv = Papa.unparse(exportRows, { columns: CSV_HEADERS });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cards.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /** Load DB (auth) */
  async function loadFromDB() {
    setBusy(true);
    try {
      const data = await fetchJson(`${DB_ENDPOINT}?action=load`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });

      const imported = (data.rows || []).map((raw) => {
        // convert server row -> UI row
        const r = emptyRow();
        r.id = raw.id ? Number(raw.id) : null;
        r.is_selected = toBool(raw.is_selected, false);

        r.line_1 = String(raw.line_1 ?? "");
        r.line_2 = String(raw.line_2 ?? "");
        r.line_3 = String(raw.line_3 ?? "");
        r.english_name = String(raw.english_name ?? "");
        r.price = String(raw.price ?? "");
        r.unit = String(raw.unit ?? "");

        // options loaded into custom (preset stays empty)
        r.option_1_custom = String(raw.option_1 ?? "");
        r.option_2_custom = String(raw.option_2 ?? "");
        r.option_3_custom = String(raw.option_3 ?? "");

        // allergens (paths)
        r.alergonim_1 = String(raw.alergonim_1 ?? "");
        r.alergonim_2 = String(raw.alergonim_2 ?? "");
        r.alergonim_3 = String(raw.alergonim_3 ?? "");

        // lock if has value
        r.alergonim_1_locked = !!cleanSpaces(r.alergonim_1);
        r.alergonim_2_locked = !!cleanSpaces(r.alergonim_2);
        r.alergonim_3_locked = !!cleanSpaces(r.alergonim_3);

        r.alergonim_1_mode =
          r.alergonim_1_locked && allergenPathToLabel(r.alergonim_1) === "ידני" ? "manual" : "auto";
        r.alergonim_2_mode =
          r.alergonim_2_locked && allergenPathToLabel(r.alergonim_2) === "ידני" ? "manual" : "auto";
        r.alergonim_3_mode =
          r.alergonim_3_locked && allergenPathToLabel(r.alergonim_3) === "ידני" ? "manual" : "auto";

        r.is_new = false;
        r.dirty = false;

        // keep client_id
        r.client_id = makeClientId();
        return r;
      });

      const finalRows = forceUncheckOnLoad
        ? imported.map((r) => ({ ...r, is_selected: false }))
        : imported;

      // keep a draft row at top (empty)
      const draft = emptyRow();
      draft.is_new = true;
      draft.dirty = false;

      setRows([draft, ...finalRows]);
      setDupOnly(false);
      setDupClientIds([]);
    } catch (e) {
      alert(`DB load error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** ✅ Save ALL changes: update changed rows + add new rows (NO DELETE EVER) */
  async function saveToDBAllChanges() {
    const toSave = [];
    const toSaveIndexes = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      // skip totally empty draft/new
      if ((r.is_new && !r.id) || !r.id) {
        if (isRowEmptyForDB(r)) continue;
      }

      // existing: only if dirty
      if (r.id && !r.is_new && !r.dirty) continue;

      // new: save if not empty
      if (!r.id && isRowEmptyForDB(r)) continue;

      toSave.push(dbPayload[i]);
      toSaveIndexes.push(i);
    }

    if (toSave.length === 0) {
      alert("אין שינויים לשמירה.");
      return;
    }

    setBusy(true);
    try {
      const data = await fetchJson(DB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "save", rows: toSave, sync_delete: false }),
      });

      // Apply new IDs (id_map is by client_id)
      setRows((prev) =>
        prev.map((row, idx) => {
          // if row already has id -> just clear dirty if it was in saved set
          const wasSaved = toSaveIndexes.includes(idx);

          if (row.id) {
            return wasSaved ? { ...row, dirty: false, is_new: false } : row;
          }

          // new row -> assign id if came back
          const newId = data?.id_map?.[row.client_id];
          if (!newId) return wasSaved ? { ...row, dirty: false } : row;

          return {
            ...row,
            id: Number(newId),
            is_new: false,
            dirty: false,
          };
        })
      );

      alert(`נשמר ✅\nSaved: ${data.saved ?? ""}`);
    } catch (e) {
      alert(`DB save error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** ✅ Update ONE existing row (עדכן) */
  async function updateSingleRow(index) {
    const rUI = rows[index];
    if (!rUI?.id) return;

    if (isRowEmptyForDB(rUI)) {
      alert("השורה ריקה (כל השדות ריקים). אם רוצים למחוק — השתמש בכפתור מחיקה.");
      return;
    }

    setBusy(true);
    try {
      const payload = dbPayload[index];

      await fetchJson(DB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "save", rows: [payload], sync_delete: false }),
      });

      setRows((prev) =>
        prev.map((row, i) => {
          if (i !== index) return row;
          return { ...row, dirty: false };
        })
      );

      alert("עודכן ✅");
    } catch (e) {
      alert(`Update error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** Save ONLY the NEW row (Add button inside row) */
  async function addThisNewRow(index) {
    const rUI = rows[index];
    if (!rUI?.is_new || rUI.id) return;

    if (isRowEmptyForDB(rUI)) {
      alert("השורה ריקה. מלא לפחות אחד מהשדות: שורה/אנגלית/מחיר/יחידה.");
      return;
    }

    setBusy(true);
    try {
      const r = dbPayload[index];

      const data = await fetchJson(DB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "save", rows: [r], sync_delete: false }),
      });

      const newId = data?.id_map?.[rUI.client_id];
      if (!newId) {
        alert("נשמר, אבל לא התקבל ID חדש. בדוק את השרת.");
        return;
      }

      setRows((prev) =>
        prev.map((row, i) => {
          if (i !== index) return row;
          return { ...row, id: Number(newId), is_new: false, dirty: false };
        })
      );
    } catch (e) {
      alert(`Add row error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** Backup */
  async function backupCreate() {
    setBusy(true);
    try {
      const data = await fetchJson(DB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "backup_create" }),
      });
      alert(`גיבוי נוצר ✅ (#${data.backup_id})`);
    } catch (e) {
      alert(`Backup error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function backupList() {
    setBusy(true);
    try {
      const data = await fetchJson(`${DB_ENDPOINT}?action=backup_list`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      setBackups(data.backups || []);
      setRestorePickId(data.backups?.[0]?.id ? String(data.backups[0].id) : "");
      setShowBackupModal(true);
    } catch (e) {
      alert(`Backup list error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function backupRestore() {
    if (!restorePickId) return;
    const ok = window.confirm("להחזיר גיבוי?\nזה ידרוס את כל הנתונים בטבלה!");
    if (!ok) return;

    setBusy(true);
    try {
      await fetchJson(DB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "backup_restore", backup_id: Number(restorePickId) }),
      });
      setShowBackupModal(false);
      await loadFromDB();
      alert("שוחזר ✅");
    } catch (e) {
      alert(`Restore error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** ✅ Delete ALL DB (danger) with confirm + password */
  async function deleteAllDB() {
    const ok = window.confirm(
      "⚠️ מחיקת מסד נתונים!\n\n" +
        "פעולה זו תמחק את כל הכרטיסים בשרת לצמיתות.\n" +
        "אין אפשרות שחזור (אלא אם יש גיבוי).\n\n" +
        "האם אתה בטוח שברצונך להמשיך?"
    );
    if (!ok) return;

    const pass = window.prompt("הכנס סיסמת מנהל למחיקה מלאה:");
    if (!pass) return;

    setBusy(true);
    try {
      const data = await fetchJson(DB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "delete_all", admin_password: pass }),
      });

      // reset UI with a fresh draft row
      const draft = emptyRow();
      draft.is_new = true;

      setRows([draft]);
      setDupOnly(false);
      setDupClientIds([]);

      alert(`נמחק ✅\nDeleted: ${data.deleted ?? ""}`);
    } catch (e) {
      alert(`שגיאת מחיקה: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** ✅ Duplicates (only line_1+line_2+line_3) */
  function dupKeyFromRow(r) {
    const l1 = normalizeForSearch(r.line_1);
    const l2 = normalizeForSearch(r.line_2);
    const l3 = normalizeForSearch(r.line_3);
    if (!l1 && !l2 && !l3) return "";
    return `${l1}||${l2}||${l3}`;
  }

  function checkDuplicates() {
    const map = new Map(); // key -> array of indexes
    for (let i = 0; i < rows.length; i++) {
      const key = dupKeyFromRow(rows[i]);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(i);
    }

    const ids = [];
    for (const idxs of map.values()) {
      if (idxs.length >= 2) {
        for (const i of idxs) {
          const cid = rows[i]?.client_id;
          if (cid) ids.push(cid);
        }
      }
    }

    const uniqueIds = Array.from(new Set(ids));

    if (uniqueIds.length === 0) {
      alert("לא נמצאו כפילויות");
      setDupOnly(false);
      setDupClientIds([]);
      return;
    }

    setDupOnly(true);
    setDupClientIds(uniqueIds);
  }

  /** Sorting & view */
  const viewRows = useMemo(() => {
    const q = normalizeForSearch(search);
    let list = rows.map((row, index) => ({ row, index }));

    // ✅ show only duplicates (optional)
    if (dupOnly && dupClientIds.length) {
      const set = new Set(dupClientIds);
      list = list.filter(({ row }) => set.has(row.client_id));
    }

    if (q) {
      list = list.filter(({ row }) => {
        const hay = [
          row.is_selected ? "true" : "false",
          row.line_1,
          row.line_2,
          row.line_3,
          row.english_name,
          finalOption(row.option_1_preset, row.option_1_custom),
          finalOption(row.option_2_preset, row.option_2_custom),
          finalOption(row.option_3_preset, row.option_3_custom),
          row.price,
          row.unit,
          row.alergonim_1,
          row.alergonim_2,
          row.alergonim_3,
        ]
          .map((v) => normalizeForSearch(v))
          .join(" | ");
        return hay.includes(q);
      });
    }

    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const ra = a.row;
        const rb = b.row;

        if (sortKey === "option_1") {
          return compareValues(
            finalOption(ra.option_1_preset, ra.option_1_custom),
            finalOption(rb.option_1_preset, rb.option_1_custom),
            dir
          );
        }
        if (sortKey === "option_2") {
          return compareValues(
            finalOption(ra.option_2_preset, ra.option_2_custom),
            finalOption(rb.option_2_preset, rb.option_2_custom),
            dir
          );
        }
        if (sortKey === "option_3") {
          return compareValues(
            finalOption(ra.option_3_preset, ra.option_3_custom),
            finalOption(rb.option_3_preset, rb.option_3_custom),
            dir
          );
        }

        return compareValues(ra?.[sortKey], rb?.[sortKey], dir);
      });
    }

    // Keep NEW row at top always
    list = list.sort((a, b) => (b.row.is_new ? 1 : 0) - (a.row.is_new ? 1 : 0));
    return list;
  }, [rows, search, sortKey, sortDir, dupOnly, dupClientIds]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortMark(col) {
    if (sortKey !== col) return " ⇅";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="dilenCardsApp" dir={rtl ? "rtl" : "ltr"}>
      <style>{`
        :root{ --bd:#d9d9d9; --bg:#ffffff; --warn:#b00020; --ok:#0b63ff; }
        .dilenCardsApp{
          padding:12px; background:var(--bg); color:#111;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; overflow-x:auto;
        }
        .dilenCardsApp *{ box-sizing:border-box; }
        .dilenTop{ display:grid; gap:10px; }

        .dilenBar{
          display:flex; flex-wrap:wrap; align-items:center; gap:10px;
          padding:10px; border:1px solid var(--bd); border-radius:10px; background:#fff;
        }
        .dilenTitle{ margin:0; font-size:20px; font-weight:900; letter-spacing:0.2px; }

        .dilenBtn{
          padding:6px 10px; border-radius:8px; border:1px solid var(--bd);
          background:#fff; cursor:pointer; font-size:13px; font-weight:800; white-space:nowrap;
        }
        .dilenBtnPrimary{
          padding:6px 10px; border-radius:8px; border:1px solid #0b63ff; background:#0b63ff;
          cursor:pointer; color:#fff !important; font-size:13px; font-weight:900; white-space:nowrap;
        }
        .dilenBtnDanger{
          padding:6px 10px; border-radius:8px; border:1px solid #b00020; background:#fff;
          cursor:pointer; color:#b00020; font-size:13px; font-weight:900; white-space:nowrap;
        }
        .dilenBtnTiny{
          padding:2px 6px; border-radius:8px; border:1px solid var(--bd);
          background:#fff; cursor:pointer; font-size:11px; font-weight:900; white-space:nowrap;
          position:relative;
        }
        .dilenBtn:disabled,.dilenBtnPrimary:disabled,.dilenBtnTiny:disabled,.dilenBtnDanger:disabled{
          opacity:0.6; cursor:not-allowed;
        }

        .dilenInp,.dilenSel{
          height:26px; padding:3px 6px; font-size:12px;
          border:1px solid var(--bd); border-radius:6px; width:100%; background:#fff; outline:none;
        }
        .dilenSel{ height:28px; }

        .dilenToggles{
          display:flex; flex-wrap:wrap; gap:14px; align-items:center;
          padding:10px; border:1px solid var(--bd); border-radius:10px; background:#fafafa;
        }
        .dilenToggle{
          display:flex; gap:8px; align-items:center; font-size:12px; white-space:nowrap; font-weight:900;
          padding:6px 10px; border-radius:999px; border:1px solid #e5e5e5; background:#fff;
        }

        .dilenTableWrap{ margin-top:10px; border:1px solid var(--bd); border-radius:10px; overflow:auto; background:#fff; }
        .dilenScroll{ overflow-x:auto; max-height:72vh; -webkit-overflow-scrolling: touch; }

        table.dilenTable{
          width:100%; border-collapse:collapse; table-layout:fixed;
          min-width:1100px; background:#fff;
        }

        .dilenTable thead th{
          position:sticky; top:0; z-index:5;
          background:#f6f7f9; border-bottom:1px solid #ddd;
          padding:6px 6px; font-size:12px; font-weight:900; text-align:start; white-space:nowrap;
        }

        .dilenTable tbody td{
          padding:5px 6px; border-bottom:1px solid #eee; vertical-align:top; font-size:12px;
        }

        .dilenTable tbody tr:nth-child(even){ background:#fafafa; }
        .dilenSortTh{ cursor:pointer; user-select:none; }
        .dilenCenter{ text-align:center; }

        .dilenCode{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size:11px; background:#f2f2f2; padding:1px 4px; border-radius:4px;
          display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }

        .dilenEnglishRow{ display:flex; gap:4px; align-items:center; }
        .dilenEnglishRow button{ padding:4px 6px; font-size:11px; }

        .dilenSmall{ font-size:11px; opacity:0.75; margin-top:4px; line-height:1.2; }
        .warnText{ color:var(--warn); font-weight:900; }

        /* column sizes */
        .col-num{ width:45px; }
        .col-save{ width:55px; }
        .col-line{ width:140px; }
        .col-english{ width:220px; }
        .col-note{ width:170px; }
        .col-price{ width:70px; }
        .col-unit{ width:90px; }
        .col-aler{ width:65px; }
        .col-actions{ width:190px; }

        .optionCell{ display:grid; gap:4px; }

        .dilenAlerWrap{ display:flex; flex-direction:column; gap:4px; }
        .dilenAlerTop{ display:flex; gap:4px; align-items:center; }
        .dilenAlerSel{ height:22px; font-size:11px; padding:1px 4px; }
        .dilenAlerManual{ height:22px; font-size:10px; padding:1px 4px; }
        .dilenLock{ font-size:11px; opacity:0.65; line-height:1; }

        .balloon{
          position:absolute;
          bottom:110%;
          left:50%;
          transform:translateX(-50%);
          background:#111;
          color:#fff;
          font-size:11px;
          font-weight:900;
          padding:6px 8px;
          border-radius:10px;
          white-space:nowrap;
          z-index:999;
          box-shadow: 0 8px 20px rgba(0,0,0,0.18);
        }
        .balloon:after{
          content:"";
          position:absolute;
          top:100%;
          left:50%;
          transform:translateX(-50%);
          border:7px solid transparent;
          border-top-color:#111;
        }

        .dirtyDot{
          display:inline-block;
          width:8px; height:8px;
          border-radius:999px;
          background:#ffb300;
          margin-inline-start:6px;
          vertical-align:middle;
        }

        /* force light form controls even if device is dark */
        .dilenCardsApp, .dilenCardsApp * { color-scheme: light !important; }
        .dilenCardsApp input, .dilenCardsApp select, .dilenCardsApp button, .dilenCardsApp textarea {
          background:#fff !important; color:#111 !important;
        }
        .dilenCardsApp ::placeholder { color: rgba(0,0,0,0.45) !important; }
      `}</style>

      <div className="dilenTop">
        <div className="dilenBar">
          <h1 className="dilenTitle">פאשה - ניהול כרטיסיות</h1>

          <button className="dilenBtn" onClick={loadFromDB} disabled={busy}>
            העלה מסד נתונים
          </button>

          <button className="dilenBtn" onClick={addNewRow} disabled={busy}>
            + כרטיס חדש
          </button>

          <button className="dilenBtn" onClick={saveToDBAllChanges} disabled={busy}>
            שמור מסד נתונים בשרת (עדכון/הוספה)
            {dirtyCount + newCount > 0 ? <span className="dirtyDot" /> : null}
          </button>

          <button className="dilenBtn" onClick={downloadCSV} disabled={busy}>
            יצוא לקובץ CSV - לדילן
          </button>

          <button className="dilenBtn" onClick={() => fileRef.current?.click()} disabled={busy}>
            יבוא נתונים מקובץ Excel/CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <button className="dilenBtnPrimary" onClick={autoTranslateAll} disabled={busy}>
            {busy ? "Working..." : "תרגום לאנגלית - אוטומטי להכל"}
          </button>

          <button className="dilenBtn" onClick={checkDuplicates} disabled={busy}>
            בדוק כפילויות
          </button>

          {dupOnly ? (
            <button
              className="dilenBtn"
              onClick={() => {
                setDupOnly(false);
                setDupClientIds([]);
              }}
              disabled={busy}
              title="חזרה לתצוגה מלאה"
            >
              בטל כפילויות
            </button>
          ) : null}

          <button className="dilenBtn" onClick={backupCreate} disabled={busy}>
            גבה עכשיו
          </button>

          <button className="dilenBtn" onClick={backupList} disabled={busy}>
            שחזר...
          </button>

          <button
            className="dilenBtnDanger"
            onClick={deleteAllDB}
            disabled={busy}
            title="מחיקה מלאה"
          >
            ⚠️ מחק מסד נתונים
          </button>

          <button className="dilenBtn" onClick={onLogout} disabled={busy}>
            Logout
          </button>
        </div>

        <div className="dilenToggles">
          <label
            className="dilenToggle"
            title={
              allChecked
                ? "כל השורות מסומנות לשמירה"
                : mixedChecked
                ? "חלק מסומנות"
                : "אף שורה לא מסומנת"
            }
          >
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => {
                if (el) el.indeterminate = mixedChecked;
              }}
              onChange={(e) => toggleCheckAll(e.target.checked)}
            />
            {allChecked ? " בטל את בחירת כל הכרטיסים ✗" : "בחר את על הכרטיסים לשמירה ✓"}
          </label>

          <label className="dilenToggle">
            <input
              type="checkbox"
              checked={translateOnlyIfEmpty}
              onChange={(e) => setTranslateOnlyIfEmpty(e.target.checked)}
            />
            תרגם לאנגלית רק אם אין תרגום קיים
          </label>

          <label className="dilenToggle" title="When loading from DB: uncheck all rows">
            <input
              type="checkbox"
              checked={forceUncheckOnLoad}
              onChange={(e) => setForceUncheckOnLoad(e.target.checked)}
            />
            לא לסמן בחירה בזמן העלאת הכרטיסים
          </label>

          <label className="dilenToggle" title="RTL/LTR">
            <input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} />
            סדר עמודות מימין לשמאל
          </label>

          {/* ✅ Search moved next to "שינויים לא שמורים" and made bigger */}
          <div className="dilenToggle" style={{ borderStyle: "dashed", gap: 10 }}>
            <span style={{ fontWeight: 900 }}>שינויים לא שמורים:</span>
            <span className="dilenCode">{dirtyCount + newCount}</span>

            {/* Search placed LEFT of the changes counter (in RTL it appears on the left) */}
            <input
              className="dilenInp"
              style={{ width: 320, height: 34, fontSize: 14, borderRadius: 10 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש..."
              disabled={busy}
            />
          </div>
        </div>
      </div>

      <div className="dilenTableWrap">
        <div className="dilenScroll">
          <table className="dilenTable">
            <thead>
              <tr>
                <Th className="col-num">#</Th>
                <SortTh
                  className="col-save"
                  label="שמור?"
                  col="is_selected"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-line"
                  label="שורה_1"
                  col="line_1"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-line"
                  label="שורה_2"
                  col="line_2"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-line"
                  label="שורה_3"
                  col="line_3"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-english"
                  label="אנגלית"
                  col="english_name"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-note"
                  label="הערה_1"
                  col="option_1"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-note"
                  label="הערה_2"
                  col="option_2"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-note"
                  label="הערה_3"
                  col="option_3"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-price"
                  label="מחיר"
                  col="price"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-unit"
                  label="יחידה"
                  col="unit"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-aler"
                  label="אלרגון 1"
                  col="alergonim_1"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-aler"
                  label="אלרגון 2"
                  col="alergonim_2"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <SortTh
                  className="col-aler"
                  label="אלרגון 3"
                  col="alergonim_3"
                  onSort={toggleSort}
                  mark={sortMark}
                />
                <Th className="col-actions">פעולות</Th>
              </tr>
            </thead>

            <tbody>
              {viewRows.map(({ row: r, index: realIndex }, idxVisible) => {
                const cm1 = estimateTextCm(r.line_1);
                const cm2 = estimateTextCm(r.line_2);
                const cm3 = estimateTextCm(r.line_3);

                const over1 = cm1 > MAX_CM;
                const over2 = cm2 > MAX_CM;
                const over3 = cm3 > MAX_CM;

                return (
                  <tr key={r.client_id || realIndex}>
                    <td className="dilenCenter">{idxVisible + 1}</td>

                    <td className="dilenCenter">
                      <input
                        type="checkbox"
                        checked={!!r.is_selected}
                        onChange={(e) => updateCell(realIndex, "is_selected", e.target.checked)}
                        disabled={busy}
                      />
                      {r.dirty ? <span className="dirtyDot" title="לא נשמר"></span> : null}
                    </td>

                    <td>
                      <input
                        className="dilenInp"
                        value={r.line_1}
                        onChange={(e) => updateCell(realIndex, "line_1", e.target.value)}
                        disabled={busy}
                      />
                      <div className={`dilenSmall ${over1 ? "warnText" : ""}`}>
                        {formatCm(cm1)}cm / {MAX_CM}cm {over1 ? "⚠️" : ""}
                      </div>
                    </td>

                    <td>
                      <input
                        className="dilenInp"
                        value={r.line_2}
                        onChange={(e) => updateCell(realIndex, "line_2", e.target.value)}
                        disabled={busy}
                      />
                      <div className={`dilenSmall ${over2 ? "warnText" : ""}`}>
                        {formatCm(cm2)}cm / {MAX_CM}cm {over2 ? "⚠️" : ""}
                      </div>
                    </td>

                    <td>
                      <input
                        className="dilenInp"
                        value={r.line_3}
                        onChange={(e) => updateCell(realIndex, "line_3", e.target.value)}
                        disabled={busy}
                      />
                      <div className={`dilenSmall ${over3 ? "warnText" : ""}`}>
                        {formatCm(cm3)}cm / {MAX_CM}cm {over3 ? "⚠️" : ""}
                      </div>
                    </td>

                    <td>
                      <div className="dilenEnglishRow">
                        <input
                          className="dilenInp"
                          value={r.english_name}
                          onChange={(e) => updateCell(realIndex, "english_name", e.target.value)}
                          disabled={busy}
                        />
                        <button
                          className="dilenBtn"
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await autoTranslateRow(realIndex);
                            } catch (err) {
                              alert(`Translate error: ${err?.message || err}`);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          disabled={busy}
                          title="Combine 3 lines → translate to English"
                        >
                          A↔
                        </button>
                      </div>
                      <div className="dilenSmall">
                        Combined:{" "}
                        <span className="dilenCode">
                          {combineLines(r.line_1, r.line_2, r.line_3) || "(empty)"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <OptionCell
                        preset={r.option_1_preset}
                        custom={r.option_1_custom}
                        onChange={(preset, custom) => setOptionValue(realIndex, 1, preset, custom)}
                        disabled={busy}
                      />
                    </td>

                    <td>
                      <OptionCell
                        preset={r.option_2_preset}
                        custom={r.option_2_custom}
                        onChange={(preset, custom) => setOptionValue(realIndex, 2, preset, custom)}
                        disabled={busy}
                      />
                    </td>

                    <td>
                      <OptionCell
                        preset={r.option_3_preset}
                        custom={r.option_3_custom}
                        onChange={(preset, custom) => setOptionValue(realIndex, 3, preset, custom)}
                        disabled={busy}
                      />
                    </td>

                    <td>
                      <input
                        className="dilenInp"
                        value={r.price}
                        onChange={(e) => updateCell(realIndex, "price", e.target.value)}
                        disabled={busy}
                      />
                    </td>

                    <td>
                      <select
                        className="dilenSel"
                        value={r.unit}
                        onChange={(e) => updateCell(realIndex, "unit", e.target.value)}
                        disabled={busy}
                      >
                        <option value="">(empty)</option>
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <AlergonCellLabelUI
                        label={allergenPathToLabel(r.alergonim_1)}
                        path={r.alergonim_1}
                        locked={r.alergonim_1_locked}
                        onLabelChange={(lab) => setAlergonLabel(realIndex, 1, lab)}
                        onManualPathChange={(p) => setAlergonManualPath(realIndex, 1, p)}
                        onUnlock={() => unlockAlergon(realIndex, 1)}
                        disabled={busy}
                      />
                    </td>

                    <td>
                      <AlergonCellLabelUI
                        label={allergenPathToLabel(r.alergonim_2)}
                        path={r.alergonim_2}
                        locked={r.alergonim_2_locked}
                        onLabelChange={(lab) => setAlergonLabel(realIndex, 2, lab)}
                        onManualPathChange={(p) => setAlergonManualPath(realIndex, 2, p)}
                        onUnlock={() => unlockAlergon(realIndex, 2)}
                        disabled={busy}
                      />
                    </td>

                    <td>
                      <AlergonCellLabelUI
                        label={allergenPathToLabel(r.alergonim_3)}
                        path={r.alergonim_3}
                        locked={r.alergonim_3_locked}
                        onLabelChange={(lab) => setAlergonLabel(realIndex, 3, lab)}
                        onManualPathChange={(p) => setAlergonManualPath(realIndex, 3, p)}
                        onUnlock={() => unlockAlergon(realIndex, 3)}
                        disabled={busy}
                      />
                    </td>

                    <td>
                      <div
                        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                      >
                        {/* NEW row (no ID shown, but Add button exists) */}
                        {r.is_new && !r.id ? (
                          <>
                            <button
                              className="dilenBtnTiny"
                              onClick={() => addThisNewRow(realIndex)}
                              disabled={busy}
                              title="הוסף שורה חדשה לשרת"
                              style={{ position: "relative" }}
                            >
                              {balloonForClientId === r.client_id ? (
                                <div className="balloon">שמור כדי להוסיף שורה חדשה</div>
                              ) : null}
                              Add
                            </button>
                            <button
                              className="dilenBtnTiny"
                              onClick={() => clearNewRow(r.client_id)}
                              disabled={busy}
                            >
                              Clear
                            </button>
                          </>
                        ) : null}

                        {/* Existing row: עדכן */}
                        {!r.is_new && r.id ? (
                          <button
                            className="dilenBtnTiny"
                            onClick={() => updateSingleRow(realIndex)}
                            disabled={busy || !r.dirty}
                            title={r.dirty ? "עדכן שורה זו בשרת" : "אין שינויים"}
                          >
                            עדכן
                          </button>
                        ) : null}

                        <button
                          className="dilenBtnTiny"
                          onClick={() => deleteRow(realIndex)}
                          disabled={busy}
                        >
                          מחק
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {viewRows.length === 0 && (
                <tr>
                  <td colSpan={16} style={{ padding: 12, opacity: 0.85 }}>
                    No results for: <span className="dilenCode">{search}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore modal */}
      {showBackupModal && (
        <div
          onClick={() => setShowBackupModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(700px, 95vw)",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #ddd",
              padding: 12,
              fontFamily: "system-ui",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 10 }}>Restore Backup</h3>

            <div
              style={{
                maxHeight: "55vh",
                overflow: "auto",
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 8,
              }}
            >
              {backups.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No backups</div>
              ) : (
                backups.map((b) => (
                  <label
                    key={b.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #eee",
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="backup"
                      value={String(b.id)}
                      checked={String(restorePickId) === String(b.id)}
                      onChange={(e) => setRestorePickId(e.target.value)}
                    />
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={{ fontWeight: 900 }}>
                        #{b.id} — {b.created_at}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Rows: {b.row_count ?? b.rows_count}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
              <button
                className="dilenBtn"
                onClick={() => setShowBackupModal(false)}
                disabled={busy}
              >
                Close
              </button>
              <button
                className="dilenBtnPrimary"
                onClick={backupRestore}
                disabled={busy || !restorePickId}
              >
                Restore selected
              </button>
            </div>
          </div>
        </div>
      )}

      <p style={{ marginTop: 10, opacity: 0.85 }}>
        API: <span className="dilenCode">{DB_ENDPOINT}</span>
      </p>
    </div>
  );
}

function Th({ children, className }) {
  return <th className={className}>{children}</th>;
}

function SortTh({ label, col, onSort, mark, className }) {
  return (
    <th
      className={`dilenSortTh ${className || ""}`}
      onClick={() => onSort(col)}
      title="Click to sort"
    >
      {label}
      {mark(col)}
    </th>
  );
}

function OptionCell({ preset, custom, onChange, disabled }) {
  return (
    <div className="optionCell">
      <select
        className="dilenSel"
        value={preset}
        onChange={(e) => onChange(e.target.value, custom)}
        disabled={disabled}
      >
        {OPTION_PRESETS.map((p) => (
          <option key={p} value={p}>
            {p === "" ? "(empty)" : p}
          </option>
        ))}
      </select>

      <input
        className="dilenInp"
        placeholder="custom (overrides preset)"
        value={custom}
        onChange={(e) => onChange(preset, e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * ✅ UI shows: label (גלוטן/טבעוני/צמחוני/ידני)
 * ✅ DB/CSV keeps: full PATH
 */
function AlergonCellLabelUI({
  label,
  path,
  locked,
  onLabelChange,
  onManualPathChange,
  onUnlock,
  disabled,
}) {
  return (
    <div className="dilenAlerWrap" title={path ? path : ""}>
      <div className="dilenAlerTop">
        <select
          className="dilenSel dilenAlerSel"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">—</option>
          {ALERGEN_LIST.map((a) => (
            <option key={a.key} value={a.label}>
              {a.label}
            </option>
          ))}
          <option value="ידני">ידני</option>
        </select>

        {locked ? (
          <button
            className="dilenBtnTiny"
            onClick={onUnlock}
            disabled={disabled}
            title="Unlock (return to auto)"
          >
            🔒
          </button>
        ) : (
          <span className="dilenLock" title="Auto mode">
            ✨
          </span>
        )}
      </div>

      {label === "ידני" && (
        <input
          className="dilenInp dilenAlerManual"
          value={path}
          placeholder="Manual path..."
          onChange={(e) => onManualPathChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
