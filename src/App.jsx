// src/App.jsx
import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

const TRANSLATE_ENDPOINT = "https://dilen-digital.co.il/api/projects/translate.php";

const UNIT_OPTIONS = ["ל-100 גרם", "ליח׳"];
const OPTION_PRESETS = ["", "חריף", "טבעוני", "ללא גלוטן", "חדש"];

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

function emptyRow(selectedDefault = true) {
  return {
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
    alergonim_1: false,
    alergonim_2: false,
    alergonim_3: false,
  };
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

function cleanSpaces(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ") // nbsp
    .replace(/\s+/g, " ")
    .trim();
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

  // ✅ Fix “stuck words” also on client side
  return cleanSpaces(data.translated);
}

function toBool(v, def = false) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s) return def;
  return s === "true" || s === "1" || s === "yes" || s === "כן";
}

function normalizeImportedRow(raw, selectedDefault = true) {
  const r = emptyRow(selectedDefault);
  if (raw.english_anme && !raw.english_name) raw.english_name = raw.english_anme;

  for (const k of Object.keys(r)) {
    if (raw[k] !== undefined && raw[k] !== null) r[k] = raw[k];
  }

  if (raw.option_1 !== undefined) r.option_1_custom = String(raw.option_1 ?? "");
  if (raw.option_2 !== undefined) r.option_2_custom = String(raw.option_2 ?? "");
  if (raw.option_3 !== undefined) r.option_3_custom = String(raw.option_3 ?? "");

  r.is_selected = toBool(raw.is_selected, selectedDefault);
  r.alergonim_1 = toBool(raw.alergonim_1, false);
  r.alergonim_2 = toBool(raw.alergonim_2, false);
  r.alergonim_3 = toBool(raw.alergonim_3, false);

  r.line_1 = String(r.line_1 ?? "");
  r.line_2 = String(r.line_2 ?? "");
  r.line_3 = String(r.line_3 ?? "");
  r.english_name = String(r.english_name ?? "");
  r.price = String(r.price ?? "");
  r.unit = String(r.unit ?? "");

  return r;
}

export default function App() {
  const [rows, setRows] = useState(() => [emptyRow(true)]);
  const [busy, setBusy] = useState(false);
  const [rtl, setRtl] = useState(true);
  const [selectAllDefault, setSelectAllDefault] = useState(true);
  const [translateOnlyIfEmpty, setTranslateOnlyIfEmpty] = useState(true);

  const fileRef = useRef(null);

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
      alergonim_1: r.alergonim_1 ? "TRUE" : "FALSE",
      alergonim_2: r.alergonim_2 ? "TRUE" : "FALSE",
      alergonim_3: r.alergonim_3 ? "TRUE" : "FALSE",
    }));
  }, [rows]);

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

  return (
    <div style={{ padding: 16 }} dir={rtl ? "rtl" : "ltr"}>
      <header style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Cards CSV Builder</h2>

        <button onClick={() => fileRef.current?.click()} disabled={busy}>
          Import Excel/CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <button onClick={addRow} disabled={busy}>
          + Add row
        </button>

        <button onClick={autoTranslateAll} disabled={busy}>
          {busy ? "Working..." : "Auto translate all"}
        </button>

        <button onClick={downloadCSV} disabled={busy}>
          Export CSV
        </button>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} />
          RTL
        </label>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={translateOnlyIfEmpty}
            onChange={(e) => setTranslateOnlyIfEmpty(e.target.checked)}
          />
          Translate only if english empty
        </label>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={selectAllDefault}
            onChange={(e) => setSelectAllDefault(e.target.checked)}
          />
          New rows selected by default
        </label>
      </header>

      <hr style={{ margin: "12px 0" }} />

      <div style={{ marginTop: 12, overflow: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>save?</Th>
              <Th>line_1</Th>
              <Th>line_2</Th>
              <Th>line_3</Th>
              <Th>english_name</Th>
              <Th>option_1</Th>
              <Th>option_2</Th>
              <Th>option_3</Th>
              <Th>price</Th>
              <Th>unit</Th>
              <Th>a1</Th>
              <Th>a2</Th>
              <Th>a3</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                <Td>{i + 1}</Td>

                <Td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!r.is_selected}
                    onChange={(e) => updateCell(i, "is_selected", e.target.checked)}
                    disabled={busy}
                  />
                </Td>

                <Td>
                  <input
                    value={r.line_1}
                    onChange={(e) => updateCell(i, "line_1", e.target.value)}
                    disabled={busy}
                  />
                </Td>

                <Td>
                  <input
                    value={r.line_2}
                    onChange={(e) => updateCell(i, "line_2", e.target.value)}
                    disabled={busy}
                  />
                </Td>

                <Td>
                  <input
                    value={r.line_3}
                    onChange={(e) => updateCell(i, "line_3", e.target.value)}
                    disabled={busy}
                  />
                </Td>

                <Td style={{ minWidth: 280 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={r.english_name}
                      onChange={(e) => updateCell(i, "english_name", e.target.value)}
                      style={{ flex: 1 }}
                      disabled={busy}
                    />
                    <button
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await autoTranslateRow(i);
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
                  <small style={{ opacity: 0.75 }}>
                    Combined: <code>{combineLines(r.line_1, r.line_2, r.line_3) || "(empty)"}</code>
                  </small>
                </Td>

                <Td>
                  <OptionCell
                    preset={r.option_1_preset}
                    custom={r.option_1_custom}
                    onPreset={(v) => updateCell(i, "option_1_preset", v)}
                    onCustom={(v) => updateCell(i, "option_1_custom", v)}
                    disabled={busy}
                  />
                </Td>

                <Td>
                  <OptionCell
                    preset={r.option_2_preset}
                    custom={r.option_2_custom}
                    onPreset={(v) => updateCell(i, "option_2_preset", v)}
                    onCustom={(v) => updateCell(i, "option_2_custom", v)}
                    disabled={busy}
                  />
                </Td>

                <Td>
                  <OptionCell
                    preset={r.option_3_preset}
                    custom={r.option_3_custom}
                    onPreset={(v) => updateCell(i, "option_3_preset", v)}
                    onCustom={(v) => updateCell(i, "option_3_custom", v)}
                    disabled={busy}
                  />
                </Td>

                <Td>
                  <input
                    value={r.price}
                    onChange={(e) => updateCell(i, "price", e.target.value)}
                    disabled={busy}
                  />
                </Td>

                <Td>
                  <select
                    value={r.unit}
                    onChange={(e) => updateCell(i, "unit", e.target.value)}
                    disabled={busy}
                  >
                    <option value="">(empty)</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </Td>

                <Td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!r.alergonim_1}
                    onChange={(e) => updateCell(i, "alergonim_1", e.target.checked)}
                    disabled={busy}
                  />
                </Td>

                <Td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!r.alergonim_2}
                    onChange={(e) => updateCell(i, "alergonim_2", e.target.checked)}
                    disabled={busy}
                  />
                </Td>

                <Td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!r.alergonim_3}
                    onChange={(e) => updateCell(i, "alergonim_3", e.target.checked)}
                    disabled={busy}
                  />
                </Td>

                <Td>
                  <button onClick={() => removeRow(i)} disabled={busy}>
                    Delete
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, opacity: 0.85 }}>
        Translate endpoint: <code>{TRANSLATE_ENDPOINT}</code>
      </p>
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "start",
        padding: 8,
        background: "#fafafa",
        borderBottom: "1px solid #eee",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }) {
  return <td style={{ padding: 8, verticalAlign: "top", ...style }}>{children}</td>;
}

function OptionCell({ preset, custom, onPreset, onCustom, disabled }) {
  return (
    <div style={{ display: "grid", gap: 6, minWidth: 180 }}>
      <select value={preset} onChange={(e) => onPreset(e.target.value)} disabled={disabled}>
        {OPTION_PRESETS.map((p) => (
          <option key={p} value={p}>
            {p === "" ? "(empty)" : p}
          </option>
        ))}
      </select>

      <input
        placeholder="custom (overrides preset)"
        value={custom}
        onChange={(e) => onCustom(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
