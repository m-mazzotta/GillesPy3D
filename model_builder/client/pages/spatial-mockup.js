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
  var modelAdapter = require('../spatial-mockup-model-adapter');
  var resizeBound = false;

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

  '#sm-domain-plot{' +
    'width:500px;' +
    'max-width:100%;' +
    'height:500px;' +
    'margin:auto;' +
    'border:1px solid #ccc;' +
    'border-radius:6px;' +
    'background:white;' +
  '}' +

  '.sm-actions{' +
    'display:flex;' +
    'flex-wrap:wrap;' +
    'align-items:center;' +
    'gap:12px;' +
    'margin-top:12px;' +
  '}' +

  '#sm-run,#sm-save{' +
    'padding:8px 12px;' +
    'border:1px solid #bbb;' +
    'border-radius:6px;' +
    'background:#fff;' +
    'cursor:pointer;' +
  '}' +

  '#sm-run:disabled,#sm-save:disabled{' +
    'cursor:not-allowed;' +
    'opacity:0.65;' +
  '}' +

  '.sm-model-grid{' +
    'display:grid;' +
    'grid-template-columns:repeat(2,minmax(220px,1fr));' +
    'gap:12px;' +
  '}' +

  '.sm-model-field label{' +
    'display:block;' +
    'font-weight:600;' +
    'margin-bottom:5px;' +
  '}' +

  '.sm-model-field input[type="text"]{' +
    'width:100%;' +
    'box-sizing:border-box;' +
    'padding:7px 9px;' +
    'border:1px solid #bbb;' +
    'border-radius:5px;' +
  '}' +

  '#sm-save-status{' +
    'font-size:14px;' +
    'margin:10px 0 0 0;' +
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

      '<div class="sm-panel">' +
        '<strong>Model</strong>' +
        '<div class="sm-model-grid">' +
          '<div class="sm-model-field">' +
            '<label for="sm-model-name">Model name</label>' +
            '<input id="sm-model-name" type="text" value="spatial_mockup" />' +
          '</div>' +
          '<div class="sm-model-field">' +
            '<label for="sm-model-folder">Save folder</label>' +
            '<input id="sm-model-folder" type="text" value="SpatialMockupModels" />' +
          '</div>' +
        '</div>' +
        '<label style="display:block;margin-top:10px">' +
          '<input id="sm-overwrite" type="checkbox" /> Overwrite an existing model' +
        '</label>' +
        '<div class="sm-actions">' +
          '<button id="sm-save" type="button">Save Model</button>' +
        '</div>' +
        '<p id="sm-save-status">Not saved.</p>' +
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

      // live domain preview + simulation plot
      '<div class="sm-panel sm-panel-plot">' +
        '<div id="sm-domain-plot"></div>' +
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
    var domainPlotEl = document.getElementById('sm-domain-plot');
    var metaEl = document.getElementById('sm-meta');
    var modelNameEl = document.getElementById('sm-model-name');
    var modelFolderEl = document.getElementById('sm-model-folder');
    var overwriteEl = document.getElementById('sm-overwrite');
    var saveBtnEl = document.getElementById('sm-save');
    var saveStatusEl = document.getElementById('sm-save-status');
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
    var cachedFigures = null;
    var lastRunSummary = null;
    var structuredModel = null;
    var domainPreviewTimer = null;
    var domainPreviewRequest = 0;
    var savedPath = null;
    var savedModelKey = null;

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

    function syncReactionUi() {
      addReactionBtn.disabled = reactionCount >= 3;
      if (reactionCount >= 2) {
        speciesWrapEl.style.display = '';
      }
      syncSpeciesOptions();
    }

    // Update structured state and request its SpatialPy domain preview.
    function draw() {

      var densityLevel = getDensityLevel();

      syncReactionUi();
      var model = refreshStructuredModel();
      scheduleDomainPreview(model.domain, densityLevel);
    }

    densityEl.addEventListener('input', draw);

    [modelNameEl, modelFolderEl].forEach(function (input) {
      input.addEventListener('input', function () {
        savedPath = null;
        savedModelKey = null;
        saveStatusEl.textContent = 'Not saved.';
      });
    });

    saveBtnEl.addEventListener('click', async function () {
      saveBtnEl.disabled = true;
      saveBtnEl.textContent = 'Saving...';
      try {
        await saveStructuredModel(refreshStructuredModel());
      } catch (err) {
        saveStatusEl.textContent = 'Save failed: ' + err.message;
      } finally {
        saveBtnEl.disabled = false;
        saveBtnEl.textContent = 'Save Model';
      }
    });

    addReactionBtn.addEventListener('click', function () {
      if (reactionCount >= 3) {
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
      refreshStructuredModel();
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
      } else {
        runStatusEl.textContent = 'Run Simulation to generate the ' + selected + ' view.';
      }
    });

    // slider value -> density level
    function getDensityLevel() {

      var value = parseInt(densityEl.value, 10);

      if (value === 0) return 'low';
      if (value === 1) return 'medium';

      return 'high';
    }

    function refreshStructuredModel() {
      structuredModel = modelAdapter.buildSpatialMockupModel({
        density: getDensityLevel(),
        reactionCount: reactionCount
      });
      return structuredModel;
    }

    function getModelIdentity() {
      var name = modelNameEl.value.trim();
      var folder = modelFolderEl.value.trim();
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) {
        throw new Error(
          'Model name must start with a letter and use only letters, numbers, underscores, or hyphens.'
        );
      }
      var folderParts = folder.split('/');
      var validFolder = folder &&
        folder.indexOf('\\') < 0 &&
        folderParts.every(function (part) {
          return /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/.test(part);
        });
      if (!validFolder) {
        throw new Error(
          'Save folder may use letters, numbers, spaces, underscores, hyphens, and forward slashes.'
        );
      }
      return {
        name: name,
        folder: folder,
        key: folder + '/' + name
      };
    }

    async function readJSONResponse(response) {
      var text = await response.text();
      var data;
      try {
        data = JSON.parse(text.replace(/\bNaN\b/g, 'null'));
      } catch (err) {
        throw new Error('The server returned an invalid response.');
      }
      if (!response.ok) {
        throw new Error(data.message || data.Message || 'The request failed.');
      }
      return data;
    }

    async function saveStructuredModel(model) {
      var identity = getModelIdentity();
      var canUpdate = savedPath !== null && savedModelKey === identity.key;
      saveStatusEl.textContent = 'Saving model...';

      var response = await fetch('/model_builder/api/spatial-mockup/model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: identity.name,
          folder: identity.folder,
          overwrite: overwriteEl.checked || canUpdate,
          model: model
        })
      });
      var data = await readJSONResponse(response);
      savedPath = data.path;
      savedModelKey = identity.key;
      saveStatusEl.textContent = 'Saved to ' + savedPath + '.';
      return savedPath;
    }

    function scheduleDomainPreview(domain, densityLevel) {
      if (domainPreviewTimer !== null) {
        window.clearTimeout(domainPreviewTimer);
      }

      domainPreviewRequest += 1;
      var requestID = domainPreviewRequest;
      metaEl.textContent = 'Generating ' + densityLevel + ' density domain...';

      domainPreviewTimer = window.setTimeout(function () {
        loadDomainPreview(domain, densityLevel, requestID);
      }, 200);
    }

    async function loadDomainPreview(domain, densityLevel, requestID) {
      try {
        var response = await fetch('/model_builder/api/spatial-model/domain-plot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(domain)
        });
        var data = await response.json();

        if (requestID !== domainPreviewRequest) {
          return;
        }
        if (!response.ok || !data.fig) {
          throw new Error(data.Message || data.message || 'Failed to generate domain preview.');
        }

        renderDomainFigure(data.fig);
        var particleCount = Array.isArray(data.particles) ? data.particles.length : 0;
        metaEl.textContent =
          'Sphere (' + densityLevel + ' density) \u00b7 ' + particleCount + ' particles';
      } catch (err) {
        if (requestID !== domainPreviewRequest) {
          return;
        }
        Plotly.purge(domainPlotEl);
        domainPlotEl.innerHTML = '';
        metaEl.textContent = 'Domain preview failed: ' + err.message;
      }
    }

    function ensureResizeListener() {
      if (!resizeBound) {
        resizeBound = true;
        window.addEventListener('resize', function () {
          [domainPlotEl, plotEl].forEach(function (element) {
            if (element && element.classList && element.classList.contains('js-plotly-plot')) {
              Plotly.Plots.resize(element);
            }
          });
        });
      }
    }

    function renderDomainFigure(figure) {
      if (!figure || !figure.data || !figure.layout) {
        return;
      }
      Plotly.purge(domainPlotEl);
      domainPlotEl.innerHTML = '';
      var fig = {
        data: figure.data,
        layout: tunePlotlyLayout(figure.layout),
        config: Object.assign(
          { responsive: true, scrollZoom: true, displayModeBar: true },
          figure.config || {}
        )
      };
      Plotly.newPlot(domainPlotEl, fig).then(function (gd) {
        Plotly.Plots.resize(gd);
      });
      ensureResizeListener();
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
      saveBtnEl.disabled = isRunning;
      runBtnEl.textContent = isRunning ? 'Running...' : 'Run Simulation';
      runStatusEl.textContent = statusText;
    }

    function wait(milliseconds) {
      return new Promise(function (resolve) {
        window.setTimeout(resolve, milliseconds);
      });
    }

    async function pollStructuredSimulation(path, outfile) {
      while (true) {
        await wait(1000);
        var query = '?cmd=read&outfile=' + encodeURIComponent(outfile) +
          '&path=' + encodeURIComponent(path);
        var response = await fetch('/model_builder/api/model/run' + query);
        var data = await readJSONResponse(response);
        var results = data.Results || {};

        if (results.errors) {
          throw new Error(results.errors);
        }
        if (!data.Running) {
          return results;
        }
      }
    }

    async function runStructuredSimulation(path, target) {
      var query = '?cmd=start&outfile=none&path=' + encodeURIComponent(path) +
        '&target=' + encodeURIComponent(target);
      var response = await fetch('/model_builder/api/model/run' + query);
      var data = await readJSONResponse(response);
      if (!data.Outfile) {
        throw new Error('The preview runner did not return an output identifier.');
      }
      return pollStructuredSimulation(path, data.Outfile);
    }

    async function runSimulation() {
      var densityLevel = getDensityLevel();
      var model = refreshStructuredModel();
      var selected = speciesEl.value || 'A';
      var startedAt = Date.now();
      setRunState(true, 'Saving and running the structured spatial model...');
      speciesEl.disabled = true;
      plotEl.style.display = 'none';
      resultEl.style.display = 'none';
      resultEl.textContent = '';
      cachedFigures = null;
      lastRunSummary = null;

      try {
        var activeReactionCount = reactionCount;
        var path = await saveStructuredModel(model);
        runStatusEl.textContent = 'Running ' + path + ' for all species...';
        var results = await runStructuredSimulation(path, '__all_species__');
        var preview = results.results || {};
        cachedFigures = preview.figures || {};
        if (Object.keys(cachedFigures).length === 0 && preview.data && preview.layout) {
          cachedFigures[selected] = preview;
        }
        if (!cachedFigures[selected]) {
          selected = Object.keys(cachedFigures)[0];
          speciesEl.value = selected;
        }
        if (!selected || !cachedFigures[selected]) {
          throw new Error('The structured simulation completed without species figures.');
        }
        renderFigure(cachedFigures[selected]);

        setRunState(false, 'Simulation completed.');
        speciesEl.disabled = false;
        lastRunSummary = {
          status: 'success',
          message: 'Structured SpatialPy simulation completed.',
          elapsed_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
          model_path: path,
          density: densityLevel,
          species: preview.species || model.species.map(function (item) { return item.name; }),
          viewing_species: selected,
          reaction_count: activeReactionCount,
          executor: 'convert_to_spatialpy'
        };
        resultEl.style.display = 'block';
        resultEl.textContent = JSON.stringify(lastRunSummary, null, 2);
      } catch (err) {
        setRunState(false, 'Simulation failed.');
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