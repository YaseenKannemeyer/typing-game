const assert=require('node:assert/strict');require('./vehicles.js');const K=globalThis.VehicleKit;
assert.equal(K.models.length,15);assert.equal(new Set(K.models.map(m=>m.body)).size,15);
assert.equal(K.normalize({progress:9}).progress,1);assert.equal(K.normalize({progress:-2}).progress,0);
assert.equal(K.normalize({primary:'red;bad',model:'invalid'}).primary,'#ff683b');
assert.equal(K.normalize({number:999}).number,99);
assert.ok(!K.svg({playerName:'<script>alert(1)</script>'}).includes('<script>'));
for(const m of K.models)for(const state of K.states)for(const wheels of ['sport','aero','retro']){const s=K.svg({model:m.id,animation:state,wheels});assert.ok(s.includes('viewBox="0 0 280 140"'));assert.ok(!s.includes('undefined'));assert.ok(s.includes(`data-state="${state}"`));}
console.log('PASS: 360 model/state/wheel combinations, distinct geometry, safe inputs and progress boundaries.');
