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

    renderScore();

    if(isMobile){
        drawButtons()
    }
}

let frameTime = 1000 / 60;
let lerpCoef = 0.4;
const ln = Math.log(lerpCoef);
function updateInterpolate(p){
    p.render.x = interpolate(p.render.x, p.x, 1 - Math.exp(ln, frameTime / (1000 / 60)));
    p.render.y = interpolate(p.render.y, p.y, 1 - Math.exp(ln, frameTime / (1000 / 60)));
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

// TODO: mobile controls

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const xMin = 0.11;
const yMax = 0.94;
const ySpacing = 0.07;
const btnR = 0.045;
let buttons = [{
    text: 'A',
    xPercent: 1 / 3,
    yPercent: yMax - ySpacing,
    rPercent: btnR,
    clicking: false
}, {
    text: 'D',
    xPercent: 2 / 3,
    yPercent: yMax - ySpacing,
    rPercent: btnR,
    clicking: false
}, {
    text: 'W',
    xPercent: 1 / 2,
    yPercent: yMax - ySpacing * 2,
    rPercent: btnR,
    clicking: false
}, {
    text: 'S',
    xPercent: 1 / 2,
    yPercent: yMax,
    rPercent: btnR,
    clicking: false
}, {
    text: 'X',
    xPercent: xMin,
    yPercent: yMax,
    rPercent: btnR,
    clicking: false
}];

let c2, c2x;
if(isMobile){
    c2 = document.createElement('canvas');
    c2x = c2.getContext('2d');
    c2.style.zIndex = '999';
    document.body.appendChild(c2);
}

function drawButtons(){
    c2x.clearRect(0,0,c2.w,c2.h);
    for(let i = 0; i < buttons.length; i++){
        drawButton(buttons[i]);
    }
}

function drawButton(b){
    const {clicking, xPercent, yPercent, rPercent, text} = b;
    const coords = {x: xPercent * innerWidth, y: yPercent * innerHeight};
    const rCoords = {x: xPercent * innerWidth, y: (yPercent + rPercent) * innerHeight};
    const btnR = rCoords.y - coords.y;

    c2x.fillStyle = 'blue';
    c2x.globalAlpha = clicking ? .56 : .3;

    c2x.beginPath();
    c2x.arc(coords.x, coords.y, btnR, 0, Math.PI * 2);
    c2x.fill();
    c2x.closePath();

    c2x.globalAlpha *= 1.79;

    c2x.fillStyle = '#f0f0f0';
    c2x.textAlign = 'center';
    c2x.textBaseline = 'middle';
    c2x.font = `700 120px Monospace`;
    c2x.fillText(text, coords.x, coords.y);

    c2x.globalAlpha = 1;
}

let idToBtn = {

}
if(isMobile) {
    window.addEventListener("touchstart", (e) => {
        for(let i = 0; i < e.changedTouches.length; i++){
            const t = e.changedTouches[i];

            for(let i = 0; i < buttons.length; i++){
                const {clicking, xPercent, yPercent, rPercent, text} = buttons[i];
                const coords = {x: xPercent * innerWidth, y: yPercent * innerHeight};

                // console.log(t.x, t.y);
                let mag = Math.sqrt((t.clientX - coords.x) ** 2 + (t.clientY - coords.y) ** 2);
                if(mag <= rPercent * innerHeight){
                    buttons[i].clicking = true;
                    idToBtn[t.identifier] = i;

                    const code = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyX'][i];
                    handleKey({preventDefault:()=>{}, code, type: 'keydown'})
                    return;
                }
            }
        }
    });
    // window.addEventListener("touchmove", (e) => {
        
    // }, {passive: false});
    window.addEventListener("touchend", (e) => {
        for(let i = 0; i < e.changedTouches.length; i++){
            const t = e.changedTouches[i];

            const btnId = idToBtn[t.identifier];
            if(btnId !== undefined){
                buttons[btnId].clicking = false;
                delete idToBtn[t.identifier];

                const code = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyX'][btnId];
                handleKey({preventDefault:()=>{}, code, type: 'keyup'});
            }
        }
    });
    window.onmousedown = window.onmouseup = window.onmousemove = () => {};
}