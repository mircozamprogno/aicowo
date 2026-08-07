// src/pages/MikroTikTest.jsx
// Admin-only test panel for the MikroTik REST integration.
// Calls go through /api/mikrotik/<path> → on-router agent → RouterOS /rest/<path>.

import { Activity, Eye, EyeOff, Play, Router as RouterIcon, Send, Trash2, RefreshCw, Wand2, Wifi } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/pages/mikrotik-test.css';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const REST_PRESETS = [
  { label: 'Router info', method: 'GET', path: '/system/resource' },
  { label: 'Identity', method: 'GET', path: '/system/identity' },
  { label: 'List interfaces', method: 'GET', path: '/interface' },
  { label: 'WiFi users', method: 'GET', path: '/user-manager/user' },
  { label: 'UM sessions', method: 'GET', path: '/user-manager/session' },
  { label: 'UM profiles', method: 'GET', path: '/user-manager/profile' },
];

const randomPassword = (length = 12) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const arr = new Uint32Array(length);
    cryptoObj.getRandomValues(arr);
    for (let i = 0; i < length; i += 1) out += alphabet[arr[i] % alphabet.length];
  } else {
    for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
};

const callMikrotik = async (method, path, body) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `/api/mikrotik${cleanPath}`;
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (!['GET', 'HEAD', 'DELETE'].includes(method) && body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const started = performance.now();
  let status = 0;
  let data = null;
  let error = null;
  try {
    const res = await fetch(url, init);
    status = res.status;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  } catch (err) {
    error = err.message || String(err);
  }
  const durationMs = Math.round(performance.now() - started);
  return { status, data, error, durationMs, url, method };
};

const StatusPill = ({ status, error }) => {
  if (error) return <span className="mtk-status err">Network error</span>;
  if (status === 0) return <span className="mtk-status warn">—</span>;
  const cls = status >= 200 && status < 300 ? 'ok' : status >= 500 ? 'err' : 'warn';
  return <span className={`mtk-status ${cls}`}>{status}</span>;
};

const ResponseView = ({ result }) => {
  if (!result) return null;
  const pretty = result.error
    ? result.error
    : typeof result.data === 'string'
      ? result.data
      : JSON.stringify(result.data, null, 2);
  return (
    <div className="mtk-response">
      <div className="mtk-response-header">
        <div>
          <StatusPill status={result.status} error={result.error} />
          <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
            {result.method} {result.url} · {result.durationMs} ms
          </span>
        </div>
      </div>
      <pre>{pretty || '(empty response)'}</pre>
    </div>
  );
};

const GenericTester = ({ onResult }) => {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/system/resource');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const send = useCallback(async () => {
    setBusy(true);
    let parsedBody;
    if (!['GET', 'HEAD', 'DELETE'].includes(method) && body.trim()) {
      try {
        parsedBody = JSON.parse(body);
      } catch (err) {
        setResult({
          status: 0, error: `Invalid JSON body: ${err.message}`, data: null,
          durationMs: 0, url: `/api/mikrotik${path}`, method,
        });
        setBusy(false);
        return;
      }
    }
    const res = await callMikrotik(method, path, parsedBody);
    setResult(res);
    onResult(res);
    setBusy(false);
  }, [method, path, body, onResult]);

  const applyPreset = (preset) => {
    setMethod(preset.method);
    setPath(preset.path);
    if (['GET', 'HEAD', 'DELETE'].includes(preset.method)) setBody('');
  };

  return (
    <div className="mtk-card">
      <h2><Send size={16} /> Generic REST tester</h2>
      <p className="mtk-subtitle">
        Any path is forwarded verbatim to <code>/rest/…</code> on the router.
      </p>

      <div className="mtk-presets">
        {REST_PRESETS.map((preset) => (
          <button
            key={`${preset.method}-${preset.path}`}
            type="button"
            className="mtk-btn"
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mtk-row">
        <select className="mtk-select" style={{ maxWidth: 120 }} value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          className="mtk-input"
          style={{ flex: 1, minWidth: 220 }}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/user-manager/user"
        />
        <button type="button" className="mtk-btn mtk-btn-primary" onClick={send} disabled={busy || !path.trim()}>
          <Play size={14} /> {busy ? 'Sending…' : 'Send'}
        </button>
      </div>

      {!['GET', 'HEAD', 'DELETE'].includes(method) && (
        <div className="mtk-field" style={{ marginTop: '0.75rem' }}>
          <label>JSON body</label>
          <textarea
            className="mtk-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{"name":"alice","password":"…","group":"IGY","shared-users":"5"}'
          />
        </div>
      )}

      <ResponseView result={result} />
    </div>
  );
};

const WifiUsersPanel = ({ onResult }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [revealPasswords, setRevealPasswords] = useState(false);

  const [form, setForm] = useState({
    name: '',
    password: randomPassword(),
    group: 'IGY',
    sharedUsers: '5',
    attributes: '',
    disabled: false,
  });
  const [rawMode, setRawMode] = useState(false);
  const [rawBody, setRawBody] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  const [deleteId, setDeleteId] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await callMikrotik('GET', '/user-manager/user');
    onResult(res);
    if (res.error || res.status >= 400) {
      setError(res.error || `HTTP ${res.status}`);
      setRows([]);
    } else {
      setRows(Array.isArray(res.data) ? res.data : []);
    }
    setLoading(false);
  }, [onResult]);

  useEffect(() => { refresh(); }, [refresh]);

  const groups = useMemo(() => {
    const set = new Set(rows.map((r) => r.group).filter(Boolean));
    if (!set.has('IGY')) set.add('IGY');
    return Array.from(set);
  }, [rows]);

  const buildBodyFromForm = () => ({
    name: form.name,
    password: form.password,
    group: form.group || 'IGY',
    'shared-users': form.sharedUsers || '5',
    ...(form.attributes ? { attributes: form.attributes } : {}),
    ...(form.disabled ? { disabled: 'true' } : {}),
  });

  const openRawFromForm = () => {
    setRawBody(JSON.stringify(buildBodyFromForm(), null, 2));
    setRawMode(true);
  };

  const create = async () => {
    setCreateBusy(true);
    let body;
    if (rawMode) {
      try { body = JSON.parse(rawBody); }
      catch (err) {
        setCreateResult({
          status: 0, error: `Invalid JSON: ${err.message}`, data: null,
          durationMs: 0, url: '/api/mikrotik/user-manager/user', method: 'POST',
        });
        setCreateBusy(false);
        return;
      }
    } else {
      body = buildBodyFromForm();
    }
    // RouterOS v7 REST: PUT creates a resource; POST is reserved for command endpoints (/add, /enable, …).
    const res = await callMikrotik('PUT', '/user-manager/user', body);
    setCreateResult(res);
    onResult(res);
    setCreateBusy(false);
    if (!res.error && res.status < 400) refresh();
  };

  const remove = async () => {
    if (!deleteId.trim()) return;
    setDeleteBusy(true);
    const encoded = encodeURIComponent(deleteId.trim());
    const res = await callMikrotik('DELETE', `/user-manager/user/${encoded}`);
    setDeleteResult(res);
    onResult(res);
    setDeleteBusy(false);
    if (!res.error && res.status < 400) refresh();
  };

  const suggestAttributes = () => {
    if (form.name.trim()) {
      setForm({ ...form, attributes: `Mikrotik-Wireless-Comment:${form.name.trim()}` });
    }
  };

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) =>
      [r.name, r.group, r.attributes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, filter]);

  return (
    <div className="mtk-card">
      <h2><Wifi size={16} /> WiFi Users (User Manager)</h2>
      <p className="mtk-subtitle">
        Uses <code>/user-manager/user</code> — the WPA2-EAP credentials your clients use to log into WiFi.
        <code> name</code> is the unique key.
      </p>

      {/* LIST */}
      <div className="mtk-row" style={{ justifyContent: 'space-between' }}>
        <div className="mtk-row">
          <input
            className="mtk-input"
            style={{ maxWidth: 260 }}
            placeholder="Filter by name, group, attributes…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <label className="mtk-inline-check">
            <input
              type="checkbox"
              checked={revealPasswords}
              onChange={(e) => setRevealPasswords(e.target.checked)}
            />
            {revealPasswords ? <EyeOff size={14} /> : <Eye size={14} />} Reveal passwords
          </label>
        </div>
        <button type="button" className="mtk-btn" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mtk-notice" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca', marginTop: '0.5rem' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
        <table className="mtk-table">
          <thead>
            <tr>
              <th>.id</th>
              <th>Name</th>
              <th>Group</th>
              <th>Shared</th>
              <th>Password</th>
              <th>Disabled</th>
              <th>Attributes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="mtk-empty">{loading ? 'Loading…' : 'No WiFi users.'}</td></tr>
            ) : filtered.map((row) => (
              <tr key={row['.id'] || row.name}>
                <td className="mtk-mono">{row['.id']}</td>
                <td>{row.name}</td>
                <td>{row.group}</td>
                <td>{row['shared-users']}</td>
                <td className="mtk-mono">
                  {revealPasswords ? (row.password || '') : (row.password ? '••••••••' : '')}
                </td>
                <td>{row.disabled === 'true' ? 'yes' : 'no'}</td>
                <td style={{ maxWidth: 220, wordBreak: 'break-word' }}>{row.attributes || ''}</td>
                <td>
                  <button
                    type="button"
                    className="mtk-btn mtk-btn-ghost"
                    onClick={() => setDeleteId(row['.id'] || '')}
                    title="Copy .id to delete field"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE */}
      <h2 style={{ marginTop: '1.25rem' }}><Wand2 size={16} /> Create WiFi user</h2>

      <div className="mtk-row" style={{ marginBottom: '0.5rem' }}>
        <label className="mtk-inline-check">
          <input
            type="checkbox"
            checked={rawMode}
            onChange={(e) => setRawMode(e.target.checked)}
          />
          Send raw JSON instead of form
        </label>
        {!rawMode && (
          <button type="button" className="mtk-btn mtk-btn-ghost" onClick={openRawFromForm}>
            Copy form → raw JSON
          </button>
        )}
      </div>

      {rawMode ? (
        <textarea
          className="mtk-textarea"
          value={rawBody}
          onChange={(e) => setRawBody(e.target.value)}
          placeholder='{"name":"alice","password":"…","group":"IGY","shared-users":"5"}'
        />
      ) : (
        <div className="mtk-grid-2">
          <div className="mtk-field">
            <label>name (unique — client's login)</label>
            <input
              className="mtk-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="alice"
            />
          </div>

          <div className="mtk-field">
            <label>password</label>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <input
                className="mtk-input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                className="mtk-btn"
                title="Generate a new password"
                onClick={() => setForm({ ...form, password: randomPassword() })}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="mtk-field">
            <label>group</label>
            <select
              className="mtk-select"
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
            >
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="mtk-field">
            <label>shared-users (max concurrent devices, or "unlimited")</label>
            <input
              className="mtk-input"
              value={form.sharedUsers}
              onChange={(e) => setForm({ ...form, sharedUsers: e.target.value })}
              placeholder="5"
            />
          </div>

          <div className="mtk-field" style={{ gridColumn: '1 / -1' }}>
            <label>attributes (RADIUS attributes / free-form comment)</label>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <input
                className="mtk-input"
                value={form.attributes}
                onChange={(e) => setForm({ ...form, attributes: e.target.value })}
                placeholder="Mikrotik-Wireless-Comment:alice"
              />
              <button
                type="button"
                className="mtk-btn"
                title="Prefill with Mikrotik-Wireless-Comment:<name>"
                onClick={suggestAttributes}
                disabled={!form.name.trim()}
              >
                Suggest
              </button>
            </div>
          </div>

          <div className="mtk-field">
            <label className="mtk-inline-check">
              <input
                type="checkbox"
                checked={form.disabled}
                onChange={(e) => setForm({ ...form, disabled: e.target.checked })}
              />
              Create as disabled
            </label>
          </div>
        </div>
      )}

      <div className="mtk-actions">
        <button
          type="button"
          className="mtk-btn mtk-btn-primary"
          onClick={create}
          disabled={createBusy || (!rawMode && !form.name.trim())}
        >
          <Play size={14} /> {createBusy ? 'Creating…' : 'PUT /user-manager/user'}
        </button>
      </div>

      <ResponseView result={createResult} />

      {/* DELETE */}
      <h2 style={{ marginTop: '1.25rem' }}><Trash2 size={16} /> Delete WiFi user</h2>
      <div className="mtk-row">
        <input
          className="mtk-input"
          style={{ flex: 1, minWidth: 220 }}
          value={deleteId}
          onChange={(e) => setDeleteId(e.target.value)}
          placeholder="*A1 (paste .id from the list above, or click the trash icon)"
        />
        <button
          type="button"
          className="mtk-btn mtk-btn-danger"
          onClick={remove}
          disabled={deleteBusy || !deleteId.trim()}
        >
          <Trash2 size={14} /> {deleteBusy ? 'Deleting…' : 'DELETE'}
        </button>
      </div>

      <ResponseView result={deleteResult} />
    </div>
  );
};

const UtilitiesPanel = ({ onResult }) => {
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (method, path) => {
    setBusy(true);
    const res = await callMikrotik(method, path);
    setResult(res);
    onResult(res);
    setBusy(false);
  };

  return (
    <div className="mtk-card">
      <h2 style={{ cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <Activity size={16} /> Bonus utilities {expanded ? '▾' : '▸'}
      </h2>
      {expanded && (
        <>
          <p className="mtk-subtitle">Quick diagnostics — useful for smoke tests.</p>
          <div className="mtk-presets">
            <button className="mtk-btn" onClick={() => run('GET', '/system/resource')} disabled={busy}>system/resource</button>
            <button className="mtk-btn" onClick={() => run('GET', '/system/identity')} disabled={busy}>system/identity</button>
            <button className="mtk-btn" onClick={() => run('GET', '/interface')} disabled={busy}>interface</button>
            <button className="mtk-btn" onClick={() => run('GET', '/user-manager/session')} disabled={busy}>user-manager/session</button>
            <button className="mtk-btn" onClick={() => run('GET', '/user-manager/router')} disabled={busy}>user-manager/router</button>
            <button className="mtk-btn" onClick={() => run('GET', '/user-manager/profile')} disabled={busy}>user-manager/profile</button>
          </div>
          <ResponseView result={result} />
        </>
      )}
    </div>
  );
};

const HistoryPanel = ({ history }) => (
  <div className="mtk-card">
    <h2><Activity size={16} /> Recent calls</h2>
    {history.length === 0 ? (
      <div className="mtk-empty">Nothing sent yet.</div>
    ) : (
      history.map((h, i) => (
        <div className="mtk-history-item" key={i}>
          <span className={`mtk-method-badge ${h.method.toLowerCase()}`}>{h.method}</span>
          <StatusPill status={h.status} error={h.error} />
          <span className="mtk-mono" style={{ flex: 1 }}>{h.url}</span>
          <span>{h.durationMs} ms</span>
        </div>
      ))
    )}
  </div>
);

const MikroTikTest = () => {
  const { profile } = useAuth();
  const [history, setHistory] = useState([]);

  const pushHistory = useCallback((res) => {
    setHistory((prev) => [{ ...res, at: Date.now() }, ...prev].slice(0, 10));
  }, []);

  if (profile?.role !== 'admin') {
    return (
      <div className="mtk-page">
        <div className="mtk-unauth">
          <RouterIcon size={40} style={{ margin: '0 auto 0.5rem', display: 'block', color: '#9ca3af' }} />
          <h2>Admin only</h2>
          <p>This test panel is restricted to partner administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mtk-page">
      <div className="mtk-header">
        <h1><RouterIcon size={22} style={{ verticalAlign: '-4px', marginRight: '0.5rem' }} />MikroTik REST test panel</h1>
        <p>Direct playground for the on-router agent. Nothing here is persisted in the app.</p>
      </div>

      <WifiUsersPanel onResult={pushHistory} />
      <GenericTester onResult={pushHistory} />
      <UtilitiesPanel onResult={pushHistory} />
      <HistoryPanel history={history} />
    </div>
  );
};

export default MikroTikTest;
