/*
GillesPy3D is a platform for simulating biochemical systems
Copyright (C) 2025 GillesPy3D developers.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

Self-contained spatial domain mockup: shape type, particle density slider,
and canvas preview (not connected to SpatialPy).
*/

(function () {
  var Plotly = require('plotly.js-dist');
  var resizeBound = false;

  // image mapping
  var IMAGE_MAP = {
    low: '/static/sphere_low.png',
    medium: '/static/sphere_medium.png',
    high: '/static/sphere_high.png'
  };

  function mount() {

    // styles
    var style = document.createElement('style');

style.textContent =
  '.sm-wrap{' +
    'font-family:system-ui;' +
    'max-width:min(1280px, 98vw);' +
    'margin:24px auto;' +
    'padding:0 16px;' +
  '}' +

  '.sm-panel{' +
    'border:1px solid #ddd;' +
    'border-radius:8px;' +
    'padding:16px;' +
    'margin-bottom:16px;' +
    'background:#fafafa;' +
  '}' +

  '#sm-density{' +
    'display:block;' +
    'width:500px;' +
    'margin:0 auto;' +
  '}' +

  '.slider-labels{' +
    'width:500px;' +
    'margin:8px auto 0 auto;' +
    'display:grid;' +
    'grid-template-columns:1fr 1fr 1fr;' +
    'text-align:center;' +
    'font-size:14px;' +
  '}' +

  '#sm-image{' +
    'display:block;' +
    'width:500px;' +
    'height:500px;' +
    'object-fit:contain;' +
    'margin:auto;' +
    'border:1px solid #ccc;' +
    'border-radius:6px;' +
    'background:white;' +
  '}' +

  '.sm-actions{' +
    'display:flex;' +
    'align-items:center;' +
    'gap:12px;' +
    'margin-top:12px;' +
  '}' +

  '#sm-run{' +
    'padding:8px 12px;' +
    'border:1px solid #bbb;' +
    'border-radius:6px;' +
    'background:#fff;' +
    'cursor:pointer;' +
  '}' +

  '#sm-run:disabled{' +
    'cursor:not-allowed;' +
    'opacity:0.65;' +
  '}' +

  '#sm-run-status{' +
    'font-size:14px;' +
    'margin:0;' +
  '}' +

  '#sm-result{' +
    'margin-top:12px;' +
    'padding:10px;' +
    'border:1px dashed #bbb;' +
    'border-radius:6px;' +
    'background:#fff;' +
    'white-space:pre-wrap;' +
    'font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;' +
    'font-size:12px;' +
    'display:none;' +
  '}' +

  '#sm-plot{' +
    'margin-top:12px;' +
    'width:100%;' +
    'min-height:min(72vh, 820px);' +
    'height:min(72vh, 820px);' +
    'display:none;' +
    'box-sizing:border-box;' +
  '}' +
  '.sm-panel-plot{' +
    'padding:12px 10px 16px 10px;' +
  '}' +

  '.sm-reaction-actions{' +
    'display:flex;' +
    'flex-wrap:wrap;' +
    'align-items:center;' +
    'gap:12px;' +
    'margin-top:10px;' +
  '}' +

  '#sm-add-reaction{' +
    'padding:6px 12px;' +
    'border:1px solid #bbb;' +
    'border-radius:6px;' +
    'background:#fff;' +
    'cursor:pointer;' +
  '}' +

  '#sm-add-reaction:disabled{' +
    'opacity:0.6;' +
    'cursor:not-allowed;' +
  '}' +

  '.sm-species-row{' +
    'margin:12px 0 14px 0;' +
    'font-size:14px;' +
  '}' +

  '#sm-species{' +
    'margin-left:6px;' +
    'padding:4px 8px;' +
  '}';

    document.head.appendChild(style);

    // root
    var root = document.createElement('div');
    root.className = 'sm-wrap';

    root.innerHTML =
      '<h1>Spatial model mockup</h1>' +

      // shape selector
      '<div class="sm-panel">' +
        '<label>' +
          '<input type="radio" name="sm-shape" value="sphere" checked /> ' +
          'Sphere' +
        '</label>' +
      '</div>' +

      // density slider
      '<div class="sm-panel">' +
        '<label for="sm-density"><strong>Particle Density</strong></label><br/><br/>' +

        '<input ' +
          'type="range" ' +
          'id="sm-density" ' +
          'min="0" ' +
          'max="2" ' +
          'step="1" ' +
          'value="0" ' +
        '/>' +

        '<div class="slider-labels">' +
          '<span>Low</span>' +
          '<span>Medium</span>' +
          '<span>High</span>' +
        '</div>' +
      '</div>' +

      '<div class="sm-panel" id="sm-reactions-panel">' +
        '<strong>Reactions</strong>' +
        '<p id="sm-r1-desc">r1: \u2205 \u2192 A</p>' +
        '<p id="sm-r2-desc" style="display:none">r2: \u2205 \u2192 B</p>' +
        '<p id="sm-r3-desc" style="display:none">r3: A + B \u2192 C</p>' +
        '<div class="sm-reaction-actions">' +
          '<button type="button" id="sm-add-reaction">Add reaction</button>' +
        '</div>' +
      '</div>' +

      // image preview + plot (wider / taller plot area than other panels)
      '<div class="sm-panel sm-panel-plot">' +
        '<img id="sm-image" />' +
        '<p id="sm-meta"></p>' +
        '<div id="sm-species-wrap" class="sm-species-row" style="display:none">' +
          '<label for="sm-species"><strong>View Species</strong></label> ' +
          '<select id="sm-species">' +
            '<option value="A">A (r1)</option>' +
            '<option value="B">B (r2)</option>' +
            '<option value="C">C (r3)</option>' +
          '</select>' +
        '</div>' +
        '<div class="sm-actions">' +
          '<button id="sm-run" type="button">Run Simulation</button>' +
          '<p id="sm-run-status">Idle</p>' +
        '</div>' +
        '<div id="sm-plot"></div>' +
        '<pre id="sm-result"></pre>' +
      '</div>';

    document.body.appendChild(root);

    // elements
    var densityEl = document.getElementById('sm-density');
    var imgEl = document.getElementById('sm-image');
    var metaEl = document.getElementById('sm-meta');
    var runBtnEl = document.getElementById('sm-run');
    var runStatusEl = document.getElementById('sm-run-status');
    var plotEl = document.getElementById('sm-plot');
    var resultEl = document.getElementById('sm-result');
    var r2DescEl = document.getElementById('sm-r2-desc');
    var r3DescEl = document.getElementById('sm-r3-desc');
    var addReactionBtn = document.getElementById('sm-add-reaction');
    var speciesWrapEl = document.getElementById('sm-species-wrap');
    var speciesEl = document.getElementById('sm-species');

    var reactionCount = 1;
    var hasSuccessfulRun = false;
    var cachedFigures = null;
    var lastRunSummary = null;

    function syncSpeciesOptions() {
      var options = speciesEl.options;
      // A always available
      options[0].hidden = false;
      options[0].disabled = false;
      // B when >= 2 reactions
      options[1].hidden = reactionCount < 2;
      options[1].disabled = reactionCount < 2;
      // C when >= 3 reactions
      options[2].hidden = reactionCount < 3;
      options[2].disabled = reactionCount < 3;

      if (reactionCount < 2 && speciesEl.value !== 'A') {
        speciesEl.value = 'A';
      } else if (reactionCount < 3 && speciesEl.value === 'C') {
        speciesEl.value = 'A';
      }
    }

    function resetReactionUi() {
      reactionCount = 1;
      hasSuccessfulRun = false;
      cachedFigures = null;
      lastRunSummary = null;
      r2DescEl.style.display = 'none';
      r3DescEl.style.display = 'none';
      speciesWrapEl.style.display = 'none';
      speciesEl.value = 'A';
      syncSpeciesOptions();
      addReactionBtn.disabled = false;
      addReactionBtn.textContent = 'Add reaction';
    }

    function syncReactionUiToDensity() {
      if (getDensityLevel() !== 'low') {
        resetReactionUi();
        addReactionBtn.disabled = true;
      } else {
        addReactionBtn.disabled = reactionCount >= 3;
        if (reactionCount >= 2) {
          speciesWrapEl.style.display = '';
        }
        syncSpeciesOptions();
      }
    }

    // update image
    function draw() {

      var densityLevel = getDensityLevel();

      imgEl.src = IMAGE_MAP[densityLevel];

      metaEl.textContent =
        'Sphere (' + densityLevel + ' density)';
      syncReactionUiToDensity();
    }

    densityEl.addEventListener('input', draw);

    addReactionBtn.addEventListener('click', function () {
      if (getDensityLevel() !== 'low' || reactionCount >= 3) {
        return;
      }
      reactionCount += 1;
      if (reactionCount >= 2) {
        r2DescEl.style.display = '';
        speciesWrapEl.style.display = '';
      }
      if (reactionCount >= 3) {
        r3DescEl.style.display = '';
        addReactionBtn.disabled = true;
      }
      syncSpeciesOptions();
      // New reaction set invalidates previous cached figures.
      cachedFigures = null;
      hasSuccessfulRun = false;
    });

    speciesEl.addEventListener('change', function () {
      if (!cachedFigures) {
        return;
      }
      var selected = speciesEl.value || 'A';
      if (cachedFigures[selected]) {
        renderFigure(cachedFigures[selected]);
        if (lastRunSummary) {
          lastRunSummary.viewing_species = selected;
          resultEl.style.display = 'block';
          resultEl.textContent = JSON.stringify(lastRunSummary, null, 2);
        }
      }
    });

    // slider value -> density level
    function getDensityLevel() {

      var value = parseInt(densityEl.value, 10);

      if (value === 0) return 'low';
      if (value === 1) return 'medium';

      return 'high';
    }

    function ensureResizeListener() {
      if (!resizeBound) {
        resizeBound = true;
        window.addEventListener('resize', function () {
          if (plotEl && plotEl.classList && plotEl.classList.contains('js-plotly-plot')) {
            Plotly.Plots.resize(plotEl);
          }
        });
      }
    }

    function renderFigure(figure) {
      if (!figure || !figure.data || !figure.layout) {
        return;
      }
      plotEl.style.display = 'block';
      Plotly.purge(plotEl);
      plotEl.innerHTML = '';
      var fig = {
        data: figure.data,
        layout: tunePlotlyLayout(figure.layout),
        frames: figure.frames,
        config: Object.assign(
          { responsive: true, scrollZoom: true, displayModeBar: true },
          figure.config || {}
        )
      };
      Plotly.newPlot(plotEl, fig).then(function (gd) {
        Plotly.Plots.resize(gd);
      });
      ensureResizeListener();
    }

    function tunePlotlyLayout(layout) {
      var L = layout && typeof layout === 'object'
        ? JSON.parse(JSON.stringify(layout))
        : {};
      L.autosize = true;
      // Notebook exports often set small fixed sizes; let the DOM + resize() drive size.
      if (typeof L.width === 'number' && L.width < 700) {
        delete L.width;
      }
      if (typeof L.height === 'number' && L.height < 520) {
        delete L.height;
      }
      if (L.width === 'auto') {
        delete L.width;
      }
      if (L.height === 'auto') {
        delete L.height;
      }
      L.margin = L.margin || {};
      if (typeof L.margin.l !== 'number' || L.margin.l > 20) {
        L.margin.l = Math.min(L.margin.l || 0, 12);
      }
      if (typeof L.margin.r === 'number' && L.margin.r > 160) {
        L.margin.r = 120;
      }
      if (typeof L.margin.t !== 'number' || L.margin.t > 36) {
        L.margin.t = Math.min(L.margin.t || 0, 28);
      }
      // Keep bottom margin for animation slider / updatemenus
      if (typeof L.margin.b !== 'number' || L.margin.b < 72) {
        L.margin.b = Math.max(L.margin.b || 0, 88);
      }
      if (L.scene && typeof L.scene === 'object') {
        L.scene = Object.assign({}, L.scene, { aspectmode: 'cube' });
      }
      return L;
    }

    function setRunState(isRunning, statusText) {
      runBtnEl.disabled = isRunning;
      runBtnEl.textContent = isRunning ? 'Running...' : 'Run Simulation';
      runStatusEl.textContent = statusText;
    }

    async function runSimulation() {
      var densityLevel = getDensityLevel();
      setRunState(true, 'Running simulation for ' + densityLevel + ' density...');
      speciesEl.disabled = true;
      plotEl.style.display = 'none';
      resultEl.style.display = 'none';
      resultEl.textContent = '';
      cachedFigures = null;
      lastRunSummary = null;

      try {
        var activeReactionCount = getDensityLevel() === 'low' ? reactionCount : 1;
        var response = await fetch('/model_builder/api/spatial-mockup/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            density: densityLevel,
            reaction_count: activeReactionCount,
            species: speciesEl.value || 'A'
          })
        });

        var data = await response.json();
        if (!response.ok || data.status === 'error') {
          throw new Error(data.message || 'Failed to run simulation.');
        }

        cachedFigures = data.figures || {};
        if ((!cachedFigures || Object.keys(cachedFigures).length === 0) && data.figure) {
          cachedFigures = {};
          cachedFigures[data.viewing_species || 'A'] = data.figure;
        }

        var selected = speciesEl.value || data.viewing_species || 'A';
        if (!cachedFigures[selected] && data.figure) {
          selected = data.viewing_species || Object.keys(cachedFigures)[0] || 'A';
        }
        if (cachedFigures[selected]) {
          renderFigure(cachedFigures[selected]);
        }

        setRunState(false, 'Simulation completed.');
        hasSuccessfulRun = true;
        speciesEl.disabled = false;
        lastRunSummary = {
          status: data.status,
          message: data.message,
          elapsed_seconds: data.elapsed_seconds,
          model_name: data.model_name,
          num_trajectories: data.num_trajectories,
          density: data.density,
          species: data.species,
          viewing_species: selected,
          reaction_count: data.reaction_count,
          script: data.script
        };
        resultEl.style.display = 'block';
        resultEl.textContent = JSON.stringify(lastRunSummary, null, 2);
      } catch (err) {
        setRunState(false, 'Simulation failed.');
        hasSuccessfulRun = false;
        cachedFigures = null;
        lastRunSummary = null;
        speciesEl.disabled = false;
        plotEl.style.display = 'none';
        resultEl.style.display = 'block';
        resultEl.textContent = JSON.stringify({
          status: 'error',
          message: err.message
        }, null, 2);
      }
    }

    runBtnEl.addEventListener('click', runSimulation);

    draw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();