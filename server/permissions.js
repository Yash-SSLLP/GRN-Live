// Role-based permissions. For each area a role has a level:
//   0 none · 1 view · 2 edit · 3 add-delete   (add-delete ⊇ edit ⊇ view)
// Admin is always full and cannot be locked out. Change a role's access by
// editing MATRIX below (and the mirrored copy in client/src/permissions.js).
const AREAS = ['grn', 'reports', 'items', 'racks', 'vendors', 'users'];
const LEVEL = { view: 1, edit: 2, add: 3 };
const FULL = { grn: 3, reports: 1, items: 3, racks: 3, vendors: 3, users: 3 };

// grn levels: 1 view · 2 edit (receive goods, import, edit header/lines) ·
// 3 add-delete (create GRN, close/reopen it, delete GRN and lines). Dock receives
// (edit); purchase reviews/closes/deletes (add-delete) — mirrors the README roles.
const MATRIX = {
  purchase: { grn: 3, reports: 1, items: 3, racks: 3, vendors: 3, users: 0 },
  dock:     { grn: 2, reports: 1, items: 1, racks: 1, vendors: 1, users: 0 },
};

function permsFor(role) { return role === 'admin' ? { ...FULL } : (MATRIX[role] || {}); }
function need(level) { return typeof level === 'number' ? level : (LEVEL[level] || 1); }
function can(role, area, level) { return (permsFor(role)[area] || 0) >= need(level); }

// Express middleware: block the request unless the user's role has the level.
function perm(area, level) {
  return (req, res, next) => (req.user && can(req.user.role, area, level))
    ? next()
    : res.status(403).json({ error: 'You do not have permission for this.' });
}

module.exports = { AREAS, LEVEL, FULL, MATRIX, permsFor, can, perm };
