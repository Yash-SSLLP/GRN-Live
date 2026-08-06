const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authRequired } = require('../middleware/auth');
const { perm, effectivePerms, roleDefault, sanitize, AREAS } = require('../permissions');

const router = express.Router();
router.use(authRequired);

function shape(u) {
  return {
    id: u._id.toString(),
    username: u.username,
    full_name: u.fullName,
    role: u.role,
    created_at: u.createdAt,
    perms: effectivePerms(u),           // what this user can actually do now
    custom: !!u.perms && u.role !== 'admin', // has a per-user override vs pure role default
  };
}

router.get('/', perm('users', 'view'), async (req, res) => {
  const users = await User.find({}).sort({ createdAt: 1 }).lean();
  res.json(users.map(shape));
});

const MIN_PASSWORD = 8;
const ROLES = ['admin', 'purchase', 'dock'];

// Edit an existing user: rename, change role, or set a new password.
// Passwords are bcrypt hashes and cannot be read back, so there is no "show the
// old one" — an admin sets a fresh password and passes it to the user.
router.patch('/:id', perm('users', 'add'), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const { username, full_name, role: r, password } = req.body || {};
  const isSelf = req.params.id === req.user.id;
  const update = {};

  if (username !== undefined) {
    const u = String(username).trim();
    if (!u) return res.status(400).json({ error: 'Username cannot be empty.' });
    if (u !== user.username) {
      const taken = await User.findOne({ username: u, _id: { $ne: user._id } });
      if (taken) return res.status(409).json({ error: 'That username is taken.' });
      update.username = u;
    }
  }
  if (full_name !== undefined) update.fullName = String(full_name).trim();

  if (r !== undefined && r !== user.role) {
    if (!ROLES.includes(r)) return res.status(400).json({ error: 'Invalid role.' });
    // Changing your own role can only end badly — you could lock yourself out
    // mid-request. Same reasoning as the self-delete guard below.
    if (isSelf) return res.status(400).json({ error: "You can't change your own role." });
    // Never let the last admin be demoted, or nobody can administer the app.
    if (user.role === 'admin') {
      const admins = await User.countDocuments({ role: 'admin' });
      if (admins <= 1) return res.status(400).json({ error: 'This is the only admin — promote someone else first.' });
    }
    update.role = r;
  }

  if (password !== undefined && password !== '') {
    if (String(password).length < MIN_PASSWORD) return res.status(400).json({ error: `Password too short (min ${MIN_PASSWORD} characters).` });
    update.passwordHash = await bcrypt.hash(String(password), 10);
  }

  const ops = Object.keys(update).length ? { $set: update } : {};
  // Admins are never permission-limited (see the perms route below), so drop any
  // stale per-user override when someone is promoted.
  if (update.role === 'admin') ops.$unset = { perms: 1 };
  if (Object.keys(ops).length) await User.updateOne({ _id: user._id }, ops);

  const fresh = await User.findById(user._id).lean();
  res.json(shape(fresh));
});

// Set (or reset) a user's per-user permission override. Admin-level action.
router.patch('/:id/perms', perm('users', 'add'), async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Admins always have full access; their permissions cannot be limited.' });

  const { reset } = req.body || {};
  let update;
  if (reset) {
    update = { $unset: { perms: 1 } };
  } else {
    const clean = sanitize((req.body || {}).perms);
    // Store only the areas that differ from the role default, so a user tracks
    // their role's baseline for any area left untouched. If nothing differs,
    // drop the override entirely so the user is back on pure role defaults.
    const base = roleDefault(user.role);
    const override = {};
    let any = false;
    for (const a of AREAS) {
      if (clean[a] !== undefined && clean[a] !== base[a]) { override[a] = clean[a]; any = true; }
    }
    update = any ? { $set: { perms: override } } : { $unset: { perms: 1 } };
  }
  await User.updateOne({ _id: user._id }, update);
  const fresh = await User.findById(user._id).lean();
  res.json(shape(fresh));
});

router.delete('/:id', perm('users', 'delete'), async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete your own account." });
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
