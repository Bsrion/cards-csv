import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================= BASE PATH HELPER ================= */
const BASE = import.meta.env.BASE_URL || "/";
function withBase(path) {
  const p = String(path || "").replace(/^\/+/, "");
  return `${BASE}${p}`;
}

const CARD_CM = { w: 10, h: 15 };

const DEFAULT_FONT = {
  family: `"Assistant", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,
  color: "#111111",
  size: 14,
  weight: 700,
};

const ALERGEN_ICON_URLS = {
  a1: withBase("logo_gloten-01.png"),
  a2: withBase("logo_gloten-02.png"),
  a3: withBase("logo_gloten-03.png"),
};

// ----- defaults (cm) -----
const DEFAULT_LAYOUT_CM = {
  line_1: { x: 0.8, y: 3.5, w: 8.4, size: 40, weight: 800, align: "center" },
  line_2: { x: 0.8, y: 4.6, w: 8.4, size: 40, weight: 800, align: "center" },
  line_3: { x: 0.8, y: 5.6, w: 8.4, size: 40, weight: 800, align: "center" },

  english: { x: 0.8, y: 9.0, w: 8.4, size: 14, weight: 600, align: "center" },

  opt1: { x: 0.8, y: 10.9, w: 8.4, size: 15, weight: 700, align: "center" },
  opt2: { x: 0.8, y: 11.5, w: 8.4, size: 15, weight: 700, align: "center" },
  opt3: { x: 0.8, y: 12.1, w: 8.4, size: 15, weight: 700, align: "center" },

  a1: { x: 8.5, y: 10.7, w: 1.0, h: 1.0 },
  a2: { x: 8.5, y: 11.3, w: 1.0, h: 1.0 },
  a3: { x: 8.5, y: 11.9, w: 1.0, h: 1.0 },

  // PRICE GROUP controls X/Y (group)
  price_group: { x: 0.0, y: 12.7 },

  // price parts style only
  price_value: { size: 42, weight: 900, color: "#111" },
  price_ils: { size: 16, weight: 900, color: "#111" },
  price_unit: { size: 16, weight: 800, color: "#111" },
};

function pxToCm(px) {
  return px / 37.7952755906;
}
function cleanSpaces(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function optionToIcon(opt) {
  const t = cleanSpaces(opt);
  if (t.includes("צמחוני")) return ALERGEN_ICON_URLS.a2;
  if (t.includes("טבעוני")) return ALERGEN_ICON_URLS.a3;
  if (t.includes("אינו מכיל גלוטן")) return ALERGEN_ICON_URLS.a1;
  return null;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildDefaultLayout(keys) {
  const out = {};
  for (const key of keys) {
    const preset = DEFAULT_LAYOUT_CM[key] || {};

    // style-only keys
    if (key === "price_value" || key === "price_ils" || key === "price_unit") {
      out[key] = {
        size: preset.size ?? 16,
        weight: preset.weight ?? 800,
        color: preset.color ?? "#111",
      };
      continue;
    }

    out[key] = {
      x: preset.x ?? 0.8,
      y: preset.y ?? 1.0,
      w: preset.w ?? 8.4,
      h: preset.h ?? 1.0,
      size: preset.size ?? DEFAULT_FONT.size,
      weight: preset.weight ?? DEFAULT_FONT.weight,
      color: preset.color ?? DEFAULT_FONT.color,
      align: preset.align ?? "center",
    };
  }

  if (!out.price_group) out.price_group = { x: 0, y: 13.3, w: 0, h: 0 };
  return out;
}

async function ensurePdfLibs() {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  return { html2canvas, jsPDF };
}

function cloneLayout(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

export default function CardDemoModal(props) {
  const {
    open,
    row,
    onClose,
    backgroundUrl = "",
    onPrev,
    onNext,
    page,
    total,
    onJump,

    // ✅ NEW: search integration to App.jsx filtering
    onSearch, // (text) => void
    searchValue = "", // current value from parent (optional)
  } = props;

  const cardRef = useRef(null);
  const stageRef = useRef(null);

  const safeRow = row || {};
  const isVisible = Boolean(open && row);

  const opt1 = (safeRow.option_1_custom || safeRow.option_1_preset || "").trim();
  const opt2 = (safeRow.option_2_custom || safeRow.option_2_preset || "").trim();
  const opt3 = (safeRow.option_3_custom || safeRow.option_3_preset || "").trim();

  const icon1 = optionToIcon(opt1);
  const icon2 = optionToIcon(opt2);
  const icon3 = optionToIcon(opt3);

  function fmtPrice2(v) {
    const s = cleanSpaces(v).replace(",", ".");
    if (!s) return "";
    const n = Number(s);
    return Number.isFinite(n) ? n.toFixed(2) : s;
  }

  const priceValue = fmtPrice2(safeRow.price);
  const priceILS = "ש״ח";
  const priceUnit = cleanSpaces(safeRow.unit);

  // ✅ title = 3 lines in ONE ROW
  const titleRow = useMemo(() => {
    const l1 = cleanSpaces(safeRow.line_1);
    const l2 = cleanSpaces(safeRow.line_2);
    const l3 = cleanSpaces(safeRow.line_3);
    const parts = [l1, l2, l3].filter(Boolean);
    return parts.length ? parts.join("  •  ") : "תצוגת כרטיס";
  }, [safeRow.line_1, safeRow.line_2, safeRow.line_3]);

  const fields = useMemo(() => {
    return [
      { key: "line_1", label: "line_1", type: "text", value: safeRow.line_1 || "" },
      { key: "line_2", label: "line_2", type: "text", value: safeRow.line_2 || "" },
      { key: "line_3", label: "line_3", type: "text", value: safeRow.line_3 || "" },

      { key: "opt1", label: "option_1", type: "text", value: opt1 },
      { key: "opt2", label: "option_2", type: "text", value: opt2 },
      { key: "opt3", label: "option_3", type: "text", value: opt3 },

      { key: "english", label: "english", type: "text", value: safeRow.english_name || "" },

      { key: "a1", label: "icon_1", type: "image", value: icon1 },
      { key: "a2", label: "icon_2", type: "image", value: icon2 },
      { key: "a3", label: "icon_3", type: "image", value: icon3 },

      { key: "price_group", label: "PRICE group", type: "group" },
      { key: "price_value", label: "price", type: "pricePart", value: priceValue },
      { key: "price_ils", label: "ש״ח", type: "pricePart", value: priceILS },
      { key: "price_unit", label: "unit", type: "pricePart", value: priceUnit },
    ];
  }, [safeRow, opt1, opt2, opt3, icon1, icon2, icon3, priceValue, priceUnit]);

  const fieldKeys = useMemo(() => fields.map((f) => f.key), [fields]);
  const defaultLayout = useMemo(() => buildDefaultLayout(fieldKeys), [fieldKeys.join("|")]);

  const [layout, setLayout] = useState(defaultLayout);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [drag, setDrag] = useState(null);

  const [jumpValue, setJumpValue] = useState(1);
  const [suppressSelection, setSuppressSelection] = useState(false);

  // ✅ Fullscreen-only scaling
  const [scale, setScale] = useState(1);

  // ✅ Search inside modal
  const [q, setQ] = useState("");

  // ✅ Undo/Redo (max 20 steps)
  const [undoStack, setUndoStack] = useState([]); // past snapshots
  const [redoStack, setRedoStack] = useState([]); // future snapshots
  const MAX_HISTORY = 20;

  function pushHistory(nextLayout) {
    setUndoStack((prev) => {
      const next = [...prev, cloneLayout(nextLayout)];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setRedoStack([]); // clear redo on new change
  }

  function canUndo() {
    return undoStack.length > 0;
  }
  function canRedo() {
    return redoStack.length > 0;
  }

  function doUndo() {
    setUndoStack((past) => {
      if (past.length === 0) return past;
      setRedoStack((future) => {
        const nextFuture = [...future, cloneLayout(layout)];
        if (nextFuture.length > MAX_HISTORY) nextFuture.shift();
        return nextFuture;
      });
      const prevLayout = past[past.length - 1];
      setLayout(cloneLayout(prevLayout));
      return past.slice(0, -1);
    });
  }

  function doRedo() {
    setRedoStack((future) => {
      if (future.length === 0) return future;
      setUndoStack((past) => {
        const nextPast = [...past, cloneLayout(layout)];
        if (nextPast.length > MAX_HISTORY) nextPast.shift();
        return nextPast;
      });
      const nextLayout = future[future.length - 1];
      setLayout(cloneLayout(nextLayout));
      return future.slice(0, -1);
    });
  }

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setLayout(defaultLayout);
    setPanelOpen(false);
    setSelectedKey(null);
    setDrag(null);
    setScale(1);
    setUndoStack([]);
    setRedoStack([]);

    // search input resets to parent value (or empty)
    setQ(String(searchValue || ""));
  }, [open, defaultLayout]);

  useEffect(() => {
    if (!open) return;
    setJumpValue(page || 1);
  }, [open, page]);

  // keep input in sync if parent changes demoSearch while modal open
  useEffect(() => {
    if (!open) return;
    setQ(String(searchValue || ""));
  }, [open, searchValue]);

  function updateKey(key, patch, record = true) {
    setLayout((prev) => {
      const next = { ...prev };
      next[key] = { ...(next[key] || {}), ...patch };

      if (record) pushHistory(prev); // record previous state
      return next;
    });
  }

  // scale calc (always fullscreen)
  useEffect(() => {
    if (!open) return;

    function calcScale() {
      const stageEl = stageRef.current;
      const cardEl = cardRef.current;
      if (!stageEl || !cardEl) return;

      const pad = 28;
      const availW = stageEl.clientWidth - pad * 2;
      const availH = stageEl.clientHeight - pad * 2;

      const baseW = cardEl.offsetWidth || 1;
      const baseH = cardEl.offsetHeight || 1;

      const s = Math.min(availW / baseW, availH / baseH);
      setScale(Math.max(0.55, Math.min(3.2, s)));
    }

    const t = requestAnimationFrame(() => requestAnimationFrame(calcScale));
    window.addEventListener("resize", calcScale);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener("resize", calcScale);
    };
  }, [open, row]);

  // KEYBOARD: arrows + esc + enter for search + undo/redo
  const prevRef = useRef(onPrev);
  const nextRef = useRef(onNext);
  const closeRef = useRef(onClose);
  const lastNavTsRef = useRef(0);

  useEffect(() => {
    prevRef.current = onPrev;
    nextRef.current = onNext;
    closeRef.current = onClose;
  }, [onPrev, onNext, onClose]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        el?.isContentEditable ||
        el?.closest?.("[contenteditable='true']");

      // Undo/Redo even if not typing (but ignore when focus is in input with text editing shortcuts)
      if (!typing) {
        // Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) doRedo();
          else doUndo();
          return;
        }
      }

      // If focused in search input: Enter triggers search
      if (tag === "input" && el?.classList?.contains("modalSearchInp")) {
        if (e.key === "Enter") {
          e.preventDefault();
          onSearch?.(cleanSpaces(q));
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setQ("");
          onSearch?.("");
        }
        return;
      }

      // normal nav (avoid repeats)
      if (e.repeat) return;
      const now = Date.now();
      if (now - lastNavTsRef.current < 120) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        lastNavTsRef.current = now;
        closeRef.current?.();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        lastNavTsRef.current = now;
        prevRef.current?.();
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        lastNavTsRef.current = now;
        nextRef.current?.();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, q, onSearch, layout]);

  const closeIfOverlay = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  function clearSelectionIfClickOutsideCard(e) {
    if (e.target.closest?.(".dilenCardDemoControls")) return;
    if (cardRef.current && cardRef.current.contains(e.target)) return;
    setSelectedKey(null);
  }

  function onMouseDownField(e, key) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedKey(key);
    setPanelOpen(true);

    const st = layout[key] || {};
    const startXcm = st.x ?? 0;
    const startYcm = st.y ?? 0;

    const dragKey =
      key === "price_value" || key === "price_ils" || key === "price_unit" ? "price_group" : key;

    const st2 = layout[dragKey] || {};
    setDrag({
      key: dragKey,
      startXpx: e.clientX,
      startYpx: e.clientY,
      startXcm: st2.x ?? startXcm,
      startYcm: st2.y ?? startYcm,
      // snapshot to allow one history push at end of drag
      before: cloneLayout(layout),
    });
  }

  function onMouseMove(e) {
    if (!drag) return;

    const dx = pxToCm(e.clientX - drag.startXpx);
    const dy = pxToCm(e.clientY - drag.startYpx);

    const nx = clamp(drag.startXcm + dx, -2, CARD_CM.w + 2);
    const ny = clamp(drag.startYcm + dy, -2, CARD_CM.h + 2);

    // ✅ do NOT record history per mousemove
    updateKey(drag.key, { x: Number(nx.toFixed(2)), y: Number(ny.toFixed(2)) }, false);
  }

  function onMouseUp() {
    if (!drag) return;

    // ✅ record one step for the whole drag
    const before = drag.before;
    setDrag(null);

    // push "before" as undo step only if changed
    const nowStr = JSON.stringify(layout);
    const beforeStr = JSON.stringify(before);
    if (nowStr !== beforeStr) {
      setUndoStack((prev) => {
        const next = [...prev, before];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });
      setRedoStack([]);
    }
  }

  function handlePrint() {
    const prev = selectedKey;
    setSelectedKey(null);
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => setSelectedKey(prev), 0);
    });
  }

  async function handleDownloadPdf() {
    const prev = selectedKey;
    setSelectedKey(null);

    await new Promise((r) => requestAnimationFrame(r));

    try {
      const el = cardRef.current;
      if (!el) return;

      setSuppressSelection(true);
      setSelectedKey(null);

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const { html2canvas, jsPDF } = await ensurePdfLibs();

      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [100, 150],
      });

      pdf.addImage(imgData, "PNG", 0, 0, 100, 150, undefined, "FAST");
      pdf.save("card-demo-10x15cm.pdf");
    } catch (err) {
      console.error(err);
      alert("PDF failed. Make sure you installed: npm i html2canvas jspdf");
    } finally {
      setSelectedKey(prev);
      setSuppressSelection(false);
    }
  }

  // Search actions
  function runSearch() {
    onSearch?.(cleanSpaces(q));
  }
  function clearSearch() {
    setQ("");
    onSearch?.("");
  }

  const selected = selectedKey ? layout[selectedKey] : null;
  const selectedField = selectedKey ? fields.find((f) => f.key === selectedKey) : null;

  const priceGroup = layout.price_group || { x: 0, y: 13.3 };
  const stP = layout.price_value || DEFAULT_LAYOUT_CM.price_value;
  const stS = layout.price_ils || DEFAULT_LAYOUT_CM.price_ils;
  const stU = layout.price_unit || DEFAULT_LAYOUT_CM.price_unit;

  const controlsVisible = panelOpen;

  if (!isVisible) return null;

  return (
    <div
      className="dilenCardDemoOverlay fullscreen"
      onMouseDown={closeIfOverlay}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <div
        className="dilenCardDemoModal fullscreen"
        onMouseDown={(e) => {
          e.stopPropagation();
          clearSelectionIfClickOutsideCard(e);
        }}
      >
        <div className="dilenCardDemoTop">
          <div className="dilenCardDemoTitle" dir="rtl" title={titleRow}>
            {titleRow}
          </div>

          <div className="topBtns">
            <button
              className="layoutBtn"
              type="button"
              onClick={() => {
                setPanelOpen((v) => {
                  const next = !v;
                  if (next && !selectedKey) setSelectedKey("line_1");
                  return next;
                });
              }}
              aria-expanded={panelOpen ? "true" : "false"}
              title="פתח/סגור Layout"
            >
              ⚙ Layout
            </button>

            <button
              className="layoutBtn"
              type="button"
              onClick={doUndo}
              disabled={!canUndo()}
              title="Undo (Ctrl/Cmd+Z)"
            >
              ↶ Undo
            </button>

            <button
              className="layoutBtn"
              type="button"
              onClick={doRedo}
              disabled={!canRedo()}
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              ↷ Redo
            </button>

            <div className="pagerWrap" dir="ltr">
              <button className="iconBtn" type="button" onClick={onPrev} title="קודם (←)">
                ‹
              </button>

              <div className="pagerText">
                {page || 1}/{total || 1}
              </div>

              <button className="iconBtn" type="button" onClick={onNext} title="הבא (→)">
                ›
              </button>

              <input
                dir="ltr"
                type="number"
                min={1}
                max={Math.max(1, total || 1)}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const n = Math.floor(Number(jumpValue));
                  if (!Number.isFinite(n)) return;
                  onJump?.(n);
                }}
                onBlur={() => {
                  const n = Math.floor(Number(jumpValue));
                  if (!Number.isFinite(n)) return;
                  onJump?.(n);
                }}
                className="jumpInp"
                title="קפוץ לעמוד (Enter או יציאה מהשדה)"
              />
            </div>

            <button className="layoutBtn" type="button" onClick={handlePrint} title="הדפס">
              🖨 Print
            </button>

            <button
              className="layoutBtn"
              type="button"
              onClick={handleDownloadPdf}
              title="הורד PDF"
            >
              ⬇️ PDF
            </button>

            <button className="dilenCardDemoCloseBtn" onClick={onClose} type="button" title="סגור">
              ✕
            </button>
          </div>
        </div>

        {/* ✅ Guidelines row + SEARCH */}
        <div className="dilenCardDemoTips" dir="rtl">
          <span className="tipPill">ניווט: ← / →</span>
          <span className="tipDot">•</span>
          <span className="tipPill">סגירה: Esc</span>
          <span className="tipDot">•</span>
          <span className="tipPill">גרירה: לחץ-גרור על הטקסט/אייקון</span>
          <span className="tipDot">•</span>
          <span className="tipPill">Layout: ⚙ לשינוי מיקום/גודל</span>
          <span className="tipDot">•</span>
          <span className="tipPill">להדפסה מדויקת: Actual size / 100%</span>

          <span className="tipDot">•</span>

          {/* ✅ Search UI */}
          <div className="modalSearchWrap" dir="rtl" title="Search inside modal (Enter or Search)">
            <div className="modalSearchInputWrap">
              <input
                className="modalSearchInp"
                dir="rtl"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search cards..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    clearSearch();
                  }
                }}
              />
              {q ? (
                <button
                  className="modalSearchClear"
                  type="button"
                  onClick={clearSearch}
                  title="Clear"
                >
                  ✕
                </button>
              ) : null}
            </div>

            <button className="modalSearchBtn" type="button" onClick={runSearch} title="Search">
              Search
            </button>
          </div>
        </div>

        <div className={`dilenCardDemoBody ${controlsVisible ? "panelOpen" : ""}`}>
          {/* ===== Controls ===== */}
          <aside className={`dilenCardDemoControls ${controlsVisible ? "show" : "hide"}`}>
            <div className="ctrlTitle">בקרת מיקום ועיצוב</div>

            {!selectedKey || !selected ? (
              <div className="ctrlHint">בחר שדה מהתפריט.</div>
            ) : (
              <>
                <label className="ctrlRow">
                  שדה:
                  <select
                    className="ctrlSel"
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                  >
                    {fields
                      .filter((f) => f.type !== "group" || f.key === "price_group")
                      .map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                  </select>
                </label>

                {selectedField?.type === "pricePart" ? (
                  <>
                    <div className="ctrlHint">
                      X/Y של שורת המחיר נשלטים דרך: <b>PRICE group</b>
                    </div>
                    <PricePartControls
                      st={layout[selectedKey]}
                      onChange={(patch) => updateKey(selectedKey, patch, true)}
                    />
                  </>
                ) : selectedKey === "price_group" ? (
                  <>
                    <div className="ctrlGrid">
                      <label className="ctrlBox">
                        X (cm)
                        <input
                          className="ctrlInp"
                          type="number"
                          step="0.1"
                          value={priceGroup.x ?? 0}
                          onChange={(e) =>
                            updateKey("price_group", { x: Number(e.target.value) }, true)
                          }
                        />
                      </label>
                      <label className="ctrlBox">
                        Y (cm)
                        <input
                          className="ctrlInp"
                          type="number"
                          step="0.1"
                          value={priceGroup.y ?? 0}
                          onChange={(e) =>
                            updateKey("price_group", { y: Number(e.target.value) }, true)
                          }
                        />
                      </label>
                    </div>

                    <div className="ctrlDivider" />
                    <div className="ctrlSubTitle">עיצוב PRICE</div>
                    <PricePartControls
                      st={stP}
                      onChange={(patch) => updateKey("price_value", patch, true)}
                    />

                    <div className="ctrlSubTitle">עיצוב ש״ח</div>
                    <PricePartControls
                      st={stS}
                      onChange={(patch) => updateKey("price_ils", patch, true)}
                    />

                    <div className="ctrlSubTitle">עיצוב unit</div>
                    <PricePartControls
                      st={stU}
                      onChange={(patch) => updateKey("price_unit", patch, true)}
                    />
                  </>
                ) : selectedField?.type === "image" ? (
                  <div className="ctrlGrid">
                    <label className="ctrlBox">
                      X (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.x}
                        onChange={(e) =>
                          updateKey(selectedKey, { x: Number(e.target.value) }, true)
                        }
                      />
                    </label>
                    <label className="ctrlBox">
                      Y (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.y}
                        onChange={(e) =>
                          updateKey(selectedKey, { y: Number(e.target.value) }, true)
                        }
                      />
                    </label>
                    <label className="ctrlBox">
                      W (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.w}
                        onChange={(e) =>
                          updateKey(selectedKey, { w: Number(e.target.value) }, true)
                        }
                      />
                    </label>
                    <label className="ctrlBox">
                      H (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.h}
                        onChange={(e) =>
                          updateKey(selectedKey, { h: Number(e.target.value) }, true)
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="ctrlGrid">
                    <label className="ctrlBox">
                      X (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.x}
                        onChange={(e) =>
                          updateKey(selectedKey, { x: Number(e.target.value) }, true)
                        }
                      />
                    </label>
                    <label className="ctrlBox">
                      Y (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.y}
                        onChange={(e) =>
                          updateKey(selectedKey, { y: Number(e.target.value) }, true)
                        }
                      />
                    </label>
                    <label className="ctrlBox">
                      W (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.w}
                        onChange={(e) =>
                          updateKey(selectedKey, { w: Number(e.target.value) }, true)
                        }
                      />
                    </label>
                    <label className="ctrlBox">
                      Size (px)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="1"
                        value={selected.size}
                        onChange={(e) =>
                          updateKey(selectedKey, { size: Number(e.target.value) }, true)
                        }
                      />
                    </label>

                    <label className="ctrlBox">
                      Weight
                      <select
                        className="ctrlSel"
                        value={selected.weight}
                        onChange={(e) =>
                          updateKey(selectedKey, { weight: Number(e.target.value) }, true)
                        }
                      >
                        {[200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="ctrlBox">
                      Align
                      <select
                        className="ctrlSel"
                        value={selected.align || "center"}
                        onChange={(e) => updateKey(selectedKey, { align: e.target.value }, true)}
                      >
                        {["right", "center", "left"].map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {/* ✅ Removed: Copy JSON button */}

                <button
                  className="ctrlBtn2"
                  type="button"
                  onClick={() => {
                    // reset becomes one undo step
                    pushHistory(layout);
                    setLayout(defaultLayout);
                  }}
                >
                  איפוס ברירת מחדל
                </button>

                <div className="ctrlHint">
                  טיפ: גרור על הכרטיס כדי להזיז אלמנטים. Undo/Redo עובד עד 20 צעדים.
                </div>
              </>
            )}
          </aside>

          {/* ===== Card ===== */}
          <div className="dilenCardDemoStage" ref={stageRef}>
            <div className="printWrap">
              <div className="cardScaler" style={{ transform: `scale(${scale})` }}>
                <div
                  ref={cardRef}
                  className={`dilenCardDemoCard printArea ${suppressSelection ? "noSelectUI" : ""}`}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget || e.target.classList?.contains("cardBgImg"))
                      setSelectedKey(null);
                  }}
                  style={{
                    width: `${CARD_CM.w}cm`,
                    height: `${CARD_CM.h}cm`,
                    fontFamily: DEFAULT_FONT.family,
                  }}
                >
                  {backgroundUrl ? (
                    <img className="cardBgImg" src={backgroundUrl} alt="" draggable={false} />
                  ) : null}

                  {/* Text blocks */}
                  {["line_1", "line_2", "line_3", "opt1", "opt2", "opt3", "english"].map((k) => {
                    const f = fields.find((x) => x.key === k);
                    const st = layout[k];
                    if (!f || !st || !f.value) return null;

                    return (
                      <div
                        key={k}
                        className={`cardField ${k.startsWith("line_") ? "nowrapLine" : ""} ${
                          selectedKey === k ? "cardFieldSel" : ""
                        }`}
                        style={{
                          left: `${st.x}cm`,
                          top: `${st.y}cm`,
                          width: `${st.w}cm`,
                          fontSize: `${st.size}px`,
                          fontWeight: st.weight,
                          color: st.color,
                          textAlign: st.align || "center",
                        }}
                        onMouseDown={(e) => onMouseDownField(e, k)}
                        title={`${k} (drag)`}
                      >
                        {f.value}
                      </div>
                    );
                  })}

                  {/* Icons */}
                  {["a1", "a2", "a3"].map((k) => {
                    const f = fields.find((x) => x.key === k);
                    const st = layout[k];
                    if (!f || !st) return null;

                    const src = f.value;
                    if (src == null || src === "") return null;

                    return (
                      <img
                        key={k}
                        className={`cardFieldImg ${selectedKey === k ? "cardFieldSel" : ""}`}
                        src={src}
                        alt=""
                        style={{
                          left: `${st.x}cm`,
                          top: `${st.y}cm`,
                          width: `${st.w}cm`,
                          height: `${st.h}cm`,
                          zIndex: 10,
                        }}
                        onMouseDown={(e) => onMouseDownField(e, k)}
                        draggable={false}
                      />
                    );
                  })}

                  {/* Price group */}
                  <div
                    className={`priceGroup ${selectedKey === "price_group" ? "cardFieldSel" : ""}`}
                    style={{ left: `calc(50% + ${priceGroup.x}cm)`, top: `${priceGroup.y}cm` }}
                    onMouseDown={(e) => onMouseDownField(e, "price_group")}
                    title="PRICE group (drag)"
                  >
                    <span
                      className={`pricePart ${selectedKey === "price_value" ? "cardFieldSel" : ""}`}
                      style={{
                        fontSize: `${stP.size}px`,
                        fontWeight: stP.weight,
                        color: stP.color,
                      }}
                      onMouseDown={(e) => onMouseDownField(e, "price_value")}
                    >
                      {priceValue}
                    </span>
                    <span
                      className={`pricePart ${selectedKey === "price_ils" ? "cardFieldSel" : ""}`}
                      style={{
                        fontSize: `${stS.size}px`,
                        fontWeight: stS.weight,
                        color: stS.color,
                      }}
                      onMouseDown={(e) => onMouseDownField(e, "price_ils")}
                    >
                      {priceILS}
                    </span>
                    <span
                      className={`pricePart ${selectedKey === "price_unit" ? "cardFieldSel" : ""}`}
                      style={{
                        fontSize: `${stU.size}px`,
                        fontWeight: stU.weight,
                        color: stU.color,
                      }}
                      onMouseDown={(e) => onMouseDownField(e, "price_unit")}
                    >
                      {priceUnit}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="dilenCardDemoHint">
              גודל הכרטיס:{" "}
              <b>
                {CARD_CM.w}cm × {CARD_CM.h}cm
              </b>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ PRINT: TRUE PHYSICAL SIZE 10x15cm */}
      <style>{`
        @media print{
          @page { size: 10cm 15cm; margin: 0; }
          html, body{
            margin: 0 !important;
            padding: 0 !important;
            width: 10cm !important;
            height: 15cm !important;
            overflow: hidden !important;
          }
          body{
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body *{ visibility: hidden !important; }
          .printWrap, .printWrap *{ visibility: visible !important; }

          .printWrap{
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 10cm !important;
            height: 15cm !important;
            display: block !important;
            background: transparent !important;
          }

          /* prevent fullscreen scale affecting print */
          .cardScaler{ transform: none !important; }

          .printArea{
            width: 10cm !important;
            height: 15cm !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .cardFieldSel{
            outline: none !important;
            background: transparent !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* ✅ UI styles (fullscreen only) */}
      <style>{`
        :root{
          --neo-bg: rgba(6,8,14,0.78);
          --neo-panel: rgba(12,16,28,0.72);
          --neo-border: rgba(135, 160, 255, 0.18);
          --neo-text: rgba(240, 246, 255, 0.92);
          --neo-sub: rgba(240, 246, 255, 0.64);
          --neo-cyan: #2AF6FF;
          --neo-violet: #B26BFF;
          --soft-shadow: 0 26px 96px rgba(0,0,0,0.56);
          --ring: 0 0 0 3px rgba(42,246,255,0.14);
        }

        .dilenCardDemoOverlay{
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 6px;
          z-index: 99999;
          background:
            radial-gradient(900px 600px at 18% 12%, rgba(42,246,255,0.16), transparent 60%),
            radial-gradient(900px 600px at 86% 72%, rgba(178,107,255,0.14), transparent 62%),
            linear-gradient(180deg, rgba(5,7,12,0.86), rgba(3,4,8,0.90));
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .dilenCardDemoModal{
          width: 100vw;
          height: 100vh;
          border-radius: 0;
          overflow: hidden;
          border: 0;
          background: linear-gradient(180deg, rgba(14,18,30,0.86), rgba(10,12,22,0.74));
          box-shadow: none;
          color: var(--neo-text);
          display: flex;
          flex-direction: column;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        }

        .dilenCardDemoTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(135,160,255,0.10);
          background: linear-gradient(180deg, rgba(18,24,40,0.40), rgba(12,16,28,0.22));
        }

        .dilenCardDemoTitle{
          max-width: 620px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 950;
          letter-spacing: 0.2px;
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 14px;
          border: 1px solid rgba(42,246,255,0.16);
          background:
            linear-gradient(90deg, rgba(42,246,255,0.11), rgba(178,107,255,0.09)),
            rgba(10,12,22,0.22);
          box-shadow: 0 0 0 1px rgba(0,0,0,0.22), 0 16px 54px rgba(0,0,0,0.26);
        }

        .topBtns{
          display:flex;
          gap:10px;
          align-items:center;
          flex-wrap: wrap;
          justify-content:flex-end;
        }

        .layoutBtn, .dilenCardDemoCloseBtn, .iconBtn{
          height: 36px;
          padding: 0 12px;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 950;
          color: var(--neo-text);
          border: 1px solid rgba(135,160,255,0.14);
          background: rgba(10,12,22,0.26);
          box-shadow: 0 14px 45px rgba(0,0,0,0.26);
          transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
        }
        .layoutBtn:hover, .iconBtn:hover{
          filter: brightness(1.06);
          box-shadow: 0 18px 60px rgba(0,0,0,0.34);
        }
        .layoutBtn:active, .iconBtn:active{ transform: translateY(1px); }
        .layoutBtn:disabled{ opacity:0.55; cursor:not-allowed; }

        .dilenCardDemoCloseBtn{
          width: 44px;
          padding: 0;
          border-color: rgba(255,120,120,0.16);
        }

        .pagerWrap{
          display:flex;
          align-items:center;
          gap:8px;
          padding: 0 10px;
          border-radius: 16px;
          border: 1px solid rgba(135,160,255,0.14);
          background: rgba(10,12,22,0.22);
          box-shadow: 0 14px 45px rgba(0,0,0,0.22);
          height: 36px;
        }
        .iconBtn{ width: 34px; padding: 0; line-height: 1; }
        .pagerText{ font-weight: 950; min-width: 78px; text-align:center; color: var(--neo-sub); }

        .jumpInp{
          width: 92px;
          height: 30px;
          border-radius: 12px;
          border: 1px solid rgba(42,246,255,0.14);
          background: rgba(5,7,12,0.22);
          color: var(--neo-text);
          padding: 0 10px;
          font-weight: 900;
          outline: none;
        }
        .jumpInp:focus{ box-shadow: var(--ring); border-color: rgba(42,246,255,0.26); }

        .dilenCardDemoTips{
          display:flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(135,160,255,0.08);
          background: rgba(10,12,22,0.16);
          color: var(--neo-sub);
          font-size: 12px;
        }
        .tipPill{
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(135,160,255,0.14);
          background: rgba(10,12,22,0.20);
          color: var(--neo-sub);
          white-space: nowrap;
        }
        .tipDot{ opacity: 0.34; padding: 0 2px; }

        /* ✅ Search */
        .modalSearchWrap{
          display:flex;
          align-items:center;
          gap: 8px;
          margin-inline-start: 4px;
        }
        .modalSearchInputWrap{
          position: relative;
          display:flex;
          align-items:center;
        }
        .modalSearchInp{
  width: 260px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(42,246,255,0.18);
  background: rgba(5,7,12,0.22);
  color: var(--neo-text);
  padding: 0 36px 0 12px;
  outline: none;
  font-weight: 900;
}
        .modalSearchInp:focus{
          box-shadow: var(--ring);
          border-color: rgba(42,246,255,0.32);
        }
       
.modalSearchClear{
  position: absolute;
  left: 8px;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid rgba(135,160,255,0.16);
  background: rgba(10,12,22,0.26);
  color: var(--neo-text);
  cursor: pointer;
  font-weight: 950;
  line-height: 1;
  display:grid;
  place-items:center;
}
        .modalSearchBtn{
          height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          cursor: pointer;
          font-weight: 950;
          color: var(--neo-text);
          border: 1px solid rgba(135,160,255,0.14);
          background: rgba(10,12,22,0.26);
          box-shadow: 0 14px 45px rgba(0,0,0,0.22);
        }
        .modalSearchBtn:hover{ filter: brightness(1.06); }

        .dilenCardDemoBody{
          flex: 1;
          overflow: hidden;
          display: grid;
          grid-template-columns: 0px 1fr;
          gap: 14px;
          padding: 14px;
          transition: grid-template-columns 260ms ease;
          min-height: 520px;
        }
        .dilenCardDemoBody.panelOpen{ grid-template-columns: 370px 1fr; }

        .dilenCardDemoControls{
          border-radius: 18px;
          padding: 12px;
          border: 1px solid rgba(42,246,255,0.11);
          background: rgba(10,12,22,0.26);
          box-shadow: 0 18px 70px rgba(0,0,0,0.30);
          transform: translateX(-10px);
          opacity: 0;
          pointer-events: none;
          transition: transform 260ms ease, opacity 260ms ease;
          overflow: auto;
          max-height: calc(100vh - 170px);
        }
        .dilenCardDemoControls.show{ transform: translateX(0); opacity: 1; pointer-events: auto; }

        .ctrlTitle{ font-weight: 950; font-size: 13px; color: var(--neo-text); }
        .ctrlSubTitle{ font-weight: 950; font-size: 12px; margin-top: 8px; color: var(--neo-sub); }
        .ctrlDivider{ height: 1px; background: rgba(135,160,255,0.10); margin: 10px 0; }
        .ctrlRow{ display:flex; flex-direction:column; gap:6px; font-size:12px; font-weight:900; margin-top:10px; color: var(--neo-sub); }

        .ctrlGrid{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px; }
        .ctrlBox{ display:flex; flex-direction:column; gap:6px; font-size:12px; font-weight:950; color: var(--neo-sub); }

        .ctrlInp,.ctrlSel{
          height: 34px;
          border-radius: 12px;
          border: 1px solid rgba(135,160,255,0.14);
          background: rgba(5,7,12,0.18);
          color: var(--neo-text);
          padding: 0 10px;
          outline: none;
        }
        .ctrlInp:focus,.ctrlSel:focus{ box-shadow: var(--ring); border-color: rgba(42,246,255,0.22); }

        .ctrlBtn2{
          margin-top: 10px;
          height: 40px;
          border-radius: 14px;
          border: 1px solid rgba(135,160,255,0.14);
          background: rgba(5,7,12,0.14);
          color: var(--neo-text);
          font-weight: 950;
          cursor:pointer;
        }

        .ctrlHint{ font-size: 12px; opacity: 0.88; line-height: 1.35; margin-top: 10px; color: var(--neo-sub); }

        .dilenCardDemoStage{
          display:grid;
          gap: 10px;
          justify-items:center;
          align-content:center;
          position: relative;
          height: calc(100vh - 170px);
        }

        .printWrap{ display:grid; place-items:center; }
        .cardScaler{ transform-origin: center center; display: inline-block; }

        .dilenCardDemoCard{
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 18px;
          background: #fff;
          position: relative;
          overflow: hidden;
          direction: rtl;
          box-shadow: 0 22px 56px rgba(0,0,0,0.16);
        }

        .cardBgImg{
          position:absolute;
          inset:0;
          width:100%;
          height:100%;
          object-fit:cover;
          z-index:0;
          pointer-events:none;
          user-select:none;
        }

        .cardField, .cardFieldImg, .priceGroup{ z-index:5; }

        .cardField{
          position:absolute;
          cursor: grab;
          user-select: none;
          padding: 2px 6px;
          border-radius: 10px;
          line-height: 1.15;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .nowrapLine{
          white-space: nowrap !important;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cardFieldImg{
          position:absolute;
          cursor: grab;
          user-select:none;
          border-radius:10px;
          object-fit: contain;
          pointer-events:auto;
        }

        .cardFieldSel{
          outline: none !important;
          background: rgba(42,246,255,0.09);
          box-shadow: 0 0 0 2px rgba(42,246,255,0.26), 0 18px 45px rgba(42,246,255,0.12);
        }
        .noSelectUI .cardFieldSel{ background: transparent !important; box-shadow: none !important; }

        .priceGroup{
          position:absolute;
          transform: translateX(-50%);
          display:flex;
          gap: 8px;
          align-items: baseline;
          justify-content:center;
          direction: rtl;
          z-index: 20;
          cursor: grab;
          padding: 2px 8px;
          border-radius: 10px;
        }
        .pricePart{ user-select:none; cursor: grab; white-space: nowrap; background: transparent; }

        .dilenCardDemoHint{
          font-size: 10px;
          opacity: 0.72;
          text-align: center;
          color: var(--neo-sub);
        }

        @media (max-width: 920px){
          .dilenCardDemoBody{ grid-template-columns: 1fr; overflow:auto; }
          .dilenCardDemoBody.panelOpen{ grid-template-columns: 1fr; }
          .dilenCardDemoControls{ transform:none; opacity:1; pointer-events:auto; max-height:none; }
          .dilenCardDemoTitle{ max-width: 240px; }
          .dilenCardDemoStage{ height:auto; }
        }
      `}</style>
    </div>
  );
}

function PricePartControls({ st, onChange }) {
  return (
    <div className="ctrlGrid">
      <label className="ctrlBox">
        Size (px)
        <input
          className="ctrlInp"
          type="number"
          step="1"
          value={Number(st?.size ?? 16)}
          onChange={(e) => onChange?.({ size: Number(e.target.value) })}
        />
      </label>

      <label className="ctrlBox">
        Weight
        <select
          className="ctrlSel"
          value={Number(st?.weight ?? 800)}
          onChange={(e) => onChange?.({ weight: Number(e.target.value) })}
        >
          {[200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>

      <label className="ctrlBox" style={{ gridColumn: "1 / -1" }}>
        Color
        <input
          className="ctrlInp"
          type="text"
          value={st?.color ?? "#111"}
          onChange={(e) => onChange?.({ color: e.target.value })}
          placeholder="#111111"
        />
      </label>
    </div>
  );
}
