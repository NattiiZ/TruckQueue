import crypto from 'node:crypto';


/** Send async function to error handler */
export const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/** Convert number to string with only digits */
export const digits = (s) => String(s ?? '').replace(/\D/g, '');

/** Clean space from string */
export const clean = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

/** Generate new token for Driver queue */
export const newToken = () => crypto.randomBytes(16).toString('hex');

/** Compare two tokens (for security) */
export const sameToken = (a, b) => 
  {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
