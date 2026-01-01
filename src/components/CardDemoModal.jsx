import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * CardDemoModal (FULL WORKING)
 * ✅ 10cm x 15cm card
 * ✅ a1/a2/a3 icons from /public:
 *    /logo_gloten-01.png /logo_gloten-02.png /logo_gloten-03.png
 * ✅ Price row fixed: price + ש״ח + unit (RTL) as ONE centered group (no “broken” layout)
 * ✅ Layout panel opens ONLY by pressing the “⚙ Layout” button
 * ✅ You can drag elements without opening the panel
 * ✅ Layout controls include X and Y (and W/H for icons), and font size/weight
 * ✅ Print button + Download PDF button
 *
 * Install for PDF:
 *   npm i html2canvas jspdf
 */
/* ================= BASE PATH HELPER ================= */
// ✅ must be TOP-LEVEL (not inside the component)
const BASE = import.meta.env.BASE_URL || "/";

function withBase(path) {
  const p = String(path || "").replace(/^\/+/, "");
  return `${BASE}${p}`;
}
const CARD_CM = { w: 10, h: 15 };

const DEFAULT_FONT = {
  family: `"Assistant", system-ui, sans-serif`,
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
  line_1: { x: 0.8, y: 3.5, w: 8.4, size: 42, weight: 800, align: "center" },
  line_2: { x: 0.8, y: 4.6, w: 8.4, size: 42, weight: 800, align: "center" },
  line_3: { x: 0.8, y: 5.6, w: 8.4, size: 42, weight: 800, align: "center" },

  english: { x: 0.8, y: 9.0, w: 8.4, size: 14, weight: 600, align: "center" },

  opt1: { x: 0.8, y: 10.9, w: 8.4, size: 15, weight: 700, align: "center" },
  opt2: { x: 0.8, y: 11.5, w: 8.4, size: 15, weight: 700, align: "center" },
  opt3: { x: 0.8, y: 12.1, w: 8.4, size: 15, weight: 700, align: "center" },

  a1: { x: 8.5, y: 10.7, w: 1.0, h: 1.0 },
  a2: { x: 8.5, y: 11.3, w: 1.0, h: 1.0 },
  a3: { x: 8.5, y: 11.9, w: 1.0, h: 1.0 },

  // ✅ PRICE GROUP: only x/y here (centered via flex, but you asked for X/Y control)
  price_group: { x: 0.0, y: 12.7 },

  // ✅ price parts styles (separate)
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

  // ensure group exists
  if (!out.price_group) out.price_group = { x: 0, y: 13.3, w: 0, h: 0 };

  return out;
}

async function ensurePdfLibs() {
  // lazy import to avoid breaking if user didn’t install yet
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  return { html2canvas, jsPDF };
}

export default function CardDemoModal({ open, row, onClose, backgroundUrl = "" }) {
  if (!open || !row) return null;

  const cardRef = useRef(null);

  const opt1 = (row.option_1_custom || row.option_1_preset || "").trim();
  const opt2 = (row.option_2_custom || row.option_2_preset || "").trim();
  const opt3 = (row.option_3_custom || row.option_3_preset || "").trim();

  // show icons ALWAYS (you said you still don’t see them). If the DB field is empty, we just dim them.
  const hasA1 = !!cleanSpaces(row.alergonim_1);
  const hasA2 = !!cleanSpaces(row.alergonim_2);
  const hasA3 = !!cleanSpaces(row.alergonim_3);

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

      { key: "a1", label: "icon_1", type: "image", value: ALERGEN_ICON_URLS.a1, dim: !hasA1 },
      { key: "a2", label: "icon_2", type: "image", value: ALERGEN_ICON_URLS.a2, dim: !hasA2 },
      { key: "a3", label: "icon_3", type: "image", value: ALERGEN_ICON_URLS.a3, dim: !hasA3 },

      { key: "price_group", label: "PRICE group", type: "group" },
      { key: "price_value", label: "price", type: "pricePart", value: priceValue },
      { key: "price_ils", label: "ש״ח", type: "pricePart", value: priceILS },
      { key: "price_unit", label: "unit", type: "pricePart", value: priceUnit },
    ];
  }, [row, opt1, opt2, opt3, hasA1, hasA2, hasA3, priceValue, priceUnit]);

  const fieldKeys = useMemo(() => fields.map((f) => f.key), [fields]);
  const defaultLayout = useMemo(() => buildDefaultLayout(fieldKeys), [fieldKeys.join("|")]);

  const [layout, setLayout] = useState(defaultLayout);

  // ✅ panel only opens via button
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null); // do not auto select
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLayout(defaultLayout);
    setPanelOpen(false);
    setSelectedKey(null);
    setDrag(null);
  }, [open, defaultLayout]);

  function updateKey(key, patch) {
    setLayout((prev) => {
      const next = { ...prev };
      next[key] = { ...(next[key] || {}), ...patch };
      return next;
    });
  }

  // overlay close
  const closeIfOverlay = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  // drag: allow free drag for all (you asked for X/Y control on frontend, so no locking)
  function onMouseDownField(e, key) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedKey(key); // select for panel values, BUT does not open panel

    const st = layout[key] || {};
    const startXcm = st.x ?? 0;
    const startYcm = st.y ?? 0;

    // price parts drag moves the whole group (more natural)
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

  // ===== Print & PDF =====
  function handlePrint() {
    window.print();
  }

  async function handleDownloadPdf() {
    try {
      const el = cardRef.current;
      if (!el) return;

      const { html2canvas, jsPDF } = await ensurePdfLibs();

      // render at higher scale for sharp PDF
      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");

      // 10cm x 15cm => 100mm x 150mm
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
    }
  }

  const selected = selectedKey ? layout[selectedKey] : null;
  const selectedField = selectedKey ? fields.find((f) => f.key === selectedKey) : null;

  const priceGroup = layout.price_group || { x: 0, y: 13.3 };
  const stP = layout.price_value || DEFAULT_LAYOUT_CM.price_value;
  const stS = layout.price_ils || DEFAULT_LAYOUT_CM.price_ils;
  const stU = layout.price_unit || DEFAULT_LAYOUT_CM.price_unit;

  return (
    <div
      className="dilenCardDemoOverlay"
      onMouseDown={closeIfOverlay}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <div className="dilenCardDemoModal" onMouseDown={(e) => e.stopPropagation()}>
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
            >
              ⚙ Layout
            </button>

            <button className="layoutBtn" type="button" onClick={handlePrint}>
              🖨 Print
            </button>

            <button className="layoutBtn" type="button" onClick={handleDownloadPdf}>
              ⬇️ PDF
            </button>

            <button className="dilenCardDemoCloseBtn" onClick={onClose} type="button">
              ✕
            </button>
          </div>
        </div>

        <div className={`dilenCardDemoBody ${panelOpen ? "panelOpen" : ""}`}>
          {/* ===== Controls (ONLY opens by button) ===== */}
          <aside className={`dilenCardDemoControls ${panelOpen ? "show" : "hide"}`}>
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

                {/* PRICE PART selected? show style only (X/Y are on group) */}
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
                  // normal text fields
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

                <div className="ctrlHint">
                  טיפ: אתה יכול לגרור על הכרטיס (Drag) בלי לפתוח את הבקרה.
                </div>
              </>
            )}
          </aside>

          {/* ===== Card ===== */}
          <div className="dilenCardDemoStage">
            <div
              ref={cardRef}
              className="dilenCardDemoCard"
              style={{
                width: `${CARD_CM.w}cm`,
                height: `${CARD_CM.h}cm`,
                backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "none",
                fontFamily: DEFAULT_FONT.family,
              }}
            >
              {/* Text blocks */}
              {["line_1", "line_2", "line_3", "opt1", "opt2", "opt3", "english"].map((k) => {
                const f = fields.find((x) => x.key === k);
                const st = layout[k];
                if (!f || !st) return null;

                return (
                  <div
                    key={k}
                    className={`cardField ${selectedKey === k ? "cardFieldSel" : ""}`}
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

              {/* Icons (always rendered; dim if row value is empty) */}
              {["a1", "a2", "a3"].map((k) => {
                const f = fields.find((x) => x.key === k);
                const st = layout[k];
                if (!f || !st) return null;

                return (
                  <img
                    key={k}
                    className={`cardFieldImg ${selectedKey === k ? "cardFieldSel" : ""}`}
                    src={f.value}
                    alt={k}
                    style={{
                      left: `${st.x}cm`,
                      top: `${st.y}cm`,
                      width: `${st.w}cm`,
                      height: `${st.h}cm`,
                      opacity: f.dim ? 0.25 : 1,
                      zIndex: 10,
                    }}
                    onMouseDown={(e) => onMouseDownField(e, k)}
                    onError={(e) => {
                      // ✅ hide the image silently if missing
                      e.currentTarget.style.display = "none";
                    }}
                    draggable={false}
                  />
                );
              })}

              {/* ✅ Price group (FIXED): centered by flex + allow X/Y offset by group */}
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

            <div className="dilenCardDemoHint">
              גודל הכרטיס:{" "}
              <b>
                {CARD_CM.w}cm × {CARD_CM.h}cm
              </b>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Print only the card */}
      <style>{`
        @media print{
          body * { visibility: hidden !important; }
          .printArea, .printArea * { visibility: visible !important; }
          .printArea { position: fixed; inset: 0; display: grid; place-items: center; }
          .dilenCardDemoCard{ box-shadow:none !important; border:0 !important; }
        }
      `}</style>

      <style>{`
        .dilenCardDemoOverlay{
          position:fixed; inset:0;
          background:rgba(0,0,0,0.35);
          display:grid; place-items:center;
          z-index:99999;
          padding:14px;
        }
        .dilenCardDemoModal{
          width:min(1120px, 98vw);
          background:#fff;
          border:1px solid #ddd;
          border-radius:14px;
          box-shadow:0 18px 50px rgba(0,0,0,0.25);
          overflow:hidden;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        }
        .dilenCardDemoTop{
          display:flex; align-items:center; justify-content:space-between;
          gap:10px;
          padding:10px 12px;
          border-bottom:1px solid #eee;
          background:#fafafa;
        }
        .dilenCardDemoTitle{ font-weight:900; }
        .topBtns{ display:flex; gap:10px; align-items:center; }

        .layoutBtn{
          border:1px solid #ddd;
          background:#fff;
          border-radius:10px;
          height:34px;
          padding:0 12px;
          cursor:pointer;
          font-weight:900;
        }
        .layoutBtn:hover{ background:#f3f3f3; }

        .dilenCardDemoCloseBtn{
          border:1px solid #ddd;
          background:#fff;
          border-radius:10px;
          height:34px; width:42px;
          cursor:pointer;
          font-weight:900;
        }

        .dilenCardDemoBody{
          display:grid;
          grid-template-columns: 0px 1fr; /* hidden */
          gap:12px;
          padding:12px;
          transition: grid-template-columns 260ms ease;
        }
        .dilenCardDemoBody.panelOpen{
          grid-template-columns: 360px 1fr;
        }

        .dilenCardDemoControls{
          border:1px solid #eee;
          border-radius:12px;
          padding:12px;
          background:#fff;
          overflow:hidden;
          transform: translateX(-12px);
          opacity:0;
          pointer-events:none;
          transition: transform 260ms ease, opacity 260ms ease;
        }
        .dilenCardDemoControls.show{
          transform: translateX(0);
          opacity:1;
          pointer-events:auto;
        }

        .ctrlTitle{ font-weight:900; font-size:14px; }
        .ctrlSubTitle{ font-weight:900; font-size:12px; margin-top:2px; }
        .ctrlDivider{ height:1px; background:#eee; margin:6px 0; }

        .ctrlRow{ display:flex; flex-direction:column; gap:6px; font-size:12px; font-weight:800; margin-top:8px; }

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
          font-weight:900;
        }
        .ctrlInp,.ctrlSel{
          height:34px;
          border:1px solid #ddd;
          border-radius:10px;
          padding:0 10px;
          font-size:13px;
          outline:none;
          background:#fff;
        }

        .ctrlBtn{
          margin-top:10px;
          height:36px;
          border-radius:10px;
          border:1px solid #0b63ff;
          background:#0b63ff;
          color:#fff;
          font-weight:900;
          cursor:pointer;
        }
        .ctrlBtn2{
          height:36px;
          border-radius:10px;
          border:1px solid #ddd;
          background:#fff;
          font-weight:900;
          cursor:pointer;
        }
        .ctrlHint{
          font-size:12px;
          opacity:0.8;
          line-height:1.35;
          margin-top:6px;
        }

        .dilenCardDemoStage{
          display:grid;
          gap:10px;
          justify-items:center;
          align-content:start;
        }

        /* Add printArea wrapper behavior */
        .dilenCardDemoStage{ position:relative; }
        .dilenCardDemoStage:before{ content:""; display:none; }
        .dilenCardDemoStage{ }
        .dilenCardDemoStage{ }
        .dilenCardDemoStage{ }

        .dilenCardDemoCard{
          border:1px solid #ccc;
          border-radius:12px;
          background-size:cover;
          background-position:center;
          background-repeat:no-repeat;
          position:relative;
          overflow:hidden;
          direction: rtl;
          background-color:#fff;
        }

        .cardField{
          position:absolute;
          cursor:grab;
          user-select:none;
          padding:2px 4px;
          border-radius:6px;
          line-height:1.15;
          white-space:pre-wrap;
          word-break:break-word;
          z-index: 5;
        }

        .cardFieldImg{
          position:absolute;
          cursor:grab;
          user-select:none;
          border-radius:6px;
          object-fit:contain;
          pointer-events:auto;
        }

        .cardFieldSel{
          outline:2px dashed #0b63ff;
          background: rgba(11,99,255,0.08);
        }

        .cardField:active,
        .cardFieldImg:active{ cursor:grabbing; }

        /* ✅ PRICE GROUP fixed layout */
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
          border-radius: 8px;
        }
        .pricePart{
          user-select:none;
          cursor:grab;
          white-space:nowrap;
          background: transparent;
        }

        .dilenCardDemoHint{
          font-size:12px;
          opacity:0.85;
          text-align:center;
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

      {/* Print wrapper: make card visible as print area */}
      <div className="printArea" style={{ display: "none" }} />
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
