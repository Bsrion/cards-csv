// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

const TRANSLATE_ENDPOINT = "https://dilen-digital.co.il/api/projects/translate.php";
const DB_ENDPOINT = "https://dilen-digital.co.il/api/projects/cards.php";

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
   ✅ ALLERGENS (UI shows LABEL, CSV/DB keeps PATH)
   ========================= */
const ALERGENS = {
  GLUTEN: {
    key: "GLUTEN",
    label: "גלוטן",
    path:
      "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-01.png",
  },
  VEGAN: {
    key: "VEGAN",
    label: "טבעוני",
    path:
      "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-02.png",
  },
  VEGETARIAN: {
    key: "VEGETARIAN",
    label: "צמחוני",
    path:
      "/Volumes/studio/grafica/lahmajun_abu_rami_0469/lachmajun_new_template/lachmajun_master_heb_english_23194/logo_gloten/logo_gloten-03.png",
  },
};

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
}

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
  if (isNumericLike(a) && isNumericLike(b)) {
    return (Number(a) - Number(b)) * dir;
  }
  const as = normalizeForSearch(a);
  const bs = normalizeForSearch(b);
  return as.localeCompare(bs) * dir;
}

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

export default function App() {
  const [rows, setRows] = useState(() => [emptyRow(true)]);
  const [busy, setBusy] = useState(false);
  const [rtl, setRtl] = useState(true);
  const [selectAllDefault, setSelectAllDefault] = useState(true);
  const [translateOnlyIfEmpty, setTranslateOnlyIfEmpty] = useState(true);

  const [projectId, setProjectId] = useState(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  const [isDirty, setIsDirty] = useState(false);
  const lastSavedRef = useRef("");

  const fileRef = useRef(null);

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

      // ✅ SAVE FULL PATH
      alergonim_1: r.alergonim_1 || "",
      alergonim_2: r.alergonim_2 || "",
      alergonim_3: r.alergonim_3 || "",
    }));
  }, [rows]);

  useEffect(() => {
    const snap = JSON.stringify({ projectId, rows: dbPayload });
    setIsDirty(snap !== lastSavedRef.current);
  }, [dbPayload, projectId]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function markSaved() {
    lastSavedRef.current = JSON.stringify({ projectId, rows: dbPayload });
    setIsDirty(false);
  }

  function updateCell(index, key, value) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(selectAllDefault)]);
  }

  function removeRow(index) {
    if (!window.confirm(`Delete row #${index + 1}?`)) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const imported = (parsed.data || []).map((r) => normalizeImportedRow(r, selectAllDefault));
      setRows(imported.length ? imported : [emptyRow(selectAllDefault)]);
      return;
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const imported = (json || []).map((r) => normalizeImportedRow(r, selectAllDefault));
      setRows(imported.length ? imported : [emptyRow(selectAllDefault)]);
      return;
    }

    alert("Please upload a .csv or .xlsx file");
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

  const emptyRowsCount = useMemo(
    () => rows.reduce((acc, r) => acc + (isRowEmptyForDB(r) ? 1 : 0), 0),
    [rows]
  );

  async function loadFromDB() {
    setBusy(true);
    try {
      const url = `${DB_ENDPOINT}?project_id=${projectId ?? ""}`;
      const data = await fetchJson(url, {
        method: "GET",
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
    } catch (e) {
      alert(`DB load error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveToDB() {
    if (emptyRowsCount > 0) {
      const ok = window.confirm(
        `⚠️ Warning:\n` +
          `${emptyRowsCount} row(s) are empty and will NOT be saved.\n\n` +
          `Empty row = line_1+line_2+line_3+english_name+price+unit are all empty.\n\n` +
          `Continue saving?`
      );
      if (!ok) return;
    }

    const rowsToSave = dbPayload.filter((r) => {
      const ui = rows.find((x) => x.client_id === r.client_id);
      return ui ? !isRowEmptyForDB(ui) : true;
    });

    setBusy(true);
    try {
      const data = await fetchJson(DB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, rows: rowsToSave }),
      });

      setProjectId(data.project_id ?? projectId);

      if (data?.id_map && typeof data.id_map === "object") {
        setRows((prev) =>
          prev.map((row) => {
            if (row.id) return row;
            const newId = data.id_map[row.client_id];
            return newId ? { ...row, id: Number(newId) } : row;
          })
        );
      }

      markSaved();
      const skipped = data.skipped_empty ?? 0;
      alert(
        `Saved ✅ (${data.saved ?? rowsToSave.length})${skipped ? `\nSkipped empty: ${skipped}` : ""}`
      );
    } catch (e) {
      alert(`DB save error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

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
        :root{ --bd:#d9d9d9; --bg:#ffffff; }
        .dilenCardsApp{
          padding:12px; background:var(--bg); color:#111;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
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
          background:#fff; cursor:pointer; font-size:13px; font-weight:700; white-space:nowrap;
        }
        .dilenBtnPrimary{
          padding:6px 10px; border-radius:8px; border:1px solid #0b63ff; background:#0b63ff;
          cursor:pointer; color:#fff !important; font-size:13px; font-weight:800; white-space:nowrap;
        }
        .dilenBtnTiny{
          padding:2px 5px; border-radius:6px; border:1px solid var(--bd);
          background:#fff; cursor:pointer; font-size:11px; font-weight:800; white-space:nowrap;
        }
        .dilenBtn:disabled,.dilenBtnPrimary:disabled,.dilenBtnTiny:disabled{ opacity:0.6; cursor:not-allowed; }

        .dilenInp,.dilenSel{
          height:26px; padding:3px 6px; font-size:12px;
          border:1px solid var(--bd); border-radius:6px; width:100%; background:#fff; outline:none;
        }
        .dilenSel{ height:28px; }

        .dilenPill{
          font-size:12px; padding:5px 8px; border:1px solid #e5e5e5; background:#fafafa;
          border-radius:999px; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; font-weight:700;
        }
        .dilenPillWarn{ border-color:#ffcc00; background:#fff7cc; }
        .dilenPillOk{ border-color:#bde5bd; background:#eaffea; }

        .dilenToggles{
          display:flex; flex-wrap:wrap; gap:12px; align-items:center;
          padding:10px; border:1px solid var(--bd); border-radius:10px; background:#fafafa;
        }
        .dilenToggle{ display:flex; gap:6px; align-items:center; font-size:12px; white-space:nowrap; font-weight:700; }

        .dilenTableWrap{ margin-top:10px; border:1px solid var(--bd); border-radius:10px; overflow:hidden; background:#fff; }
        .dilenScroll{ overflow-x:auto; max-height:72vh; -webkit-overflow-scrolling: touch; }

        table.dilenTable{
          width:100%; border-collapse:collapse; table-layout:fixed;
          min-width:1200px; background:#fff;
        }

        .dilenTable thead th{
          position:sticky; top:0; z-index:5;
          background:#f6f7f9; border-bottom:1px solid #ddd;
          padding:6px 6px; font-size:12px; font-weight:800; text-align:start; white-space:nowrap;
        }

        .dilenTable tbody td{
          padding:5px 6px; border-bottom:1px solid #eee; vertical-align:middle; font-size:12px;
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

        .dilenSmall{ font-size:11px; opacity:0.7; margin-top:4px; line-height:1.2; }

        /* ===== COLUMN SIZES ===== */
        .col-id{ width:55px; }
        .col-num{ width:45px; }
        .col-save{ width:55px; }
        .col-line{ width:140px; }
        .col-english{ width:220px; }
        .col-note{ width:170px; }
        .col-price{ width:70px; }
        .col-unit{ width:90px; }
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
      `}</style>

      <div className="dilenTop">
        <div className="dilenBar">
          <h2 className="dilenTitle">Cards CSV Builder</h2>

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

          <button className="dilenBtn" onClick={addRow} disabled={busy}>
            + Add row
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

          <button className="dilenBtn" onClick={saveToDB} disabled={busy}>
            Save DB
          </button>

          {isDirty ? (
            <span className="dilenPill dilenPillWarn">Unsaved</span>
          ) : (
            <span className="dilenPill dilenPillOk">Saved</span>
          )}

          {emptyRowsCount > 0 && (
            <span className="dilenPill dilenPillWarn" title="These rows will be skipped on Save DB">
              Empty rows: <b>{emptyRowsCount}</b> (won’t save)
            </span>
          )}

          <span className="dilenPill">
            Rows:{" "}
            <b>
              {viewRows.length}/{rows.length}
            </b>
          </span>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="dilenInp"
              style={{ width: 200 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              disabled={busy}
            />

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
          </div>
        </div>

        <div className="dilenToggles">
          <label className="dilenToggle">
            <input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} />
            RTL
          </label>

          <label className="dilenToggle">
            <input
              type="checkbox"
              checked={translateOnlyIfEmpty}
              onChange={(e) => setTranslateOnlyIfEmpty(e.target.checked)}
            />
            Translate only if english empty
          </label>

          <label className="dilenToggle">
            <input
              type="checkbox"
              checked={selectAllDefault}
              onChange={(e) => setSelectAllDefault(e.target.checked)}
            />
            New rows selected by default
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
              </tr>
            </thead>

            <tbody>
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

      <p style={{ marginTop: 10, opacity: 0.85 }}>
        Translate endpoint: <span className="dilenCode">{TRANSLATE_ENDPOINT}</span>
      </p>
      <p style={{ marginTop: 6, opacity: 0.85 }}>
        DB endpoint: <span className="dilenCode">{DB_ENDPOINT}</span>
      </p>
    </div>
  );
}

function Th({ children, className }) {
  return <th className={className}>{children}</th>;
}

function SortTh({ label, col, onSort, mark, className }) {
  return (
    <th className={`dilenSortTh ${className || ""}`} onClick={() => onSort(col)} title="Click to sort">
      {label}
      {mark(col)}
    </th>
  );
}

function OptionCell({ preset, custom, onChange, disabled }) {
  return (
    <div className="optionCell">
      <select className="dilenSel" value={preset} onChange={(e) => onChange(e.target.value, custom)} disabled={disabled}>
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
 * ✅ CSV/DB keeps: full PATH
 */
function AlergonCellLabelUI({
  label,
  path,
  mode,
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
          <button className="dilenBtnTiny" onClick={onUnlock} disabled={disabled} title="Unlock (return to auto)">
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
