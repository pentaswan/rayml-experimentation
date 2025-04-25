window.onkeydown = handleKey;
window.onkeyup = handleKey;

const Controls = {
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyX: 'heavy'
};

const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    heavy: false
};

function handleKey(e){
    if (e.repeat === true) return e.preventDefault();

    // if (Controls[e.code] != undefined) {
    //     const key = Controls[e.code];

    //     const num = {
    //         up: 0,
    //         down: 1,
    //         left: 2,
    //         right: 3,
    //         heavy: 4
    //     }[key];

    //     e.preventDefault();

    //     const buf = new Uint8Array(1);
    //     buf[0] = num + (e.type === 'keydown' ? 1 << 6 : 0);
    //     send(buf);
    // }
}

function speed(spd=1000/60){
    const f32 = new Float32Array(1);
    f32[0] = frameTime = spd;
    send(f32);
}

window.oncontextmenu = function (e) {
    return e.preventDefault();
};

// util

function resize(){
    // canvas.width = canvas.w = window.innerWidth;
    // canvas.height = canvas.h = window.innerHeight;
    resizeElement(canvas);
    canvas.w = canvas.width;
    canvas.h = canvas.height;
}

const width = 1600;
const height = 900;
const resizeElement = function (e) {
    if (e.width !== width) {
        e.width = width;
        e.style.width = `${width}px`;
    }
    if (e.height !== height) {
        e.height = height;
        e.style.height = `${height}px`;
    }
    let scaleMult = e?._scaleMult ?? 1;
    e.style.transform = `scale(${
        Math.min(window.innerWidth / width, window.innerHeight / height) *
        scaleMult
    })`;
    e.style.left = `${(window.innerWidth - width) / 2}px`;
    e.style.top = `${(window.innerHeight - height) / 2}px`;
};

window.onresize = resize;
resize();