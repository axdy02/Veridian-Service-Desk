import {readFileSync} from 'node:fs';import {inferOffline,decide} from './engine.mjs';
const load=n=>JSON.parse(readFileSync(new URL('../data/'+n,import.meta.url),'utf8'));
console.table([...load('requests.json'),...load('tickets.json')].map(c=>{const r=decide(c,inferOffline(c.text));return {id:c.id,category:r.category,decision:r.disposition,reason:r.reasonCode,route:r.route??'-'};}));
