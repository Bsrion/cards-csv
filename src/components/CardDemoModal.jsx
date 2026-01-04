// src/components/CardDemoModal.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./CardDemoModal.css";

/* ================= BASE PATH HELPER ================= */
const BASE = import.meta.env.BASE_URL || "/";
function withBase(path) {
  const p = String(path || "").replace(/^\/+/, "");
  return `${BASE}${p}`;
}

const CARD_CM = { w: 10, h: 15 };

// CSS “inch” is 96px, and 1 inch = 2.54 cm
const CM_TO_PX = 96 / 2.54;
const CARD_PX = { w: CARD_CM.w * CM_TO_PX, h: CARD_CM.h * CM_TO_PX };

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
  line_1: { x: 0.55, y: 3.5, w: 9, size: 40, weight: 800, align: "center" },
  line_2: { x: 0.55, y: 4.6, w: 9, size: 40, weight: 800, align: "center" },
  line_3: { x: 0.55, y: 5.7, w: 9, size: 40, weight: 800, align: "center" },
  english: { x: 0.55, y: 9.0, w: 9, size: 14, weight: 600, align: "center" },

  opt1: { x: 0.55, y: 10.9, w: 9, size: 15, weight: 700, align: "center" },
  opt2: { x: 0.55, y: 11.5, w: 9, size: 15, weight: 700, align: "center" },
  opt3: { x: 0.55, y: 12.1, w: 9, size: 15, weight: 700, align: "center" },

  a1: { x: 8.7, y: 10.7, w: 1.0, h: 1.0 },
  a2: { x: 8.7, y: 11.3, w: 1.0, h: 1.0 },
  a3: { x: 8.7, y: 11.9, w: 1.0, h: 1.0 },

  // PRICE GROUP controls X/Y (group)
  price_group: { x: 0.0, y: 12.7 },

  // price parts style only
  price_value: { size: 42, weight: 900, color: "#111" },
  price_ils: { size: 16, weight: 700, color: "#111" },
  price_unit: { size: 16, weight: 700, color: "#111" },
};

function pxToCm(px) {
  return px / CM_TO_PX;
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
function cloneLayout(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
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
      w: preset.w ?? 9,
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

export default function CardDemoModal(props) {
  const {
    open,
    row,
    onClose,
    backgroundUrl = "",
    onPrev,
    onNext,

    // search integration
    onSearch, // (text) => void
    searchValue = "", // controlled from parent
  } = props;

  const cardRef = useRef(null);
  const stageRef = useRef(null);
  const scalerRef = useRef(null);

  const safeRow = row || {};
  const isVisible = Boolean(open && row);

  // ===== build row values =====
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

  // ===== layout state =====
  const [layout, setLayout] = useState(defaultLayout);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const [selectedKey, setSelectedKey] = useState(null);
  const [drag, setDrag] = useState(null);
  const [suppressSelection, setSuppressSelection] = useState(false);

  // ===== desktop tools =====
  const [panelOpen, setPanelOpen] = useState(false);

  // Undo/Redo (max 20 steps)
  const MAX_HISTORY = 20;
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  function pushUndo(snapshot) {
    setUndoStack((prev) => {
      const next = [...prev, cloneLayout(snapshot)];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setRedoStack([]);
  }

  function doUndo() {
    setUndoStack((past) => {
      if (!past.length) return past;
      const prevLayout = past[past.length - 1];

      setRedoStack((future) => {
        const next = [...future, cloneLayout(layoutRef.current)];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });

      setLayout(cloneLayout(prevLayout));
      return past.slice(0, -1);
    });
  }

  function doRedo() {
    setRedoStack((future) => {
      if (!future.length) return future;
      const nextLayout = future[future.length - 1];

      setUndoStack((past) => {
        const next = [...past, cloneLayout(layoutRef.current)];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });

      setLayout(cloneLayout(nextLayout));
      return future.slice(0, -1);
    });
  }

  function updateKey(key, patch, record = true) {
    setLayout((prev) => {
      if (record) pushUndo(prev);
      const next = { ...prev };
      next[key] = { ...(next[key] || {}), ...patch };
      return next;
    });
  }

  function commitSearch(next) {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingRef.current = false;
    onSearchRef.current?.(cleanSpaces(next));
  }

  function clearSearch() {
    setQ("");
    commitSearch("");
  }

  // ===== fit scaling + zoom =====
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [realSize, setRealSize] = useState(false);
  const realSizeRef = useRef(false);

  useEffect(() => {
    realSizeRef.current = realSize;
  }, [realSize]);

  const scale = fitScale * zoom;

  function zoomIn() {
    setRealSize(false);
    setZoom((z) => clamp(z * 1.1, 0.35, 3));
  }
  function zoomOut() {
    setRealSize(false);
    setZoom((z) => clamp(z / 1.1, 0.35, 3));
  }
  function zoomReset() {
    setRealSize(false);
    setZoom(1);
  }
  function toggleRealSize() {
    if (!realSize) {
      // final scale should become 1.0 => zoom = 1/fitScale
      setZoom(clamp(1 / (fitScale || 1), 0.35, 3));
      setRealSize(true);
    } else {
      setRealSize(false);
      setZoom(1);
    }
  }

  function calcFitOnce() {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const r = stageEl.getBoundingClientRect();
    const pad = 18;

    const availW = Math.max(0, r.width - pad * 2);
    const availH = Math.max(0, r.height - pad * 2);

    const raw = Math.min(availW / CARD_PX.w, (availH * 0.92) / CARD_PX.h);
    const next = clamp(raw, 0.55, 3.2);

    setFitScale((prev) => (Math.abs(prev - next) > 0.002 ? next : prev));
  }

  function fitToScreen() {
    // IMPORTANT: unfreeze auto-fit immediately (ref first, then state)
    realSizeRef.current = false;
    setRealSize(false);

    // back to “auto-fit zoom”
    setZoom(1);

    // force re-calc after layout settles (2 frames is safest)
    requestAnimationFrame(() => requestAnimationFrame(calcFitOnce));
  }

  /* =======================
     Reset on open
  ======================= */
  const [q, setQ] = useState("");
  const typingRef = useRef(false);
  const typingTimerRef = useRef(null);

  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (!open) return;

    setLayout(defaultLayout);
    setSelectedKey(null);
    setDrag(null);
    setSuppressSelection(false);

    setPanelOpen(false);
    setUndoStack([]);
    setRedoStack([]);

    setFitScale(1);
    setZoom(1);
    setRealSize(false);

    setQ(String(searchValue || ""));
  }, [open, defaultLayout]); // intentionally NOT including searchValue

  useEffect(() => {
    if (!open) return;
    if (typingRef.current) return;
    setQ(String(searchValue || ""));
  }, [open, searchValue]);

  /* =======================
     SCALE AUTO-FIT
  ======================= */
  useLayoutEffect(() => {
    if (!open) return;
    const stageEl = stageRef.current;
    if (!stageEl) return;

    let raf = 0;

    const calc = () => {
      if (typingRef.current) return;
      if (realSizeRef.current) return; // freeze fitScale in 1:1 mode

      const r = stageEl.getBoundingClientRect();
      const pad = 18;

      const availW = Math.max(0, r.width - pad * 2);
      const availH = Math.max(0, r.height - pad * 2);

      const raw = Math.min(availW / CARD_PX.w, (availH * 0.92) / CARD_PX.h);
      const next = clamp(raw, 0.55, 3.2);

      setFitScale((prev) => (Math.abs(prev - next) > 0.002 ? next : prev));
    };

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(calc);
    });

    ro.observe(stageEl);
    raf = requestAnimationFrame(calc);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [open, row, panelOpen, realSize]);

  /* =======================
     Keyboard shortcuts (desktop)
  ======================= */
  const onCloseRef = useRef(onClose);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);

  useEffect(() => {
    onCloseRef.current = onClose;
    onPrevRef.current = onPrev;
    onNextRef.current = onNext;
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        el?.isContentEditable ||
        el?.closest?.("[contenteditable='true']");

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }

      if (typing) {
        if (e.key === "Escape") {
          e.preventDefault();
          onCloseRef.current?.();
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrevRef.current?.();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNextRef.current?.();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, canUndo, canRedo]);

  /* =======================
     CLOSE OVERLAY CLICK
  ======================= */
  const closeIfOverlay = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  /* =======================
     FIELD DRAG (mouse)
  ======================= */
  function clearSelectionIfClickOutsideCard(e) {
    if (e.target.closest?.(".dilenTopBar")) return;
    if (e.target.closest?.(".dilenCardDemoControls")) return;
    if (cardRef.current && cardRef.current.contains(e.target)) return;
    setSelectedKey(null);
  }

  function onMouseDownField(e, key) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedKey(key);

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
      scaleAtStart: scale || 1,
      before: cloneLayout(layoutRef.current),
    });
  }

  function onMouseMove(e) {
    if (!drag) return;

    const s = drag.scaleAtStart || 1;
    const dx = pxToCm((e.clientX - drag.startXpx) / s);
    const dy = pxToCm((e.clientY - drag.startYpx) / s);

    const nx = clamp(drag.startXcm + dx, -2, CARD_CM.w + 2);
    const ny = clamp(drag.startYcm + dy, -2, CARD_CM.h + 2);

    updateKey(drag.key, { x: Number(nx.toFixed(2)), y: Number(ny.toFixed(2)) }, false);
  }

  function onMouseUp() {
    if (!drag) return;
    const before = drag.before;
    setDrag(null);

    const nowStr = JSON.stringify(layoutRef.current);
    const beforeStr = JSON.stringify(before);
    if (nowStr !== beforeStr) pushUndo(before);
  }

  /* =======================
     PRINT
  ======================= */
  function handlePrint() {
    const prevKey = selectedKey;
    setSelectedKey(null);

    // safety: no scale while printing
    const scalerEl = scalerRef.current;
    const prevTransform = scalerEl?.style?.transform;
    if (scalerEl) scalerEl.style.transform = "none";

    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => {
        if (scalerEl && prevTransform != null) scalerEl.style.transform = prevTransform;
        setSelectedKey(prevKey);
      }, 0);
    });
  }

  /* =======================
     PDF
  ======================= */
  async function handleDownloadPdf() {
    const prevKey = selectedKey;
    setSelectedKey(null);

    await new Promise((r) => requestAnimationFrame(r));

    const scalerEl = scalerRef.current;
    const prevTransform = scalerEl?.style?.transform;
    if (scalerEl) scalerEl.style.transform = "none";

    try {
      const el = cardRef.current;
      if (!el) return;

      setSuppressSelection(true);

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
      if (scalerEl && prevTransform != null) scalerEl.style.transform = prevTransform;
      setSelectedKey(prevKey);
      setSuppressSelection(false);
    }
  }
  /* =======================
   SWIPE (touch only) – more sensitive + smoother
======================= */
  const swipeRef = useRef({
    active: false,
    id: null,
    x0: 0,
    y0: 0,
    x: 0,
    y: 0,
    t0: 0,
  });

  function isInteractiveTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "button" || tag === "select") return true;
    if (el.closest?.("button,input,textarea,select")) return true;
    return false;
  }

  function onPointerDown(e) {
    if (e.pointerType !== "touch") return;
    if (isInteractiveTarget(e.target)) return;

    swipeRef.current = {
      active: true,
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      t0: performance.now(),
    };
  }

  function onPointerMove(e) {
    if (e.pointerType !== "touch") return;
    const s = swipeRef.current;
    if (!s.active || s.id !== e.pointerId) return;

    s.x = e.clientX;
    s.y = e.clientY;

    // If user clearly scrolls vertically early – cancel swipe
    const dx = s.x - s.x0;
    const dy = s.y - s.y0;
    if (Math.abs(dy) > Math.abs(dx) * 1.35 && Math.abs(dy) > 14) {
      s.active = false;
    }
  }

  function onPointerUp(e) {
    if (e.pointerType !== "touch") return;
    const s = swipeRef.current;
    if (!s.active || s.id !== e.pointerId) return;
    s.active = false;

    const x1 = s.x ?? e.clientX;
    const y1 = s.y ?? e.clientY;

    const dx = x1 - s.x0;
    const dy = y1 - s.y0;
    const dt = performance.now() - s.t0;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // sensitivity knobs
    const MIN_DX = 34; // was 60
    const MAX_DT = 1100; // allow slower
    const DOMINANCE = 0.75; // allow a bit more vertical
    const MIN_VEL = 0.38; // px/ms  (≈ 380px/sec)

    const vel = absDx / Math.max(1, dt);

    // Accept either:
    // 1) normal swipe: distance big enough + mostly horizontal
    // 2) fast swipe: smaller distance but high velocity + mostly horizontal
    const mostlyHorizontal = absDx >= absDy * DOMINANCE;

    const okNormal = absDx >= MIN_DX && dt <= MAX_DT && mostlyHorizontal;
    const okFast = absDx >= 22 && vel >= MIN_VEL && dt <= MAX_DT && mostlyHorizontal;

    if (!(okNormal || okFast)) return;

    if (dx < 0) onNext?.(); // swipe left => next
    else onPrev?.(); // swipe right => prev
  }

  function onPointerCancel(e) {
    if (e.pointerType !== "touch") return;
    const s = swipeRef.current;
    if (s.id === e.pointerId) s.active = false;
  }

  // ===== layout helpers =====
  const selected = selectedKey ? layout[selectedKey] : null;
  const selectedField = selectedKey ? fields.find((f) => f.key === selectedKey) : null;

  const priceGroup = layout.price_group || { x: 0, y: 13.3 };
  const stP = layout.price_value || DEFAULT_LAYOUT_CM.price_value;
  const stS = layout.price_ils || DEFAULT_LAYOUT_CM.price_ils;
  const stU = layout.price_unit || DEFAULT_LAYOUT_CM.price_unit;

  if (!isVisible) return null;

  return (
    <div
      className="dilenCardDemoOverlay"
      onMouseDown={closeIfOverlay}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <div
        className="dilenCardDemoModal"
        onMouseDown={(e) => {
          e.stopPropagation();
          clearSelectionIfClickOutsideCard(e);
        }}
      >
        {/* ================= TOP BAR ================= */}
        <header className="dilenTopBar" dir="rtl">
          {/* MOBILE: ONLY title + search + PDF + close */}
          <div className="topMobile mobileOnly">
            <div className="navPill navPillMobile" title="ניווט (← / →)">
              <button type="button" className="navPillBtn" onClick={onPrev} aria-label="קודם">
                →
              </button>
              <span className="navPillSep">/</span>
              <button type="button" className="navPillBtn" onClick={onNext} aria-label="הבא">
                ←
              </button>
            </div>
            <div className="topMobileRow1">
              <button className="iconPill danger" type="button" onClick={onClose} title="סגור">
                ✕
              </button>

              <button className="iconPill" type="button" onClick={handleDownloadPdf} title="PDF">
                ⬇️
              </button>

              <div className="mobileTitle" title={titleRow}>
                {titleRow}
              </div>
            </div>

            <div className="topMobileRow2">
              <div className="mobileSearchWrap" title="חיפוש">
                <div className="modalSearchInputWrap">
                  <input
                    className="modalSearchInp"
                    dir="rtl"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitSearch(q);
                      }
                    }}
                    placeholder="חפש כרטיס..."
                  />
                  {q ? (
                    <button
                      className="modalSearchClear"
                      type="button"
                      onClick={clearSearch}
                      title="נקה"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* DESKTOP: FULL TOOLBAR */}
          <div className="topDesktop desktopOnly">
            <div className="topDesktopLeft">
              <div className="navPill" title="ניווט (← / →)">
                <button type="button" className="navPillBtn" onClick={onPrev} aria-label="קודם">
                  →
                </button>
                <span className="navPillSep">/</span>
                <button type="button" className="navPillBtn" onClick={onNext} aria-label="הבא">
                  ←
                </button>
              </div>

              <span className="pill">⬩</span>

              <button
                className={`pillBtn ${panelOpen ? "isActive" : ""}`}
                type="button"
                onClick={() => {
                  setPanelOpen((v) => {
                    const next = !v;
                    if (next && !selectedKey) setSelectedKey("line_1");
                    return next;
                  });
                }}
                title="Layout"
              >
                ⚙ Layout
              </button>

              <button
                className="pillBtn"
                type="button"
                onClick={doUndo}
                disabled={!canUndo}
                title="Undo (Ctrl/Cmd+Z)"
              >
                ↶
              </button>
              <button
                className="pillBtn"
                type="button"
                onClick={doRedo}
                disabled={!canRedo}
                title="Redo (Ctrl/Cmd+Shift+Z)"
              >
                ↷
              </button>
              <span className="pill">⬩</span>

              <div className="zoomGroup" title="Zoom">
                <button className="pillBtn" type="button" onClick={zoomOut}>
                  －
                </button>
                <button className="pillBtn" type="button" onClick={zoomIn}>
                  ＋
                </button>
                <button
                  className="pillBtn"
                  type="button"
                  onClick={fitToScreen}
                  title="Fit to screen"
                >
                  ⤢
                </button>

                <button
                  className={`pillBtn ${realSize ? "isActive" : ""}`}
                  type="button"
                  onClick={toggleRealSize}
                  title="1:1"
                >
                  1:1
                </button>
              </div>
              <span className="pill">⬩</span>

              <div className="modalSearchWrap" title="חיפוש">
                <div className="modalSearchInputWrap">
                  <input
                    className="modalSearchInp"
                    dir="rtl"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitSearch(q);
                      }
                    }}
                    placeholder="חפש כרטיס..."
                  />
                  {q ? (
                    <button
                      className="modalSearchClear"
                      type="button"
                      onClick={clearSearch}
                      title="נקה"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="topDesktopRight">
              <span className="titlePill" title={titleRow}>
                {titleRow}
              </span>
              <span className="pill">⬩</span>

              <button className="iconPill" type="button" onClick={handleDownloadPdf} title="PDF">
                ⬇️
              </button>

              <button className="pillBtn" type="button" onClick={handlePrint} title="הדפסה ב-100%">
                🖨️ Print
              </button>
              <span className="pill">⬩</span>

              <button className="iconPill danger" type="button" onClick={onClose} title="סגור">
                ✕
              </button>
            </div>
          </div>
        </header>

        {/* ================= BODY ================= */}
        <main className={`dilenCardDemoBody ${panelOpen ? "panelOpen" : ""}`}>
          {/* Desktop-only Layout Panel */}
          <aside className={`dilenCardDemoControls desktopOnly ${panelOpen ? "show" : ""}`}>
            <div className="ctrlTitle">בקרת מיקום ועיצוב</div>

            {!selectedKey || !selected ? (
              <div className="ctrlHint">בחר שדה כדי לערוך.</div>
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
                      X/Y של המחיר נשלטים ע״י: <b>PRICE group</b>
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

                <button
                  className="ctrlBtn"
                  type="button"
                  onClick={() => {
                    pushUndo(layoutRef.current);
                    setLayout(defaultLayout);
                  }}
                >
                  איפוס ברירת מחדל
                </button>

                <div className="ctrlHint">טיפ: Undo/Redo עובד עד 20 צעדים.</div>
              </>
            )}
          </aside>

          {/* Stage */}
          <section
            className="dilenCardDemoStage"
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <div className="printWrap">
              <div ref={scalerRef} className="cardScaler" style={{ transform: `scale(${scale})` }}>
                <div
                  ref={cardRef}
                  className={`dilenCardDemoCard printArea ${suppressSelection ? "noSelectUI" : ""}`}
                  style={{
                    width: `${CARD_CM.w}cm`,
                    height: `${CARD_CM.h}cm`,
                    fontFamily: DEFAULT_FONT.family,
                  }}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget || e.target.classList?.contains("cardBgImg"))
                      setSelectedKey(null);
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
                    if (!src) return null;

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
              </b>{" "}
              <span className="mobileOnly">• ניווט: החלקה ימינה/שמאלה</span>
            </div>
          </section>
        </main>
      </div>
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
