import { attachBlenderFinish } from './blender-finish.js';
import { PART_MARKS } from './inventory.js';
/**
 * 궤(櫃) : 조선의 비밀 — multi-chapter greybox prototype
 * Hub + chapter lifecycle · OrbitControls · raycast
 * Ch1 flagship: hold-handle, craft-eye, richer SFX/lighting
 */
import * as THREE from 'three';
import { createInputController } from './input-controller.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  resumeAudio, bindAudioUnlock, playThunk, playClick, playUnlock, playWrong, vibrate,
  playJoinerySlide, playWoodThunk, playBrassScrape, playLatchClack, playDrawerRumble,
  playNacreClick, playNacreChime, playRubPaper,
} from './audio.js';
import { createMaterials } from './materials.js';
import { createSliceStage } from './slice-stage.js';
import { createSliceExperience } from './slice-experience.js';
import { createCampaignCinematics } from './campaign-cinematics.js';
import { playStoryCue } from './audio.js';
import { createAnimSystem, prefersReducedMotion } from './anim.js';
import { CHAPTER_META, createChapter, MAIN_CHAPTER_IDS, DLC_CHAPTER_IDS } from './chapters/index.js';
import {
  PARTS, grantAllParts, getOwnedParts,
} from './inventory.js';
import {
  loadEvidence, recordEvidence, listEvidence, clearEvidence,
} from './ledger.js';
import {
  createSessionLog, attachChapterLog, loadEvalSheets, saveEvalSheet, scoreSheets,
} from './session-log.js';
import {
  bootProgress, applyClearedChapter, clearCampaign, saveEnding,
  ENDING_LABELS,
} from './progress.js';

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const canvas = document.getElementById('c');
bindAudioUnlock(document);
const prologue = document.getElementById('prologue');
const btnStart = document.getElementById('btn-start');
const hubEl = document.getElementById('hub');
const hubList = document.getElementById('hub-list');
const hudObjective = document.getElementById('hud-objective');
const objectiveText = document.getElementById('objective-text');
const stepProgress = document.getElementById('step-progress');
const hudBottom = document.getElementById('hud-bottom');
const btnReset = document.getElementById('btn-reset');
const btnHub = document.getElementById('btn-hub');
const orderHint = document.getElementById('order-hint');
const toastEl = document.getElementById('hud-hint');
const finaleEl = document.getElementById('finale');
const finaleTitle = document.getElementById('finale-title');
const finaleBody = document.getElementById('finale-body');
const finaleFooter = document.getElementById('finale-footer');
const finaleEpilogue = document.getElementById('finale-epilogue');
const btnReplay = document.getElementById('btn-replay');
const btnFinaleHub = document.getElementById('btn-finale-hub');
const subtitleEl = document.getElementById('hud-subtitle');
const inventoryStrip = document.getElementById('inventory-strip');
const endingChoices = document.getElementById('ending-choices');
const btnCraftEye = document.getElementById('btn-craft-eye');
const btnHint = document.getElementById('btn-hint');
const ch1Tools = document.getElementById('ch1-tools');
const btnLedger = document.getElementById('btn-ledger');
const btnLedgerHub = document.getElementById('btn-ledger-hub');
const btnLedgerClose = document.getElementById('btn-ledger-close');
const ledgerEl = document.getElementById('ledger');
const ledgerList = document.getElementById('ledger-list');
const feelCaption = document.getElementById('feel-caption');
const evalEl = document.getElementById('eval-sheet');
const btnEval = document.getElementById('btn-eval');
const btnEvalHub = document.getElementById('btn-eval-hub');
const btnEvalClose = document.getElementById('btn-eval-close');
const btnEvalSave = document.getElementById('btn-eval-save');
const evalForm = document.getElementById('eval-form');

const session = createSessionLog();
let cinematics = null;

if (prefersReducedMotion()) {
  document.documentElement.classList.add('reduced-motion');
}

function setObjective(text) {
  objectiveText.textContent = text;
}

function setSteps(active, doneList = []) {
  stepProgress.querySelectorAll('.step').forEach((el) => {
    const s = el.dataset.step;
    el.classList.toggle('active', s === active);
    el.classList.toggle('done', doneList.includes(s));
  });
  cinematics?.advanceStep(active, doneList);
}

function renderSteps(stepDefs) {
  stepProgress.innerHTML = '';
  stepDefs.forEach((s) => {
    const span = document.createElement('span');
    span.className = 'step';
    span.dataset.step = s.id;
    span.textContent = s.label;
    stepProgress.appendChild(span);
  });
}

function setOrderHint(html) {
  orderHint.innerHTML = html;
}

let toastTimer = null;
function toast(msg, ok = false) {
  session.event('toast', { msg, ok: !!ok });
  toastEl.textContent = msg;
  toastEl.classList.toggle('ok', ok);
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2400);
}

let feelTimer = null;
let lastFeel = null;
function announceFeel(kind, text) {
  lastFeel = { kind, text };
  session.event('feel', { kind, text });
  if (!feelCaption) return;
  feelCaption.textContent = text;
  feelCaption.dataset.kind = kind;
  feelCaption.classList.remove('hidden');
  clearTimeout(feelTimer);
  feelTimer = setTimeout(() => feelCaption.classList.add('hidden'), 2200);
}

let evidence = loadEvidence();

function renderLedger(chapterId) {
  if (!ledgerList) return;
  const rows = listEvidence(evidence, chapterId);
  ledgerList.innerHTML = '';
  if (!rows.length) {
    const empty = document.createElement('li');
    empty.className = 'ledger-empty';
    empty.textContent = '아직 장부에 적은 단서가 없소.';
    ledgerList.appendChild(empty);
    return;
  }
  rows.forEach((e) => {
    const li = document.createElement('li');
    const h = document.createElement('strong');
    h.textContent = e.title;
    const p = document.createElement('p');
    p.textContent = e.body;
    li.appendChild(h);
    li.appendChild(p);
    ledgerList.appendChild(li);
  });
}

function openLedger() {
  inputController.cancel('ledger');
  if (!ledgerEl) return;
  renderLedger(current ? current.id : null);
  ledgerEl.classList.remove('hidden');
  session.event('ledger-open');
  session.noteAction('ledger', { observation: true });
}

function hideLedger() {
  if (ledgerEl) ledgerEl.classList.add('hidden');
}

function noteEvidence(id) {
  evidence = recordEvidence(id);
  session.event('evidence', { id });
  session.noteAction('evidence:' + id, { observation: true });
  if (ledgerEl && !ledgerEl.classList.contains('hidden')) renderLedger(current ? current.id : null);
}

function showFinale({ title, body, footer, epilogue, endings, onEnding, briefs, onBrief }) {
  cinematics?.finish();
  finaleTitle.textContent = title;
  finaleBody.innerHTML = body;
  finaleFooter.textContent = footer || '';
  finaleEpilogue.textContent = epilogue || '';
  const briefBox = document.getElementById('ending-briefs');
  if (briefBox) {
    briefBox.innerHTML = '';
    if (briefs && briefs.length) {
      briefBox.classList.remove('hidden');
      briefs.forEach((b) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'brief-btn';
        btn.textContent = b.title;
        btn.addEventListener('click', () => {
          resumeAudio();
          playClick();
          if (onBrief) onBrief(b);
        });
        briefBox.appendChild(btn);
      });
    } else {
      briefBox.classList.add('hidden');
    }
  }
  if (endingChoices) {
    endingChoices.innerHTML = '';
    if (endings && endings.length) {
      endingChoices.classList.remove('hidden');
      endings.forEach((e) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ending-btn' + (e.ready === false ? ' ending-incomplete' : '');
        btn.textContent = e.label;
        if (e.note) {
          const note = document.createElement('small');
          note.className = 'ending-note';
          note.textContent = e.note;
          btn.appendChild(document.createElement('br'));
          btn.appendChild(note);
        }
        btn.addEventListener('click', () => {
          resumeAudio();
          playClick();
          if (onEnding) onEnding(e);
        });
        endingChoices.appendChild(btn);
      });
    } else {
      endingChoices.classList.add('hidden');
    }
  }
  finaleEl.classList.remove('hidden');
  if (btnEval) {
    btnEval.classList.toggle('hidden', !(current && (current.id === 4 || current.id === 5)));
  }
}

function readEvalForm() {
  if (!evalForm) return null;
  const val = (name) => {
    const el = evalForm.elements[name];
    return el ? el.value : '';
  };
  const hintRow = session.summary().find((r) => r.chapter === (current && current.id));
  return {
    cohort: val('cohort'),
    fun: val('fun'),
    discomfort: val('discomfort'),
    aha: [val('aha1'), val('aha2')],
    causation: val('causation'),
    nextIntent: val('nextIntent'),
    hintStage: hintRow ? hintRow.hintLevel : Number(val('hintStage') || 0),
    notes: val('notes'),
  };
}

function openEval() {
  inputController.cancel('evaluation');
  if (!evalEl) return;
  hideLedger();
  const hintRow = session.summary().find((r) => r.chapter === (current && current.id));
  if (evalForm && evalForm.elements.hintStage && hintRow) {
    evalForm.elements.hintStage.value = String(hintRow.hintLevel || 0);
  }
  evalEl.classList.remove('hidden');
  session.event('eval-open');
}

function hideEval() {
  if (evalEl) evalEl.classList.add('hidden');
}

function submitEval() {
  const sheet = readEvalForm();
  if (!sheet) return;
  saveEvalSheet(sheet);
  hideEval();
  toast('구간 평가를 장부에 적었소.', true);
  session.event('eval-save', { cohort: sheet.cohort, fun: sheet.fun });
}

function hideFinale() {
  finaleEl.classList.add('hidden');
  if (endingChoices) {
    endingChoices.innerHTML = '';
    endingChoices.classList.add('hidden');
  }
  const briefBox = document.getElementById('ending-briefs');
  if (briefBox) {
    briefBox.innerHTML = '';
    briefBox.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
const boot = bootProgress();
let cleared = boot.cleared;
let inventory = boot.inventory;
let lastEnding = boot.ending;

function markCleared(chapterId) {
  applyClearedChapter(chapterId, cleared, inventory);
  session.endChapter({ cleared: true });
  renderHub();
  if (current && current.id === 10 && typeof renderInventoryStrip === 'function') {
    renderInventoryStrip(true);
  }
}

function recordEnding(id) {
  lastEnding = saveEnding(id);
  renderHub();
}

let selectedPartId = null;

function renderInventoryStrip(show) {
  if (!inventoryStrip) return;
  if (!show) {
    inventoryStrip.classList.add('hidden');
    inventoryStrip.innerHTML = '';
    return;
  }
  inventoryStrip.classList.remove('hidden');
  const owned = getOwnedParts(inventory);
  inventoryStrip.innerHTML = '<div class="inv-label">놋쇠 부품</div><div class="inv-parts"></div>';
  const row = inventoryStrip.querySelector('.inv-parts');
  PARTS.forEach((p) => {
    const has = inventory.has(p.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'inv-part' + (has ? '' : ' missing') + (selectedPartId === p.id ? ' selected' : '');
    btn.title = p.name + ' · 새김 ' + PART_MARKS[p.id];
    btn.dataset.part = String(p.id);
    btn.setAttribute('aria-label', p.name + (has ? '' : ' · 아직 획득하지 않음'));
    btn.setAttribute('aria-pressed', String(selectedPartId === p.id));
    btn.textContent = has ? PART_MARKS[p.id] : '·';
    const origin = document.createElement('small');
    origin.textContent = ['반닫이', '자개', '어보', '약장', '경대', '혼천', '벽사', '병풍', '규표'][p.id - 1];
    btn.appendChild(origin);
    btn.disabled = !has;
    if (has) {
      btn.addEventListener('click', () => {
        resumeAudio();
        selectedPartId = p.id;
        if (current && current.selectPart) current.selectPart(p.id);
        renderInventoryStrip(true);
        Array.from(inventoryStrip.querySelectorAll('.inv-part')).find(button => button.dataset.part === String(p.id))?.focus({ preventScroll: true });
        playClick();
      });
    }
    row.appendChild(btn);
  });
  const count = document.createElement('span');
  count.className = 'inv-count';
  count.textContent = `${owned.length}/9`;
  inventoryStrip.appendChild(count);
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const mats = createMaterials();
const anim = createAnimSystem();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch (err) {
  console.warn('[궤] WebGL unavailable — logic-only mode', err);
  renderer = {
    setPixelRatio() {}, setSize() {}, render() {},
    shadowMap: { enabled: false, type: 0 },
    domElement: canvas,
  };
}
// Mobile-ish cap
if (renderer.setPixelRatio) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
if (renderer.setSize) renderer.setSize(window.innerWidth, window.innerHeight);
if (renderer.shadowMap) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
if ('outputColorSpace' in renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

// Safari / mobile: survive GPU context loss (tab background, memory pressure)
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  console.warn('[궤] WebGL context lost');
}, false);
canvas.addEventListener('webglcontextrestored', () => {
  console.info('[궤] WebGL context restored');
  if (renderer.setPixelRatio) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  if (renderer.setSize) renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0806);
scene.fog = new THREE.FogExp2(0x0a0806, 0.045);
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 50);
camera.position.set(1.85, 1.4, 1.75);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.55, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.zoomSpeed = 0.28; // wheel / pinch: small steps (was default 1.0 — too abrupt)
controls.rotateSpeed = 0.85;
controls.panSpeed = 0.6;
controls.minDistance = 1.35; // prevent sudden face-plant into chest
controls.maxDistance = 5.2;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minPolarAngle = 0.15;
controls.zoomToCursor = false;
controls.enablePan = false; // reduce accidental pan on touch
// iOS Safari: explicit mouse/touch maps; ONE-finger rotate, TWO-finger pinch-zoom
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
};
controls.update();

const ambient = new THREE.AmbientLight(0x3a3028, 0.45);
scene.add(ambient);
const key = new THREE.SpotLight(0xffd8a0, 2.4, 12, Math.PI / 5, 0.45, 1.2);
key.position.set(1.8, 3.2, 1.5);
key.target.position.set(0, 0.5, 0);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.bias = -0.0002;
scene.add(key);
scene.add(key.target);
const fill = new THREE.PointLight(0xc4a070, 0.55, 8);
fill.position.set(-1.5, 1.8, -1.2);
scene.add(fill);
const rim = new THREE.DirectionalLight(0x605040, 0.35);
rim.position.set(-2, 2, -3);
scene.add(rim);

// Extra warm fill used only in Ch1
const ch1Warm = new THREE.PointLight(0xffb060, 0, 6, 2);
ch1Warm.position.set(-0.9, 1.1, 0.6);
scene.add(ch1Warm);

// Shared readable fills (QA 공통 가독 라이트) — camera / rear / left; used by setReadableLighting for all chapters
const ch1Front = new THREE.PointLight(0xffe8c8, 0, 7, 2);
ch1Front.position.set(0.4, 1.4, 2.4);
scene.add(ch1Front);

// Rear-left fill — BL (좌후) silhouette from default orbit (QA retest)
const ch1Rear = new THREE.PointLight(0xffd8a8, 0, 6.5, 2);
ch1Rear.position.set(-1.15, 1.35, -1.85);
scene.add(ch1Rear);

// Left-flank fill — BL joinery silhouette in default 3/4 view (QA)
const ch1Left = new THREE.PointLight(0xffe0b0, 0, 5.5, 2);
ch1Left.position.set(-1.6, 1.2, 0.55);
scene.add(ch1Left);

// Extra cool fill used only in Ch2 (나전)
const ch2Cool = new THREE.PointLight(0xa8c8e0, 0, 5, 2);
ch2Cool.position.set(0.35, 1.15, 0.55);
scene.add(ch2Cool);
// Mild warm key used only in Ch4 (yakjang wood / brass)
const ch4Warm = new THREE.PointLight(0xffc878, 0, 5.5, 2);
ch4Warm.position.set(0.4, 1.0, 0.7);
scene.add(ch4Warm);

const defaultLight = {
  ambient: 0.45,
  key: 2.4,
  fill: 0.55,
  rim: 0.35,
  exposure: 1.05,
  fog: 0.045,
};


/** QA 공통 가독 라이트 — Must: interactives readable in default 3/4 view without craft-eye.
 *  Atmosphere stays in background; chapter accents (ch1Warm / ch2Cool / ch4Warm) layer on top.
 *  Never reference undeclared lights (ch2Cool regression class).
 */
function setReadableLighting(on, chapterId) {
  if (on) {
    ambient.intensity = 0.62;
    key.intensity = 2.65;
    key.color.setHex(0xffe8c8);
    key.penumbra = 0.5;
    fill.intensity = 0.75;
    fill.color.setHex(0xffd0a8);
    fill.position.set(-1.1, 2.0, 0.6);
    rim.intensity = 0.55;
    rim.color.setHex(0x908070);
    rim.position.set(-2.2, 2.4, -0.5);
    ch1Front.intensity = 1.25;
    ch1Rear.intensity = 1.4;
    ch1Left.intensity = 1.5;
    if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = 1.22;
    scene.fog.density = 0.028;
  } else {
    ch1Front.intensity = 0;
    ch1Rear.intensity = 0;
    ch1Left.intensity = 0;
    // Full ambient/key reset only when no chapter accents remain
    if (ch1Warm.intensity <= 0 && (typeof ch2Cool === 'undefined' || ch2Cool.intensity <= 0) && (typeof ch4Warm === 'undefined' || ch4Warm.intensity <= 0)) {
      ambient.intensity = defaultLight.ambient;
      key.intensity = defaultLight.key;
      key.color.setHex(0xffd8a0);
      key.penumbra = 0.45;
      fill.intensity = defaultLight.fill;
      fill.color.setHex(0xc4a070);
      fill.position.set(-1.5, 1.8, -1.2);
      rim.intensity = defaultLight.rim;
      rim.color.setHex(0x605040);
      rim.position.set(-2, 2, -3);
      if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = defaultLight.exposure;
      scene.fog.density = defaultLight.fog;
    }
  }
}
function setCh1Lighting(on) {
  if (on) {
    // Museum-warm key/fill for bandaji GLB; readable fills kept so BL still reads
    ambient.intensity = 0.68;
    key.intensity = 2.55;
    key.color.setHex(0xffe2b4);
    key.penumbra = 0.52;
    fill.intensity = 0.95;
    fill.color.setHex(0xffc898);
    fill.position.set(-1.0, 2.1, 1.0);
    rim.intensity = 0.7;
    rim.color.setHex(0xb0a090);
    rim.position.set(-2.4, 2.6, 0.2);
    ch1Warm.intensity = 1.55;
    ch1Front.intensity = 1.15;
    ch1Rear.intensity = 1.2;
    ch1Left.intensity = 1.25;
    ch2Cool.intensity = 0;
    ch4Warm.intensity = 0;
    if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = 1.12;
    // Museum gallery fog — slightly warmer void so walls read without washing the chest
    scene.background = new THREE.Color(0x100e0c);
    if (scene.fog) scene.fog.color.setHex(0x100e0c);
    scene.fog.density = 0.022;
  } else {
    ambient.intensity = defaultLight.ambient;
    key.intensity = defaultLight.key;
    key.color.setHex(0xffd8a0);
    key.penumbra = 0.45;
    fill.intensity = defaultLight.fill;
    fill.color.setHex(0xc4a070);
    fill.position.set(-1.5, 1.8, -1.2);
    rim.intensity = defaultLight.rim;
    rim.color.setHex(0x605040);
    rim.position.set(-2, 2, -3);
    ch1Warm.intensity = 0;
    ch1Front.intensity = 0;
    ch1Rear.intensity = 0;
    ch1Left.intensity = 0;
    if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = defaultLight.exposure;
    scene.background = new THREE.Color(0x0a0806);
    if (scene.fog) scene.fog.color.setHex(0x0a0806);
    scene.fog.density = defaultLight.fog;
  }
}

function setCh2Lighting(on) {
  if (typeof ch2Cool === 'undefined') return; // QA: never ReferenceError on unload/cache
  if (on) {
    // Common readable silhouette first (QA), then Ch2 cool/nacre accent on top
    setReadableLighting(true, 2);
    ch1Warm.intensity = 0;
    if (typeof ch4Warm !== 'undefined') ch4Warm.intensity = 0;
    ch2Cool.intensity = 0.85;
    // Slightly cooler key tint for lacquer/nacre without killing fills
    key.color.setHex(0xffe8d0);
    fill.color.setHex(0xa8c0d8);
    if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = 1.18;
    scene.fog.density = 0.03;
  } else {
    ch2Cool.intensity = 0;
    setReadableLighting(false, 2);
  }
}


function setCh4Lighting(on) {
  if (on) {
    setReadableLighting(true, 4);
    ch1Warm.intensity = 0;
    ch2Cool.intensity = 0;
    ch4Warm.intensity = 0.9;
    key.color.setHex(0xffe2b8);
    fill.color.setHex(0xe0b888);
    if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = 1.2;
    scene.fog.density = 0.03;
  } else {
    ch4Warm.intensity = 0;
    setReadableLighting(false, 4);
  }
}
const shellRoom = new THREE.Group();
shellRoom.name = 'shell-room';
scene.add(shellRoom);
(function makeRoom() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  shellRoom.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), mats.wall);
  back.position.set(0, 2.5, -3);
  shellRoom.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), mats.wall);
  left.rotation.y = Math.PI / 2;
  left.position.set(-3.5, 2.5, 0);
  shellRoom.add(left);
}());
// Chapter sets; Ch1 retains its gallery shell and receives its own dressing.
const sliceStage = createSliceStage(scene, renderer, mats);
function syncSliceStage(chapterId) {
  const id = Number(chapterId) || 0;
  sliceStage.setChapter(id);
  shellRoom.visible = !(id >= 1 && id <= 15);
}

// ---------------------------------------------------------------------------
// Chapter lifecycle
// ---------------------------------------------------------------------------
let mode = 'prologue'; // prologue | hub | play

/** Keep OrbitControls/canvas from eating prologue/hub clicks (some GPUs/browsers). */
function setShellPointerMode(next) {
  mode = next;
  const ui = next === 'prologue' || next === 'hub';
  if (controls) controls.enabled = !ui;
  if (canvas) canvas.style.pointerEvents = ui ? 'none' : 'auto';
}
setShellPointerMode('prologue');
let current = null; // chapter instance
let blenderFinish = null;

function makeApi() {
  return {
    THREE,
    mats,
    animateTo: anim.animateTo,
    animateVec3: anim.animateVec3,
    shake: anim.shake,
    playThunk,
    playClick,
    playUnlock,
    playWrong,
    playJoinerySlide,
    playWoodThunk,
    playBrassScrape,
    playLatchClack,
    playDrawerRumble,
    playNacreClick,
    playNacreChime,
    playRubPaper,
    recoil: anim.recoil,
    announceFeel,
    recordEvidence: noteEvidence,
    foundEvidence: () => evidence,
    vibrate,
    setObjective,
    setSteps,
    setOrderHint,
    toast,
    showFinale,
    markCleared,
    recordEnding,
    setCh1Lighting,
    setReadableLighting,
    setCh2Lighting,
    setCh4Lighting,
    getInventory: () => inventory,
    grantAllParts: () => {
      grantAllParts(inventory);
      renderInventoryStrip(current && current.id === 10);
    },
    renderInventoryStrip,
    setSelectedPart: (id) => { selectedPartId = id; renderInventoryStrip(current && current.id === 10); },
  };
}

function maybeStallToast(guide) {
  if (guide) toast(guide);
}

function setCh1ToolsVisible(show) {
  if (ch1Tools) ch1Tools.classList.toggle('hidden', !show);
}

function unloadChapter(reason = 'chapter-change') {
  cinematics?.setChapter(null);
  clearTimeout(toastTimer); clearTimeout(feelTimer);
  toastEl.classList.add('hidden'); feelCaption?.classList.add('hidden');
  blenderFinish?.dispose();blenderFinish=null;
  inputController.cancel(reason);
  if (current) {
    anim.clear();
    current.dispose(scene);
    current = null;
  }
  setCh1Lighting(false);
  setCh2Lighting(false);
  setCh4Lighting(false);
  setReadableLighting(false);
  syncSliceStage(0);
  sliceExperience.setChapter(null);
  setCh1ToolsVisible(false);
  hideFinale();
  hideLedger();
  hideEval();
}

function loadChapter(chapterId, { cinematic = true } = {}) {
  unloadChapter();
  const meta = CHAPTER_META.find((m) => m.id === chapterId);
  current = createChapter(chapterId, makeApi());
  attachChapterLog(current, session, { onStall: maybeStallToast });
  session.beginChapter(chapterId);
  const priorRoots=new Set(scene.children);
  current.build(scene);
  if(chapterId<=10&&!new URLSearchParams(location.search).has('authoring'))blenderFinish=attachBlenderFinish(chapterId,scene.children.filter(root=>!priorRoots.has(root)));
  syncSliceStage(chapterId);
  renderSteps(meta.steps);
  cinematics?.setChapter(chapterId);
  orderHint.innerHTML = meta.hint;
  subtitleEl.textContent = `제${chapterId}장 · ${meta.title}`;
  camera.position.set(1.85, 1.4, 1.75);
  controls.target.set(0, 0.55, 0);
  controls.update();
  current.start();
  // QA 공통 가독 라이트: chapters without setChNLighting still get silhouette fills
  if (chapterId !== 1 && chapterId !== 2 && chapterId !== 4) {
    setReadableLighting(true, chapterId);
  }
  sliceExperience.setChapter(chapterId);
  setShellPointerMode('play');
  hubEl.classList.add('hidden');
  prologue.classList.add('hidden');
  hudObjective.classList.remove('hidden');
  hudBottom.classList.remove('hidden');
  renderInventoryStrip(chapterId === 10);
  // Every campaign chapter exposes its existing request-only hints.
  setCh1ToolsVisible(chapterId >= 1 && chapterId <= 10);
  if (btnCraftEye) {
    btnCraftEye.classList.toggle('hidden', !(chapterId === 1 || chapterId === 2 || chapterId === 4 || chapterId === 5));
  }
  if (cinematic) cinematics?.enter(chapterId, meta.title);
}

function showHub() {
  unloadChapter('hub');
  setShellPointerMode('hub');
  prologue.classList.add('hidden');
  hubEl.classList.remove('hidden');
  hudObjective.classList.add('hidden');
  hudBottom.classList.add('hidden');
  hideFinale();
  hideLedger();
  hideEval();
  renderInventoryStrip(false);
  setCh1ToolsVisible(false);
  subtitleEl.textContent = '비밀 서고 · 챕터 선택';
  renderHub();
}

function fillHubList(listEl, ids) {
  listEl.innerHTML = '';
  ids.forEach((cid) => {
    const m = CHAPTER_META.find((x) => x.id === cid);
    if (!m) return;
    const li = document.createElement('li');
    const done = cleared.has(m.id);
    const endingMark = (m.id === 10 && lastEnding && ENDING_LABELS[lastEnding])
      ? ` <em class="hub-ending">${ENDING_LABELS[lastEnding]}</em>`
      : '';
    li.innerHTML = `
      <button type="button" class="hub-card" data-ch="${m.id}">
        <span class="hub-num">제${m.id}장</span>
        <span class="hub-title">${m.title}${done ? ' <em class="check">✓</em>' : ''}${endingMark}</span>
        <span class="hub-blurb">${m.blurb}</span>
      </button>`;
    listEl.appendChild(li);
  });
  listEl.querySelectorAll('.hub-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      resumeAudio();
      loadChapter(Number(btn.dataset.ch));
      playClick();
    });
  });
}

function renderHub() {
  fillHubList(hubList, MAIN_CHAPTER_IDS);
  const dlcList = document.getElementById('hub-dlc-list');
  if (dlcList) fillHubList(dlcList, DLC_CHAPTER_IDS);
  let dbg = hubEl.querySelector('.hub-debug');
  if (!dbg) {
    dbg = document.createElement('p');
    dbg.className = 'hub-debug proto-note';
    hubEl.appendChild(dbg);
  }
  dbg.textContent = '';
  dbg.appendChild(document.createTextNode(`놋쇠 부품 ${inventory.size}/9 · `));
  const gb = document.createElement('button');
  gb.type = 'button';
  gb.id = 'btn-grant-parts';
  gb.textContent = '부품 전부 지급';
  gb.addEventListener('click', () => {
    resumeAudio();
    grantAllParts(inventory);
    toast('아홉 놋쇠를 모두 지급했습니다.', true);
    playClick();
    renderHub();
  });
  dbg.appendChild(gb);
}

// ---------------------------------------------------------------------------
// Pointer / raycast (click + hold + hover) — iOS: tap vs orbit drag
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function ndcFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  pointer.x = x * 2 - 1;
  pointer.y = -(y * 2 - 1);
}

function pick() {
  if (!current) return null;
  raycaster.setFromCamera(pointer, camera);
  const meshes = current.getInteractives();
  const hits = raycaster.intersectObjects(meshes.filter(mesh => {
    for (let p = mesh; p; p = p.parent) if (!p.visible) return false;
    return true;
  }), false);
  if (!hits.length) return null;
  const ud = hits[0].object.userData;
  return ud && ud.kind ? ud : null;
}

const sliceExperience = createSliceExperience({
  scene, camera, controls, renderer, canvas,
  lights: { key, fill, rim, ambient, ch1Front, ch1Rear, ch1Left, ch4Warm },
  getChapter: () => current, getInput: () => inputController,
  getMode: () => mode, loadChapter, resumeAudio,
});
const inputController = createInputController({
  canvas, controls,
  getChapter: () => current,
  isPlaying: () => mode === 'play' && !sliceExperience.isBlocked(),
  hitTest: (event) => { ndcFromEvent(event); return pick(); },
  wakeAudio: resumeAudio,
  adaptDragSample: sliceExperience.adaptDragSample,
  onGestureChange: sliceExperience.onGestureChange,
});
cinematics = createCampaignCinematics({
  stage: sliceStage, experience: sliceExperience, onIntroEnd: showHub,
  playCue: playStoryCue, noteEvent: (kind, data) => session.event(kind, data),
});

function resetCurrentChapter(reason = 'reset') {
  inputController.cancel(reason);
  anim.clear();
  cinematics.setChapter(current?.id || 0);
  if (current) current.reset();
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
btnStart.addEventListener('click', (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  resumeAudio();
  prologue.classList.add('hidden');
  cinematics.intro();
  playClick();
});
document.getElementById('btn-intro-replay').addEventListener('click', () => {
  resumeAudio(); hideLedger(); hideEval(); hubEl.classList.add('hidden'); cinematics.intro();
});

btnReset.addEventListener('click', () => {
  resumeAudio();
  hideFinale();
  resetCurrentChapter();
  playClick();
});

btnHub.addEventListener('click', () => {
  resumeAudio();
  showHub();
  playClick();
});

btnReplay.addEventListener('click', () => {
  resumeAudio();
  hideFinale();
  resetCurrentChapter('replay');
  playClick();
});

btnFinaleHub.addEventListener('click', () => {
  resumeAudio();
  showHub();
  playClick();
});

if (btnCraftEye) {
  btnCraftEye.addEventListener('click', () => {
    resumeAudio();
    if (current && current.toggleCraftEye) current.toggleCraftEye();
  });
}

if (btnHint) {
  btnHint.addEventListener('click', () => {
    resumeAudio();
    if (current && current.revealHint) current.revealHint();
    else playClick();
  });
}

function onLedgerButton() {
  resumeAudio();
  playClick();
  if (ledgerEl && !ledgerEl.classList.contains('hidden')) hideLedger();
  else openLedger();
}
if (btnLedger) btnLedger.addEventListener('click', onLedgerButton);
if (btnLedgerHub) btnLedgerHub.addEventListener('click', onLedgerButton);
if (btnLedgerClose) {
  btnLedgerClose.addEventListener('click', () => {
    resumeAudio();
    hideLedger();
    playClick();
  });
}

function onEvalButton() {
  resumeAudio();
  playClick();
  if (evalEl && !evalEl.classList.contains('hidden')) hideEval();
  else openEval();
}
if (btnEval) btnEval.addEventListener('click', onEvalButton);
if (btnEvalHub) btnEvalHub.addEventListener('click', onEvalButton);
if (btnEvalClose) {
  btnEvalClose.addEventListener('click', () => {
    resumeAudio();
    hideEval();
    playClick();
  });
}
if (btnEvalSave) {
  btnEvalSave.addEventListener('click', () => {
    resumeAudio();
    playClick();
    submitEval();
  });
}

// ---------------------------------------------------------------------------
// Resize + loop
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  if (renderer.setPixelRatio) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  if (renderer.setSize) renderer.setSize(w, h);
  sliceExperience.resize();
}
window.addEventListener('resize', onResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onResize);
}

function tick(now) {
  requestAnimationFrame(tick);
  anim.tick(now);
  sliceExperience.tick(now);
  cinematics.tick(now);
  sliceStage.tick(now);
  if (controls.enabled) controls.update();
  // Subtle lamp flicker when chapter accent lights are on
  if (typeof ch1Warm !== 'undefined' && ch1Warm.intensity > 0) {
    ch1Warm.intensity = 1.5 + Math.sin(now * 0.006) * 0.05 + Math.sin(now * 0.019) * 0.025;
    if (typeof ch1Front !== 'undefined' && ch1Front.intensity > 0) {
      ch1Front.intensity = 1.1 + Math.sin(now * 0.005) * 0.03;
    }
    if (typeof ch1Rear !== 'undefined' && ch1Rear.intensity > 0) {
      ch1Rear.intensity = 1.15 + Math.sin(now * 0.0045) * 0.04;
    }
    if (typeof ch1Left !== 'undefined' && ch1Left.intensity > 0) {
      ch1Left.intensity = 1.2 + Math.sin(now * 0.0055) * 0.04;
    }

  }
  if (typeof ch2Cool !== 'undefined' && ch2Cool.intensity > 0) {
    ch2Cool.intensity = 0.78 + Math.sin(now * 0.005) * 0.06 + Math.sin(now * 0.017) * 0.04;
  }
  if (typeof ch4Warm !== 'undefined' && ch4Warm.intensity > 0) {
    ch4Warm.intensity = 0.82 + Math.sin(now * 0.0048) * 0.05 + Math.sin(now * 0.016) * 0.03;
  }
  try { renderer.render(scene, camera); } catch (_) { /* headless / no GL */ }
}
requestAnimationFrame(tick);

// ---------------------------------------------------------------------------
// Debug / smoke helpers
// ---------------------------------------------------------------------------
window.__GWE__ = {
  getCraftStatus: () => blenderFinish?.status || null,
  CHAPTER_META,
  PARTS,
  getMode: () => mode,
  getChapter: () => (current ? current.id : null),
  getCleared: () => [...cleared],
  getInventory: () => [...inventory],
  showHub,
  loadChapter: (id) => loadChapter(id, { cinematic: false }),
  playIntro: () => { prologue.classList.add('hidden'); hubEl.classList.add('hidden'); cinematics.intro(); },
  enterChapter: loadChapter,
  skipCinematic: () => cinematics.skip(),
  getDirection: () => ({ ...cinematics.snapshot(), stage: sliceStage.snapshot() }),
  resetPuzzle: () => resetCurrentChapter(),
  startGame: showHub,
  solveChapter(n) {
    const id = Number(n);
    if (id === 10 && inventory.size < 9) grantAllParts(inventory);
    if (!current || current.id !== id) loadChapter(id, { cinematic: false });
    current.solve();
  },
  solve() {
    if (current) current.solve();
  },
  grantAllParts() {
    grantAllParts(inventory);
    renderHub();
    if (current && current.id === 10) renderInventoryStrip(true);
    toast('아홉 놋쇠를 모두 지급했습니다.', true);
  },
  clearProgress() {
    clearCampaign(cleared, inventory);
    evidence = [];
    lastEnding = null;
    session.reset();
    renderHub();
    renderInventoryStrip(false);
  },
  getEnding: () => lastEnding,
  getLedger: () => listEvidence(evidence, current ? current.id : null),
  getFeel: () => lastFeel,
  openLedger,
  hideLedger,
  getSessionLog: () => session.snapshot(),
  getSessionSummary: () => session.summary(),
  openEval,
  hideEval,
  getEvalSheets: () => loadEvalSheets(),
  scoreEval: () => scoreSheets(loadEvalSheets()),
  saveEval: (sheet) => saveEvalSheet(sheet),
  toggleCraftEye() {
    if (current && current.toggleCraftEye) current.toggleCraftEye();
  },
};

console.info('[궤] ready — 15 chapters · Ch1 flagship sensory upgrade');
