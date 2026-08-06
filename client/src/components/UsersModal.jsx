import React, { useEffect, useState } from 'react';
import { api, toast } from '../api.js';
import { can } from '../permissions.js';
import PasswordInput from './PasswordInput.jsx';

const ROLES = ['dock', 'purchase', 'admin'];

export function UsersModal({ me, onEditPerms, refreshMe, onClose }) {
  const canDelUsers = can(me, 'users', 'delete');
  const canEditUsers = can(me, 'users', 'add'); // same gate that creates users
  const [users, setUsers] = useState([]);
  const [nu, setNu] = useState({ username: '', full_name: '', password: '', role: 'dock' });
  const [editId, setEditId] = useState(null);
  const [ed, setEd] = useState(null);     // draft for the row being edited
  const [saving, setSaving] = useState(false);

  async function load() { try { setUsers(await api('/users')); } catch (e) { toast(e.message, 'err'); } }
  useEffect(() => { load(); }, []);

  async function add() {
    try { await api('/auth/register', { method: 'POST', body: nu }); toast('User added', 'info'); setNu({ username: '', full_name: '', password: '', role: 'dock' }); load(); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function remove(id) { try { await api('/users/' + id, { method: 'DELETE' }); load(); } catch (e) { toast(e.message, 'err'); } }

  function startEdit(u) {
    setEditId(u.id);
    setEd({ username: u.username, full_name: u.full_name || '', role: u.role, password: '' });
  }
  function cancelEdit() { setEditId(null); setEd(null); }

  // Send only what actually changed; a blank password is omitted entirely so
  // the existing one is left alone.
  async function saveEdit(u) {
    const body = {};
    if (ed.username.trim() !== u.username) body.username = ed.username.trim();
    if (ed.full_name.trim() !== (u.full_name || '')) body.full_name = ed.full_name.trim();
    if (ed.role !== u.role) body.role = ed.role;
    if (ed.password) body.password = ed.password;
    if (!Object.keys(body).length) { cancelEdit(); return; }
    setSaving(true);
    try {
      await api('/users/' + u.id, { method: 'PATCH', body });
      toast(body.password && Object.keys(body).length === 1 ? 'Password reset' : 'User updated', 'info');
      cancelEdit();
      await load();
      if (u.id === me.id && refreshMe) refreshMe();
    } catch (e) { toast(e.message, 'err'); }
    setSaving(false);
  }

  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal wide">
        <h3>Team members</h3>
        <table className="usertbl">
          <tbody>
            {users.map((u) => (
              <React.Fragment key={u.id}>
                <tr>
                  <td><b>{u.username}</b> {u.full_name}</td>
                  <td><span className="rolebadge">{u.role}</span>{u.custom && u.role !== 'admin' && <span className="perm-tag on" style={{ marginLeft: 6 }}>customised</span>}</td>
                  <td className="uacts">
                    {canEditUsers && <button className="btn sm" onClick={() => (editId === u.id ? cancelEdit() : startEdit(u))}>{editId === u.id ? 'Cancel' : '✎ Edit'}</button>}
                    {onEditPerms && u.role !== 'admin' && <button className="btn sm" onClick={() => onEditPerms(u.id)}>🔐 Permissions</button>}
                    {canDelUsers && u.id !== me.id && <button className="btn danger sm" onClick={() => remove(u.id)}>Remove</button>}
                  </td>
                </tr>
                {editId === u.id && ed && (
                  <tr className="uedit">
                    <td colSpan={3}>
                      <div className="row">
                        <input className="input" placeholder="username" value={ed.username} onChange={(e) => setEd({ ...ed, username: e.target.value })} />
                        <input className="input" placeholder="full name" value={ed.full_name} onChange={(e) => setEd({ ...ed, full_name: e.target.value })} />
                      </div>
                      <div className="row">
                        <PasswordInput placeholder="new password — blank to keep current" value={ed.password}
                          autoComplete="new-password" onChange={(e) => setEd({ ...ed, password: e.target.value })} />
                        <select className="input" value={ed.role} disabled={u.id === me.id}
                          title={u.id === me.id ? "You can't change your own role" : 'Role'}
                          onChange={(e) => setEd({ ...ed, role: e.target.value })}>
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="unote">Passwords are encrypted and can't be shown. Set a new one here and pass it to the user — use the eye to check what you typed.</div>
                      <div className="modal-actions">
                        <button className="btn ghost" onClick={cancelEdit}>Cancel</button>
                        <button className="btn go" disabled={saving} onClick={() => saveEdit(u)}>{saving ? 'Saving…' : 'Save changes'}</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <h3 style={{ fontSize: 15 }}>Add a user</h3>
        <div className="row"><input className="input" placeholder="username" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
          <input className="input" placeholder="full name" value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} /></div>
        <div className="row"><PasswordInput placeholder="password" value={nu.password} autoComplete="new-password" onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          <select className="input" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Close</button><button className="btn go" onClick={add}>Add user</button></div>
      </div>
    </div>
  );
}

export function PasswordModal({ onClose }) {
  const [cur, setCur] = useState(''); const [next, setNext] = useState('');
  async function save() { try { await api('/auth/password', { method: 'POST', body: { current: cur, next } }); toast('Password changed', 'info'); onClose(); } catch (e) { toast(e.message, 'err'); } }
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal">
        <h3>Change password</h3>
        <div className="row"><PasswordInput placeholder="current password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div className="row"><PasswordInput placeholder="new password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn go" onClick={save}>Save</button></div>
      </div>
    </div>
  );
}
