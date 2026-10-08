import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { chapterPresentation } from './chapter-presentation.js';
import { STAGE_SCENES } from './campaign-direction.js';
import { prefersReducedMotion } from './anim.js';

/** Authored sets around the clue planes. Background props are never hit targets. */
export function createSliceStage(scene, renderer, mats) {
  const root = new THREE.Group();
  root.name = 'craft-workshop'; root.visible = false; scene.add(root);
  const shell = new THREE.Group(), decor = new THREE.Group();
  shell.name = 'stage-architecture'; decor.name = 'stage-dressing'; root.add(shell, decor);
  const timber = new THREE.MeshStandardMaterial({ color: 0x342a23, roughness: .88, map: mats.sliceWoodDark?.map || null });
  const plaster = new THREE.MeshStandardMaterial({ color: 0x393c38, roughness: 1 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x303630, roughness: .96 });
  const paper = new THREE.MeshStandardMaterial({ color: 0x526569, roughness: .96, emissive: 0x304248, emissiveIntensity: .20, map: mats.slicePaper?.map || null });
  const brass = new THREE.MeshStandardMaterial({ color: 0x97805c, metalness: .7, roughness: .5 });
  const parchment = new THREE.MeshStandardMaterial({ color: 0xb2a384, roughness: 1 });
  const jade = new THREE.MeshStandardMaterial({ color: 0x536d66, roughness: .5 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x693d45, roughness: 1 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1), unitJar = new THREE.CylinderGeometry(.075, .11, .26, 12), unitRoll = new THREE.CylinderGeometry(.055, .055, .30, 10);
  const moving = [], owned = new Set();
  let chapterId = 0, pulse = null, effect = '', lastNow = 0;
  function box(w, h, d, material, x, y, z, parent = shell) {
    const mesh = new THREE.Mesh(unitBox, material); mesh.scale.set(w, h, d); mesh.position.set(x, y, z);
    mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const floor = new THREE.InstancedMesh(new THREE.BoxGeometry(.39, .035, 2.38), floorMat, 48), matrix = new THREE.Matrix4();
  for (let i = 0; i < 48; i++) { matrix.makeTranslation((i % 16 - 7.5) * .4, -.019, (Math.floor(i / 16) - 1) * 2.4); floor.setMatrixAt(i, matrix); }
  floor.receiveShadow = true; shell.add(floor);
  box(6.4, 3.3, .08, plaster, 0, 1.65, -2.1);
  for (const x of [-2.05, 0, 2.05]) {
    box(1.82, 2.15, .04, paper, x, 1.72, -2.04);
    for (let i = 0; i < 7; i++) box(.026, 2.2, .06, timber, x - .84 + i * .28, 1.72, -1.99);
    for (let i = 0; i < 7; i++) box(1.82, .024, .06, timber, x, .66 + i * .35, -1.98);
    box(.09, 3.3, .13, timber, x - .98, 1.65, -1.96); box(1.85, .12, .09, timber, x, .53, -1.97);
  }
  box(6.4, .12, .13, timber, 0, 2.92, -1.94); box(6.4, .18, .13, timber, 0, .12, -1.94);
  const mat = box(1.78, .006, 1.12, new THREE.MeshStandardMaterial({ color: 0x343a35, roughness: 1 }), 0, .001, .08);
  for (const x of [-.86, .86]) box(.012, .008, 1.06, brass, x, .004, .08);
  for (const z of [-.44, .6]) box(1.72, .008, .012, brass, 0, .004, z);
  const moon = new THREE.DirectionalLight(0xaec9d3, .75); moon.position.set(-2, 3, -1.5); root.add(moon);
  root.add(new THREE.HemisphereLight(0xbad1d4, 0x735239, .6));
  const lanternLight = new THREE.PointLight(0xffbc71, .7, 4, 2); lanternLight.position.set(-1.55, 1.4, -1.3); root.add(lanternLight);
  const dustGeometry = new THREE.BufferGeometry();
  const seeds = Array.from({ length: 64 }, (_, i) => ({ x: Math.sin(i * 17.31) * 2.7, y: ((i * .618) % 1) * 2.8, z: -.9 - ((i * .37) % 1) * 1.1 }));
  const dustPositions = new Float32Array(64 * 3); seeds.forEach((s, i) => dustPositions.set([s.x, s.y, s.z], i * 3));
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xf5d7a1, size: .012, transparent: true, opacity: .26, depthWrite: false });
  const dust = new THREE.Points(dustGeometry, dustMat); dust.name = 'stage-atmosphere'; root.add(dust);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xe4c98d, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const halo = new THREE.Mesh(new THREE.RingGeometry(.1, .115, 64), haloMat); halo.position.set(0, 1.45, -1.8); root.add(halo);
  let environment = null;
  if (renderer.isWebGLRenderer) {
    const studio = new RoomEnvironment(), generator = new THREE.PMREMGenerator(renderer);
    try { environment = generator.fromScene(studio, .06); } finally { studio.dispose(); generator.dispose(); }
  }
  function jar(x, y, z, material = jade) {
    const mesh = new THREE.Mesh(unitJar, material); mesh.position.set(x, y + .13, z); decor.add(mesh);
    box(.15, .025, .15, timber, x, y + .27, z, decor); box(.095, .09, .01, parchment, x, y + .13, z + .1, decor);
  }
  function shelf(x, contents = 'books', rows = 3) {
    for (const dx of [-.4, .4]) box(.055, 1.7, .4, timber, x + dx, .85, -1.58, decor);
    for (let r = 0; r < rows; r++) {
      const y = .3 + r * .48; box(.85, .045, .45, timber, x, y, -1.58, decor);
      for (let c = 0; c < 4; c++) {
        const px = x - .3 + c * .2;
        if (contents === 'jars') jar(px, y + .025, -1.55);
        else if (contents === 'rolls') { const roll = new THREE.Mesh(unitRoll, parchment); roll.rotation.z = Math.PI / 2; roll.position.set(px, y + .10, -1.56); decor.add(roll); }
        else { box(.15, .09 + (c % 2) * .05, .30, contents === 'silk' ? cloth : parchment, px, y + .1, -1.54, decor); box(.012, .15, .305, brass, px, y + .09, -1.54, decor); }
      }
    }
  }
  function panel(kind, x = 0, width = 1.72, height = 1.25, y = 1.9, z = chapterId === 1 ? -2.33 : -1.88) {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext('2d'), night = kind === 'stars', royal = kind === 'royal' || kind === 'throne';
    ctx.fillStyle = night ? '#152839' : royal ? '#4c2929' : '#948772'; ctx.fillRect(0, 0, 640, 480);
    for (let i = 0; i < 3500; i++) { ctx.fillStyle = i % 2 ? '#ffffff07' : '#0d111109'; ctx.fillRect((i * 137.3) % 640, (i * 71.9) % 480, 1 + i % 3, 1); }
    ctx.strokeStyle = night ? '#ceb987' : royal ? '#ba9869' : '#3c4843'; ctx.lineWidth = 2;
    if (night) {
      const stars = [[100,140],[180,110],[230,175],[310,160],[370,230],[465,210],[520,290]];
      for (let i = 0; i < 80; i++) { ctx.fillStyle = '#d5d2b2'; ctx.fillRect((i * 97) % 610 + 15, (i * 71) % 440 + 20, i % 7 ? 2 : 4, i % 7 ? 2 : 4); }
      ctx.beginPath(); stars.forEach(([sx,sy], i) => i ? ctx.lineTo(sx,sy) : ctx.moveTo(sx,sy)); ctx.stroke(); ctx.beginPath(); ctx.arc(320,240,176,0,Math.PI*2); ctx.stroke();
    } else if (kind === 'landscape' || royal || kind === 'clock') {
      for (let row = 0; row < 4; row++) {
        ctx.fillStyle = royal ? ['#334d50','#4a5b52','#65705b','#74654c'][row] : ['#71776c','#59675f','#4d5e56','#3c514b'][row]; ctx.beginPath(); ctx.moveTo(0,480);
        for (let px = 0; px <= 640; px += 12) ctx.lineTo(px,210 + row*48 - Math.abs(Math.sin(px*.009+row*.9))*115);
        ctx.lineTo(640,480); ctx.fill();
      }
      ctx.fillStyle = '#c8b681'; ctx.beginPath(); ctx.arc(royal ? 100 : 500,95,37,0,Math.PI*2); ctx.fill();
      if (royal) { ctx.fillStyle = '#ddd1b0'; ctx.beginPath(); ctx.arc(540,95,29,0,Math.PI*2); ctx.fill(); }
      ctx.strokeStyle = '#b6af93'; ctx.beginPath(); ctx.moveTo(320,260); ctx.bezierCurveTo(220,320,470,390,290,480); ctx.stroke();
    } else if (['mirror','wedding','silk'].includes(kind)) {
      for (let branch = 0; branch < 4; branch++) {
        ctx.strokeStyle = '#414b41'; ctx.beginPath(); ctx.moveTo(80+branch*120,480); ctx.lineTo(160+branch*92,80+branch*35); ctx.stroke();
        for (let i=0;i<7;i++) { ctx.fillStyle = '#b78e8f'; ctx.beginPath(); ctx.arc(100+branch*108+Math.sin(i*4)*32,100+i*43,7,0,Math.PI*2); ctx.fill(); }
      }
    } else {
      ctx.fillStyle = '#3e4439'; ctx.font = '36px serif';
      const texts = kind === 'herbs' ? ['약초','풀잎','뿌리'] : kind === 'ward' ? ['지킴','문','평안'] : ['작업','기록','보관']; texts.forEach((text,i) => ctx.fillText(text,475,110+i*100));
      for (let i=0;i<11;i++) { ctx.beginPath();ctx.moveTo(75+i*26,80);ctx.lineTo(70+i*26,365-i%3*33);ctx.stroke(); }
      ctx.fillStyle = '#843a2b'; ctx.fillRect(467,380,45,45);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; owned.add(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, emissive: night ? 0x193346 : 0x000000, emissiveIntensity: .3 }); owned.add(material);
    box(width+.08,height+.08,.045,timber,x,y,z-.03,decor); box(width,height,.015,material,x,y,z,decor);
    for (const sy of [-1,1]) box(width+.1,.035,.055,brass,x,y+sy*(height/2+.02),z+.02,decor);
  }
  function standingPanel(kind, x, width, height, y, z) {
    // Low stands keep the artwork in view beside puzzles viewed from above.
    panel(kind, x, width, height, y, z);
    for (const dx of [-width / 2, width / 2]) {
      box(.04, y, .04, timber, x + dx, y / 2, z - .035, decor);
      box(.16, .04, .30, timber, x + dx, .02, z, decor);
    }
  }
  function hanging(x, color = cloth, talisman = false) {
    const g = new THREE.Group(); g.position.set(x, 2.5, -1.7); decor.add(g);
    box(talisman ? .18 : .40,talisman ? .55 : 1.45,.018,color,0,talisman ? -.28 : -.72,0,g); box(talisman ? .20 : .46,.045,.045,brass,0,0,0,g);
    if (talisman) for(let i=0;i<5;i++) box(.09-i%2*.035,.012,.007,cloth,0,-.12-i*.08,.015,g);
    moving.push({ object: g, seed: x*2 });
  }
  function lantern(x, z) {
    box(.15,.65,.15,timber,x,.325,z,decor); box(.34,.07,.34,brass,x,.68,z,decor); box(.20,.32,.20,paper,x,.89,z,decor); box(.30,.06,.30,timber,x,1.08,z,decor);
  }
  function setDress(id) {
    decor.clear(); moving.length = 0; for (const resource of owned) resource.dispose(); owned.clear();
    const authored = STAGE_SCENES[id]; decor.userData.location = authored?.location || null; decor.userData.motif = authored?.motif || null;
    if (!authored) return;
    const kind = authored.motif; panel(kind,0,id === 10 ? 2.65 : 1.72,id === 10 ? 1.55 : 1.25,id === 14 ? 2.05 : 1.92); lantern(-1.6,-1.2);
    if (['study','scribe','archive','workshop'].includes(kind)) {
      shelf(1.9,kind === 'archive' ? 'rolls' : 'books'); shelf(-1.9,'rolls',2);
      if (kind === 'workshop') for (let i=0;i<5;i++) box(.045,.46,.04,brass,-.62+i*.25,1.05,-2.30,decor);
    } else if (kind === 'herbs') {
      shelf(1.85,'jars'); shelf(-1.85,'jars'); for(let i=0;i<4;i++) hanging(-.7+i*.45,jade,true);
    } else if (kind === 'stars') {
      shelf(1.85,'rolls',2); standingPanel('stars',1.15,.72,.84,.50,-.95);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.43,.014,6,48),brass); owned.add(ring.geometry); ring.position.set(1.85,1.45,-1.45); decor.add(ring);
    } else if (kind === 'royal' || kind === 'throne') {
      hanging(-1.25); hanging(1.25); lantern(1.6,-1.2);
      for(const x of [-2.45,2.45]) { box(.23,2.75,.23,cloth,x,1.38,-1.85,decor); box(.32,.14,.32,brass,x,2.65,-1.85,decor); }
    } else if (kind === 'ward') {
      for(let i=0;i<7;i++) hanging(-2.2+i*.73,parchment,true);
      box(.9,2.2,.10,timber,1.95,1.1,-1.85,decor); for(let i=0;i<6;i++) box(.045,2.1,.07,brass,1.57+i*.15,1.1,-1.77,decor);
    } else if (kind === 'landscape' || kind === 'clock') {
      panel('landscape',-2.05,1.55,1.4,1.8); panel('landscape',2.05,1.55,1.4,1.8);
      if(kind === 'clock') for(let i=0;i<9;i++) box(.012,.10+(i%3===0?.08:0),.02,brass,-.65+i*.16,2.7,-1.88,decor);
    } else if (kind === 'grain') {
      shelf(1.8,'jars',2); for(let i=0;i<5;i++) jar(-1.85+(i%2)*.25,Math.floor(i/2)*.29,-1.50,floorMat); box(.85,.07,.7,timber,-1.7,.04,-1.45,decor);
    } else {
      shelf(1.9,'silk'); hanging(-1.45); hanging(1.45);
      if (kind === 'wedding') standingPanel(kind,.70,.72,.84,.50,-1.10);
      else panel(kind,-2.05,1.20,1.50,1.85);
    }
  }
  return {
    setChapter(id) {
      chapterId = id || 0; pulse = null; effect = ''; haloMat.opacity = 0;
      const profile = chapterPresentation[id]; root.visible = !!profile; shell.visible = id !== 1; moon.visible = id !== 1;
      scene.environment = profile ? environment?.texture || null : null; setDress(chapterId);
      if (profile) {
        paper.color.setHex(profile.paper); moon.color.setHex(profile.fill); mat.material.color.setHex(profile.mat); plaster.color.setHex(profile.background).multiplyScalar(2.2);
        cloth.color.setHex([3,7,10,12].includes(id) ? 0x723a42 : id === 14 ? 0x514f71 : 0x735760); dustMat.color.setHex(profile.key); floorMat.color.setHex(profile.mat);
      }
      paper.emissiveIntensity = .2; mat.scale.x = id === 4 ? .85 : 1;
    },
    trigger(nextEffect = 'reveal') { effect = nextEffect; pulse = lastNow || performance.now(); },
    tick(now) {
      lastNow = now; if (!root.visible) return;
      const reduced = prefersReducedMotion(), progress = pulse === null ? 1 : Math.min(1,(now-pulse)/3600), strength = pulse === null ? 0 : Math.sin(progress*Math.PI);
      paper.emissiveIntensity = .2+strength*.24; lanternLight.intensity = .7+(reduced ? 0 : Math.sin(now*.003)*.035)+strength*.18;
      if (!reduced) {
        for(const m of moving) m.object.rotation.z = Math.sin(now*.0012+m.seed)*(.012+(effect==='wind'?strength*.06:0));
        seeds.forEach((s,i)=>{ dustPositions[i*3] = s.x+Math.sin(now*.00018+i)*.09; dustPositions[i*3+1] = (s.y+now*.000022)%2.8; }); dustGeometry.attributes.position.needsUpdate = true;
      }
      dustMat.opacity = .22+strength*(effect === 'stars' ? .45 : .15);
      halo.visible = !reduced && pulse !== null && ['resonance','moon','stars','reveal','dawn'].includes(effect); halo.scale.setScalar(.8+progress*5); haloMat.opacity = strength*.14;
      if(progress === 1) { pulse = null; effect = ''; }
    },
    snapshot: () => ({ chapterId, location: decor.userData.location, motif: decor.userData.motif, effect, props: decor.children.length }),
  };
}
