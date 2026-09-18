/*
GillesPy3D is a platform for simulating biochemical systems
Copyright (C) 2025 GillesPy3D developers.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

var cylinderDomainTemplate = require('./cylinder-domain-template.json');

var DENSITY_PRESETS = {
  low: { radius: 1, deltas: 0.5, deltar: 0.5 },
  medium: { radius: 1, deltas: 0.3, deltar: 0.2 },
  high: { radius: 1, deltas: 0.2, deltar: 0.1 }
};

var DOMAIN_TYPE_ID = 1;

var CYLINDER_TYPES = {
  MIDDLE: 1,
  EDGE1: 2,
  EDGE2: 3
};

// Total particle volume on each cylinder cap from cylinder-domain-template.json.
var CYLINDER_EDGE1_VOLUME = 0.5092013833059308;
var CYLINDER_EDGE2_VOLUME = 0.505804729089437;

var DOMAIN_SHAPES = ['sphere', 'cylinder'];

function speciesTypesForShape(shape) {
  if (shape === 'cylinder') {
    // Match the legacy 3D Cylinder demo: species created at Edge1
    // are restricted to Middle + Edge1 (not Edge2).
    return [CYLINDER_TYPES.MIDDLE, CYLINDER_TYPES.EDGE1];
  }
  return [DOMAIN_TYPE_ID];
}

function diffusionForShape(shape) {
  return shape === 'cylinder' ? 0.1 : 0;
}

function reactionTypesForShape(shape, reaction, state) {
  if (shape === 'cylinder') {
    if (reaction.reactants.length === 0 && reaction.products.length > 0) {
      return [CYLINDER_TYPES.EDGE1];
    }
    return [
      CYLINDER_TYPES.MIDDLE,
      CYLINDER_TYPES.EDGE1,
      CYLINDER_TYPES.EDGE2
    ];
  }

  var typeIds = {};
  function addSpeciesTypes(entries) {
    (entries || []).forEach(function (entry) {
      var species = state && state.species && state.species[entry.speciesId];
      if (!species) {
        return;
      }
      (species.types || []).forEach(function (typeId) {
        typeIds[Number(typeId)] = true;
      });
    });
  }
  addSpeciesTypes(reaction.reactants);
  addSpeciesTypes(reaction.products);
  var types = Object.keys(typeIds).map(Number).sort(function (a, b) {
    return a - b;
  });
  return types.length > 0 ? types : [DOMAIN_TYPE_ID];
}

function cylinderVolumeParameterForTypes(types) {
  if (types.length === 1 && types[0] === CYLINDER_TYPES.EDGE1) {
    return 'left';
  }
  if (types.length === 1 && types[0] === CYLINDER_TYPES.EDGE2) {
    return 'right';
  }
  return null;
}

function isCreationReaction(reaction) {
  return reaction.reactants.length === 0 && reaction.products.length > 0;
}

function applyCylinderReactionModeling(state, reaction) {
  reaction.types = clone(reactionTypesForShape(state.shape, reaction, state));
  if (state.shape !== 'cylinder' || !isCreationReaction(reaction)) {
    reaction.massaction = true;
    reaction.propensity = '';
    reaction.odePropensity = '';
    return reaction;
  }

  var rate = state.parameters[reaction.rateParameterId];
  if (!rate) {
    throw new Error('Reaction references unknown parameter id: ' + reaction.rateParameterId);
  }

  var volumeParameter = cylinderVolumeParameterForTypes(reaction.types);
  if (!volumeParameter) {
    reaction.massaction = true;
    reaction.propensity = '';
    reaction.odePropensity = '';
    return reaction;
  }

  // Sphere-default rate (1) is far too slow for the Edge1-normalized
  // propensity used by the legacy cylinder demo (rate 100).
  if (Number(rate.expression) === 1) {
    rate.expression = 100;
  }

  reaction.massaction = false;
  reaction.propensity = rate.name + ' / ' + volumeParameter + ' * vol';
  reaction.odePropensity = rate.name;
  return reaction;
}

function buildCylinderVolumeParameters(state, parameters) {
  if (state.shape !== 'cylinder') {
    return parameters;
  }

  var needsVolumeParams = sortedRecords(state.reactions).some(function (reaction) {
    return isCreationReaction(reaction);
  });
  if (!needsVolumeParams) {
    return parameters;
  }

  if (!state.cylinderVolumeParameterIds) {
    state.cylinderVolumeParameterIds = {
      left: allocateId(state),
      right: allocateId(state)
    };
  }

  var names = {};
  parameters.forEach(function (parameter) {
    names[parameter.name] = true;
  });

  var extras = [];
  if (!names.left) {
    extras.push({
      compID: state.cylinderVolumeParameterIds.left,
      name: 'left',
      expression: CYLINDER_EDGE1_VOLUME,
      annotation: ''
    });
  }
  if (!names.right) {
    extras.push({
      compID: state.cylinderVolumeParameterIds.right,
      name: 'right',
      expression: CYLINDER_EDGE2_VOLUME,
      annotation: ''
    });
  }
  return parameters.concat(extras);
}

function defaultReactionRate(state, templateId) {
  if (state.shape === 'cylinder' && templateId === 'creation') {
    return 100;
  }
  return 1;
}

function syncShapeModeling(state) {
  var diffusion = diffusionForShape(state.shape);
  ensureDefaultCompartment(state);
  sortedRecords(state.species).forEach(function (species) {
    species.diffusionConst = diffusion;
    if (state.shape === 'cylinder') {
      species.types = clone(speciesTypesForShape(state.shape));
      return;
    }
    var compartment = state.compartments[species.compartmentId];
    if (!compartment) {
      compartment = firstCompartment(state);
      species.compartmentId = compartment.id;
    }
    species.types = [compartment.typeID];
  });
  sortedRecords(state.reactions).forEach(function (reaction) {
    applyCylinderReactionModeling(state, reaction);
  });
  return state;
}

var INITIAL_COUNT_PRESETS = [
  { value: 0, label: 'None (0)' },
  { value: 10, label: '10 (low)' },
  { value: 20, label: '20 (medium)' },
  { value: 50, label: '50 (high)' }
];

var RADIUS_PRESETS = [
  { value: 1, label: '1.0 — outer / full domain' },
  { value: 0.8, label: '0.8 — large nested (~51% volume)' },
  { value: 0.7, label: '0.7 — large nested (~34% volume)' },
  { value: 0.5, label: '0.5 — half (~13% volume)' },
  { value: 0.4, label: '0.4 — typical nucleus (~6% volume)' },
  { value: 0.25, label: '0.25 — small nested (~2% volume)' }
];

var END_SIM_PRESETS = [
  { value: 20, label: '20' },
  { value: 100, label: '100' },
  { value: 500, label: '500 (legacy cylinder demo)' }
];

function defaultEndSim(shape) {
  return shape === 'cylinder' ? 100 : 20;
}

function validateEndSim(endSim) {
  var value = Number(endSim);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Simulation end time must be a positive number.');
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDensityPreset(density) {
  if (!Object.prototype.hasOwnProperty.call(DENSITY_PRESETS, density)) {
    throw new Error('Unknown spatial mockup density: ' + density);
  }
  return clone(DENSITY_PRESETS[density]);
}

function validateDomainShape(shape) {
  if (DOMAIN_SHAPES.indexOf(shape) < 0) {
    throw new Error('Unknown domain shape: ' + shape);
  }
  return shape;
}

function allocateId(state) {
  var id = state.nextId;
  state.nextId += 1;
  return id;
}

function validateInitialCount(count) {
  var value = Number(count);
  var allowed = INITIAL_COUNT_PRESETS.map(function (preset) {
    return preset.value;
  });
  if (allowed.indexOf(value) < 0) {
    throw new Error(
      'Initial particle count must be one of: ' + allowed.join(', ') + '.'
    );
  }
  return value;
}

function createSpeciesRecord(state, name, options) {
  var config = options || {};
  var initialCount = config.initialCount == null ? 0 : validateInitialCount(config.initialCount);
  ensureDefaultCompartment(state);
  var compartment = state.compartments[config.compartmentId] || firstCompartment(state);
  var id = allocateId(state);
  var types = state.shape === 'cylinder'
    ? clone(speciesTypesForShape(state.shape))
    : [compartment.typeID];
  state.species[id] = {
    id: id,
    name: name,
    initialCount: initialCount,
    value: initialCount,
    mode: 'discrete',
    switchTol: 0.03,
    switchMin: 100,
    isSwitchTol: true,
    annotation: '',
    diffusionConst: diffusionForShape(state.shape),
    compartmentId: compartment.id,
    types: types
  };
  return state.species[id];
}

function createParameterRecord(state, name, expression) {
  var id = allocateId(state);
  state.parameters[id] = {
    id: id,
    name: name,
    expression: expression,
    annotation: ''
  };
  return state.parameters[id];
}

function createReactionRecord(state, options) {
  var id = allocateId(state);
  var reactants = (options.reactants || []).map(function (entry) {
    return {
      speciesId: entry.speciesId,
      ratio: entry.ratio == null ? 1 : entry.ratio
    };
  });
  var products = (options.products || []).map(function (entry) {
    return {
      speciesId: entry.speciesId,
      ratio: entry.ratio == null ? 1 : entry.ratio
    };
  });
  var reaction = {
    id: id,
    name: options.name,
    massaction: true,
    odePropensity: '',
    propensity: '',
    annotation: '',
    types: clone(reactionTypesForShape(state.shape, {
      reactants: reactants,
      products: products
    }, state)),
    rateParameterId: options.rateParameterId,
    reactants: reactants,
    products: products
  };
  state.reactions[id] = reaction;
  return reaction;
}

function createEmptyState(density, shape) {
  getDensityPreset(density);
  validateDomainShape(shape || 'sphere');
  var domainShape = shape || 'sphere';
  var endSim = defaultEndSim(domainShape);
  var state = {
    density: density,
    shape: domainShape,
    endSim: endSim,
    nextId: 1,
    defaultMode: 'discrete',
    annotation: 'Created by the spatial model mockup.',
    volume: 1,
    modelSettings: {
      endSim: endSim,
      timeStep: 1,
      timestepSize: domainShape === 'cylinder' ? 1 : 0.05
    },
    compartments: {},
    compartmentOrder: [],
    species: {},
    parameters: {},
    reactions: {},
    reactionOrder: [],
    template_version: 1
  };
  ensureDefaultCompartment(state);
  return state;
}

function firstCompartment(state) {
  ensureDefaultCompartment(state);
  return state.compartments[state.compartmentOrder[0]];
}

function ensureDefaultCompartment(state) {
  if (!state.compartments) {
    state.compartments = {};
  }
  if (!state.compartmentOrder) {
    state.compartmentOrder = [];
  }
  if (state.compartmentOrder.length > 0) {
    return state;
  }
  var id = allocateId(state);
  state.compartments[id] = {
    id: id,
    name: 'Domain',
    typeID: DOMAIN_TYPE_ID,
    radius: defaultOuterRadius(state.density)
  };
  state.compartmentOrder.push(id);
  return state;
}

function defaultOuterRadius(density) {
  try {
    return getDensityPreset(density || 'low').radius;
  } catch (err) {
    return 1;
  }
}

function defaultNestedRadius(state) {
  var outer = 0;
  Object.keys(state.compartments || {}).forEach(function (key) {
    var radius = Number(state.compartments[key].radius);
    if (Number.isFinite(radius) && radius > outer) {
      outer = radius;
    }
  });
  if (outer <= 0) {
    outer = defaultOuterRadius(state.density);
  }
  var candidates = RADIUS_PRESETS.map(function (preset) {
    return preset.value;
  }).filter(function (value) {
    return value < outer;
  }).sort(function (a, b) {
    return b - a;
  });
  return candidates.length > 0 ? candidates[0] : RADIUS_PRESETS[RADIUS_PRESETS.length - 1].value;
}

function validateCompartmentRadius(radius) {
  var value = Number(radius);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Shape radius must be a positive number.');
  }
  return value;
}

function ensureCompartmentRadius(state, compartment) {
  if (!compartment) {
    return compartment;
  }
  if (compartment.radius != null && Number.isFinite(Number(compartment.radius))) {
    return compartment;
  }
  var hasOtherRadius = Object.keys(state.compartments || {}).some(function (key) {
    var other = state.compartments[key];
    return other &&
      other.id !== compartment.id &&
      other.radius != null &&
      Number.isFinite(Number(other.radius));
  });
  compartment.radius = hasOtherRadius
    ? defaultNestedRadius(state)
    : defaultOuterRadius(state.density);
  return compartment;
}

function nextCompartmentTypeID(state) {
  var maxId = 0;
  Object.keys(state.compartments || {}).forEach(function (key) {
    var typeID = Number(state.compartments[key].typeID) || 0;
    if (typeID > maxId) {
      maxId = typeID;
    }
  });
  return maxId + 1;
}

function validateCompartmentName(name) {
  var trimmed = String(name || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_ ]*$/.test(trimmed)) {
    throw new Error(
      'Shape names must start with a letter and contain only letters, numbers, spaces, or underscores.'
    );
  }
  return trimmed;
}

function listCompartments(state) {
  ensureDefaultCompartment(state);
  return state.compartmentOrder.map(function (id) {
    return ensureCompartmentRadius(state, state.compartments[id]);
  }).filter(Boolean);
}

function particlesAssignedToCompartment(state, compartmentId) {
  var id = Number(compartmentId);
  return sortedRecords(state.species).reduce(function (total, species) {
    if (Number(species.compartmentId) === id) {
      return total + (Number(species.initialCount) || 0);
    }
    return total;
  }, 0);
}

function speciesAssignedToCompartment(state, compartmentId) {
  var id = Number(compartmentId);
  return sortedRecords(state.species).filter(function (species) {
    return Number(species.compartmentId) === id;
  });
}

function suggestCompartmentName(state) {
  var taken = {};
  listCompartments(state).forEach(function (compartment) {
    taken[compartment.name] = true;
  });
  var defaults = ['Nucleus', 'Cytoplasm', 'Membrane', 'Region'];
  var index;
  for (index = 0; index < defaults.length; index += 1) {
    if (!taken[defaults[index]]) {
      return defaults[index];
    }
  }
  var suffix = 1;
  while (taken['Region' + suffix]) {
    suffix += 1;
  }
  return 'Region' + suffix;
}

function suggestCompartmentRadius(state) {
  ensureDefaultCompartment(state);
  return defaultNestedRadius(state);
}

function addCompartment(state, options) {
  var config = options || {};
  var name = validateCompartmentName(config.name || suggestCompartmentName(state));
  ensureDefaultCompartment(state);
  var duplicate = listCompartments(state).some(function (compartment) {
    return compartment.name === name;
  });
  if (duplicate) {
    throw new Error('A shape named "' + name + '" already exists.');
  }
  var radius = config.radius == null
    ? defaultNestedRadius(state)
    : validateCompartmentRadius(config.radius);
  var id = allocateId(state);
  var compartment = {
    id: id,
    name: name,
    typeID: nextCompartmentTypeID(state),
    radius: radius
  };
  state.compartments[id] = compartment;
  state.compartmentOrder.push(id);
  validateNestedRadii(state);
  return compartment;
}

function updateCompartment(state, compartmentId, options) {
  var id = Number(compartmentId);
  var compartment = state.compartments[id];
  if (!compartment) {
    throw new Error('Unknown shape id: ' + compartmentId);
  }
  var config = options || {};
  var name = validateCompartmentName(config.name);
  var duplicate = listCompartments(state).some(function (item) {
    return item.id !== id && item.name === name;
  });
  if (duplicate) {
    throw new Error('A shape named "' + name + '" already exists.');
  }
  compartment.name = name;
  if (config.radius != null) {
    compartment.radius = validateCompartmentRadius(config.radius);
  } else {
    ensureCompartmentRadius(state, compartment);
  }
  validateNestedRadii(state);
  return compartment;
}

function validateNestedRadii(state) {
  var compartments = listCompartments(state);
  if (compartments.length < 2) {
    return;
  }
  var ordered = sortCompartmentsByRadiusDesc(compartments);
  var outer = ordered[0];
  ordered.slice(1).forEach(function (compartment) {
    if (Number(compartment.radius) >= Number(outer.radius)) {
      throw new Error(
        'Inner shape "' + compartment.name + '" must have a smaller radius than "' +
        outer.name + '" (' + outer.radius + ').'
      );
    }
  });
}

function removeCompartment(state, compartmentId) {
  var id = Number(compartmentId);
  var compartment = state.compartments[id];
  if (!compartment) {
    throw new Error('Unknown shape id: ' + compartmentId);
  }
  if (state.compartmentOrder.length <= 1) {
    throw new Error('The model must keep at least one shape.');
  }
  var assigned = speciesAssignedToCompartment(state, id);
  if (assigned.length > 0) {
    throw new Error(
      'Cannot remove "' + compartment.name + '" while it is used by: ' +
      assigned.map(function (species) { return species.name; }).join(', ') + '.'
    );
  }
  delete state.compartments[id];
  state.compartmentOrder = state.compartmentOrder.filter(function (entry) {
    return entry !== id;
  });
  return state;
}

// Reaction shapes offered by the editor, mirroring client/reaction-types.js.
// The ratios describe how many terms each side starts with; the editor assigns
// the species.
var REACTION_TEMPLATES = [
  { id: 'creation', label: '\u2205 \u2192 A', reactants: [], products: [1] },
  { id: 'destruction', label: 'A \u2192 \u2205', reactants: [1], products: [] },
  { id: 'change', label: 'A \u2192 B', reactants: [1], products: [1] },
  { id: 'dimerization', label: '2A \u2192 B', reactants: [2], products: [1] },
  { id: 'merge', label: 'A + B \u2192 C', reactants: [1, 1], products: [1] },
  { id: 'split', label: 'A \u2192 B + C', reactants: [1], products: [1, 1] },
  { id: 'four', label: 'A + B \u2192 C + D', reactants: [1, 1], products: [1, 1] },
  { id: 'custom-massaction', label: 'Custom Mass Action', reactants: [1], products: [1] }
];

function getReactionTemplate(templateId) {
  var found = null;
  REACTION_TEMPLATES.forEach(function (template) {
    if (template.id === templateId) {
      found = template;
    }
  });
  if (!found) {
    throw new Error('Unknown reaction template: ' + templateId);
  }
  return clone(found);
}

function syncModelSettings(state) {
  var endSim = state.endSim == null ? defaultEndSim(state.shape) : validateEndSim(state.endSim);
  state.endSim = endSim;
  if (state.shape === 'cylinder') {
    // Match the runnable 3D Cylinder notebook (timestep_size=1).
    state.modelSettings = { endSim: endSim, timeStep: 1, timestepSize: 1 };
  } else if (state.reactionOrder.length > 1) {
    // Keep output interval at 1 so the animation slider tracks endSim
    // (0, 1, ..., endSim). Use a finer solver step for multi-reaction models.
    state.modelSettings = { endSim: endSim, timeStep: 1, timestepSize: 0.01 };
  } else {
    state.modelSettings = { endSim: endSim, timeStep: 1, timestepSize: 0.05 };
  }
  return state.modelSettings;
}

function createEditorState(options) {
  var config = options || {};
  var state = createEmptyState(config.density || 'low', config.shape || 'sphere');
  (config.speciesNames || []).forEach(function (name) {
    createSpeciesRecord(state, name);
  });
  return state;
}

function validateSpeciesName(name) {
  var trimmed = String(name || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) {
    throw new Error(
      'Species names must start with a letter and contain only letters, numbers, or underscores.'
    );
  }
  return trimmed;
}

function addSpecies(state, options) {
  var config = options || {};
  var name = validateSpeciesName(config.name);

  var duplicate = sortedRecords(state.species).some(function (species) {
    return species.name === name;
  });
  if (duplicate) {
    throw new Error('A species named "' + name + '" already exists.');
  }

  return createSpeciesRecord(state, name, {
    initialCount: config.initialCount,
    compartmentId: config.compartmentId
  });
}

function updateSpecies(state, speciesId, options) {
  var id = Number(speciesId);
  var species = state.species[id];
  if (!species) {
    throw new Error('Unknown species id: ' + speciesId);
  }

  var config = options || {};
  var name = validateSpeciesName(config.name);
  var duplicate = sortedRecords(state.species).some(function (item) {
    return item.id !== id && item.name === name;
  });
  if (duplicate) {
    throw new Error('A species named "' + name + '" already exists.');
  }

  var initialCount = config.initialCount == null
    ? species.initialCount
    : validateInitialCount(config.initialCount);

  var compartmentId = config.compartmentId == null
    ? species.compartmentId
    : Number(config.compartmentId);
  var compartment = state.compartments[compartmentId];
  if (!compartment) {
    throw new Error('Unknown shape id: ' + compartmentId);
  }

  species.name = name;
  species.initialCount = initialCount;
  species.value = initialCount;
  species.compartmentId = compartment.id;
  if (state.shape !== 'cylinder') {
    species.types = [compartment.typeID];
  }
  return species;
}

function removeSpecies(state, speciesId) {
  var id = Number(speciesId);
  var species = state.species[id];
  if (!species) {
    throw new Error('Unknown species id: ' + speciesId);
  }

  var usedBy = sortedRecords(state.reactions).filter(function (reaction) {
    return reaction.reactants.concat(reaction.products).some(function (entry) {
      return entry.speciesId === id;
    });
  }).map(function (reaction) {
    return reaction.name;
  });
  if (usedBy.length > 0) {
    throw new Error(
      'Cannot remove "' + species.name + '" while it is used by: ' + usedBy.join(', ') + '.'
    );
  }

  delete state.species[id];
  return state;
}

function listSpecies(state) {
  return sortedRecords(state.species);
}

function suggestSpeciesName(state) {
  var taken = {};
  sortedRecords(state.species).forEach(function (species) {
    taken[species.name] = true;
  });

  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var index;
  for (index = 0; index < alphabet.length; index += 1) {
    if (!taken[alphabet.charAt(index)]) {
      return alphabet.charAt(index);
    }
  }

  var suffix = 1;
  while (taken['S' + suffix]) {
    suffix += 1;
  }
  return 'S' + suffix;
}

// Prefill a template's terms with distinct species where the pool allows it.
function buildTemplateTerms(state, templateId) {
  var template = getReactionTemplate(templateId);
  var pool = sortedRecords(state.species);
  if (pool.length === 0) {
    throw new Error('The model needs at least one species before adding a reaction.');
  }

  var usedIds = [];
  function nextSpeciesId() {
    var available = pool.filter(function (species) {
      return usedIds.indexOf(species.id) < 0;
    });
    var species = available.length > 0 ? available[0] : pool[0];
    usedIds.push(species.id);
    return species.id;
  }

  function buildSide(ratios) {
    return ratios.map(function (ratio) {
      return { speciesId: nextSpeciesId(), ratio: ratio };
    });
  }

  return {
    reactants: buildSide(template.reactants),
    products: buildSide(template.products)
  };
}

function createCylinderDomain() {
  return clone(cylinderDomainTemplate);
}

function shapeGeometryName(compartment) {
  return String(compartment.name || 'region')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '_');
}

function sphereFormula(radius) {
  var r2 = radius * radius;
  // Keep a stable decimal representation for round-trips.
  var encoded = Number(r2.toPrecision(12));
  return '(x*x)+(y*y)+(z*z) < ' + encoded;
}

function sortCompartmentsByRadiusDesc(compartments) {
  return compartments.slice().sort(function (a, b) {
    var radiusDiff = Number(b.radius) - Number(a.radius);
    if (radiusDiff !== 0) {
      return radiusDiff;
    }
    return Number(a.typeID) - Number(b.typeID);
  });
}

function buildAction(type, priority, shapeName, typeID) {
  return {
    type: type,
    scope: 'Multi Particle',
    priority: priority,
    enable: true,
    shape: shapeName,
    transformation: '',
    filename: '',
    subdomainFile: '',
    point: { x: 0, y: 0, z: 0 },
    newPoint: { x: 0, y: 0, z: 0 },
    c: 10,
    fixed: false,
    mass: 1,
    nu: 0,
    rho: 1,
    typeID: typeID,
    vol: 1
  };
}

function createDomain(density, shape, compartments) {
  var domainShape = validateDomainShape(shape || 'sphere');
  if (domainShape === 'cylinder') {
    return createCylinderDomain();
  }

  var preset = getDensityPreset(density);
  var compartmentList = (compartments || []).length > 0
    ? compartments.map(function (compartment) {
      return {
        id: compartment.id,
        name: compartment.name,
        typeID: compartment.typeID,
        radius: validateCompartmentRadius(
          compartment.radius == null ? preset.radius : compartment.radius
        )
      };
    })
    : [{ name: 'Domain', typeID: DOMAIN_TYPE_ID, radius: preset.radius }];

  var types = [{
    c: 10,
    fixed: false,
    mass: 1,
    name: 'Un-Assigned',
    nu: 0,
    rho: 1,
    typeID: 0,
    volume: 1
  }].concat(compartmentList.map(function (compartment) {
    return {
      c: 10,
      fixed: false,
      mass: 1,
      name: compartment.name,
      nu: 0,
      rho: 1,
      typeID: compartment.typeID,
      volume: 1
    };
  }));

  var ordered = sortCompartmentsByRadiusDesc(compartmentList);
  var outer = ordered[0];
  var outerRadius = Number(outer.radius);
  var outerShapeName = compartmentList.length === 1
    ? 'sphere'
    : shapeGeometryName(outer);

  var shapes = [{
    deltar: preset.deltar,
    deltas: preset.deltas,
    deltax: 0,
    deltay: 0,
    deltaz: 0,
    depth: 0,
    fillable: true,
    formula: 'True',
    height: 0,
    lattice: 'Spherical Lattice',
    length: 0,
    name: outerShapeName,
    radius: outerRadius,
    type: 'Standard'
  }];
  var actions = [
    buildAction('Fill Action', 1, outerShapeName, outer.typeID)
  ];

  ordered.slice(1).forEach(function (compartment, index) {
    var nestedName = shapeGeometryName(compartment);
    var nestedRadius = Number(compartment.radius);
    if (nestedRadius >= outerRadius) {
      throw new Error(
        'Inner shape "' + compartment.name + '" must have a smaller radius than "' +
        outer.name + '" (' + outerRadius + ').'
      );
    }
    // Avoid colliding with the outer shape name when labels sanitize the same way.
    if (nestedName === outerShapeName) {
      nestedName = nestedName + '_' + compartment.typeID;
    }
    shapes.push({
      deltar: 0,
      deltas: 0,
      deltax: 0,
      deltay: 0,
      deltaz: 0,
      depth: 0,
      fillable: false,
      formula: sphereFormula(nestedRadius),
      height: 0,
      lattice: 'Spherical Lattice',
      length: 0,
      name: nestedName,
      radius: nestedRadius,
      type: 'Standard'
    });
    actions.push(
      buildAction('Set Action', index + 2, nestedName, compartment.typeID)
    );
  });

  return {
    actions: actions,
    boundary_condition: {
      reflect_x: true,
      reflect_y: true,
      reflect_z: true
    },
    c_0: 10,
    gravity: [0, 0, 0],
    p_0: 100,
    rho_0: 1,
    shapes: shapes,
    size: null,
    static: true,
    template_version: 2,
    transformations: [],
    types: types,
    x_lim: [-outerRadius, outerRadius],
    y_lim: [-outerRadius, outerRadius],
    z_lim: [-outerRadius, outerRadius]
  };
}

function expandInitialCondition(record) {
  return {
    icType: 'Scatter',
    annotation: '',
    count: record.initialCount,
    types: clone(record.types),
    x: 0,
    y: 0,
    z: 0,
    specie: expandSpecies(record)
  };
}

function buildInitialConditions(state) {
  return sortedRecords(state.species)
    .filter(function (species) {
      return species.initialCount > 0;
    })
    .map(expandInitialCondition);
}

function expandSpecies(record) {
  return {
    compID: record.id,
    name: record.name,
    value: record.initialCount || 0,
    mode: record.mode,
    switchTol: record.switchTol,
    switchMin: record.switchMin,
    isSwitchTol: record.isSwitchTol,
    annotation: record.annotation,
    diffusionConst: record.diffusionConst,
    types: clone(record.types)
  };
}

function expandParameter(record) {
  return {
    compID: record.id,
    name: record.name,
    expression: record.expression,
    annotation: record.annotation
  };
}

function expandStoich(entry, speciesById) {
  var species = speciesById[entry.speciesId];
  if (!species) {
    throw new Error('Reaction references unknown species id: ' + entry.speciesId);
  }
  return {
    ratio: entry.ratio,
    specie: expandSpecies(species)
  };
}

function expandReaction(record, state) {
  var rate = state.parameters[record.rateParameterId];
  if (!rate) {
    throw new Error('Reaction references unknown parameter id: ' + record.rateParameterId);
  }
  return {
    compID: record.id,
    name: record.name,
    massaction: record.massaction,
    odePropensity: record.odePropensity,
    propensity: record.propensity,
    annotation: record.annotation,
    types: clone(record.types),
    rate: expandParameter(rate),
    reactants: record.reactants.map(function (entry) {
      return expandStoich(entry, state.species);
    }),
    products: record.products.map(function (entry) {
      return expandStoich(entry, state.species);
    })
  };
}

function sortedRecords(map) {
  return Object.keys(map)
    .map(Number)
    .sort(function (a, b) { return a - b; })
    .map(function (id) { return map[id]; });
}

function toSmdl(state) {
  syncShapeModeling(state);
  var species = sortedRecords(state.species).map(expandSpecies);
  var parameters = buildCylinderVolumeParameters(
    state,
    sortedRecords(state.parameters).map(expandParameter)
  );
  var reactions = (state.reactionOrder || []).map(function (id) {
    var record = state.reactions[id];
    if (!record) {
      throw new Error('Reaction order references unknown id: ' + id);
    }
    return expandReaction(record, state);
  });

  return {
    is_spatial: true,
    defaultID: state.nextId,
    defaultMode: state.defaultMode,
    annotation: state.annotation,
    volume: state.volume,
    modelSettings: clone(state.modelSettings),
    domain: createDomain(state.density, state.shape, listCompartments(state)),
    species: species,
    initialConditions: buildInitialConditions(state),
    parameters: parameters,
    reactions: reactions,
    refLinks: [],
    rules: [],
    eventsCollection: [],
    functionDefinitions: [],
    boundaryConditions: [],
    template_version: state.template_version
  };
}

function parseRadiusFromFormula(formula) {
  var match = String(formula || '').match(/<\s*([0-9.+-eE]+)/);
  if (!match) {
    return null;
  }
  var radiusSquared = Number(match[1]);
  if (!Number.isFinite(radiusSquared) || radiusSquared <= 0) {
    return null;
  }
  return Math.sqrt(radiusSquared);
}

function applyCompartmentRadiiFromDomain(state, domain, typeIdToCompartmentId) {
  if (!domain || state.shape === 'cylinder') {
    listCompartments(state);
    return;
  }

  var shapesByName = {};
  (domain.shapes || []).forEach(function (item) {
    if (item && item.name) {
      shapesByName[item.name] = item;
    }
  });

  (domain.actions || []).forEach(function (action) {
    if (!action || action.enable === false) {
      return;
    }
    var compartmentId = typeIdToCompartmentId[action.typeID];
    if (compartmentId == null) {
      return;
    }
    var geometry = shapesByName[action.shape];
    if (!geometry) {
      return;
    }
    var radius = Number(geometry.radius);
    if (!Number.isFinite(radius) || radius <= 0) {
      radius = parseRadiusFromFormula(geometry.formula);
    }
    if (Number.isFinite(radius) && radius > 0) {
      state.compartments[compartmentId].radius = radius;
    }
  });

  listCompartments(state);
}

function fromSmdl(model) {
  if (!model || typeof model !== 'object') {
    throw new Error('Expected a spatial model object.');
  }

  var state = {
    density: 'low',
    shape: 'sphere',
    endSim: 20,
    // Allocate editor-only compartment ids from 1 so round-trips keep
    // model.defaultID stable; species/parameter/reaction ids still win later.
    nextId: 1,
    defaultMode: model.defaultMode || 'discrete',
    annotation: model.annotation || '',
    volume: model.volume == null ? 1 : model.volume,
    modelSettings: clone(model.modelSettings || {
      endSim: 20,
      timeStep: 1,
      timestepSize: 0.05
    }),
    compartments: {},
    compartmentOrder: [],
    species: {},
    parameters: {},
    reactions: {},
    reactionOrder: [],
    template_version: model.template_version || 1
  };

  var shape = model.domain && model.domain.shapes && model.domain.shapes[0];
  if (model.domain &&
      (model.domain.particles || []).length > 0 &&
      !(model.domain.shapes || []).length) {
    state.shape = 'cylinder';
  } else if (shape && shape.lattice === 'Cylindrical Lattice') {
    state.shape = 'cylinder';
  } else {
    state.shape = 'sphere';
  }
  if (state.modelSettings && state.modelSettings.endSim != null) {
    state.endSim = validateEndSim(state.modelSettings.endSim);
  } else {
    state.endSim = defaultEndSim(state.shape);
  }
  var latticeShape = ((model.domain && model.domain.shapes) || []).filter(function (item) {
    return item && item.fillable;
  })[0] || shape;
  if (latticeShape) {
    Object.keys(DENSITY_PRESETS).some(function (density) {
      var preset = DENSITY_PRESETS[density];
      if (
        latticeShape.deltas === preset.deltas &&
        latticeShape.deltar === preset.deltar
      ) {
        state.density = density;
        return true;
      }
      return false;
    });
  }

  var typeIdToCompartmentId = {};
  ((model.domain && model.domain.types) || []).forEach(function (item) {
    if (!item || Number(item.typeID) === 0) {
      return;
    }
    // Cylinder baked types stay on the mesh; editor compartments are for sphere regions.
    if (state.shape === 'cylinder') {
      return;
    }
    var id = allocateId(state);
    state.compartments[id] = {
      id: id,
      name: item.name || ('Region' + item.typeID),
      typeID: Number(item.typeID)
    };
    state.compartmentOrder.push(id);
    typeIdToCompartmentId[item.typeID] = id;
  });
  ensureDefaultCompartment(state);
  if (Object.keys(typeIdToCompartmentId).length === 0) {
    typeIdToCompartmentId[firstCompartment(state).typeID] = firstCompartment(state).id;
  }
  applyCompartmentRadiiFromDomain(state, model.domain, typeIdToCompartmentId);

  var speciesIdByName = {};
  (model.species || []).forEach(function (item) {
    var id = item.compID != null ? item.compID : allocateId(state);
    var typeList = item.types || [DOMAIN_TYPE_ID];
    var primaryType = typeList[0];
    var compartmentId = typeIdToCompartmentId[primaryType] || firstCompartment(state).id;
    state.species[id] = {
      id: id,
      name: item.name,
      initialCount: 0,
      value: item.value == null ? 0 : item.value,
      mode: item.mode,
      switchTol: item.switchTol,
      switchMin: item.switchMin,
      isSwitchTol: item.isSwitchTol,
      annotation: item.annotation || '',
      diffusionConst: item.diffusionConst,
      compartmentId: compartmentId,
      types: clone(typeList)
    };
    speciesIdByName[item.name] = id;
    if (id >= state.nextId) {
      state.nextId = id + 1;
    }
  });

  var parameterIdByName = {};
  (model.parameters || []).forEach(function (item) {
    var id = item.compID != null ? item.compID : allocateId(state);
    state.parameters[id] = {
      id: id,
      name: item.name,
      expression: item.expression,
      annotation: item.annotation || ''
    };
    parameterIdByName[item.name] = id;
    if (id >= state.nextId) {
      state.nextId = id + 1;
    }
  });

  (model.initialConditions || []).forEach(function (item) {
    if (item.icType !== 'Scatter' || !item.specie || !item.specie.name) {
      return;
    }
    var speciesId = speciesIdByName[item.specie.name];
    if (speciesId == null) {
      return;
    }
    var count = Number(item.count);
    if (!Number.isFinite(count) || count < 0) {
      return;
    }
    state.species[speciesId].initialCount = count;
    state.species[speciesId].value = count;
  });

  (model.reactions || []).forEach(function (item) {
    var id = item.compID != null ? item.compID : allocateId(state);
    var rateName = item.rate && item.rate.name;
    var rateParameterId = rateName != null ? parameterIdByName[rateName] : null;
    if (rateParameterId == null && item.rate && item.rate.compID != null) {
      rateParameterId = item.rate.compID;
    }
    state.reactions[id] = {
      id: id,
      name: item.name,
      massaction: item.massaction !== false,
      odePropensity: item.odePropensity || '',
      propensity: item.propensity || '',
      annotation: item.annotation || '',
      types: clone(item.types || [DOMAIN_TYPE_ID]),
      rateParameterId: rateParameterId,
      reactants: (item.reactants || []).map(function (entry) {
        var name = entry.specie && entry.specie.name;
        return {
          speciesId: speciesIdByName[name],
          ratio: entry.ratio == null ? 1 : entry.ratio
        };
      }),
      products: (item.products || []).map(function (entry) {
        var name = entry.specie && entry.specie.name;
        return {
          speciesId: speciesIdByName[name],
          ratio: entry.ratio == null ? 1 : entry.ratio
        };
      })
    };
    state.reactionOrder.push(id);
    if (id >= state.nextId) {
      state.nextId = id + 1;
    }
  });

  var importedNextId = Number(model.defaultID) || 1;
  if (importedNextId > state.nextId) {
    state.nextId = importedNextId;
  }

  return state;
}

function setDensity(state, density) {
  getDensityPreset(density);
  state.density = density;
  return state;
}

function setEndSim(state, endSim) {
  state.endSim = validateEndSim(endSim);
  syncModelSettings(state);
  return state;
}

function setShape(state, shape) {
  validateDomainShape(shape);
  state.shape = shape;
  syncShapeModeling(state);
  syncModelSettings(state);
  return state;
}

function listSpeciesNames(state) {
  return listSpecies(state).map(function (item) {
    return item.name;
  });
}

function normalizeStoichiometry(state, entries, side) {
  return (entries || []).map(function (entry) {
    var speciesId = Number(entry.speciesId);
    var ratio = Number(entry.ratio);
    if (!state.species[speciesId]) {
      throw new Error(side + ' references unknown species id: ' + entry.speciesId);
    }
    if (!Number.isInteger(ratio) || ratio < 1) {
      throw new Error(side + ' stoichiometry must be a positive integer.');
    }
    return { speciesId: speciesId, ratio: ratio };
  });
}

function addReaction(state, options) {
  var config = options || {};
  var name = String(config.name || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(
      'Reaction names must start with a letter and contain only letters, numbers, or underscores.'
    );
  }

  var duplicate = sortedRecords(state.reactions).some(function (reaction) {
    return reaction.name === name;
  });
  if (duplicate) {
    throw new Error('A reaction named "' + name + '" already exists.');
  }

  var reactants = normalizeStoichiometry(state, config.reactants, 'Reactant');
  var products = normalizeStoichiometry(state, config.products, 'Product');
  if (reactants.length === 0 && products.length === 0) {
    throw new Error('A reaction must have at least one reactant or product.');
  }

  var rateExpression = Number(config.rateExpression);
  if (!Number.isFinite(rateExpression) || rateExpression < 0) {
    throw new Error('The rate constant must be a non-negative number.');
  }

  var rate = createParameterRecord(state, name + '_rate', rateExpression);
  var reaction = createReactionRecord(state, {
    name: name,
    rateParameterId: rate.id,
    reactants: reactants,
    products: products
  });
  state.reactionOrder.push(reaction.id);
  syncModelSettings(state);
  return reaction;
}

function removeReaction(state, reactionId) {
  var id = Number(reactionId);
  var reaction = state.reactions[id];
  if (!reaction) {
    throw new Error('Unknown reaction id: ' + reactionId);
  }

  delete state.reactions[id];
  state.reactionOrder = state.reactionOrder.filter(function (entry) {
    return entry !== id;
  });

  var rateInUse = sortedRecords(state.reactions).some(function (entry) {
    return entry.rateParameterId === reaction.rateParameterId;
  });
  if (!rateInUse) {
    delete state.parameters[reaction.rateParameterId];
  }

  syncModelSettings(state);
  return state;
}

function updateReaction(state, reactionId, options) {
  var id = Number(reactionId);
  var reaction = state.reactions[id];
  if (!reaction) {
    throw new Error('Unknown reaction id: ' + reactionId);
  }

  var config = options || {};
  var name = String(config.name || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(
      'Reaction names must start with a letter and contain only letters, numbers, or underscores.'
    );
  }

  var duplicate = sortedRecords(state.reactions).some(function (item) {
    return item.id !== id && item.name === name;
  });
  if (duplicate) {
    throw new Error('A reaction named "' + name + '" already exists.');
  }

  var reactants = normalizeStoichiometry(state, config.reactants, 'Reactant');
  var products = normalizeStoichiometry(state, config.products, 'Product');
  if (reactants.length === 0 && products.length === 0) {
    throw new Error('A reaction must have at least one reactant or product.');
  }

  var rateExpression = Number(config.rateExpression);
  if (!Number.isFinite(rateExpression) || rateExpression < 0) {
    throw new Error('The rate constant must be a non-negative number.');
  }

  var rate = state.parameters[reaction.rateParameterId];
  if (!rate) {
    throw new Error('Reaction rate parameter is missing.');
  }

  var newRateName = name + '_rate';
  var rateNameTaken = sortedRecords(state.parameters).some(function (item) {
    return item.id !== rate.id && item.name === newRateName;
  });
  if (rateNameTaken) {
    throw new Error('A parameter named "' + newRateName + '" already exists.');
  }

  reaction.name = name;
  reaction.reactants = reactants;
  reaction.products = products;
  applyCylinderReactionModeling(state, reaction);
  rate.name = newRateName;
  rate.expression = rateExpression;
  syncModelSettings(state);
  return reaction;
}

function listReactions(state) {
  return state.reactionOrder.map(function (id) {
    return state.reactions[id];
  });
}

function suggestReactionName(state) {
  var taken = {};
  sortedRecords(state.reactions).forEach(function (reaction) {
    taken[reaction.name] = true;
  });
  var index = 1;
  while (taken['r' + index]) {
    index += 1;
  }
  return 'r' + index;
}

function formatReaction(state, reaction) {
  function formatSide(entries) {
    if (!entries.length) {
      return '\u2205';
    }
    return entries.map(function (entry) {
      var prefix = entry.ratio === 1 ? '' : entry.ratio + ' ';
      return prefix + state.species[entry.speciesId].name;
    }).join(' + ');
  }

  return reaction.name + ': ' +
    formatSide(reaction.reactants) + ' \u2192 ' + formatSide(reaction.products);
}

module.exports = {
  DENSITY_PRESETS: clone(DENSITY_PRESETS),
  DOMAIN_SHAPES: clone(DOMAIN_SHAPES),
  END_SIM_PRESETS: clone(END_SIM_PRESETS),
  INITIAL_COUNT_PRESETS: clone(INITIAL_COUNT_PRESETS),
  RADIUS_PRESETS: clone(RADIUS_PRESETS),
  REACTION_TEMPLATES: clone(REACTION_TEMPLATES),
  addCompartment: addCompartment,
  addReaction: addReaction,
  addSpecies: addSpecies,
  buildTemplateTerms: buildTemplateTerms,
  createEditorState: createEditorState,
  defaultEndSim: defaultEndSim,
  defaultReactionRate: defaultReactionRate,
  formatReaction: formatReaction,
  fromSmdl: fromSmdl,
  getDensityPreset: getDensityPreset,
  getReactionTemplate: getReactionTemplate,
  listCompartments: listCompartments,
  listReactions: listReactions,
  listSpecies: listSpecies,
  listSpeciesNames: listSpeciesNames,
  particlesAssignedToCompartment: particlesAssignedToCompartment,
  removeCompartment: removeCompartment,
  removeReaction: removeReaction,
  removeSpecies: removeSpecies,
  setDensity: setDensity,
  setEndSim: setEndSim,
  setShape: setShape,
  speciesAssignedToCompartment: speciesAssignedToCompartment,
  suggestCompartmentName: suggestCompartmentName,
  suggestCompartmentRadius: suggestCompartmentRadius,
  suggestReactionName: suggestReactionName,
  suggestSpeciesName: suggestSpeciesName,
  toSmdl: toSmdl,
  updateCompartment: updateCompartment,
  updateReaction: updateReaction,
  updateSpecies: updateSpecies
};
