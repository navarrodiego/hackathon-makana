import assert from 'node:assert/strict';
import { test } from 'node:test';
import { basicPageAccess, type AuthConfig } from '../../src/lib/server/auth/service';

const basic = (u: string, s: string) => 'Basic ' + Buffer.from(`${u}:${s}`).toString('base64');
const RODRIGO = basic('rodrigo', 'secreto-rodrigo'), CONTROL = basic('control', 'secreto-control');
const CONFIG: AuthConfig = {
  outgoing: { username: 'rodrigo', secret: 'secreto-rodrigo' },
  control: { username: 'control', secret: 'secreto-control' },
  appOrigin: 'https://relevo.example',
};

test('página de control: solo la credencial de control pasa; cualquier otra recibe desafío', () => {
  assert.equal(basicPageAccess('read_control', CONTROL, CONFIG), 'pass');
  for (const header of [null, RODRIGO, basic('control', 'otra'), basic('x', 'y'), 'Basic ???', 'Bearer abc']) {
    assert.equal(basicPageAccess('read_control', header, CONFIG), 'challenge', String(header));
  }
});

test('página de Rodrigo: pasan Rodrigo y control (mismos roles que read_outgoing); el resto recibe desafío', () => {
  assert.equal(basicPageAccess('read_outgoing', RODRIGO, CONFIG), 'pass');
  assert.equal(basicPageAccess('read_outgoing', CONTROL, CONFIG), 'pass');
  for (const header of [null, basic('rodrigo', 'otra'), basic('x', 'y'), '']) {
    assert.equal(basicPageAccess('read_outgoing', header, CONFIG), 'challenge', String(header));
  }
});

test('rol desactivado por configuración: ninguna credencial pasa', () => {
  const off: AuthConfig = { outgoing: undefined, control: undefined, appOrigin: undefined };
  assert.equal(basicPageAccess('read_control', CONTROL, off), 'challenge');
  assert.equal(basicPageAccess('read_outgoing', RODRIGO, off), 'challenge');
});
