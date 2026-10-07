import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {geometryKey} from './blender-geometry-key.js';

const cache=new Map(),loader=new GLTFLoader();
const eligible=mesh=>mesh.isMesh&&mesh.geometry?.attributes.position&&!Array.isArray(mesh.material)&&mesh.material?.visible!==false&&mesh.material?.opacity>0;
function library(id){
 if(!cache.has(id)){
  const promise=loader.loadAsync('./assets/crafted/ch'+String(id).padStart(2,'0')+'.glb').then(gltf=>{
   const result=new Map();gltf.scene.updateMatrixWorld(true);
   gltf.scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const key=mesh.userData.sourceGeometryKey;
    if(key){const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();result.set(key,geometry);}
    mesh.geometry.dispose();for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m?.dispose();
   });return result;
  }).catch(error=>{
   // An evicted request can fail after this chapter has been requested again.
   // Only the promise that still owns the entry may remove it.
   if(cache.get(id)===promise)cache.delete(id);
   throw error;
  });
  cache.set(id,promise);
  while(cache.size>3){const first=cache.keys().next().value;const old=cache.get(first);cache.delete(first);old.then(map=>{for(const g of map.values())g.dispose();},()=>{});}
 }
 return cache.get(id);
}

/** Authored surfaces keep the original mechanism, shader references and hit objects. */
export function attachBlenderFinish(chapterId,roots){
 let alive=true,map=null;const owned=new Map();
 const status={chapter:chapterId,loaded:false,matched:0,missing:[],error:null};
 const apply=()=>{
  if(!alive||!map)return;
  if(roots.some(root=>root.userData.visualReady===false)){status.loaded=false;return;}
  const missing=new Set();let matched=0;
  for(const root of roots)root.traverse(mesh=>{
   if(!eligible(mesh))return;
   if(mesh.userData.blenderGeometry){matched++;return;}
   const key=geometryKey(mesh.geometry),authored=map.get(key);
   if(!authored){missing.add(key);return;}
   if(!owned.has(key))owned.set(key,authored.clone());
   const old=mesh.geometry;mesh.geometry=owned.get(key);mesh.userData.blenderGeometry=key;old.dispose();matched++;
  });
  status.matched=matched;status.missing=[...missing];status.loaded=true;
 };
 for(const root of roots)root.addEventListener('visual-ready',apply);
 library(chapterId).then(result=>{if(!alive)return;map=result;apply();},error=>{if(alive){status.error=String(error.message||error);console.warn('[crafted geometry]',chapterId,status.error);}});
 return {status,dispose(){alive=false;for(const root of roots)root.removeEventListener('visual-ready',apply);for(const geometry of owned.values())geometry.dispose();owned.clear();map=null;}};
}
