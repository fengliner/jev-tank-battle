// Run: node tests/smoke.cjs [original-index.html]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sources = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)]
  .map(([, file]) => [file, fs.readFileSync(path.join(root, file), 'utf8')]);
assert.equal(sources.length, 9);
const inspect = `() => JSON.stringify({W,H,p,a,over,playerScore,aiScore,AI,walls,bullets,particles,
  jevTimer,tacticalTimer,pathTimer,uiTimer,jevInFlight,jevFailures,jevRetryAt,frameErrors,keys:[...keys]})`;

function boot(baseline, response) {
  let now = 0, seed = 42, frame;
  const errors = [], requests = [], elements = new Map();
  function element() {
    const events = new Map(), classes = new Set();
    return {
      textContent: '', innerHTML: '', style: {}, children: [], dataset: {},
      classList: { add: v => classes.add(v), remove: v => classes.delete(v) },
      addEventListener(name, fn) { events.set(name, fn); },
      emit(name, code) { events.get(name)?.({ code, preventDefault() {} }); },
      prepend(el) { this.children.unshift(el); el.remove = () => this.children.pop(); },
      get lastChild() { return this.children.at(-1); },
      getBoundingClientRect: () => ({ width: 900, height: 620 }),
      getContext: () => new Proxy({}, { get: (obj, key) => obj[key] ?? (() => {}) }),
    };
  }
  const buttons = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].map(k => {
    const btn = element(); btn.dataset.k = k; return btn;
  });
  const document = Object.assign(element(), {
    documentElement: element(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    createElement: element,
    querySelectorAll: () => buttons,
  });
  const window = element();
  const context = vm.createContext({
    document, window, devicePixelRatio: 1,
    performance: { now: () => now }, Date: { now: () => 1700000000000 + now },
    Math: Object.assign(Object.create(Math), { random: () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) }),
    requestAnimationFrame: fn => { frame = fn; },
    console: { error: (...args) => errors.push(args) },
    fetch: async (url, options) => {
      requests.push(JSON.parse(JSON.stringify({ url, ...options })));
      if (response === 'network') throw new Error('offline');
      return { ok: response === 'ok', status: 503, json: async () => ({
        model: 'typesafe/jev', answers: { strategy: { choice: 'FLANK', confidence: .9 } },
      }) };
    },
  });
  if (baseline) {
    const script = baseline.match(/<script>([\s\S]*?)<\/script>/)[1];
    vm.runInContext(script.replace(/\}\)\(\);\s*$/, `globalThis.inspect = ${inspect};\n})();`), context);
  } else {
    for (const [filename, code] of sources) vm.runInContext(code, context, { filename });
    vm.runInContext(`globalThis.inspect = ${inspect};`, context);
  }
  return {
    document, window, buttons, requests, errors,
    state: () => JSON.parse(context.inspect()),
    async tick() { now += 16; frame(now); await new Promise(resolve => setImmediate(resolve)); },
    ui: () => [...elements].map(([id, el]) => [id, el.textContent, el.innerHTML, el.style]),
  };
}

(async () => {
  const baseline = process.argv[2] && fs.readFileSync(process.argv[2], 'utf8');
  for (const response of ['ok', '503', 'network']) {
    const games = [boot(null, response)];
    if (baseline) games.push(boot(baseline, response));
    assert.equal(games[0].state().p.hp, 3);
    for (let i = 0; i < 900; i++) {
      for (const game of games) {
        if (i === 2) game.window.emit('keydown', 'KeyD');
        if (i === 8) game.window.emit('keydown', 'Space');
        if (i === 20) game.window.emit('keyup', 'KeyD');
        if (i === 80) game.window.emit('blur');
        if (i === 150) game.buttons[0].emit('pointerdown');
        if (i === 180) game.buttons[0].emit('pointercancel');
        if (i === 250) game.window.emit('keydown', 'KeyR');
        if (i === 400) game.document.getElementById('newRound').onclick();
        if (i === 600) game.document.getElementById('restart').onclick();
        await game.tick();
      }
      if (i === 8) {
        assert.ok(games[0].state().p.x > 450, 'keyboard movement');
        assert.ok(games[0].state().bullets.some(b => b.owner === 'p'), 'player shooting');
      }
      if (i === 80 || i === 180) assert.deepEqual(games[0].state().keys, []);
      if (baseline) {
        assert.deepEqual(games[0].state(), games[1].state(), `${response}, frame ${i}`);
        assert.deepEqual(games[0].ui(), games[1].ui());
        assert.deepEqual(games[0].requests, games[1].requests);
      }
    }
    assert.deepEqual(games[0].errors, [], 'no logic/render errors');
    assert.ok(games[0].requests.length > 0, 'Jev request made');
    assert.ok(games[0].requests.every(r => r.url === '/api/jev' && r.method === 'POST'));
    const status = games[0].document.getElementById('modelStatus').textContent;
    assert.ok(status.includes(response === 'ok' ? 'LIVE' : 'LOCAL FALLBACK'));
    console.log(`PASS: ${response}, 900 frames${baseline ? ', identical to original' : ''}`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
