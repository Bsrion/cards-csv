// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

/**
 * ✅ API base (your build base is /api/projects/)
 * Put your app in: /api/projects/lachmajun_cards/
 * cards.php remains: /api/projects/cards.php
 */

// ✅ Auto-detect base path (works on /lachmajun_cards/)
// ✅ Base (prod + local)
const IS_DEV = import.meta.env.DEV;

// In DEV we call "/api/projects/" (and Vite proxy will forward it)
// In PROD we call the site base + "projects/"
const API_BASE = IS_DEV ? "/api/" : `${import.meta.env.BASE_URL || "/"}projects/`;

const TRANSLATE_ENDPOINT = `${API_BASE}translate.php`;
const DB_ENDPOINT = `${API_BASE}cards.php`;

const ADMIN_TOKEN = "lachmajun_admin_token_1234"; // אותו ערך כמו ב-PHP

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
<<<<<<< HEAD
   ✅ ALLERGENS (UI shows LABEL, CSV/DB keeps PATH)
=======
   ✅ ALLERGENS (UI shows LABEL, DB/CSV keeps PATH)
>>>>>>> 67d0a88 (Update project)
   ========================= */
const ALERGENS = {
  GLUTEN: {
    key: "GLUTEN",
    label: "גלוטן",
<<<<<<< HEAD
    path:
      "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-01.png",
=======
    path: "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-01.png",
>>>>>>> 67d0a88 (Update project)
  },
  VEGAN: {
    key: "VEGAN",
    label: "טבעוני",
<<<<<<< HEAD
    path:
      "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-02.png",
=======
    path: "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-02.png",
>>>>>>> 67d0a88 (Update project)
  },
  VEGETARIAN: {
    key: "VEGETARIAN",
    label: "צמחוני",
<<<<<<< HEAD
    path:
      "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-03.png",
  },
};

=======
    path: "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-03.png",
  },
};
>>>>>>> 67d0a88 (Update project)
const ALERGEN_LIST = Object.values(ALERGENS);

function makeClientId() {
  return crypto?.randomUUID?.() || `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cleanSpaces(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
<<<<<<< HEAD
}

/** PATH -> LABEL (for UI only) */
function allergenPathToLabel(path) {
  const p = cleanSpaces(path);
  if (!p) return "";
  const found = ALERGEN_LIST.find((a) => a.path === p);
  return found ? found.label : "ידני";
}

/** LABEL -> PATH (for UI selection) */
function allergenLabelToPath(label) {
  const l = cleanSpaces(label);
  if (!l) return "";
  const found = ALERGEN_LIST.find((a) => a.label === l);
  return found ? found.path : "";
}

/**
 * ✅ Skip saving if ALL are empty:
 * line_1, line_2, line_3, english_name, price, unit
 */
function isRowEmptyForDB(r) {
  const l1 = cleanSpaces(r.line_1);
  const l2 = cleanSpaces(r.line_2);
  const l3 = cleanSpaces(r.line_3);
  const en = cleanSpaces(r.english_name);
  const price = cleanSpaces(r.price);
  const unit = cleanSpaces(r.unit);
  return !l1 && !l2 && !l3 && !en && !price && !unit;
=======
>>>>>>> 67d0a88 (Update project)
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
  const s = String(v ?? "").trim().toLowerCase();
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
<<<<<<< HEAD
}

function emptyRow(selectedDefault = true) {
  return {
    id: null,
    client_id: makeClientId(),
    is_selected: selectedDefault,

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

    // ✅ PATH STRINGS
    alergonim_1: "",
    alergonim_2: "",
    alergonim_3: "",

    // ✅ locks
    alergonim_1_locked: false,
    alergonim_2_locked: false,
    alergonim_3_locked: false,

    // ✅ for UI: manual editor
    alergonim_1_mode: "auto", // auto | manual
    alergonim_2_mode: "auto",
    alergonim_3_mode: "auto",
  };
}

function normalizeImportedRow(raw, selectedDefault = true) {
  const r = emptyRow(selectedDefault);

  if (raw?.id !== undefined && raw?.id !== null && String(raw.id).trim() !== "") {
    const n = Number(raw.id);
    r.id = Number.isFinite(n) ? n : null;
  }

  // typo support
  if (raw?.english_anme && !raw?.english_name) raw.english_name = raw.english_anme;

  for (const k of Object.keys(r)) {
    if (raw?.[k] !== undefined && raw?.[k] !== null) r[k] = raw[k];
  }

  if (raw?.option_1 !== undefined) r.option_1_custom = String(raw.option_1 ?? "");
  if (raw?.option_2 !== undefined) r.option_2_custom = String(raw.option_2 ?? "");
  if (raw?.option_3 !== undefined) r.option_3_custom = String(raw.option_3 ?? "");

  r.is_selected = toBool(raw?.is_selected, selectedDefault);

  r.alergonim_1 = toAlergonValue(raw?.alergonim_1 ?? r.alergonim_1);
  r.alergonim_2 = toAlergonValue(raw?.alergonim_2 ?? r.alergonim_2);
  r.alergonim_3 = toAlergonValue(raw?.alergonim_3 ?? r.alergonim_3);

  // if imported has a value -> consider it manual
  r.alergonim_1_locked = !!cleanSpaces(r.alergonim_1);
  r.alergonim_2_locked = !!cleanSpaces(r.alergonim_2);
  r.alergonim_3_locked = !!cleanSpaces(r.alergonim_3);

  r.alergonim_1_mode = r.alergonim_1_locked && allergenPathToLabel(r.alergonim_1) === "ידני" ? "manual" : "auto";
  r.alergonim_2_mode = r.alergonim_2_locked && allergenPathToLabel(r.alergonim_2) === "ידני" ? "manual" : "auto";
  r.alergonim_3_mode = r.alergonim_3_locked && allergenPathToLabel(r.alergonim_3) === "ידני" ? "manual" : "auto";

  r.line_1 = String(r.line_1 ?? "");
  r.line_2 = String(r.line_2 ?? "");
  r.line_3 = String(r.line_3 ?? "");
  r.english_name = String(r.english_name ?? "");
  r.price = String(r.price ?? "");
  r.unit = String(r.unit ?? "");

  r.client_id = r.client_id || makeClientId();

  // smart auto-fill allergens from notes (only if not locked)
  for (const i of [1, 2, 3]) {
    const lockKey = `alergonim_${i}_locked`;
    const valKey = `alergonim_${i}`;
    const modeKey = `alergonim_${i}_mode`;
    if (!r[lockKey]) {
      const note = finalOption(r[`option_${i}_preset`], r[`option_${i}_custom`]);
      const icon = allergenFromNote(note);
      r[valKey] = icon;
      r[modeKey] = "auto";
    }
  }

  return r;
=======
>>>>>>> 67d0a88 (Update project)
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

<<<<<<< HEAD
function isNumericLike(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return /^-?\d+(\.\d+)?$/.test(s);
}

function compareValues(a, b, dir) {
  if (isNumericLike(a) && isNumericLike(b)) {
    return (Number(a) - Number(b)) * dir;
  }
  const as = normalizeForSearch(a);
  const bs = normalizeForSearch(b);
  return as.localeCompare(bs) * dir;
}

=======
>>>>>>> 67d0a88 (Update project)
/** ✅ Always parse response as text first */
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
   ✅ Approx width warning for 9.5cm
   Font: FbRiflex 35pt Black
   We approximate character widths with factors.
   Narrow letters: י ן ו (and also space)
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
    else if (NARROW.has(ch)) sum += 0.35;
    else if (/[0-9]/.test(ch)) sum += 0.52;
    else if (/[A-Za-z]/.test(ch)) sum += 0.55;
    else if (VERY_WIDE.has(ch)) sum += 0.62;
    else sum += 0.55;
  }

  // Convert “units” to cm using EM size
  // normal letter roughly ~0.55em => 0.55 * EM_CM
  const cm = sum * EM_CM;
  return cm;
}

function formatCm(n) {
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(1);
}

/* =========================
   ✅ Row model
   - is_new: true only for the one pending row (must be added to DB to get id)
   ========================= */
function emptyRow() {
  return {
    id: null,
    client_id: makeClientId(),
    is_selected: false, // ✅ default unchecked

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

    is_new: false,
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

  return r;
}

function normalizeForSearch(s) {
  return cleanSpaces(String(s ?? "")).toLowerCase();
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

/* =========================
   ✅ Login (separate component => no hooks order bug)
   ========================= */
function Login({ onSuccess }) {
  const [user, setUser] = React.useState("1234");
  const [pass, setPass] = React.useState("1234");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

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
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
        }

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

        .loginCard h2{
          margin:0 0 6px 0;
          text-align:center;
        }

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
          font-weight:700;
          cursor:pointer;
        }

        .loginErr{
          color:#b00020;
          font-size:12px;
          font-weight:700;
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
   ✅ Main App wrapper
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
    r.is_new = true; // first row is “new draft”
    return [r];
  });

  const [busy, setBusy] = useState(false);
  const [rtl, setRtl] = useState(true);

<<<<<<< HEAD
  const [projectId, setProjectId] = useState(null);
=======
  // ✅ When loading DB: all unchecked by default
  const [forceUncheckOnLoad, setForceUncheckOnLoad] = useState(true);

  const [translateOnlyIfEmpty, setTranslateOnlyIfEmpty] = useState(true);
>>>>>>> 67d0a88 (Update project)

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  const fileRef = useRef(null);

<<<<<<< HEAD
  /** ✅ Update option + auto allergen (smart + lock-safe) */
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

      next[rowIndex] = row;
      return next;
    });
  }

  /** ✅ Set allergen by LABEL (UI) */
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
        const note = finalOption(row[`option_${allergenIndex}_preset`], row[`option_${allergenIndex}_custom`]);
        row[valKey] = allergenFromNote(note);
      } else if (l === "ידני") {
        // manual mode (keep existing value, lock it)
        row[lockKey] = true;
        row[modeKey] = "manual";
        if (!cleanSpaces(row[valKey])) row[valKey] = "";
      } else {
        // preset label => set path and lock
        row[valKey] = allergenLabelToPath(l);
        row[lockKey] = true;
        row[modeKey] = "auto";
      }

      next[rowIndex] = row;
      return next;
    });
  }

  /** ✅ Set manual PATH (locks) */
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

      const note = finalOption(row[`option_${allergenIndex}_preset`], row[`option_${allergenIndex}_custom`]);
      row[valKey] = allergenFromNote(note);

      next[rowIndex] = row;
      return next;
    });
  }

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

      // ✅ EXPORT FULL PATH (InDesign needs this)
      alergonim_1: r.alergonim_1 || "",
      alergonim_2: r.alergonim_2 || "",
      alergonim_3: r.alergonim_3 || "",
    }));
  }, [rows]);
=======
  // Balloon state for “save to add new row”
  const [balloonForClientId, setBalloonForClientId] = useState("");
  const balloonTimerRef = useRef(null);
>>>>>>> 67d0a88 (Update project)

  // Backups
  const [backups, setBackups] = useState([]);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [restorePickId, setRestorePickId] = useState("");

  // Global “check all save” checkbox state
  const allChecked = useMemo(() => rows.length > 0 && rows.every((r) => !!r.is_selected), [rows]);
  const noneChecked = useMemo(() => rows.every((r) => !r.is_selected), [rows]);
  const mixedChecked = useMemo(() => !(allChecked || noneChecked), [allChecked, noneChecked]);

  // Pending new row (only 1 allowed)
  const pendingNewRow = useMemo(() => rows.find((r) => r.is_new && !r.id), [rows]);

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

  function updateCell(index, key, value) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  /** ✅ Option change + auto allergen if not locked */
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

      next[rowIndex] = row;
      return next;
    });
  }

  /** ✅ Set allergen by LABEL (UI) */
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

      next[rowIndex] = row;
      return next;
    });
  }

  /** ✅ Manual PATH */
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

      next[rowIndex] = row;
      return next;
    });
  }

  /** ✅ Build payload for DB */
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
<<<<<<< HEAD

      // ✅ SAVE FULL PATH
=======
>>>>>>> 67d0a88 (Update project)
      alergonim_1: r.alergonim_1 || "",
      alergonim_2: r.alergonim_2 || "",
      alergonim_3: r.alergonim_3 || "",
    }));
  }, [rows]);

  /** ✅ Build rows for export CSV */
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

  /** ✅ Save checkbox “all” (with confirm + text change request) */
  function toggleCheckAll(nextValue) {
    const msg = nextValue
      ? "האם לסמן את כל השורות כ-שמור?\nזה ידרוס את המצב הקיים של כל השורות."
      : "האם לבטל שמירה לכל השורות?\nזה ידרוס את המצב הקיים של כל השורות.";
    const ok = window.confirm(msg);
    if (!ok) return;

    setRows((prev) => prev.map((r) => ({ ...r, is_selected: !!nextValue })));
  }

  /** ✅ Add NEW row (only 1 unsaved at a time), NEW row at TOP */
  function addNewRow() {
    if (pendingNewRow) {
      showBalloon(pendingNewRow.client_id);
      return;
    }
    const r = emptyRow();
    r.is_new = true;
    setRows((prev) => [r, ...prev.map((x) => ({ ...x, is_new: false }))]);
  }

  /** ✅ Clear fields in NEW row */
  function clearNewRow(clientId) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.client_id !== clientId) return r;
        const fresh = emptyRow();
        fresh.client_id = r.client_id;
        fresh.is_new = true;
        return fresh;
      })
    );
  }

  /** ✅ Delete row (removes from UI). Server delete happens on “Save DB (sync)” */
  function deleteRow(index) {
    const row = rows[index];
    if (!window.confirm(`למחוק שורה #${index + 1}?`)) return;

    // If deleting the pending new row, allow adding again
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  /** ✅ Import Excel/CSV */
  async function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const imported = (parsed.data || []).map((r) => normalizeImportedRow(r));
      // keep only one new row rule: imported rows are not “new”
      setRows(
        imported.length
          ? imported.map((x) => ({ ...x, is_new: false }))
          : [Object.assign(emptyRow(), { is_new: true })]
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
          ? imported.map((x) => ({ ...x, is_new: false }))
          : [Object.assign(emptyRow(), { is_new: true })]
      );
      return;
    }

    alert("Please upload a .csv or .xlsx file");
  }

  /** ✅ Translate */
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

  /** ✅ Export */
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

  /** ✅ Load DB (auth) */
  async function loadFromDB() {
    setBusy(true);
    try {
      const data = await fetchJson(`${DB_ENDPOINT}?action=load`, {
        method: "GET",
<<<<<<< HEAD
        headers: { Accept: "application/json" },
      });

      setProjectId(data.project_id ?? null);
      const imported = (data.rows || []).map((r) => normalizeImportedRow(r, selectAllDefault));
      setRows(imported.length ? imported : [emptyRow(selectAllDefault)]);

      lastSavedRef.current = JSON.stringify({
        projectId: data.project_id ?? null,
        rows: (imported.length ? imported : [emptyRow(selectAllDefault)]).map((r) => ({
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
        })),
      });

      setIsDirty(false);
=======
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });

      const imported = (data.rows || [])
        .map((r) => normalizeImportedRow(r))
        .map((r) => ({ ...r, is_new: false }));

      // ✅ force unchecked on load if enabled
      const finalRows = forceUncheckOnLoad
        ? imported.map((r) => ({ ...r, is_selected: false }))
        : imported;

      // If DB is empty, show one “new” row draft at top
      setRows(finalRows.length ? finalRows : [Object.assign(emptyRow(), { is_new: true })]);
>>>>>>> 67d0a88 (Update project)
    } catch (e) {
      alert(`DB load error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /**
   * ✅ Save DB (SYNC):
   * - Upsert rows
   * - Delete from DB anything not present (sync_delete=true)
   */
  async function saveToDBSync() {
    // do not allow sync save if there is pending new row with empty core fields (optional)
    setBusy(true);
    try {
      const rowsToSave = dbPayload
        .map((r) => ({ ...r }))
        .filter((r) => {
          const ui = rows.find((x) => x.client_id === r.client_id);
          return ui ? !isRowEmptyForDB(ui) : true;
        });

      const data = await fetchJson(DB_ENDPOINT, {
        method: "POST",
<<<<<<< HEAD
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, rows: rowsToSave }),
=======
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "save", rows: rowsToSave, sync_delete: true }),
>>>>>>> 67d0a88 (Update project)
      });

      // Update new IDs
      if (data?.id_map && typeof data.id_map === "object") {
        setRows((prev) =>
          prev.map((row) => {
            if (row.id) return { ...row, is_new: false };
            const newId = data.id_map[row.client_id];
            if (!newId) return row;
            return { ...row, id: Number(newId), is_new: false };
          })
        );
      }

<<<<<<< HEAD
      markSaved();
      const skipped = data.skipped_empty ?? 0;
      alert(
        `Saved ✅ (${data.saved ?? rowsToSave.length})${skipped ? `\nSkipped empty: ${skipped}` : ""}`
      );
=======
      alert(`נשמר ✅\nSaved: ${data.saved ?? ""}\nDeleted: ${data.deleted ?? 0}`);
>>>>>>> 67d0a88 (Update project)
    } catch (e) {
      alert(`DB save error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /**
   * ✅ Save ONLY the NEW row (Add button inside row):
   * - Does NOT sync-delete others
   * - returns id_map for that row
   */
  async function addThisNewRow(index) {
    const rUI = rows[index];
    if (!rUI?.is_new || rUI.id) return;

    // basic validation: don’t save totally empty row
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
          return { ...row, id: Number(newId), is_new: false };
        })
      );
    } catch (e) {
      alert(`Add row error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** ✅ Backup */
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

  /** ✅ Sorting & view */
  const viewRows = useMemo(() => {
    const q = normalizeForSearch(search);
    let list = rows.map((row, index) => ({ row, index }));

    if (q) {
      list = list.filter(({ row }) => {
        const hay = [
          row.id ? String(row.id) : "",
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

    // Keep NEW row at top always (even after sort/search)
    list = list.sort((a, b) => (b.row.is_new ? 1 : 0) - (a.row.is_new ? 1 : 0));
    return list;
  }, [rows, search, sortKey, sortDir]);

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
<<<<<<< HEAD
        :root{ --bd:#d9d9d9; --bg:#ffffff; }
        .dilenCardsApp{
          padding:12px; background:var(--bg); color:#111;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .dilenCardsApp *{ box-sizing:border-box; }

        .dilenTop{ display:grid; gap:10px; }

=======
        :root{ --bd:#d9d9d9; --bg:#ffffff; --warn:#b00020; }
        .dilenCardsApp{
          padding:12px; background:var(--bg); color:#111;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; overflow-x:auto;
        }
        .dilenCardsApp *{ box-sizing:border-box; }
        .dilenTop{ display:grid; gap:10px; }
>>>>>>> 67d0a88 (Update project)
        .dilenBar{
          display:flex; flex-wrap:wrap; align-items:center; gap:10px;
          padding:10px; border:1px solid var(--bd); border-radius:10px; background:#fff;
        }
<<<<<<< HEAD

=======
>>>>>>> 67d0a88 (Update project)
        .dilenTitle{ margin:0; font-size:20px; font-weight:900; letter-spacing:0.2px; }

        .dilenBtn{
          padding:6px 10px; border-radius:8px; border:1px solid var(--bd);
<<<<<<< HEAD
          background:#fff; cursor:pointer; font-size:13px; font-weight:700; white-space:nowrap;
        }
        .dilenBtnPrimary{
          padding:6px 10px; border-radius:8px; border:1px solid #0b63ff; background:#0b63ff;
          cursor:pointer; color:#fff !important; font-size:13px; font-weight:800; white-space:nowrap;
        }
        .dilenBtnTiny{
          padding:2px 5px; border-radius:6px; border:1px solid var(--bd);
          background:#fff; cursor:pointer; font-size:11px; font-weight:800; white-space:nowrap;
=======
          background:#fff; cursor:pointer; font-size:13px; font-weight:800; white-space:nowrap;
        }
        .dilenBtnPrimary{
          padding:6px 10px; border-radius:8px; border:1px solid #0b63ff; background:#0b63ff;
          cursor:pointer; color:#fff !important; font-size:13px; font-weight:900; white-space:nowrap;
        }
        .dilenBtnTiny{
          padding:2px 6px; border-radius:8px; border:1px solid var(--bd);
          background:#fff; cursor:pointer; font-size:11px; font-weight:900; white-space:nowrap;
          position:relative;
>>>>>>> 67d0a88 (Update project)
        }
        .dilenBtn:disabled,.dilenBtnPrimary:disabled,.dilenBtnTiny:disabled{ opacity:0.6; cursor:not-allowed; }

        .dilenInp,.dilenSel{
          height:26px; padding:3px 6px; font-size:12px;
          border:1px solid var(--bd); border-radius:6px; width:100%; background:#fff; outline:none;
        }
        .dilenSel{ height:28px; }

        .dilenPill{
          font-size:12px; padding:5px 8px; border:1px solid #e5e5e5; background:#fafafa;
<<<<<<< HEAD
          border-radius:999px; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; font-weight:700;
=======
          border-radius:999px; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; font-weight:800;
>>>>>>> 67d0a88 (Update project)
        }

        .dilenToggles{
<<<<<<< HEAD
          display:flex; flex-wrap:wrap; gap:12px; align-items:center;
          padding:10px; border:1px solid var(--bd); border-radius:10px; background:#fafafa;
        }
        .dilenToggle{ display:flex; gap:6px; align-items:center; font-size:12px; white-space:nowrap; font-weight:700; }

        .dilenTableWrap{ margin-top:10px; border:1px solid var(--bd); border-radius:10px; overflow:hidden; background:#fff; }
=======
          display:flex; flex-wrap:wrap; gap:14px; align-items:center;
          padding:10px; border:1px solid var(--bd); border-radius:10px; background:#fafafa;
        }
        .dilenToggle{
          display:flex; gap:8px; align-items:center; font-size:12px; white-space:nowrap; font-weight:900;
          padding:6px 10px; border-radius:999px; border:1px solid #e5e5e5; background:#fff;
        }

        .dilenTableWrap{ margin-top:10px; border:1px solid var(--bd); border-radius:10px; overflow:auto; background:#fff; }
>>>>>>> 67d0a88 (Update project)
        .dilenScroll{ overflow-x:auto; max-height:72vh; -webkit-overflow-scrolling: touch; }

        table.dilenTable{
          width:100%; border-collapse:collapse; table-layout:fixed;
          min-width:1200px; background:#fff;
        }

        .dilenTable thead th{
          position:sticky; top:0; z-index:5;
          background:#f6f7f9; border-bottom:1px solid #ddd;
<<<<<<< HEAD
          padding:6px 6px; font-size:12px; font-weight:800; text-align:start; white-space:nowrap;
        }

        .dilenTable tbody td{
          padding:5px 6px; border-bottom:1px solid #eee; vertical-align:middle; font-size:12px;
        }

        .dilenTable tbody tr:nth-child(even){ background:#fafafa; }

=======
          padding:6px 6px; font-size:12px; font-weight:900; text-align:start; white-space:nowrap;
        }

        .dilenTable tbody td{
          padding:5px 6px; border-bottom:1px solid #eee; vertical-align:top; font-size:12px;
        }

        .dilenTable tbody tr:nth-child(even){ background:#fafafa; }
>>>>>>> 67d0a88 (Update project)
        .dilenSortTh{ cursor:pointer; user-select:none; }
        .dilenCenter{ text-align:center; }

        .dilenCode{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size:11px; background:#f2f2f2; padding:1px 4px; border-radius:4px;
          display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }

        .dilenEnglishRow{ display:flex; gap:4px; align-items:center; }
        .dilenEnglishRow button{ padding:4px 6px; font-size:11px; }

<<<<<<< HEAD
        .dilenSmall{ font-size:11px; opacity:0.7; margin-top:4px; line-height:1.2; }
=======
        .dilenSmall{ font-size:11px; opacity:0.75; margin-top:4px; line-height:1.2; }
>>>>>>> 67d0a88 (Update project)

        /* ===== COLUMN SIZES ===== */
        .col-id{ width:55px; }
        .col-num{ width:45px; }
        .col-save{ width:55px; }
        .col-line{ width:140px; }
        .col-english{ width:220px; }
        .col-note{ width:170px; }
        .col-price{ width:70px; }
        .col-unit{ width:90px; }
<<<<<<< HEAD
        .col-aler{ width:65px; }  /* ✅ smaller (half-ish) */
        .col-del{ width:70px; }

        .optionCell{ display:grid; gap:4px; }

        /* ===== ALERGEN CELL (small) ===== */
        .dilenAlerWrap{ display:flex; flex-direction:column; gap:4px; }
        .dilenAlerTop{ display:flex; gap:4px; align-items:center; }
        .dilenAlerSel{
          height:22px; font-size:11px; padding:1px 4px;
        }
        .dilenAlerManual{
          height:22px; font-size:10px; padding:1px 4px;
        }
        .dilenLock{ font-size:11px; opacity:0.65; line-height:1; }
=======
        .col-aler{ width:65px; }
        .col-actions{ width:140px; }

        .optionCell{ display:grid; gap:4px; }

        .dilenAlerWrap{ display:flex; flex-direction:column; gap:4px; }
        .dilenAlerTop{ display:flex; gap:4px; align-items:center; }
        .dilenAlerSel{ height:22px; font-size:11px; padding:1px 4px; }
        .dilenAlerManual{ height:22px; font-size:10px; padding:1px 4px; }
        .dilenLock{ font-size:11px; opacity:0.65; line-height:1; }

        .rowNewBadge{
          display:inline-flex; align-items:center; gap:6px;
          padding:2px 8px; border-radius:999px; border:1px solid #ffd18a; background:#fff4e5;
          font-size:11px; font-weight:900;
        }

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

        .warnText{ color:var(--warn); font-weight:900; }
        .dilenCardsApp,
.dilenCardsApp * {
  color-scheme: light !important;
}

.dilenCardsApp input,
.dilenCardsApp select,
.dilenCardsApp button,
.dilenCardsApp textarea {
  background: #fff !important;
  color: #111 !important;
}

.dilenCardsApp ::placeholder {
  color: rgba(0,0,0,0.45) !important;
}

>>>>>>> 67d0a88 (Update project)
      `}</style>

      <div className="dilenTop">
        <div className="dilenBar">
<<<<<<< HEAD
          <h2 className="dilenTitle">Cards CSV Builder</h2>
=======
          <h2 className="dilenTitle">Lachmajun Cards Admin</h2>
>>>>>>> 67d0a88 (Update project)

          <button className="dilenBtn" onClick={() => fileRef.current?.click()} disabled={busy}>
            Import Excel/CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <button className="dilenBtn" onClick={addNewRow} disabled={busy}>
            + New row
          </button>

          <button className="dilenBtnPrimary" onClick={autoTranslateAll} disabled={busy}>
            {busy ? "Working..." : "Auto translate all"}
          </button>

          <button className="dilenBtn" onClick={downloadCSV} disabled={busy}>
            Export CSV
          </button>

          <button className="dilenBtn" onClick={loadFromDB} disabled={busy}>
            Load DB
          </button>

          <button className="dilenBtn" onClick={saveToDBSync} disabled={busy}>
            Save DB (sync)
          </button>

          <button className="dilenBtn" onClick={backupCreate} disabled={busy}>
            Backup now
          </button>

          <button className="dilenBtn" onClick={backupList} disabled={busy}>
            Restore…
          </button>

          <button className="dilenBtn" onClick={onLogout} disabled={busy}>
            Logout
          </button>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="dilenInp"
<<<<<<< HEAD
              style={{ width: 200 }}
=======
              style={{ width: 220 }}
>>>>>>> 67d0a88 (Update project)
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              disabled={busy}
            />
<<<<<<< HEAD

            <input
              className="dilenInp"
              style={{ width: 150 }}
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
              placeholder="project_id"
              disabled={busy}
              title="Optional: set existing project_id. If empty, server creates one."
            />

            <span className="dilenPill" title="Current project id used for DB rows">
              Project: <b>{projectId ?? "auto"}</b>
            </span>
=======
>>>>>>> 67d0a88 (Update project)
          </div>
        </div>

        <div className="dilenToggles">
          <label className="dilenToggle" title="RTL/LTR">
            <input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} />
            RTL
          </label>

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
            {allChecked ? "שמור הכל ✓" : "שמור הכל"}
          </label>

          <label className="dilenToggle">
            <input
              type="checkbox"
              checked={translateOnlyIfEmpty}
              onChange={(e) => setTranslateOnlyIfEmpty(e.target.checked)}
            />
            Translate only if english empty
          </label>

          <label className="dilenToggle" title="When loading from DB: uncheck all rows">
            <input
              type="checkbox"
              checked={forceUncheckOnLoad}
              onChange={(e) => setForceUncheckOnLoad(e.target.checked)}
            />
            Load DB → uncheck all
          </label>
        </div>
      </div>

      <div className="dilenTableWrap">
        <div className="dilenScroll">
          <table className="dilenTable">
            <thead>
              <tr>
                <Th className="col-id">ID</Th>
                <Th className="col-num">#</Th>
<<<<<<< HEAD

                <SortTh className="col-save" label="שמור?" col="is_selected" onSort={toggleSort} mark={sortMark} />

                <SortTh className="col-line" label="שורה_1" col="line_1" onSort={toggleSort} mark={sortMark} />
                <SortTh className="col-line" label="שורה_2" col="line_2" onSort={toggleSort} mark={sortMark} />
                <SortTh className="col-line" label="שורה_3" col="line_3" onSort={toggleSort} mark={sortMark} />

                <SortTh className="col-english" label="אנגלית" col="english_name" onSort={toggleSort} mark={sortMark} />

                <SortTh className="col-note" label="הערה_1" col="option_1" onSort={toggleSort} mark={sortMark} />
                <SortTh className="col-note" label="הערה_2" col="option_2" onSort={toggleSort} mark={sortMark} />
                <SortTh className="col-note" label="הערה_3" col="option_3" onSort={toggleSort} mark={sortMark} />

                <SortTh className="col-price" label="מחיר" col="price" onSort={toggleSort} mark={sortMark} />
                <SortTh className="col-unit" label="יחידה" col="unit" onSort={toggleSort} mark={sortMark} />

                <SortTh className="col-aler" label="אלרגון 1" col="alergonim_1" onSort={toggleSort} mark={sortMark} />
                <SortTh className="col-aler" label="אלרגון 2" col="alergonim_2" onSort={toggleSort} mark={sortMark} />
                <SortTh className="col-aler" label="אלרגון 3" col="alergonim_3" onSort={toggleSort} mark={sortMark} />

                <Th className="col-del">מחיקה</Th>
=======
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
>>>>>>> 67d0a88 (Update project)
              </tr>
            </thead>

            <tbody>
<<<<<<< HEAD
              {viewRows.map(({ row: r, index: realIndex }) => (
                <tr key={r.client_id || realIndex}>
                  <td className="dilenCenter">
                    <span className="dilenCode">{r.id ? r.id : "-"}</span>
                  </td>

                  <td className="dilenCenter">{realIndex + 1}</td>

                  <td className="dilenCenter">
                    <input
                      type="checkbox"
                      checked={!!r.is_selected}
                      onChange={(e) => updateCell(realIndex, "is_selected", e.target.checked)}
                      disabled={busy}
                    />
                  </td>

                  <td>
                    <input className="dilenInp" value={r.line_1} onChange={(e) => updateCell(realIndex, "line_1", e.target.value)} disabled={busy} />
                  </td>

                  <td>
                    <input className="dilenInp" value={r.line_2} onChange={(e) => updateCell(realIndex, "line_2", e.target.value)} disabled={busy} />
                  </td>

                  <td>
                    <input className="dilenInp" value={r.line_3} onChange={(e) => updateCell(realIndex, "line_3", e.target.value)} disabled={busy} />
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
                      Combined: <span className="dilenCode">{combineLines(r.line_1, r.line_2, r.line_3) || "(empty)"}</span>
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
                    <input className="dilenInp" value={r.price} onChange={(e) => updateCell(realIndex, "price", e.target.value)} disabled={busy} />
                  </td>

                  <td>
                    <select className="dilenSel" value={r.unit} onChange={(e) => updateCell(realIndex, "unit", e.target.value)} disabled={busy}>
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
                      mode={r.alergonim_1_mode}
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
                      mode={r.alergonim_2_mode}
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
                      mode={r.alergonim_3_mode}
                      locked={r.alergonim_3_locked}
                      onLabelChange={(lab) => setAlergonLabel(realIndex, 3, lab)}
                      onManualPathChange={(p) => setAlergonManualPath(realIndex, 3, p)}
                      onUnlock={() => unlockAlergon(realIndex, 3)}
                      disabled={busy}
                    />
                  </td>

                  <td>
                    <button className="dilenBtn" onClick={() => removeRow(realIndex)} disabled={busy}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
=======
              {viewRows.map(({ row: r, index: realIndex }, idxVisible) => {
                const cm1 = estimateTextCm(r.line_1);
                const cm2 = estimateTextCm(r.line_2);
                const cm3 = estimateTextCm(r.line_3);

                const over1 = cm1 > MAX_CM;
                const over2 = cm2 > MAX_CM;
                const over3 = cm3 > MAX_CM;

                return (
                  <tr key={r.client_id || realIndex}>
                    <td className="dilenCenter">
                      <span className="dilenCode">{r.id ? r.id : "-"}</span>
                      {r.is_new ? (
                        <div style={{ marginTop: 6 }}>
                          <span className="rowNewBadge">NEW</span>
                        </div>
                      ) : null}
                    </td>

                    <td className="dilenCenter">{idxVisible + 1}</td>

                    <td className="dilenCenter">
                      <input
                        type="checkbox"
                        checked={!!r.is_selected}
                        onChange={(e) => updateCell(realIndex, "is_selected", e.target.checked)}
                        disabled={busy}
                      />
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
                        {r.is_new && !r.id ? (
                          <>
                            <button
                              className="dilenBtnTiny"
                              onClick={() => addThisNewRow(realIndex)}
                              disabled={busy}
                              title="Save only this row to DB and get an ID"
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

                        <button
                          className="dilenBtnTiny"
                          onClick={() => deleteRow(realIndex)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
>>>>>>> 67d0a88 (Update project)

              {viewRows.length === 0 && (
                <tr>
                  <td colSpan={17} style={{ padding: 12, opacity: 0.85 }}>
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
                      <div style={{ fontSize: 12, opacity: 0.75 }}>Rows: {b.row_count}</div>
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
<<<<<<< HEAD
    <th className={`dilenSortTh ${className || ""}`} onClick={() => onSort(col)} title="Click to sort">
=======
    <th
      className={`dilenSortTh ${className || ""}`}
      onClick={() => onSort(col)}
      title="Click to sort"
    >
>>>>>>> 67d0a88 (Update project)
      {label}
      {mark(col)}
    </th>
  );
}

function OptionCell({ preset, custom, onChange, disabled }) {
  return (
    <div className="optionCell">
<<<<<<< HEAD
      <select className="dilenSel" value={preset} onChange={(e) => onChange(e.target.value, custom)} disabled={disabled}>
=======
      <select
        className="dilenSel"
        value={preset}
        onChange={(e) => onChange(e.target.value, custom)}
        disabled={disabled}
      >
>>>>>>> 67d0a88 (Update project)
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
<<<<<<< HEAD
 * ✅ CSV/DB keeps: full PATH
=======
 * ✅ DB/CSV keeps: full PATH
>>>>>>> 67d0a88 (Update project)
 */
function AlergonCellLabelUI({
  label,
  path,
<<<<<<< HEAD
  mode,
=======
>>>>>>> 67d0a88 (Update project)
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
<<<<<<< HEAD
          <button className="dilenBtnTiny" onClick={onUnlock} disabled={disabled} title="Unlock (return to auto)">
=======
          <button
            className="dilenBtnTiny"
            onClick={onUnlock}
            disabled={disabled}
            title="Unlock (return to auto)"
          >
>>>>>>> 67d0a88 (Update project)
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
