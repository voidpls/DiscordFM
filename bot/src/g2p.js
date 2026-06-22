import { createRequire } from 'module';
import { join, dirname } from 'path';

const require = createRequire(import.meta.url);

const SYMBOLS = ["_","\"","(",")","*","/",":","AA","E","EE","En","N","OO","Q","V","[","\\","]","^","a","a:","aa","ae","ah","ai","an","ang","ao","aw","ay","b","by","c","ch","d","dh","dy","e","e:","eh","ei","en","eng","er","ey","f","g","gy","h","hh","hy","i","i0","i:","ia","ian","iang","iao","ie","ih","in","ing","iong","ir","iu","iy","j","jh","k","ky","l","m","my","n","ng","ny","o","o:","ong","ou","ow","oy","p","py","q","r","ry","s","sh","t","th","ts","ty","u","u:","ua","uai","uan","uang","uh","ui","un","uo","uw","v","van","ve","vn","w","x","y","z","zh","zy","~","\u00e6","\u00e7","\u00f0","\u00f8","\u014b","\u0153","\u0250","\u0251","\u0252","\u0254","\u0255","\u0259","\u025b","\u025c","\u0261","\u0263","\u0265","\u0266","\u026a","\u026b","\u026c","\u026d","\u026f","\u0272","\u0275","\u0278","\u0279","\u027e","\u0281","\u0283","\u028a","\u028c","\u028e","\u028f","\u0291","\u0292","\u029d","\u02b2","\u02c8","\u02cc","\u02d0","\u0303","\u0329","\u03b2","\u03b8","\u1100","\u1101","\u1102","\u1103","\u1104","\u1105","\u1106","\u1107","\u1108","\u1109","\u110a","\u110b","\u110c","\u110d","\u110e","\u110f","\u1110","\u1111","\u1112","\u1161","\u1162","\u1163","\u1164","\u1165","\u1166","\u1167","\u1168","\u1169","\u116a","\u116b","\u116c","\u116d","\u116e","\u116f","\u1170","\u1171","\u1172","\u1173","\u1174","\u1175","\u11a8","\u11ab","\u11ae","\u11af","\u11b7","\u11b8","\u11bc","\u3138","!","?","\u2026",",",".","'","-","\u00bf","\u00a1","SP","UNK"];

const SYM = {};
for (let i = 0; i < SYMBOLS.length; i++) SYM[SYMBOLS[i]] = i;

const LANG_ID = 2;
const TONE_OFFSET = 7;

const tinyDir = dirname(require.resolve('tiny-tts'));
const CMU = JSON.parse(require('fs').readFileSync(join(tinyDir, 'cmudict.json'), 'utf-8'));

const g2pPredict = require(join(tinyDir, 'g2p_predict.js'));

// Extract the phoneme body and tone number from a CMU-style entry like "AH0" → ["ah", 1]
function parsePhone(phn) {
  const m = phn.match(/(\d)$/);
  if (m) return [phn.slice(0, -1).toLowerCase(), parseInt(m[1]) + 1];
  return [phn.toLowerCase(), 0];
}

function parseSyllables(syllables) {
  const phones = [], tones = [];
  for (const syl of syllables) {
    for (const phn of syl) {
      const [ph, tone] = parsePhone(phn);
      phones.push(ph);
      tones.push(tone);
    }
  }
  return [phones, tones];
}

function mapPhoneme(ph) {
  const rep = {
    '\uff1a': ',', '\uff1b': ',', '\uff0c': ',', '\u3002': '.',
    '\uff01': '!', '\uff1f': '?', '\n': '.', '\xb7': ',',
    '\u3001': ',', '...': '\u2026', 'v': 'V'
  };
  if (rep[ph] !== undefined) return rep[ph];
  if (SYM[ph] !== undefined) return ph;
  return 'UNK';
}

function graphemeToPhoneme(text) {
  text = text.toLowerCase().trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const allPhones = [], allTones = [];

  for (const word of words) {
    const lead = word.match(/^[^a-z0-9]*/)[0] || '';
    const trail = word.match(/[^a-z0-9']*$/)[0] || '';
    const core = word.slice(lead.length, word.length - trail.length);

    for (const ch of lead) {
      allPhones.push(mapPhoneme(ch));
      allTones.push(0);
    }

    if (core.length > 0) {
      let resolved = false;

      if (core.includes("'")) {
        const parts = core.split("'");
        let partPhones = [], partTones = [];
        let allFound = true;

        for (let pi = 0; pi < parts.length; pi++) {
          if (pi > 0) { partPhones.push("'"); partTones.push(0); }
          const part = parts[pi];
          if (part.length === 0) continue;
          const upper = part.toUpperCase();
          if (CMU[upper]) {
            const [ph, tn] = parseSyllables([CMU[upper]]);
            partPhones.push(...ph);
            partTones.push(...tn);
          } else {
            const preds = g2pPredict.predict(part);
            if (preds && preds.length > 0) {
              for (const p of preds) {
                const [ph2, tn2] = parsePhone(p);
                partPhones.push(ph2);
                partTones.push(tn2);
              }
            } else {
              allFound = false;
              break;
            }
          }
        }

        if (allFound && partPhones.length > 0) {
          for (const p of partPhones) allPhones.push(mapPhoneme(p));
          allTones.push(...partTones);
          resolved = true;
        }
      }

      if (!resolved) {
        const upper = core.toUpperCase();
        if (CMU[upper]) {
          const [phones, tones] = parseSyllables([CMU[upper]]);
          for (const p of phones) allPhones.push(mapPhoneme(p));
          allTones.push(...tones);
          resolved = true;
        }
      }

      if (!resolved) {
        const preds = g2pPredict.predict(core);
        if (preds && preds.length > 0) {
          for (const p of preds) {
            const [ph, tn] = parsePhone(p);
            allPhones.push(mapPhoneme(ph));
            allTones.push(tn);
          }
        } else {
          for (const ch of core) {
            allPhones.push(ch);
            allTones.push(0);
          }
        }
      }
    }

    for (const ch of trail) {
      allPhones.push(mapPhoneme(ch));
      allTones.push(0);
    }
  }

  allPhones.unshift('_');
  allPhones.push('_');
  allTones.unshift(0);
  allTones.push(0);

  return { phones: allPhones, tones: allTones };
}

function phonemesToIds(phones, tones) {
  const phoneIds = phones.map(p => SYM[p] !== undefined ? SYM[p] : SYM['UNK']);
  const toneIds = tones.map(t => t + TONE_OFFSET);
  const langIds = new Array(phoneIds.length).fill(LANG_ID);
  return [phoneIds, toneIds, langIds];
}

function insertBlanks(ids, blank) {
  const n = ids.length;
  const result = new Array(n * 2 + 1).fill(blank);
  for (let i = 0; i < n; i++) result[1 + i * 2] = ids[i];
  return result;
}

import n2w from 'number-to-words';
import { emojiToName } from 'gemoji';
const toWords = n2w.toWords;

const ABBREVIATIONS = {
  'mr.': 'Mister', 'mrs.': 'Missus', 'ms.': 'Miz', 'dr.': 'Doctor',
  'st.': 'Saint', 'etc.': 'etcetera', 'vs.': 'versus',
  'e.g.': 'for example', 'i.e.': 'that is',
  'a.m.': 'AM', 'p.m.': 'PM',
};

// Common uppercase words that should not be split into individual letters
const ACRONYM_EXCEPTIONS = new Set([
  'YES','NO','OK','THE','AND','FOR','NOT','BUT','ALL','CAN',
  'GET','HOW','NOW','ONE','TWO','OUT','TOP','BIG','NEW','OLD',
  'ARE','HAD','HAS','WAS','DID','GOT','SAY','SEE','USE','WAY','WHY','MAY',
]);

// Clean up text before G2P: strip URLs/emojis, expand numbers, ordinals, currency, acronyms, abbreviations
function normalizeText(text) {
  text = text.replace(/https?:\/\/\S+/g, '');
  text = text.replace(/<a?:(\w+):\d+>/g, '$1 emoji');
  text = text.replace(/:(\w+):/g, '$1 emoji');
  let buf = '';
  for (const ch of text) {
    const name = emojiToName[ch];
    buf += name ? ` ${name} emoji ` : ch;
  }
  text = buf.replace(/\s+/g, ' ').trim();

  // "1st" → "first", "2nd" → "second", etc.
  text = text.replace(/\b(\d+)(?:st|nd|rd|th)\b/gi, (_, num) => ` ${n2w.toWordsOrdinal(parseInt(num, 10))} `);

  // "$5" → "five dollars", "$1.99" → "one dollar and ninety-nine cents"
  text = text.replace(/[$£€¥](\d+(?:[,.]\d+)?)/g, (_, amount) => {
    const clean = amount.replace(/,/g, '');
    const num = parseFloat(clean);
    const sign = amount.startsWith('-') ? 'negative ' : '';
    const abs = Math.abs(num);
    if (Number.isInteger(abs)) {
      const words = toWords(abs);
      if (abs === 1) return ` ${sign}${words} dollar `;
      return ` ${sign}${words} dollars `;
    }
    const parts = clean.replace(/^-?/, '').split('.');
    const dollars = toWords(parseInt(parts[0], 10) || 0);
    const cents = parts[1] ? toWords(parseInt(parts[1].padEnd(2, '0').slice(0, 2), 10)) : '';
    return ` ${sign}${dollars} dollars and ${cents} cents `;
  });

  // "50%" → "fifty percent"
  text = text.replace(/(\d+(?:[,.]\d+)?)%/g, (_, num) => {
    const clean = num.replace(/,/g, '');
    const val = parseFloat(clean);
    return ` ${toWords(val)} percent `;
  });

  // "Dr." → "Doctor", "St." → "Saint", etc.
  for (const [abbr, expansion] of Object.entries(ABBREVIATIONS)) {
    const re = new RegExp('\\b' + abbr.replace('.', '\\.') + '\\b', 'gi');
    text = text.replace(re, ` ${expansion} `);
  }

  // "AI" → "A I", "FBI" → "F B I" — skip common words and CMU-known words
  text = text.replace(/\b([A-Z]{2,5})\b/g, (match) => {
    if (ACRONYM_EXCEPTIONS.has(match)) return match;
    if (CMU[match]) return match;
    return match.split('').join(' ');
  });

  // Catch-all number expansion for any remaining digits
  text = text.replace(/-?\d+(?:[,.]\d+)*/g, (match) => {
    const clean = match.replace(/,/g, '');
    const num = parseFloat(clean);
    if (!isNaN(num) && isFinite(num)) {
      if (Number.isInteger(num)) return ` ${toWords(Math.abs(num))}${num < 0 ? ' negative' : ''} `;
      const parts = clean.split('.');
      const intPart = toWords(parseInt(parts[0], 10));
      const fracPart = [...parts[1]].map(d => toWords(parseInt(d, 10))).join(' ');
      return ` ${intPart} point ${fracPart}${num < 0 ? ' negative' : ''} `;
    }
    return match;
  });

  return text.replace(/\s+/g, ' ').trim();
}

// Full text-to-phoneme pipeline: normalize, lookup, convert to IDs, insert VITS blanks
export function getPhonemeIds(text) {
  text = normalizeText(text);
  const { phones, tones } = graphemeToPhoneme(text);
  const [phoneIds, toneIds, langIds] = phonemesToIds(phones, tones);

  return {
    phoneIds: insertBlanks(phoneIds, 0),
    toneIds: insertBlanks(toneIds, 0),
    langIds: insertBlanks(langIds, 0),
  };
}
