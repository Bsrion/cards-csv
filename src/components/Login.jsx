import { useState } from "react";
import "./Login.css";

export default function Login({ onSuccess, fetchJson, dbEndpoint }) {
  const [user, setUser] = useState("1234");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function doLogin() {
    if (busy) return;
    setBusy(true);
    setErr("");

    try {
      const data = await fetchJson(dbEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username: user, password: pass }),
      });

      document.activeElement?.blur?.();
      requestAnimationFrame(() => document.activeElement?.blur?.());

      // IMPORTANT: your fetchJson returns { ok:true, token: "..." } typically
      onSuccess(data.token);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    doLogin();
  }

  return (
    <div className="loginScreen">
      <form className="loginCard" onSubmit={onSubmit}>
        <div className="loginHead">
          <h2 className="loginTitle">
            <span>כניסת מנהל</span>
          </h2>
          <img className="loginLogo" src={`${import.meta.env.BASE_URL}logo_pasha.png`} alt="logo" />
        </div>

        <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="username" />

        <input
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="password"
          type="password"
        />

        <button type="submit" disabled={busy}>
          {busy ? "..." : "Login"}
        </button>

        {err && <div className="loginErr">{err}</div>}
      </form>
    </div>
  );
}
