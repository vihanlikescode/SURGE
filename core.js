// core.js
// All the calculations for Surge are in this file.
// Nothing here touches the page, so the same code runs in the browser
// (as window.SurgeCore) and in the tests (with require).

(function (root, factory) {
  const core = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = core;
  }

  if (root) {
    root.SurgeCore = core;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The simulation moves forward in steps of 15 minutes (0.25 hours).
  const STEP = 0.25;

  // Turns a value into a number that is never negative.
  // Blank, text or bad input becomes 0.
  function positive(value) {
    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      return number;
    }

    return 0;
  }

  // A rank is a whole number from 1 up. Rank 1 gets power first.
  function hasPriority(room) {
    const rank = Number(room.priority);

    return Number.isInteger(rank) && rank >= 1;
  }

  // Rooms that need power and have a rank, sorted so rank 1 comes first.
  function roomsByRank(state) {
    const rooms = [];

    for (const room of state.services) {
      if (positive(room.requiredKw) > 0 && hasPriority(room)) {
        rooms.push(room);
      }
    }

    rooms.sort(function (a, b) {
      return Number(a.priority) - Number(b.priority);
    });

    return rooms;
  }

  // ---------------------------------------------------------------
  // Backup power: how long can the generator and battery last?
  // ---------------------------------------------------------------

  // Reads the power figures the user entered and fills in simple defaults.
  function getBackupSources(state) {
    const power = state.power;
    const capacity = positive(power.capacityKwh);

    let reservePercent = positive(power.reservePercent);
    if (reservePercent > 100) {
      reservePercent = 100;
    }

    let efficiencyPercent = positive(power.efficiencyPercent);
    if (efficiencyPercent === 0) {
      efficiencyPercent = 100; // blank means 100%
    }
    if (efficiencyPercent > 100) {
      efficiencyPercent = 100;
    }

    // If no discharge limit is entered, assume the battery can give
    // its capacity in kW (the usual "1C" rate).
    let dischargeLimit = positive(power.dischargeKw);
    if (dischargeLimit === 0) {
      dischargeLimit = capacity;
    }

    let generatorKw = 0;
    if (power.generatorAutoStart) {
      generatorKw = positive(power.generatorRatedKw);
    }

    let storedKwh = positive(power.storedKwh);
    if (storedKwh > capacity) {
      storedKwh = capacity;
    }

    return {
      cap: capacity,
      reserve: (capacity * reservePercent) / 100,
      efficiency: efficiencyPercent / 100,
      dischargeLimit: dischargeLimit,
      genKw: generatorKw,
      burn: positive(power.fuelBurn),
      fuel0: positive(power.fuelLitres),
      soc0: storedKwh,
    };
  }

  // Adds up the power needed by the rooms the user picked.
  function selectedDemand(state, selectedIds) {
    let total = 0;

    for (const room of state.services) {
      if (selectedIds.includes(room.id)) {
        total = total + positive(room.requiredKw);
      }
    }

    return total;
  }

  // Pretends the grid goes down at hour 0 and steps forward every 15 minutes.
  // At each step the generator (while it has fuel) and the battery must cover
  // the picked rooms. The first step they can't is when power ends.
  // The battery is never recharged.
  function backupProjection(state, selectedIds, horizonHours = 72) {
    const demand = selectedDemand(state, selectedIds);
    const source = getBackupSources(state);

    let soc = source.soc0; // battery energy left, in kWh
    let fuel = source.fuel0; // fuel left, in litres

    const series = [];
    let lastsHours = null;
    let limit = null;

    const steps = Math.round(horizonHours / STEP);

    for (let i = 0; i <= steps; i++) {
      const hour = i * STEP;

      // The generator only runs while it still has fuel.
      let generatorKw = 0;
      if (source.genKw > 0 && fuel > 0) {
        generatorKw = source.genKw;
      }

      // The battery can give energy above the reserve, limited by its discharge rate.
      let batteryKw = 0;
      if (source.cap > 0) {
        const usable = Math.max(0, soc - source.reserve);
        const fromEnergy = (usable * source.efficiency) / STEP;
        batteryKw = Math.min(source.dischargeLimit, fromEnergy);
      }

      const supply = generatorKw + batteryKw;
      const covered = demand > 0 && supply >= demand - 0.000000001;

      // How much the battery really gives once the generator has done its share.
      let drawKw = 0;
      if (demand > 0) {
        drawKw = Math.min(batteryKw, Math.max(0, demand - generatorKw));
      }

      let batteryKwh = null;
      let batteryPercent = null;
      if (source.cap > 0) {
        batteryKwh = soc;
        batteryPercent = (soc / source.cap) * 100;
      }

      let fuelLitres = null;
      let fuelPercent = null;
      if (source.fuel0 > 0) {
        fuelLitres = fuel;
        fuelPercent = (fuel / source.fuel0) * 100;
      }

      series.push({
        hour: hour,
        batteryKwh: batteryKwh,
        batteryPercent: batteryPercent,
        fuelLitres: fuelLitres,
        fuelPercent: fuelPercent,
        supplyKw: supply,
        demandKw: demand,
        covered: covered,
        genKw: generatorKw,
        drawKw: drawKw,
      });

      // Nothing selected, so there is nothing to run out of.
      if (demand <= 0) {
        continue;
      }

      // Power ends at this step. Work out why, then stop.
      if (!covered) {
        lastsHours = hour;

        const fuelOut = source.genKw > 0 && fuel <= 0;
        const batteryOut = source.cap === 0 || soc - source.reserve <= 0.000000001;

        if (i === 0) {
          limit = 'capacity'; // the sources can't carry the load even at the start
        } else if (fuelOut && batteryOut) {
          limit = 'both';
        } else if (fuelOut) {
          limit = 'fuel';
        } else {
          limit = 'battery';
        }

        break;
      }

      // Use up some battery and fuel for the next step.
      if (source.cap > 0) {
        soc = Math.max(0, soc - (drawKw * STEP) / source.efficiency);
      } else {
        soc = 0;
      }

      if (generatorKw > 0 && source.burn > 0) {
        fuel = Math.max(0, fuel - source.burn * STEP);
      }
    }

    let reservePercent = null;
    if (source.cap > 0) {
      reservePercent = (source.reserve / source.cap) * 100;
    }

    return {
      series: series,
      lastsHours: lastsHours,
      limit: limit,
      noLoad: demand <= 0,
      demandKw: demand,
      horizonHours: horizonHours,
      startSupplyKw: series[0].supplyKw,
      reservePercent: reservePercent,
      sources: source,
    };
  }

  // Picks rooms in rank order (1, 2, 3...) and stops at the first one
  // that no longer fits the power available at the start.
  function pickByRank(state) {
    const startSupply = backupProjection(state, []).startSupplyKw;
    const picked = [];
    let total = 0;

    for (const room of roomsByRank(state)) {
      const need = positive(room.requiredKw);

      if (total + need > startSupply + 0.000000001) {
        break;
      }

      total = total + need;
      picked.push(room.id);
    }

    return picked;
  }

  // Same idea, but a room is only kept if the backup still lasts at least
  // `hours` hours with that room included.
  function pickForDuration(state, hours) {
    const target = positive(hours);

    if (target <= 0) {
      return pickByRank(state);
    }

    const horizon = Math.max(72, Math.ceil(target) + 1);
    const picked = [];

    for (const room of roomsByRank(state)) {
      const trial = picked.concat([room.id]);
      const run = backupProjection(state, trial, horizon);

      if (run.lastsHours !== null && run.lastsHours < target) {
        break;
      }

      picked.push(room.id);
    }

    return picked;
  }

  // ---------------------------------------------------------------
  // Medicine priority for a power outage
  // (ported from the team's priority.py ranking)
  // ---------------------------------------------------------------

  // Lower case and trim so "  Insulin " matches "insulin".
  function cleanName(text) {
    return String(text || '')
      .trim()
      .toLowerCase();
  }

  // Puts everyday names (Insulin, Paracetamol, Adrenaline) in front of the
  // clinical list. Each everyday name points at one or more clinical rows.
  // When it points at several rows we stay careful:
  //  - it is cold if any row is cold
  //  - we use the shortest known time outside the fridge
  //    (unconfirmed if any row is unconfirmed)
  //  - we use the highest urgency and the average price score
  function withCommonNames(dataset, common) {
    const extras = [];

    for (const entry of common || []) {
      // find the clinical rows this name points at
      const members = [];
      for (const name of entry.members) {
        for (const row of dataset) {
          if (cleanName(row.drug) === cleanName(name)) {
            members.push(row);
            break;
          }
        }
      }

      if (members.length === 0) {
        continue;
      }

      let cold = false;
      let allDaysKnown = true;
      let shortestDays = Infinity;
      let highestUrgency = 0;
      let priceTotal = 0;

      for (const member of members) {
        if (member.cold) {
          cold = true;
        }
        if (member.days === null || member.days === undefined) {
          allDaysKnown = false;
        } else if (member.days < shortestDays) {
          shortestDays = member.days;
        }
        if (member.urgency > highestUrgency) {
          highestUrgency = member.urgency;
        }
        priceTotal = priceTotal + member.pscore;
      }

      extras.push({
        drug: cleanName(entry.name),
        brand: '',
        common: true,
        display: entry.name,
        cold: cold,
        storage: cold ? 'refrigerated' : members[0].storage,
        days: allDaysKnown ? shortestDays : null,
        urgency: highestUrgency,
        pscore: priceTotal / members.length,
      });
    }

    return extras.concat(dataset);
  }

  // Finds a medicine by its drug name, then by brand name.
  function findMedicine(name, dataset) {
    const wanted = cleanName(name);

    if (wanted === '' || !Array.isArray(dataset)) {
      return null;
    }

    for (const row of dataset) {
      if (cleanName(row.drug) === wanted) {
        return row;
      }
    }

    for (const row of dataset) {
      const brands = String(row.brand || '').split(';');
      for (const brand of brands) {
        if (cleanName(brand) === wanted) {
          return row;
        }
      }
    }

    return null;
  }

  // 0 = cold chain, 1 = not in the list (storage unknown), 2 = room temperature
  function medicineGroup(row) {
    if (row.info && row.info.cold) {
      return 0;
    }
    if (row.info) {
      return 2;
    }
    return 1;
  }

  // Ranks the clinic's medicines. Cold-chain ones come first, ordered by score.
  // score = (1 - w) * urgency + w * price score, where w is the price weight.
  function rankMedicines(stock, dataset, priceWeightPercent = 70) {
    let weight = Number(priceWeightPercent) || 0;
    if (weight < 0) {
      weight = 0;
    }
    if (weight > 100) {
      weight = 100;
    }
    weight = weight / 100;

    const rows = [];

    for (const item of stock) {
      const info = findMedicine(item.name, dataset);

      let score = 0;
      if (info && info.cold) {
        score = (1 - weight) * info.urgency + weight * info.pscore;
      }

      rows.push({ ...item, info: info, score: score });
    }

    rows.sort(function (a, b) {
      const groupDifference = medicineGroup(a) - medicineGroup(b);
      if (groupDifference !== 0) {
        return groupDifference;
      }
      return b.score - a.score;
    });

    for (let i = 0; i < rows.length; i++) {
      rows[i].rank = i + 1;
    }

    return rows;
  }

  // What happens to a medicine during an outage?
  // fridgePoweredHours is null if no fridge facility is linked,
  // and Infinity if the fridge stays powered the whole time.
  function medicineOutcome(row, settings) {
    const outageHours = settings.outageHours;
    const fridgePoweredHours = settings.fridgePoweredHours;
    const holdHours = settings.holdHours;

    if (!row.info) {
      return { code: 'unknown', text: 'Not in the priority list, check the label' };
    }

    if (!row.info.cold) {
      return { code: 'none', text: 'No refrigeration needed' };
    }

    if (fridgePoweredHours === null) {
      return { code: 'unlinked', text: 'Link your fridge facility' };
    }

    // time without power, minus the time a closed fridge stays cold
    const unpowered = Math.max(0, positive(outageHours) - fridgePoweredHours);
    const outOfRange = Math.max(0, unpowered - positive(holdHours));

    if (outOfRange === 0) {
      return { code: 'ok', text: 'Held in range' };
    }

    if (row.info.days === null || row.info.days === undefined) {
      return { code: 'lost', text: 'The label gives no safe time, review' };
    }

    if (outOfRange < row.info.days * 24) {
      return { code: 'risk', text: 'Out of range, check the label' };
    }

    return { code: 'lost', text: 'Past the label limit, review' };
  }

  // ---------------------------------------------------------------
  // Chance of a power cut in the next hour
  // ---------------------------------------------------------------

  // Adds up points for bad weather in one forecast hour (a WeatherAPI hour object).
  // This is only an estimate from the weather. It does not know about the grid,
  // because no free service publishes real outage chances.
  function outageRisk(hour, alertCount = 0) {
    let score = 3;
    const reasons = [];

    let weatherCode = 0;
    if (hour && hour.condition) {
      weatherCode = Number(hour.condition.code);
    }

    const thunderCodes = [1087, 1273, 1276, 1279, 1282];
    if (thunderCodes.includes(weatherCode)) {
      score = score + 40;
      reasons.push('Thunderstorm');
    }

    const gust = positive(hour ? hour.gust_kph : 0);
    if (gust >= 70) {
      score = score + 35;
      reasons.push('Gusts ' + Math.round(gust) + ' km/h');
    } else if (gust >= 50) {
      score = score + 25;
      reasons.push('Gusts ' + Math.round(gust) + ' km/h');
    } else if (gust >= 35) {
      score = score + 12;
      reasons.push('Gusts ' + Math.round(gust) + ' km/h');
    }

    const rainMm = positive(hour ? hour.precip_mm : 0);
    const rainChance = positive(hour ? hour.chance_of_rain : 0);
    if (rainMm >= 5) {
      score = score + 10;
      reasons.push('Heavy rain');
    } else if (rainChance >= 80) {
      score = score + 6;
      reasons.push('Rain likely');
    }

    const snowChance = positive(hour ? hour.chance_of_snow : 0);
    if (snowChance >= 50) {
      score = score + 15;
      reasons.push('Snow likely');
    }

    if (alertCount > 0) {
      score = score + 15;
      reasons.push('Weather alert active');
    }

    const percent = Math.min(95, score);

    let level = 'high';
    if (percent < 15) {
      level = 'low';
    } else if (percent < 40) {
      level = 'moderate';
    }

    return { percent: percent, level: level, reasons: reasons };
  }

  // ---------------------------------------------------------------
  // Demo sign-in check
  // ---------------------------------------------------------------

  // Not real security. It only checks the form is filled in sensibly.
  function validateDemoLogin(username, password, facilityType) {
    const name = String(username || '').trim();
    const nameIsFine = /^[A-Za-z0-9._-]{3,32}$/.test(name);
    const passwordIsFine = String(password || '').length >= 6;
    const typeIsFine = facilityType === 'hospital' || facilityType === 'clinic';

    return nameIsFine && passwordIsFine && typeIsFine;
  }

  return {
    hasPriority: hasPriority,
    validateDemoLogin: validateDemoLogin,
    outageRisk: outageRisk,
    backupProjection: backupProjection,
    pickByRank: pickByRank,
    pickForDuration: pickForDuration,
    withCommonNames: withCommonNames,
    findMedicine: findMedicine,
    rankMedicines: rankMedicines,
    medicineOutcome: medicineOutcome,
  };
});
