import jwt from 'jsonwebtoken';
export const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '2d' });
// RBAC middleware: auth() = any logged user, auth(['admin']) = restricted
export const auth = (roles = []) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Connectez-vous pour continuer.' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: "Vous n'avez pas accès à cette action." });
  next();
};
export const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
