'use strict';
/* =========================
   Rendering
========================= */

function grid(){

  ctx.fillStyle=
    '#09111a';

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  ctx.strokeStyle=
    '#172230';

  ctx.lineWidth=1;

  const s=32;

  for(
    let x=0;
    x<W;
    x+=s
  ){
    ctx.beginPath();

    ctx.moveTo(
      x,
      0
    );

    ctx.lineTo(
      x,
      H
    );

    ctx.stroke();
  }

  for(
    let y=0;
    y<H;
    y+=s
  ){
    ctx.beginPath();

    ctx.moveTo(
      0,
      y
    );

    ctx.lineTo(
      W,
      y
    );

    ctx.stroke();
  }
}


function drawWalls(){

  for(
    const w
    of walls
  ){
    const alpha=
      .55+
      .45*
      w.hp/
      w.max;

    ctx.fillStyle=
      `rgba(174,116,64,${alpha})`;

    ctx.fillRect(
      w.x,
      w.y,
      w.w,
      w.h
    );

    ctx.strokeStyle=
      '#e5b77b55';

    ctx.strokeRect(
      w.x+.5,
      w.y+.5,
      w.w-1,
      w.h-1
    );

    ctx.fillStyle=
      '#090d12';

    for(
      let x=w.x+20;
      x<w.x+w.w;
      x+=24
    ){
      ctx.fillRect(
        x,
        w.y,
        2,
        w.h
      );
    }

    ctx.fillRect(
      w.x,
      w.y+w.h/2-1,
      w.w,
      2
    );
  }
}


function drawTank(
  t
){
  ctx.save();

  ctx.translate(
    t.x,
    t.y
  );

  ctx.rotate(
    DIRS[t.dir].a
  );

  const c=
    t.flash>0
      ?'#ffffff'
      :t.color;

  ctx.fillStyle=
    '#0008';

  ctx.fillRect(
    -20,
    -14,
    40,
    28
  );

  ctx.fillStyle=c;

  ctx.fillRect(
    -16,
    -13,
    32,
    26
  );

  ctx.fillStyle=
    '#111820';

  ctx.fillRect(
    -20,
    -15,
    6,
    30
  );

  ctx.fillRect(
    14,
    -15,
    6,
    30
  );

  ctx.fillStyle=c;

  ctx.beginPath();

  ctx.arc(
    0,
    0,
    10,
    0,
    Math.PI*2
  );

  ctx.fill();

  ctx.fillRect(
    2,
    -3,
    28,
    6
  );

  ctx.fillStyle=
    '#f3f6fa';

  ctx.font=
    'bold 7px system-ui';

  ctx.textAlign=
    'center';

  ctx.fillText(
    t.label,
    0,
    3
  );

  ctx.restore();

  ctx.strokeStyle=
    t.color+
    '55';

  ctx.beginPath();

  ctx.arc(
    t.x,
    t.y,
    24,
    0,
    Math.PI*2
  );

  ctx.stroke();
}


function drawBullets(){

  for(
    const b
    of bullets
  ){
    ctx.fillStyle=
      b.owner==='p'
        ?'#8ac6ff'
        :'#ff949b';

    ctx.shadowBlur=13;

    ctx.shadowColor=
      ctx.fillStyle;

    ctx.beginPath();

    ctx.arc(
      b.x,
      b.y,
      b.r,
      0,
      Math.PI*2
    );

    ctx.fill();

    ctx.shadowBlur=0;
  }
}


function drawParticles(
  dt
){
  for(
    let i=
      particles.length-1;

    i>=0;

    i--
  ){
    const q=
      particles[i];

    q.x+=q.vx*dt;
    q.y+=q.vy*dt;

    q.vx*=.96;
    q.vy*=.96;

    q.life-=dt;

    if(
      q.life<=0
    ){
      particles.splice(
        i,
        1
      );

      continue;
    }

    ctx.globalAlpha=
      clamp(
        q.life*2,
        0,
        1
      );

    ctx.fillStyle=q.c;

    ctx.fillRect(
      q.x,
      q.y,
      3,
      3
    );
  }

  ctx.globalAlpha=1;
}


