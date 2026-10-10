'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core');

// Minimal plan: grid is always down in the projection, so only the power figures and rooms matter.
const plan = (power, services) => ({
  power: {
    capacityKwh: '',
    storedKwh: '',
    reservePercent: '',
    dischargeKw: '',
    efficiencyPercent: '',
    fuelLitres: '',
    fuelBurn: '',
    generatorRatedKw: '',
    generatorAutoStart: false,
    ...power,
  },
  services,
});

test('ranks: any whole number from 1 up counts, blank or zero does not', () => {
  assert.equal(C.hasPriority({ priority: 1 }), true);
  assert.equal(C.hasPriority({ priority: 7 }), true);
  assert.equal(C.hasPriority({ priority: '' }), false);
  assert.equal(C.hasPriority({ priority: 0 }), false);
  assert.equal(C.hasPriority({}), false);
});

test('backup projection: battery alone lasts stored energy divided by selected load', () => {
  const rooms = [
    { id: 'a', requiredKw: '2', priority: 1 },
    { id: 'b', requiredKw: '5', priority: 2 },
  ];
  const state = plan(
    { capacityKwh: '10', storedKwh: '10', dischargeKw: '10', efficiencyPercent: '100' },
    rooms
  );
  assert.equal(C.backupProjection(state, ['a']).lastsHours, 5);
  assert.equal(C.backupProjection(state, ['a', 'b']).lastsHours, 1.25);
  assert.equal(C.backupProjection(state, []).noLoad, true);
});

test('backup projection: battery never drops below the entered reserve, even at 80% efficiency', () => {
  const state = plan(
    {
      capacityKwh: '4',
      storedKwh: '4',
      reservePercent: '25',
      dischargeKw: '10',
      efficiencyPercent: '80',
    },
    [{ id: 'pump', requiredKw: '1', priority: 1 }]
  );
  const run = C.backupProjection(state, ['pump']);
  assert.ok(run.series.every((step) => step.batteryKwh >= 1 - 1e-9));
  assert.equal(run.limit, 'battery');
});

test('backup projection: generator fuel then battery, and the reason it ends', () => {
  const state = plan(
    {
      generatorAutoStart: true,
      generatorRatedKw: '1',
      fuelLitres: '2',
      fuelBurn: '1',
      capacityKwh: '3',
      storedKwh: '3',
      dischargeKw: '10',
      efficiencyPercent: '100',
    },
    [{ id: 'a', requiredKw: '2', priority: 1 }]
  );
  const run = C.backupProjection(state, ['a']);
  assert.equal(run.lastsHours, 2.5);
  assert.equal(run.limit, 'both');
  assert.equal(run.series[0].fuelPercent, 100);
  assert.ok(
    run.series[8].fuelPercent === 0 && run.series[8].batteryPercent < run.series[0].batteryPercent
  );
  const tooBig = C.backupProjection(
    plan({ capacityKwh: '1', storedKwh: '1', dischargeKw: '1' }, [
      { id: 'a', requiredKw: '5', priority: 1 },
    ]),
    ['a']
  );
  assert.equal(tooBig.lastsHours, 0);
  assert.equal(tooBig.limit, 'capacity');
});

test('backup projection: with no reserve, efficiency or discharge limit entered, the battery is fully usable at up to 1C', () => {
  const rooms = [
    { id: 'a', requiredKw: '2', priority: 1 },
    { id: 'big', requiredKw: '12', priority: 2 },
  ];
  const state = plan({ capacityKwh: '10', storedKwh: '10' }, rooms);
  const run = C.backupProjection(state, ['a']);
  assert.equal(run.lastsHours, 5); // 10 kWh at 2 kW, no reserve held back, 100% efficient
  assert.equal(run.startSupplyKw, 10); // 1C: a 10 kWh battery can deliver 10 kW
  assert.equal(C.backupProjection(state, ['big']).limit, 'capacity');
});

test('backup projection: a generator that is switched off supplies nothing', () => {
  const state = plan(
    { generatorAutoStart: false, generatorRatedKw: '5', fuelLitres: '50', fuelBurn: '1' },
    [{ id: 'a', requiredKw: '1', priority: 1 }]
  );
  assert.equal(C.backupProjection(state, ['a']).lastsHours, 0);
});

test('backup projection: blank fuel consumption means the generator never runs out', () => {
  const state = plan({ generatorAutoStart: true, generatorRatedKw: '2', fuelLitres: '5' }, [
    { id: 'a', requiredKw: '1', priority: 1 },
  ]);
  const run = C.backupProjection(state, ['a'], 24);
  assert.equal(run.lastsHours, null);
  assert.equal(run.series.at(-1).fuelPercent, 100);
});

test('pick by rank stops at the first room that does not fit', () => {
  const state = plan(
    { capacityKwh: '100', storedKwh: '100', dischargeKw: '3', efficiencyPercent: '100' },
    [
      { id: 'third', requiredKw: '0.5', priority: 3 },
      { id: 'first', requiredKw: '1', priority: 1 },
      { id: 'second', requiredKw: '2.5', priority: 2 },
      { id: 'tiny', requiredKw: '0.1', priority: 4 },
    ]
  );
  assert.deepEqual(C.pickByRank(state), ['first']);
});

test('pick by rank honours ranks above 4 in order and ignores unranked rooms', () => {
  const rooms = [6, 5, 4, 3, 2, 1].map((rank) => ({
    id: `r${rank}`,
    requiredKw: '1',
    priority: rank,
  }));
  rooms.push({ id: 'unranked', requiredKw: '0.1', priority: '' });
  const state = plan(
    { capacityKwh: '100', storedKwh: '100', dischargeKw: '3', efficiencyPercent: '100' },
    rooms
  );
  assert.deepEqual(C.pickByRank(state), ['r1', 'r2', 'r3']);
});

test('pick for duration keeps top ranks only while the backup still reaches the target hours', () => {
  const state = plan(
    { capacityKwh: '10', storedKwh: '10', dischargeKw: '10', efficiencyPercent: '100' },
    [
      { id: 'first', requiredKw: '1', priority: 1 },
      { id: 'second', requiredKw: '1', priority: 2 },
      { id: 'third', requiredKw: '3', priority: 3 },
    ]
  );
  assert.deepEqual(C.pickForDuration(state, 4), ['first', 'second']); // 5 kW would last 2 h, 2 kW lasts 5 h
  assert.deepEqual(C.pickForDuration(state, 10), ['first']); // 1 kW lasts 10 h; 2 kW only 5 h
  assert.deepEqual(C.pickForDuration(state, 11), []); // not even rank 1 reaches 11 h
  assert.deepEqual(C.pickForDuration(state, 0), C.pickByRank(state));
});

test('outage risk rises with thunder, gusts, rain and alerts and is capped', () => {
  assert.deepEqual(C.outageRisk({ condition: { code: 1000 }, gust_kph: 10 }), {
    percent: 3,
    level: 'low',
    reasons: [],
  });
  const storm = C.outageRisk({ condition: { code: 1087 }, gust_kph: 55, precip_mm: 6 }, 1);
  assert.equal(storm.percent, 3 + 40 + 25 + 10 + 15);
  assert.equal(storm.level, 'high');
  assert.deepEqual(storm.reasons, [
    'Thunderstorm',
    'Gusts 55 km/h',
    'Heavy rain',
    'Weather alert active',
  ]);
  assert.equal(
    C.outageRisk({ condition: { code: 1087 }, gust_kph: 90, precip_mm: 9, chance_of_snow: 90 }, 2)
      .percent,
    95
  );
  assert.equal(C.outageRisk({ gust_kph: 40 }).level, 'moderate');
  assert.equal(C.outageRisk(undefined).percent, 3);
});

const DATASET = [
  { drug: 'insulin lispro', brand: 'Humalog', cold: true, days: 28, urgency: 0.7, pscore: 0.25 },
  {
    drug: 'adalimumab',
    brand: 'Humira;Hyrimoz',
    cold: true,
    days: 30,
    urgency: 0.62,
    pscore: 0.81,
  },
  { drug: 'oxytocin', brand: '', cold: false, days: null, urgency: 0, pscore: 0 },
  { drug: 'pegloticase', brand: 'Krystexxa', cold: true, days: null, urgency: 1, pscore: 0.9 },
];

test('medicine lookup matches generic name or any brand, ignoring case and spacing', () => {
  assert.equal(C.findMedicine(' Insulin Lispro ', DATASET).drug, 'insulin lispro');
  assert.equal(C.findMedicine('hyrimoz', DATASET).drug, 'adalimumab');
  assert.equal(C.findMedicine('unknown', DATASET), null);
  assert.equal(C.findMedicine('x', null), null);
});

test('everyday medicine names resolve to the clinical list, and combined names stay cautious', () => {
  const dataset = [
    {
      drug: 'insulin glargine',
      brand: 'Lantus',
      cold: true,
      days: 28,
      urgency: 0.7,
      pscore: 0.1,
      storage: 'refrigerated',
    },
    {
      drug: 'insulin degludec',
      brand: 'Tresiba',
      cold: true,
      days: 21,
      urgency: 0.75,
      pscore: 0.6,
      storage: 'refrigerated',
    },
    {
      drug: 'acetaminophen',
      brand: '',
      cold: false,
      days: null,
      urgency: 0,
      pscore: 0,
      storage: 'room',
    },
  ];
  const common = [
    { name: 'Insulin', members: ['insulin glargine', 'insulin degludec'] },
    { name: 'Paracetamol', members: ['acetaminophen'] },
    { name: 'Nothing here', members: ['not in the list'] },
  ];
  const list = C.withCommonNames(dataset, common);
  assert.equal(list.length, dataset.length + 2); // the entry with no matching members is dropped
  const insulin = C.findMedicine('insulin', list);
  assert.equal(insulin.cold, true);
  assert.equal(insulin.days, 21); // shortest known time outside the fridge
  assert.equal(insulin.urgency, 0.75); // highest urgency
  assert.ok(Math.abs(insulin.pscore - 0.35) < 1e-9); // average price score
  assert.equal(C.findMedicine(' PARACETAMOL ', list).storage, 'room'); // case and spacing do not matter
  assert.equal(C.findMedicine('Lantus', list).drug, 'insulin glargine'); // clinical and brand names still work
  const unconfirmed = C.withCommonNames(
    [{ ...dataset[0], days: null }, dataset[1]],
    [{ name: 'Insulin', members: ['insulin glargine', 'insulin degludec'] }]
  );
  assert.equal(C.findMedicine('insulin', unconfirmed).days, null); // one unconfirmed member makes the whole name unconfirmed
  const ranked = C.rankMedicines([{ name: 'Paracetamol' }, { name: 'Insulin' }], list, 70);
  assert.deepEqual(
    ranked.map((r) => r.name),
    ['Insulin', 'Paracetamol']
  );
});

test('medicine priority ranks cold chain by weighted urgency and price; outcomes follow fridge power', () => {
  const stock = [
    { name: 'Oxytocin' },
    { name: 'Mystery drug' },
    { name: 'insulin lispro' },
    { name: 'humira' },
  ];
  const ranked = C.rankMedicines(stock, DATASET, 70);
  assert.deepEqual(
    ranked.map((r) => r.name),
    ['humira', 'insulin lispro', 'Mystery drug', 'Oxytocin']
  );
  assert.deepEqual(
    ranked.map((r) => r.rank),
    [1, 2, 3, 4]
  );
  assert.ok(Math.abs(ranked[0].score - (0.3 * 0.62 + 0.7 * 0.81)) < 1e-9);
  const ctx = (fridgePoweredHours) => ({ outageHours: 12, fridgePoweredHours, holdHours: 4 });
  assert.equal(C.medicineOutcome(ranked[0], ctx(Infinity)).code, 'ok');
  assert.equal(C.medicineOutcome(ranked[0], ctx(8)).code, 'ok');
  assert.equal(C.medicineOutcome(ranked[0], ctx(0)).code, 'risk');
  assert.equal(
    C.medicineOutcome(ranked[0], { outageHours: 24 * 40, fridgePoweredHours: 0, holdHours: 4 })
      .code,
    'lost'
  );
  assert.equal(
    C.medicineOutcome(C.rankMedicines([{ name: 'pegloticase' }], DATASET)[0], ctx(0)).code,
    'lost'
  );
  assert.equal(C.medicineOutcome(ranked[0], ctx(null)).code, 'unlinked');
  assert.equal(C.medicineOutcome(ranked[3], ctx(0)).code, 'none');
  assert.equal(C.medicineOutcome(ranked[2], ctx(0)).code, 'unknown');
});

test('price weight changes the order of cold-chain medicines', () => {
  const stock = [{ name: 'insulin lispro' }, { name: 'adalimumab' }];
  assert.equal(C.rankMedicines(stock, DATASET, 100)[0].name, 'adalimumab'); // higher price score
  assert.equal(C.rankMedicines(stock, DATASET, 0)[0].name, 'insulin lispro'); // higher shelf-life urgency
});

test('demo login needs a username, a 6+ character password, and a hospital or clinic type', () => {
  assert.equal(C.validateDemoLogin('demo.user', 'surge-demo', 'clinic'), true);
  assert.equal(C.validateDemoLogin('demo', 'surge-demo', 'hospital'), true);
  assert.equal(C.validateDemoLogin('demo@gmail.com', 'surge-demo', 'clinic'), false);
  assert.equal(C.validateDemoLogin('ab', 'surge-demo', 'clinic'), false);
  assert.equal(C.validateDemoLogin('demo', 'short', 'clinic'), false);
  assert.equal(C.validateDemoLogin('demo', 'surge-demo', ''), false);
  assert.equal(C.validateDemoLogin('', '', ''), false);
});
