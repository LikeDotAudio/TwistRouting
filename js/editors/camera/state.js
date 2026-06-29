// js/editors/camera/state.js — per-camera shading + robotics state.
export function mkState() {
    return {
        pan: 0.5, tilt: 0.5, zoom: 0.32, dolly: 0.5, ped: 0.5,
        iris: 0.56, mblack: 0.5, rGain: 0.5, gGain: 0.5, bGain: 0.5,
        rBlk: 0.5, gBlk: 0.5, bBlk: 0.5, shutter: 0.5, mgain: 0.18, gamma: 0.5,
        presets: [null, null, null, null, null, null],
    };
}
export const clamp = (v) => Math.max(0, Math.min(1, v));
