(() => {
  'use strict';
  const C = window.SurgeCore;
  const KEY = 'surge-standalone-v1';
  const SESSION_KEY = 'surge-demo-session';
  const blank = () => ({
    facility: { name: '', location: '', placeQuery: '' },
    power: {
      gridModel: '',
      gridKw: '',
      gridReliability: '',
      capacityKwh: '',
      storedKwh: '',
      reservePercent: '',
      dischargeKw: '',
      efficiencyPercent: '',
      batteryModel: '',
      generatorModel: '',
      generatorRatedKw: '',
      fuelLitres: '',
      fuelBurn: '',
      generatorAutoStart: false,
    },
    services: [],
    batches: [],
    cold: { serviceId: '', currentC: '', minC: '', maxC: '', warmCPerHour: '', coolCPerHour: '' },
    setupDone: false,
    sim: { selected: null, holdHours: 4, outageHours: 6, priceWeight: 70 },
    view: 'sim',
    status: { powerOff: false, since: null, targetHours: '', shutDone: [] },
  });
  const planKey = (type) => `${KEY}-${type}`;
  // Hospitals and clinics keep separate plans on this device, so each only ever sees its own setup and dashboard.
  function loadPlan(type) {
    if (!type) return blank();
    try {
      const saved = JSON.parse(localStorage.getItem(planKey(type)));
      if (saved?._version !== 1) return blank();
      const savedPower = { ...saved.power };
      delete savedPower.solarKw;
      return {
        ...blank(),
        ...saved,
        setupDone: saved.setupDone ?? Boolean(saved.facility?.name || saved.services?.length),
        sim: { ...blank().sim, ...saved.sim },
        status: { ...blank().status, ...saved.status },
        view: saved.view === 'status' ? 'status' : 'sim',
        power: { ...blank().power, ...savedPower },
        facility: { ...blank().facility, ...saved.facility },
        cold: { ...blank().cold, ...saved.cold },
        services: Array.isArray(saved.services) ? saved.services : [],
        batches: Array.isArray(saved.batches) ? saved.batches : [],
      };
    } catch {
      return blank();
    }
  }
  let state = loadPlan(signedInType());

  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const num = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const kw = (v) => `${num(v).toFixed(1)} kW`;
  const save = () => {
    const type = signedInType();
    if (!type) return;
    try {
      localStorage.setItem(planKey(type), JSON.stringify({ ...state, _version: 1 }));
    } catch {
      /* Browser storage may be unavailable in private mode. */
    }
  };
  const field = (label, key, value, unit = '', attrs = '') =>
    `<label class="field"><span>${label}${unit ? ` <small>${unit}</small>` : ''}</span><input data-bind="${key}" type="number" ${/\bmin=/.test(attrs) ? '' : 'min="0"'} step="0.1" value="${esc(value)}" placeholder="Enter value" ${attrs}></label>`;
  const textField = (label, key, value, placeholder = '') =>
    `<label class="field"><span>${label}</span><input data-bind="${key}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
  const select = (label, key, value, options, required = false) =>
    `<label class="field"><span>${label}</span><select data-bind="${key}" ${required ? 'required' : ''}>${options.map(([v, t]) => `<option value="${esc(v)}" ${String(value) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const cardHead = (eyebrow, title, tail = '') =>
    `<div class="card-head"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${tail}</div>`;
  // Ranks are unique: 1 = served first. Setting a rank inserts the room there and shifts the others down.
  const rankedRooms = () =>
    state.services
      .filter((room) => C.hasPriority(room))
      .sort((a, b) => Number(a.priority) - Number(b.priority));
  const normalizeRanks = () =>
    rankedRooms().forEach((room, i) => {
      room.priority = i + 1;
    });
  function placeRank(room, rank) {
    const others = rankedRooms().filter((s) => s !== room);
    others.splice(Math.max(0, Math.min(others.length, rank - 1)), 0, room);
    others.forEach((s, i) => {
      s.priority = i + 1;
    });
  }
  // Always offer at least four ranks. Ranks stay 1, 2, 3… with no gaps, so a rank beyond the next free one is placed there.
  const MIN_RANK_CHOICES = 4;
  const rankChoices = (room) =>
    Array.from(
      {
        length: Math.max(
          MIN_RANK_CHOICES,
          rankedRooms().length + (room && C.hasPriority(room) ? 0 : 1)
        ),
      },
      (_, i) => [String(i + 1), i === 0 ? '1 · Highest' : String(i + 1)]
    );
  const rankSelectHtml = (attrs, room, value = '') =>
    `<select ${attrs}>${[['', 'Choose rank'], ...rankChoices(room)].map(([v, t]) => `<option value="${v}" ${String(value) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const newId = () =>
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const FACILITY_TYPES = { hospital: 'Hospital', clinic: 'Clinic' };
  const EQUIPMENT = [
    'Lights',
    'Fans',
    'Air conditioning',
    'Refrigeration',
    'Medical devices',
    'Computers / IT',
    'Water pump',
  ];
  const FACILITY_SUGGESTIONS = {
    hospital: [
      'Emergency department',
      'Intensive care unit',
      'Operating theatre',
      'Maternity / labour ward',
      'General ward',
      'Pharmacy',
      'Laboratory',
      'Radiology',
      'Blood bank',
      'Vaccine cold room',
      'Outpatient department',
    ],
    clinic: [
      'Consultation room',
      'Treatment room',
      'Pharmacy / dispensary',
      'Vaccine fridge',
      'Laboratory',
      'Waiting area',
      'Maternal & child health room',
    ],
  };
  function signedInType() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY))?.type || '';
    } catch {
      return '';
    }
  }
  function signedInEmail() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return session?.username ? `${session.username} · ${FACILITY_TYPES[session.type] || ''}` : '';
    } catch {
      return '';
    }
  }

  function renderLogin() {
    const app = document.getElementById('app');
    app.innerHTML = `<main class="login-page"><aside class="login-aside"><a class="brand login-brand" href="#"><span class="brand-mark">⌁</span><span><b>SURGE</b><small>FACILITY RESILIENCE</small></span></a><div class="aside-copy"><p class="eyebrow">POWER CONTINUITY PLANNER</p><h2>Keep care running when the grid doesn't.</h2><ul><li>See how long your backup power will last</li><li>Know what to keep on and what to shut off</li><li>Protect the medicines that need a fridge</li></ul></div><svg class="login-wave" viewBox="0 0 80 600" preserveAspectRatio="none" aria-hidden="true"><path d="M80 0H40C58 70 20 120 38 190 56 260 18 330 36 400 54 470 22 540 40 600H80Z"/></svg></aside><section class="login-card"><p class="eyebrow">LOCAL DEMO ACCESS</p><h1>Welcome back</h1><p class="login-intro">Sign in to open your planning workspace.</p><form id="login-form" class="login-form" novalidate><label class="field"><span>Facility type</span><select name="type" required><option value="hospital">Hospital</option><option value="clinic">Clinic</option></select></label><label class="field"><span>Username</span><input name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Enter username" required></label><label class="field"><span>Password</span><div class="password-wrap"><input name="password" type="password" autocomplete="current-password" minlength="6" placeholder="At least 6 characters" required><button class="password-toggle" type="button" aria-label="Show password">Show</button></div></label><p class="login-error" id="login-error" role="alert" hidden></p><button class="button primary login-submit" type="submit">Sign in</button></form><div class="login-security"><span aria-hidden="true">⌑</span><p><b>Private to this browser</b><br>This demo checks the form locally. It does not create an account or store your password. Use demo-only details.</p></div><small class="login-foot">SURGE · LOCAL PLANNING PROTOTYPE</small></section></main>`;
    const form = app.querySelector('#login-form');
    const password = form.elements.password;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const username = form.elements.username.value.trim();
      const type = form.elements.type.value;
      const error = app.querySelector('#login-error');
      if (!C.validateDemoLogin(username, password.value, type)) {
        error.textContent =
          'Enter a username (3 to 32 letters, numbers, . _ or -) and a password of at least 6 characters.';
        error.hidden = false;
        return;
      }
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username, type }));
      } catch {
        /* Session storage may be disabled. */
      }
      state = loadPlan(type);
      normalizeRanks();
      resetSim();
      weather = { status: 'idle' };
      render();
    });
    app.querySelector('.password-toggle').addEventListener('click', (event) => {
      const button = event.currentTarget;
      const visible = password.type === 'password';
      password.type = visible ? 'text' : 'password';
      button.textContent = visible ? 'Hide' : 'Show';
      button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    });
  }

  function renderSetup() {
    const type = signedInType() === 'clinic' ? 'clinic' : 'hospital';
    const label = FACILITY_TYPES[type];
    const ranked = [...state.services].sort(
      (a, b) => (Number(a.priority) || 9) - (Number(b.priority) || 9)
    );
    const facilityRows = ranked
      .map(
        (room) =>
          `<div class="setup-row"><span class="rank-chip p${esc(room.priority)}">${C.hasPriority(room) ? `#${esc(room.priority)}` : 'Unranked'}</span><div><b>${esc(room.name)}</b><small>${esc((room.equipment || []).join(', ') || room.area || 'No equipment selected')} · ${kw(room.requiredKw)} needed${num(room.minimumKw) ? ` · ${kw(room.minimumKw)} minimum` : ''}</small></div><button class="icon-button" data-action="remove-room" data-id="${esc(room.id)}" aria-label="Remove ${esc(room.name)}">×</button></div>`
      )
      .join('');
    const medicineSection =
      type === 'clinic'
        ? `<section class="card setup-section"><div class="setup-step">4</div>${cardHead('MEDICINE STOCK', 'List your medicines')}<p class="intro">Pick the medicines you hold from the list of everyday names, such as Insulin or Paracetamol, or type any other name. Surge ranks them for a power outage and puts the ones that need a fridge first.</p><datalist id="medicine-names">${medicineData
            .filter((m) => m.common)
            .map((m) => `<option value="${esc(m.display)}"></option>`)
            .join(
              ''
            )}</datalist><form class="add-form medicine-form" data-form="medicine"><label class="field"><span>Medicine name</span><input data-bind="batch.name" list="medicine-names" placeholder="Choose or type a name" autocomplete="off"></label>${field('Quantity', 'batch.quantity', '', 'Units')}<button class="button primary">Add medicine</button></form>${state.batches.map((b) => `<div class="setup-row"><span class="rank-chip ${C.findMedicine(b.name, medicineData)?.cold ? 'p2' : ''}">${medicineData === null ? '…' : C.findMedicine(b.name, medicineData) ? (C.findMedicine(b.name, medicineData).cold ? 'Cold chain' : 'Room temp') : 'Not in list'}</span><div><b>${esc(b.name)}</b><small>${esc(b.quantity || 'Quantity not entered')}</small></div><button class="icon-button" data-action="remove-batch" data-id="${esc(b.id)}" aria-label="Remove ${esc(b.name)}">×</button></div>`).join('') || '<div class="empty">No medicines added yet.</div>'}</section>`
        : '';
    document.getElementById('app').innerHTML =
      `<main class="setup-page"><header class="setup-head"><a class="brand" href="#"><span class="brand-mark">⌁</span><span><b>SURGE</b><small>FACILITY RESILIENCE</small></span></a><span class="signed-in-user">${esc(signedInEmail())}</span><button class="button quiet" data-action="logout">Sign out</button></header><div class="setup-intro"><p class="eyebrow">${label.toUpperCase()} SETUP</p><h1>${label} info</h1><p>Tell Surge about your ${label.toLowerCase()} so the plan uses your own details. Everything stays on this device.</p><button class="button quiet sample-button" data-action="load-sample">Just looking? Fill in sample data</button></div>
      <section class="card setup-section"><div class="setup-step">1</div>${cardHead('ABOUT', `${label} name and location`)}<div class="form-grid setup-two">${textField(`${label} name`, 'facility.name', state.facility.name, `Enter ${label.toLowerCase()} name`)}<label class="field"><span>Location</span><input data-bind="facility.location" list="location-options" value="${esc(state.facility.location)}" placeholder="Start typing a town or city" autocomplete="off"><datalist id="location-options">${placeSuggestions.map((p) => `<option value="${esc(placeLabel(p))}"></option>`).join('')}</datalist><small class="field-hint">${weatherKey() ? 'Pick a suggestion so the forecast uses exactly that place.' : 'Add a free WeatherAPI key in config.js to get location suggestions and the power-cut chance.'}</small></label></div></section>
      <section class="card setup-section"><div class="setup-step">2</div>${cardHead('BACKUP POWER', 'Generator and battery')}<div class="form-grid setup-two">${field('Generator rated output', 'power.generatorRatedKw', state.power.generatorRatedKw, 'kW')}<label class="check-field"><input type="checkbox" data-bind="power.generatorAutoStart" ${state.power.generatorAutoStart ? 'checked' : ''}><span><b>Starts automatically on outage</b><small>Leave capacity blank if there is no generator.</small></span></label>${field('Fuel available', 'power.fuelLitres', state.power.fuelLitres, 'L')}${field('Fuel consumption', 'power.fuelBurn', state.power.fuelBurn, 'L/hour')}${field('Battery capacity', 'power.capacityKwh', state.power.capacityKwh, 'kWh')}${field('Energy currently stored', 'power.storedKwh', state.power.storedKwh, 'kWh')}</div><p class="fine">The battery is treated as fully usable and 100% efficient, and able to deliver at most its capacity in kW. Blank fuel consumption means fuel never runs down. Leave battery or fuel blank if you don’t have them.</p></section>
      <section class="card setup-section"><div class="setup-step">3</div>${cardHead('FACILITIES', `Departments and what they run`)}<p class="intro">Add each department or room, tick the equipment it has, and rank it. ${type === 'hospital' ? 'Your hospital decides the ranking' : 'Your clinic decides the ranking'}; Surge keeps higher ranks powered first.</p><datalist id="facility-names">${FACILITY_SUGGESTIONS[type].map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist><form class="facility-form" data-form="room"><div class="facility-form-top"><label class="field"><span>Facility name</span><input data-bind="new.name" list="facility-names" placeholder="Choose or type a name" autocomplete="off"></label>${field('Required power', 'new.requiredKw', '', 'kW')}${field('Minimum power', 'new.minimumKw', '', 'kW')}<label class="field"><span>Rank <small>1 = first</small></span>${rankSelectHtml('name="priority" aria-label="Rank" required', null)}<small class="field-hint">Ranks have no gaps: with 2 facilities listed, choosing 4 makes this one #3.</small></label></div><fieldset class="equipment"><legend>Equipment it has</legend>${EQUIPMENT.map((e) => `<label class="chip"><input type="checkbox" name="equipment" value="${esc(e)}"><span>${esc(e)}</span></label>`).join('')}</fieldset><button class="button primary">Add facility</button></form><div class="setup-list">${facilityRows || '<div class="empty">No facilities yet. Add the first one above.</div>'}</div>${type === 'clinic' && state.services.length ? `<div class="fridge-pick">${select('Which facility is your medicine fridge?', 'cold.serviceId', state.cold.serviceId, [['', 'Choose a facility'], ...state.services.map((s) => [s.id, s.name])])}<small>Used to show how long your medicines stay cold during an outage.</small></div>` : ''}</section>
      ${medicineSection}
      <div class="setup-actions"><span>${state.services.length} ${state.services.length === 1 ? 'facility' : 'facilities'} added</span><button class="button primary setup-continue" data-action="finish-setup">Save and continue</button></div></main>`;
    bind();
  }
  // Clinic and hospital dashboard: the backup-power simulation, plus medicine priority for clinics.

  // The priority list from medicines.js, with everyday names (Insulin, Paracetamol) added in front of the clinical names.
  const medicineData = C.withCommonNames(window.SURGE_MEDICINES || [], window.SURGE_COMMON);
  let simTimer = null;
  let simClock = 0; // hours of simulated time that have passed in the current run
  let simState = 'idle'; // idle | running | done
  let weather = { status: 'idle' };
  const STEP_H = 0.25;
  const fmtDuration = (hours) => {
    const m = Math.round(num(hours) * 60);
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  };

  function resetSim() {
    if (simTimer) clearInterval(simTimer);
    simTimer = null;
    simState = 'idle';
    simClock = 0;
  }

  // Until the user ticks something, the default is the highest-ranked facilities the sources can carry
  // (or everything, if not even rank 1 fits, so the page can explain why). Their own choices live in state.sim.selected.
  function simSelection() {
    const known = new Set(state.services.map((s) => s.id));
    if (state.sim.selected) return state.sim.selected.filter((id) => known.has(id));
    const byRank = C.pickByRank(state);
    return byRank.length
      ? byRank
      : state.services.filter((s) => num(s.requiredKw) > 0).map((s) => s.id);
  }

  function clinicRun() {
    const ids = simSelection();
    const run = C.backupProjection(state, ids);
    const end = run.lastsHours;
    const axis = end === null ? run.horizonHours : Math.max(1, Math.ceil(end * 1.25));
    return { ids, run, end, axis };
  }

  function limitText(run) {
    const supply = kw(run.startSupplyKw);
    if (run.noLoad) return 'Tick at least one facility below.';
    if (run.lastsHours === null)
      return `Covers the selected load for the whole ${run.horizonHours} h projection.`;
    if (run.limit === 'capacity')
      return `Sources can deliver ${supply} but the selected load needs ${kw(run.demandKw)}.`;
    if (run.limit === 'both') return 'Generator fuel and battery both run out.';
    if (run.limit === 'fuel')
      return 'Generator fuel runs out and the battery cannot carry the load alone.';
    const empty = run.sources.reserve > 0 ? 'reaches its reserve' : 'runs out';
    return run.sources.genKw > 0
      ? `Battery ${empty} and the generator cannot carry the load alone.`
      : `Battery ${empty}.`;
  }

  const simPoint = ({ run }) =>
    run.series[
      simState === 'idle' ? 0 : Math.min(run.series.length - 1, Math.round(simClock / STEP_H))
    ];

  // The first draw and every animation tick use the same chart geometry, so a tick only moves elements that already exist.
  function chartGeometry(info) {
    const { run, axis } = info;
    const W = 720,
      H = 300,
      L = 46,
      R = 14,
      T = 14,
      B = 30;
    const x = (h) => L + (Math.min(h, axis) / axis) * (W - L - R);
    const y = (p) => T + ((100 - Math.max(0, Math.min(100, p))) / 100) * (H - T - B);
    const upTo = (limit) => run.series.filter((p) => p.hour <= limit + 1e-9);
    const line = (key, limit) =>
      upTo(limit)
        .map((p, i) => `${i ? 'L' : 'M'}${x(p.hour).toFixed(1)},${y(p[key]).toFixed(1)}`)
        .join(' ');
    const area = (key, limit) => {
      const pts = upTo(limit);
      return pts.length
        ? `${line(key, limit)} L${x(pts.at(-1).hour).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`
        : '';
    };
    return { W, H, L, R, T, B, x, y, line, area };
  }

  function clinicChart(info) {
    const { run, end, axis } = info;
    const g = chartGeometry(info);
    const { W, H, L, R, T, B, x, y } = g;
    const lines = [
      ['batteryPercent', 'battery'],
      ['fuelPercent', 'fuel'],
    ].filter(([key]) => run.series[0][key] !== null);
    const tick = [1, 2, 4, 6, 12, 24].find((t) => axis / t <= 6) || 24;
    const xTicks = [];
    for (let h = 0; h <= axis + 1e-9; h += tick) xTicks.push(h);
    const grid = [0, 25, 50, 75, 100]
      .map(
        (p) =>
          `<path d="M${L} ${y(p)}H${W - R}"/><text x="${L - 8}" y="${y(p) + 4}" text-anchor="end">${p}%</text>`
      )
      .join('');
    const xLabels = xTicks
      .map(
        (h) =>
          `<text x="${x(h)}" y="${H - 8}" text-anchor="${h === 0 ? 'start' : 'middle'}">${h}h</text>`
      )
      .join('');
    const started = simState !== 'idle';
    const now = simPoint(info);
    const drawn = lines
      .map(([key, cls]) => {
        const dot = (id, extra) =>
          `<circle id="${id}-${cls}" class="${extra} ${cls} ${simState === 'running' ? 'on' : ''}" cx="${x(now.hour).toFixed(1)}" cy="${y(now[key]).toFixed(1)}" r="5"/>`;
        const live = started
          ? `<path id="sim-area-${cls}" class="sim-area ${cls}" d="${g.area(key, simClock)}"/><path id="sim-line-${cls}" class="sim-line ${cls}" d="${g.line(key, simClock)}"/>${dot('sim-pulse', 'sim-pulse')}${dot('sim-dot', 'sim-dot')}`
          : '';
        return `<path class="sim-line ${cls} ghost" d="${g.line(key, axis)}"/>${live}`;
      })
      .join('');
    const reserve = run.reservePercent
      ? `<path class="sim-reserve" d="M${L} ${y(run.reservePercent)}H${W - R}"/>`
      : '';
    const late = end !== null && x(end) > W - 150;
    const endMark =
      end !== null
        ? `<path class="sim-end" d="M${x(end).toFixed(1)} ${T}V${H - B}"/><text class="sim-end-label" x="${(x(end) + (late ? -6 : 6)).toFixed(1)}" y="${T + 11}" text-anchor="${late ? 'end' : 'start'}">Power ends at ${fmtDuration(end)}</text>`
        : '';
    const empty = lines.length
      ? ''
      : `<text class="sim-empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">Add battery or generator fuel in Facility info to see the curve</text>`;
    return `<svg id="sim-chart" class="sim-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Battery charge and generator fuel remaining over time"><g class="sim-grid">${grid}${xLabels}</g>${reserve}${drawn}${endMark}${started ? `<path id="sim-playhead" class="sim-playhead" d="M${x(now.hour).toFixed(1)} ${T}V${H - B}"/>` : ''}${empty}</svg>`;
  }

  function clinicLegend(info) {
    const now = simPoint(info);
    const battery =
      now.batteryPercent === null
        ? 'not entered'
        : `${Math.round(now.batteryPercent)}% · ${now.batteryKwh.toFixed(1)} kWh`;
    const fuel =
      now.fuelPercent === null
        ? 'not entered'
        : `${Math.round(now.fuelPercent)}% · ${now.fuelLitres.toFixed(1)} L`;
    return `<div id="sim-legend" class="sim-legend"><span><i class="battery"></i>Battery ${battery}</span><span><i class="fuel"></i>Generator fuel ${fuel}</span>${info.run.reservePercent ? '<span><i class="reserve"></i>Battery reserve</span>' : ''}</div>`;
  }

  // Power-flow strip. The generator and battery feed the selected facilities, and a line shows moving dashes while its source is supplying power.
  function flowState(info) {
    const now = simPoint(info);
    const lost = simState !== 'idle' && !now.covered;
    return {
      genText: now.genKw > 0 ? kw(now.genKw) : 'off',
      batText: now.drawKw > 0 ? kw(now.drawKw) : 'idle',
      facText: lost ? 'no power' : kw(now.demandKw),
      genOn: now.genKw > 0 && !lost,
      batOn: now.drawKw > 0 && !lost,
      lost,
    };
  }

  function flowHtml(info) {
    const f = flowState(info);
    return `<div id="sim-flow" class="sim-flow ${simState}"><svg viewBox="0 0 720 96" role="img" aria-label="Power flow from the generator and battery to the selected facilities">
      <path id="flow-gen-line" class="flow-line gen ${f.genOn ? 'on' : ''}" d="M190 25 C340 25 350 48 500 48"/>
      <path id="flow-bat-line" class="flow-line bat ${f.batOn ? 'on' : ''}" d="M190 71 C340 71 350 48 500 48"/>
      <rect class="flow-node" x="2" y="8" width="188" height="34" rx="10"/><text class="flow-text" x="16" y="30">Generator · <tspan id="flow-gen-text" class="sub">${f.genText}</tspan></text>
      <rect class="flow-node" x="2" y="54" width="188" height="34" rx="10"/><text class="flow-text" x="16" y="76">Battery · <tspan id="flow-bat-text" class="sub">${f.batText}</tspan></text>
      <rect id="flow-fac" class="flow-node fac ${f.lost ? 'lost' : ''}" x="500" y="26" width="218" height="44" rx="12"/><text class="flow-text" x="516" y="53">Facilities · <tspan id="flow-fac-text" class="sub">${f.facText}</tspan></text>
    </svg></div>`;
  }

  // Each tick moves the existing elements instead of redrawing them, which lets the CSS animations keep running.
  function updateSimView(info) {
    const g = chartGeometry(info);
    const now = simPoint(info);
    for (const [key, cls] of [
      ['batteryPercent', 'battery'],
      ['fuelPercent', 'fuel'],
    ]) {
      const line = document.getElementById(`sim-line-${cls}`);
      if (!line) continue;
      line.setAttribute('d', g.line(key, simClock));
      document.getElementById(`sim-area-${cls}`).setAttribute('d', g.area(key, simClock));
      for (const id of [`sim-dot-${cls}`, `sim-pulse-${cls}`]) {
        const dot = document.getElementById(id);
        dot.setAttribute('cx', g.x(now.hour).toFixed(1));
        dot.setAttribute('cy', g.y(now[key]).toFixed(1));
      }
    }
    document
      .getElementById('sim-playhead')
      ?.setAttribute('d', `M${g.x(now.hour).toFixed(1)} ${g.T}V${g.H - g.B}`);
    document.getElementById('sim-legend').outerHTML = clinicLegend(info);
    const f = flowState(info);
    document.getElementById('flow-gen-line')?.classList.toggle('on', f.genOn);
    document.getElementById('flow-bat-line')?.classList.toggle('on', f.batOn);
    document.getElementById('flow-gen-text').textContent = f.genText;
    document.getElementById('flow-bat-text').textContent = f.batText;
    document.getElementById('flow-fac-text').textContent = f.facText;
    document.getElementById('flow-fac').classList.toggle('lost', f.lost);
  }

  function lastsCard(info) {
    const { run, end } = info;
    const s = run.sources;
    const value = run.noLoad ? '—' : end === null ? `${run.horizonHours}h+` : fmtDuration(end);
    const remaining =
      simState !== 'idle' && end !== null
        ? `<p class="lasts-remaining">Remaining <b id="sim-remaining">${fmtDuration(Math.max(0, end - simClock))}</b></p>`
        : '';
    const usable = Math.max(0, s.soc0 - s.reserve) * s.efficiency;
    return `<section class="card lasts-card">${cardHead('TIME IT CAN LAST', 'Backup runtime')}<b class="lasts-value">${value}</b><p class="lasts-why">${esc(limitText(run))}</p>${remaining}<dl><div><dt>Selected load</dt><dd>${kw(run.demandKw)}</dd></div><div><dt>Generator</dt><dd>${s.genKw > 0 ? `${kw(s.genKw)} · ${s.fuel0.toFixed(1)} L` : 'Not running'}</dd></div><div><dt>Battery</dt><dd>${s.cap ? `${usable.toFixed(1)} kWh usable of ${s.cap.toFixed(1)}` : 'Not entered'}</dd></div></dl></section>`;
  }

  // Chance of a power cut in the next hour. It is a weather-based estimate (see SurgeCore.outageRisk), not a utility forecast.
  function riskCard() {
    const name = esc(state.facility.name || 'Clinic');
    let body;
    if (weather.status === 'nokey')
      body =
        '<small>Add a free WeatherAPI.com key in <b>config.js</b> to see the chance of a power cut in the next hour.</small>';
    else if (weather.status === 'loading' || weather.status === 'idle')
      body = '<span>Checking the forecast…</span>';
    else if (weather.status === 'error')
      body = `<small>${esc(weather.text)}</small><button class="button quiet" data-action="weather">Try again</button>`;
    else {
      const r = weather.risk;
      body = `<div class="risk-main ${esc(r.level)}"><b>${r.percent}%</b><span>${esc(r.level)} chance</span></div><div class="risk-bar"><i style="width:${r.percent}%"></i></div><small>${r.reasons.length ? esc(r.reasons.join(' · ')) : 'No storms, strong gusts or alerts forecast'}</small><small class="wx-now">Now ${esc(weather.temp)}°C · ${esc(weather.desc)} · ${esc(weather.place)}</small><small class="wx-note">Weather-based estimate for the next hour, not a utility forecast.</small>`;
    }
    return `<div class="risk-card"><p class="eyebrow">POWER-CUT CHANCE · NEXT HOUR</p>${body}</div><div class="side-name"><b>${name}</b><small>${esc(state.facility.location || 'Location not entered')}</small></div>`;
  }

  // Location suggestions: WeatherAPI search results shown in a dropdown while the user types.
  let placeSuggestions = [];
  let placeSeq = 0;
  let placeTimer = null;
  const weatherKey = () => String(window.SURGE_CONFIG?.weatherApiKey || '').trim();
  const placeLabel = (p) =>
    [p.name, p.region, p.country]
      .filter((part, i, all) => part && all.indexOf(part) === i)
      .join(', ');

  async function suggestPlaces(text) {
    const key = weatherKey();
    const q = text.trim();
    if (!key || q.length < 3) return;
    const seq = (placeSeq += 1);
    try {
      const response = await fetch(
        `https://api.weatherapi.com/v1/search.json?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}`
      );
      if (!response.ok) return;
      const list = await response.json();
      if (seq !== placeSeq || !Array.isArray(list)) return; // a newer keystroke superseded this answer
      placeSuggestions = list.slice(0, 8);
      const box = document.getElementById('location-options');
      if (box)
        box.innerHTML = placeSuggestions
          .map((p) => `<option value="${esc(placeLabel(p))}"></option>`)
          .join('');
    } catch {
      /* offline: typing the place by hand still works */
    }
  }

  async function loadWeather() {
    const key = weatherKey();
    const place = state.facility.placeQuery || state.facility.location.trim();
    if (!key) {
      weather = { status: 'nokey' };
      return;
    }
    if (!place) {
      weather = { status: 'error', text: 'Add a location in Facility info to check the forecast.' };
      return;
    }
    weather = { status: 'loading' };
    try {
      const response = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(key)}&q=${encodeURIComponent(place)}&days=2&aqi=no&alerts=yes`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data?.error?.code === 1006
            ? 'Could not find that location.'
            : data?.error?.code === 2006 || data?.error?.code === 2008
              ? 'The weather API key was rejected. Check config.js.'
              : 'The forecast could not be loaded.'
        );
      const nowEpoch = data.location.localtime_epoch;
      const next = data.forecast.forecastday
        .flatMap((day) => day.hour)
        .find((hour) => hour.time_epoch > nowEpoch);
      if (!next) throw new Error('No forecast hour was returned.');
      weather = {
        status: 'ok',
        risk: C.outageRisk(next, (data.alerts?.alert || []).length),
        temp: Math.round(data.current.temp_c),
        desc: data.current.condition.text,
        place: data.location.name,
      };
    } catch (error) {
      weather = {
        status: 'error',
        text: error instanceof TypeError ? 'Forecast needs an internet connection.' : error.message,
      };
    }
    if (signedInEmail() && state.setupDone && signedInType() === 'clinic') render();
  }
  // Current status page. When the grid is marked off, it lists what to keep on and what to shut off, in rank order, for the backup power available.
  function statusView(isClinic, label) {
    const st = state.status;
    const target = num(st.targetHours);
    const eligible = state.services.filter((s) => num(s.requiredKw) > 0);
    const keepIds = new Set(target > 0 ? C.pickForDuration(state, target) : C.pickByRank(state));
    const byRank = (a, b) => (Number(a.priority) || 1e9) - (Number(b.priority) || 1e9);
    const keep = eligible.filter((s) => keepIds.has(s.id)).sort(byRank);
    const shut = eligible.filter((s) => !keepIds.has(s.id)).sort(byRank);
    const plan = C.backupProjection(state, [...keepIds]);
    const off = Boolean(st.powerOff && st.since);
    const elapsed = off ? Math.max(0, (Date.now() - st.since) / 3600000) : 0;
    const now = plan.series[Math.min(plan.series.length - 1, Math.round(elapsed / STEP_H))];
    const remaining = plan.lastsHours === null ? null : Math.max(0, plan.lastsHours - elapsed);
    const kwSum = (list) => list.reduce((sum, room) => sum + num(room.requiredKw), 0);
    const done = new Set(st.shutDone);
    const rankChip = (room) =>
      `<span class="rank-chip p${esc(room.priority)}">${C.hasPriority(room) ? `#${esc(room.priority)}` : 'No rank'}</span>`;
    const nameCell = (room) =>
      `<span class="pick-name"><b>${esc(room.name)}</b><small>${esc((room.equipment || []).join(', ') || room.area || 'No equipment listed')}</small></span>`;
    const keepRows = keep
      .map(
        (room) =>
          `<div class="status-row keep">${rankChip(room)}${nameCell(room)}<span class="pick-kw">${kw(room.requiredKw)}</span><em>Keep on</em></div>`
      )
      .join('');
    const shutRows = shut
      .map(
        (room) =>
          `<div class="status-row shut ${done.has(room.id) ? 'done' : ''}">${rankChip(room)}${nameCell(room)}<span class="pick-kw">${kw(room.requiredKw)}</span><label class="shut-check"><input type="checkbox" data-shut="${esc(room.id)}" ${done.has(room.id) ? 'checked' : ''} ${off ? '' : 'disabled'}><span>${done.has(room.id) ? 'Shut off' : 'Shut off now'}</span></label></div>`
      )
      .join('');
    const fridge = isClinic ? state.services.find((s) => s.id === state.cold.serviceId) : null;
    const warnings = [];
    if (!eligible.length)
      warnings.push('No facilities with a power requirement yet. Add them under Facility info.');
    else if (!keep.length)
      warnings.push(
        target > 0
          ? `Even your top-ranked facility can’t be kept on for ${target} h with the backup you entered.`
          : 'The generator and battery can’t carry even your top-ranked facility. Check the power figures under Facility info.'
      );
    if (target > 0 && keep.length && plan.lastsHours !== null && plan.lastsHours < target)
      warnings.push(`This list lasts ${fmtDuration(plan.lastsHours)}, shorter than ${target} h.`);
    if (state.services.some((s) => num(s.requiredKw) > 0 && !C.hasPriority(s)))
      warnings.push(
        'Facilities without a rank are always on the shut-off list. Rank them under Facility info.'
      );
    if (fridge && !keepIds.has(fridge.id))
      warnings.push(
        `Your medicine fridge “${fridge.name}” is on the shut-off list. Move medicines to a powered fridge or raise its rank.`
      );
    const lastsText = plan.noLoad
      ? '—'
      : plan.lastsHours === null
        ? `${plan.horizonHours}h+`
        : fmtDuration(plan.lastsHours);
    const remainText = !off
      ? 'Starts when power is off'
      : remaining === null
        ? 'More than the projection'
        : fmtDuration(remaining);
    const bar = (percent) =>
      `<div class="risk-bar"><i style="width:${percent === null ? 0 : Math.max(0, Math.min(100, percent))}%"></i></div>`;
    const started = off
      ? new Date(st.since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    let meds = '';
    if (isClinic) {
      const fridgeHours = !fridge
        ? null
        : keepIds.has(fridge.id)
          ? plan.lastsHours === null
            ? Infinity
            : plan.lastsHours
          : 0;
      const ctx = {
        outageHours: num(state.sim.outageHours),
        fridgePoweredHours: fridgeHours,
        holdHours: num(state.sim.holdHours),
      };
      const top = C.rankMedicines(state.batches, medicineData || [], state.sim.priceWeight)
        .slice(0, 5)
        .map((row) => {
          const outcome = C.medicineOutcome(row, ctx);
          return `<div class="status-row"><span class="rank-chip">#${row.rank}</span><span class="pick-name"><b>${esc(row.name)}</b><small>${row.info?.cold ? 'Cold chain' : row.info ? esc(row.info.storage) : 'Not in priority list'}</small></span><span class="outcome ${outcome.code}">${esc(outcome.text)}</span></div>`;
        })
        .join('');
      meds = `<section class="card">${cardHead('MEDICINES', 'Protect first')}<p class="intro">Highest-priority medicines and how they fare if the fridge loses power when this plan’s backup ends (${esc(state.sim.outageHours)} h outage). Full list is on the Simulation tab.</p><div class="status-list">${top || '<div class="empty">No medicines listed yet. Add them under Facility info.</div>'}</div></section>`;
    }
    return `
          <header class="clinic-title"><p class="eyebrow">${label.toUpperCase()} · CURRENT STATUS</p><h1>${esc(state.facility.name || label)}</h1><p>${esc(state.facility.location || 'Add a location under Facility info')} · tells you what to shut off when the grid fails</p></header>
          <section class="card status-card ${off ? 'off' : 'on'}"><div class="status-light"><i></i><div><p class="eyebrow">GRID POWER</p><h2>${off ? 'Power is OFF' : 'Power is ON'}</h2><p>${off ? `Since ${started} · ${fmtDuration(elapsed)} ago` : 'Click the button the moment the grid goes down.'}</p></div></div><button class="button status-toggle ${off ? 'back' : 'cut'}" data-action="${off ? 'status-on' : 'status-off'}">${off ? 'Power is back' : 'Power is off'}</button></section>
          <section class="ops-strip status-tiles"><div><small>BACKUP LASTS (THIS PLAN)</small><b>${lastsText}</b><span>${kw(kwSum(keep))} kept on</span></div><div class="${off && remaining !== null && remaining < 1 ? 'warn' : ''}"><small>TIME REMAINING</small><b>${remainText}</b><span>${off ? 'if you follow the list' : 'once power is off'}</span></div><div><small>BATTERY ${off ? 'NOW' : 'AT START'}</small><b>${now.batteryPercent === null ? '—' : `${Math.round(now.batteryPercent)}%`}</b>${bar(now.batteryPercent)}</div><div><small>GENERATOR FUEL ${off ? 'NOW' : 'AT START'}</small><b>${now.fuelPercent === null ? '—' : `${Math.round(now.fuelPercent)}%`}</b>${bar(now.fuelPercent)}</div></section>
          <section class="card status-target">${cardHead(off ? 'WHAT TO DO NOW' : 'READY PLAN', off ? 'Keep these on, shut these off' : 'What you would shut off if power fails')}<div class="status-target-row">${field('Keep power for at least', 'status.targetHours', st.targetHours, 'hours')}<p class="fine">Leave blank to keep as many top-ranked facilities as the generator and battery can carry. Enter hours to keep only as many as can last that long. Order always follows your ranks.</p></div>${warnings.map((w) => `<p class="alert status-warning" role="alert">${esc(w)}</p>`).join('')}</section>
          <div class="status-cols">
            <section class="card">${cardHead('KEEP POWERED', `${keep.length} ${keep.length === 1 ? 'facility' : 'facilities'} · ${kw(kwSum(keep))}`)}<div class="status-list">${keepRows || '<div class="empty">Nothing can be kept on with the backup entered.</div>'}</div></section>
            <section class="card">${cardHead('SHUT OFF', `${shut.length} ${shut.length === 1 ? 'facility' : 'facilities'} · saves ${kw(kwSum(shut))}`)}<div class="status-list">${shutRows || '<div class="empty">Nothing needs to be shut off. Backup covers everything.</div>'}</div>${off && shut.length ? `<p class="fine">${done.size} of ${shut.length} marked shut off.</p>` : ''}</section>
          </div>
          ${meds}
          <footer>Surge is a planning prototype, not an electrical controller. Estimates use the figures you entered, assume the list was followed from the moment power failed, and assume no recharging. Confirm with qualified staff before switching anything off, and never shut off life-support equipment based on this page alone.</footer>`;
  }

  // One simulation page for both facility types; clinics additionally get the medicine-priority section.
  function renderDashboard() {
    const isClinic = signedInType() === 'clinic';
    const label = isClinic ? 'Clinic' : 'Hospital';
    if (weather.status === 'idle') loadWeather();
    const info = clinicRun();
    const { ids, run } = info;
    const picked = new Set(ids);
    const locked = simState === 'running';
    const rooms = [...state.services].sort(
      (a, b) => (Number(a.priority) || 1e9) - (Number(b.priority) || 1e9)
    );
    const pickRows = rooms
      .map(
        (room) =>
          `<label class="pick-row ${picked.has(room.id) ? 'on' : ''}"><span class="rank-chip p${esc(room.priority)}">${C.hasPriority(room) ? `#${esc(room.priority)}` : 'Unranked'}</span><span class="pick-name"><b>${esc(room.name)}</b>${isClinic && room.id === state.cold.serviceId ? '<em>Medicine fridge</em>' : ''}<small>${esc((room.equipment || []).join(', ') || room.area || 'No equipment listed')}</small></span><span class="pick-kw">${kw(room.requiredKw)}</span><input type="checkbox" data-sim-room="${esc(room.id)}" aria-label="Give ${esc(room.name)} power" ${picked.has(room.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}></label>`
      )
      .join('');
    const loadPct =
      run.startSupplyKw > 0
        ? Math.min(100, (run.demandKw / run.startSupplyKw) * 100)
        : run.demandKw > 0
          ? 100
          : 0;
    const fridge = state.services.find((s) => s.id === state.cold.serviceId);
    const fridgeHours = !fridge
      ? null
      : picked.has(fridge.id)
        ? info.end === null
          ? Infinity
          : info.end
        : 0;
    const ctx = {
      outageHours: num(state.sim.outageHours),
      fridgePoweredHours: fridgeHours,
      holdHours: num(state.sim.holdHours),
    };
    const stock = C.rankMedicines(state.batches, medicineData || [], state.sim.priceWeight);
    const medRows = stock
      .map((row) => {
        const o = C.medicineOutcome(row, ctx);
        const i = row.info;
        return `<tr><td>${row.rank}</td><td><b>${esc(row.name)}</b>${i?.brand ? `<small>${esc(i.brand.split(';')[0])}</small>` : ''}</td><td><span class="tag ${i?.cold ? 'cold' : ''}">${i ? (i.cold ? 'Cold chain' : esc(i.storage)) : 'Not in list'}</span></td><td class="n">${i?.cold ? (i.days == null ? 'unconfirmed' : i.days) : '–'}</td><td class="n">${esc(row.quantity || '–')}</td><td class="n">${i?.cold ? row.score.toFixed(3) : '–'}</td><td><span class="outcome ${o.code}">${esc(o.text)}</span></td></tr>`;
      })
      .join('');
    const medNote = medicineData.length
      ? ''
      : 'The medicine priority list (medicines.js) could not be loaded.';
    const simMain = `
          <header class="clinic-title"><p class="eyebrow">${label.toUpperCase()} · OUTAGE SIMULATION</p><h1>${esc(state.facility.name || label)}</h1><p>${esc(state.facility.location || 'Add a location under Facility info')} · grid is down from the start of the run</p></header>
          <p class="how-to"><b>How it works</b><span><i>1</i>Tick what gets power</span><span><i>2</i>Run the simulation</span><span><i>3</i>Read how long backup lasts</span><em>When the grid really fails, open Current status.</em></p>
          <div class="clinic-top" id="sim">
            <section class="card chart-card">${cardHead('BACKUP POWER', 'Battery and generator fuel remaining', `<span class="simulation-tag">${simState === 'running' ? 'RUNNING…' : simState === 'done' ? 'RUN COMPLETE' : 'PROJECTION'}</span>`)}${clinicChart(info)}${clinicLegend(info)}${flowHtml(info)}</section>
            ${lastsCard(info)}
          </div>
          <section class="card choose-card ${simState} ${simState === 'done' && info.end !== null ? 'sim-lost' : ''}" id="choose">${cardHead('BEFORE YOU RUN', 'Choose what gets power', `<div class="choose-actions"><button class="button" data-action="sim-all" ${locked ? 'disabled' : ''}>Select all</button><button class="button" data-action="sim-rank" ${locked ? 'disabled' : ''}>Pick by rank</button>${simState === 'idle' ? '' : '<button class="button" data-action="sim-reset">Reset</button>'}<button class="button primary run-button" data-action="sim-run">${locked ? 'Stop' : simState === 'done' ? 'Run again' : 'Run simulation'}</button></div>`)}
            <p class="intro">Tick the facilities that should keep electricity. The runtime above updates as you choose. Ranks are the order your ${label.toLowerCase()} set; “Pick by rank” takes rank 1, 2, 3… until the sources can’t carry the next one.</p>
            <div class="pick-list">${pickRows || '<div class="empty">No facilities yet. Add them under Facility info.</div>'}</div>
            <div class="pick-foot"><span>Selected ${ids.length} of ${rooms.length} · load <b>${kw(run.demandKw)}</b> · sources start at <b>${kw(run.startSupplyKw)}</b></span><div class="load-bar ${run.demandKw > run.startSupplyKw + 1e-9 ? 'over' : ''}"><i style="width:${loadPct}%"></i></div><label class="source-toggle"><input type="checkbox" data-bind="power.generatorAutoStart" ${state.power.generatorAutoStart ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>Generator runs during the outage</span></label></div>
          </section>
          ${
            isClinic
              ? `<section class="card meds-card" id="meds">${cardHead('MEDICINE PRIORITY', 'Medicines to protect first')}
            <p class="intro">Cold-chain medicines are ranked for a power outage from how little time the label allows outside the fridge and from price. Medicines not found in the list are ranked after cold-chain ones because their storage is unknown. Edit your list under Facility info.</p>
            <div class="med-controls">${field('Outage length', 'sim.outageHours', state.sim.outageHours, 'hours')}${field('Fridge holds temperature (closed)', 'sim.holdHours', state.sim.holdHours, 'hours')}<label class="field"><span>Weight on price <small>${esc(state.sim.priceWeight)}% · rest on shelf life</small></span><input type="range" min="0" max="100" step="5" data-bind="sim.priceWeight" value="${esc(state.sim.priceWeight)}"></label></div>
            ${medNote ? `<p class="fine">${medNote}</p>` : ''}
            ${stock.length ? `<div class="table-wrap"><table class="med-table"><thead><tr><th>#</th><th>Medicine</th><th>Storage</th><th class="n">Safe days out of fridge</th><th class="n">Qty</th><th class="n">Score</th><th>After a ${esc(state.sim.outageHours)} h outage</th></tr></thead><tbody>${medRows}</tbody></table></div>` : '<div class="empty">No medicines listed yet. Add them under Facility info.</div>'}
            <p class="fine">${fridge ? `Outcomes assume “${esc(fridge.name)}” is your medicine fridge and loses power when the projected backup ends${picked.has(fridge.id) ? '' : ' (it is not ticked, so it has no backup power)'}. The “holds temperature” time is an assumption (4 hours in the SURGE reference); enter your own. This is a planning estimate, not a decision on whether a medicine can be used.` : 'Choose which facility is your medicine fridge under Facility info to see outcomes.'}</p>
          </section>`
              : ''
          }
          <footer>Surge is a planning prototype, not a medical device, electrical controller, or validated engineering tool. Backup-time estimates use the figures you entered and assume no recharging.${isClinic ? ' Follow manufacturer guidance and local clinical procedures for any storage, expiry, or use decision.' : ' Confirm facility figures with qualified staff.'}</footer>
`;

    document.getElementById('app').innerHTML = `
      <div class="clinic-shell">
        <aside class="clinic-side"><a class="brand" href="#top"><span class="brand-mark">⌁</span><span><b>SURGE</b><small>FACILITY RESILIENCE</small></span></a>
          <nav class="side-nav"><button class="${state.view === 'sim' ? 'active' : ''}" data-action="view" data-view="sim">Simulation</button><button class="${state.view === 'status' ? 'active' : ''}" data-action="view" data-view="status">Current status${state.status.powerOff ? ' <i class="nav-dot"></i>' : ''}</button>${isClinic && state.view === 'sim' ? '<a href="#meds">Medicine priority</a>' : ''}<button data-action="edit-setup">Facility info</button><button data-action="reset">Clear all data</button><button data-action="logout">Sign out <small>${esc(signedInEmail())}</small></button></nav>
          ${riskCard()}
        </aside>
        <main class="clinic-main" id="top">
          ${state.view === 'status' ? statusView(isClinic, label) : simMain}
        </main>
      </div>`;
    bind();
  }

  function simTick() {
    const info = clinicRun();
    const end = info.end ?? info.run.horizonHours;
    simClock = Math.min(end, simClock + info.axis / 100);
    if (simClock >= end - 1e-9) {
      clearInterval(simTimer);
      simTimer = null;
      simState = 'done';
      render();
      return;
    }
    if (!document.getElementById('sim-chart')) return;
    updateSimView(info);
    const remaining = document.getElementById('sim-remaining');
    if (remaining && info.end !== null)
      remaining.textContent = fmtDuration(Math.max(0, info.end - simClock));
  }

  function startSim() {
    if (clinicRun().run.noLoad) {
      alert('Tick at least one facility to power first.');
      return;
    }
    resetSim();
    simState = 'running';
    simTimer = setInterval(simTick, 100);
    render();
  }

  // A redraw replaces the whole page, so render() remembers which control had focus and restores it afterwards.
  function render() {
    const app = document.getElementById('app');
    const el = document.activeElement;
    let selector = '';
    if (el && app.contains(el)) {
      const q = (v) => CSS.escape(String(v));
      if (el.dataset.bind) selector = `[data-bind="${q(el.dataset.bind)}"]`;
      else if (el.dataset.room && el.dataset.roomField)
        selector = `[data-room="${q(el.dataset.room)}"][data-room-field="${q(el.dataset.roomField)}"]`;
      else if (el.name) selector = `[name="${q(el.name)}"]`;
    }
    const caret =
      selector && typeof el.selectionStart === 'number'
        ? [el.selectionStart, el.selectionEnd]
        : null;
    draw();
    if (!selector) return;
    const next = app.querySelector(selector);
    if (!next) return;
    next.focus({ preventScroll: true });
    if (caret) {
      try {
        next.setSelectionRange(...caret);
      } catch {
        /* Number inputs do not support selection. */
      }
    }
  }

  function draw() {
    if (!signedInEmail()) {
      renderLogin();
      return;
    }
    if (!state.setupDone) {
      renderSetup();
      return;
    }
    renderDashboard();
  }

  function setPath(path, value) {
    const parts = path.split('.');
    let obj = state;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts.at(-1)] = value;
  }
  function bind() {
    const app = document.getElementById('app');
    app.querySelectorAll('[data-bind]').forEach((el) => {
      if (!(el.dataset.bind.split('.')[0] in state)) return;
      el.addEventListener('input', () => {
        setPath(el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
        save();
      });
      el.addEventListener('change', () => {
        setPath(el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
        if (el.dataset.bind.startsWith('power.') && simState !== 'running') resetSim();
        if (el.dataset.bind === 'facility.location') {
          // A picked suggestion pins the exact coordinates for the forecast; hand-typed text falls back to a name search.
          const hit = placeSuggestions.find((p) => placeLabel(p) === el.value);
          state.facility.placeQuery = hit ? `${hit.lat},${hit.lon}` : '';
          weather = { status: 'idle' };
        }
        save();
        render();
      });
    });
    const locationInput = app.querySelector('[data-bind="facility.location"]');
    if (locationInput)
      locationInput.addEventListener('input', () => {
        clearTimeout(placeTimer);
        placeTimer = setTimeout(() => suggestPlaces(locationInput.value), 300);
      });
    app.querySelectorAll('[data-shut]').forEach((el) =>
      el.addEventListener('change', () => {
        const done = new Set(state.status.shutDone);
        if (el.checked) done.add(el.dataset.shut);
        else done.delete(el.dataset.shut);
        state.status.shutDone = [...done];
        save();
        render();
      })
    );
    app.querySelectorAll('[data-sim-room]').forEach((el) =>
      el.addEventListener('change', () => {
        const chosen = new Set(simSelection());
        if (el.checked) chosen.add(el.dataset.simRoom);
        else chosen.delete(el.dataset.simRoom);
        state.sim.selected = state.services.map((s) => s.id).filter((id) => chosen.has(id));
        resetSim();
        save();
        render();
      })
    );
    app.querySelectorAll('[data-room-field]').forEach((el) => {
      const update = () => {
        const room = state.services.find((s) => s.id === el.dataset.room);
        if (!room) return;
        const key = el.dataset.roomField;
        if (key === 'priority') {
          if (el.value) placeRank(room, Number(el.value));
          else {
            room.priority = '';
            normalizeRanks();
          }
        } else room[key] = key === 'on' ? el.checked : el.value;
        save();
      };
      el.addEventListener('input', update);
      el.addEventListener('change', () => {
        update();
        render();
      });
    });
    app.querySelectorAll('[data-form]').forEach((form) =>
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submit(form);
      })
    );
  }

  // Added once to the #app node. render() replaces the children of #app but never the node, so this listener stays in place.
  function onClick(e) {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === 'logout') {
      resetSim();
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* Storage may be unavailable. */
      }
      render();
      return;
    }
    if (button.dataset.action === 'edit-setup') {
      resetSim();
      state.setupDone = false;
    }
    if (button.dataset.action === 'finish-setup') {
      const problems = [];
      if (!state.facility.name.trim()) problems.push('enter the name');
      if (!state.services.length) problems.push('add at least one facility');
      if (problems.length) {
        alert(`To continue, ${problems.join(' and ')}.`);
        return;
      }
      state.setupDone = true;
      window.scrollTo(0, 0);
    }
    if (button.dataset.action === 'view') {
      state.view = button.dataset.view === 'status' ? 'status' : 'sim';
      resetSim();
      window.scrollTo(0, 0);
    }
    if (button.dataset.action === 'status-off')
      state.status = { ...state.status, powerOff: true, since: Date.now(), shutDone: [] };
    if (button.dataset.action === 'status-on')
      state.status = { ...state.status, powerOff: false, since: null, shutDone: [] };
    if (button.dataset.action === 'sim-run') {
      if (simState === 'running') {
        resetSim();
        render();
      } else startSim();
      return;
    }
    if (button.dataset.action === 'sim-reset') {
      resetSim();
      render();
      return;
    }
    if (button.dataset.action === 'sim-all') {
      state.sim.selected = state.services.filter((s) => num(s.requiredKw) > 0).map((s) => s.id);
      resetSim();
    }
    if (button.dataset.action === 'sim-rank') {
      state.sim.selected = C.pickByRank(state);
      resetSim();
    }
    if (button.dataset.action === 'weather') {
      weather = { status: 'idle' };
      render();
      return;
    }
    if (button.dataset.action === 'remove-room') {
      state.services = state.services.filter((s) => s.id !== id);
      state.sim.selected = state.sim.selected && state.sim.selected.filter((s) => s !== id);
      resetSim();
      normalizeRanks();
      if (state.cold.serviceId === id) state.cold.serviceId = '';
    }
    if (button.dataset.action === 'remove-batch')
      state.batches = state.batches.filter((b) => b.id !== id);
    if (button.dataset.action === 'load-sample') {
      if (state.services.length && !confirm('Replace what you have entered with sample data?'))
        return;
      loadSample();
      window.scrollTo(0, 0);
    }
    if (button.dataset.action === 'reset') {
      if (!confirm('Clear all Surge data saved in this browser?')) return;
      state = blank();
      resetSim();
    }
    save();
    render();
  }

  // Forms and sample data.

  function submit(form) {
    const type = form.dataset.form;
    const val = (key) => form.querySelector(`[data-bind="${key}"]`)?.value ?? '';
    if (type === 'room') {
      const required = num(val('new.requiredKw'));
      const minimum = num(val('new.minimumKw'));
      const priority = form.elements.priority.value;
      if (!val('new.name').trim() || required <= 0 || !priority || minimum > required) {
        alert(
          'Enter a facility name, a required power value, a minimum no higher than required power, and a rank.'
        );
        return;
      }
      const room = {
        id: newId(),
        name: val('new.name').trim(),
        area: '',
        equipment: [...form.querySelectorAll('input[name=equipment]:checked')].map(
          (box) => box.value
        ),
        requiredKw: String(required),
        minimumKw: String(minimum),
        priority: '',
        on: true,
      };
      state.services.push(room);
      placeRank(room, Number(priority));
    }
    if (type === 'medicine') {
      if (!val('batch.name').trim()) {
        alert('Enter the medicine name.');
        return;
      }
      state.batches.push({
        id: newId(),
        name: val('batch.name').trim(),
        quantity: val('batch.quantity'),
      });
    }
    save();
    render();
  }

  // Made-up figures that let a new user see every screen working in one click. They are not real equipment data.
  const SAMPLE_POWER = {
    hospital: {
      generatorRatedKw: '5',
      generatorAutoStart: true,
      fuelLitres: '30',
      fuelBurn: '2',
      capacityKwh: '12',
      storedKwh: '11',
    },
    clinic: {
      generatorRatedKw: '3',
      generatorAutoStart: true,
      fuelLitres: '8',
      fuelBurn: '1.5',
      capacityKwh: '10',
      storedKwh: '8',
    },
  };
  const SAMPLE_ROOMS = {
    hospital: [
      ['Intensive care unit', 3.5, ['Medical devices', 'Lights']],
      ['Operating theatre', 4.5, ['Medical devices', 'Air conditioning']],
      ['Emergency department', 3, ['Medical devices', 'Lights']],
      ['Blood bank & vaccine cold room', 1.2, ['Refrigeration']],
      ['General ward', 3, ['Lights', 'Fans']],
      ['Laboratory', 2.5, ['Medical devices', 'Refrigeration']],
      ['Pharmacy', 1, ['Lights', 'Computers / IT']],
      ['Outpatient department', 2, ['Lights', 'Fans']],
    ],
    clinic: [
      ['Vaccine fridge', 0.4, ['Refrigeration']],
      ['Consultation room', 1.2, ['Lights', 'Fans']],
      ['Treatment room', 1, ['Medical devices', 'Lights']],
      ['Pharmacy / dispensary', 0.5, ['Lights', 'Computers / IT']],
      ['Laboratory', 2.5, ['Medical devices']],
      ['Waiting area', 0.6, ['Lights', 'Fans']],
    ],
  };
  const SAMPLE_MEDICINES = [
    ['Insulin', 40],
    ['Penicillin injection', 20],
    ['Vitamin K injection', 15],
    ['Paracetamol', 200],
    ['Oxytocin', 30],
    ['Ceftriaxone', 100],
  ];

  function loadSample() {
    const type = signedInType() === 'clinic' ? 'clinic' : 'hospital';
    const services = SAMPLE_ROOMS[type].map(([name, requiredKw, equipment], i) => ({
      id: newId(),
      name,
      area: '',
      equipment,
      requiredKw: String(requiredKw),
      minimumKw: String(requiredKw),
      priority: i + 1,
      on: true,
    }));
    state = {
      ...blank(),
      setupDone: true,
      facility: { name: `Sample ${FACILITY_TYPES[type]}`, location: 'Pune' },
      power: { ...blank().power, ...SAMPLE_POWER[type] },
      services,
    };
    if (type === 'clinic') {
      state.cold.serviceId = services[0].id;
      state.batches = SAMPLE_MEDICINES.map(([name, quantity]) => ({
        id: newId(),
        name,
        quantity: String(quantity),
      }));
    }
    resetSim();
  }

  // Start-up.

  // While power is marked off, refresh the Current status page every 30 s so elapsed time, battery and fuel stay current.
  setInterval(() => {
    if (
      signedInEmail() &&
      state.setupDone &&
      state.view === 'status' &&
      state.status.powerOff &&
      document.activeElement?.tagName !== 'INPUT'
    )
      render();
  }, 30000);
  normalizeRanks(); // Saves from older versions could hold duplicate ranks, so renumber them.
  // The service worker caches the app files so Surge works offline. It needs https or localhost, so file:// pages skip it (they already work offline).
  if ('serviceWorker' in navigator && location.protocol !== 'file:')
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* the app still works online */
    });
  document.getElementById('app').addEventListener('click', onClick);
  render();
})();
