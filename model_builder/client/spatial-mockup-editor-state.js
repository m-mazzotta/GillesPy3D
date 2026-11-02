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
    // Default: match the legacy 3D Cylinder demo Edge1-created species.
    return [CYLINDER_TYPES.MIDDLE, CYLINDER_TYPES.EDGE1];
  }
  return [DOMAIN_TYPE_ID];
}

function listCreationReactions(state) {
  return (state.reactionOrder || []).map(function (id) {
    return state.reactions[id];
  }).filter(function (reaction) {
    return reaction && isCreationReaction(reaction);
  });
}

function cylinderEdgeForCreationIndex(index) {
  return index === 0 ? CYLINDER_TYPES.EDGE1 : CYLINDER_TYPES.EDGE2;
}

function cylinderSpeciesTypesForEdge(edgeTypeId) {
  if (Number(edgeTypeId) === CYLINDER_TYPES.EDGE2) {
    return [CYLINDER_TYPES.MIDDLE, CYLINDER_TYPES.EDGE2];
  }
  return [CYLINDER_TYPES.MIDDLE, CYLINDER_TYPES.EDGE1];
}

function creationEdgeBySpeciesId(state) {
  var bySpecies = {};
  listCreationReactions(state).forEach(function (reaction, index) {
    var edge = cylinderEdgeForCreationIndex(index);
    (reaction.products || []).forEach(function (entry) {
      if (entry && entry.speciesId != null && bySpecies[entry.speciesId] == null) {
        bySpecies[entry.speciesId] = edge;
      }
    });
  });
  return bySpecies;
}

function creationIndexForReaction(state, reaction) {
  var creations = listCreationReactions(state);
  var index;
  for (index = 0; index < creations.length; index += 1) {
    if (creations[index].id === reaction.id) {
      return index;
    }
  }
  return creations.length;
}

function diffusionForShape(shape) {
  return shape === 'cylinder' ? 0.1 : 0;
}

function reactionTypesForShape(shape, reaction, state) {
  if (shape === 'cylinder') {
    if (reaction.reactants.length === 0 && reaction.products.length > 0) {
      return [cylinderEdgeForCreationIndex(creationIndexForReaction(state, reaction))];
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
  var inline = state.arrangement === 'inline';
  var diffusion = inline ? 0.1 : diffusionForShape(state.shape);
  ensureDefaultCompartment(state);
  ensureCylinderAnnihilation(state);
  var inlineTypes = inline
    ? listCompartments(state).map(function (compartment) {
      return compartment.typeID;
    })
    : null;
  var edgeBySpecies = state.shape === 'cylinder'
    ? creationEdgeBySpeciesId(state)
    : {};
  sortedRecords(state.species).forEach(function (species) {
    species.diffusionConst = diffusion;
    if (inline) {
      species.types = clone(inlineTypes);
      return;
    }
    if (state.shape === 'cylinder') {
      species.types = clone(cylinderSpeciesTypesForEdge(
        edgeBySpecies[species.id] || CYLINDER_TYPES.EDGE1
      ));
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
  if (value > 1000000) {
    throw new Error('Simulation end time must be at most 1000000.');
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
  if (!Number.isFinite(value) || value < 0 || Math.floor(value) !== value) {
    throw new Error('Initial molecules must be a non-negative whole number.');
  }
  if (value > 10000000) {
    throw new Error('Initial molecules must be at most 10000000.');
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
    template_version: 1,
    arrangement: 'nested'
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
    radius: defaultOuterRadius(state.density),
    formula: sphereFormula(defaultOuterRadius(state.density))
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
    ensureCompartmentFormula(compartment);
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
  ensureCompartmentFormula(compartment);
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
  if (state.arrangement === 'inline') {
    var existing = listCompartments(state);
    var radius = existing.length > 0 ? Number(existing[0].radius) : 0;
    return radius > 0 ? radius : defaultOuterRadius(state.density);
  }
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
  var formula = config.formula == null || String(config.formula).trim() === ''
    ? sphereFormula(radius)
    : normalizeFormula(config.formula);
  var id = allocateId(state);
  var compartment = {
    id: id,
    name: name,
    typeID: nextCompartmentTypeID(state),
    radius: radius,
    formula: formula,
    lattice: config.lattice === 'cylinder' ? 'cylinder' : 'sphere',
    length: config.length == null ? 2 : validateCompartmentLength(config.length)
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
  var previousRadius = Number(compartment.radius);
  var previousDefaultFormula = Number.isFinite(previousRadius) && previousRadius > 0
    ? sphereFormula(previousRadius)
    : null;
  if (config.radius != null) {
    compartment.radius = validateCompartmentRadius(config.radius);
  } else {
    ensureCompartmentRadius(state, compartment);
  }
  if (config.formula != null) {
    compartment.formula = normalizeFormula(config.formula);
  } else if (
    !compartment.formula ||
    (previousDefaultFormula && compartment.formula === previousDefaultFormula)
  ) {
    // Keep formula in sync with radius until the user customizes it.
    compartment.formula = sphereFormula(compartment.radius);
  } else {
    ensureCompartmentFormula(compartment);
  }
  if (config.lattice != null) {
    compartment.lattice = config.lattice === 'cylinder' ? 'cylinder' : 'sphere';
  }
  if (config.length != null) {
    compartment.length = validateCompartmentLength(config.length);
  }
  validateNestedRadii(state);
  return compartment;
}

function validateCompartmentLength(length) {
  var value = Number(length);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Cylinder length must be a positive number.');
  }
  return value;
}

function validateNestedRadii(state) {
  var compartments = listCompartments(state);
  if (state.arrangement === 'inline' || compartments.length < 2) {
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

  var createdIds = {};
  if (templateId === 'creation') {
    listCreationReactions(state).forEach(function (reaction) {
      (reaction.products || []).forEach(function (entry) {
        if (entry && entry.speciesId != null) {
          createdIds[entry.speciesId] = true;
        }
      });
    });
  }

  var usedIds = [];
  function nextSpeciesId() {
    var available = pool.filter(function (species) {
      return usedIds.indexOf(species.id) < 0;
    });
    if (templateId === 'creation') {
      var notYetCreated = available.filter(function (species) {
        return !createdIds[species.id];
      });
      if (notYetCreated.length > 0) {
        available = notYetCreated;
      }
    }
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

// Hole radius as a fraction of the selected radius (0.4 → r² cutoff 0.16 at radius 1).
var HOLLOW_INNER_RADIUS_RATIO = 0.4;

var FORMULA_EXAMPLES = [
  { id: 'solid', label: 'Solid sphere: (x*x)+(y*y)+(z*z) < 1' },
  { id: 'half', label: 'Half-sphere: (x*x)+(y*y)+(z*z) < 1 and z > 0' },
  {
    id: 'hollow',
    label: 'Hollow sphere: (x*x)+(y*y)+(z*z) < 1 and (x*x)+(y*y)+(z*z) > 0.16'
  }
];

function encodedRadiusSquared(radius) {
  // Keep a stable decimal representation for round-trips.
  return Number((radius * radius).toPrecision(12));
}

function sphereFormula(radius) {
  return '(x*x)+(y*y)+(z*z) < ' + encodedRadiusSquared(radius);
}

function halfSphereFormula(radius) {
  return sphereFormula(radius) + ' and z > 0';
}

function hollowSphereFormula(radius) {
  var inner = encodedRadiusSquared(radius * HOLLOW_INNER_RADIUS_RATIO);
  return sphereFormula(radius) + ' and (x*x)+(y*y)+(z*z) > ' + inner;
}

function shapeFormulaForExample(exampleId, radius) {
  if (exampleId === 'half') {
    return halfSphereFormula(radius);
  }
  if (exampleId === 'hollow') {
    return hollowSphereFormula(radius);
  }
  return sphereFormula(radius);
}

function isHalfSphereFormula(formula, radius) {
  var ball = '(x*x)+(y*y)+(z*z) < ' + encodedRadiusSquared(radius);
  var value = String(formula == null ? '' : formula).trim();
  return value === ball + ' and z > 0' ||
    value === ball + ' and x > 0' ||
    value === ball + ' and x < 0';
}

function matchShapeFormulaExample(formula, radius) {
  var value = String(formula == null ? '' : formula).trim();
  if (isHalfSphereFormula(formula, radius)) {
    return 'half';
  }
  if (value === hollowSphereFormula(radius)) {
    return 'hollow';
  }
  if (value === sphereFormula(radius)) {
    return 'solid';
  }
  return 'custom';
}

function normalizeFormula(formula) {
  var value = String(formula == null ? '' : formula).trim();
  if (!value) {
    throw new Error(
      'Shape formula is required. Use a boolean expression in x, y, and z ' +
      '(for example (x*x)+(y*y)+(z*z) < 1).'
    );
  }
  return value;
}

function ensureCompartmentFormula(compartment) {
  if (!compartment) {
    return compartment;
  }
  if (compartment.formula != null && String(compartment.formula).trim()) {
    compartment.formula = String(compartment.formula).trim();
    return compartment;
  }
  var radius = Number(compartment.radius);
  compartment.formula = Number.isFinite(radius) && radius > 0
    ? sphereFormula(radius)
    : sphereFormula(1);
  return compartment;
}

function fillGeometryFormula(compartment) {
  // SphericalLattice already clips particles to the outer radius, so the default
  // ball formula is equivalent to True for Fill. Keep True unless the user
  // edited the formula into a custom region (for example a shell).
  var formula = ensureCompartmentFormula(compartment).formula;
  var radius = Number(compartment.radius);
  if (formula === 'True' || formula === 'true') {
    return 'True';
  }
  if (Number.isFinite(radius) && radius > 0 && formula === sphereFormula(radius)) {
    return 'True';
  }
  return formula;
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

function compartmentLatticeKind(compartment) {
  return compartment && compartment.lattice === 'cylinder' ? 'cylinder' : 'sphere';
}

function compartmentLengthValue(compartment) {
  var length = Number(compartment && compartment.length);
  return Number.isFinite(length) && length > 0 ? length : 2;
}

function layoutInlineShapes(state) {
  var preset = getDensityPreset(state.density || 'low');
  var overlap = Number(preset.deltar) > 0 ? Number(preset.deltar) : Number(preset.deltas);
  var compartments = listCompartments(state);
  var cursor = 0;
  return compartments.map(function (compartment, index) {
    var radius = Number(compartment.radius) > 0 ? Number(compartment.radius) : 1;
    var lattice = compartmentLatticeKind(compartment);
    var half = lattice !== 'cylinder' && isHalfSphereFormula(compartment.formula, radius);
    var hasPrev = index > 0;
    var hasNext = index < compartments.length - 1;
    var facing = 'positive';
    if (half && hasNext && !hasPrev) {
      facing = 'negative';
    } else if (half && hasPrev && !hasNext) {
      facing = 'positive';
    }
    var width = lattice === 'cylinder'
      ? compartmentLengthValue(compartment)
      : (half ? radius : radius * 2);
    var left = index === 0 ? 0 : cursor - overlap;
    var right = left + width;
    var centerX = (left + right) / 2;
    if (half && facing === 'negative') {
      centerX = right;
    } else if (half && facing === 'positive') {
      centerX = left;
    }
    var role = lattice === 'cylinder' ? 'cylinder' : (half ? 'half-sphere' : 'sphere');
    if (half && facing === 'negative' && !hasPrev) {
      role = 'left cap';
    } else if (half && facing === 'positive' && !hasNext && hasPrev) {
      role = 'right cap';
    }
    var formula = compartment.formula && String(compartment.formula).trim()
      ? String(compartment.formula).trim()
      : sphereFormula(radius);
    if (lattice === 'cylinder') {
      formula = 'True';
    } else if (half) {
      formula = '(x*x)+(y*y)+(z*z) < ' + encodedRadiusSquared(radius) +
        (facing === 'negative' ? ' and x < 0' : ' and x > 0');
    } else if (matchShapeFormulaExample(formula, radius) === 'solid') {
      formula = 'True';
    }
    cursor = right;
    return {
      id: compartment.id,
      name: compartment.name,
      typeID: compartment.typeID,
      radius: radius,
      length: lattice === 'cylinder' ? width : 0,
      lattice: lattice,
      center: [centerX, 0, 0],
      role: role,
      formula: formula
    };
  });
}

function createInlineDomain(density, compartments) {
  var preset = getDensityPreset(density);
  var placed = layoutInlineShapes({
    density: density,
    compartments: (compartments || []).reduce(function (map, compartment) {
      map[compartment.id] = compartment;
      return map;
    }, {}),
    compartmentOrder: (compartments || []).map(function (compartment) {
      return compartment.id;
    })
  });
  if (placed.length === 0) {
    placed = layoutInlineShapes({
      density: density,
      compartments: {
        1: {
          id: 1,
          name: 'Domain',
          typeID: DOMAIN_TYPE_ID,
          radius: preset.radius,
          formula: sphereFormula(preset.radius),
          lattice: 'sphere'
        }
      },
      compartmentOrder: [1]
    });
  }

  var types = [{
    c: 10,
    fixed: false,
    mass: 1,
    name: 'Un-Assigned',
    nu: 0,
    rho: 1,
    typeID: 0,
    volume: 1
  }].concat(placed.map(function (shape) {
    return {
      c: 10,
      fixed: false,
      mass: 1,
      name: shape.name,
      nu: 0,
      rho: 1,
      typeID: shape.typeID,
      volume: 1
    };
  }));

  var usedNames = {};
  var shapes = [];
  var actions = [];
  var minX = 0;
  var maxX = 0;
  var maxRadius = 0;
  placed.forEach(function (shape, index) {
    var shapeName = shapeGeometryName(shape);
    if (usedNames[shapeName]) {
      shapeName = shapeName + '_' + shape.typeID;
    }
    usedNames[shapeName] = true;
    var reach = shape.lattice === 'cylinder' ? shape.length / 2 : shape.radius;
    minX = Math.min(minX, shape.center[0] - reach);
    maxX = Math.max(maxX, shape.center[0] + reach);
    maxRadius = Math.max(maxRadius, shape.radius);
    shapes.push({
      deltar: preset.deltar,
      deltas: preset.deltas,
      deltax: 0,
      deltay: 0,
      deltaz: 0,
      depth: 0,
      fillable: true,
      formula: shape.formula,
      height: 0,
      lattice: shape.lattice === 'cylinder' ? 'Cylindrical Lattice' : 'Spherical Lattice',
      length: shape.length,
      name: shapeName,
      radius: shape.radius,
      type: 'Standard',
      center: shape.center
    });
    actions.push(buildAction('Fill Action', index + 1, shapeName, shape.typeID));
  });

  return {
    actions: actions,
    arrangement: 'inline',
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
    x_lim: [minX, maxX],
    y_lim: [-maxRadius, maxRadius],
    z_lim: [-maxRadius, maxRadius]
  };
}

function createDomain(density, shape, compartments, arrangement) {
  if (arrangement === 'inline') {
    return createInlineDomain(density, compartments);
  }
  var domainShape = validateDomainShape(shape || 'sphere');
  if (domainShape === 'cylinder') {
    return createCylinderDomain();
  }

  var preset = getDensityPreset(density);
  var compartmentList = (compartments || []).length > 0
    ? compartments.map(function (compartment) {
      var radius = validateCompartmentRadius(
        compartment.radius == null ? preset.radius : compartment.radius
      );
      return {
        id: compartment.id,
        name: compartment.name,
        typeID: compartment.typeID,
        radius: radius,
        formula: compartment.formula && String(compartment.formula).trim()
          ? String(compartment.formula).trim()
          : sphereFormula(radius)
      };
    })
    : [{
      name: 'Domain',
      typeID: DOMAIN_TYPE_ID,
      radius: preset.radius,
      formula: sphereFormula(preset.radius)
    }];

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
    formula: fillGeometryFormula(outer),
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
      formula: ensureCompartmentFormula(compartment).formula,
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
    .map(function (record) {
      var condition = expandInitialCondition(record);
      if (state.arrangement === 'inline') {
        var compartment = state.compartments[record.compartmentId];
        if (compartment) {
          condition.types = [compartment.typeID];
        }
      }
      return condition;
    });
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
    domain: createDomain(
      state.density,
      state.shape,
      listCompartments(state),
      state.arrangement
    ),
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

function positiveDomainTypeIDs(model) {
  var ids = ((model.domain && model.domain.types) || []).filter(function (item) {
    return item && Number(item.typeID) > 0;
  }).map(function (item) {
    return Number(item.typeID);
  });
  return ids.length > 0 ? ids : [DOMAIN_TYPE_ID];
}

function diffusionPreviewModel(state) {
  var placed = listSpecies(state).filter(function (species) {
    return species.initialCount > 0;
  });
  if (placed.length === 0) {
    throw new Error(
      'Add a species, assign it to a shape, and set an initial particle count before running Diffusion.'
    );
  }
  var model = toSmdl(state);
  var allTypes = positiveDomainTypeIDs(model);
  var names = {};
  placed.forEach(function (species) {
    names[species.name] = true;
  });
  model.species = model.species.filter(function (species) {
    return names[species.name];
  }).map(function (species) {
    return Object.assign({}, species, {
      diffusionConst: 0.1,
      types: allTypes.slice()
    });
  });
  model.parameters = [];
  model.reactions = [];
  model.initialConditions = placed.map(function (species) {
    var compartment = state.compartments[species.compartmentId] || firstCompartment(state);
    var startType = compartment ? Number(compartment.typeID) : allTypes[0];
    if (allTypes.indexOf(startType) < 0) {
      startType = allTypes[0];
    }
    var exported = null;
    model.species.forEach(function (item) {
      if (item.name === species.name) {
        exported = item;
      }
    });
    return {
      icType: 'Scatter',
      annotation: '',
      count: species.initialCount,
      types: [startType],
      x: 0,
      y: 0,
      z: 0,
      specie: clone(exported)
    };
  });
  return model;
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
    if (geometry.lattice === 'Cylindrical Lattice') {
      state.compartments[compartmentId].lattice = 'cylinder';
    }
    if (Number(geometry.length) > 0) {
      state.compartments[compartmentId].length = Number(geometry.length);
    }
    if (geometry.formula && String(geometry.formula).trim() &&
        String(geometry.formula).trim() !== 'True') {
      state.compartments[compartmentId].formula = isHalfSphereFormula(geometry.formula, radius)
        ? halfSphereFormula(radius)
        : String(geometry.formula).trim();
    } else if (Number.isFinite(radius) && radius > 0) {
      state.compartments[compartmentId].formula = sphereFormula(radius);
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
    template_version: model.template_version || 1,
    arrangement: model.domain && model.domain.arrangement === 'inline' ? 'inline' : 'nested'
  };

  var shape = model.domain && model.domain.shapes && model.domain.shapes[0];
  if (state.arrangement !== 'inline' && model.domain &&
      (model.domain.particles || []).length > 0 &&
      !(model.domain.shapes || []).length) {
    state.shape = 'cylinder';
  } else if (state.arrangement !== 'inline' && shape && shape.lattice === 'Cylindrical Lattice') {
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

function setArrangement(state, arrangement) {
  state.arrangement = arrangement === 'inline' ? 'inline' : 'nested';
  if (state.arrangement === 'inline') {
    state.shape = 'sphere';
  }
  syncShapeModeling(state);
  return state;
}

var DOMAIN_EXAMPLES = [
  {
    id: 'nested-cell',
    label: 'Nested Cell',
    arrangement: 'nested',
    shapes: [
      { name: 'Cytoplasm', radius: 1, lattice: 'sphere', example: 'solid' },
      { name: 'Nucleus', radius: 0.4, lattice: 'sphere', example: 'solid' }
    ]
  },
  {
    id: 'ecoli-cell',
    label: 'E. coli Cell',
    arrangement: 'inline',
    shapes: [
      { name: 'RightCap', radius: 1, lattice: 'sphere', example: 'half' },
      { name: 'Cylinder', radius: 1, lattice: 'cylinder', length: 2, example: 'solid' },
      { name: 'LeftCap', radius: 1, lattice: 'sphere', example: 'half' }
    ]
  }
];

function applyDomainExample(state, exampleId) {
  var example = null;
  DOMAIN_EXAMPLES.forEach(function (item) {
    if (item.id === exampleId) {
      example = item;
    }
  });
  if (!example) {
    throw new Error('Unknown domain example: ' + exampleId);
  }
  state.shape = 'sphere';
  state.arrangement = example.arrangement === 'inline' ? 'inline' : 'nested';
  state.compartments = {};
  state.compartmentOrder = [];
  example.shapes.forEach(function (shape) {
    var radius = shape.radius;
    var id = allocateId(state);
    state.compartments[id] = {
      id: id,
      name: shape.name,
      typeID: nextCompartmentTypeID(state),
      radius: radius,
      formula: shape.example === 'half' ? halfSphereFormula(radius) : sphereFormula(radius),
      lattice: shape.lattice === 'cylinder' ? 'cylinder' : 'sphere',
      length: shape.length == null ? 2 : shape.length
    };
    state.compartmentOrder.push(id);
  });
  var fallbackId = state.compartmentOrder[0];
  sortedRecords(state.species).forEach(function (species) {
    species.compartmentId = fallbackId;
  });
  syncShapeModeling(state);
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
  ensureCylinderAnnihilation(state);
  syncModelSettings(state);
  return reaction;
}

function hasAnnihilationBetween(state, speciesIdA, speciesIdB) {
  return sortedRecords(state.reactions).some(function (reaction) {
    if (!reaction || (reaction.products || []).length > 0) {
      return false;
    }
    var reactantIds = (reaction.reactants || []).map(function (entry) {
      return Number(entry.speciesId);
    }).sort(function (a, b) { return a - b; });
    var expected = [Number(speciesIdA), Number(speciesIdB)].sort(function (a, b) {
      return a - b;
    });
    return reactantIds.length === 2 &&
      reactantIds[0] === expected[0] &&
      reactantIds[1] === expected[1];
  });
}

// Legacy 3D cylinder demo: once both ends create different species, add A + B → ∅
// so the fronts meet and clear in the Middle instead of filling the whole domain.
function ensureCylinderAnnihilation(state) {
  if (state.shape !== 'cylinder') {
    return null;
  }
  var creations = listCreationReactions(state);
  if (creations.length < 2) {
    return null;
  }
  var firstProduct = creations[0].products && creations[0].products[0];
  var secondProduct = creations[1].products && creations[1].products[0];
  if (!firstProduct || !secondProduct) {
    return null;
  }
  if (Number(firstProduct.speciesId) === Number(secondProduct.speciesId)) {
    return null;
  }
  if (hasAnnihilationBetween(state, firstProduct.speciesId, secondProduct.speciesId)) {
    return null;
  }

  var name = suggestReactionName(state);
  var rate = createParameterRecord(state, name + '_rate', 1);
  var reaction = createReactionRecord(state, {
    name: name,
    rateParameterId: rate.id,
    reactants: [
      { speciesId: firstProduct.speciesId, ratio: 1 },
      { speciesId: secondProduct.speciesId, ratio: 1 }
    ],
    products: []
  });
  reaction.massaction = true;
  reaction.propensity = '';
  reaction.odePropensity = '';
  reaction.types = [
    CYLINDER_TYPES.MIDDLE,
    CYLINDER_TYPES.EDGE1,
    CYLINDER_TYPES.EDGE2
  ];
  state.reactionOrder.push(reaction.id);
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
  FORMULA_EXAMPLES: clone(FORMULA_EXAMPLES),
  DOMAIN_EXAMPLES: clone(DOMAIN_EXAMPLES),
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
  setArrangement: setArrangement,
  applyDomainExample: applyDomainExample,
  layoutInlineShapes: layoutInlineShapes,
  speciesAssignedToCompartment: speciesAssignedToCompartment,
  suggestCompartmentName: suggestCompartmentName,
  suggestCompartmentRadius: suggestCompartmentRadius,
  sphereFormula: sphereFormula,
  halfSphereFormula: halfSphereFormula,
  hollowSphereFormula: hollowSphereFormula,
  shapeFormulaForExample: shapeFormulaForExample,
  matchShapeFormulaExample: matchShapeFormulaExample,
  suggestReactionName: suggestReactionName,
  suggestSpeciesName: suggestSpeciesName,
  toSmdl: toSmdl,
  diffusionPreviewModel: diffusionPreviewModel,
  updateCompartment: updateCompartment,
  updateReaction: updateReaction,
  updateSpecies: updateSpecies
};
