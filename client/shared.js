globalThis.arenaRadius = 400;
globalThis.maxBoostCooldown = 30;
globalThis.scaleFac = 1.4;

globalThis.shortAngleDist = (a0,a1) => {
    var max = Math.PI*2;
    var da = (a1 - a0) % max;
    return 2*da % max - da;
}

globalThis.interpolateDirection = (d1, d2, time) => {
    return d1 + shortAngleDist(d1, d2) * time;
}

globalThis.interpolate = (s,e,t) => {
    return s + (e - s) * t;
}