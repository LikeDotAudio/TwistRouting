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
import './editors/camera-control.js';
import './editors/audio-monitor.js';
import './editors/ifb.js';
import './editors/stagebox-input.js';
import './editors/encoder.js';
import './editors/signaling.js';
import './editors/lighting.js';
import './editors/wysiwyg.js';
import './editors/meter-input.js';
import './editors/conditioner-row.js';
import './auth.js';
import './schedule.js';
import './mission.js';
import './dest-glow.js';
import './clock.js';
import './touchDrag.js';
import './tutorial.js';
import './router-view.js';
import './captains-log.js';
import './source-filter.js';
import './portals.js';
import './lcars-pulse.js';
import './dest-selector.js';
import './unroute.js';
import './app.js';
