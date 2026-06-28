// js/main.js — single ES-module entry point.
// Imports the side-effect modules (editor registrations, clock, touch bridge)
// and the app bootstrap. app.js's own import graph pulls in everything else
// (globals, topbar, sources, pools, matrix, productions, dragDrop, utils).
import './editors/core.js';
import './editors/iso-recorder.js';
import './editors/multi-viewer.js';
import './editors/vision-mixer.js';
import './editors/audio-mixer.js';
import './editors/intercom.js';
import './clock.js';
import './touchDrag.js';
import './app.js';
