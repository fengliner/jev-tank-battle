'use strict';

document.documentElement.classList.add('js-ready');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('arenaWrap');
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const rand = (a,b) => a + Math.random()*(b-a);

let W=900,H=620,dpr=1,last=0,over=false,playerScore=0,aiScore=0;
let jevTimer=.2,tacticalTimer=0,pathTimer=0,uiTimer=0;
let jevInFlight=false,jevFailures=0,jevRetryAt=0;
let frameErrors=0;

const keys = new Set();
const walls=[],bullets=[],particles=[];

const DIRS={
  UP:{x:0,y:-1,a:-Math.PI/2},
  DOWN:{x:0,y:1,a:Math.PI/2},
  LEFT:{x:-1,y:0,a:Math.PI},
  RIGHT:{x:1,y:0,a:0},
  STOP:{x:0,y:0,a:0}
};

const names=['UP','DOWN','LEFT','RIGHT','STOP'];

const AI={
  strategy:'CHASE',
  strategyUntil:0,
  confidence:.72,
  reason:'追踪玩家并寻找射击角度。',
  target:null,
  path:[],
  pathIndex:0,
  predicted:{x:0,y:0},
  threat:null,
  fireProbability:.1,
  danger:0,

  lastPlayer:{
    x:0,
    y:0,
    t:performance.now()
  },

  playerVelocity:{
    x:0,
    y:0
  },

  lastPos:{
    x:0,
    y:0
  },

  stuckFor:0,
  watchdogAt:performance.now(),
  lastUiMove:'',
  decisionNo:0
};


/* =========================
   Canvas
========================= */

function resize(){
  const r=wrap.getBoundingClientRect();

  W=Math.max(320,r.width);
  H=Math.max(320,r.height);

  dpr=Math.min(
    2,
    devicePixelRatio||1
  );

  canvas.width=Math.floor(W*dpr);
  canvas.height=Math.floor(H*dpr);

  ctx.setTransform(
    dpr,0,0,dpr,0,0
  );
}

window.addEventListener(
  'resize',
  resize
);

resize();


