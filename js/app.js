/* global JSZip */
(() => {
  "use strict";

  const CURRENT_STATE_BUNDLE = [
    "GAMEFLOW.BLOB",
    "GAMEPROGRESS.BLOB",
    "PARTYSYSTEM.BLOB",
    "PARTYFREEPLAYLIST.BLOB",
    "SAVEGAMEMETA.BLOB"
  ];

  const PROGRESS_HEAVY_SLOT_FILES = [
    "COLLECTABLES.BLOB",
    "ACHIEVEMENTSYSTEM.BLOB",
    "FOGOFWARBANKS.BLOB",
    "TEXTHINTNOTIFICATIONSBANKS.BLOB",
    "COPILOTDATA.BLOB"
  ];

  const PROGRESS_HEAVY_PROFILE_FILES = [
    "ACHIEVEMENTS",
    "CUTSCENEPROGRESS.BLOB",
    "DLCDATA.BLOB"
  ];

  const DEFAULT_ROOT_HINT = "SAVEDGAMES/STEAM/REPAIRED";
  const SAFE_LEVEL_PATH = "Levels/Hub/Planets/Tatooine/Locations/Settlements/Tatooine_desertArea/tatooine_desertarea.scene_baked";
  const SAFE_ARRIVAL = "ArrivalPoint";
  const SAFE_GAMEPROGRESS_TAIL = [
    SAFE_LEVEL_PATH,
    SAFE_ARRIVAL,
    SAFE_LEVEL_PATH,
    SAFE_ARRIVAL,
    "PloKoon",
    "SpecialForcesFighterPilot_FsO",
    "Imperial_TIEAdvanced",
    "GeneralGrievous_Starfighter"
  ];
  const SAFE_PARTYSYSTEM_STRINGS = [
    "PloKoon",
    "SpecialForcesFighterPilot_FsO",
    "Imperial_TIEAdvanced",
    "GeneralGrievous_Starfighter",
    "PloKoon",
    "GeneralCody",
    "Imperial_TIEAdvanced",
    "GeneralGrievous_Starfighter"
  ];
  const SAFE_FREEPLAY_RECORDS = [
    ["Anakin_Boy_Starfighter", "Civilian", "01 07 00"],
    ["PloKoon", "Jedi", "01 09 00"],
    ["R3PO", "ProtocolDroid", "01 01 00"],
    ["Bossk", "BountyHunter", "01 08 00"],
    ["Stormtrooper_FirstOrder_Ep9_Rocket", "GalacticEmpire", "01 05 00"],
    ["SidonIthano", "Scoundrel", "01 03 00"],
    ["CassianAndor", "RebelResistance", "01 06 00"],
    ["Jawa_A", "Scavenger", "01 02 00"],
    ["BB9E", "AstromechDroid", "01 04 00 01 09 00 00 00"],
    ["SpecialForcesFighterPilot_FsO", "GalacticEmpire", "01 08 00"],
    ["DarthMaul_Hood", "Sith", "01 03 00"],
    ["GeneralGrievous", "GalacticEmpire", "01 05 00"],
    ["GeneralCody", "RebelResistance", "01 04 00"],
    ["4LOM", "BountyHunter", "01 01 00"],
    ["Crosshair", "GalacticEmpire", "01 09 00"],
    ["TIEFighterPilot_FsO", "GalacticEmpire", "01 07 00"],
    ["BattleDroid_Security", "GalacticEmpire", "01 06 00"],
    ["ChiefChirpa", "Scavenger", "01 02 00 01 09 00 00 00"],
    ["ShaakTi", "Jedi", "00 00 00"],
    ["KaydelConnix_Ep9", "RebelResistance", "00 00 00"],
    ["AstromechDroid_DarkTurquoise", "AstromechDroid", "00 00 00"],
    ["TC14", "ProtocolDroid", "00 00 00"],
    ["TasuLeech", "Scoundrel", "00 00 00"],
    ["Snoke", "Sith", "00 00 00"],
    ["CommanderJir", "GalacticEmpire", "00 00 00"],
    ["Dengar", "BountyHunter", "00 00 00"],
    ["ChiefChirpa", "Scavenger", "00 00 00 01 09 00 00 00"],
    ["ShaakTi", "Jedi", "00 00 00"],
    ["KaydelConnix_Ep9", "RebelResistance", "00 00 00"],
    ["AstromechDroid_DarkTurquoise", "AstromechDroid", "00 00 00"],
    ["TC14", "ProtocolDroid", "00 00 00"],
    ["TasuLeech", "Scoundrel", "00 00 00"],
    ["Snoke", "Sith", "00 00 00"],
    ["CommanderJir", "GalacticEmpire", "00 00 00"],
    ["Dengar", "BountyHunter", "00 00 00"],
    ["ChiefChirpa", "Scavenger", "00 00 00 01"]
  ];
  const ZIP_LIMITS = {
    maxArchiveBytes: 50 * 1024 * 1024,
    maxEntries: 300,
    maxRecognizedFiles: 160,
    maxRecognizedFileBytes: 32 * 1024 * 1024,
    maxRecognizedTotalBytes: 120 * 1024 * 1024
  };

  const state = {
    corrupt: null
  };

  const $ = (id) => document.getElementById(id);

  function log(message) {
    $("statusLog").textContent = message;
  }

  function asUpper(value) {
    return String(value || "").toUpperCase();
  }

  function sanitizeForFileName(value) {
    return String(value || "save")
      .replace(/\.zip$/i, "")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "save";
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }

  function getDeclaredUncompressedSize(entry) {
    const size = entry && entry._data && entry._data.uncompressedSize;
    return Number.isFinite(size) ? size : null;
  }

  function assertZipLimit(condition, message) {
    if (!condition) throw new Error(message);
  }

  function stripUnsafeZipPath(name) {
    return String(name || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");
  }

  function isSafeSaveFileName(name) {
    return Boolean(name)
      && name !== "."
      && name !== ".."
      && name.length <= 120
      && /^[A-Za-z0-9_.-]+$/.test(name);
  }

  function asciiBytes(value) {
    const text = String(value);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code < 32 || code > 126) throw new Error(`Repair recipe contains a non-ASCII value: ${text}`);
      bytes[i] = code;
    }
    return bytes;
  }

  function readU32LE(bytes, offset) {
    return bytes[offset]
      | (bytes[offset + 1] << 8)
      | (bytes[offset + 2] << 16)
      | (bytes[offset + 3] << 24);
  }

  function writeU32LE(bytes, offset, value) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
  }

  function encodeSaveString(value) {
    const text = asciiBytes(value);
    const out = new Uint8Array(text.length + 5);
    writeU32LE(out, 0, text.length + 1);
    out.set(text, 4);
    out[out.length - 1] = 0;
    return out;
  }

  function hexBytes(hex) {
    const clean = String(hex).replace(/\s+/g, "");
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  function concatBytes(parts) {
    const size = parts.reduce((total, part) => total + part.byteLength, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.byteLength;
    }
    return out;
  }

  function findLastMarker(bytes, markerText) {
    const marker = asciiBytes(markerText);
    for (let i = bytes.byteLength - marker.byteLength; i >= 0; i -= 1) {
      let matched = true;
      for (let j = 0; j < marker.byteLength; j += 1) {
        if (bytes[i + j] !== marker[j]) {
          matched = false;
          break;
        }
      }
      if (matched) return i;
    }
    return -1;
  }

  function parseTailSaveStrings(bytes, fileName) {
    const mobjOffset = findLastMarker(bytes, "MOBJ");
    const olstOffset = findLastMarker(bytes, "OLST");
    if (mobjOffset < 0 || olstOffset < 8) {
      throw new Error(`${fileName} does not have the expected current-state object layout.`);
    }

    const entries = [];
    for (let offset = mobjOffset + 4; offset + 4 <= bytes.byteLength;) {
      const length = readU32LE(bytes, offset);
      const end = offset + 4 + length;
      let isString = length >= 1 && length <= 220 && end <= bytes.byteLength && bytes[end - 1] === 0;
      for (let i = offset + 4; isString && i < end - 1; i += 1) {
        isString = bytes[i] >= 32 && bytes[i] <= 126;
      }

      if (isString) {
        let value = "";
        for (let i = offset + 4; i < end - 1; i += 1) value += String.fromCharCode(bytes[i]);
        entries.push({ offset, end, value });
        offset = end;
      } else {
        offset += 1;
      }
    }

    return { mobjOffset, olstOffset, entries };
  }

  function updateTailSizes(out, original, olstOffset, delta) {
    const offsets = [olstOffset - 8, olstOffset + 11];
    for (const offset of offsets) {
      if (offset < 0 || offset + 4 > original.byteLength) {
        throw new Error("Current-state object has unsupported size fields.");
      }
      const next = readU32LE(original, offset) + delta;
      if (next < 0) throw new Error("Repair would create an invalid current-state object size.");
      writeU32LE(out, offset, next);
    }
  }

  function patchSaveStringEntries(bytes, fileName, replacements) {
    const { olstOffset } = parseTailSaveStrings(bytes, fileName);
    const ordered = [...replacements].sort((a, b) => a.entry.offset - b.entry.offset);
    const parts = [];
    let cursor = 0;
    let delta = 0;

    for (const { entry, value } of ordered) {
      if (entry.offset < cursor) throw new Error(`${fileName} repair has overlapping string edits.`);
      const encoded = encodeSaveString(value);
      parts.push(bytes.slice(cursor, entry.offset), encoded);
      delta += encoded.byteLength - (entry.end - entry.offset);
      cursor = entry.end;
    }

    parts.push(bytes.slice(cursor));
    const out = concatBytes(parts);
    updateTailSizes(out, bytes, olstOffset, delta);
    return out;
  }

  function patchTailFromFirstString(bytes, fileName, buildReplacement) {
    const { olstOffset, entries } = parseTailSaveStrings(bytes, fileName);
    if (!entries.length) throw new Error(`${fileName} does not have editable current-state strings.`);
    const first = entries[0];
    const replacement = buildReplacement();
    const delta = replacement.byteLength - (bytes.byteLength - first.offset);
    const out = concatBytes([bytes.slice(0, first.offset), replacement]);
    updateTailSizes(out, bytes, olstOffset, delta);
    return out;
  }

  function findEpisode9Tail(entries, fileName) {
    let episodeIndex = -1;
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (entries[i].value === "Episode9") {
        episodeIndex = i;
        break;
      }
    }
    if (episodeIndex < 0 || episodeIndex + 9 >= entries.length) {
      throw new Error(`${fileName} does not contain the expected Episode9 current-state tail.`);
    }
    return episodeIndex + 1;
  }

  function validateTailStrings(bytes, fileName, expectedValues) {
    const values = parseTailSaveStrings(bytes, fileName).entries.map((entry) => entry.value);
    for (const expected of expectedValues) {
      if (!values.includes(expected)) {
        throw new Error(`${fileName} repair validation failed for ${expected}.`);
      }
    }
  }

  function formatOffset(offset) {
    return `0x${offset.toString(16).padStart(8, "0")}`;
  }

  function formatCurrentStateStrings(bytes, fileName) {
    const parsed = parseTailSaveStrings(bytes, fileName);
    const lines = [
      `${fileName}: MOBJ=${formatOffset(parsed.mobjOffset)} OLST=${formatOffset(parsed.olstOffset)} strings=${parsed.entries.length}`
    ];

    parsed.entries.forEach((entry, index) => {
      const label = String(index).padStart(2, "0");
      const value = entry.value === "" ? "<empty>" : entry.value;
      lines.push(`${label} ${formatOffset(entry.offset)} bytes=${entry.end - entry.offset} ${value}`);
    });

    return lines;
  }

  function normalizePath(name) {
    const path = stripUnsafeZipPath(name);
    if (!path || path.endsWith("/")) return null;
    if (path.startsWith("__MACOSX/") || path.includes("/__MACOSX/")) return null;

    const base = path.split("/").pop();
    if (!base || base === ".DS_Store" || base.startsWith("._")) return null;

    let match = path.match(/(?:^|\/)PROFILEDATA\/([^/]+)$/i);
    if (match && isSafeSaveFileName(match[1])) return `PROFILEDATA/${match[1]}`;

    match = path.match(/(?:^|\/)(SLOT[0-9]+)\/([^/]+)$/i);
    if (match && isSafeSaveFileName(match[2])) return `${match[1].toUpperCase()}/${match[2]}`;

    const flat = path
      .replace(/^_+/, "")
      .replace(/\/+$/, "")
      .replace(/[\s-]+/g, " ");

    match = flat.match(/(?:^|_)PROFILEDATA_([^/]+)$/i);
    if (match && isSafeSaveFileName(match[1])) return `PROFILEDATA/${match[1]}`;

    match = flat.match(/(?:^|_)(SLOT[0-9]+)_([^/]+)$/i);
    if (match && isSafeSaveFileName(match[2])) return `${match[1].toUpperCase()}/${match[2]}`;

    return null;
  }

  function detectRootHint(rawNames) {
    for (const raw of rawNames) {
      const path = stripUnsafeZipPath(raw);
      let match = path.match(/SAVEDGAMES\/(STEAM|EPIC|GOG|GAMEPASS|XBOX)\/([^/]+)/i);
      if (match) return `SAVEDGAMES/${match[1].toUpperCase()}/${match[2]}`;

      match = path.match(/SAVEDGAMES_(STEAM|EPIC|GOG|GAMEPASS|XBOX)_([^_\/]+)/i);
      if (match) return `SAVEDGAMES/${match[1].toUpperCase()}/${match[2]}`;
    }
    return DEFAULT_ROOT_HINT;
  }

  async function readZipFile(file, label) {
    if (!file) throw new Error(`${label} is missing.`);
    assertZipLimit(
      file.size <= ZIP_LIMITS.maxArchiveBytes,
      `${label} is too large (${formatBytes(file.size)}). Maximum zip size is ${formatBytes(ZIP_LIMITS.maxArchiveBytes)}.`
    );
    const arrayBuffer = await file.arrayBuffer();
    return loadSaveFromArrayBuffer(arrayBuffer, file.name, label);
  }

  async function loadSaveFromArrayBuffer(arrayBuffer, fileName, label) {
    assertZipLimit(
      arrayBuffer.byteLength <= ZIP_LIMITS.maxArchiveBytes,
      `${label} is too large (${formatBytes(arrayBuffer.byteLength)}). Maximum zip size is ${formatBytes(ZIP_LIMITS.maxArchiveBytes)}.`
    );

    const zip = await JSZip.loadAsync(arrayBuffer);
    const rawNames = Object.keys(zip.files);
    assertZipLimit(
      rawNames.length <= ZIP_LIMITS.maxEntries,
      `${label} has too many zip entries (${rawNames.length}). Maximum is ${ZIP_LIMITS.maxEntries}.`
    );

    const files = new Map();
    const ignored = [];
    const duplicates = [];
    const rootHint = detectRootHint(rawNames);
    let totalRecognizedBytes = 0;

    for (const [entryName, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const rel = normalizePath(entryName);
      if (!rel) {
        ignored.push(entryName);
        continue;
      }

      assertZipLimit(
        files.size < ZIP_LIMITS.maxRecognizedFiles,
        `${label} contains too many recognized save files. Maximum is ${ZIP_LIMITS.maxRecognizedFiles}.`
      );

      const declaredSize = getDeclaredUncompressedSize(entry);
      if (declaredSize !== null) {
        assertZipLimit(
          declaredSize <= ZIP_LIMITS.maxRecognizedFileBytes,
          `${label} contains an oversized save file (${rel}, ${formatBytes(declaredSize)}). Maximum per file is ${formatBytes(ZIP_LIMITS.maxRecognizedFileBytes)}.`
        );
        assertZipLimit(
          totalRecognizedBytes + declaredSize <= ZIP_LIMITS.maxRecognizedTotalBytes,
          `${label} expands to too much recognized save data. Maximum is ${formatBytes(ZIP_LIMITS.maxRecognizedTotalBytes)}.`
        );
      }

      const bytes = await entry.async("uint8array");
      assertZipLimit(
        bytes.byteLength <= ZIP_LIMITS.maxRecognizedFileBytes,
        `${label} contains an oversized save file (${rel}, ${formatBytes(bytes.byteLength)}). Maximum per file is ${formatBytes(ZIP_LIMITS.maxRecognizedFileBytes)}.`
      );
      totalRecognizedBytes += bytes.byteLength;
      assertZipLimit(
        totalRecognizedBytes <= ZIP_LIMITS.maxRecognizedTotalBytes,
        `${label} expands to too much recognized save data. Maximum is ${formatBytes(ZIP_LIMITS.maxRecognizedTotalBytes)}.`
      );

      if (files.has(rel)) duplicates.push(rel);
      files.set(rel, {
        bytes,
        originalName: entryName,
        size: bytes.byteLength
      });
    }

    const slots = getSlotsFromFiles(files);
    return {
      label,
      fileName,
      originalBytes: new Uint8Array(arrayBuffer),
      files,
      ignored,
      duplicates,
      slots,
      rootHint,
      rawEntryCount: rawNames.length
    };
  }

  function getSlotsFromFiles(files) {
    const slots = new Set();
    for (const rel of files.keys()) {
      const match = rel.match(/^(SLOT[0-9]+)\//i);
      if (match) slots.add(match[1].toUpperCase());
    }
    return Array.from(slots).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  }

  function fileNameFromRel(rel) {
    return asUpper(String(rel).split("/").pop());
  }

  function findRel(files, slot, fileName) {
    const wanted = `${asUpper(slot)}/${asUpper(fileName)}`;
    for (const rel of files.keys()) {
      if (asUpper(rel) === wanted) return rel;
    }
    return null;
  }

  function findProfileRel(files, fileName) {
    const wanted = `PROFILEDATA/${asUpper(fileName)}`;
    for (const rel of files.keys()) {
      if (asUpper(rel) === wanted) return rel;
    }
    return null;
  }

  function cloneFiles(files) {
    const copy = new Map();
    for (const [rel, data] of files.entries()) {
      copy.set(rel, { ...data });
    }
    return copy;
  }

  function setSlotFile(files, slot, fileName, bytes, originalName = "generated") {
    const existingRel = findRel(files, slot, fileName);
    const rel = existingRel || `${asUpper(slot)}/${fileName}`;
    files.set(rel, { bytes, originalName, size: bytes.byteLength });
  }

  function getSlotBytes(save, slot, fileName) {
    const rel = findRel(save.files, slot, fileName);
    return rel ? save.files.get(rel).bytes : null;
  }

  function getProfileBytes(save, fileName) {
    const rel = findProfileRel(save.files, fileName);
    return rel ? save.files.get(rel).bytes : null;
  }

  function selectOptions(select, values) {
    select.innerHTML = "";
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
  }

  function summarizeSave(save) {
    const profileFiles = Array.from(save.files.keys()).filter((rel) => asUpper(rel).startsWith("PROFILEDATA/")).length;
    const slotFiles = Array.from(save.files.keys()).filter((rel) => /^SLOT[0-9]+\//i.test(rel)).length;
    const missingBySlot = save.slots.map((slot) => {
      const missing = CURRENT_STATE_BUNDLE.filter((name) => !findRel(save.files, slot, name));
      return `${slot}: ${missing.length ? `missing ${missing.join(", ")}` : "current-state bundle present"}`;
    });

    return [
      `${save.label}:`,
      `  file: ${save.fileName}`,
      `  raw zip entries: ${save.rawEntryCount}`,
      `  normalized files: ${save.files.size}`,
      `  root hint: ${save.rootHint}`,
      `  detected slots: ${save.slots.length ? save.slots.join(", ") : "none"}`,
      `  PROFILEDATA files: ${profileFiles}`,
      `  slot files: ${slotFiles}`,
      `  ignored entries: ${save.ignored.length}`,
      `  duplicate normalized paths: ${save.duplicates.length}`,
      ...missingBySlot.map((line) => `  ${line}`)
    ].join("\n");
  }

  function onlyProfileAndSlot(save, slot) {
    const files = new Map();
    for (const [rel, data] of save.files.entries()) {
      if (asUpper(rel).startsWith("PROFILEDATA/") || asUpper(rel).startsWith(`${asUpper(slot)}/`)) {
        files.set(rel, { ...data });
      }
    }
    return files;
  }

  function patchGameFlow(bytes) {
    const parsed = parseTailSaveStrings(bytes, "GAMEFLOW.BLOB");
    if (parsed.entries.length < 2) throw new Error("GAMEFLOW.BLOB is missing resume strings.");
    const out = patchSaveStringEntries(bytes, "GAMEFLOW.BLOB", [
      { entry: parsed.entries[parsed.entries.length - 2], value: SAFE_LEVEL_PATH },
      { entry: parsed.entries[parsed.entries.length - 1], value: SAFE_ARRIVAL }
    ]);
    validateTailStrings(out, "GAMEFLOW.BLOB", [SAFE_LEVEL_PATH, SAFE_ARRIVAL]);
    return out;
  }

  function patchGameProgress(bytes, includeParty) {
    const parsed = parseTailSaveStrings(bytes, "GAMEPROGRESS.BLOB");
    const start = findEpisode9Tail(parsed.entries, "GAMEPROGRESS.BLOB");
    const replacements = [
      { entry: parsed.entries[start], value: SAFE_GAMEPROGRESS_TAIL[0] },
      { entry: parsed.entries[start + 1], value: SAFE_GAMEPROGRESS_TAIL[1] },
      { entry: parsed.entries[start + 2], value: SAFE_GAMEPROGRESS_TAIL[2] },
      { entry: parsed.entries[start + 3], value: SAFE_GAMEPROGRESS_TAIL[3] }
    ];

    if (includeParty) {
      const partyStart = start + 5;
      replacements.push(
        { entry: parsed.entries[partyStart], value: SAFE_GAMEPROGRESS_TAIL[4] },
        { entry: parsed.entries[partyStart + 1], value: SAFE_GAMEPROGRESS_TAIL[5] },
        { entry: parsed.entries[partyStart + 2], value: SAFE_GAMEPROGRESS_TAIL[6] },
        { entry: parsed.entries[partyStart + 3], value: SAFE_GAMEPROGRESS_TAIL[7] }
      );
    }

    const out = patchSaveStringEntries(bytes, "GAMEPROGRESS.BLOB", replacements);
    validateTailStrings(out, "GAMEPROGRESS.BLOB", [SAFE_LEVEL_PATH, SAFE_ARRIVAL]);
    return out;
  }

  function patchSaveGameMeta(bytes) {
    const parsed = parseTailSaveStrings(bytes, "SAVEGAMEMETA.BLOB");
    if (parsed.entries.length < 3) throw new Error("SAVEGAMEMETA.BLOB is missing slot metadata strings.");
    const out = patchSaveStringEntries(bytes, "SAVEGAMEMETA.BLOB", [
      { entry: parsed.entries[parsed.entries.length - 3], value: "PLANET_TATOOINE" },
      { entry: parsed.entries[parsed.entries.length - 1], value: "Anchorhead.png" }
    ]);
    validateTailStrings(out, "SAVEGAMEMETA.BLOB", ["PLANET_TATOOINE", "Anchorhead.png"]);
    return out;
  }

  function patchPartySystem(bytes) {
    const parsed = parseTailSaveStrings(bytes, "PARTYSYSTEM.BLOB");
    if (parsed.entries.length !== SAFE_PARTYSYSTEM_STRINGS.length) {
      throw new Error("PARTYSYSTEM.BLOB has an unsupported party layout.");
    }
    const out = patchSaveStringEntries(bytes, "PARTYSYSTEM.BLOB", parsed.entries.map((entry, index) => ({
      entry,
      value: SAFE_PARTYSYSTEM_STRINGS[index]
    })));
    validateTailStrings(out, "PARTYSYSTEM.BLOB", ["PloKoon", "GeneralCody", "GeneralGrievous_Starfighter"]);
    return out;
  }

  function buildSafeFreeplayTail() {
    const parts = [];
    for (const [character, type, gap] of SAFE_FREEPLAY_RECORDS) {
      parts.push(encodeSaveString(character), encodeSaveString(type), hexBytes(gap));
    }
    return concatBytes(parts);
  }

  function patchPartyFreeplayList(bytes) {
    const parsed = parseTailSaveStrings(bytes, "PARTYFREEPLAYLIST.BLOB");
    if (parsed.entries.length !== SAFE_FREEPLAY_RECORDS.length * 2) {
      throw new Error("PARTYFREEPLAYLIST.BLOB has an unsupported free-play party list layout.");
    }
    const out = patchTailFromFirstString(bytes, "PARTYFREEPLAYLIST.BLOB", buildSafeFreeplayTail);
    validateTailStrings(out, "PARTYFREEPLAYLIST.BLOB", ["PloKoon", "GeneralCody", "ChiefChirpa"]);
    return out;
  }

  function makeSurgicalFiles(save, targetSlot, mode) {
    const files = onlyProfileAndSlot(save, targetSlot);
    const required = CURRENT_STATE_BUNDLE.filter((fileName) => !findRel(files, targetSlot, fileName));
    if (required.length) {
      throw new Error(`Cannot build repair candidate because ${targetSlot} is missing: ${required.join(", ")}.`);
    }

    setSlotFile(files, targetSlot, "GAMEFLOW.BLOB", patchGameFlow(getSlotBytes(save, targetSlot, "GAMEFLOW.BLOB")), "safe-landing-recipe");
    setSlotFile(files, targetSlot, "GAMEPROGRESS.BLOB", patchGameProgress(getSlotBytes(save, targetSlot, "GAMEPROGRESS.BLOB"), mode === "full"), "safe-landing-recipe");

    if (mode !== "location-only") {
      setSlotFile(files, targetSlot, "SAVEGAMEMETA.BLOB", patchSaveGameMeta(getSlotBytes(save, targetSlot, "SAVEGAMEMETA.BLOB")), "safe-landing-recipe");
    }

    if (mode === "full") {
      setSlotFile(files, targetSlot, "PARTYSYSTEM.BLOB", patchPartySystem(getSlotBytes(save, targetSlot, "PARTYSYSTEM.BLOB")), "safe-landing-recipe");
      setSlotFile(files, targetSlot, "PARTYFREEPLAYLIST.BLOB", patchPartyFreeplayList(getSlotBytes(save, targetSlot, "PARTYFREEPLAYLIST.BLOB")), "safe-landing-recipe");
    }

    return files;
  }

  function candidateLocationOnlySafeLanding(save, targetSlot) {
    return {
      id: "01-location-only-safe-landing",
      title: "Location-only safe landing reset",
      risk: "minimal test",
      notes: [
        "Patches GAMEFLOW.BLOB and the current location tail in GAMEPROGRESS.BLOB to a known-good Tatooine landing state.",
        "Keeps uploaded save metadata, party, and free-play party list files unchanged.",
        "Use this first to test whether the broken Bespin current-state location is the actual load blocker."
      ],
      files: makeSurgicalFiles(save, targetSlot, "location-only")
    };
  }

  function candidateLocationMetaSafeLanding(save, targetSlot) {
    return {
      id: "02-location-meta-safe-landing",
      title: "Location plus metadata safe landing reset",
      risk: "recommended",
      notes: [
        "Patches the resume location and visible save metadata to a known-good Tatooine landing state.",
        "Keeps the uploaded party and free-play party list files unchanged.",
        "Does not edit collectibles, achievements, profile data, or other progress-heavy files."
      ],
      files: makeSurgicalFiles(save, targetSlot, "location-meta")
    };
  }

  function candidateFullSafeStateReset(save, targetSlot) {
    return {
      id: "03-full-safe-state-reset",
      title: "Full safe-state reset",
      risk: "medium",
      notes: [
        "Patches the resume location and active party/free-play state to the known-good safe landing recipe.",
        "This changes active character, vehicle, and free-play selection state, but does not edit collectibles, achievements, or profile progress files.",
        "Use this if the location-only and location plus metadata candidates still fail to load."
      ],
      files: makeSurgicalFiles(save, targetSlot, "full")
    };
  }

  function makeRepairCandidates(save, targetSlot) {
    const plans = [
      {
        id: "01-location-only-safe-landing",
        title: "Location-only safe landing reset",
        build: () => candidateLocationOnlySafeLanding(save, targetSlot)
      },
      {
        id: "02-location-meta-safe-landing",
        title: "Location plus metadata safe landing reset",
        build: () => candidateLocationMetaSafeLanding(save, targetSlot)
      },
      {
        id: "03-full-safe-state-reset",
        title: "Full safe-state reset",
        build: () => candidateFullSafeStateReset(save, targetSlot)
      }
    ];
    const candidates = [];
    const failures = [];

    for (const plan of plans) {
      try {
        candidates.push(plan.build());
      } catch (err) {
        failures.push({
          id: plan.id,
          title: plan.title,
          error: err && err.message ? err.message : String(err)
        });
      }
    }

    return { candidates, failures };
  }

  function extractPrintableStrings(bytes, minLen = 8, maxStrings = 28) {
    const strings = [];
    let current = "";
    for (const byte of bytes) {
      if (byte >= 32 && byte <= 126) {
        current += String.fromCharCode(byte);
        if (current.length >= 140) {
          strings.push(current);
          current = "";
        }
      } else {
        if (current.length >= minLen) strings.push(current);
        current = "";
      }
      if (strings.length >= maxStrings) break;
    }
    if (strings.length < maxStrings && current.length >= minLen) strings.push(current);
    return strings.slice(0, maxStrings);
  }

  async function sha256Hex(bytes) {
    if (!globalThis.crypto || !globalThis.crypto.subtle) return "sha256-unavailable";
    const view = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const digest = await crypto.subtle.digest("SHA-256", view);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function buildManifest(save) {
    const lines = [
      `Manifest for ${save.fileName}`,
      `Normalized files: ${save.files.size}`,
      "",
      "Each line: normalized path | bytes | sha256 | original zip entry",
      ""
    ];
    for (const [rel, data] of Array.from(save.files.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      const hash = await sha256Hex(data.bytes);
      lines.push(`${rel} | ${data.bytes.byteLength} | ${hash} | ${data.originalName}`);
    }
    return lines.join("\n");
  }

  function buildStringSnippets(save, targetSlot) {
    const interesting = [
      `${targetSlot}/GAMEFLOW.BLOB`,
      `${targetSlot}/GAMEPROGRESS.BLOB`,
      `${targetSlot}/SAVEGAMEMETA.BLOB`,
      `${targetSlot}/COLLECTABLES.BLOB`,
      "PROFILEDATA/ACHIEVEMENTS",
      "PROFILEDATA/CUTSCENEPROGRESS.BLOB"
    ];

    const lines = [`String snippets for ${save.fileName}`, ""];
    for (const rel of interesting) {
      const actualRel = rel.startsWith("PROFILEDATA/")
        ? findProfileRel(save.files, rel.split("/").pop())
        : findRel(save.files, rel.split("/")[0], rel.split("/").pop());
      if (!actualRel) continue;
      const data = save.files.get(actualRel);
      lines.push(`--- ${actualRel} (${data.bytes.byteLength} bytes) ---`);
      const snippets = extractPrintableStrings(data.bytes);
      if (!snippets.length) {
        lines.push("No printable ASCII snippets found.");
      } else {
        for (const snippet of snippets) lines.push(snippet);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  function buildCurrentStateStringReport(save, targetSlot) {
    const lines = [
      `Current-state save strings for ${save.fileName}`,
      "",
      "Strings are decoded from the last MOBJ/OLST object as u32 length, ASCII payload, and trailing NUL.",
      ""
    ];

    for (const fileName of CURRENT_STATE_BUNDLE) {
      const rel = findRel(save.files, targetSlot, fileName);
      if (!rel) {
        lines.push(`--- ${targetSlot}/${fileName} ---`);
        lines.push("Missing from uploaded save.");
        lines.push("");
        continue;
      }

      const data = save.files.get(rel);
      lines.push(`--- ${rel} (${data.bytes.byteLength} bytes) ---`);
      try {
        lines.push(...formatCurrentStateStrings(data.bytes, fileName));
      } catch (err) {
        lines.push(`Could not decode current-state strings: ${err.message}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  function buildSummaryJson(corrupt, targetSlot, candidates, candidateFailures) {
    const makeSaveSummary = (save) => ({
      fileName: save.fileName,
      rootHint: save.rootHint,
      normalizedFileCount: save.files.size,
      slots: save.slots,
      ignoredCount: save.ignored.length,
      duplicateCount: save.duplicates.length,
      missingCurrentStateBySlot: Object.fromEntries(save.slots.map((slot) => [
        slot,
        CURRENT_STATE_BUNDLE.filter((name) => !findRel(save.files, slot, name))
      ]))
    });

    return JSON.stringify({
      app: "LEGO Star Wars: The Skywalker Saga Save Rescue",
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      mode: "no-reference-surgical-repair",
      targetSlot,
      corrupt: makeSaveSummary(corrupt),
      safeLanding: {
        levelPath: SAFE_LEVEL_PATH,
        arrival: SAFE_ARRIVAL
      },
      candidateIds: candidates.map((candidate) => candidate.id),
      candidateBuildFailures: candidateFailures,
      caveat: "Experimental repair candidates. Back up real saves and disable cloud sync before testing."
    }, null, 2);
  }

  function writeFilesToZip(zip, basePath, files) {
    for (const [rel, data] of Array.from(files.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      zip.file(`${basePath}/${rel}`, data.bytes, { binary: true });
    }
  }

  function candidateReadme(candidate, targetSlot) {
    return [
      candidate.title,
      "",
      `Candidate id: ${candidate.id}`,
      `Risk level: ${candidate.risk}`,
      `Target slot: ${targetSlot}`,
      "",
      "What this candidate does:",
      ...candidate.notes.map((note) => `- ${note}`),
      "",
      "How to test:",
      "1. Back up your real save folder first.",
      "2. Disable Steam Cloud / Epic cloud sync while testing.",
      "3. Copy the PROFILEDATA folder and the SLOT folder from this candidate into your real numbered save folder.",
      "4. Start the game and try loading the slot.",
      "5. If it fails, close the game and copy the next candidate over the same test save.",
      "",
      "This candidate is experimental and may not load."
    ].join("\n");
  }

  function buildPackageReadme(corrupt, targetSlot, candidates, candidateFailures) {
    const lines = [
      "LEGO Star Wars: The Skywalker Saga Save Rescue package",
      "",
      "This package was generated locally in a browser. It contains your original upload and transformed repair candidates.",
      "",
      `Corrupted input: ${corrupt.fileName}`,
      `Target slot: ${targetSlot}`,
      "",
      "Critical safety steps:",
      "1. Back up the real SAVEDGAMES folder before testing anything.",
      "2. Disable Steam Cloud, Epic cloud sync, or other sync tools while testing.",
      "3. Test one candidate at a time.",
      "4. If a candidate fails, close the game and replace the test save with the next candidate.",
      "",
      "Recommended testing order:",
      ...candidates.map((candidate, index) => `${index + 1}. candidates/${candidate.id} - ${candidate.title}`),
      "",
      ...(candidateFailures.length ? [
        "Candidates that could not be built:",
        ...candidateFailures.map((failure) => `- ${failure.id}: ${failure.error}`),
        ""
      ] : []),
      "No-reference repair strategy:",
      "The candidates patch the current resume/location state to a known-good Tatooine landing point without using an external save file.",
      "The location-only candidate leaves the uploaded metadata, party, and free-play list files unchanged.",
      "The location plus metadata candidate also updates visible slot planet/thumbnail strings.",
      "The full candidate also resets the active party/free-play state when the first two candidates are not enough.",
      "",
      "What to copy:",
      "Open one candidate folder and copy its PROFILEDATA and SLOT# folders into your real save folder.",
      "Typical Steam path:",
      "%APPDATA%\\Warner Bros. Interactive Entertainment\\LEGO Star Wars - The Skywalker Saga\\SAVEDGAMES\\STEAM\\<your-number>\\",
      "",
      "What this tool is trying to fix:",
      "It targets saves where the game still has progress data but cannot resume from a broken location, party, mission, or current-state context.",
      "",
      "What it cannot promise:",
      "If the core progress files are damaged, deleted, encrypted, or account-incompatible, these candidates may not recover the save.",
      "",
      "The original uploaded zip is stored under original-upload/."
    ];
    return lines.join("\n");
  }

  function buildTransplantKitReadme(targetSlot) {
    return [
      "Progress transplant kit",
      "",
      "This folder is not a directly playable save. It contains progress-heavy files extracted from the corrupted upload.",
      "",
      "Use case:",
      "If no candidate works, create a brand-new save in-game, quit, back it up, then try copying these files into that fresh save's matching slot/profile folders.",
      "",
      `Target slot source: ${targetSlot}`,
      "",
      "Slot files included when present:",
      ...PROGRESS_HEAVY_SLOT_FILES.map((name) => `- ${name}`),
      "",
      "Profile files included when present:",
      ...PROGRESS_HEAVY_PROFILE_FILES.map((name) => `- ${name}`),
      "",
      "This is a manual last resort. It may change achievements, unlocks, collectibles, or story state."
    ].join("\n");
  }

  function writeTransplantKit(zip, corrupt, targetSlot) {
    const base = "progress-transplant-kit";
    zip.file(`${base}/README.txt`, buildTransplantKitReadme(targetSlot));

    for (const fileName of PROGRESS_HEAVY_SLOT_FILES) {
      const bytes = getSlotBytes(corrupt, targetSlot, fileName);
      if (bytes) zip.file(`${base}/${targetSlot}/${fileName}`, bytes, { binary: true });
    }

    for (const fileName of PROGRESS_HEAVY_PROFILE_FILES) {
      const bytes = getProfileBytes(corrupt, fileName);
      if (bytes) zip.file(`${base}/PROFILEDATA/${fileName}`, bytes, { binary: true });
    }
  }

  async function analyze() {
    const corruptFile = $("corruptZip").files[0];
    if (!corruptFile) throw new Error("Choose a corrupted save zip first.");

    log("Reading zip file and normalizing save paths...");
    state.corrupt = await readZipFile(corruptFile, "Corrupted save");

    if (!state.corrupt.slots.length) {
      throw new Error("The corrupted zip did not contain recognized SLOT folders/files.");
    }

    selectOptions($("targetSlot"), state.corrupt.slots);
    $("optionsPanel").hidden = false;

    const lines = [
      summarizeSave(state.corrupt),
      "",
      "This app will generate no-reference repair candidates:",
      "  1. Location-only safe landing reset",
      "  2. Location plus metadata safe landing reset",
      "  3. Full safe-state reset",
      "",
      "Choose the target slot, then generate the repair package."
    ];
    log(lines.join("\n"));
  }

  async function generate() {
    if (!state.corrupt) throw new Error("Analyze a corrupted save first.");
    const targetSlot = $("targetSlot").value;
    const { candidates, failures } = makeRepairCandidates(state.corrupt, targetSlot);
    if (!candidates.length) {
      const details = failures.map((failure) => `${failure.id}: ${failure.error}`).join("; ");
      throw new Error(`No repair candidates could be built. ${details}`);
    }

    log(`Building ${candidates.length} repair candidates...`);

    const zip = new JSZip();
    zip.file(`original-upload/${state.corrupt.fileName}`, state.corrupt.originalBytes, { binary: true });

    for (const candidate of candidates) {
      const base = `candidates/${candidate.id}`;
      zip.file(`${base}/README.txt`, candidateReadme(candidate, targetSlot));
      writeFilesToZip(zip, base, candidate.files);
    }

    writeTransplantKit(zip, state.corrupt, targetSlot);

    if ($("includeDiagnostics").checked) {
      const diagnostics = zip.folder("diagnostics");
      diagnostics.file("summary.json", buildSummaryJson(state.corrupt, targetSlot, candidates, failures));
      diagnostics.file("corrupted-save-manifest.txt", await buildManifest(state.corrupt));
      diagnostics.file("corrupted-current-state-strings.txt", buildCurrentStateStringReport(state.corrupt, targetSlot));
      diagnostics.file("corrupted-save-string-snippets.txt", buildStringSnippets(state.corrupt, targetSlot));
      diagnostics.file("ignored-zip-entries.txt", state.corrupt.ignored.join("\n") || "No ignored entries.");
      if (failures.length) diagnostics.file("candidate-build-errors.txt", failures.map((failure) => `${failure.id}: ${failure.error}`).join("\n"));
    }

    zip.file("README_FIRST.txt", buildPackageReadme(state.corrupt, targetSlot, candidates, failures));

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `${sanitizeForFileName(state.corrupt.fileName)}-lego-tss-rescue-${stamp}.zip`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);

    log([
      `Generated ${name}`,
      "",
      `Candidates included: ${candidates.length}`,
      ...candidates.map((candidate) => `  - ${candidate.id}: ${candidate.title}`),
      ...(failures.length ? ["", "Candidates skipped:", ...failures.map((failure) => `  - ${failure.id}: ${failure.error}`)] : []),
      "",
      "The package also includes original-upload/ and progress-transplant-kit/.",
      "Read README_FIRST.txt inside the downloaded zip before testing."
    ].join("\n"));
  }

  function clearAll() {
    $("corruptZip").value = "";
    $("optionsPanel").hidden = true;
    state.corrupt = null;
    log("Choose a corrupted save zip, then click Analyze.");
  }

  $("analyzeBtn").addEventListener("click", async () => {
    try {
      await analyze();
    } catch (err) {
      log(`Error: ${err.message}`);
    }
  });

  $("generateBtn").addEventListener("click", async () => {
    try {
      await generate();
    } catch (err) {
      log(`Error: ${err.message}`);
    }
  });

  $("clearBtn").addEventListener("click", clearAll);
})();
