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
  var editorStateApi = require('../spatial-mockup-editor-state');
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

  '.sm-panel > .sm-panel-title{' +
    'display:block;' +
    'font-size:18px;' +
    'font-weight:700;' +
    'margin:0 0 12px 0;' +
  '}' +

  '.sm-subsection{' +
    'border:1px solid #e4e4e4;' +
    'border-radius:6px;' +
    'padding:14px;' +
    'margin:0 0 14px 0;' +
    'background:#fff;' +
  '}' +

  '.sm-subsection:last-child{' +
    'margin-bottom:0;' +
  '}' +

  '.sm-subsection > strong{' +
    'display:block;' +
    'margin-bottom:6px;' +
  '}' +

  '#sm-density{' +
    'display:block;' +
    'width:500px;' +
    'margin:0 auto;' +
  '}' +

  '#sm-end-sim{' +
    'width:100%;' +
    'max-width:360px;' +
    'box-sizing:border-box;' +
    'padding:7px 9px;' +
    'border:1px solid #bbb;' +
    'border-radius:5px;' +
    'background:#fff;' +
    'margin-top:8px;' +
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
    'width:100%;' +
    'height:min(68vh,760px);' +
    'min-height:500px;' +
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

  '#sm-run,#sm-save,#sm-download-csv,#sm-convert-notebook{' +
    'padding:8px 12px;' +
    'border:1px solid #bbb;' +
    'border-radius:6px;' +
    'background:#fff;' +
    'cursor:pointer;' +
  '}' +

  '#sm-run:disabled,#sm-save:disabled,#sm-download-csv:disabled,#sm-convert-notebook:disabled{' +
    'cursor:not-allowed;' +
    'opacity:0.65;' +
  '}' +

  '#sm-download-csv,#sm-convert-notebook{' +
    'background:#f7f7f7;' +
  '}' +

  '#sm-export-status{' +
    'font-size:14px;' +
    'margin:0;' +
    'color:#555;' +
  '}' +

  '.sm-model-grid{' +
    'display:grid;' +
    'grid-template-columns:repeat(2,minmax(220px,1fr));' +
    'gap:12px;' +
    'margin-top:12px;' +
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
    'margin-top:8px;' +
    'width:100%;' +
    'min-height:min(72vh, 820px);' +
    'height:min(72vh, 820px);' +
    'display:none;' +
    'box-sizing:border-box;' +
  '}' +

  '#sm-timeseries-plot{' +
    'margin-top:8px;' +
    'width:100%;' +
    'min-height:min(80vh, 920px);' +
    'height:min(80vh, 920px);' +
    'display:none;' +
    'box-sizing:border-box;' +
  '}' +

  '#sm-spatial-profile-plot,#sm-spatial-profile-mid-plot{' +
    'margin-top:8px;' +
    'width:100%;' +
    'min-height:min(80vh, 920px);' +
    'height:min(80vh, 920px);' +
    'display:none;' +
    'box-sizing:border-box;' +
  '}' +

  '.sm-plot-heading-row{' +
    'display:none;' +
    'align-items:center;' +
    'flex-wrap:wrap;' +
    'gap:12px;' +
    'margin:20px 0 0 0;' +
  '}' +

  '.sm-plot-heading-row.is-visible{' +
    'display:flex;' +
  '}' +

  '.sm-plot-heading{' +
    'display:none;' +
    'margin:20px 0 0 0;' +
    'font-size:18px;' +
    'font-weight:600;' +
  '}' +

  '.sm-plot-heading.is-visible{' +
    'display:block;' +
  '}' +

  '.sm-plot-heading-row .sm-plot-heading{' +
    'display:block;' +
    'margin:0;' +
  '}' +

  '#sm-molecule-gradient{' +
    'display:none;' +
  '}' +

  '#sm-molecule-gradient.is-visible{' +
    'display:inline-block;' +
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

  '#sm-add-reaction,#sm-add-species,#sm-add-shape,.sm-small-button{' +
    'padding:6px 12px;' +
    'border:1px solid #bbb;' +
    'border-radius:6px;' +
    'background:#fff;' +
    'cursor:pointer;' +
  '}' +

  '#sm-reaction-type{' +
    'width:100%;' +
    'box-sizing:border-box;' +
    'padding:7px 9px;' +
    'border:1px solid #bbb;' +
    'border-radius:5px;' +
    'background:#fff;' +
  '}' +

  '.sm-hint{' +
    'font-size:14px;' +
    'color:#555;' +
    'margin:6px 0 12px 0;' +
  '}' +

  '.sm-reaction-row{' +
    'display:grid;' +
    'grid-template-columns:minmax(140px,1fr) minmax(120px,auto) 34px 34px;' +
    'gap:10px;' +
    'align-items:center;' +
    'padding:7px 0;' +
    'border-bottom:1px solid #eee;' +
  '}' +

  '.sm-species-row-item{' +
    'display:grid;' +
    'grid-template-columns:minmax(140px,1fr) 34px 34px;' +
    'gap:10px;' +
    'align-items:center;' +
    'padding:7px 0;' +
    'border-bottom:1px solid #eee;' +
  '}' +

  '.sm-reaction-rate,.sm-species-initial-count{' +
    'font-size:13px;' +
    'color:#555;' +
  '}' +

  '.sm-reaction-empty,.sm-species-empty{' +
    'font-size:14px;' +
    'color:#777;' +
    'font-style:italic;' +
    'margin:6px 0 0 0;' +
  '}' +

  '#sm-add-reaction:disabled,#sm-add-species:disabled,#sm-add-shape:disabled,' +
  '.sm-remove-term:disabled{' +
    'opacity:0.6;' +
    'cursor:not-allowed;' +
  '}' +

  '#sm-species-error,#sm-reaction-error,#sm-shape-error{' +
    'color:#a40000;' +
    'font-size:14px;' +
    'min-height:20px;' +
    'margin:9px 0 0;' +
  '}' +

  '.sm-shape-meta,.sm-species-initial-count{' +
    'color:#666;' +
    'font-size:13px;' +
  '}' +

  '.sm-custom-form{' +
    'margin-top:14px;' +
    'padding:14px;' +
    'border:1px solid #d4d4d4;' +
    'border-radius:6px;' +
    'background:#fff;' +
  '}' +

  '.sm-custom-grid{' +
    'display:grid;' +
    'grid-template-columns:repeat(2,minmax(220px,1fr));' +
    'gap:12px;' +
  '}' +

  '.sm-custom-field label,.sm-stoich-side>label{' +
    'display:block;' +
    'font-weight:600;' +
    'margin-bottom:5px;' +
  '}' +

  '.sm-custom-field input,.sm-custom-field select,.sm-custom-field textarea,' +
  '.sm-stoich-row input,.sm-stoich-row select{' +
    'width:100%;' +
    'box-sizing:border-box;' +
    'padding:7px 9px;' +
    'border:1px solid #bbb;' +
    'border-radius:5px;' +
    'background:#fff;' +
    'color:inherit;' +
  '}' +

  '.sm-custom-field textarea{' +
    'font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;' +
    'font-size:13px;' +
    'resize:vertical;' +
    'min-height:72px;' +
    'line-height:1.35;' +
  '}' +

  '.sm-stoich-grid{' +
    'display:grid;' +
    'grid-template-columns:repeat(2,minmax(260px,1fr));' +
    'gap:18px;' +
    'margin-top:14px;' +
  '}' +

  '.sm-stoich-row{' +
    'display:grid;' +
    'grid-template-columns:minmax(120px,1fr) 110px 34px;' +
    'gap:7px;' +
    'align-items:end;' +
    'margin-bottom:8px;' +
  '}' +

  '.sm-stoich-heading{' +
    'display:grid;' +
    'grid-template-columns:minmax(120px,1fr) 110px 34px;' +
    'gap:7px;' +
    'font-size:12px;' +
    'color:#555;' +
    'margin-bottom:3px;' +
  '}' +

  '.sm-remove-term,.sm-edit-term{' +
    'width:34px;' +
    'height:34px;' +
    'padding:0;' +
    'border:1px solid #bbb;' +
    'border-radius:5px;' +
    'background:#fff;' +
    'cursor:pointer;' +
  '}' +

  '#sm-custom-error{' +
    'color:#a40000;' +
    'font-size:14px;' +
    'min-height:20px;' +
    'margin:9px 0 0;' +
  '}' +

  '#sm-custom-reactions p{' +
    'margin:8px 0;' +
  '}' +

  '@media(max-width:720px){' +
    '.sm-custom-grid,.sm-stoich-grid,.sm-model-grid{grid-template-columns:1fr;}' +
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
      '<h1>Spatial Model Creator</h1>' +

      '<div class="sm-panel">' +
        '<strong class="sm-panel-title">Model</strong>' +
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

      '<div class="sm-panel" id="sm-domain-panel">' +
        '<strong class="sm-panel-title">Domain</strong>' +

        '<div class="sm-subsection" id="sm-shapes-panel">' +
          '<strong>Domain Shape</strong>' +
          '<div class="sm-custom-field" style="margin-top:8px">' +
            '<label for="sm-domain-example">Domain Examples</label>' +
            '<select id="sm-domain-example">' +
              '<option value="">Custom</option>' +
            '</select>' +
          '</div>' +
          '<div class="sm-custom-field" style="margin-top:8px">' +
            '<label for="sm-arrangement">Arrangement</label>' +
            '<select id="sm-arrangement">' +
              '<option value="nested">Nested</option>' +
              '<option value="inline">End to end</option>' +
            '</select>' +
          '</div>' +
          '<p class="sm-hint" id="sm-lattice-status">' +
            'Name concentric spherical regions (for example Cytoplasm outside and Nucleus inside). ' +
            'The largest radius is filled as the outer domain; smaller radii re-tag nested regions. ' +
            'Choose Sphere or Cylinder when you add a shape.' +
          '</p>' +
          '<div id="sm-shape-list"></div>' +
          '<div class="sm-reaction-actions">' +
            '<button type="button" id="sm-add-shape">Add Shape</button>' +
          '</div>' +
          '<form id="sm-shape-form" class="sm-custom-form" style="display:none">' +
            '<strong id="sm-shape-form-title">New shape</strong>' +
            '<div class="sm-custom-field" style="margin-top:12px">' +
              '<label for="sm-shape-lattice">Domain Lattice</label>' +
              '<select id="sm-shape-lattice">' +
                '<option value="sphere">Sphere</option>' +
                '<option value="cylinder">Cylinder</option>' +
              '</select>' +
            '</div>' +
            '<div class="sm-custom-grid" style="margin-top:12px">' +
              '<div class="sm-custom-field">' +
                '<label for="sm-shape-name">Name</label>' +
                '<input id="sm-shape-name" type="text" placeholder="Nucleus" required />' +
              '</div>' +
              '<div class="sm-custom-field">' +
                '<label for="sm-shape-radius">Radius</label>' +
                '<select id="sm-shape-radius"></select>' +
              '</div>' +
            '</div>' +
            '<div class="sm-custom-field" id="sm-shape-length-wrap" style="margin-top:12px;display:none">' +
              '<label for="sm-shape-length">Length</label>' +
              '<select id="sm-shape-length">' +
                '<option value="1">1</option>' +
                '<option value="2" selected>2</option>' +
                '<option value="4">4</option>' +
              '</select>' +
            '</div>' +
            '<div class="sm-custom-field" id="sm-shape-formula-wrap" style="margin-top:12px">' +
              '<label for="sm-shape-formula-example">Formula</label>' +
              '<select id="sm-shape-formula-example"></select>' +
              '<textarea id="sm-shape-formula" rows="3" style="margin-top:8px" ' +
                'placeholder="(x*x)+(y*y)+(z*z) &lt; 1" ' +
                'spellcheck="false" required></textarea>' +
              '<p class="sm-hint" style="margin-top:6px">' +
                'Examples are written for radius 1 and rewritten for the selected radius.' +
              '</p>' +
            '</div>' +
            '<p id="sm-shape-error"></p>' +
            '<div class="sm-reaction-actions">' +
              '<button type="submit" id="sm-shape-submit" class="sm-small-button">Save Shape</button>' +
              '<button type="button" id="sm-cancel-shape" class="sm-small-button">Cancel</button>' +
            '</div>' +
          '</form>' +
        '</div>' +

        '<div class="sm-subsection" id="sm-density-panel">' +
          '<label for="sm-density"><strong>Particle Density</strong></label>' +
          '<p class="sm-hint">Controls spherical lattice spacing for the sphere domain.</p>' +
          '<br/>' +
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

        '<div class="sm-subsection" id="sm-species-panel">' +
          '<strong>Species</strong>' +
          '<p class="sm-hint">' +
            'Add the chemical species that reactions can use as reactants and products.' +
          '</p>' +
          '<div id="sm-species-list"></div>' +
          '<div class="sm-reaction-actions">' +
            '<button type="button" id="sm-add-species">Add Species</button>' +
          '</div>' +
          '<form id="sm-species-form" class="sm-custom-form" style="display:none">' +
            '<strong id="sm-species-form-title">New species</strong>' +
            '<div class="sm-custom-field" style="margin-top:12px">' +
              '<label for="sm-species-name">Name</label>' +
              '<input id="sm-species-name" type="text" placeholder="A" required />' +
            '</div>' +
            '<div class="sm-custom-field" style="margin-top:12px">' +
              '<label for="sm-species-shape">Assigned shape</label>' +
              '<select id="sm-species-shape"></select>' +
            '</div>' +
            '<div class="sm-custom-field" style="margin-top:12px">' +
              '<label for="sm-species-initial-count">Initial Molecules</label>' +
              '<input id="sm-species-initial-count" type="number" min="0" step="1" value="0" required />' +
            '</div>' +
            '<p id="sm-species-error"></p>' +
            '<div class="sm-reaction-actions">' +
              '<button type="submit" id="sm-species-submit" class="sm-small-button">Save Species</button>' +
              '<button type="button" id="sm-cancel-species" class="sm-small-button">Cancel</button>' +
            '</div>' +
          '</form>' +
        '</div>' +

        '<div class="sm-subsection" id="sm-reactions-panel">' +
          '<strong>Reactions</strong>' +
          '<p class="sm-hint">' +
            'Pick a reaction template, then set its species, stoichiometry, and rate constant.' +
          '</p>' +
          '<div id="sm-reaction-list"></div>' +
          '<div class="sm-reaction-actions">' +
            '<button type="button" id="sm-add-reaction">Add Reaction</button>' +
          '</div>' +
          '<form id="sm-reaction-form" class="sm-custom-form" style="display:none">' +
            '<strong id="sm-reaction-form-title">New reaction</strong>' +
            '<div id="sm-reaction-type-wrap" class="sm-custom-field" style="margin-top:12px">' +
              '<label for="sm-reaction-type">Reaction type</label>' +
              '<select id="sm-reaction-type"></select>' +
            '</div>' +
            '<div class="sm-custom-grid" style="margin-top:12px">' +
              '<div class="sm-custom-field">' +
                '<label for="sm-reaction-name">Name</label>' +
                '<input id="sm-reaction-name" type="text" placeholder="r1" required />' +
              '</div>' +
              '<div class="sm-custom-field">' +
                '<label for="sm-reaction-rate">Rate constant</label>' +
                '<input id="sm-reaction-rate" type="number" min="0" step="0.01" value="1" required />' +
              '</div>' +
            '</div>' +
            '<div class="sm-stoich-grid">' +
              '<div class="sm-stoich-side">' +
                '<label>Reactants</label>' +
                '<div class="sm-stoich-heading"><span>Species</span><span>Stoichiometry</span><span></span></div>' +
                '<div id="sm-reactant-rows"></div>' +
                '<button type="button" class="sm-small-button" data-add-term="reactant">Add reactant</button>' +
              '</div>' +
              '<div class="sm-stoich-side">' +
                '<label>Products</label>' +
                '<div class="sm-stoich-heading"><span>Species</span><span>Stoichiometry</span><span></span></div>' +
                '<div id="sm-product-rows"></div>' +
                '<button type="button" class="sm-small-button" data-add-term="product">Add product</button>' +
              '</div>' +
            '</div>' +
            '<p id="sm-reaction-error"></p>' +
            '<div class="sm-reaction-actions">' +
              '<button type="submit" id="sm-reaction-submit" class="sm-small-button">Save Reaction</button>' +
              '<button type="button" id="sm-cancel-reaction" class="sm-small-button">Cancel</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +

      '<div class="sm-panel sm-panel-plot">' +
        '<strong class="sm-panel-title">Model Preview</strong>' +
        '<div id="sm-domain-plot"></div>' +
        '<p id="sm-meta"></p>' +
      '</div>' +

      '<div class="sm-panel" id="sm-timespan-panel">' +
        '<label for="sm-end-sim"><strong>Simulation End Time</strong></label>' +
        '<p class="sm-hint">' +
          'How long the simulated clock runs. Enter any positive number (for example 20, 100, or 1000).' +
        '</p>' +
        '<input id="sm-end-sim" type="number" min="0.000001" step="any" value="20" required />' +
      '</div>' +

      '<div class="sm-panel">' +
        '<div class="sm-actions">' +
          '<button id="sm-run" type="button">Run Simulation</button>' +
          '<button id="sm-download-csv" type="button" disabled>Download Full CSV Results as .zip</button>' +
          '<button id="sm-convert-notebook" type="button" disabled>Convert to Notebook</button>' +
          '<p id="sm-run-status">Idle</p>' +
          '<p id="sm-export-status"></p>' +
        '</div>' +
      '</div>' +

      '<div class="sm-panel sm-panel-plot">' +
        '<div id="sm-species-wrap" class="sm-species-row">' +
        '<label for="sm-species"><strong>Simulation Type</strong></label> ' +
          '<select id="sm-species"></select>' +
        '</div>' +
        '<div id="sm-plot-heading-row" class="sm-plot-heading-row">' +
          '<h2 id="sm-plot-heading" class="sm-plot-heading">Reaction Simulation</h2>' +
          '<button id="sm-molecule-gradient" type="button" class="sm-small-button">Molecule Gradient: Off</button>' +
        '</div>' +
        '<div id="sm-plot"></div>' +
        '<h2 id="sm-timeseries-heading" class="sm-plot-heading">Species Over Time</h2>' +
        '<div id="sm-timeseries-plot"></div>' +
        '<h2 id="sm-spatial-profile-heading" class="sm-plot-heading">Molecule Population Along x-axis at Time = 0</h2>' +
        '<div id="sm-spatial-profile-plot"></div>' +
        '<h2 id="sm-spatial-profile-mid-heading" class="sm-plot-heading">Molecule Population Along x-axis (Summarized)</h2>' +
        '<div id="sm-spatial-profile-mid-plot"></div>' +
        '<pre id="sm-result"></pre>' +
      '</div>';

    document.body.appendChild(root);

    // elements
    var densityEl = document.getElementById('sm-density');
    var densityPanelEl = document.getElementById('sm-density-panel');
    var endSimEl = document.getElementById('sm-end-sim');
    var domainPlotEl = document.getElementById('sm-domain-plot');
    var metaEl = document.getElementById('sm-meta');
    var modelNameEl = document.getElementById('sm-model-name');
    var modelFolderEl = document.getElementById('sm-model-folder');
    var overwriteEl = document.getElementById('sm-overwrite');
    var saveBtnEl = document.getElementById('sm-save');
    var saveStatusEl = document.getElementById('sm-save-status');
    var runBtnEl = document.getElementById('sm-run');
    var runStatusEl = document.getElementById('sm-run-status');
    var downloadCsvBtnEl = document.getElementById('sm-download-csv');
    var convertNotebookBtnEl = document.getElementById('sm-convert-notebook');
    var exportStatusEl = document.getElementById('sm-export-status');
    var plotEl = document.getElementById('sm-plot');
    var plotHeadingRowEl = document.getElementById('sm-plot-heading-row');
    var plotHeadingEl = document.getElementById('sm-plot-heading');
    var moleculeGradientBtnEl = document.getElementById('sm-molecule-gradient');
    var moleculeGradientOn = false;
    var timeseriesPlotEl = document.getElementById('sm-timeseries-plot');
    var timeseriesHeadingEl = document.getElementById('sm-timeseries-heading');
    var spatialProfilePlotEl = document.getElementById('sm-spatial-profile-plot');
    var spatialProfileHeadingEl = document.getElementById('sm-spatial-profile-heading');
    var spatialProfileMidPlotEl = document.getElementById('sm-spatial-profile-mid-plot');
    var spatialProfileMidHeadingEl = document.getElementById('sm-spatial-profile-mid-heading');
    var resultEl = document.getElementById('sm-result');
    var addReactionBtn = document.getElementById('sm-add-reaction');
    var reactionTypeEl = document.getElementById('sm-reaction-type');
    var reactionListEl = document.getElementById('sm-reaction-list');
    var reactionFormEl = document.getElementById('sm-reaction-form');
    var reactionFormTitleEl = document.getElementById('sm-reaction-form-title');
    var reactionNameEl = document.getElementById('sm-reaction-name');
    var reactionRateEl = document.getElementById('sm-reaction-rate');
    var reactionErrorEl = document.getElementById('sm-reaction-error');
    var reactantRowsEl = document.getElementById('sm-reactant-rows');
    var productRowsEl = document.getElementById('sm-product-rows');
    var cancelReactionEl = document.getElementById('sm-cancel-reaction');
    var reactionSubmitBtn = document.getElementById('sm-reaction-submit');
    var reactionTypeWrapEl = document.getElementById('sm-reaction-type-wrap');
    var addSpeciesBtn = document.getElementById('sm-add-species');
    var speciesListEl = document.getElementById('sm-species-list');
    var speciesFormEl = document.getElementById('sm-species-form');
    var speciesFormTitleEl = document.getElementById('sm-species-form-title');
    var speciesNameEl = document.getElementById('sm-species-name');
    var speciesShapeEl = document.getElementById('sm-species-shape');
    var speciesInitialCountEl = document.getElementById('sm-species-initial-count');
    var speciesErrorEl = document.getElementById('sm-species-error');
    var cancelSpeciesEl = document.getElementById('sm-cancel-species');
    var speciesSubmitBtn = document.getElementById('sm-species-submit');
    var speciesEl = document.getElementById('sm-species');
    var shapeListEl = document.getElementById('sm-shape-list');
    var domainExampleEl = document.getElementById('sm-domain-example');
    var arrangementEl = document.getElementById('sm-arrangement');
    var shapeLatticeEl = document.getElementById('sm-shape-lattice');
    var latticeStatusEl = document.getElementById('sm-lattice-status');
    var addShapeBtn = document.getElementById('sm-add-shape');
    var shapeFormEl = document.getElementById('sm-shape-form');
    var shapeFormTitleEl = document.getElementById('sm-shape-form-title');
    var shapeNameEl = document.getElementById('sm-shape-name');
    var shapeRadiusEl = document.getElementById('sm-shape-radius');
    var shapeLengthWrapEl = document.getElementById('sm-shape-length-wrap');
    var shapeLengthEl = document.getElementById('sm-shape-length');
    var shapeFormulaWrapEl = document.getElementById('sm-shape-formula-wrap');
    var shapeFormulaExampleEl = document.getElementById('sm-shape-formula-example');
    var shapeFormulaEl = document.getElementById('sm-shape-formula');
    var shapeErrorEl = document.getElementById('sm-shape-error');
    var cancelShapeEl = document.getElementById('sm-cancel-shape');
    var shapeSubmitBtn = document.getElementById('sm-shape-submit');
    var shapeFormulaTouched = false;

    var cachedFigures = null;
    var lastRunSummary = null;
    var lastJobPath = null;
    var editorState = null;
    var structuredModel = null;
    var domainPreviewTimer = null;
    var domainPreviewRequest = 0;
    var savedPath = null;
    var savedModelKey = null;
    var editingReactionId = null;
    var editingSpeciesId = null;
    var editingShapeId = null;

    endSimEl.value = String(editorStateApi.defaultEndSim('sphere'));

    function renderShapeRadiusOptions(selectedValue) {
      shapeRadiusEl.innerHTML = '';
      var selected = Number(selectedValue);
      var hasSelected = false;
      editorStateApi.RADIUS_PRESETS.forEach(function (preset) {
        var option = document.createElement('option');
        option.value = String(preset.value);
        option.textContent = preset.label;
        option.selected = preset.value === selected;
        if (option.selected) {
          hasSelected = true;
        }
        shapeRadiusEl.appendChild(option);
      });
      if (Number.isFinite(selected) && !hasSelected) {
        var custom = document.createElement('option');
        custom.value = String(selected);
        custom.textContent = selected + ' (current)';
        custom.selected = true;
        shapeRadiusEl.appendChild(custom);
      }
    }

    function renderDomainExampleOptions() {
      editorStateApi.DOMAIN_EXAMPLES.forEach(function (example) {
        var option = document.createElement('option');
        option.value = example.id;
        option.textContent = example.label;
        domainExampleEl.appendChild(option);
      });
    }

    function markDomainExampleCustom() {
      if (domainExampleEl.value) {
        domainExampleEl.value = '';
      }
    }

    function renderReactionTypeOptions() {
      editorStateApi.REACTION_TEMPLATES.forEach(function (template) {
        var option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.label;
        reactionTypeEl.appendChild(option);
      });
    }

    var BOTH_SPECIES_VIEW = '__both__';
    var DIFFUSION_SIM = '__diffusion__';

    function getBothSpeciesNames() {
      return editorStateApi.listSpeciesNames(editorState).slice(0, 2);
    }

    function diffusionSpeciesNames() {
      return editorStateApi.listSpecies(editorState).filter(function (species) {
        return species.initialCount > 0;
      }).map(function (species) {
        return species.name;
      });
    }

    function figureKeyForSelection(selected) {
      if (selected === DIFFUSION_SIM) {
        return diffusionSpeciesNames()[0] || '';
      }
      return selected;
    }

    function renderSpeciesOptions() {
      var previous = speciesEl.value;
      var names = editorStateApi.listSpeciesNames(editorState);
      speciesEl.innerHTML = '';
      var diffusion = document.createElement('option');
      diffusion.value = DIFFUSION_SIM;
      diffusion.textContent = 'Diffusion';
      speciesEl.appendChild(diffusion);
      names.forEach(function (name) {
        var option = document.createElement('option');
        option.value = name;
        option.textContent = 'Species ' + name;
        speciesEl.appendChild(option);
      });
      if (getSelectedShape() === 'cylinder' && names.length >= 2) {
        var both = document.createElement('option');
        both.value = BOTH_SPECIES_VIEW;
        both.textContent = names[0] + ' + ' + names[1] + ' (both ends)';
        speciesEl.appendChild(both);
      }
      if (previous && Array.prototype.some.call(speciesEl.options, function (option) {
        return option.value === previous;
      })) {
        speciesEl.value = previous;
      } else {
        speciesEl.value = DIFFUSION_SIM;
      }
    }

    function syncMoleculeGradientButton(show) {
      moleculeGradientBtnEl.textContent = moleculeGradientOn
        ? 'Molecule Gradient: On'
        : 'Molecule Gradient: Off';
      if (show) {
        moleculeGradientBtnEl.classList.add('is-visible');
      } else {
        moleculeGradientBtnEl.classList.remove('is-visible');
      }
    }

    function showSelectedSpeciesFigure() {
      if (!cachedFigures) {
        return false;
      }
      var selected = speciesEl.value || DIFFUSION_SIM;
      var figureKey = figureKeyForSelection(selected);
      var diffusionView = selected === DIFFUSION_SIM;
      plotHeadingEl.textContent = diffusionView
        ? ('Diffusion of ' + figureKey)
        : 'Reaction Simulation';
      timeseriesHeadingEl.textContent = 'Species Over Time';
      syncMoleculeGradientButton(diffusionView);
      if (selected === BOTH_SPECIES_VIEW) {
        var names = getBothSpeciesNames();
        if (names.length < 2 || !cachedFigures[names[0]] || !cachedFigures[names[1]]) {
          runStatusEl.textContent =
            'Run Simulation to generate the combined both-ends view.';
          return false;
        }
        renderFigure(mergeSpeciesFigures(
          cachedFigures[names[0]],
          cachedFigures[names[1]],
          names[0],
          names[1]
        ), { combined: true });
      } else if (cachedFigures[figureKey]) {
        renderFigure(
          cachedFigures[figureKey],
          diffusionView ? { diffusion: true, gradient: moleculeGradientOn } : null
        );
      } else {
        runStatusEl.textContent = 'Run Simulation to generate the ' +
          (diffusionView ? 'Diffusion' : ('Species ' + selected)) + ' view.';
        return false;
      }
      if (lastRunSummary) {
        lastRunSummary.viewing_species = selected;
        resultEl.style.display = 'block';
        resultEl.textContent = JSON.stringify(lastRunSummary, null, 2);
      }
      return true;
    }

    function renderSpeciesList() {
      speciesListEl.innerHTML = '';
      var species = editorStateApi.listSpecies(editorState);

      if (species.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'sm-species-empty';
        empty.textContent = 'This model has no species yet.';
        speciesListEl.appendChild(empty);
        return;
      }

      species.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'sm-species-row-item';

        var summary = document.createElement('span');
        summary.textContent = item.name;
        var shapeLabel = document.createElement('span');
        shapeLabel.className = 'sm-species-initial-count';
        shapeLabel.textContent = compartmentNameForSpecies(item);
        summary.appendChild(document.createTextNode(' \u00b7 '));
        summary.appendChild(shapeLabel);
        if (item.initialCount > 0) {
          var initial = document.createElement('span');
          initial.className = 'sm-species-initial-count';
          initial.textContent = item.initialCount + ' molecules';
          summary.appendChild(document.createTextNode(' '));
          summary.appendChild(initial);
        }

        var edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'sm-edit-term';
        edit.textContent = '\u270E';
        edit.title = 'Edit ' + item.name;
        edit.setAttribute('data-edit-species', item.id);

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'sm-remove-term';
        remove.textContent = '\u00d7';
        remove.title = 'Remove ' + item.name;
        remove.setAttribute('data-remove-species', item.id);

        row.appendChild(summary);
        row.appendChild(edit);
        row.appendChild(remove);
        speciesListEl.appendChild(row);
      });
    }

    function compartmentNameForSpecies(species) {
      var compartment = editorState.compartments[species.compartmentId];
      return compartment ? compartment.name : 'Domain';
    }

    function fillSpeciesShapeOptions(selectedId) {
      speciesShapeEl.innerHTML = '';
      editorStateApi.listCompartments(editorState).forEach(function (compartment) {
        var option = document.createElement('option');
        option.value = String(compartment.id);
        option.textContent = compartment.name;
        option.selected = Number(selectedId) === compartment.id;
        speciesShapeEl.appendChild(option);
      });
    }

    function renderShapeList() {
      shapeListEl.innerHTML = '';
      var compartments = editorStateApi.listCompartments(editorState);
      if (compartments.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'sm-species-empty';
        empty.textContent = 'This model has no shapes yet.';
        shapeListEl.appendChild(empty);
        return;
      }

      var outerRadius = compartments.reduce(function (maxRadius, compartment) {
        var radius = Number(compartment.radius) || 0;
        return radius > maxRadius ? radius : maxRadius;
      }, 0);

      var layoutById = {};
      if (editorState.arrangement === 'inline') {
        editorStateApi.layoutInlineShapes(editorState).forEach(function (item) {
          layoutById[item.id] = item;
        });
      }

      compartments.forEach(function (compartment) {
        var row = document.createElement('div');
        row.className = 'sm-species-row-item';

        var summary = document.createElement('span');
        summary.textContent = compartment.name + ' ';
        var meta = document.createElement('span');
        meta.className = 'sm-shape-meta';
        var assignedSpecies = editorStateApi.speciesAssignedToCompartment(
          editorState,
          compartment.id
        );
        var particles = editorStateApi.particlesAssignedToCompartment(
          editorState,
          compartment.id
        );
        var placed = layoutById[compartment.id];
        var role = placed
          ? placed.role
          : (Number(compartment.radius) === outerRadius && compartments.length > 1
            ? 'outer'
            : compartments.length > 1
              ? 'nested'
              : 'domain');
        meta.textContent =
          'r=' + compartment.radius + ' \u00b7 ' + role + ' \u00b7 ' +
          assignedSpecies.length + ' species \u00b7 ' +
          particles + ' molecules assigned';
        if (placed && placed.lattice === 'cylinder') {
          meta.textContent += ' \u00b7 length=' + placed.length;
        }
        if (!placed && compartment.formula) {
          meta.textContent += ' \u00b7 ' + compartment.formula;
        }
        summary.appendChild(meta);

        var edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'sm-edit-term';
        edit.textContent = '\u270E';
        edit.title = 'Edit ' + compartment.name;
        edit.setAttribute('data-edit-shape', compartment.id);

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'sm-remove-term';
        remove.textContent = '\u00d7';
        remove.title = 'Remove ' + compartment.name;
        remove.setAttribute('data-remove-shape', compartment.id);
        remove.disabled = compartments.length <= 1;

        row.appendChild(summary);
        row.appendChild(edit);
        row.appendChild(remove);
        shapeListEl.appendChild(row);
      });
    }

    function renderFormulaExampleOptions(selectedId) {
      shapeFormulaExampleEl.innerHTML = '';
      editorStateApi.FORMULA_EXAMPLES.forEach(function (example) {
        var option = document.createElement('option');
        option.value = example.id;
        option.textContent = example.label;
        option.selected = example.id === selectedId;
        shapeFormulaExampleEl.appendChild(option);
      });
    }

    function applyFormulaExample() {
      var exampleId = shapeFormulaExampleEl.value;
      if (exampleId === 'custom') {
        shapeFormulaTouched = true;
        return;
      }
      var radius = Number(shapeRadiusEl.value);
      if (!Number.isFinite(radius) || radius <= 0) {
        return;
      }
      shapeFormulaTouched = false;
      shapeFormulaEl.value = editorStateApi.shapeFormulaForExample(exampleId, radius);
    }

    function syncShapeFormulaFromRadius() {
      if (shapeFormulaTouched || shapeFormulaExampleEl.value === 'custom') {
        return;
      }
      applyFormulaExample();
    }

    function syncFormulaExampleFromText() {
      var radius = Number(shapeRadiusEl.value);
      var match = editorStateApi.matchShapeFormulaExample(shapeFormulaEl.value, radius);
      if (match === 'custom') {
        shapeFormulaExampleEl.selectedIndex = -1;
        shapeFormulaTouched = true;
        return;
      }
      shapeFormulaExampleEl.value = match;
      shapeFormulaTouched = false;
    }

    function isInlineArrangement() {
      return editorState && editorState.arrangement === 'inline';
    }

    function syncShapeLatticeFields() {
      var cylinderPiece = isInlineArrangement() && shapeLatticeEl.value === 'cylinder';
      shapeLengthWrapEl.style.display = cylinderPiece ? '' : 'none';
      shapeFormulaWrapEl.style.display = cylinderPiece ? 'none' : '';
      shapeFormulaEl.required = !cylinderPiece;
    }

    function openShapeForm() {
      editingShapeId = null;
      shapeFormulaTouched = false;
      shapeFormTitleEl.textContent = 'New shape';
      shapeSubmitBtn.textContent = 'Save Shape';
      shapeLatticeEl.value = isInlineArrangement() ? 'sphere' : getSelectedShape();
      shapeLengthEl.value = '2';
      shapeNameEl.value = editorStateApi.suggestCompartmentName(editorState);
      renderShapeRadiusOptions(editorStateApi.suggestCompartmentRadius(editorState));
      renderFormulaExampleOptions('solid');
      syncShapeFormulaFromRadius();
      syncShapeLatticeFields();
      shapeErrorEl.textContent = '';
      shapeFormEl.style.display = '';
      shapeNameEl.focus();
      shapeNameEl.select();
    }

    function openShapeFormForEdit(shapeId) {
      var compartment = editorState.compartments[Number(shapeId)];
      if (!compartment) {
        return;
      }
      editingShapeId = compartment.id;
      shapeFormTitleEl.textContent = 'Edit shape: ' + compartment.name;
      shapeSubmitBtn.textContent = 'Update Shape';
      shapeLatticeEl.value = isInlineArrangement()
        ? (compartment.lattice === 'cylinder' ? 'cylinder' : 'sphere')
        : getSelectedShape();
      shapeLengthEl.value = String(compartment.length || 2);
      shapeNameEl.value = compartment.name;
      renderShapeRadiusOptions(compartment.radius);
      var radius = Number(compartment.radius) || 1;
      var defaultFormula = editorStateApi.sphereFormula(radius);
      shapeFormulaEl.value = compartment.formula || defaultFormula;
      var exampleMatch = editorStateApi.matchShapeFormulaExample(shapeFormulaEl.value, radius);
      renderFormulaExampleOptions(exampleMatch === 'custom' ? '' : exampleMatch);
      shapeFormulaTouched = exampleMatch === 'custom';
      syncShapeLatticeFields();
      shapeErrorEl.textContent = '';
      shapeFormEl.style.display = '';
      shapeNameEl.focus();
    }

    function closeShapeForm() {
      shapeFormEl.style.display = 'none';
      shapeErrorEl.textContent = '';
      editingShapeId = null;
      shapeFormulaTouched = false;
      shapeSubmitBtn.textContent = 'Save Shape';
    }

    function openSpeciesForm() {
      editingSpeciesId = null;
      speciesFormTitleEl.textContent = 'New species';
      speciesSubmitBtn.textContent = 'Save Species';
      speciesNameEl.value = editorStateApi.suggestSpeciesName(editorState);
      fillSpeciesShapeOptions(editorStateApi.listCompartments(editorState)[0].id);
      speciesInitialCountEl.value = '0';
      speciesErrorEl.textContent = '';
      speciesFormEl.style.display = '';
      speciesNameEl.focus();
      speciesNameEl.select();
    }

    function openSpeciesFormForEdit(speciesId) {
      var species = editorState.species[Number(speciesId)];
      if (!species) {
        return;
      }

      editingSpeciesId = species.id;
      speciesFormTitleEl.textContent = 'Edit species: ' + species.name;
      speciesSubmitBtn.textContent = 'Update Species';
      speciesNameEl.value = species.name;
      fillSpeciesShapeOptions(species.compartmentId);
      speciesInitialCountEl.value = String(species.initialCount || 0);
      speciesErrorEl.textContent = '';
      speciesFormEl.style.display = '';
      speciesNameEl.focus();
    }

    function closeSpeciesForm() {
      speciesFormEl.style.display = 'none';
      speciesErrorEl.textContent = '';
      editingSpeciesId = null;
      speciesSubmitBtn.textContent = 'Save Species';
    }

    function markUnsaved() {
      savedPath = null;
      savedModelKey = null;
      saveStatusEl.textContent = 'Not saved.';
    }

    function getSpeciesRecords() {
      return Object.keys(editorState.species)
        .map(Number)
        .sort(function (a, b) { return a - b; })
        .map(function (id) { return editorState.species[id]; });
    }

    function appendStoichRow(container, selectedSpeciesId, selectedRatio) {
      var row = document.createElement('div');
      row.className = 'sm-stoich-row';

      var select = document.createElement('select');
      select.setAttribute('aria-label', 'Species');
      getSpeciesRecords().forEach(function (species) {
        var option = document.createElement('option');
        option.value = species.id;
        option.textContent = species.name;
        option.selected = species.id === selectedSpeciesId;
        select.appendChild(option);
      });

      var ratio = document.createElement('input');
      ratio.type = 'number';
      ratio.min = '1';
      ratio.step = '1';
      ratio.value = String(selectedRatio || 1);
      ratio.setAttribute('aria-label', 'Stoichiometry');

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'sm-remove-term';
      remove.textContent = '\u00d7';
      remove.title = 'Remove term';
      remove.addEventListener('click', function () {
        row.remove();
      });

      row.appendChild(select);
      row.appendChild(ratio);
      row.appendChild(remove);
      container.appendChild(row);
    }

    function readStoichRows(container) {
      return Array.prototype.map.call(
        container.querySelectorAll('.sm-stoich-row'),
        function (row) {
          return {
            speciesId: Number(row.querySelector('select').value),
            ratio: Number(row.querySelector('input').value)
          };
        }
      );
    }

    function renderReactionList() {
      reactionListEl.innerHTML = '';
      var reactions = editorStateApi.listReactions(editorState);

      if (reactions.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'sm-reaction-empty';
        empty.textContent = 'This model has no reactions yet.';
        reactionListEl.appendChild(empty);
        return;
      }

      reactions.forEach(function (reaction) {
        var row = document.createElement('div');
        row.className = 'sm-reaction-row';

        var summary = document.createElement('span');
        summary.textContent = editorStateApi.formatReaction(editorState, reaction);

        var rate = document.createElement('span');
        rate.className = 'sm-reaction-rate';
        var rateParameter = editorState.parameters[reaction.rateParameterId];
        rate.textContent = 'rate ' + rateParameter.name + ' = ' + rateParameter.expression;

        var edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'sm-edit-term';
        edit.textContent = '\u270E';
        edit.title = 'Edit ' + reaction.name;
        edit.setAttribute('data-edit-reaction', reaction.id);

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'sm-remove-term';
        remove.textContent = '\u00d7';
        remove.title = 'Remove ' + reaction.name;
        remove.setAttribute('data-remove-reaction', reaction.id);

        row.appendChild(summary);
        row.appendChild(rate);
        row.appendChild(edit);
        row.appendChild(remove);
        reactionListEl.appendChild(row);
      });
    }

    function applyReactionTemplate(templateId, options) {
      var config = options || {};
      var template = editorStateApi.getReactionTemplate(templateId);
      var terms = editorStateApi.buildTemplateTerms(editorState, templateId);

      reactionFormTitleEl.textContent = 'New reaction: ' + template.label;
      if (config.resetName !== false) {
        reactionNameEl.value = editorStateApi.suggestReactionName(editorState);
      }
      if (config.resetRate !== false) {
        reactionRateEl.value = String(
          editorStateApi.defaultReactionRate(editorState, templateId)
        );
      }
      reactionErrorEl.textContent = '';
      reactantRowsEl.innerHTML = '';
      productRowsEl.innerHTML = '';
      terms.reactants.forEach(function (term) {
        appendStoichRow(reactantRowsEl, term.speciesId, term.ratio);
      });
      terms.products.forEach(function (term) {
        appendStoichRow(productRowsEl, term.speciesId, term.ratio);
      });
    }

    function openReactionForm(templateId) {
      if (editorStateApi.listSpecies(editorState).length === 0) {
        reactionErrorEl.textContent = 'Add at least one species before creating a reaction.';
        reactionFormEl.style.display = '';
        return;
      }
      editingReactionId = null;
      reactionTypeWrapEl.style.display = '';
      reactionSubmitBtn.textContent = 'Save Reaction';
      var template = templateId || reactionTypeEl.value || 'creation';
      reactionTypeEl.value = template;
      applyReactionTemplate(template, { resetName: true, resetRate: true });
      reactionFormEl.style.display = '';
      reactionNameEl.focus();
    }

    function openReactionFormForEdit(reactionId) {
      var reaction = editorState.reactions[Number(reactionId)];
      if (!reaction) {
        return;
      }
      var rate = editorState.parameters[reaction.rateParameterId];

      editingReactionId = reaction.id;
      reactionFormTitleEl.textContent = 'Edit reaction: ' + reaction.name;
      reactionTypeWrapEl.style.display = 'none';
      reactionSubmitBtn.textContent = 'Update Reaction';
      reactionNameEl.value = reaction.name;
      reactionRateEl.value = String(rate.expression);
      reactionErrorEl.textContent = '';
      reactantRowsEl.innerHTML = '';
      productRowsEl.innerHTML = '';
      reaction.reactants.forEach(function (term) {
        appendStoichRow(reactantRowsEl, term.speciesId, term.ratio);
      });
      reaction.products.forEach(function (term) {
        appendStoichRow(productRowsEl, term.speciesId, term.ratio);
      });
      reactionFormEl.style.display = '';
      reactionNameEl.focus();
    }

    function closeReactionForm() {
      reactionFormEl.style.display = 'none';
      reactionErrorEl.textContent = '';
      editingReactionId = null;
      reactionTypeWrapEl.style.display = '';
      reactionSubmitBtn.textContent = 'Save Reaction';
    }

    function syncSpeciesUi() {
      renderShapeList();
      renderSpeciesList();
      renderSpeciesOptions();
      addReactionBtn.disabled = editorStateApi.listSpecies(editorState).length === 0;
    }

    function syncReactionUi() {
      renderReactionList();

      var hasReactions = editorState.reactionOrder.length > 0;
      var diffusionSelected = speciesEl.value === DIFFUSION_SIM || speciesEl.value === '';
      var diffusionReady = diffusionSpeciesNames().length > 0;
      runBtnEl.disabled = diffusionSelected ? !diffusionReady : !hasReactions;
      if (diffusionSelected && !diffusionReady) {
        runStatusEl.textContent =
          'Add a species, assign it to a shape, and set an initial particle count to run Diffusion.';
      } else if (!diffusionSelected && !hasReactions) {
        runStatusEl.textContent = 'Add a reaction to run a species simulation, or choose Diffusion.';
      } else if (
        runStatusEl.textContent === 'Add a reaction to run a simulation.' ||
        runStatusEl.textContent === 'Add a reaction to run a species simulation, or choose Diffusion.' ||
        runStatusEl.textContent ===
          'Add a species, assign it to a shape, and set an initial particle count to run Diffusion.'
      ) {
        runStatusEl.textContent = 'Idle';
      }
    }

    // Update structured state and request its SpatialPy domain preview.
    function draw() {
      var shape = getSelectedShape();
      var densityLevel = getDensityLevel();

      densityPanelEl.style.display = shape === 'cylinder' ? 'none' : '';
      if (arrangementEl && arrangementEl.value !== (editorState.arrangement || 'nested')) {
        arrangementEl.value = editorState.arrangement === 'inline' ? 'inline' : 'nested';
      }
      if (latticeStatusEl) {
        latticeStatusEl.textContent = editorState.arrangement === 'inline'
          ? 'End to end: each shape is filled on its own and placed along X beside the previous one. ' +
            'A half-sphere added first becomes the left cap and one added last becomes the right cap. ' +
            'Shapes overlap by one particle spacing. Use the same radius for the caps and the cylinder.'
          : (shape === 'cylinder'
            ? 'Cylinder lattice. Add or edit a shape to switch back to Sphere.'
            : 'Sphere lattice. Name concentric regions (for example Cytoplasm outside and Nucleus inside). ' +
              'The largest radius is filled as the outer domain; smaller radii re-tag nested regions. ' +
              'Add or edit a shape to switch the lattice to Cylinder.');
      }
      if (String(editorState.endSim) !== endSimEl.value) {
        endSimEl.value = String(editorState.endSim);
      }

      refreshStructuredModel();
      syncSpeciesUi();
      syncReactionUi();
      scheduleDomainPreview(structuredModel.domain, densityLevel);
    }

    densityEl.addEventListener('input', function () {
      markUnsaved();
      draw();
    });

    endSimEl.addEventListener('change', function () {
      try {
        editorStateApi.setEndSim(editorState, endSimEl.value);
        endSimEl.value = String(editorState.endSim);
        markUnsaved();
        draw();
      } catch (err) {
        endSimEl.value = String(editorState.endSim);
        runStatusEl.textContent = err.message;
      }
    });

    shapeLatticeEl.addEventListener('change', function () {
      if (isInlineArrangement()) {
        syncShapeLatticeFields();
        return;
      }
      applyDomainLattice(shapeLatticeEl.value);
    });

    arrangementEl.addEventListener('change', function () {
      markDomainExampleCustom();
      editorStateApi.setArrangement(editorState, arrangementEl.value);
      syncShapeLatticeFields();
      cachedFigures = null;
      clearSpatialProfileFigure();
      markUnsaved();
      draw();
    });

    domainExampleEl.addEventListener('change', function () {
      if (!domainExampleEl.value) {
        return;
      }
      try {
        closeShapeForm();
        editorStateApi.applyDomainExample(editorState, domainExampleEl.value);
        cachedFigures = null;
        clearSpatialProfileFigure();
        markUnsaved();
        draw();
      } catch (err) {
        domainExampleEl.value = '';
        shapeErrorEl.textContent = err.message;
        shapeFormEl.style.display = '';
      }
    });

    [modelNameEl, modelFolderEl].forEach(function (input) {
      input.addEventListener('input', markUnsaved);
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

    addSpeciesBtn.addEventListener('click', openSpeciesForm);
    cancelSpeciesEl.addEventListener('click', closeSpeciesForm);
    addShapeBtn.addEventListener('click', openShapeForm);
    cancelShapeEl.addEventListener('click', closeShapeForm);
    shapeRadiusEl.addEventListener('change', syncShapeFormulaFromRadius);
    shapeFormulaExampleEl.addEventListener('change', applyFormulaExample);
    shapeFormulaEl.addEventListener('input', syncFormulaExampleFromText);

    shapeListEl.addEventListener('click', function (event) {
      var editId = event.target.getAttribute('data-edit-shape');
      if (editId) {
        openShapeFormForEdit(editId);
        return;
      }
      var shapeId = event.target.getAttribute('data-remove-shape');
      if (!shapeId) {
        return;
      }
      if (editingShapeId === Number(shapeId)) {
        closeShapeForm();
      }
      try {
        editorStateApi.removeCompartment(editorState, shapeId);
        markDomainExampleCustom();
        markUnsaved();
        draw();
      } catch (err) {
        shapeErrorEl.textContent = err.message;
        shapeFormEl.style.display = '';
      }
    });

    shapeFormEl.addEventListener('submit', function (event) {
      event.preventDefault();
      try {
        if (!isInlineArrangement()) {
          applyDomainLattice(shapeLatticeEl.value);
        }
        var shapePayload = {
          name: shapeNameEl.value,
          radius: shapeRadiusEl.value,
          formula: isInlineArrangement() && shapeLatticeEl.value === 'cylinder'
            ? editorStateApi.sphereFormula(Number(shapeRadiusEl.value) || 1)
            : shapeFormulaEl.value,
          lattice: isInlineArrangement() ? shapeLatticeEl.value : 'sphere',
          length: shapeLengthEl.value
        };
        if (editingShapeId !== null) {
          editorStateApi.updateCompartment(editorState, editingShapeId, shapePayload);
        } else {
          editorStateApi.addCompartment(editorState, shapePayload);
        }
        closeShapeForm();
        markDomainExampleCustom();
        markUnsaved();
        draw();
      } catch (err) {
        shapeErrorEl.textContent = err.message;
      }
    });

    speciesListEl.addEventListener('click', function (event) {
      var editId = event.target.getAttribute('data-edit-species');
      if (editId) {
        openSpeciesFormForEdit(editId);
        return;
      }
      var speciesId = event.target.getAttribute('data-remove-species');
      if (!speciesId) {
        return;
      }
      if (editingSpeciesId === Number(speciesId)) {
        closeSpeciesForm();
      }
      try {
        editorStateApi.removeSpecies(editorState, speciesId);
        cachedFigures = null;
        markUnsaved();
        draw();
      } catch (err) {
        speciesErrorEl.textContent = err.message;
        speciesFormEl.style.display = '';
      }
    });

    speciesFormEl.addEventListener('submit', function (event) {
      event.preventDefault();
      try {
        var payload = {
          name: speciesNameEl.value,
          initialCount: speciesInitialCountEl.value,
          compartmentId: speciesShapeEl.value
        };
        if (editingSpeciesId !== null) {
          editorStateApi.updateSpecies(editorState, editingSpeciesId, payload);
        } else {
          editorStateApi.addSpecies(editorState, payload);
        }
        cachedFigures = null;
        markUnsaved();
        closeSpeciesForm();
        draw();
      } catch (err) {
        speciesErrorEl.textContent = err.message;
      }
    });

    addReactionBtn.addEventListener('click', function () {
      openReactionForm(reactionTypeEl.value);
    });

    reactionTypeEl.addEventListener('change', function () {
      if (editingReactionId !== null) {
        return;
      }
      applyReactionTemplate(reactionTypeEl.value, {
        resetName: false,
        resetRate: false
      });
    });

    reactionListEl.addEventListener('click', function (event) {
      var editId = event.target.getAttribute('data-edit-reaction');
      if (editId) {
        openReactionFormForEdit(editId);
        return;
      }
      var reactionId = event.target.getAttribute('data-remove-reaction');
      if (!reactionId) {
        return;
      }
      if (editingReactionId === Number(reactionId)) {
        closeReactionForm();
      }
      editorStateApi.removeReaction(editorState, reactionId);
      // Changing the reaction set invalidates previous cached figures.
      cachedFigures = null;
      markUnsaved();
      refreshStructuredModel();
      syncReactionUi();
    });

    reactionFormEl.addEventListener('click', function (event) {
      var side = event.target.getAttribute('data-add-term');
      if (side === 'reactant') {
        appendStoichRow(reactantRowsEl, getSpeciesRecords()[0].id, 1);
      } else if (side === 'product') {
        appendStoichRow(productRowsEl, getSpeciesRecords()[0].id, 1);
      }
    });

    cancelReactionEl.addEventListener('click', closeReactionForm);

    reactionFormEl.addEventListener('submit', function (event) {
      event.preventDefault();
      try {
        var payload = {
          name: reactionNameEl.value,
          rateExpression: reactionRateEl.value,
          reactants: readStoichRows(reactantRowsEl),
          products: readStoichRows(productRowsEl)
        };
        if (editingReactionId !== null) {
          editorStateApi.updateReaction(editorState, editingReactionId, payload);
        } else {
          editorStateApi.addReaction(editorState, payload);
        }
        cachedFigures = null;
        markUnsaved();
        refreshStructuredModel();
        syncReactionUi();
        closeReactionForm();
      } catch (err) {
        reactionErrorEl.textContent = err.message;
      }
    });

    speciesEl.addEventListener('change', function () {
      syncReactionUi();
      showSelectedSpeciesFigure();
    });

    // slider value -> density level
    function getDensityLevel() {

      var value = parseInt(densityEl.value, 10);

      if (value === 0) return 'low';
      if (value === 1) return 'medium';

      return 'high';
    }

    function getSelectedShape() {
      return editorState && editorState.shape === 'cylinder' ? 'cylinder' : 'sphere';
    }

    function applyDomainLattice(shape) {
      var nextShape = shape === 'cylinder' ? 'cylinder' : 'sphere';
      if (nextShape === getSelectedShape()) {
        return;
      }
      if (nextShape === 'cylinder' && Number(editorState.endSim) === 20) {
        editorStateApi.setEndSim(editorState, 100);
        endSimEl.value = '100';
      } else if (nextShape === 'sphere' && Number(editorState.endSim) === 100) {
        editorStateApi.setEndSim(editorState, 20);
        endSimEl.value = '20';
      }
      editorStateApi.setShape(editorState, nextShape);
      cachedFigures = null;
      clearSpatialProfileFigure();
      markUnsaved();
      draw();
    }

    function formatShapeLabel(shape) {
      return shape === 'cylinder' ? 'Cylinder' : 'Sphere';
    }

    function refreshStructuredModel() {
      editorStateApi.setDensity(editorState, getDensityLevel());
      editorStateApi.setShape(editorState, getSelectedShape());
      editorStateApi.setEndSim(editorState, endSimEl.value);
      structuredModel = editorStateApi.toSmdl(editorState);
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
      if (getSelectedShape() === 'cylinder') {
        metaEl.textContent = 'Generating cylinder domain from legacy mesh...';
      } else {
        metaEl.textContent = 'Generating ' + densityLevel + ' density domain...';
      }

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
          throw new Error(data.Message || data.message || 'Failed to generate model preview.');
        }

        renderDomainFigure(data.fig);
        var particleCount = Array.isArray(domain.particles)
          ? domain.particles.length
          : (Array.isArray(data.particles) ? data.particles.length : 0);
        if (getSelectedShape() === 'cylinder') {
          metaEl.textContent =
            'Cylinder  \u00b7 ' + particleCount + ' particles';
        } else {
          metaEl.textContent =
            formatShapeLabel(getSelectedShape()) + ' (' + densityLevel + ' density) \u00b7 ' +
            particleCount + ' particles';
        }
      } catch (err) {
        if (requestID !== domainPreviewRequest) {
          return;
        }
        Plotly.purge(domainPlotEl);
        domainPlotEl.innerHTML = '';
        metaEl.textContent = 'Model preview failed: ' + err.message;
      }
    }

    function ensureResizeListener() {
      if (!resizeBound) {
        resizeBound = true;
        window.addEventListener('resize', function () {
          [domainPlotEl, plotEl, timeseriesPlotEl, spatialProfilePlotEl, spatialProfileMidPlotEl].forEach(function (element) {
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

    function renderFigure(figure, options) {
      if (!figure || !figure.data || !figure.layout) {
        plotHeadingRowEl.classList.remove('is-visible');
        plotEl.style.display = 'none';
        return;
      }
      plotHeadingRowEl.classList.add('is-visible');
      plotEl.style.display = 'block';
      Plotly.purge(plotEl);
      plotEl.innerHTML = '';
      var tuned;
      if (options && options.combined) {
        tuned = figure;
      } else if (options && options.diffusion && options.gradient) {
        tuned = tuneDiffusionPlotColors(figure);
      } else if (options && options.diffusion) {
        // Dark pink = empty, bright light pink = containing (same endpoints as the gradient).
        tuned = tuneSpeciesPlotColors(figure, {
          empty: '#9a18b0',
          filled: '#ffc2f0'
        });
      } else {
        tuned = tuneSpeciesPlotColors(figure);
      }
      var fig = {
        data: tuned.data,
        layout: tunePlotlyLayout(tuned.layout),
        frames: tuned.frames,
        config: Object.assign(
          { responsive: true, scrollZoom: true, displayModeBar: true },
          tuned.config || {}
        )
      };
      Plotly.newPlot(plotEl, fig).then(function (gd) {
        Plotly.Plots.resize(gd);
      });
      ensureResizeListener();
    }

    function mergeSpeciesFigures(figureA, figureB, nameA, nameB) {
      var tunedA = tuneSpeciesPlotColors(figureA, {
        empty: '#fec3fe',
        filled: '#dd2bfd',
        label: nameA
      });
      var tunedB = tuneSpeciesPlotColors(figureB, {
        empty: '#c6dbef',
        filled: '#2171b5',
        label: nameB
      });

      var EMPTY_COLOR = '#f2d7ee';
      var COLOR_A = '#dd2bfd';
      var COLOR_B = '#2171b5';
      var COLOR_BOTH = '#7a3db8';

      function asColorList(value, length) {
        if (Array.isArray(value)) {
          return value;
        }
        var list = [];
        var index;
        for (index = 0; index < length; index += 1) {
          list.push(value);
        }
        return list;
      }

      function occupancyColors(colorsA, colorsB, pointCount) {
        var listA = asColorList(colorsA, pointCount);
        var listB = asColorList(colorsB, pointCount);
        var mergedColors = [];
        var index;
        for (index = 0; index < pointCount; index += 1) {
          var hasA = Number(listA[index]) > 0;
          var hasB = Number(listB[index]) > 0;
          if (hasA && hasB) {
            mergedColors.push(COLOR_BOTH);
          } else if (hasA) {
            mergedColors.push(COLOR_A);
          } else if (hasB) {
            mergedColors.push(COLOR_B);
          } else {
            mergedColors.push(EMPTY_COLOR);
          }
        }
        return mergedColors;
      }

      function legendTrace(color, label) {
        return {
          type: 'scatter3d',
          mode: 'markers',
          name: label,
          x: [null],
          y: [null],
          z: [null],
          marker: { size: 8, color: color },
          showlegend: true,
          hoverinfo: 'skip'
        };
      }

      function combineTracePair(traceA, traceB) {
        var base = JSON.parse(JSON.stringify(traceA || {}));
        var pointCount = Array.isArray(base.x) ? base.x.length : 0;
        if (!base.marker) {
          base.marker = {};
        }
        var colorsA = traceA && traceA.marker ? traceA.marker.color : 0;
        var colorsB = traceB && traceB.marker ? traceB.marker.color : 0;
        base.marker.color = occupancyColors(colorsA, colorsB, pointCount);
        base.marker.size = base.marker.size || 5;
        delete base.marker.colorscale;
        delete base.marker.colorbar;
        delete base.marker.cmin;
        delete base.marker.cmax;
        delete base.marker.opacity;
        base.name = nameA + ' + ' + nameB;
        base.showlegend = false;
        base.type = base.type || 'scatter3d';
        base.mode = base.mode || 'markers';
        return base;
      }

      function buildFrameData(tracesA, tracesB) {
        var primaryA = (tracesA || [])[0];
        var primaryB = (tracesB || [])[0];
        if (!primaryA) {
          return [
            legendTrace(EMPTY_COLOR, 'unfilled'),
            legendTrace(COLOR_A, nameA),
            legendTrace(COLOR_B, nameB)
          ];
        }
        return [
          combineTracePair(primaryA, primaryB),
          legendTrace(EMPTY_COLOR, 'unfilled'),
          legendTrace(COLOR_A, nameA),
          legendTrace(COLOR_B, nameB)
        ];
      }

      var merged = JSON.parse(JSON.stringify(tunedA));
      merged.data = buildFrameData(tunedA.data, tunedB.data);
      var framesA = tunedA.frames || [];
      var framesB = tunedB.frames || [];
      var frameCount = Math.min(framesA.length, framesB.length);
      merged.frames = [];
      var index;
      for (index = 0; index < frameCount; index += 1) {
        merged.frames.push({
          name: framesA[index].name,
          data: buildFrameData(framesA[index].data, framesB[index].data)
        });
      }
      if (merged.layout) {
        merged.layout.showlegend = true;
      }
      return merged;
    }

    // Continuous pink scale by molecule count. Plotly colorscale stops are always
    // fractions 0–1 of the mapped range (not molecule counts). Counts are shown
    // on the colorbar; colors use a log stretch so hundreds/thousands stay distinct.
    function tuneDiffusionPlotColors(figure) {
      var fig = JSON.parse(JSON.stringify(figure));
      var COLORSCALE = [
        [0, '#7f1492'],
        [0.25, '#d358e8'],
        [0.5, '#e9acf4'],
        [0.75, '#fcf4fe'],
        [1, '#fcf3fd']
      ];

      function maxColorValue(colorValues) {
        if (!Array.isArray(colorValues)) {
          var single = Number(colorValues);
          return Number.isFinite(single) ? single : 0;
        }
        var max = 0;
        colorValues.forEach(function (value) {
          var number = Number(value);
          if (Number.isFinite(number) && number > max) {
            max = number;
          }
        });
        return max;
      }

      function log1p(value) {
        return Math.log(1 + Math.max(0, Number(value) || 0));
      }

      function moleculeColorbarTicks(maxCount) {
        var roundedMax = Math.max(1, Math.round(maxCount));
        var candidates;
        if (roundedMax >= 1000) {
          candidates = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
        } else if (roundedMax >= 100) {
          candidates = [10, 25, 50, 100, 250, 500, 750];
        } else if (roundedMax >= 20) {
          candidates = [5, 10, 15, 20, 25, 50, 75];
        } else {
          candidates = [];
          var step;
          for (step = 1; step < roundedMax; step += 1) {
            candidates.push(step);
          }
        }
        var ticks = [0];
        candidates.forEach(function (value) {
          if (value > 0 && value < roundedMax) {
            ticks.push(value);
          }
        });
        if (ticks[ticks.length - 1] !== roundedMax) {
          ticks.push(roundedMax);
        }
        if (ticks.length <= 6) {
          return ticks;
        }
        var kept = [ticks[0]];
        var stride = Math.ceil((ticks.length - 2) / 4);
        var index;
        for (index = stride; index < ticks.length - 1; index += stride) {
          kept.push(ticks[index]);
        }
        kept.push(ticks[ticks.length - 1]);
        return kept;
      }

      function remapColorsToLog(colorValues) {
        if (!Array.isArray(colorValues)) {
          return log1p(colorValues);
        }
        return colorValues.map(log1p);
      }

      var cmax = 0;
      function scanTraces(traces) {
        (traces || []).forEach(function (trace) {
          if (!trace || !trace.marker) {
            return;
          }
          cmax = Math.max(cmax, maxColorValue(trace.marker.color));
        });
      }
      scanTraces(fig.data);
      (fig.frames || []).forEach(function (frame) {
        scanTraces(frame.data);
      });
      if (cmax <= 0) {
        cmax = 1;
      }

      var logMax = log1p(cmax);
      var tickMolecules = moleculeColorbarTicks(cmax);
      var tickVals = tickMolecules.map(log1p);
      var tickText = tickMolecules.map(String);

      function applyScale(traces) {
        (traces || []).forEach(function (trace) {
          if (!trace || !trace.marker) {
            return;
          }
          if (trace.marker.colorscale == null && !Array.isArray(trace.marker.color)) {
            return;
          }
          trace.marker.color = remapColorsToLog(trace.marker.color);
          trace.marker.colorscale = COLORSCALE;
          trace.marker.cmin = 0;
          trace.marker.cmax = logMax;
          trace.marker.reversescale = false;
          if (!trace.marker.colorbar) {
            trace.marker.colorbar = {};
          }
          trace.marker.colorbar.title = 'Molecules';
          trace.marker.colorbar.thickness = 20;
          trace.marker.colorbar.tickmode = 'array';
          trace.marker.colorbar.tickvals = tickVals;
          trace.marker.colorbar.ticktext = tickText;
        });
      }

      applyScale(fig.data);
      (fig.frames || []).forEach(function (frame) {
        applyScale(frame.data);
      });
      return fig;
    }

    // SpatialPy defaults to continuous Plotly3 (blue → magenta → pale pink).
    // Match the old creator's empty-vs-filled look with two discrete pinks only.
    function tuneSpeciesPlotColors(figure, palette) {
      var fig = JSON.parse(JSON.stringify(figure));
      var colors = palette || {};

      var EMPTY_COLOR = colors.empty || '#fec3fe'; // Plotly3 pale pink = not filled
      var FILLED_COLOR = colors.filled || '#dd2bfd'; // Plotly3 magenta = filled

      // Continuous scale for the side colorbar gradient. Particle counts are
      // binarized to 0/1 below, so markers still only use the two endpoints.
      var COLORBAR_GRADIENT_SCALE = [
        [0, EMPTY_COLOR],
        [1, FILLED_COLOR]
      ];

      function binarizeColors(colorValues) {
        if (!Array.isArray(colorValues)) {
          return Number(colorValues) > 0 ? 1 : 0;
        }
        return colorValues.map(function (value) {
          return Number(value) > 0 ? 1 : 0;
        });
      }

      function applyDiscreteFillColors(traces) {
        (traces || []).forEach(function (trace) {
          if (!trace || !trace.marker) {
            return;
          }
          if (trace.marker.colorscale == null && !Array.isArray(trace.marker.color)) {
            return;
          }
          trace.marker.color = binarizeColors(trace.marker.color);
          trace.marker.colorscale = COLORBAR_GRADIENT_SCALE;
          trace.marker.cmin = 0;
          trace.marker.cmax = 1;
          trace.marker.reversescale = false;
          if (colors.label) {
            trace.name = colors.label;
            if (!trace.marker.colorbar) {
              trace.marker.colorbar = {};
            }
            trace.marker.colorbar.title = colors.label;
          }
          if (colors.colorbarX != null) {
            if (!trace.marker.colorbar) {
              trace.marker.colorbar = {};
            }
            trace.marker.colorbar.x = colors.colorbarX;
          }
        });
      }

      applyDiscreteFillColors(fig.data);
      (fig.frames || []).forEach(function (frame) {
        applyDiscreteFillColors(frame.data);
      });
      return fig;
    }

    function renderTimeseriesFigure(figure) {
      if (!figure || !figure.data || !figure.layout) {
        timeseriesHeadingEl.classList.remove('is-visible');
        timeseriesPlotEl.style.display = 'none';
        return;
      }
      timeseriesHeadingEl.classList.add('is-visible');
      timeseriesPlotEl.style.display = 'block';
      Plotly.purge(timeseriesPlotEl);
      timeseriesPlotEl.innerHTML = '';
      var layout = tunePlotlyLayout(figure.layout);
      // Heading is shown above the plot; keep Plotly chrome clear of that label.
      layout.title = null;
      layout.margin = layout.margin || {};
      layout.margin.t = Math.max(layout.margin.t || 0, 48);
      layout.margin.b = Math.max(layout.margin.b || 0, 56);
      layout.margin.l = Math.max(layout.margin.l || 0, 56);
      layout.margin.r = Math.max(layout.margin.r || 0, 24);
      var fig = {
        data: figure.data,
        layout: layout,
        config: Object.assign(
          { responsive: true, scrollZoom: true, displayModeBar: true },
          figure.config || {}
        )
      };
      Plotly.newPlot(timeseriesPlotEl, fig).then(function (gd) {
        Plotly.Plots.resize(gd);
      });
      ensureResizeListener();
    }

    function clearOneSpatialProfile(headingEl, plotEl) {
      headingEl.classList.remove('is-visible');
      plotEl.style.display = 'none';
      if (typeof Plotly !== 'undefined' && Plotly.purge) {
        Plotly.purge(plotEl);
      }
      plotEl.innerHTML = '';
    }

    function clearSpatialProfileFigure() {
      clearOneSpatialProfile(spatialProfileHeadingEl, spatialProfilePlotEl);
      clearOneSpatialProfile(spatialProfileMidHeadingEl, spatialProfileMidPlotEl);
    }

    function paintSpatialProfilePlot(figure, headingEl, plotEl, fallbackTitle) {
      if (!figure || !figure.data || !figure.layout || !figure.data.length) {
        clearOneSpatialProfile(headingEl, plotEl);
        return false;
      }
      var profileTitle = figure.layout && figure.layout.title;
      if (profileTitle && typeof profileTitle === 'object') {
        profileTitle = profileTitle.text;
      }
      headingEl.textContent = profileTitle || fallbackTitle;
      headingEl.classList.add('is-visible');
      plotEl.style.display = 'block';
      Plotly.purge(plotEl);
      plotEl.innerHTML = '';
      var layout = tunePlotlyLayout(figure.layout);
      layout.title = null;
      layout.margin = layout.margin || {};
      layout.margin.t = Math.max(layout.margin.t || 0, 48);
      layout.margin.b = Math.max(layout.margin.b || 0, 56);
      layout.margin.l = Math.max(layout.margin.l || 0, 56);
      layout.margin.r = Math.max(layout.margin.r || 0, 24);
      var fig = {
        data: figure.data,
        layout: layout,
        config: Object.assign(
          { responsive: true, scrollZoom: true, displayModeBar: true },
          figure.config || {}
        )
      };
      Plotly.newPlot(plotEl, fig).then(function (gd) {
        Plotly.Plots.resize(gd);
      });
      return true;
    }

    function renderSpatialProfileFigure(figure, mode, midFigure) {
      var alongX = mode === 'x';
      if (!alongX && getSelectedShape() !== 'cylinder') {
        clearSpatialProfileFigure();
        return;
      }
      if (alongX) {
        paintSpatialProfilePlot(
          figure,
          spatialProfileHeadingEl,
          spatialProfilePlotEl,
          'Molecule Population Along x-axis at Time = 0'
        );
        paintSpatialProfilePlot(
          midFigure,
          spatialProfileMidHeadingEl,
          spatialProfileMidPlotEl,
          'Molecule Population Along x-axis (Summarized)'
        );
      } else {
        clearOneSpatialProfile(spatialProfileMidHeadingEl, spatialProfileMidPlotEl);
        paintSpatialProfilePlot(
          figure,
          spatialProfileHeadingEl,
          spatialProfilePlotEl,
          'Population Along Cylinder'
        );
      }
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
      // Leave room for Plotly's top-right mode bar.
      L.margin.t = Math.max(typeof L.margin.t === 'number' ? L.margin.t : 0, 52);
      // Keep bottom margin for animation slider / updatemenus
      if (typeof L.margin.b !== 'number' || L.margin.b < 72) {
        L.margin.b = Math.max(L.margin.b || 0, 88);
      }
      // Default / top-right legends sit under the mode bar; move them to the left.
      var legend = L.legend && typeof L.legend === 'object' ? L.legend : {};
      var legendX = legend.x == null ? 1 : Number(legend.x);
      var legendY = legend.y == null ? 1 : Number(legend.y);
      if ((!Number.isFinite(legendX) || legendX > 0.7) &&
          (!Number.isFinite(legendY) || legendY > 0.85)) {
        L.legend = Object.assign({}, legend, {
          x: 0,
          y: 1,
          xanchor: 'left',
          yanchor: 'top',
          bgcolor: legend.bgcolor || 'rgba(255,255,255,0.85)'
        });
      }
      if (L.scene && typeof L.scene === 'object') {
        L.scene = Object.assign({}, L.scene, {
          aspectmode: L.scene.aspectmode || 'data'
        });
      }
      return L;
    }

    function getBasePath() {
      try {
        var base = document.querySelector('base');
        return base && base.getAttribute('href') ? base.getAttribute('href') : '/';
      } catch (err) {
        return '/';
      }
    }

    function joinPath() {
      var parts = Array.prototype.slice.call(arguments).filter(Boolean);
      return parts.join('/').replace(/\/{2,}/g, '/').replace(':/', '://');
    }

    function setExportEnabled(enabled) {
      downloadCsvBtnEl.disabled = !enabled;
      convertNotebookBtnEl.disabled = !enabled;
      if (!enabled) {
        exportStatusEl.textContent = '';
      }
    }

    function setRunState(isRunning, statusText) {
      runBtnEl.disabled = isRunning;
      saveBtnEl.disabled = isRunning;
      runBtnEl.textContent = isRunning ? 'Running...' : 'Run Simulation';
      runStatusEl.textContent = statusText;
      if (isRunning) {
        setExportEnabled(false);
      }
    }

    function downloadFullCSV() {
      if (!lastJobPath) {
        exportStatusEl.textContent = 'Run a simulation before downloading CSV results.';
        return;
      }
      var endpoint = joinPath(getBasePath(), 'model_builder/api/job/csv') +
        '?path=' + encodeURIComponent(lastJobPath) + '&type=full';
      exportStatusEl.textContent = 'Downloading CSV zip...';
      window.open(endpoint, '_blank');
    }

    async function convertToNotebook() {
      if (!lastJobPath) {
        exportStatusEl.textContent = 'Run a simulation before converting to a notebook.';
        return;
      }
      convertNotebookBtnEl.disabled = true;
      exportStatusEl.textContent = 'Creating notebook...';
      try {
        var endpoint = joinPath(getBasePath(), 'model_builder/api/workflow/notebook') +
          '?path=' + encodeURIComponent(lastJobPath) + '&type=spatial';
        var response = await fetch(endpoint);
        var data = await readJSONResponse(response);
        var filePath = data.FilePath || data.file_path;
        if (!filePath) {
          throw new Error(data.Message || data.message || 'Notebook creation did not return a file path.');
        }
        exportStatusEl.textContent = 'Opening notebook...';
        window.open(joinPath(getBasePath(), 'notebooks', filePath), '_blank');
        exportStatusEl.textContent = 'Notebook ready.';
      } catch (err) {
        exportStatusEl.textContent = 'Notebook conversion failed: ' + err.message;
      } finally {
        setExportEnabled(!!lastJobPath);
      }
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
      var diffusionRun = !speciesEl.value || speciesEl.value === DIFFUSION_SIM;
      if (diffusionRun && diffusionSpeciesNames().length === 0) {
        runStatusEl.textContent =
          'Add a species, assign it to a shape, and set an initial particle count to run Diffusion.';
        return;
      }
      if (!diffusionRun && editorState.reactionOrder.length === 0) {
        runStatusEl.textContent = 'Add a reaction to run a species simulation, or choose Diffusion.';
        return;
      }

      var densityLevel = getDensityLevel();
      refreshStructuredModel();
      var model = diffusionRun
        ? editorStateApi.diffusionPreviewModel(editorState)
        : structuredModel;
      var selected = diffusionRun ? DIFFUSION_SIM : (speciesEl.value || 'A');
      var startedAt = Date.now();
      setRunState(true, 'Saving and running the structured spatial model...');
      speciesEl.disabled = true;
      plotHeadingRowEl.classList.remove('is-visible');
      moleculeGradientBtnEl.classList.remove('is-visible');
      timeseriesHeadingEl.classList.remove('is-visible');
      clearSpatialProfileFigure();
      plotEl.style.display = 'none';
      timeseriesPlotEl.style.display = 'none';
      resultEl.style.display = 'none';
      resultEl.textContent = '';
      cachedFigures = null;
      lastRunSummary = null;
      lastJobPath = null;
      setExportEnabled(false);
      exportStatusEl.textContent = '';

      try {
        var activeReactionCount = model.reactions.length;
        var path = await saveStructuredModel(model);
        runStatusEl.textContent = diffusionRun
          ? 'Running diffusion across the domain...'
          : ('Running ' + path + ' for all species...');
        var results = await runStructuredSimulation(path, '__all_species__');
        var preview = results.results || {};
        cachedFigures = preview.figures || {};
        var figureKey = figureKeyForSelection(selected);
        if (Object.keys(cachedFigures).length === 0 && preview.data && preview.layout) {
          cachedFigures[figureKey] = preview;
        }
        if (selected === BOTH_SPECIES_VIEW) {
          var bothNames = getBothSpeciesNames();
          if (bothNames.length < 2 || !cachedFigures[bothNames[0]] || !cachedFigures[bothNames[1]]) {
            selected = Object.keys(cachedFigures)[0];
            speciesEl.value = selected;
          }
        } else if (!cachedFigures[figureKey]) {
          if (!diffusionRun) {
            selected = Object.keys(cachedFigures)[0];
            speciesEl.value = selected;
            figureKey = figureKeyForSelection(selected);
          }
        }
        if (!selected || (selected !== BOTH_SPECIES_VIEW && !cachedFigures[figureKey])) {
          throw new Error('The structured simulation completed without species figures.');
        }
        if (!showSelectedSpeciesFigure()) {
          throw new Error('The structured simulation completed without species figures.');
        }
        if (diffusionRun) {
          timeseriesHeadingEl.classList.remove('is-visible');
          timeseriesPlotEl.style.display = 'none';
          renderSpatialProfileFigure(
            preview.spatial_profile_figure,
            'x',
            preview.spatial_profile_mid_figure
          );
        } else {
          renderTimeseriesFigure(preview.timeseries_figure);
          if (getSelectedShape() === 'cylinder') {
            renderSpatialProfileFigure(preview.spatial_profile_figure);
          } else {
            clearSpatialProfileFigure();
          }
        }

        lastJobPath = preview.job_path || null;
        setExportEnabled(!!lastJobPath);
        if (lastJobPath) {
          exportStatusEl.textContent = 'Results ready for CSV download and notebook conversion.';
        } else {
          exportStatusEl.textContent = 'Simulation completed, but export job data was not saved.';
        }

        setRunState(false, 'Simulation completed.');
        speciesEl.disabled = false;
        lastRunSummary = {
          status: 'success',
          message: 'Structured SpatialPy simulation completed.',
          elapsed_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
          model_path: path,
          job_path: lastJobPath,
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
        lastJobPath = null;
        setExportEnabled(false);
        speciesEl.disabled = false;
        plotHeadingRowEl.classList.remove('is-visible');
        moleculeGradientBtnEl.classList.remove('is-visible');
        timeseriesHeadingEl.classList.remove('is-visible');
        clearSpatialProfileFigure();
        plotEl.style.display = 'none';
        timeseriesPlotEl.style.display = 'none';
        resultEl.style.display = 'block';
        resultEl.textContent = JSON.stringify({
          status: 'error',
          message: err.message
        }, null, 2);
      }
    }

    moleculeGradientBtnEl.addEventListener('click', function () {
      moleculeGradientOn = !moleculeGradientOn;
      syncMoleculeGradientButton(speciesEl.value === DIFFUSION_SIM);
      if (cachedFigures && speciesEl.value === DIFFUSION_SIM) {
        showSelectedSpeciesFigure();
      }
    });

    runBtnEl.addEventListener('click', runSimulation);
    downloadCsvBtnEl.addEventListener('click', downloadFullCSV);
    convertNotebookBtnEl.addEventListener('click', convertToNotebook);

    editorState = editorStateApi.createEditorState({ density: getDensityLevel() });
    renderReactionTypeOptions();
    renderDomainExampleOptions();
    draw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();