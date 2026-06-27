async function initApp() {
    // Load Productions
    const prodFiles = ['Production1.json', 'Production1 copy.json', 'Production1 copy 2.json', 'Production1 copy 3.json', 'Production1 copy 4.json'];
    const programs = [];
    for (let file of prodFiles) {
        const data = await fetchJSON('Productions/' + file);
        if (data) programs.push(data);
    }
    
    const tabsContainer = document.getElementById('production-tabs');
    const contentContainer = document.getElementById('production-content');
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';
    
    programs.forEach((pgm, index) => {
        const tab = document.createElement('div');
        tab.className = 'tab' + (index === 0 ? ' active' : '');
        tab.onclick = (e) => switchTab(pgm.id, e);
        tab.innerText = pgm.name;
        tabsContainer.appendChild(tab);
        
        const cont = document.createElement('div');
        cont.id = 'tab-' + pgm.id;
        cont.className = 'tab-content' + (index === 0 ? ' active' : '');
        contentContainer.appendChild(cont);
    });
    
    renderPrograms(programs);
    
    // Load Video Pools
    const videoFiles = ['Studio 1.json', 'Studio 2.json', 'Studio 3.json', 'Studio 4.json', 'Remotes.json', 'Sats.json'];
    const videoSuper = document.getElementById('video-super-pool-content');
    for (let file of videoFiles) {
        try {
            const data = await fetchJSON('Video/' + file);
            if (data && typeof renderVideoPool === 'function') {
                renderVideoPool(data, videoSuper);
            }
        } catch (e) {
            console.error('Error loading video pool:', e);
        }
    }
    
    // Load Audio Pools
    const audioSuper = document.getElementById('audio-super-pool-content');
    for (let i = 1; i <= 10; i++) {
        try {
            const data = await fetchJSON(`Audio/Pool${i}.json`);
            if (data && typeof renderAudioPool === 'function') {
                renderAudioPool(data, audioSuper);
            }
        } catch (e) {
            console.error('Error loading audio pool:', e);
        }
    }

    // Load Masters
    const masterFiles = ['Encoder 1.json', 'Encoder 2.json', 'Encoder 2json', 'Encoder 4.json'];
    const masterPrograms = [];
    for (let file of masterFiles) {
        const data = await fetchJSON('Master/' + file);
        if (data) {
            data.color = '#ff3366';
            masterPrograms.push(data);
        }
    }
    masterPrograms.forEach((pgm, index) => {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.onclick = (e) => switchTab(pgm.id, e);
        tab.innerText = pgm.name;
        tabsContainer.appendChild(tab);
        
        const cont = document.createElement('div');
        cont.id = 'tab-' + pgm.id;
        cont.className = 'tab-content';
        contentContainer.appendChild(cont);
    });
    renderPrograms(masterPrograms);

    initializeDraggables();
    initializeTwists();
}

window.addEventListener('DOMContentLoaded', initApp);
