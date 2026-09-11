/* ============ 3D WATER DROPLET IN THE HERO ============ */
(function(){
  if(typeof THREE==='undefined'){
    /* CDN failed to load -> show a static logo in the middle of the hero rather than leaving it empty */
    const fb=document.createElement('img');
    fb.src='logo-white.png';fb.alt='Suntory PepsiCo';
    fb.style.cssText='position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);width:min(46vw,380px);z-index:2;filter:drop-shadow(0 10px 30px rgba(0,0,0,.4))';
    document.getElementById('hero').appendChild(fb);
    return;
  }
  const canvas=document.getElementById('drop-canvas');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(42,1,0.1,100);
  camera.position.set(0,0,6);

  /* --- water droplet shader --- */
  const vert=`
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vPos;
    // simplex noise (Ashima)
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0);
      const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy));
      vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);
      vec3 l=1.0-g;
      vec3 i1=min(g.xyz,l.zxy);
      vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx;
      vec3 x2=x0-i2+C.yyy;
      vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857;
      vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z);
      vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy;
      vec4 y=y_*ns.x+ns.yyyy;
      vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy);
      vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0;
      vec4 s1=floor(b1)*2.0+1.0;
      vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
      vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x);
      vec3 p1=vec3(a0.zw,h.y);
      vec3 p2=vec3(a1.xy,h.z);
      vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
      m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
    void main(){
      float n=snoise(normal*1.6+uTime*0.35)*0.16
             +snoise(normal*4.0-uTime*0.2)*0.05;
      vec3 pos=position+normal*n;
      vNormal=normalize(normalMatrix*normal);
      vec4 mv=modelViewMatrix*vec4(pos,1.0);
      vPos=mv.xyz;
      gl_Position=projectionMatrix*mv;
    }`;
  const frag=`
    varying vec3 vNormal;
    varying vec3 vPos;
    void main(){
      vec3 viewDir=normalize(-vPos);
      float fres=pow(1.0-max(dot(vNormal,viewDir),0.0),2.2);
      vec3 deep=vec3(0.10,0.36,0.80);   /* bright blue — stands well clear of the navy background */
      vec3 aqua=vec3(0.30,0.78,1.00);
      vec3 brass=vec3(0.95,0.66,0.25);
      vec3 col=mix(deep,aqua,fres);
      float rim=smoothstep(0.75,1.0,fres);
      col=mix(col,brass,rim*0.25);
      /* soft mirror highlight: a light core plus a wide sheen, without blowing out to white */
      vec3 L=normalize(vec3(-0.4,0.75,0.55));
      float ref=max(dot(reflect(-L,vNormal),viewDir),0.0);
      float spec=pow(ref,120.0)*0.35;   /* small, gentle core */
      float sheen=pow(ref,10.0)*0.28;   /* sheen spreading softly outwards */
      col+=vec3(1.0)*(spec+sheen);
      /* soft band of light across the top, like a reflection of the sky */
      float top=smoothstep(0.1,0.9,vNormal.y)*0.22;
      col+=aqua*top;
      /* body as clear as a real droplet, growing denser towards the rim */
      float alpha=mix(0.6,0.97,fres)+spec*0.6+sheen*0.3;
      gl_FragColor=vec4(col,clamp(alpha,0.0,1.0));
    }`;
  const dropMat=new THREE.ShaderMaterial({
    vertexShader:vert,fragmentShader:frag,
    uniforms:{uTime:{value:0}},transparent:true
  });

  /* droplet group — pushed right on wide screens so it does not cover the headline */
  const group=new THREE.Group();
  scene.add(group);

  const drop=new THREE.Mesh(new THREE.IcosahedronGeometry(1.55,64),dropMat);
  group.add(drop);

  /* halo ring */
  const halo=new THREE.Mesh(
    new THREE.RingGeometry(2.05,2.07,128),
    new THREE.MeshBasicMaterial({color:0x3aa0ff,transparent:true,opacity:0.5,side:THREE.DoubleSide})
  );
  halo.rotation.x=Math.PI/2.6;
  group.add(halo);

  /* stream of water particles */
  const N=900;
  const pGeo=new THREE.BufferGeometry();
  const pPos=new Float32Array(N*3);
  const pSeed=new Float32Array(N);
  for(let i=0;i<N;i++){
    const r=2.2+Math.random()*2.6;
    const th=Math.random()*Math.PI*2;
    const ph=Math.acos(2*Math.random()-1);
    pPos[i*3]=r*Math.sin(ph)*Math.cos(th);
    pPos[i*3+1]=(Math.random()-0.5)*4.2;
    pPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    pSeed[i]=Math.random()*Math.PI*2;
  }
  pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
  const pMat=new THREE.PointsMaterial({color:0x8fd4ff,size:0.028,transparent:true,opacity:0.85});
  const cloud=new THREE.Points(pGeo,pMat);
  group.add(cloud);

  /* PepsiCo logo at the centre of the droplet — mirror-glossy, no glow */
  function makeShinyLogo(img){
    const pad=Math.round(img.width*0.04);
    const cv=document.createElement('canvas');
    cv.width=img.width+pad*2;cv.height=img.height+pad*2;
    const ctx=cv.getContext('2d');
    
    /* 1. Deep, soft drop shadow — lifts the logo off the background */
    ctx.filter='brightness(0.08) blur(3px)';
    ctx.globalAlpha=0.65;
    ctx.drawImage(img,pad,pad+7);

    ctx.globalAlpha=1;
    /* 2. Very bright main layer plus a luminous edge hugging the lettering */
    ctx.filter='brightness(1.6) contrast(1.25)'
      +' drop-shadow(0 0 '+Math.round(img.width*0.012)+'px rgba(255,255,255,0.95))';
    ctx.drawImage(img,pad,pad);
    
    /* 3. Sharp specular gloss — a bevelled glass reflection */
    ctx.filter='none';
    ctx.globalCompositeOperation='source-atop';
    
    // Build a diagonal bevel highlight that mimics a cut metal/glass surface
    ctx.fillStyle='rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cv.width, 0);
    ctx.lineTo(cv.width, cv.height * 0.3);
    ctx.lineTo(0, cv.height * 0.7);
    ctx.closePath();
    ctx.fill();
    
    // Add a thin bright line along the cut edge for crispness
    ctx.strokeStyle='rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cv.width, cv.height * 0.3);
    ctx.lineTo(0, cv.height * 0.7);
    ctx.stroke();

    ctx.globalCompositeOperation='source-over';
    return cv;
  }
  let logo=null,logoMat=null;
  new THREE.TextureLoader().load('logo-white.png',tex=>{
    /* The glossy version needs a canvas read-back, which some contexts refuse: a page
       opened as a file:// document taints the canvas, and older browsers lack ctx.filter.
       Fall back to the plain logo texture there so the logo still shows. */
    let shiny,aspect;
    try{
      const cv=makeShinyLogo(tex.image);
      shiny=new THREE.CanvasTexture(cv);
      aspect=cv.width/cv.height;
    }catch(err){
      console.warn('[hero] glossy logo unavailable, falling back to the plain texture:',err);
      shiny=tex;
      aspect=(tex.image&&tex.image.width/tex.image.height)||1620/1078;
    }
    const h=2.2,w=h*aspect;
    logo=new THREE.Group();
    /* soft glow behind — separates the white logo from the deep blue water film */
    const gcv=document.createElement('canvas');gcv.width=gcv.height=256;
    const gctx=gcv.getContext('2d');
    const gr=gctx.createRadialGradient(128,128,20,128,128,128);
    gr.addColorStop(0,'rgba(255,255,255,0.5)');
    gr.addColorStop(0.55,'rgba(190,230,255,0.18)');
    gr.addColorStop(1,'rgba(190,230,255,0)');
    gctx.fillStyle=gr;gctx.fillRect(0,0,256,256);
    const backlight=new THREE.Mesh(
      new THREE.PlaneGeometry(w*1.25,h*1.6),
      new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(gcv),transparent:true,
        depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending})
    );
    backlight.renderOrder=1;
    logo.add(backlight);
    /* mirror highlight sweeping diagonally across the logo — an animated "gloss" effect */
    logoMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,depthTest:false,
      uniforms:{map:{value:shiny},uTime:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:[
        'uniform sampler2D map;uniform float uTime;varying vec2 vUv;',
        'void main(){',
        '  vec4 c=texture2D(map,vUv);',
        '  float sweep=fract(uTime*0.14);',                /* one sweep roughly every 7s */
        '  float pos=vUv.x+vUv.y*0.45;',
        '  float band=smoothstep(0.2,0.0,abs(pos-(sweep*2.4-0.5)));',
        '  c.rgb+=band*1.2*c.a*vec3(0.6,0.9,1.0);',                          /* strong gloss streak, tinted with water blue */
        '  gl_FragColor=c;',
        '}'].join('\n')
    });
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),logoMat);
    plane.renderOrder=2;        /* drawn after the water film so it is not hidden */
    logo.add(plane);
    group.add(logo);
  },undefined,err=>{
    /* without this handler a failed image load left the droplet empty and silent */
    console.warn('[hero] could not load logo-white.png:',err);
  });

  /* pointer + scroll */
  let mx=0,my=0,scroll=0;
  window.addEventListener('mousemove',e=>{
    mx=(e.clientX/window.innerWidth-0.5)*2;
    my=(e.clientY/window.innerHeight-0.5)*2;
  },{passive:true});
  window.addEventListener('scroll',()=>{scroll=window.scrollY;},{passive:true});

  function resize(){
    const w=canvas.clientWidth||window.innerWidth;
    const h=canvas.clientHeight||window.innerHeight;
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    /* droplet centred in the hero, nudged up to leave room for the headline below */
    if(w/h>1.05){group.position.set(0,0.5,0);group.scale.setScalar(.92)}
    else{group.position.set(0,1.1,0);group.scale.setScalar(.62)}
  }
  window.addEventListener('resize',resize);
  resize();

  const clock=new THREE.Clock();
  function tick(){
    /* scrolled past the hero -> stop GPU rendering, keep only a light idle loop */
    if(scroll>window.innerHeight*1.15){requestAnimationFrame(tick);return}
    const t=clock.getElapsedTime();
    if(!reduced){
      dropMat.uniforms.uTime.value=t;
      drop.rotation.y=t*0.12;
      halo.rotation.z=t*0.05;
      cloud.rotation.y=t*0.03;
      const pos=pGeo.attributes.position;
      for(let i=0;i<N;i++){
        pos.array[i*3+1]+=Math.sin(t*0.6+pSeed[i])*0.0012;
      }
      pos.needsUpdate=true;
    }
    /* parallax + scroll response */
    camera.position.x+=((mx*0.5)-camera.position.x)*0.04;
    camera.position.y+=((-my*0.35)-camera.position.y)*0.04;
    camera.lookAt(group.position.x*0.6,group.position.y*0.6,0);
    const heroH=window.innerHeight;
    const f=Math.min(scroll/heroH,1);
    drop.position.y=f*1.4;
    drop.scale.setScalar(1-f*0.35);
    if(logo){
      logo.position.y=drop.position.y+(reduced?0:Math.sin(t*0.9)*0.05); /* gentle float */
      logo.rotation.y=reduced?0:Math.sin(t*0.55)*0.14;                  /* slight tilt to give it 3D depth */
      logo.scale.setScalar(1-f*0.35);
      if(logoMat&&!reduced)logoMat.uniforms.uTime.value=t;
    }
    canvas.style.opacity=String(1-f*1.15);
    renderer.render(scene,camera);
    requestAnimationFrame(tick);
  }
  tick();
})();

/* ============ REVEAL TEXT AS THE READER SCROLLS ============ */
(function(){
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting)return;
      e.target.classList.add('in');
      e.target.querySelectorAll('.count').forEach(runCount);
      e.target.querySelectorAll('.bar-fill').forEach(b=>{b.style.width=getComputedStyle(b).getPropertyValue('--w')});
      io.unobserve(e.target);
    });
  },{threshold:0.16,rootMargin:'0px 0px -6% 0px'});

  document.querySelectorAll('.reveal,.reveal-left').forEach(el=>io.observe(el));

  /* stagger: images/stat tiles in the same grid appear 90ms apart, giving a "wave" effect */
  document.querySelectorAll('.media-grid,.stat-grid').forEach(grid=>{
    [...grid.querySelectorAll('.reveal')].forEach((el,i)=>{el.style.transitionDelay=(i*90)+'ms'});
  });

  /* count up on entering the viewport — supports decimals (data-dec) and en-US grouping (data-fmt) */
  function runCount(el){
    if(el.dataset.done)return;
    el.dataset.done="1";
    const to=parseFloat(el.dataset.to);
    const dec=parseInt(el.dataset.dec||'0',10);
    const fmt=el.dataset.fmt==='en'||dec>0;
    const dur=1600,t0=performance.now();
    function step(now){
      const p=Math.min((now-t0)/dur,1);
      const ease=1-Math.pow(1-p,3);
      const v=to*ease;
      el.textContent=fmt
        ?v.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec})
        :Math.round(v);
      if(p<1)requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
})();

/* ============ SCROLLMATION: IMAGE CHANGES WITH EACH TEXT STEP ============ */
(function(){
  const sc=document.getElementById('scrolly-ch2');
  if(!sc)return;
  const imgs=[...sc.querySelectorAll('.scrolly-media img')];
  const steps=[...sc.querySelectorAll('.scrolly-steps .step')];
  let cur=-1;
  function update(){
    const r=sc.getBoundingClientRect();
    /* the step occupying mid-screen = (scroll into section + half a viewport) / height of each step */
    const i=Math.max(0,Math.min(steps.length-1,Math.floor((-r.top+innerHeight*0.5)/innerHeight)));
    if(i===cur)return;
    cur=i;
    imgs.forEach((im,j)=>im.classList.toggle('on',j===i));
    steps.forEach((s,j)=>s.classList.toggle('on',j===i));
  }
  window.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update,{passive:true});
  update();
})();

/* ============ COMPANION ARTICLE GRID ============ */
/* Static grid (one column per article, auto-fit via CSS) — no slider/autoplay JS needed.
   To add parts 3, 4 and 5: uncomment them in index.html, change <article> to
   <a class="car-slide" href="..." target="_blank" rel="noopener"> and add
   <span class="car-cta">Click to read more</span>; the grid adds the columns itself. */

/* ============ IMAGE LIGHTBOX ============ */
(function(){
  const lb=document.getElementById('lightbox');
  const lbImg=lb.querySelector('img'),lbCap=lb.querySelector('.cap');
  function close(){lb.classList.remove('open');document.body.style.overflow=''}
  document.addEventListener('click',e=>{
    const img=e.target.closest('.ph img');
    if(img&&!img.closest('.hero-bg')){
      lbImg.src=img.src;lbImg.alt=img.alt||'';
      const fig=img.closest('figure');
      const cap=fig&&fig.querySelector('figcaption');
      lbCap.textContent=cap?cap.textContent:'';
      lb.classList.add('open');document.body.style.overflow='hidden';
    }else if(e.target.closest('#lightbox')){close()}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();

/* ============ PROGRESS BAR + CHAPTER MENU ============ */
(function(){
  const bar=document.getElementById('progress');
  const nav=document.getElementById('chapnav');
  const toTop=document.getElementById('toTop');
  const links=[...nav.querySelectorAll('a')];
  const targets=links.map(a=>document.querySelector(a.getAttribute('href')));
  toTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

  function onScroll(){
    const h=document.documentElement;
    const max=h.scrollHeight-h.clientHeight;
    bar.style.width=(max>0?(h.scrollTop/max)*100:0)+'%';
    nav.classList.toggle('show',h.scrollTop>window.innerHeight*.7);
    toTop.classList.toggle('show',h.scrollTop>window.innerHeight*2);

    /* chapter currently being read */
    let idx=-1;
    targets.forEach((t,i)=>{if(t&&t.getBoundingClientRect().top<window.innerHeight*.4)idx=i});
    links.forEach((a,i)=>a.classList.toggle('active',i===idx));
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();
})();