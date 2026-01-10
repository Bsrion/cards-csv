// src/App.jsx
// ✅ Full file (copy-paste) with ALL latest fixes:
// - Export = TXT (TAB) UTF-16LE with BOM (Hebrew/English OK in InDesign)
// - Export ONLY checked rows
// - Export headers include: @alergonim_1 @alergonim_2 @alergonim_3
// - Export does NOT include is_selected
// - Import Excel: reads hyperlinks for @alergonim_* cells (uses the real path)
// - Import: never turns alergonim into "0" (0 -> "")
// - Fix: downloadCSV is defined (alias to downloadTXT)
// - Import CSV/TXT: BOM-aware decoding (UTF-8 / UTF-16LE)

// IMPORTANT (install deps):
// npm i xlsx papaparse
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import CardDemoModal from "./components/CardDemoModal.jsx";
import "./App.css";
import Login from "./components/Login.jsx";

/**
 * ✅ API base
 * DEV:  "/api/"   (Vite proxy rewrites to /lachmajun_cards/projects/)
 * PROD: "{BASE_URL}projects/"  (BASE_URL is your Vite base, e.g. "/lachmajun_cards/")
 */
const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "/api/" : `${import.meta.env.BASE_URL || "/"}projects/`;

const TRANSLATE_ENDPOINT = `${API_BASE}translate.php`;
const DB_ENDPOINT = `${API_BASE}cards.php`;

const BASE = import.meta.env.BASE_URL || "/";
const withBase = (p) => `${BASE}${p.replace(/^\/+/, "")}`;

const UNIT_OPTIONS = ["ל-100 גר׳", "ליח׳"];

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

// ✅ TXT/CSV headers (for InDesign Data Merge)
// NOTE: InDesign image fields should start with "@"
const TXT_HEADERS = [
  "line_1",
  "line_2",
  "line_3",
  "english_name",
  "option_1",
  "option_2",
  "option_3",
  "price",
  "unit",
  "@alergonim_1",
  "@alergonim_2",
  "@alergonim_3",
];

const EXPORT_HEADERS = [
  { key: "line_1", label: "שורה ראשונה" },
  { key: "line_2", label: "שורה שניה" },
  { key: "line_3", label: "שורה שלישית" },
  { key: "english_name", label: "אנגלית" },
  { key: "price", label: "מחיר" },
  { key: "unit", label: "יחידה" },
  { key: "option_1_custom", label: "אופציה ראשונה" },
  { key: "option_2_custom", label: "אופציה שניה" },
  { key: "option_3_custom", label: "אופציה שלישית" },
  { key: "alergonim_1", label: "אלרגון_1" },
  { key: "alergonim_2", label: "אלרגון_2" },
  { key: "alergonim_3", label: "אלרגון_3" },
];

// ✅ Excel only
const EXPORT_HEADERS_EXCEL = [{ key: "id", label: "ID" }, ...EXPORT_HEADERS];

// ✅ TXT export stays WITHOUT id
const EXPORT_HEADERS_TXT = EXPORT_HEADERS;

function exportExcel(rows, filename = "cards.xlsx") {
  if (!rows || !rows.length) return;

  // ✅ Filter out:
  // - the NEW draft row (is_new && no id)
  // - totally empty rows
  // - frozen rows (optional; remove this line if you want frozen included)
  const cleanRows = rows
    .filter((r) => !(r?.is_new && !r?.id))
    .filter((r) => !r?.is_frozen)
    .filter((r) => !isRowEmptyForDB(r));

  if (!cleanRows.length) {
    alert("אין שורות תקינות לייצוא ל-Excel.");
    return;
  }

  // ✅ Use the SAME headers array for header + rows + widths
  const H = EXPORT_HEADERS_EXCEL;

  const data = [
    H.map((h) => h.label), // header row
    ...cleanRows.map((row) => H.map((h) => row?.[h.key] ?? "")),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // RTL support (important for Hebrew)
  ws["!rtl"] = true;

  // widths count must match columns count
  ws["!cols"] = H.map((h) => ({ wch: h.key === "id" ? 10 : 22 }));

  const wb = XLSX.utils.book_new();

  // ✅ workbook RTL view (extra)
  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Views = [{ RTL: true }];

  XLSX.utils.book_append_sheet(wb, ws, "Cards");
  XLSX.writeFile(wb, filename);
}

/* =========================
   ✅ ALLERGENS (UI shows LABEL, DB/TXT keeps PATH)
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
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function fmtPrice2(v) {
  const s = cleanSpaces(v).replace(",", ".");
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : s;
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

/**
 * ✅ Accept CSV/Excel values for alergonim:
 * - "0" => ""
 * - TRUE/1/YES/כן => gluten path (backward support)
 * - otherwise keep the string (path)
 */
function toAlergonValue(v) {
  const s = cleanSpaces(v);
  if (!s) return "";

  if (s === "0") return "";

  // if looks like a path, keep it as-is
  if (s.includes("/") || s.includes("\\") || s.includes(":")) return s;

  const low = s.toLowerCase();
  if (low === "true" || low === "1" || low === "yes" || low === "כן") return ALERGENS.GLUTEN.path;
  if (low === "false" || low === "no" || low === "לא") return "";

  return s;
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
   ✅ BOM-aware text decoder (CSV/TXT import)
   ========================= */
async function readFileTextSmart(file) {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);

  // UTF-16LE BOM: FF FE
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    // decode utf-16le manually
    let out = "";
    for (let i = 2; i + 1 < u8.length; i += 2) {
      out += String.fromCharCode(u8[i] | (u8[i + 1] << 8));
    }
    return out;
  }

  // UTF-8 BOM: EF BB BF
  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(u8.slice(3));
  }

  // default: utf-8
  return new TextDecoder("utf-8").decode(u8);
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

    is_selected: false,
    is_frozen: false,

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
    dirty: false,
  };
}

function normalizeImportedRow(raw) {
  const r = emptyRow();

  if (raw?.id !== undefined && raw?.id !== null && String(raw.id).trim() !== "") {
    const n = Number(raw.id);
    r.id = Number.isFinite(n) ? n : null;
  }

  if (raw?.english_anme && !raw?.english_name) raw.english_name = raw.english_anme;

  r.is_selected = toBool(raw?.is_selected, false);

  r.line_1 = String(raw?.line_1 ?? "");
  r.line_2 = String(raw?.line_2 ?? "");
  r.line_3 = String(raw?.line_3 ?? "");
  r.english_name = String(raw?.english_name ?? "");
  r.price = String(raw?.price ?? "");
  r.unit = normalizeUnit(raw?.unit ?? "");

  function normalizeUnit(u = "") {
    return String(u).replaceAll("גרם", "גר׳").replaceAll("גר'", "גר׳"); // אם מישהו כתב בטעות apostrophe רגיל
  }

  r.option_1_custom = String(raw?.option_1 ?? raw?.option_1_custom ?? "");
  r.option_2_custom = String(raw?.option_2 ?? raw?.option_2_custom ?? "");
  r.option_3_custom = String(raw?.option_3 ?? raw?.option_3_custom ?? "");

  // ✅ allergens as path (supports "@alergonim_1" or "alergonim_1")
  r.alergonim_1 = toAlergonValue(raw?.["@alergonim_1"] ?? raw?.alergonim_1 ?? "");
  r.alergonim_2 = toAlergonValue(raw?.["@alergonim_2"] ?? raw?.alergonim_2 ?? "");
  r.alergonim_3 = toAlergonValue(raw?.["@alergonim_3"] ?? raw?.alergonim_3 ?? "");

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

  r.client_id = r.client_id || makeClientId();
  r.dirty = true;
  r.is_new = !r.id;

  return r;
}

/* =========================
   ✅ App wrapper - LogIn
   ========================= */
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("cards_admin_token") || "");

  if (!token) {
    return (
      <Login
        fetchJson={fetchJson}
        dbEndpoint={DB_ENDPOINT}
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
    r.is_new = true;
    return [r];
  });

  const DEMO_CARD_BG = `${import.meta.env.BASE_URL}card_bg.png`;

  const RTL = true;
  const FORCE_UNCHECK_ON_LOAD = true;

  const [dbLoaded, setDbLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  const fileRef = useRef(null);

  const [balloonForClientId, setBalloonForClientId] = useState("");
  const balloonTimerRef = useRef(null);

  const [backups, setBackups] = useState([]);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [restorePickId, setRestorePickId] = useState("");

  const [dupOnly, setDupOnly] = useState(false);
  const [dupClientIds, setDupClientIds] = useState([]);

  const [showFrozenOnly, setShowFrozenOnly] = useState(false);

  const [demoOpen, setDemoOpen] = useState(false);
  const [demoIndex, setDemoIndex] = useState(-1); // this is REAL index in rows[]

  /** ✅ Modal navigation controls (separate from table search) */
  const [demoOnlyChecked, setDemoOnlyChecked] = useState(false);
  const [demoSearch, setDemoSearch] = useState("");

  const [showIdCol, setShowIdCol] = useState(false); // ✅ default hidden

  const allChecked = useMemo(() => rows.length > 0 && rows.every((r) => !!r.is_selected), [rows]);
  const noneChecked = useMemo(() => rows.every((r) => !r.is_selected), [rows]);
  const mixedChecked = useMemo(() => !(allChecked || noneChecked), [allChecked, noneChecked]);

  const pendingNewRow = useMemo(() => rows.find((r) => r.is_new && !r.id), [rows]);

  const dirtyCount = useMemo(
    () => rows.filter((r) => !!r.dirty && !!r.id && !r.is_new).length,
    [rows]
  );
  const newCount = useMemo(
    () => rows.filter((r) => r.is_new && !r.id && !isRowEmptyForDB(r)).length,
    [rows]
  );
  const frozenCount = useMemo(() => rows.filter((r) => !!r.id && !!r.is_frozen).length, [rows]);

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
    if (row.is_new && !row.id) return true;
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
        if (cleanSpaces(row[valKey]) === "0") row[valKey] = "";
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

      const p = String(path ?? "");
      row[valKey] = p === "0" ? "" : p;
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
      is_frozen: r.is_frozen ? 1 : 0,
      line_1: r.line_1,
      line_2: r.line_2,
      line_3: r.line_3,
      english_name: cleanSpaces(r.english_name),
      option_1: finalOption(r.option_1_preset, r.option_1_custom),
      option_2: finalOption(r.option_2_preset, r.option_2_custom),
      option_3: finalOption(r.option_3_preset, r.option_3_custom),
      price: fmtPrice2(r.price),
      unit: r.unit,

      // ✅ IMPORTANT: never send "0"
      alergonim_1: cleanSpaces(r.alergonim_1) === "0" ? "" : r.alergonim_1 || "",
      alergonim_2: cleanSpaces(r.alergonim_2) === "0" ? "" : r.alergonim_2 || "",
      alergonim_3: cleanSpaces(r.alergonim_3) === "0" ? "" : r.alergonim_3 || "",
    }));
  }, [rows]);

  /* =========================================================
     ✅ Export ONLY checked rows -> TXT UTF-16LE (InDesign)
     ========================================================= */
  const exportRows = useMemo(() => {
    return rows
      .filter((r) => !!r.is_selected)
      .filter((r) => !r.is_frozen)
      .filter((r) => !isRowEmptyForDB(r))
      .map((r) => ({
        line_1: r.line_1,
        line_2: r.line_2,
        line_3: r.line_3,
        english_name: cleanSpaces(r.english_name),
        option_1: finalOption(r.option_1_preset, r.option_1_custom),
        option_2: finalOption(r.option_2_preset, r.option_2_custom),
        option_3: finalOption(r.option_3_preset, r.option_3_custom),
        price: fmtPrice2(r.price),
        unit: r.unit,
        "@alergonim_1": cleanSpaces(r.alergonim_1) === "0" ? "" : cleanSpaces(r.alergonim_1) || "",
        "@alergonim_2": cleanSpaces(r.alergonim_2) === "0" ? "" : cleanSpaces(r.alergonim_2) || "",
        "@alergonim_3": cleanSpaces(r.alergonim_3) === "0" ? "" : cleanSpaces(r.alergonim_3) || "",
      }));
  }, [rows]);

  // ✅ UTF-16LE bytes converter (reliable in browsers)
  function stringToUtf16leBytes(str) {
    const out = new Uint8Array(str.length * 2);
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      out[i * 2] = code & 0xff;
      out[i * 2 + 1] = (code >> 8) & 0xff;
    }
    return out;
  }

  function downloadTXT() {
    if (!exportRows.length) {
      alert("לא נבחרו שורות לייצוא. סמן ✓ בעמודת 'שמור?' ואז נסה שוב.");
      return;
    }

    const body = Papa.unparse(exportRows, {
      columns: TXT_HEADERS,
      delimiter: "\t",
      newline: "\r\n",
      quotes: false,
      header: true,
    });

    const bom = new Uint8Array([0xff, 0xfe]);
    const bytes = stringToUtf16leBytes(body);

    const blob = new Blob([bom, bytes], { type: "text/plain;charset=utf-16le" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cards.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ✅ Your button calls downloadCSV in the UI, so keep it working:
  const downloadCSV = downloadTXT;

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

    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  /** Import Excel/CSV/TXT */
  async function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();

    // ✅ CSV / TXT import (BOM-aware)
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const text = await readFileTextSmart(file);
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const imported = (parsed.data || []).map((r) => normalizeImportedRow(r));
      setRows(
        imported.length
          ? imported.map((x) => ({ ...x, is_new: !x.id, dirty: true }))
          : [Object.assign(emptyRow(), { is_new: true, dirty: true })]
      );
      return;
    }

    // ✅ Excel import (.xlsx/.xls) with hyperlink target support
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];

      const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      const headerRowIndex = grid.findIndex((row) =>
        row.some((cell) => String(cell).trim() === "line_1")
      );
      if (headerRowIndex === -1) {
        alert('Excel import error: Could not find header "line_1"');
        return;
      }

      const headers = grid[headerRowIndex].map((h) => String(h).trim());
      const colIndex = Object.fromEntries(headers.map((h, i) => [h, i]));

      const colLetter = (n) => XLSX.utils.encode_col(n);
      const rowNumber = (r0) => r0 + 1;

      const rawObjects = [];

      for (let r = headerRowIndex + 1; r < grid.length; r++) {
        const hasData = ["line_1", "line_2", "line_3", "english_name", "price", "unit"].some(
          (key) => {
            const idx = colIndex[key];
            if (idx === undefined) return false;
            return String(grid[r]?.[idx] ?? "").trim() !== "";
          }
        );
        if (!hasData) continue;

        const obj = {};

        for (const h of headers) {
          const idx = colIndex[h];
          if (idx === undefined) continue;

          let v = grid[r]?.[idx] ?? "";

          if (h === "@alergonim_1" || h === "@alergonim_2" || h === "@alergonim_3") {
            const addr = `${colLetter(idx)}${rowNumber(r)}`;
            const cell = ws[addr];

            const target = cell?.l?.Target;
            if (target && String(target).trim()) {
              v = String(target);
            } else {
              const s = String(v ?? "").trim();
              if (s === "0") v = "";
            }
          }

          obj[h] = v;
        }

        rawObjects.push(obj);
      }

      const imported = rawObjects.map((r) => normalizeImportedRow(r));

      setRows(
        imported.length
          ? imported.map((x) => ({ ...x, is_new: !x.id, dirty: true }))
          : [Object.assign(emptyRow(), { is_new: true, dirty: true })]
      );

      return;
    }

    alert("Please upload a .csv / .txt / .xlsx file");
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

    const translated = await translateToEnglish(combined);
    updateCell(index, "english_name", translated);
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
        const r = emptyRow();
        r.id = raw.id ? Number(raw.id) : null;
        r.is_selected = toBool(raw.is_selected, false);
        r.is_frozen = toBool(raw.is_frozen, false);

        r.line_1 = String(raw.line_1 ?? "");
        r.line_2 = String(raw.line_2 ?? "");
        r.line_3 = String(raw.line_3 ?? "");
        r.english_name = String(raw.english_name ?? "");
        r.price = fmtPrice2(raw.price ?? "");
        r.unit = String(raw.unit ?? "");

        r.option_1_custom = String(raw.option_1 ?? "");
        r.option_2_custom = String(raw.option_2 ?? "");
        r.option_3_custom = String(raw.option_3 ?? "");

        // ✅ IMPORTANT: normalize "0" from server
        r.alergonim_1 =
          cleanSpaces(raw.alergonim_1 ?? "") === "0" ? "" : String(raw.alergonim_1 ?? "");
        r.alergonim_2 =
          cleanSpaces(raw.alergonim_2 ?? "") === "0" ? "" : String(raw.alergonim_2 ?? "");
        r.alergonim_3 =
          cleanSpaces(raw.alergonim_3 ?? "") === "0" ? "" : String(raw.alergonim_3 ?? "");

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
        r.client_id = makeClientId();
        return r;
      });

      const finalRows = FORCE_UNCHECK_ON_LOAD
        ? imported.map((r) => ({ ...r, is_selected: false }))
        : imported;

      const draft = emptyRow();
      draft.is_new = true;
      draft.dirty = false;

      setRows([draft, ...finalRows]);
      setDupOnly(false);
      setDupClientIds([]);

      setDbLoaded(true); // ✅ stop animation forever after successful load
    } catch (e) {
      alert(`DB load error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** Save ALL changes */
  async function saveToDBAllChanges() {
    const toSave = [];
    const toSaveIndexes = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      if ((r.is_new && !r.id) || !r.id) {
        if (isRowEmptyForDB(r)) continue;
      }
      if (r.id && !r.is_new && !r.dirty) continue;
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

      setRows((prev) =>
        prev.map((row, idx) => {
          const wasSaved = toSaveIndexes.includes(idx);
          if (row.id) return wasSaved ? { ...row, dirty: false, is_new: false } : row;

          const newId = data?.id_map?.[row.client_id];
          if (!newId) return wasSaved ? { ...row, dirty: false } : row;

          return { ...row, id: Number(newId), is_new: false, dirty: false };
        })
      );

      alert(`נשמר ✅\nSaved: ${data.saved ?? ""}`);
    } catch (e) {
      alert(`DB save error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** Update ONE existing row */
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

      setRows((prev) => prev.map((row, i) => (i !== index ? row : { ...row, dirty: false })));

      alert("עודכן ✅");
    } catch (e) {
      alert(`Update error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }
  async function setFreezeRow(index, nextFrozen) {
    const rUI = rows[index];
    if (!rUI?.id) {
      alert("אפשר להקפיא רק כרטיס שכבר נשמר וקיבל ID (שורה חדשה עדיין לא).");
      return;
    }

    const msg = nextFrozen
      ? "להקפיא את הכרטיס?\n\nהכרטיס יוסתר מהתצוגה הרגילה ולא ייכלל בייצוא.\nתוכל לראות אותו רק דרך 'הראה כרטיסיות בהקפאה'."
      : "לבטל הקפאה?\n\nהכרטיס יחזור לתצוגה הרגילה ויוכל להיכלל בייצוא.";
    if (!window.confirm(msg)) return;

    setBusy(true);
    try {
      const payload = { ...dbPayload[index], is_frozen: nextFrozen ? 1 : 0 };

      await fetchJson(DB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "save", rows: [payload], sync_delete: false }),
      });

      setRows((prev) =>
        prev.map((row, i) =>
          i !== index
            ? row
            : {
                ...row,
                is_frozen: nextFrozen,
                // if freezing, also uncheck it (usually desired)
                is_selected: nextFrozen ? false : row.is_selected,
                dirty: false,
                is_new: false,
              }
        )
      );
    } catch (e) {
      alert(`Freeze error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  /** Save ONLY the NEW row */
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
        prev.map((row, i) =>
          i !== index ? row : { ...row, id: Number(newId), is_new: false, dirty: false }
        )
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

  /** ✅ Delete ALL DB */
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

  /** Duplicates */
  function dupKeyFromRow(r) {
    const l1 = normalizeForSearch(r.line_1);
    const l2 = normalizeForSearch(r.line_2);
    const l3 = normalizeForSearch(r.line_3);
    if (!l1 && !l2 && !l3) return "";
    return `${l1}||${l2}||${l3}`;
  }

  function checkDuplicates() {
    const map = new Map();
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

    // ✅ Freeze view filter:
    // - Normal mode: hide frozen rows (also keep the NEW draft visible)
    // - Frozen mode: show ONLY frozen rows (hide the new draft)
    list = list.filter(({ row }) => {
      if (showFrozenOnly) {
        return !!row.is_frozen; // only frozen
      }
      // normal view
      if (row.is_new && !row.id) return true; // keep draft row visible
      return !row.is_frozen;
    });

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

    list = list.sort((a, b) => (b.row.is_new ? 1 : 0) - (a.row.is_new ? 1 : 0));
    return list;
  }, [rows, search, sortKey, sortDir, dupOnly, dupClientIds, showFrozenOnly]);
  // ✅ Filtered list of REAL indices that are allowed in the modal
  // ✅ Build indices once for ALL, once for CHECKED (no undefined vars ever)
  const demoIndicesAll = useMemo(() => {
    const q = normalizeForSearch(demoSearch);

    return rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        if (r.is_new && !r.id) return false; // hide draft
        if (r.is_frozen) return false; // hide frozen
        if (isRowEmptyForDB(r)) return false; // hide empty

        if (q) {
          const hay = [
            r.line_1,
            r.line_2,
            r.line_3,
            r.english_name,
            finalOption(r.option_1_preset, r.option_1_custom),
            finalOption(r.option_2_preset, r.option_2_custom),
            finalOption(r.option_3_preset, r.option_3_custom),
            r.price,
            r.unit,
          ]
            .map((v) => normalizeForSearch(v))
            .join(" | ");
          if (!hay.includes(q)) return false;
        }

        return true;
      })
      .map(({ i }) => i);
  }, [rows, demoSearch]);

  const demoIndicesChecked = useMemo(() => {
    // same list as ALL, but only checked
    return demoIndicesAll.filter((i) => !!rows[i]?.is_selected);
  }, [demoIndicesAll, rows]);

  // ✅ The active list used by the modal navigation
  const demoIndices = demoOnlyChecked ? demoIndicesChecked : demoIndicesAll;

  // ✅ Counts for UI
  const demoCountAll = demoIndicesAll.length;
  const demoCountChecked = demoIndicesChecked.length;
  const demoTotal = demoIndices.length;
  // position inside filtered list
  const demoPos = useMemo(() => demoIndices.indexOf(demoIndex), [demoIndices, demoIndex]);
  // 1-based page number for UI
  // 1-based page number for UI
  const demoPage = demoPos >= 0 ? demoPos + 1 : 1;
  const demoTotalCount = demoIndices.length;

  // ✅ Open first filtered card
  const openDemoFirst = useCallback(() => {
    if (!demoIndices.length) {
      alert("אין כרטיסים מתאימים לתצוגה (בדוק מסומנים ✓ / חיפוש תצוגה).");
      return;
    }
    setDemoIndex(demoIndices[0]);
    setDemoOpen(true);
  }, [demoIndices]);

  // ✅ If modal open and current index becomes invalid (filter changed) -> jump to first match
  useEffect(() => {
    if (!demoOpen) return;
    if (demoIndices.length === 0) return;

    if (!demoIndices.includes(demoIndex)) {
      setDemoIndex(demoIndices[0]);
    }
  }, [demoOpen, demoIndices, demoIndex]);

  // jump to page (1-based)
  const demoJump = useCallback(
    (page1) => {
      if (!demoIndices.length) return;

      let p = Math.floor(Number(page1));
      if (!Number.isFinite(p)) return;

      if (p < 1) p = 1;
      if (p > demoIndices.length) p = demoIndices.length;

      setDemoIndex(demoIndices[p - 1]);
    },
    [demoIndices]
  );

  const openDemoAtRealIndex = useCallback(
    (realIndex) => {
      const pos = demoIndices.indexOf(realIndex);
      if (pos === -1) {
        if (demoIndices.length === 0) {
          alert("אין כרטיסים מתאימים לתצוגה (בדוק חיפוש/מסומנים).");
          return;
        }
        setDemoIndex(demoIndices[0]);
      } else {
        setDemoIndex(realIndex);
      }
      setDemoOpen(true);
    },
    [demoIndices]
  );

  const demoPrev = useCallback(() => {
    if (!demoIndices.length) return;
    const pos = demoIndices.indexOf(demoIndex);
    const nextPos = pos <= 0 ? demoIndices.length - 1 : pos - 1; // wrap
    setDemoIndex(demoIndices[nextPos]);
  }, [demoIndices, demoIndex]);

  const demoNext = useCallback(() => {
    if (!demoIndices.length) return;
    const pos = demoIndices.indexOf(demoIndex);
    const nextPos = pos === -1 || pos >= demoIndices.length - 1 ? 0 : pos + 1; // wrap
    setDemoIndex(demoIndices[nextPos]);
  }, [demoIndices, demoIndex]);

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
    <div className="dilenCardsApp" dir={RTL ? "rtl" : "ltr"}>
      <div className="dilenTop">
        {/* ===== DESKTOP: keep your current header exactly as-is ===== */}
        <div className="dilenOnlyDesktop">
          <div className="dilenBar">
            <h1 className="dilenTitle">ניהול כרטיסי תצוגה</h1>

            <button
              className={`dilenBtn dilenBtnLoadDB ${
                !dbLoaded && !busy ? "dilenBtnLoadDB--pulse" : ""
              }`}
              onClick={loadFromDB}
              disabled={busy}
              title="העלה מסד נתונים מהשרת"
            >
              העלה DB
            </button>

            <button className="dilenBtn" onClick={addNewRow} disabled={busy}>
              + כרטיס חדש
            </button>

            <button
              className="dilenBtn"
              onClick={saveToDBAllChanges}
              disabled={busy}
              title=" שמור מסד נתונים בשרת (עדכון/הוספה)"
            >
              שמור - DB
              {dirtyCount + newCount > 0 ? <span className="dirtyDot" /> : null}
            </button>

            <button
              className="dilenBtn"
              onClick={downloadCSV}
              disabled={busy}
              title=" יצוא לקובץ TXT - לדילן (רק מסומנים)"
            >
              יצוא לדילן
            </button>

            {/* Export Excel */}
            <button
              className="layoutBtn"
              type="button"
              onClick={() => exportExcel(rows, "cards-all.xlsx")}
            >
              יצא ל- 📊 Excel
            </button>

            <button
              className="dilenBtn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title="יבוא נתונים Excel/CSV/TXT"
            >
              יבוא מקובץ
            </button>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            <button className="dilenBtn" onClick={checkDuplicates} disabled={busy}>
              בדוק כפילויות
            </button>

            <button
              className="dilenBtn"
              disabled={busy || frozenCount === 0}
              onClick={() => {
                const next = !showFrozenOnly;
                const msg = next
                  ? `לעבור לתצוגת הקפאה?\n\nיוצגו ${frozenCount} כרטיסיות בהקפאה בלבד.\nכרטיסיות רגילות יוסתרו.`
                  : "לחזור לתצוגה רגילה?\n\nיוסתרו כרטיסיות בהקפאה ויוצגו הכרטיסיות הרגילות.";
                if (!window.confirm(msg)) return;
                setShowFrozenOnly(next);
              }}
              title={
                frozenCount === 0 ? "אין כרטיסיות בהקפאה" : `יש ${frozenCount} כרטיסיות בהקפאה`
              }
            >
              {showFrozenOnly ? "חזור לתצוגה רגילה" : ` כרטיסיות בהקפאה (${frozenCount})`}
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
            <div className="dilenMobile3Rows">
              {/* ROW 1 */}
              <div className="dilenMobileRow1">
                <label
                  className="dilenToggle dilenMobileToggleCompact"
                  title={
                    allChecked
                      ? "כל השורות מסומנות"
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
                  {allChecked ? "בטל הכל ✗" : "בחר הכל ✓"}
                </label>
                <div className="dilenMobileSearchWrap">
                  <ClearableInput
                    value={search}
                    onChange={setSearch}
                    placeholder="חפש בטבלה..."
                    disabled={busy}
                  />
                </div>
                <div className="dilenToggle dilenMobileUnsaved">
                  <span className="dilenMobileUnsavedLabel">שינויים:</span>
                  <span className="dilenCode">{dirtyCount + newCount}</span>
                </div>
                <div></div>
                <label className="dilenToggle dilenMobileToggleCompact">
                  <input
                    type="checkbox"
                    checked={demoOnlyChecked}
                    onChange={(e) => setDemoOnlyChecked(e.target.checked)}
                    disabled={busy}
                  />
                  מסומנים בלבד ✓
                </label>
                <div className="dilenMobileRow2">
                  <div className="dilenMobileRow3">
                    <ClearableInput
                      value={demoSearch}
                      onChange={setDemoSearch}
                      placeholder="חיפוש בתוך התצוגה..."
                      disabled={busy}
                      onEnter={openDemoFirst}
                    />
                  </div>
                  <button
                    className="dilenBtn dilenMobileShowAccent"
                    onClick={openDemoFirst}
                    disabled={busy}
                    title="פתח תצוגה (לפי מסומנים/חיפוש תצוגה)"
                  >
                    {demoOnlyChecked ? `הצג (${demoCountChecked})` : `הצג (${demoCountAll})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== MOBILE: new short header ===== */}
        <div className="dilenOnlyMobile">
          <div className="dilenBar dilenBarMobileGrid">
            <h1 className="dilenTitle">ניהול כרטיסי תצוגה</h1>

            <button
              className={`dilenBtn dilenBtnLoadDB ${
                !dbLoaded && !busy ? "dilenBtnLoadDB--pulse" : ""
              }`}
              onClick={loadFromDB}
              disabled={busy}
            >
              העלה DB
            </button>

            <button className="dilenBtn" onClick={saveToDBAllChanges} disabled={busy}>
              שמור - DB
              {dirtyCount + newCount > 0 ? <span className="dirtyDot" /> : null}
            </button>

            <button className="dilenBtn" onClick={downloadCSV} disabled={busy}>
              יצוא לדילן
            </button>

            <button className="dilenBtn" onClick={onLogout} disabled={busy}>
              Logout
            </button>
          </div>

          <div className="dilenToggles">
            <div className="dilenMobileTogglesGrid">
              <label
                className="dilenToggle"
                style={{ width: "100%", justifyContent: "center" }}
                title={
                  allChecked
                    ? "כל השורות מסומנות"
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
                {allChecked ? " בטל בחירה ✗" : "בחר הכל ✓"}
              </label>
              <label className="dilenToggle" style={{ justifyContent: "center" }}>
                <input
                  type="checkbox"
                  checked={demoOnlyChecked}
                  onChange={(e) => setDemoOnlyChecked(e.target.checked)}
                  disabled={busy}
                />
                הצג רק מסומנים ✓
              </label>

              <div className="dilenToggle" style={{ justifyContent: "center", gap: 10 }}>
                <span style={{ fontWeight: 900 }}>שינויים:</span>
                <span className="dilenCode">{dirtyCount + newCount}</span>
              </div>

              <div className="dilenMobileFullRow">
                <ClearableInput
                  value={search}
                  onChange={setSearch}
                  placeholder="חפש בטבלה..."
                  disabled={busy}
                />
              </div>

              <button
                className="dilenBtn dilenMobileShowBig dilenMobileFullRow"
                onClick={openDemoFirst}
                disabled={busy}
                title="פתח תצוגה (לפי מסומנים)"
              >
                {demoOnlyChecked ? `הצג (${demoCountChecked})` : `הצג (${demoCountAll})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="dilenTableWrap">
        <div className="dilenScroll">
          <table
            className={`dilenTable ${showIdCol ? "dilenTable--idShow" : "dilenTable--idHide"}`}
          >
            <thead>
              <tr>
                <Th className="col-num">#</Th>

                {/* ✅ NEW: ID column */}
                <IdTh
                  show={showIdCol}
                  onToggle={() => setShowIdCol((s) => !s)}
                  onSort={toggleSort}
                  mark={sortMark}
                />

                <SortTh
                  className="col-save"
                  label="בחר"
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
                  col="alergonim_1"
                  onSort={toggleSort}
                  mark={sortMark}
                  iconNumber={1}
                />
                <SortTh
                  className="col-aler"
                  col="alergonim_2"
                  onSort={toggleSort}
                  mark={sortMark}
                  iconNumber={2}
                />
                <SortTh
                  className="col-aler"
                  col="alergonim_3"
                  onSort={toggleSort}
                  mark={sortMark}
                  iconNumber={3}
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

                    {/* ✅ NEW: ID cell */}
                    <td className="dilenCenter colIdCell">{showIdCol ? r.id ?? "" : ""}</td>

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
                        onBlur={(e) => updateCell(realIndex, "price", fmtPrice2(e.target.value))}
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
                              title="הוסף שורה חדשה לשרת"
                              style={{ position: "relative" }}
                            >
                              {balloonForClientId === r.client_id ? (
                                <div className="balloon">שמור כדי להוסיף שורה חדשה</div>
                              ) : null}
                              הוסף שורה
                            </button>

                            <button
                              className="dilenBtnTiny"
                              onClick={() => clearNewRow(r.client_id)}
                              disabled={busy}
                            >
                              נקה תוכן
                            </button>
                          </>
                        ) : null}

                        <button
                          className="dilenBtnTiny"
                          onClick={() => openDemoAtRealIndex(realIndex)}
                          disabled={busy}
                          title="הצג דמו של הכרטיס"
                        >
                          תצוגה
                        </button>

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

                        {!r.is_new && r.id && !showFrozenOnly && !r.is_frozen ? (
                          <button
                            className="dilenBtnTiny"
                            onClick={() => setFreezeRow(realIndex, true)}
                            disabled={busy}
                            title="הקפא כרטיס"
                          >
                            הקפא כרטיס
                          </button>
                        ) : null}

                        {!r.is_new && r.id && showFrozenOnly && r.is_frozen ? (
                          <button
                            className="dilenBtnTiny"
                            onClick={() => setFreezeRow(realIndex, false)}
                            disabled={busy}
                            title="בטל הקפאה"
                          >
                            בטל הקפאה
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

      <CardDemoModal
        open={demoOpen}
        row={demoIndex >= 0 ? rows[demoIndex] : null}
        onClose={() => setDemoOpen(false)}
        backgroundUrl={DEMO_CARD_BG}
        onPrev={demoPrev}
        onNext={demoNext}
        page={demoPage}
        total={demoTotalCount}
        onJump={demoJump}
        searchValue={demoSearch}
        onSearch={(text) => setDemoSearch(text)}
      />
    </div>
  );
}

function Th({ children, className }) {
  return <th className={className}>{children}</th>;
}
function SortTh({ label, col, onSort, mark, className, iconNumber }) {
  return (
    <th className={`dilenSortTh ${className || ""}`} onClick={() => onSort(col)} title="מיין">
      {iconNumber ? (
        <span className="thIconWrap">
          <img src={withBase("ellergon.svg")} alt={`אלרגון ${iconNumber}`} className="thIcon" />
          <span className="thIconNum">{iconNumber}</span>
        </span>
      ) : (
        label
      )}
      <span className="sortMark">{mark(col)}</span>
    </th>
  );
}

const IdTh = ({ show, onToggle, onSort, mark }) => (
  <th
    className={`dilenSortTh col-id idToggleTh ${show ? "idOn" : "idOff"}`}
    title={
      show
        ? "לחץ להסתיר ID • Shift+Click = מיין לפי ID"
        : "לחץ להציג ID • Shift+Click = מיין לפי ID"
    }
    onClick={(e) => {
      if (e.shiftKey) onSort("id");
      else onToggle();
    }}
    style={{ userSelect: "none", cursor: "pointer" }}
  >
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      ID
      <span style={{ fontSize: 12, opacity: 0.75 }}>{show ? "👁" : "🙈"}</span>
    </span>
    <span className="sortMark">{mark("id")}</span>
  </th>
);

function ClearableInput({ value, onChange, placeholder, disabled, style, onEnter }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", ...style }}>
      <input
        className="dilenInp"
        dir="rtl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter?.();
        }}
        style={{
          width: "100%",
          height: 34,
          fontSize: 16,
          borderRadius: 10,
          paddingLeft: 40, // space for X on left
          textAlign: "right",
        }}
      />

      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={disabled}
          title="נקה"
          style={{
            position: "absolute",
            left: 8,
            width: 24,
            height: 24,
            borderRadius: 999,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 900,
            display: "grid",
            placeItems: "center",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
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
 * ✅ DB/TXT keeps: full PATH
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
