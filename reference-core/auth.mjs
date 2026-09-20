import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const N=32768,r=8,p=3,maxmem=64*1024*1024;
export function validatePassword(password) {
  if(typeof password!=='string' || password.length<12 || password.length>128) throw new Error('Password must contain between 12 and 128 characters.');
}
export async function hashPassword(password) {
  validatePassword(password);
  const salt=randomBytes(16).toString('hex');
  const key=await scrypt(password,salt,64,{N,r,p,maxmem});
  return `scrypt$${N}$${r}$${p}$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password,stored) {
  if(typeof password!=='string' || password.length>128 || typeof stored!=='string') return false;
  const parts=stored.split('$');
  if(parts.length!==6 || parts[0]!=='scrypt' || parts[1]!==String(N) || parts[2]!==String(r) || parts[3]!==String(p) || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
  const expected=Buffer.from(parts[5],'hex');
  const actual=await scrypt(password,parts[4],64,{N,r,p,maxmem});
  return timingSafeEqual(actual,expected);
}
export function newSessionToken(){return randomBytes(32).toString('hex');}
export function hashSessionToken(token){return createHash('sha256').update(token).digest('hex');}
export function generateLocalPasscode(){return randomBytes(24).toString('base64url');}
