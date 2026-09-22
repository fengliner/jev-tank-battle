'use strict';
/* =========================
   Game logic
========================= */

function logicStep(
  dt
){

  if(over){
    return;
  }

  p.cool=
    Math.max(
      0,
      p.cool-dt
    );

  a.cool=
    Math.max(
      0,
      a.cool-dt
    );

  p.flash=
    Math.max(
      0,
      p.flash-dt
    );

  a.flash=
    Math.max(
      0,
      a.flash-dt
    );

  moveTank(
    p,
    playerInput(),
    dt
  );

  moveTank(
    a,
    a.move,
    dt
  );

  if(
    keys.has(
      'Space'
    )
  ){
    shoot(
      p,
      'p'
    );
  }

  updateBullets(
    dt
  );

  jevTimer-=dt;

  tacticalTimer-=dt;

  pathTimer-=dt;

  uiTimer-=dt;

  /*
   * Jev：
   * 只负责高层战略。
   */

  if(
    jevTimer<=0
  ){
    jevTimer=2.4;

    decideStrategy();
  }

  /*
   * 高频本地战斗控制器。
   */

  if(
    tacticalTimer<=0
  ){
    tacticalTimer=.10;

    localCombatControl();

    watchdog();
  }

  /*
   * UI 不需要跟 AI 一样高频。
   */

  if(
    uiTimer<=0
  ){
    uiTimer=.25;

    updateDecisionUI();
  }

  updateHud();
}


function renderStep(
  dt
){
  grid();

  drawWalls();

  drawBullets();

  drawTank(p);

  drawTank(a);

  drawParticles(dt);
}


/* =========================
   Crash-resistant loop
========================= */

function loop(
  ts
){

  const dt=
    Math.min(
      .033,

      (
        ts-last
      )/1000
      ||
      .016
    );

  last=ts;

  /*
   * 即使某一次 AI 逻辑发生异常，
   * 也不能让 requestAnimationFrame 整体停止。
   */

  try{
    logicStep(dt);

    frameErrors=0;
  }

  catch(err){

    frameErrors++;

    console.error(
      'game logic error',
      err
    );

    AI.path=[];

    pathTimer=0;

    a.move='STOP';

    if(
      frameErrors>2
    ){
      AI.reason=
        '检测到运行异常，已自动恢复控制。';

      frameErrors=0;
    }
  }

  try{
    renderStep(dt);
  }

  catch(err){
    console.error(
      'render error',
      err
    );
  }

  /*
   * 无论上面是否报错，
   * 下一帧永远继续。
   */

  requestAnimationFrame(
    loop
  );
}
