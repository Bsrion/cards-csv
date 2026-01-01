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

export default function CardDemoModal({
  open,
  row,
  onClose,
  backgroundUrl = "",
  onPrev,
  onNext,
  page,
  total,
  onJump,
}) {
  if (!open || !row) return null;

  const cardRef = useRef(null);
  const stageRef = useRef(null);

  const opt1 = (row.option_1_custom || row.option_1_preset || "").trim();
  const opt2 = (row.option_2_custom || row.option_2_preset || "").trim();
  const opt3 = (row.option_3_custom || row.option_3_preset || "").trim();

  const icon1 = optionToIcon(opt1);
  const icon2 = optionToIcon(opt2);
  const icon3 = optionToIcon(opt3);

  const priceValue = cleanSpaces(row.price);
  const priceILS = "ש״ח";
  const priceUnit = cleanSpaces(row.unit);

  const fields = useMemo(() => {
    return [
      { key: "line_1", label: "line_1", type: "text", value: row.line_1 || "" },
      { key: "line_2", label: "line_2", type: "text", value: row.line_2 || "" },
      { key: "line_3", label: "line_3", type: "text", value: row.line_3 || "" },

      { key: "opt1", label: "option_1", type: "text", value: opt1 },
      { key: "opt2", label: "option_2", type: "text", value: opt2 },
      { key: "opt3", label: "option_3", type: "text", value: opt3 },

      { key: "english", label: "english", type: "text", value: row.english_name || "" },

      { key: "a1", label: "icon_1", type: "image", value: icon1 },
      { key: "a2", label: "icon_2", type: "image", value: icon2 },
      { key: "a3", label: "icon_3", type: "image", value: icon3 },

      { key: "price_group", label: "PRICE group", type: "group" },
      { key: "price_value", label: "price", type: "pricePart", value: priceValue },
      { key: "price_ils", label: "ש״ח", type: "pricePart", value: priceILS },
      { key: "price_unit", label: "unit", type: "pricePart", value: priceUnit },
    ];
  }, [row, opt1, opt2, opt3, icon1, icon2, icon3, priceValue, priceUnit]);

  const fieldKeys = useMemo(() => fields.map((f) => f.key), [fields]);
  const defaultLayout = useMemo(() => buildDefaultLayout(fieldKeys), [fieldKeys.join("|")]);

  const [layout, setLayout] = useState(defaultLayout);

  const [panelOpen, setPanelOpen] = useState(false); // ✅ controls are ONLY based on this
  const [selectedKey, setSelectedKey] = useState(null);
  const [drag, setDrag] = useState(null);

  const [jumpValue, setJumpValue] = useState(1);
  const [suppressSelection, setSuppressSelection] = useState(false);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fsScale, setFsScale] = useState(1);

  useEffect(() => {
    if (!open) return;
    setLayout(defaultLayout);
    setPanelOpen(false);
    setSelectedKey(null);
    setDrag(null);
    setIsFullScreen(false);
    setFsScale(1);
  }, [open, defaultLayout]);

  useEffect(() => {
    if (!open) return;
    setJumpValue(page || 1);
  }, [open, page]);

  // ✅ when entering fullscreen: close panel by default + reset scale so measuring is stable
  useEffect(() => {
    if (!open) return;
    if (isFullScreen) {
      setPanelOpen(false);
      setFsScale(1); // important! prevents the "2nd time smaller/bigger" bug
    }
  }, [open, isFullScreen]);

  function updateKey(key, patch) {
    setLayout((prev) => {
      const next = { ...prev };
      next[key] = { ...(next[key] || {}), ...patch };
      return next;
    });
  }

  // ✅ fullscreen scale calc (IMPORTANT: use offsetWidth/offsetHeight to ignore transforms)
  useEffect(() => {
    if (!open || !isFullScreen) return;

    function calcScale() {
      const stageEl = stageRef.current;
      const cardEl = cardRef.current;
      if (!stageEl || !cardEl) return;

      const pad = 28;
      const availW = stageEl.clientWidth - pad * 2;
      const availH = stageEl.clientHeight - pad * 2;

      // IGNORE transforms:
      const baseW = cardEl.offsetWidth || 1;
      const baseH = cardEl.offsetHeight || 1;

      const s = Math.min(availW / baseW, availH / baseH);
      setFsScale(Math.max(0.6, Math.min(3.2, s)));
    }

    // let layout paint first
    const t = requestAnimationFrame(() => requestAnimationFrame(calcScale));

    window.addEventListener("resize", calcScale);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener("resize", calcScale);
    };
  }, [open, isFullScreen]);

  // ✅ keyboard
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.repeat) return;

      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (typing) return;

      e.stopPropagation();

      if (e.key === "Escape") {
        e.preventDefault();
        if (isFullScreen) setIsFullScreen(false);
        else onClose?.();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev?.();
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext?.();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onPrev, onNext, onClose, isFullScreen]);

  // overlay close
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

    // ✅ open panel ONLY when user clicked element OR pressed layout button
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
    });
  }

  function onMouseMove(e) {
    if (!drag) return;

    const dx = pxToCm(e.clientX - drag.startXpx);
    const dy = pxToCm(e.clientY - drag.startYpx);

    const nx = clamp(drag.startXcm + dx, -2, CARD_CM.w + 2);
    const ny = clamp(drag.startYcm + dy, -2, CARD_CM.h + 2);

    updateKey(drag.key, { x: Number(nx.toFixed(2)), y: Number(ny.toFixed(2)) });
  }

  function onMouseUp() {
    if (drag) setDrag(null);
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

  const selected = selectedKey ? layout[selectedKey] : null;
  const selectedField = selectedKey ? fields.find((f) => f.key === selectedKey) : null;

  const priceGroup = layout.price_group || { x: 0, y: 13.3 };
  const stP = layout.price_value || DEFAULT_LAYOUT_CM.price_value;
  const stS = layout.price_ils || DEFAULT_LAYOUT_CM.price_ils;
  const stU = layout.price_unit || DEFAULT_LAYOUT_CM.price_unit;

  const controlsVisible = panelOpen; // ✅ IMPORTANT: fullscreen does NOT force controls open

  return (
    <div
      className={`dilenCardDemoOverlay ${isFullScreen ? "fullscreen" : ""}`}
      onMouseDown={closeIfOverlay}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <div
        className={`dilenCardDemoModal ${isFullScreen ? "fullscreen" : ""}`}
        onMouseDown={(e) => {
          e.stopPropagation();
          clearSelectionIfClickOutsideCard(e);
        }}
      >
        <div className="dilenCardDemoTop">
          <div className="dilenCardDemoTitle">תצוגת כרטיס (דמו)</div>

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

            <button
              className="layoutBtn"
              type="button"
              onClick={() => setIsFullScreen((v) => !v)}
              title={isFullScreen ? "יציאה ממסך מלא (Esc)" : "מסך מלא"}
            >
              {isFullScreen ? "⤢ Exit" : "⛶ Full"}
            </button>

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
                      onChange={(patch) => updateKey(selectedKey, patch)}
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
                          onChange={(e) => updateKey("price_group", { x: Number(e.target.value) })}
                        />
                      </label>
                      <label className="ctrlBox">
                        Y (cm)
                        <input
                          className="ctrlInp"
                          type="number"
                          step="0.1"
                          value={priceGroup.y ?? 0}
                          onChange={(e) => updateKey("price_group", { y: Number(e.target.value) })}
                        />
                      </label>
                    </div>

                    <div className="ctrlDivider" />
                    <div className="ctrlSubTitle">עיצוב PRICE</div>
                    <PricePartControls
                      st={stP}
                      onChange={(patch) => updateKey("price_value", patch)}
                    />

                    <div className="ctrlSubTitle">עיצוב ש״ח</div>
                    <PricePartControls
                      st={stS}
                      onChange={(patch) => updateKey("price_ils", patch)}
                    />

                    <div className="ctrlSubTitle">עיצוב unit</div>
                    <PricePartControls
                      st={stU}
                      onChange={(patch) => updateKey("price_unit", patch)}
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
                        onChange={(e) => updateKey(selectedKey, { x: Number(e.target.value) })}
                      />
                    </label>
                    <label className="ctrlBox">
                      Y (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.y}
                        onChange={(e) => updateKey(selectedKey, { y: Number(e.target.value) })}
                      />
                    </label>
                    <label className="ctrlBox">
                      W (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.w}
                        onChange={(e) => updateKey(selectedKey, { w: Number(e.target.value) })}
                      />
                    </label>
                    <label className="ctrlBox">
                      H (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.h}
                        onChange={(e) => updateKey(selectedKey, { h: Number(e.target.value) })}
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
                        onChange={(e) => updateKey(selectedKey, { x: Number(e.target.value) })}
                      />
                    </label>
                    <label className="ctrlBox">
                      Y (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.y}
                        onChange={(e) => updateKey(selectedKey, { y: Number(e.target.value) })}
                      />
                    </label>
                    <label className="ctrlBox">
                      W (cm)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="0.1"
                        value={selected.w}
                        onChange={(e) => updateKey(selectedKey, { w: Number(e.target.value) })}
                      />
                    </label>
                    <label className="ctrlBox">
                      Size (px)
                      <input
                        className="ctrlInp"
                        type="number"
                        step="1"
                        value={selected.size}
                        onChange={(e) => updateKey(selectedKey, { size: Number(e.target.value) })}
                      />
                    </label>

                    <label className="ctrlBox">
                      Weight
                      <select
                        className="ctrlSel"
                        value={selected.weight}
                        onChange={(e) => updateKey(selectedKey, { weight: Number(e.target.value) })}
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
                        onChange={(e) => updateKey(selectedKey, { align: e.target.value })}
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
                    navigator.clipboard?.writeText(JSON.stringify(layout, null, 2));
                    alert("הועתק ללוח (layout JSON) ✅");
                  }}
                >
                  העתק Layout JSON
                </button>

                <button className="ctrlBtn2" type="button" onClick={() => setLayout(defaultLayout)}>
                  איפוס ברירת מחדל
                </button>

                <div className="ctrlHint">טיפ: גרור על הכרטיס כדי להזיז אלמנטים.</div>
              </>
            )}
          </aside>

          {/* ===== Card ===== */}
          <div className="dilenCardDemoStage" ref={stageRef}>
            <div
              className="cardScaler"
              style={{ transform: isFullScreen ? `scale(${fsScale})` : "none" }}
            >
              <div
                ref={cardRef}
                className={`dilenCardDemoCard printArea ${suppressSelection ? "noSelectUI" : ""}`}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget || e.target.classList?.contains("cardBgImg")) {
                    setSelectedKey(null);
                  }
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
                  style={{
                    left: `calc(50% + ${priceGroup.x}cm)`,
                    top: `${priceGroup.y}cm`,
                  }}
                  onMouseDown={(e) => onMouseDownField(e, "price_group")}
                  title="PRICE group (drag)"
                >
                  <span
                    className={`pricePart ${selectedKey === "price_value" ? "cardFieldSel" : ""}`}
                    style={{ fontSize: `${stP.size}px`, fontWeight: stP.weight, color: stP.color }}
                    onMouseDown={(e) => onMouseDownField(e, "price_value")}
                  >
                    {priceValue}
                  </span>

                  <span
                    className={`pricePart ${selectedKey === "price_ils" ? "cardFieldSel" : ""}`}
                    style={{ fontSize: `${stS.size}px`, fontWeight: stS.weight, color: stS.color }}
                    onMouseDown={(e) => onMouseDownField(e, "price_ils")}
                  >
                    {priceILS}
                  </span>

                  <span
                    className={`pricePart ${selectedKey === "price_unit" ? "cardFieldSel" : ""}`}
                    style={{ fontSize: `${stU.size}px`, fontWeight: stU.weight, color: stU.color }}
                    onMouseDown={(e) => onMouseDownField(e, "price_unit")}
                  >
                    {priceUnit}
                  </span>
                </div>
              </div>
            </div>

            <div className={`dilenCardDemoHint ${isFullScreen ? "hideOnFullscreen" : ""}`}>
              גודל הכרטיס:{" "}
              <b>
                {CARD_CM.w}cm × {CARD_CM.h}cm
              </b>
            </div>
          </div>
        </div>
      </div>

      {/* Print only the card */}
      <style>{`
        @media print{
          body * { visibility: hidden !important; }
          .printArea, .printArea * { visibility: visible !important; }
          .printArea { position: fixed; inset: 0; display: grid; place-items: center; }
          .dilenCardDemoCard{ box-shadow:none !important; border:0 !important; }
          .cardFieldSel{ outline: none !important; background: transparent !important; box-shadow:none !important; }
        }
      `}</style>

      <style>{`
        /* ===== OVERLAY / MODAL PROFESSIONAL LOOK ===== */
        .dilenCardDemoOverlay{
  position:fixed; inset:0;
  background:rgba(0,0,0,0.35);
  display:grid;
  place-items:center;
  z-index:99999;

  /* ✅ 20px margin from screen edges */
  padding:40px;
}
.dilenCardDemoStage { position: relative; }

.dilenCardDemoHint {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
}

        .dilenCardDemoModal{
  /* ✅ use full available area minus padding */
  width: min(1120px, 100%);
  
  /* ✅ make it taller (+10%) but keep inside viewport */
  height: min( calc(90vh * 1.10), 100% );

  background:#fff;
  border:1px solid #ddd;
  border-radius:14px;
  box-shadow:0 18px 50px rgba(0,0,0,0.25);
  overflow:hidden;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;

  /* ✅ keep layout stable */
  display:flex;
  flex-direction:column;
}

        .dilenCardDemoTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:10px 12px;
          border-bottom:1px solid rgba(0,0,0,0.06);
          background: linear-gradient(#fbfbfc, #f6f7f9);
          position: sticky;
          top: 0;
          z-index: 5;
        }

        .dilenCardDemoTitle{
          font-weight: 1000;
          letter-spacing: 0.2px;
        }

        .topBtns{
          display:flex;
          gap:10px;
          align-items:center;
          flex-wrap: wrap;
          justify-content:flex-end;
        }

        .layoutBtn{
          border:1px solid rgba(0,0,0,0.12);
          background:#fff;
          border-radius:12px;
          height:36px;
          padding:0 12px;
          cursor:pointer;
          font-weight:900;
          box-shadow: 0 1px 0 rgba(0,0,0,0.03);
        }
        .layoutBtn:hover{ background:#f4f6f8; }

        .dilenCardDemoCloseBtn{
          border:1px solid rgba(0,0,0,0.12);
          background:#fff;
          border-radius:12px;
          height:36px;
          width:44px;
          cursor:pointer;
          font-weight:900;
        }
        .dilenCardDemoCloseBtn:hover{ background:#ffecec; border-color:#ffb6b6; }

        .pagerWrap{
          display:flex;
          align-items:center;
          gap:8px;
          padding: 0 6px;
          border: 1px solid rgba(0,0,0,0.10);
          border-radius: 12px;
          height: 36px;
          background: #fff;
        }
        .iconBtn{
          height: 30px;
          width: 32px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.10);
          background: #fff;
          font-weight: 1000;
          cursor: pointer;
          line-height: 1;
        }
        .iconBtn:hover{ background:#f3f3f3; }

        .pagerText{
          font-weight: 1000;
          min-width: 72px;
          text-align:center;
          opacity: 0.9;
        }

        .jumpInp{
          width: 86px;
          height: 30px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.12);
          padding: 0 10px;
          font-weight: 1000;
          outline: none;
        }

        /* ===== BODY LAYOUT (IMPORTANT FIX) ===== */
        .dilenCardDemoBody{
          display:grid;
          grid-template-columns: 0px 1fr; /* closed */
          gap:12px;
          padding:12px;
          transition: grid-template-columns 260ms ease;
          min-height: 520px;
        }
        .dilenCardDemoBody.panelOpen{
          grid-template-columns: 360px 1fr; /* open */
        }
        .dilenCardDemoBody{
  /* ✅ body becomes scrollable inside the taller modal */
  flex:1;
  overflow:auto;
}

        .dilenCardDemoControls{
          border:1px solid rgba(0,0,0,0.08);
          border-radius:14px;
          padding:12px;
          background:#fff;
          overflow:hidden;
          transform: translateX(-10px);
          opacity:0;
          pointer-events:none;
          transition: transform 260ms ease, opacity 260ms ease;
          box-shadow: 0 10px 30px rgba(0,0,0,0.06);
        }
        .dilenCardDemoControls.show{
          transform: translateX(0);
          opacity:1;
          pointer-events:auto;
        }

        .ctrlTitle{ font-weight:1000; font-size:14px; }
        .ctrlSubTitle{ font-weight:1000; font-size:12px; margin-top:6px; }
        .ctrlDivider{ height:1px; background:rgba(0,0,0,0.06); margin:8px 0; }
        .ctrlRow{ display:flex; flex-direction:column; gap:6px; font-size:12px; font-weight:900; margin-top:10px; }

        .ctrlGrid{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:10px;
          margin-top:10px;
        }
        .ctrlBox{
          display:flex;
          flex-direction:column;
          gap:6px;
          font-size:12px;
          font-weight:1000;
        }
        .ctrlInp,.ctrlSel{
          height:34px;
          border:1px solid rgba(0,0,0,0.12);
          border-radius:12px;
          padding:0 10px;
          font-size:13px;
          outline:none;
          background:#fff;
        }

        .ctrlBtn{
          margin-top:12px;
          height:38px;
          border-radius:12px;
          border:1px solid #0b63ff;
          background:#0b63ff;
          color:#fff;
          font-weight:1000;
          cursor:pointer;
        }
        .ctrlBtn:hover{ filter: brightness(0.98); }
        .ctrlBtn2{
          margin-top:8px;
          height:38px;
          border-radius:12px;
          border:1px solid rgba(0,0,0,0.12);
          background:#fff;
          font-weight:1000;
          cursor:pointer;
        }
        .ctrlBtn2:hover{ background:#f4f6f8; }

        .ctrlHint{
          font-size:12px;
          opacity:0.8;
          line-height:1.35;
          margin-top:8px;
        }

        /* ===== STAGE ===== */
        .dilenCardDemoStage{
          display:grid;
          gap:10px;
          justify-items:center;
          align-content:center;
          position: relative;
        }

        .cardScaler{
          transform-origin: center center;
          display: inline-block;
        }

        .dilenCardDemoCard{
          border:1px solid rgba(0,0,0,0.18);
          border-radius:14px;
          background-size:cover;
          background-position:center;
          background-repeat:no-repeat;
          position:relative;
          overflow:hidden;
          direction: rtl;
          background-color:#fff;
          box-shadow: 0 12px 36px rgba(0,0,0,0.12);
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
          cursor:grab;
          user-select:none;
          padding:2px 4px;
          border-radius:10px;
          line-height:1.15;
          white-space:pre-wrap;
          word-break:break-word;
        }

        .nowrapLine{
          white-space: nowrap !important;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cardFieldImg{
          position:absolute;
          cursor:grab;
          user-select:none;
          border-radius:10px;
          object-fit:contain;
          pointer-events:auto;
        }

        /* ✅ selection = light glow only (no dashed stroke) */
        .cardFieldSel{
          outline: none !important;
          background: rgba(11,99,255,0.06);
          box-shadow: 0 0 0 2px rgba(11,99,255,0.35), 0 10px 26px rgba(11,99,255,0.18);
        }
        .noSelectUI .cardFieldSel{
          outline:none !important;
          background:transparent !important;
          box-shadow:none !important;
        }

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
          padding: 2px 6px;
          border-radius: 10px;
        }
        .pricePart{
          user-select:none;
          cursor:grab;
          white-space:nowrap;
          background: transparent;
        }

        .dilenCardDemoHint{
          font-size:9px;
          opacity:0.55;
          text-align:center;
        }

        /* ===== FULLSCREEN MODE (IMPORTANT FIX) ===== */
        .dilenCardDemoOverlay.fullscreen{
          background: rgba(8, 10, 14, 0.82);
          padding: 5px;
        }

        .dilenCardDemoOverlay.fullscreen .dilenCardDemoModal{
          width: 100vw;
          height: 100vh;
          max-width: none;
          max-height: none;
          border-radius: 0;
          box-shadow: none;
          display:flex;
          flex-direction:column;
        }

        /* ✅ DO NOT FORCE 360px in fullscreen. Use same panelOpen logic. */
        .dilenCardDemoOverlay.fullscreen .dilenCardDemoBody{
          flex:1;
          min-height: 0;
        }

        /* ✅ center the card ALWAYS in fullscreen */
        .dilenCardDemoOverlay.fullscreen .dilenCardDemoStage{
          height: 100%;
          align-content: center;
          display: grid;
          place-items: center;
        }

        @media (max-width: 920px){
          .dilenCardDemoBody{ grid-template-columns: 1fr; }
          .dilenCardDemoBody.panelOpen{ grid-template-columns: 1fr; }
          .dilenCardDemoControls{
            transform:none;
            opacity:1;
            pointer-events:auto;
          }
        }

        @media (max-width: 520px){
          .dilenCardDemoCard{
            width:92vw !important;
            height: calc(92vw * 1.5) !important;
            max-height: 78vh;
          }
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
