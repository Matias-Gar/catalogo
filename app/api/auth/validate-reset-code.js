// Legacy Pages-style handler retained as a safe tombstone. Not an App Router route.
export default function handler(req, res) {
  return res.status(410).json({ error: 'Usa el enlace de recuperacion de Auth.' });
}
