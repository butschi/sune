#!/usr/bin/env node
// Alg data tests, run with: node test/algs.test.js
//
// Ground truth is the app's own cube engine (public/cube.js). Verified invariants:
//  1. every algorithm parses — no unknown move tokens
//  2. every OLL/PLL/EO algorithm's case state leaves F2L intact (a truncated or
//     mistyped last-layer alg breaks this immediately)
//  3. all-pairs starring: any alg of a case can be starred, and every other alg
//     of that case must then solve from the starred position with at most an AUF
//     prefix — the Learn modal relies on this to display adjusted algs
//  4. cross-case uniqueness: no alg solves a different case of its set (catches
//     algs filed under the wrong case)
const fs = require('fs');
const path = require('path');

global.window = {};
const pub = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const parseWarnings = [];
const origWarn = console.warn;
console.warn = (...a) => parseWarnings.push(a.join(' '));
eval(pub('cube.js'));
eval(pub('algs.js'));
eval(pub('f2l.js'));

const C = window.CUBE, A = window.ALGS;
const AUF = ['', 'U', 'U2', "U'"];
let fails = 0, checks = 0;
const fail = m => { fails++; console.error('FAIL ' + m); };

const solvesWithAuf = (kind, base, alg) =>
  AUF.some(u => C.caseSolved(kind, C.apply(base, u ? u + ' ' + alg : alg)));

const suites = [
  { kind: 'oll',  cases: A.oll.map(o => ({ id: 'OLL ' + o.n, algs: o.algs })) },
  { kind: 'pll',  cases: A.pll.map(p => ({ id: 'PLL ' + p.id, algs: p.algs })) },
  { kind: 'oll2', cases: A.oll2.edges.map(e => ({ id: 'EO ' + e.id, algs: e.algs })) },
  { kind: 'f2l',  cases: window.F2L.map(c => ({ id: c.id, algs: c.algs })) },
];

suites.forEach(su => {
  su.cases.forEach(c => {
    c.algs.forEach((alg, i) => {
      // 1. parses (warnings are collected globally, asserted at the end)
      checks++; C.parseAlg(alg).forEach(t => C.applyToken(C.solved(), t));
      // 2. last-layer algs must not touch F2L: their case state has F2L solved
      if (su.kind !== 'f2l') {
        checks++;
        if (!C.f2lIntact(C.caseState(alg)))
          fail(c.id + ' alg[' + i + '] disturbs F2L: ' + alg);
      }
    });
    // 3. all-pairs starring
    for (let p = 0; p < c.algs.length; p++) {
      const base = C.caseState(c.algs[p]);
      for (let i = 0; i < c.algs.length; i++) {
        if (p === i) continue;
        checks++;
        if (!solvesWithAuf(su.kind, base, c.algs[i]))
          fail(c.id + ': alg[' + i + '] "' + c.algs[i] + '" has no AUF adjustment from starred alg[' + p + '] "' + c.algs[p] + '"');
      }
    }
  });
  // 4. cross-case uniqueness within a set
  if (su.kind === 'f2l') return; // F2L states are per-slot setups, not a closed set
  su.cases.forEach(c => {
    const base = C.caseState(c.algs[0]);
    su.cases.forEach(d => {
      if (d === c) return;
      d.algs.forEach((alg, i) => {
        checks++;
        if (solvesWithAuf(su.kind, base, alg))
          fail(d.id + ' alg[' + i + '] also solves ' + c.id + ': ' + alg);
      });
    });
  });
});

console.warn = origWarn;
if (parseWarnings.length) fail('unparseable moves: ' + parseWarnings.join('; '));

if (fails) { console.error('\n' + fails + ' failure(s), ' + checks + ' checks'); process.exit(1); }
console.log('OK — ' + checks + ' checks passed');
