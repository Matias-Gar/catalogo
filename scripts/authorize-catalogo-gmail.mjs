// Local OAuth bootstrap only. Does not send email or modify Dell/production.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateDir = path.join(root, '.audit-access', 'gmail-oauth');
const output = path.join(privateDir, 'tokens.json');
const renew = process.argv.includes('--renew');
const previous = fs.existsSync(output) ? fs.readFileSync(output) : null;
const client = JSON.parse(fs.readFileSync(path.join(privateDir, 'client.json'), 'utf8')).installed;
if (!client?.client_id || !client?.client_secret) throw Error('Se necesita un cliente OAuth de escritorio.');
if (previous && !renew) throw Error('Ya existe una autorizacion; usa -Renew para renovarla conservando una copia anterior.');
const scope = 'https://www.googleapis.com/auth/gmail.send';
const state = crypto.randomBytes(32).toString('base64url');
const verifier = crypto.randomBytes(48).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
let busy = false;
let expiry;
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const callback = new URL(req.url, redirect);
  if (req.method !== 'GET' || callback.pathname !== '/oauth2callback') {
    res.writeHead(404).end('Ruta no disponible.'); return;
  }
  const received = Buffer.from(callback.searchParams.get('state') || '');
  const expected = Buffer.from(state);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    res.writeHead(400).end('Solicitud no valida.'); return;
  }
  if (busy) { res.writeHead(409).end('Autorizacion en curso.'); return; }
  busy = true;
  try {
    if (callback.searchParams.has('error') || !callback.searchParams.get('code')) {
      throw Error('Google no concedio la autorizacion.');
    }
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret,
        code: callback.searchParams.get('code'), code_verifier: verifier,
        redirect_uri: redirect, grant_type: 'authorization_code' }),
    });
    if (!response.ok) throw Error('No se pudo completar la autorizacion con Google.');
    const tokens = await response.json();
    if (!tokens.refresh_token || !tokens.access_token || !tokens.scope?.split(' ').includes(scope)) {
      throw Error('Falta el permiso de enviar correo o la autorizacion sin conexion.');
    }
    // Parent directory ACL is restricted to the current Windows user by the launcher.
    const saved = JSON.stringify({ ...tokens, obtained_at: new Date().toISOString() });
    if (previous) {
      if (!fs.readFileSync(output).equals(previous)) throw Error('Existing authorization changed');
      const suffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
      fs.copyFileSync(output, path.join(privateDir, 'tokens-before-' + suffix + '.json'), fs.constants.COPYFILE_EXCL);
      const temporary = path.join(privateDir, 'tokens-new-' + suffix + '.json');
      fs.writeFileSync(temporary, saved, { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, output);
    } else {
      fs.writeFileSync(output, saved, { flag: 'wx', mode: 0o600 });
    }
    res.end('Autorizacion guardada. Puedes cerrar esta ventana y volver al chat. No se envio ningun correo.');
    console.log('AUTORIZACION GUARDADA. No se envio correo ni se modifico produccion.');
  } catch (error) {
    // Never log callback URLs, codes, token responses, or credentials.
    res.writeHead(400).end('No se completo la autorizacion. Vuelve a la terminal.');
    console.error(error instanceof TypeError ? 'Fallo de conexion con Google.' :
      ['Google no concedio la autorizacion.', 'No se pudo completar la autorizacion con Google.',
        'Falta el permiso de enviar correo o la autorizacion sin conexion.'].includes(error.message)
        ? error.message : 'No se pudo guardar la autorizacion privada.');
    process.exitCode = 1;
  } finally {
    clearTimeout(expiry);
    server.close();
  }
});
let redirect;
server.listen(0, '127.0.0.1', () => {
  redirect = `http://127.0.0.1:${server.address().port}/oauth2callback`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect,
    response_type: 'code', scope, state, code_challenge: challenge,
    code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent',
    login_hint: 'garblac01@gmail.com', include_granted_scopes: 'false' }).toString();
  console.log('Abre este enlace en el navegador DE ESTE EQUIPO y selecciona garblac01@gmail.com:');
  console.log(auth.toString());
  console.log('La autorizacion vence en 15 minutos. No compartas el enlace ni el codigo de retorno.');
  expiry = setTimeout(() => { console.error('Tiempo agotado. Puedes volver a ejecutar el programa.');
    server.close(); process.exitCode = 1; }, 15 * 60 * 1000);
});
server.on('error', () => { console.error('No se pudo abrir la conexion local de autorizacion.'); process.exitCode = 1; });
