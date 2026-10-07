import { INTRO_BEATS, STAGE_SCENES, createBeatTracker } from './campaign-direction.js';
import { prefersReducedMotion } from './anim.js';

/** One cancellable timeline for intro/arrival, plus non-modal discovery captions. */
export function createCampaignCinematics({ stage, experience, onIntroEnd, playCue, noteEvent }) {
  const byId = id => document.getElementById(id);
  const overlay = byId('cinematic'), next = byId('btn-cinematic-next');
  const eventCard = byId('story-event'), journal = byId('story-journal');
  const tracker = createBeatTracker();
  let timeline = null, chapterId = 0, eventUntil = 0, records = [], serial = 0;
  function hideEvent() { eventCard.classList.add('hidden'); eventUntil = 0; }
  function closeOverlay() {
    timeline = null; overlay.classList.add('hidden');
    document.body.classList.remove('in-cinematic');
    experience.finishArrival();
  }
  function drawCard(card, arrival = false) {
    overlay.dataset.kind = arrival ? 'arrival' : 'intro'; overlay.dataset.art = card.art || '';
    byId('cinematic-label').textContent = card.label;
    byId('cinematic-title').textContent = card.title;
    byId('cinematic-text').textContent = card.text;
    byId('cinematic-count').textContent = arrival ? card.count : `${timeline.index + 1} / ${INTRO_BEATS.length}`;
    next.textContent = arrival ? '살펴보기' : timeline.index === INTRO_BEATS.length - 1 ? '서고로 들어가기' : '다음';
    overlay.classList.remove('hidden'); document.body.classList.add('in-cinematic');
    // Restart the text reveal when moving to another card.
    serial++; overlay.dataset.card = String(serial);
    const copy = overlay.querySelector('.cinematic-copy');
    copy.getAnimations?.().forEach(animation => animation.cancel());
    if (!prefersReducedMotion()) copy.animate?.([{ opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }], { duration: 600, easing: 'ease-out' });
    byId('btn-cinematic-skip').textContent = arrival ? '연출 건너뛰기' : '인트로 건너뛰기';
    playCue(arrival ? 'arrival' : 'intro');
  }
  function advance() {
    if (!timeline) return;
    if (timeline.kind === 'arrival') { closeOverlay(); return; }
    if (timeline.index < INTRO_BEATS.length - 1) {
      timeline.index++; timeline.start = performance.now(); drawCard(INTRO_BEATS[timeline.index]);
    } else { closeOverlay(); onIntroEnd(); }
  }
  function skip() {
    const kind = timeline?.kind; closeOverlay(); if (kind === 'intro') onIntroEnd();
  }
  next.addEventListener('click', advance);
  byId('btn-cinematic-skip').addEventListener('click', skip);
  byId('btn-event-close').addEventListener('click', hideEvent);
  byId('btn-story').addEventListener('click', () => {
    hideEvent(); journal.classList.remove('hidden');
  });
  byId('btn-story-close').addEventListener('click', () => journal.classList.add('hidden'));
  document.addEventListener('keydown', event => {
    if (!timeline || event.repeat) return;
    if (event.key === 'Escape') { event.preventDefault(); skip(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); advance(); }
  });
  function renderJournal() {
    const list = byId('story-journal-list'); list.replaceChildren();
    for (const entry of records) {
      const li = document.createElement('li'), title = document.createElement('strong'), body = document.createElement('p');
      title.textContent = entry.title; body.textContent = entry.text; li.append(title, body); list.append(li);
    }
  }
  return {
    intro() {
      closeOverlay(); hideEvent(); journal.classList.add('hidden');
      timeline = { kind: 'intro', index: 0, start: performance.now() }; drawCard(INTRO_BEATS[0]);
      noteEvent('intro-start', {});
    },
    setChapter(id) {
      closeOverlay(); hideEvent(); journal.classList.add('hidden');
      chapterId = id || 0; tracker.reset(chapterId);
      const scene = STAGE_SCENES[id]; records = scene ? [{ title: scene.location, text: scene.intro }] : []; renderJournal();
    },
    enter(id, title) {
      const scene = STAGE_SCENES[id]; if (!scene) return;
      timeline = { kind: 'arrival', start: performance.now() };
      drawCard({ label: `${scene.location} · ${scene.time}`, title, text: scene.intro, count: id <= 10 ? `제 ${id} 장 / 본편` : `제 ${id} 장 / 실측 서고` }, true);
      experience.beginArrival(4200); noteEvent('stage-enter', { chapterId: id, location: scene.location });
    },
    advanceStep(step, done) {
      const event = tracker.advance(step, done); if (!event) return;
      records.push(event); renderJournal();
      byId('story-event-title').textContent = event.title; byId('story-event-text').textContent = event.text;
      eventCard.dataset.effect = event.effect; eventCard.classList.remove('hidden'); eventUntil = performance.now() + 8000;
      stage.trigger(event.effect); playCue(event.effect); noteEvent('stage-event', event);
    },
    finish() { closeOverlay(); hideEvent(); journal.classList.add('hidden'); },
    skip,
    tick(now) {
      if (eventUntil && now >= eventUntil && !eventCard.matches(':hover') && !eventCard.contains(document.activeElement)) hideEvent();
      if (!timeline) return;
      const duration = timeline.kind === 'arrival' ? 4600 : 8500;
      overlay.style.setProperty('--cinematic-progress', `${Math.min(100, (now - timeline.start) / duration * 100)}%`);
      // Reduced motion also lets the player read every card at their own pace.
      if (now - timeline.start >= duration && !prefersReducedMotion() && !document.hidden) advance();
    },
    snapshot: () => ({ chapterId, timeline: timeline?.kind || null, index: timeline?.index ?? null, discoveries: tracker.snapshot().seen, records: records.map(e => ({ title: e.title, text: e.text })) }),
  };
}
