// ============================================================
//  EPIDEMIE-SIMULATOR — script.js
// ============================================================

let animationId       = null;
let simulationRunning = false;
let isFirstStart      = true; 

let activeModel       = 'sir-model';
let activeView        = 'agent-view';
let activeSimulationParams = null; 

let sirTheory  = { S: [], I: [], R: [], time: [] };
let sirAgents  = [];
let sirTick    = 0;

let abmAgents  = [];
let abmTick    = 0;

let liveDataHistory = [];

const FPS         = 60;
const MS_PER_TICK = 1000 / FPS;
let lastTimestamp = 0;

let epicenterChart   = null;
let chartInitialized = false;

// Meilenstein Tracker
let theoryPeakPoint = null;
let theoryHerdPoint = null;
let liveMaxI = -1;
let livePeakPoint = null;
let liveHerdPoint = null;

// Modus-Steuerung ("free" oder "tutorial")
let currentMode = "free";
let tutorialStep = 0;

// DOM Elemente Haupt-App
const canvas       = document.getElementById('simulationCanvas');
const ctx          = canvas.getContext('2d');
const startBtn     = document.getElementById('startBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const paramNotice  = document.getElementById('paramNotice');

// Zurücksetzen Button hinzufügen
const resetBtn = document.createElement('button');
resetBtn.id = 'resetBtn';
resetBtn.textContent = 'Zurücksetzen';
startBtn.after(resetBtn);

// DOM Elemente Landing Page & Tutorial
const landingPage        = document.getElementById('landingPage');
const mainContainer      = document.getElementById('mainContainer');
const chooseTutorialBtn  = document.getElementById('chooseTutorialBtn');
const chooseFreeBtn      = document.getElementById('chooseFreeBtn');
const backToMenuBtn      = document.getElementById('backToMenuBtn');
const modeBadge          = document.getElementById('modeBadge');
const tutorialOverlay    = document.getElementById('tutorialOverlay');
const tutStepNum         = document.getElementById('tutStepNum');
const tutStepTotal       = document.getElementById('tutStepTotal');
const tutTitle           = document.getElementById('tutTitle');
const tutText            = document.getElementById('tutText');
const tutPrevBtn         = document.getElementById('tutPrevBtn');
const tutNextBtn         = document.getElementById('tutNextBtn');

// Definition der Tutorial-Schritte (7 Schritte inklusive ABM und Situation)
const tutorialSteps = [
    {
        title: "Willkommen beim Epidemie-Simulator! 👋",
        text: "In diesem Tutorial lernst du Schritt für Schritt, wie sich Infektionen mathematisch und räumlich ausbreiten. Wir fangen ganz einfach an. Schau dir die Sidebar links an: Aktuell siehst du nur die Populationsgröße (N). Klicke auf 'Simulation starten', um zu sehen, wie sich die Punkte verteilen.",
        setup: () => {
            hideAllUIElements();
            switchModelDirect('sir-model');
            showElements(['cardBasicPop', 'grpPopulation']);
        }
    },
    {
        title: "Die Keimzelle: Start-Infizierte (I₀) 🦠",
        text: "Jetzt schalten wir das Eingabefeld für die 'Start-Infizierten' frei. Ohne infizierte Personen kann sich keine Krankheit ausbreiten. Stelle ruhig mal 5 oder 10 Personen ein und klicke auf Start. Du siehst rote infektiöse Punkte, die gesunde blaue Punkte anstecken!",
        setup: () => {
            hideAllUIElements();
            switchModelDirect('sir-model');
            showElements(['cardBasicPop', 'grpPopulation', 'grpInfected']);
        }
    },
    {
        title: "Dynamik: Ansteckung & Genesung 📈",
        text: "Nun kommen die Kernraten ins Spiel. Die Ansteckungsrate (β) steuert, wie infektiös die Krankheit ist. Die Genesungsdauer gibt an, wie viele Sekunden ein Punkt rot bleibt, bevor er grün (genesen und immun) wird. Jetzt ist auch die 'Live-Mathematik' unten aktiv, die dir zeigt, wie viele Menschen pro Sekunde ihren Zustand wechseln.",
        setup: () => {
            hideAllUIElements();
            switchModelDirect('sir-model');
            showElements(['cardBasicPop', 'grpPopulation', 'grpInfected', 'cardRates', 'grpInfRate', 'grpRecTime', 'formulaLabBox']);
        }
    },
    {
        title: "Die Auswertung verstehen 📊",
        text: "Wechsle oben im Menü über den Reiter 'Klassisches SIR-Modell' auf den Unterpunkt 'Auswertung: Diagramm'. Dort siehst du die Kurven live wachsen! Achte besonders auf den goldenen Punkt (Infektions-Peak) und den lila Kreis (Schwelle zur Herdenimmunität).",
        setup: () => {
            hideAllUIElements();
            switchModelDirect('sir-model');
            showElements(['cardBasicPop', 'grpPopulation', 'grpInfected', 'cardRates', 'grpInfRate', 'grpRecTime', 'formulaLabBox']);
        }
    },
    {
        title: "Der Realitätscheck: Das Raum-Zeit-Modell 🏃‍♂️",
        text: "Das klassische Modell nimmt an, dass jeder jeden sofort anstecken kann. In der Realität bewegen wir uns aber! Schalte oben auf den zweiten Hauptreiter 'Raum-Zeit-Modell' um. In diesem Agenten-basierten Modell (ABM) bewegen sich die Punkte in einem echten Koordinatensystem und stecken andere nur bei direktem Abstand an.",
        setup: () => {
            hideAllUIElements();
            switchModelDirect('spatial-model');
            showElements(['cardBasicPop', 'grpPopulation', 'grpInfected', 'cardRates', 'grpInfRate', 'grpRecTime', 'tabSpatialDropdown', 'spatialParameters', 'grpMobility', 'grpRadius']);
        }
    },
    {
        title: "Zufall vs. Perfekte Mathematik ⚖️",
        text: "Starte das Raum-Zeit-Modell und wechsle in die Auswertung (Diagramm). Fällt dir etwas auf? Die gestrichelten Linien (Live-Simulation) weichen von den durchgezogenen dünnen Linien (theoretische Berechnung) ab! Durch räumliche Ballung und den Faktor Zufall verhalten sich echte Populationen oft anders als die reine Labor-Formel.",
        setup: () => {
            hideAllUIElements();
            switchModelDirect('spatial-model');
            showElements(['cardBasicPop', 'grpPopulation', 'grpInfected', 'cardRates', 'grpInfRate', 'grpRecTime', 'tabSpatialDropdown', 'spatialParameters', 'grpMobility', 'grpRadius', 'formulaLabBox']);
        }
    },
    {
        title: "🔬 Dein Forschungsauftrag: Die Schul-Grippe",
        text: "Simuliere nun folgende Situation im 'Raum-Zeit-Modell': Eine Grippewelle bricht an einer Schule aus. Parameter: N=600 Schüler, I₀=3 Infizierte, Ansteckungsrate=40%, Genesungsdauer=8s. Erforsche zwei Szenarien: 1) Hohe Mobilität (Klassisches Pausengetümmel: Mobilität 2.5). 2) Lockdown (Strikte Trennung: Mobilität 0.3). Beobachte im Diagramm, wie sich der goldene Peak verändert!",
        setup: () => {
            showAllUIElements();
            switchModelDirect('spatial-model');
            
            // Setze die Werte für das Szenario als Starthilfe voraus
            document.getElementById('population').value = 600;
            document.getElementById('infected').value = 3;
            document.getElementById('infRate').value = 40;
            document.getElementById('infRateVal').textContent = 40;
            document.getElementById('recTime').value = 8;
            document.getElementById('mobility').value = 2.5;
            document.getElementById('mobilityVal').textContent = "2.5";
            document.getElementById('radius').value = 12;
            document.getElementById('radiusVal').textContent = 12;
        }
    }
];

function hideAllUIElements() {
    const items = ['grpInfected', 'grpVaccinated', 'cardRates', 'spatialParameters', 'tabSpatialDropdown', 'formulaLabBox'];
    items.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('id-hidden');
    });
}

function showAllUIElements() {
    const items = ['grpInfected', 'grpVaccinated', 'cardRates', 'spatialParameters', 'tabSpatialDropdown', 'formulaLabBox'];
    items.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('id-hidden');
    });
}

function showElements(ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('id-hidden');
    });
}

// Direkter Modellwechsel ohne Reset-Schleife fürs Tutorial
function switchModelDirect(modelType) {
    activeModel = modelType;
    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    const targetBtn = document.querySelector(`.main-tab-btn[data-model="${modelType}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    const isSpatial = activeModel === 'spatial-model';
    if (document.getElementById('spatialParameters')) document.getElementById('spatialParameters').classList.toggle('hidden', !isSpatial);
    if (document.getElementById('sidebarTitle')) document.getElementById('sidebarTitle').textContent = isSpatial ? 'ABM Parameter' : 'SIR Parameter';
}

// LANDING PAGE EVENT LISTENERS
chooseFreeBtn.addEventListener('click', () => {
    currentMode = "free";
    landingPage.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    tutorialOverlay.classList.add('hidden');
    modeBadge.textContent = "Freies Simulieren";
    modeBadge.style.backgroundColor = "#10b981";
    showAllUIElements();
    resetSimulation();
});

chooseTutorialBtn.addEventListener('click', () => {
    currentMode = "tutorial";
    landingPage.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    tutorialOverlay.classList.remove('hidden');
    modeBadge.textContent = "Tutorial-Modus";
    modeBadge.style.backgroundColor = "#3b82f6";
    tutorialStep = 0;
    updateTutorialStep();
    resetSimulation();
});

backToMenuBtn.addEventListener('click', () => {
    stopSimulation();
    mainContainer.classList.add('hidden');
    tutorialOverlay.classList.add('hidden');
    landingPage.classList.remove('hidden');
});

// TUTORIAL NAVIGATION LISTENERS
tutNextBtn.addEventListener('click', () => {
    if (tutorialStep < tutorialSteps.length - 1) {
        tutorialStep++;
        updateTutorialStep();
        resetSimulation();
    } else {
        currentMode = "free";
        tutorialOverlay.classList.add('hidden');
        modeBadge.textContent = "Freies Simulieren";
        modeBadge.style.backgroundColor = "#10b981";
        showAllUIElements();
        resetSimulation();
    }
});

tutPrevBtn.addEventListener('click', () => {
    if (tutorialStep > 0) {
        tutorialStep--;
        updateTutorialStep();
        resetSimulation();
    }
});

function updateTutorialStep() {
    const stepData = tutorialSteps[tutorialStep];
    tutStepNum.textContent = tutorialStep + 1;
    tutStepTotal.textContent = tutorialSteps.length;
    tutTitle.textContent = stepData.title;
    tutText.textContent = stepData.text;
    
    tutPrevBtn.disabled = (tutorialStep === 0);
    if (tutorialStep === tutorialSteps.length - 1) {
        tutNextBtn.textContent = "In den freien Modus wechseln 🚀";
    } else {
        tutNextBtn.textContent = "Weiter";
    }
    
    stepData.setup();
}

// PARAMETER LIVE-ABFRAGE
function readLiveGUIParams() {
    return {
        N:          parseInt(document.getElementById('population').value)  || 1000,
        I0:         parseInt(document.getElementById('infected').value)    || 5,
        vaccPct:    parseInt(document.getElementById('vaccinated').value)  || 0,
        beta:       parseInt(document.getElementById('infRate').value) / 100,
        recSeconds: parseFloat(document.getElementById('recTime').value)   || 6,
        roomW:      parseInt(document.getElementById('roomWidth').value)   || 600,
        roomH:      parseInt(document.getElementById('roomHeight').value)  || 400,
        mobility:   document.getElementById('mobility') ? parseFloat(document.getElementById('mobility').value) : 2.0,
        radius:     parseInt(document.getElementById('radius').value)      || 12,
    };
}

const allInputs = document.querySelectorAll('.sidebar input');
allInputs.forEach(input => {
    input.addEventListener('input', () => {
        if (!isFirstStart) { 
            paramNotice.classList.remove('hidden');
            input.classList.add('unlinked-input');
        }
    });
});

function clearInputHighlights() {
    document.querySelectorAll('.sidebar input').forEach(i => i.classList.remove('unlinked-input'));
}

document.getElementById('vaccinated').addEventListener('input', e => document.getElementById('vaccinatedVal').textContent = e.target.value);
document.getElementById('infRate').addEventListener('input', e => document.getElementById('infRateVal').textContent = e.target.value);
document.getElementById('mobility').addEventListener('input', e => document.getElementById('mobilityVal').textContent = parseFloat(e.target.value).toFixed(1));
document.getElementById('radius').addEventListener('input', e => document.getElementById('radiusVal').textContent = e.target.value);

function switchModel(modelType) {
    if (activeModel === modelType) return;
    
    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    const targetBtn = document.querySelector(`.main-tab-btn[data-model="${modelType}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    
    activeModel = modelType;
    const isSpatial = activeModel === 'spatial-model';
    if (document.getElementById('spatialParameters')) document.getElementById('spatialParameters').classList.toggle('hidden', !isSpatial);
    if (document.getElementById('sidebarTitle')) document.getElementById('sidebarTitle').textContent = isSpatial ? 'ABM Parameter' : 'SIR Parameter';
    resetSimulation();
}

document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchModel(btn.dataset.model);
    });
});

document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const parentDropdown = btn.closest('.tab-dropdown');
        const associatedModel = parentDropdown.querySelector('.main-tab-btn').dataset.model;
        
        if (activeModel !== associatedModel) {
            switchModel(associatedModel);
        }

        activeView = btn.dataset.view;
        
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll(`.sub-tab-btn[data-view="${activeView}"]`).forEach(b => b.classList.add('active'));
        
        document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
        document.getElementById(activeView).classList.add('active');
        
        if (activeView === 'graph-view' && chartInitialized && epicenterChart) {
            epicenterChart.update('none');
        }
        
        e.stopPropagation();
    });
});

startBtn.addEventListener('click', () => { if (simulationRunning) stopSimulation(); else startSimulation(); });
resetBtn.addEventListener('click', resetSimulation);
exportCsvBtn.addEventListener('click', exportToCSV);

function startSimulation() {
    simulationRunning = true;
    startBtn.textContent = 'Simulation stoppen';
    startBtn.style.backgroundColor = '#ef4444'; 
    lastTimestamp = 0;

    if (isFirstStart) {
        activeSimulationParams = readLiveGUIParams();
        liveMaxI = -1;
        livePeakPoint = null;
        liveHerdPoint = null;
        liveDataHistory = []; 
        
        exportCsvBtn.classList.add('disabled');
        exportCsvBtn.disabled = true;

        clearInputHighlights();
        paramNotice.classList.add('hidden');
        
        if (activeModel === 'sir-model') initSIR(); else initABM();
        isFirstStart = false;
    }
    if (activeModel === 'sir-model') animationId = requestAnimationFrame(sirLoop); else animationId = requestAnimationFrame(abmLoop);
}

function stopSimulation() {
    simulationRunning = false;
    startBtn.textContent = 'Simulation fortsetzen';
    startBtn.style.backgroundColor = '#10b981';
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    
    if (liveDataHistory.length > 0) {
        exportCsvBtn.classList.remove('disabled');
        exportCsvBtn.disabled = false;
    }
}

function resetSimulation() {
    stopSimulation();
    clearInputHighlights();
    paramNotice.classList.add('hidden');
    startBtn.textContent = 'Simulation starten';
    exportCsvBtn.classList.add('disabled');
    exportCsvBtn.disabled = true;
    isFirstStart = true;
    liveDataHistory = [];
    if (epicenterChart) { epicenterChart.destroy(); epicenterChart = null; }
    chartInitialized = false;
    updateMathDashboard(0,0,0,0,0);
    drawPlaceholder();
}

function updateMathDashboard(S, I, R, beta, gamma) {
    const N = S + I + R;
    if (N === 0) return;
    const R_eff = gamma > 0 ? (S / N) * (beta / gamma) : 0;
    const dS_dt = -(beta * S * I) / N;
    const dI_dt =  (beta * S * I) / N - gamma * I;
    const dR_dt =  gamma * I;

    document.getElementById('mathReff').textContent = R_eff.toFixed(2);
    document.getElementById('mathDs').textContent   = (dS_dt >= 0 ? '+' : '') + dS_dt.toFixed(1);
    document.getElementById('mathDi').textContent   = (dI_dt >= 0 ? '+' : '') + dI_dt.toFixed(1);
    document.getElementById('mathDr').textContent   = (dR_dt >= 0 ? '+' : '') + dR_dt.toFixed(1);

    const reffEl = document.getElementById('mathReff');
    if (R_eff > 1.0) { reffEl.style.color = '#ef4444'; } else if (R_eff > 0.01) { reffEl.style.color = '#f59e0b'; } else { reffEl.style.color = '#10b981'; }
}

function initChart(mode, theoryData) {
    if (epicenterChart) { epicenterChart.destroy(); epicenterChart = null; }
    chartInitialized = true;
    const chartCanvas = document.getElementById('epicenterChart');

    const theoryDatasets = theoryData ? [
        { label: 'S - Erwartung', data: theoryData.S.map((v,i) => ({ x: theoryData.time[i], y: v })), borderColor: '#3b82f6', borderWidth: 1.5, pointRadius: 0, tension: 0.1, fill: false, order: 3 },
        { label: 'I - Erwartung', data: theoryData.I.map((v,i) => ({ x: theoryData.time[i], y: v })), borderColor: '#ef4444', borderWidth: 1.5, pointRadius: 0, tension: 0.1, fill: false, order: 3 },
        { label: 'R - Erwartung', data: theoryData.R.map((v,i) => ({ x: theoryData.time[i], y: v })), borderColor: '#10b981', borderWidth: 1.5, pointRadius: 0, tension: 0.1, fill: false, order: 3 },
    ] : [];

    const highlightDatasets = [
        { label: 'Theorie: Peak', data: theoryPeakPoint ? [theoryPeakPoint] : [], borderColor: '#ca8a04', backgroundColor: '#ca8a04', pointRadius: 5, borderWidth: 0, showLine: false, order: 1 },
        { label: 'Theorie: Herdenimmunität', data: theoryHerdPoint ? [theoryHerdPoint] : [], borderColor: '#7e22ce', backgroundColor: 'transparent', pointRadius: 11, borderWidth: 3, showLine: false, order: 1 },
        { label: 'Live-Sim: Peak', data: [], borderColor: '#f59e0b', backgroundColor: '#f59e0b', pointRadius: 5, borderWidth: 0, showLine: false, order: 1 },
        { label: 'Live-Sim: Herdenimmunität', data: [], borderColor: '#a855f7', backgroundColor: 'transparent', pointRadius: 11, borderWidth: 3, showLine: false, order: 1 }
    ];

    const simColors = ['#60a5fa', '#f87171', '#34d399'];
    const simLabels = ['S - Realität', 'I - Realität', 'R - Realität'];
    const simDatasets = ['S','I','R'].map((k, i) => ({
        label: simLabels[i], data: [], borderColor: simColors[i], borderWidth: 3, borderDash: [3, 3], pointRadius: 0, tension: 0.2, fill: false, order: 2
    }));

    epicenterChart = new Chart(chartCanvas, {
        type: 'line',
        data: { datasets: [...highlightDatasets, ...theoryDatasets, ...simDatasets] },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false, parsing: false, normalized: true,
            interaction: { mode: 'nearest', intersect: true },
            plugins: { 
                legend: { labels: { color: '#e2e8f0', font: { size: 10 }, usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const label = context[0].dataset.label || '';
                            if (label.includes('Peak')) return '📈 Infektions-Peak (Flatten the Curve)';
                            if (label.includes('Herdenimmunität')) return '🛡️ Schwelle zur Herdenimmunität';
                            return 'Messwert';
                        },
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const x = context.parsed.x.toFixed(1);
                            const y = Math.round(context.parsed.y);
                            if (label.includes('Peak')) return [`Zeitpunkt: ${x}s | Erkrankte: ${y}`, `Bedeutung: Höchste gleichzeitige Belastung.`, `Hier gilt mathematisch exakt: Reff = 1.0`];
                            if (label.includes('Herdenimmunität')) return [`Zeitpunkt: ${x}s | Infizierte bei Eintritt: ${y}`, `Bedeutung: S sinkt unter kritischen Wert.`, `Ab hier flaut die Epidemie dauerhaft ab.`];
                            return `${label}: ${y} Personen (bei ${x}s)`;
                        }
                    }
                }
            },
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Simulations-Zeit (s)', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: { title: { display: true, text: 'Anzahl Personen', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: '#334155' }, beginAtZero: true }
            }
        }
    });
}

function pushChartPoint(t, S, I, R, beta, gamma) {
    if (!epicenterChart || !chartInitialized) return;
    const ds = epicenterChart.data.datasets;

    liveDataHistory.push({ time: t.toFixed(2), S: S, I: I, R: R });

    if (I > liveMaxI) { liveMaxI = I; livePeakPoint = { x: t, y: I }; ds[2].data = [livePeakPoint]; }
    const SKrit = beta > 0 ? (S + I + R) * (gamma / beta) : 0;
    if (!liveHerdPoint && S <= SKrit && I > 0) { liveHerdPoint = { x: t, y: I }; ds[3].data = [liveHerdPoint]; }

    const offset = ds.length - 3;
    ds[offset    ].data.push({ x: t, y: S });
    ds[offset + 1].data.push({ x: t, y: I });
    ds[offset + 2].data.push({ x: t, y: R });
}

function exportToCSV() {
    if (liveDataHistory.length === 0) return;
    let csvContent = "Zeitpunkt_s;Gesunde_S;Infizierte_I;Genesene_R\r\n";
    liveDataHistory.forEach(row => {
        const excelSafeTime = `="${row.time}"`;
        csvContent += `${excelSafeTime};${row.S};${row.I};${row.R}\r\n`;
    });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const modelName = activeModel === 'sir-model' ? "klassisches_SIR" : "Raum_Zeit_ABM";
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `simulationsdaten_${modelName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function computeSIRTheoryAndHighlights(p, betaOverride) {
    const beta  = betaOverride !== undefined ? betaOverride : p.beta;
    const gamma = 1 / p.recSeconds;
    const R0_init = Math.round(p.N * p.vaccPct / 100); const I0 = Math.min(p.I0, p.N - R0_init); let S = p.N - I0 - R0_init; let I = I0; let R = R0_init;
    const data = { S: [], I: [], R: [], time: [] }; const dt = 0.05; const maxTime = 90; const steps = Math.round(maxTime / dt);
    theoryPeakPoint = null; theoryHerdPoint = null; let maxTheoryI = -1; const SKrit = beta > 0 ? p.N * (gamma / beta) : 0;

    for (let step = 0; step <= steps; step++) {
        const curTime = +(step * dt).toFixed(2); data.time.push(curTime); data.S.push(Math.round(S)); data.I.push(Math.round(I)); data.R.push(Math.round(R));
        if (I > maxTheoryI) { maxTheoryI = I; theoryPeakPoint = { x: curTime, y: Math.round(I) }; }
        if (!theoryHerdPoint && S <= SKrit && I > 0.5) { theoryHerdPoint = { x: curTime, y: Math.round(I) }; }
        const dS = -(beta * S * I) / p.N; const dI =  (beta * S * I) / p.N - gamma * I; const dR =  gamma * I;
        S = Math.max(0, S + dS * dt); I = Math.max(0, I + dI * dt); R = Math.min(p.N, R + dR * dt);
    }
    return data;
}

function computeEffectiveBeta(p) { const area = p.roomW * p.roomH; return p.beta * Math.PI * p.radius * p.radius * p.N / area; }

function initSIR() {
    const p = activeSimulationParams; canvas.width = 600; canvas.height = 400;
    const R0_init = Math.round(p.N * p.vaccPct / 100); const I0 = Math.min(p.I0, p.N - R0_init); const S_count = p.N - I0 - R0_init;
    sirAgents = []; sirTick = 0; sirTheory = computeSIRTheoryAndHighlights(p); initChart('sir', sirTheory);
    for (let i = 0; i < p.N; i++) {
        sirAgents.push({
            x: 10 + Math.random() * 580, y: 10 + Math.random() * 380,
            state: i < S_count ? 'S' : i < S_count + I0 ? 'I' : 'R', infectedAt: i < S_count ? null : (i < S_count + I0 ? 0 : null),
        });
    }
    pushChartPoint(0, S_count, I0, R0_init, p.beta, 1/p.recSeconds);
}

function sirLoop(timestamp) {
    if (!simulationRunning) return;
    if (!lastTimestamp) lastTimestamp = timestamp;
    const elapsed = timestamp - lastTimestamp;
    if (elapsed >= MS_PER_TICK) { lastTimestamp = timestamp - (elapsed % MS_PER_TICK); tickSIR(); }
    if (I_still_exist()) animationId = requestAnimationFrame(sirLoop); else stopSimulation();
}

function I_still_exist() {
    for (const ag of (activeModel === 'sir-model' ? sirAgents : abmAgents)) { if (ag.state === 'I') return true; }
    return false;
}

function tickSIR() {
    const p = activeSimulationParams; const gamma = 1 / p.recSeconds; const recTicks = p.recSeconds * FPS; sirTick++;
    let I_count = 0;
    for (const ag of sirAgents) { if (ag.state === 'I') { I_count++; if (sirTick - ag.infectedAt >= recTicks) ag.state = 'R'; } }
    if (I_count > 0) {
        const pInfect = (p.beta * I_count) / (p.N * FPS);
        for (const ag of sirAgents) { if (ag.state === 'S' && Math.random() < pInfect) { ag.state = 'I'; ag.infectedAt = sirTick; } }
    }
    let S = 0, I = 0, R = 0;
    for (const ag of sirAgents) { if (ag.state === 'S') S++; else if (ag.state === 'I') I++; else R++; }
    const t = sirTick / FPS;
    if (sirTick % 5 === 0) { pushChartPoint(t, S, I, R, p.beta, gamma); if (activeView === 'graph-view' && epicenterChart) epicenterChart.update('none'); }
    updateMathDashboard(S, I, R, p.beta, gamma); drawSIRAgents(S, I, R);
}

function drawSIRAgents(S, I, R) {
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, 600, 400);
    const COLOR = { S: '#3b82f6', I: '#ef4444', R: '#10b981' };
    sirAgents.forEach(ag => { ctx.beginPath(); ctx.arc(ag.x, ag.y, ag.state === 'I' ? 4.5 : 3, 0, Math.PI * 2); ctx.fillStyle = COLOR[ag.state]; ctx.fill(); });
    drawHUD(600, 400, S, I, R, sirAgents.length, sirTick);
}

function initABM() {
    const p = activeSimulationParams; canvas.width = p.roomW; canvas.height = p.roomH;
    const R0_init = Math.round(p.N * p.vaccPct / 100); const I0 = Math.min(p.I0, p.N - R0_init); const S_count = p.N - I0 - R0_init;
    abmAgents = []; abmTick = 0; const betaEff = computeEffectiveBeta(p); abmTheory = computeSIRTheoryAndHighlights(p, betaEff); initChart('abm', abmTheory);
    for (let i = 0; i < p.N; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = p.mobility <= 0.001 ? 0 : p.mobility * (0.6 + Math.random() * 0.8);
        abmAgents.push({
            x: Math.random() * p.roomW, y: Math.random() * p.roomH, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            state: i < S_count ? 'S' : i < S_count + I0 ? 'I' : 'R', infectedAt: i < S_count ? null : (i < S_count + I0 ? 0 : null),
        });
    }
    pushChartPoint(0, S_count, I0, R0_init, betaEff, 1/p.recSeconds);
}

function abmLoop(timestamp) {
    if (!simulationRunning) return;
    if (!lastTimestamp) lastTimestamp = timestamp;
    const elapsed = timestamp - lastTimestamp;
    if (elapsed >= MS_PER_TICK) { lastTimestamp = timestamp - (elapsed % MS_PER_TICK); tickABM(); }
    if (I_still_exist()) animationId = requestAnimationFrame(abmLoop); else stopSimulation();
}

function tickABM() {
    const p = activeSimulationParams; const gamma = 1 / p.recSeconds; const betaEff = computeEffectiveBeta(p); const recTicks = p.recSeconds * FPS; abmTick++; const r2 = p.radius * p.radius;

    for (const ag of abmAgents) {
        if (p.mobility > 0.001) {
            if (Math.random() < 0.01) { const a = Math.random() * Math.PI * 2; const spd = Math.hypot(ag.vx, ag.vy); ag.vx = Math.cos(a) * spd; ag.vy = Math.sin(a) * spd; }
            ag.x += ag.vx; ag.y += ag.vy;
            if (ag.x < 0) { ag.x = 0; ag.vx *= -1; } if (ag.x > p.roomW) { ag.x = p.roomW; ag.vx *= -1; }
            if (ag.y < 0) { ag.y = 0; ag.vy *= -1; } if (ag.y > p.roomH) { ag.y = p.roomH; ag.vy *= -1; }
        }
        if (ag.state === 'I' && abmTick - ag.infectedAt >= recTicks) ag.state = 'R';
    }

    const pContact = p.beta / FPS;
    for (const infected of abmAgents) {
        if (infected.state !== 'I') continue;
        for (const susceptible of abmAgents) {
            if (susceptible.state !== 'S') continue;
            const dx = infected.x - susceptible.x; const dy = infected.y - susceptible.y;
            if (dx * dx + dy * dy <= r2 && Math.random() < pContact) { susceptible.state = 'New_I'; susceptible.infectedAt = abmTick; }
        }
    }

    let S = 0, I = 0, R = 0;
    for (const ag of abmAgents) { if (ag.state === 'New_I') ag.state = 'I'; if (ag.state === 'S') S++; else if (ag.state === 'I') I++; else R++; }
    const t = abmTick / FPS;
    if (abmTick % 5 === 0) { pushChartPoint(t, S, I, R, betaEff, gamma); if (activeView === 'graph-view' && epicenterChart) epicenterChart.update('none'); }
    updateMathDashboard(S, I, R, betaEff, gamma); drawABM(p, S, I, R);
}

function drawABM(p, S, I, R) {
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, p.roomW, p.roomH);
    const COLOR = { S: '#3b82f6', I: '#ef4444', R: '#10b981' }; ctx.strokeStyle = 'rgba(239,68,68,0.12)';
    abmAgents.forEach(ag => {
        ctx.beginPath(); ctx.arc(ag.x, ag.y, ag.state === 'I' ? 4.5 : 3, 0, Math.PI * 2); ctx.fillStyle = COLOR[ag.state]; ctx.fill();
        if (ag.state === 'I') { ctx.beginPath(); ctx.arc(ag.x, ag.y, p.radius, 0, Math.PI * 2); ctx.stroke(); }
    });
    drawHUD(p.roomW, p.roomH, S, I, R, abmAgents.length, abmTick);
}

function drawHUD(W, H, S, I, R, total, tick) {
    ctx.font = 'bold 12px Segoe UI';
    [{ label: 'S: ' + S, color: '#3b82f6', x: 10 }, { label: 'I: ' + I, color: '#ef4444', x: 100 }, { label: 'R: ' + R, color: '#10b981', x: 190 }].forEach(h => {
        ctx.fillStyle = 'rgba(15,23,42,0.8)'; ctx.fillRect(h.x - 4, 6, 80, 22); ctx.fillStyle = h.color; ctx.fillText(h.label, h.x, 21);
    });
    ctx.fillStyle = 'rgba(15,23,42,0.8)'; ctx.fillRect(W - 90, 6, 80, 22); ctx.fillStyle = '#94a3b8'; ctx.fillText('t = ' + (tick / FPS).toFixed(1) + 's', W - 83, 21);
}

function drawPlaceholder() {
    canvas.width = 600; canvas.height = 400; ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, 600, 400);
    ctx.fillStyle = '#475569'; ctx.font = '16px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('Werte einstellen & Simulation starten.', 300, 200); ctx.textAlign = 'left';
}

const modal = document.getElementById('explanationModal');
const modalBtn = document.getElementById('infoModalBtn');
const closeModal = document.querySelector('.close-modal');
modalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
closeModal.addEventListener('click', () => modal.classList.add('hidden'));
window.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

drawPlaceholder();
