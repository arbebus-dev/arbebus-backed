function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  req.user = header.startsWith('Bearer ') ? { token: header.slice(7) } : null;
  next();
}

module.exports = { optionalAuth };
