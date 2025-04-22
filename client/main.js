const canvas = document.getElementById("canvas");
const ctx = canvas.getContext('2d');

const w = 1600;
const h = 900;
let player = {
    x: w * 1/3 + 56,
    y: h * 1/2,
    r: 35,
    heavy: false,
    render: {
        x: w * 1/3 + 56,
        y: h * 1/2,
    }
}

let playerScore, enemyScore;
playerScore = enemyScore = 0;

let enemy = structuredClone(player);

enemy.x = enemy.render.x = w - player.x;

const pw = w * 1/3;
const py = h * 3/5;
const platform = [
    {
        x: w / 2 - pw/2,
        y: py
    },
    {
        x: w / 2 + pw/2,
        y: py
    },
]

function render() {
    requestAnimationFrame(render);
    ctx.fillStyle = 'black';
    ctx.fillRect(0,0,canvas.w,canvas.h);

    ctx.strokeStyle = ctx.fillStyle = 'white';
    ctx.lineWidth = 7;

    updateInterpolate(player);
    updateInterpolate(enemy);

    renderPlayer(player);

    renderPlayer(enemy);

    renderLine(platform);

    // renderScore();
}

function updateInterpolate(p){
    p.render.x = interpolate(p.render.x, p.x, 0.4);
    p.render.y = interpolate(p.render.y, p.y, 0.4);
}

function interpolate(s,e,t){
    return s + (e - s) * t;
}

function renderPlayer(p){
    ctx.beginPath();
    ctx.arc(p.render.x, p.render.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    if(p.heavy) {ctx.strokeStyle = 'red'; ctx.stroke(); ctx.strokeStyle = 'white';}
    ctx.closePath();
}

function renderLine(p){
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    ctx.lineTo(p[1].x, p[1].y);
    ctx.stroke();
    ctx.closePath();
}

function renderScore(){
    ctx.font = '255px Times New Roman';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.globalAlpha = 0.3;

    ctx.fillText(`${playerScore} - ${enemyScore}`, w / 2, h / 2);

    ctx.globalAlpha = 1;
}

requestAnimationFrame(render);