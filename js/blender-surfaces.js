import * as THREE from 'three';

const loads = [];
const status = [];

/** Keep each shared texture object alive so existing material clones update too. */
export function applyBakedSurface(texture, name) {
  if (!texture || typeof document === 'undefined' || typeof document.createElementNS !== 'function') return;
  const entry = { name, loaded: false, error: null };
  status.push(entry);
  loads.push(new Promise(resolve => {
    new THREE.TextureLoader().load(new URL('../assets/crafted/' + name + '.png', import.meta.url).href, loaded => {
      texture.image = loaded.image;
      texture.anisotropy = 8;
      texture.userData.blenderBake = name;
      texture.needsUpdate = true;
      loaded.dispose();
      entry.loaded = true;
      resolve();
    }, undefined, error => {
      entry.error = String(error?.message || 'Texture unavailable');
      console.warn('Blender surface fallback:', name);
      resolve();
    });
  }));
}

export function craftSurfacesReady() { return Promise.all(loads); }
export function getCraftSurfaceStatus() { return status.map(entry => ({ ...entry })); }
