const angleFric = 0.68;
const positionFric = 0.952;

const angleDist = Math.PI / 6;
const anglesDif = Math.PI / 6;

const maxBiteCooldown = 150;

const moveSpeed = 0.006;
const boostSpeed = 0.15;
const angularSpeed = 0.00475;
const biteBoost = 0.045;

import { Request } from "zeromq";

let connected = false;
const socket = new Request();

class Game {
    constructor(){
        this.player = {
            x: -220,
            y: 0,
            r: 120 / scaleFac,
            angle: 0,
            av: 0, aa: 0,
            xv: 0, yv: 0,
            hp: 10,
            boostCooldown: maxBoostCooldown,
        }

        this.player.input = {
            angle: 0,
            mag: 0,// normalized
            boost: false
        }

        this.enemy = structuredClone(this.player);
        this.enemy.x = -this.player.x;
        this.enemy.angle = Math.PI;
        this.enemy.input.angle = Math.PI;

        this.biteCooldown = 0;
        this.reward = 0;

        this.pack = new Float32Array(8);

        this.initMsg();
    }

    updatePack(){
        this.pack[0] = this.player.x;
        this.pack[1] = this.player.y;
        this.pack[2] = this.player.angle;
        this.pack[3] = this.player.hp;

        this.pack[4] = this.enemy.x;
        this.pack[5] = this.enemy.y;
        this.pack[6] = this.enemy.angle;
        this.pack[7] = this.enemy.hp;
    }

    // still has to be between 0 and 2pi
    normalizeAngle(a){
        return (a / (Math.PI * 2) % 1) * 2 - 1 
    }

    // angular accel
    normalizeAA(a){
        return a / (Math.PI * angularSpeed / (1 - angleFric))
    }

    getAIInputs(){
        // len=16
        return Buffer.from(new Float32Array([
            (this.player.x - this.enemy.x) / (arenaRadius * 2),
            (this.player.y - this.enemy.y) / (arenaRadius * 2),

            this.normalizeAngle(this.player.angle),
            this.player.av / 0.01,
            this.normalizeAA(this.player.aa),
            this.player.xv / 2.5,
            this.player.yv / 2.5,

            this.normalizeAngle(this.enemy.angle),
            this.enemy.av / 0.01,
            this.normalizeAA(this.enemy.aa),
            this.enemy.xv / 2.5,
            this.enemy.yv / 2.5,

            Math.max(0, this.player.boostCooldown / maxBoostCooldown),
            Math.max(0, this.enemy.boostCooldown / maxBoostCooldown),

            // this.player.input.angle,
            // this.player.input.mag,
            this.player.input.boost ? 1 : 0,

            this.reward// last reward
        ]).buffer);
    }

    async simulate(){
        // console.log(this.player.input.mag, this.player.input.angle);
        // get the input

        if(connected === false){
            await socket.connect("tcp://127.0.0.1:5555");
            connected = true;
            console.log('socket connected!');
        }

        // send a message. When we recieve it we'll do simulation and reward (the below fn)
        await socket.send(this.getAIInputs());

        const [msg] = await socket.receive();  // This gives you a Buffer
        const received = new Float32Array(msg.buffer, msg.byteOffset, msg.length / 4);

        console.log("Got:", received);
    }

    initMsg(){
        // sock.on("message", (msg) => {
        //     const response = new Float32Array(msg.buffer, msg.byteOffset, msg.length / 4);
        //     console.log("Got back:", response);

        //     // simulate the node.js
        //     this._simulate();
        // });
    }


    _simulate(){
        this.reward = 0;

        this.simulateP(this.player);
        this.simulateP(this.enemy);

        this.reward -= Math.sqrt((this.player.x - this.enemy.x) ** 2 + (this.player.y - this.enemy.y) ** 2) / arenaRadius;

        this.biteCooldown--;

        const result = this.tailbite();
        if(result !== false){
            let accel = biteBoost / (1 - positionFric);
            if(result === 'enemy bitten'){
                this.player.xv -= Math.cos(this.player.angle) * accel * 4;
                this.player.yv -= Math.sin(this.player.angle) * accel * 4;

                this.enemy.xv += Math.cos(this.enemy.angle) * accel;
                this.enemy.yv += Math.sin(this.enemy.angle) * accel;

                this.enemy.hp--;
            } else {
                this.player.xv += Math.cos(this.player.angle) * accel * 4;
                this.player.yv += Math.sin(this.player.angle) * accel * 4;

                this.enemy.xv -= Math.cos(this.enemy.angle) * accel;
                this.enemy.yv -= Math.sin(this.enemy.angle) * accel;

                this.player.hp--;
            }
        }
    }

    simulateP(p){
        const desiredAngle = p.input.angle; //p.angle + Math.PI * 0.999
        p.aa = shortAngleDist(p.angle, desiredAngle) * angularSpeed / (1 - angleFric);
        p.av += p.aa;

        p.angle += p.av;
        if(p.angle < 0) p.angle += Math.PI * 2;

        p.av *= angleFric;

        let accel = p.input.mag * moveSpeed / (1 - positionFric);

        if(p.input.boost === true && p.boostCooldown < 0 && p === this.player){
            p.boostCooldown = maxBoostCooldown;
            accel += boostSpeed / (1 - positionFric);
            p.input.boost = false;
        }

        const xa = Math.cos(desiredAngle) * accel;
        const ya = Math.sin(desiredAngle) * accel;

        p.xv += xa;
        p.yv += ya;

        p.x += p.xv;
        p.y += p.yv;

        p.xv *= positionFric;
        p.yv *= positionFric;

        p.boostCooldown--;

        if(p.x**2 + p.y**2 > (arenaRadius - p.r) ** 2){
            const angle = Math.atan2(p.y, p.x);
            p.x = Math.cos(angle) * (arenaRadius - p.r);
            p.y = Math.sin(angle) * (arenaRadius - p.r);
        }
    }


    aBitingB(a,b){
        const angleBetween = shortAngleDist(a.angle, b.angle);
        if(Math.abs(angleBetween) > angleDist) return false;

        if((a.x-b.x)**2 + (a.y-b.y)**2 > (a.radius+b.radius)**2) return false;

        const physicalAngleBetween = Math.atan2(a.y - b.y, a.x - b.x);

        const dif = shortAngleDist(physicalAngleBetween, a.angle);

        if(Math.abs(shortAngleDist(Math.PI,dif)) < anglesDif || Math.abs(dif) < anglesDif) return true;

        return false;
    }

    tailbite(){
        if(this.biteCooldown > 0) return false;
        if((this.player.x - this.enemy.x) ** 2 + (this.player.y - this.enemy.y) ** 2 > (this.enemy.r + this.player.r) ** 2) return false;
        if(this.aBitingB(this.player, this.enemy) === false && this.aBitingB(this.enemy, this.player) === false) return false;

        // otherwise, find out who's being bit.

        const averageAngle = interpolateDirection(this.player.angle, this.enemy.angle, 0.5);

        const vec = [
            Math.cos(averageAngle),
            Math.sin(averageAngle)
        ];
    
        // comparing the x,y dot this vector will give us which is further as a consequence of the projection formula v*w / mag * v (mag is irrelevant and it's parametrized in terms of v so v's coef which is what we want to compare is just v*w)
        
        const pdot = this.player.x * vec[0] + this.player.y * vec[1];
        const odot = this.enemy.x * vec[0] + this.enemy.y * vec[1];

        this.biteCooldown = maxBiteCooldown;

        if(pdot > odot) return 'player bitten';
        else return 'enemy bitten';
    }
}

export default Game;