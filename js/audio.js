/* ============================================================
   THE DAILY GRIND — audio.js
   Synthesized SFX + chiptune sequencer (WebAudio, no assets)
   ============================================================ */
window.Sound = (() => {
  let ctx = null, master = null, sfxGain = null, musGain = null;
  let muted = false;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(master);
    musGain = ctx.createGain();
    musGain.gain.value = 0.3;
    musGain.connect(master);
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /* ---- note helpers ---- */
  const SEMI = { C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11 };
  function freq(note) {
    const m = /^([A-G][#b]?)(\d)$/.exec(note);
    if (!m) return 0;
    const midi = SEMI[m[1]] + 12 * (parseInt(m[2], 10) + 1);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(o) {
    if (!ctx) return;
    const { type = 'square', note, f, t, dur = 0.15, vol = 0.2, slide = 0, dest } = o;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    const base = f || freq(note);
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, base), t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, base * slide), t + dur);
    env(g, t, 0.005, dur, vol);
    osc.connect(g); g.connect(dest || sfxGain);
    osc.start(t); osc.stop(t + dur + 0.08);
  }

  let noiseBuf = null;
  function noise(o) {
    if (!ctx) return;
    const { t, dur = 0.1, vol = 0.2, hp = 0, lp = 0, dest } = o;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5 | 0, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    let node = src;
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    const g = ctx.createGain();
    env(g, t, 0.003, dur, vol);
    node.connect(g); g.connect(dest || sfxGain);
    src.start(t); src.stop(t + dur + 0.08);
  }

  function seq(notes, step, opts) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    notes.forEach((n, i) => {
      if (!n) return;
      tone(Object.assign({ note: n, t: t0 + i * step, dur: step * 1.6, vol: 0.15 }, opts || {}));
    });
  }

  /* ---- SFX library ---- */
  const S = {};
  const ok = () => !!ctx;
  const now = () => ctx.currentTime;

  S.jump      = () => ok() && tone({ f: 320, t: now(), dur: 0.12, vol: 0.15, slide: 2.1 });
  S.djump     = () => { if (!ok()) return; tone({ f: 430, t: now(), dur: 0.11, vol: 0.14, slide: 2.0 }); noise({ t: now(), dur: 0.06, vol: 0.05, hp: 3000 }); };
  S.dash      = () => { if (!ok()) return; noise({ t: now(), dur: 0.14, vol: 0.16, hp: 1100 }); tone({ type: 'sawtooth', f: 210, t: now(), dur: 0.14, vol: 0.1, slide: 0.4 }); };
  S.land      = () => ok() && noise({ t: now(), dur: 0.07, vol: 0.1, lp: 420 });
  S.coin      = () => { if (!ok()) return; const t = now(); tone({ f: 1319, t, dur: 0.06, vol: 0.12 }); tone({ f: 1760, t: t + 0.06, dur: 0.12, vol: 0.12 }); };
  S.file      = () => seq(['C6', 'E6', 'G6'], 0.05, { type: 'triangle', vol: 0.16 });
  S.stomp     = () => { if (!ok()) return; tone({ f: 190, t: now(), dur: 0.13, vol: 0.22, slide: 0.3 }); noise({ t: now(), dur: 0.09, vol: 0.14, lp: 350 }); };
  S.hurt      = () => ok() && tone({ type: 'sawtooth', f: 310, t: now(), dur: 0.24, vol: 0.2, slide: 0.32 });
  S.death     = () => seq(['G4', 'E4', 'C4', 'G3'], 0.14, { type: 'square', vol: 0.14 });
  S.checkpoint= () => seq(['A5', 'D6'], 0.09, { type: 'triangle', vol: 0.18 });
  S.door      = () => seq(['C5', 'E5', 'G5', 'C6'], 0.07, { type: 'square', vol: 0.12 });
  S.pew       = () => ok() && tone({ f: 720, t: now(), dur: 0.11, vol: 0.1, slide: 0.28 });
  S.bossHit   = () => { if (!ok()) return; tone({ type: 'sawtooth', f: 170, t: now(), dur: 0.3, vol: 0.24, slide: 0.3 }); noise({ t: now(), dur: 0.2, vol: 0.2, lp: 900 }); };
  S.boost     = () => ok() && tone({ f: 380, t: now(), dur: 0.2, vol: 0.12, slide: 3.2 });
  S.stamp     = () => { if (!ok()) return; noise({ t: now(), dur: 0.18, vol: 0.35, lp: 260 }); tone({ type: 'sine', f: 95, t: now(), dur: 0.2, vol: 0.3, slide: 0.5 }); };
  S.fanfare   = () => { if (!ok()) return; seq(['C5', 'E5', 'G5'], 0.09, { vol: 0.14 }); setTimeoutSafe(() => seq(['C6', 'G5', 'C6', 'E6'], 0.1, { vol: 0.15 }), 300); };
  S.click     = () => ok() && tone({ f: 820, t: now(), dur: 0.04, vol: 0.08 });
  S.alarm     = () => { if (!ok()) return; const t = now(); tone({ f: 950, t, dur: 0.07, vol: 0.1 }); tone({ f: 950, t: t + 0.1, dur: 0.07, vol: 0.1 }); };
  S.thud      = () => { if (!ok()) return; noise({ t: now(), dur: 0.16, vol: 0.3, lp: 200 }); tone({ type: 'sine', f: 70, t: now(), dur: 0.22, vol: 0.32, slide: 0.5 }); };
  /* --- expansion pack sfx --- */
  S.boing     = () => { if (!ok()) return; const t = now(); tone({ type: 'sine', f: 160, t, dur: 0.22, vol: 0.26, slide: 4.4 }); tone({ type: 'triangle', f: 520, t: t + 0.02, dur: 0.12, vol: 0.09, slide: 2.4 }); };
  S.donut     = () => seq(['B5', 'E6'], 0.07, { type: 'triangle', vol: 0.16 });
  S.key       = () => seq(['E5', 'A5', 'C#6', 'E6'], 0.07, { type: 'square', vol: 0.12 });
  S.gate      = () => { if (!ok()) return; noise({ t: now(), dur: 0.25, vol: 0.2, lp: 600 }); tone({ type: 'sine', f: 120, t: now(), dur: 0.25, vol: 0.18, slide: 0.5 }); seq(['A4', 'E5'], 0.08, { type: 'triangle', vol: 0.1 }); };
  S.hifive    = () => { if (!ok()) return; const t = now(); tone({ f: 1046, t, dur: 0.05, vol: 0.12 }); tone({ f: 1568, t: t + 0.05, dur: 0.07, vol: 0.12 }); };
  S.combo     = n => ok() && tone({ f: 480 * Math.pow(1.14, Math.min(n, 8)), t: now(), dur: 0.09, vol: 0.12 });
  S.pager     = () => { if (!ok()) return; const t = now(); tone({ type: 'square', f: 1318, t, dur: 0.07, vol: 0.1 }); tone({ type: 'square', f: 1318, t: t + 0.12, dur: 0.07, vol: 0.1 }); };
  /* shredder feedback pack */
  S.tick      = urg => { if (!ok()) return; tone({ type: 'square', f: urg > 0.6 ? 1245 : 990, t: now(), dur: 0.04, vol: 0.05 + urg * 0.06 }); };
  S.shred     = () => { if (!ok()) return; const t = now(); noise({ t, dur: 0.18, vol: 0.34, hp: 900 }); noise({ t: t + 0.09, dur: 0.22, vol: 0.3, hp: 700 }); tone({ type: 'sawtooth', f: 320, t, dur: 0.3, vol: 0.13, slide: 0.22 }); };
  S.incoming  = () => seq(['C6', 'F5'], 0.1, { type: 'square', vol: 0.12 });
  S.staple    = () => { if (!ok()) return; const t = now(); noise({ t, dur: 0.05, vol: 0.15, hp: 2400 }); tone({ type: 'square', f: 980, t, dur: 0.06, vol: 0.1, slide: 1.4 }); };

  function setTimeoutSafe(fn, ms) { setTimeout(fn, ms); }

  /* ---- Music sequencer ----
     Songs are token strings, '.' = rest. Bars of 8 eighth-notes. */
  const bar = (s) => s.trim().split(/\s+/);
  const MAIN_BASS = [].concat(
    bar('A2 . A2 . E3 . A2 .'), bar('F2 . F2 . C3 . F2 .'),
    bar('C3 . C3 . G3 . C3 .'), bar('G2 . G2 . D3 . G2 .'),
    bar('A2 . A2 . E3 . A2 .'), bar('F2 . F2 . C3 . F2 .'),
    bar('C3 . C3 . G3 . C3 .'), bar('G2 . G2 . B2 . D3 .')
  );
  const MAIN_LEAD = [].concat(
    bar('A4 . C5 E5 . E5 D5 C5'), bar('.  A4 . C5 A4 . G4 .'),
    bar('E5 . G5 . E5 D5 C5 .'),  bar('D5 . B4 G4 . A4 B4 .'),
    bar('A4 . C5 E5 . G5 E5 D5'), bar('C5 . A4 F4 . A4 C5 .'),
    bar('E5 G5 . G5 E5 D5 C5 D5'),bar('E5 . . . . . . .')
  );
  const BOSS_BASS = [].concat(
    bar('D2 D2 D3 D2 D2 D2 D3 D2'), bar('D2 D2 D3 D2 D2 D2 D3 D2'),
    bar('Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1'), bar('C2 C2 C3 C2 C2 C2 C3 C2'),
    bar('D2 D2 D3 D2 D2 D2 D3 D2'), bar('D2 D2 D3 D2 D2 D2 D3 D2'),
    bar('Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1'), bar('A1 A1 A2 A1 A1 A1 A2 A1')
  );
  const BOSS_LEAD = [].concat(
    bar('D5 . . . F5 . . .'), bar('. . A5 . G5 F5 E5 .'),
    bar('Bb4 . D5 . F5 . D5 .'), bar('C5 . E5 . G5 . E5 .'),
    bar('D5 . . . F5 . A5 .'), bar('. . G5 . F5 E5 D5 .'),
    bar('Bb4 . D5 . F5 . Bb5 .'), bar('A5 . . . . . . .')
  );

  const SONGS = {
    main: { bpm: 132, bass: MAIN_BASS, lead: MAIN_LEAD },
    boss: { bpm: 150, bass: BOSS_BASS, lead: BOSS_LEAD },
  };

  const mus = { song: null, step: 0, next: 0, timer: null };

  function scheduleStep(i, t, song) {
    const b = song.bass[i % song.bass.length];
    const l = song.lead[i % song.lead.length];
    if (b !== '.') tone({ type: 'triangle', note: b, t, dur: 0.22, vol: 0.5, dest: musGain });
    if (l !== '.') tone({ type: 'square', note: l, t, dur: 0.18, vol: 0.13, dest: musGain });
    const ib = i % 8;
    if (ib === 0 || (song === SONGS.boss && ib === 5)) tone({ type: 'sine', f: 150, t, dur: 0.09, vol: 0.5, slide: 0.4, dest: musGain });
    if (ib === 4) noise({ t, dur: 0.07, vol: 0.16, lp: 1800, dest: musGain });
    if (i % 2 === 0) noise({ t, dur: 0.03, vol: 0.05, hp: 6000, dest: musGain });
  }

  function schedule() {
    if (!ctx || !mus.song) return;
    const spb = 60 / mus.song.bpm / 2; // eighth note
    while (mus.next < ctx.currentTime + 0.16) {
      scheduleStep(mus.step, mus.next, mus.song);
      mus.step++;
      mus.next += spb;
    }
  }

  function playSong(name) {
    init();
    if (!ctx) return;
    const song = SONGS[name];
    if (!song) return;
    if (mus.song === song) return;
    mus.song = song; mus.step = 0; mus.next = ctx.currentTime + 0.06;
    if (!mus.timer) mus.timer = setInterval(schedule, 30);
  }

  function stopSong() { mus.song = null; }

  function toggleMute() {
    init();
    if (!ctx) return muted;
    muted = !muted;
    master.gain.value = muted ? 0 : 0.9;
    return muted;
  }

  /* ---- auto-duck: no sound when the app isn't visible/focused ----
     Mobile browsers keep WebAudio running in background otherwise — the
     chiptune follows the user into WhatsApp. Suspending the context pauses
     music AND sfx and freezes ctx.currentTime, so the sequencer clock
     stays in sync; resume() on return picks the song up mid-bar. */
  let ducked = false;   /* true only when WE suspended the context */
  function setDucked(h) {
    if (!ctx) return;
    if (h && ctx.state === 'running') {
      ducked = true;
      const p = ctx.suspend(); if (p && p.catch) p.catch(() => {});
    } else if (!h && ducked) {
      ducked = false;
      const p = ctx.resume(); if (p && p.catch) p.catch(() => {});
    }
  }
  document.addEventListener('visibilitychange', () => setDucked(document.hidden));
  window.addEventListener('blur', () => setDucked(true));
  window.addEventListener('focus', () => setDucked(false));
  window.addEventListener('pagehide', () => setDucked(true));
  window.addEventListener('pageshow', () => setDucked(false));

  return { resume, S, playSong, stopSong, toggleMute, get muted() { return muted; },
           ctxState: () => (ctx ? ctx.state : 'none') };
})();
