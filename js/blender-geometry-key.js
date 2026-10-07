/** Content key: geometry only. Pivots, hit meshes and puzzle state are never baked into it. */
export function geometryKey(geometry) {
  let a=2166136261>>>0,b=2246822519>>>0;
  const mix=value=>{a=Math.imul(a^(value|0),16777619)>>>0;b=Math.imul(b^(value|0),3266489917)>>>0;};
  for(const name of ['position','normal','uv']){
    const v=geometry.getAttribute(name);mix(v?.count||0);mix(v?.itemSize||0);
    if(v)for(let i=0;i<v.count;i++)for(let c=0;c<v.itemSize;c++)mix(Math.round(v.getComponent(i,c)*1e6));
  }
  const index=geometry.index;mix(index?.count||0);if(index)for(let i=0;i<index.count;i++)mix(index.getX(i));
  return 'g'+a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
}
