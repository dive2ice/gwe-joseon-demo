import * as THREE from 'three';
import { createMechanicalProjection } from './mechanical-projection.js';
import { alongAxis, onPlane } from './slice-drag.js';
import { prefersReducedMotion } from './anim.js';
import { chapterPresentation, gestureDescription } from './chapter-presentation.js';

/** Presentation and camera-space gestures. Puzzle rules remain in the chapter modules. */
export function createSliceExperience({ scene, camera, controls, renderer, canvas, lights, getChapter, getInput, getMode, loadChapter, resumeAudio }) {
  let close = false, tween = null, basis = null, returnFocus = null, chapterId = 0;
  const byId = id => document.getElementById(id);
  const inspect = byId('btn-inspect');
  const caption = byId('gesture-label');
  const active = () => !!chapterPresentation[chapterId];
  const dialogIds = ['cinematic', 'eval-sheet', 'story-journal', 'ledger', 'finale'];
  const dialog = () => dialogIds.map(byId).find(el => el && !el.classList.contains('hidden'));
  const restingCaption = '빈 곳을 밀어 둘러보기 · 휠 또는 두 손가락으로 확대';

  function frame(nextClose = false, immediate = false) {
    const profile = chapterPresentation[chapterId];
    if (!profile) return;
    getInput().cancel('camera-view');
    close = nextClose;
    const view = close ? profile.detail : profile.overview;
    const aim = new THREE.Vector3(...view.aim);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(view.height / (2 * tan * (view.fillY || .72)), view.width / (2 * tan * camera.aspect * (view.fillX || .84)));
    const direction = new THREE.Vector3(...view.direction).normalize();
    const position = aim.clone().addScaledVector(direction, dist);
    controls.minDistance = chapterId === 3 ? .22 : .45;
    controls.maxDistance = Math.max(5.2, dist * 1.4);
    controls.minPolarAngle = .15;
    controls.maxPolarAngle = Math.PI * .49;
    controls.rotateSpeed = .55;
    inspect?.setAttribute('aria-pressed', String(close));
    if (inspect) inspect.textContent = close ? '멀리 보기' : '가까이 보기';
    if (immediate || prefersReducedMotion()) {
      tween = null;
      camera.position.copy(position);
      controls.target.copy(aim);
      controls.update();
    } else tween = { start: performance.now(), from: camera.position.clone(), targetFrom: controls.target.clone(), position, aim };
  }

  function setChapter(id) {
    chapterId = id || 0;
    tween = null; close = false; basis = null;
    const profile = chapterPresentation[chapterId];
    const enabled = !!profile;
    document.body.classList.toggle('quality-slice', enabled);
    document.body.dataset.chapter = enabled ? String(id) : '';
    byId('view-tools')?.classList.toggle('hidden', !enabled);
    caption?.classList.toggle('hidden', !enabled);
    caption?.classList.remove('engaged');
    const { key, fill, rim, ambient, ch1Front, ch1Rear, ch1Left, ch4Warm } = lights;
    if (enabled) {
      // The first chapter retains its authored gallery lighting and baked GLB maps.
      if (id !== 1) {
        scene.background.setHex(profile.background);
        scene.fog.color.setHex(profile.background);
        scene.fog.density = .10;
        key.color.setHex(profile.key);
        key.intensity = profile.keyIntensity || 3;
        key.position.set(-1.6, 3.2, 2.1);
        key.penumbra = .8;
        key.shadow.normalBias = .018;
        ambient.intensity = .48;
        ch1Front.intensity = .75;
        ch1Rear.intensity = .45;
        ch1Left.intensity = .55;
        ch4Warm.intensity = 0;
        fill.color.setHex(profile.fill);
        fill.intensity = 1.1;
        fill.position.set(1.5, 1.6, 1.2);
        rim.color.setHex(profile.fill);
        rim.intensity = .85;
        renderer.toneMappingExposure = profile.exposure || 1.08;
      }
      frame(false, true);
      if (caption) caption.textContent = restingCaption;
    } else {
      controls.minDistance = 1.35;
      controls.maxDistance = 5.2;
      controls.rotateSpeed = .85;
      controls.minPolarAngle = .15;
      controls.maxPolarAngle = Math.PI * .48;
      key.position.set(1.8, 3.2, 1.5);
      key.shadow.normalBias = 0;
    }
  }

  function projectedAxes(owner, hit) {
    const mesh = owner.getInteractives().find(m => m.userData.kind === hit.kind && m.userData.id === hit.id);
    const position = mesh ? mesh.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0.7, 0);
    camera.updateMatrixWorld();
    const rect = canvas.getBoundingClientRect();
    const origin = position.clone().project(camera);
    const axis = (x, y, z) => {
      const p = position.clone().add(new THREE.Vector3(x, y, z).multiplyScalar(0.26)).project(camera);
      return { x: (p.x - origin.x) * rect.width / 0.52, y: (origin.y - p.y) * rect.height / 0.52 };
    };
    return { x: axis(1, 0, 0), z: axis(0, 0, 1) };
  }
  function adaptDragSample(owner, hit, sample) {
    if (basis?.mechanical) return basis.mechanical(sample);
    if (owner.id !== 2 && owner.id !== 4 && owner.id !== 5) return sample;
    const axes = basis || projectedAxes(owner, hit);
    // Desk XZ. projectedAxes is already pixels per 1 world unit, so onPlane's
    // coefficients are world units — the same units as RUB_STROKE.
    if (owner.id === 2 && hit.kind === 'rub') {
      const total = onPlane(sample.dx, sample.dy, axes.x, axes.z);
      const step = onPlane(sample.deltaX, sample.deltaY, axes.x, axes.z);
      return { ...sample, dx: total.x, dy: total.z, deltaX: step.x, deltaY: step.z };
    }
    if (owner.id !== 4 && owner.id !== 5) return sample;
    if (owner.id === 4 && hit.kind === 'drawer') return { ...sample, dy: alongAxis(sample.dx, sample.dy, axes.z) / (0.26 * 0.004) };
    if (owner.id === 5 && hit.kind === 'lamp') return { ...sample, deltaX: alongAxis(sample.deltaX, sample.deltaY, axes.x, { x: 1, y: 0 }) / 0.0018 };
    if (owner.id === 5 && hit.kind === 'mask') {
      const delta = onPlane(sample.deltaX, sample.deltaY, axes.x, axes.z);
      return { ...sample, deltaX: delta.x / 0.0022, deltaY: delta.z / 0.0022 };
    }
    // The mirror turns under a horizontal hand sweep, with equal travel on small screens.
    if (owner.id === 5 && hit.kind === 'mirror') return { ...sample, deltaX: sample.deltaX * 850 / Math.max(500, canvas.clientWidth) };
    return sample;
  }
  function onGestureChange(state) {
    if (state?.phase === 'press') {
      tween = null;
      basis = projectedAxes(state.owner, state.hit);
      const frame = state.owner.getGestureFrame?.(state.hit.kind, state.hit.id, state.hit);
      basis.mechanical = createMechanicalProjection(camera, canvas.getBoundingClientRect(), frame, state.sample);
    }
    if (!state) basis = null;
    if (!active() || !caption) return;
    caption.textContent = state ? gestureDescription(chapterId, state.hit.kind) : restingCaption;
    caption.classList.toggle('engaged', !!state);
  }

  let previousDialog = null;
  function syncDialog() {
    const visible = dialog();
    if (visible && !previousDialog && !returnFocus) returnFocus = document.activeElement;
    // A completion sheet may remain underneath an evaluation sheet.
    // Only the top dialog may receive focus, pointer input, or accessibility navigation.
    for (const id of dialogIds) {
      const el = byId(id);
      if (!el) continue;
      el.inert = !!visible && el !== visible;
      el.setAttribute('aria-hidden', String(el !== visible));
    }
    for (const id of ['prologue', 'hub', 'hud-objective', 'hud-bottom', 'ch1-tools', 'view-tools', 'inventory-strip', 'story-event']) {
      const el = byId(id); if (el) el.inert = !!visible;
    }
    document.body.classList.toggle('has-dialog', !!visible);
    if (visible) {
      getInput().cancel('dialog');
      if (visible.id !== 'cinematic' || !tween?.arrival) tween = null;
      controls.enabled = false; canvas.style.pointerEvents = 'none';
      if (visible !== previousDialog) {
        if (!returnFocus) returnFocus = document.activeElement;
        (visible.id === 'cinematic' ? byId('btn-cinematic-next') : visible.querySelector('button, select, input, textarea'))?.focus({ preventScroll: true });
      }
    } else if (previousDialog) {
      controls.enabled = getMode() === 'play';
      canvas.style.pointerEvents = getMode() === 'play' ? 'auto' : 'none';
      if (returnFocus?.getClientRects().length) returnFocus.focus({ preventScroll: true });
      else (getMode() === 'play' ? inspect : byId('hub')?.querySelector('.hub-card'))?.focus({ preventScroll: true });
      returnFocus = null;
    }
    previousDialog = visible;
  }
  const observer = new MutationObserver(syncDialog);
  for (const id of dialogIds) observer.observe(byId(id), { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', event => {
    const visible = dialog();
    if (!visible) return;
    if (event.key === 'Escape' && visible.id !== 'finale' && visible.id !== 'cinematic') {
      event.preventDefault();
      byId(visible.id === 'ledger' ? 'btn-ledger-close' : visible.id === 'story-journal' ? 'btn-story-close' : 'btn-eval-close').click();
    }
    if (event.key === 'Tab') {
      const items = [...visible.querySelectorAll('button, select, input, textarea')].filter(el => !el.disabled && el.getClientRects().length);
      const index = items.indexOf(document.activeElement);
      if (items.length && event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1).focus(); }
      else if (items.length && !event.shiftKey && (index < 0 || index === items.length - 1)) { event.preventDefault(); items[0].focus(); }
    }
  });
  inspect?.addEventListener('click', () => frame(!close));
  byId('btn-view-reset')?.addEventListener('click', () => frame(false));
  canvas.addEventListener('pointerdown', () => { tween = null; }, true);
  for (const button of document.querySelectorAll('[data-showcase]')) button.addEventListener('click', () => { resumeAudio(); loadChapter(Number(button.dataset.showcase)); });
  return {
    setChapter, adaptDragSample, onGestureChange,
    beginArrival(duration = 4200) {
      if (!active() || prefersReducedMotion()) return;
      getInput().cancel('arrival');
      const position = camera.position.clone(), aim = controls.target.clone();
      const from = position.clone().sub(aim).multiplyScalar(1.12).applyAxisAngle(new THREE.Vector3(0,1,0), -.13).add(aim);
      tween = { start: performance.now(), duration, from, targetFrom: aim.clone(), position, aim, arrival: true };
      camera.position.copy(from); camera.lookAt(aim);
    },
    finishArrival() {
      if (!tween?.arrival) return;
      camera.position.copy(tween.position); controls.target.copy(tween.aim); tween = null; controls.update();
    },
    isBlocked: () => !!dialog(),
    resize: () => { if (active()) frame(close, true); },
    tick(now) {
      if (!tween) return;
      const t = Math.min(1, (now - tween.start) / (tween.duration || 520)), eased = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(tween.from, tween.position, eased);
      controls.target.lerpVectors(tween.targetFrom, tween.aim, eased);
      camera.lookAt(controls.target);
      if (t === 1) tween = null;
    },
  };
}
