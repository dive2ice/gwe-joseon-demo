import * as THREE from 'three';

const vector = value => value?.isVector3 ? value.clone() : new THREE.Vector3(...(value || [0,0,0]));

/** Freeze a mechanism's world frame at press, so a moving part cannot move its own input origin. */
export function createMechanicalProjection(camera, rect, frame, press) {
  if (!frame || !['rotate','linear','plane'].includes(frame.type)) return null;
  const origin=vector(frame.origin), axis=vector(frame.axis);
  if(axis.lengthSq()<1e-10)return null;
  axis.normalize(); camera.updateMatrixWorld(true);
  const screen=p=>{
    const n=p.clone().project(camera);
    return {x:rect.left+(n.x+1)*rect.width/2,y:rect.top+(1-n.y)*rect.height/2};
  };
  const center=screen(origin);
  const start={x:press.startX ?? press.clientX,y:press.startY ?? press.clientY};
  if(frame.type==='linear'){
    const end=screen(origin.clone().addScaledVector(axis,.1));
    const px={x:(end.x-center.x)*10,y:(end.y-center.y)*10};
    const norm=px.x*px.x+px.y*px.y;
    // A rail pointing into the eye has no measurable screen travel. Orbit to its side.
    let previous=0;
    return sample=>{
      const travel=norm>400?((sample.clientX-start.x)*px.x+(sample.clientY-start.y)*px.y)/norm:0;
      const travelDelta=travel-previous;previous=travel;
      return {...sample,travel,travelDelta};
    };
  }
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(axis,origin);
  const ray=new THREE.Raycaster();
  const radial=(x,y)=>{
    ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
    const p=ray.ray.intersectPlane(plane,new THREE.Vector3());
    return p ? p.sub(origin) : null;
  };
  if(frame.type==='plane'){
    const anchor=radial(start.x,start.y),xAxis=vector(frame.xAxis||[1,0,0]).normalize(),zAxis=vector(frame.zAxis||[0,0,1]).normalize();
    let previous=new THREE.Vector3();
    return sample=>{
      const next=radial(sample.clientX,sample.clientY);
      const total=anchor&&next?next.sub(anchor):previous.clone(),step=total.clone().sub(previous);
      previous.copy(total);
      return {...sample,dx:total.dot(xAxis),dy:total.dot(zAxis),deltaX:step.dot(xAxis),deltaY:step.dot(zAxis)};
    };
  }
  let last=radial(start.x,start.y), turn=0;
  const toward=camera.position.clone().sub(origin).normalize().dot(axis);
  const screenRadius=Math.hypot(start.x-center.x,start.y-center.y);
  const usePlane=Math.abs(toward)>.12 && last && last.lengthSq()>1e-8 && screenRadius>10;
  // Reject a near-axis grab in world space; an oblique circle legitimately projects below 8px.
  const minRadiusSq=(last?.lengthSq() || 0)*.04;
  let previousAngle=Math.atan2(center.y-start.y,start.x-center.x);
  return sample=>{
    let delta=0;
    if(usePlane){
      const next=radial(sample.clientX,sample.clientY);
      if(next && next.lengthSq()>Math.max(1e-8,minRadiusSq)){
        delta=Math.atan2(new THREE.Vector3().crossVectors(last,next).dot(axis),last.dot(next));
        last=next;
      }
    }else if(screenRadius<=10){
      // A tiny spindle can also be rolled tangentially under a fingertip.
      const next=(sample.clientX-start.x)/70*(toward<0?-1:1);
      delta=next-turn;
    }else{
      const next=Math.atan2(center.y-sample.clientY,sample.clientX-center.x);
      delta=THREE.MathUtils.euclideanModulo(next-previousAngle+Math.PI,Math.PI*2)-Math.PI;
      delta*=toward<0?-1:1;previousAngle=next;
    }
    turn+=delta;
    return {...sample,turn,turnDelta:delta};
  };
}
