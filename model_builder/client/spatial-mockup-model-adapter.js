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

var DENSITY_PRESETS = {
  low: { radius: 1, deltas: 0.5, deltar: 0.5 },
  medium: { radius: 1, deltas: 0.3, deltar: 0.2 },
  high: { radius: 1, deltas: 0.2, deltar: 0.1 }
};

var DOMAIN_TYPE_ID = 1;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDensityPreset(density) {
  if (!Object.prototype.hasOwnProperty.call(DENSITY_PRESETS, density)) {
    throw new Error('Unknown spatial mockup density: ' + density);
  }
  return clone(DENSITY_PRESETS[density]);
}

function createSpecies(name, compID) {
  return {
    compID: compID,
    name: name,
    value: 0,
    mode: 'discrete',
    switchTol: 0.03,
    switchMin: 100,
    isSwitchTol: true,
    annotation: '',
    diffusionConst: 0,
    types: [DOMAIN_TYPE_ID]
  };
}

function createParameter(name, expression, compID) {
  return {
    compID: compID,
    name: name,
    expression: expression,
    annotation: ''
  };
}

function createStoichSpecies(species) {
  return {
    ratio: 1,
    specie: clone(species)
  };
}

function createReaction(name, compID, rate, reactants, products) {
  return {
    compID: compID,
    name: name,
    massaction: true,
    odePropensity: '',
    propensity: '',
    annotation: '',
    types: [DOMAIN_TYPE_ID],
    rate: clone(rate),
    reactants: reactants.map(createStoichSpecies),
    products: products.map(createStoichSpecies)
  };
}

function createDomain(density) {
  var preset = getDensityPreset(density);

  return {
    actions: [{
      type: 'Fill Action',
      scope: 'Multi Particle',
      priority: 1,
      enable: true,
      shape: 'sphere',
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
      typeID: DOMAIN_TYPE_ID,
      vol: 1
    }],
    boundary_condition: {
      reflect_x: true,
      reflect_y: true,
      reflect_z: true
    },
    c_0: 10,
    gravity: [0, 0, 0],
    p_0: 100,
    rho_0: 1,
    shapes: [{
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
      name: 'sphere',
      radius: preset.radius,
      type: 'Standard'
    }],
    size: null,
    static: true,
    template_version: 2,
    transformations: [],
    types: [{
      c: 10,
      fixed: false,
      mass: 1,
      name: 'Un-Assigned',
      nu: 0,
      rho: 1,
      typeID: 0,
      volume: 1
    }, {
      c: 10,
      fixed: false,
      mass: 1,
      name: 'type1',
      nu: 0,
      rho: 1,
      typeID: DOMAIN_TYPE_ID,
      volume: 1
    }],
    x_lim: [-1, 1],
    y_lim: [-1, 1],
    z_lim: [-1, 1]
  };
}

function createComponents(reactionCount, nextID) {
  var speciesNames = ['A'];
  if (reactionCount >= 2) speciesNames.push('B');
  if (reactionCount >= 3) speciesNames.push('C');

  var species = speciesNames.map(function (name) {
    return createSpecies(name, nextID());
  });
  var byName = {};
  species.forEach(function (item) {
    byName[item.name] = item;
  });

  var parameters;
  if (reactionCount < 3) {
    parameters = [createParameter('P', 10, nextID())];
  } else {
    parameters = [
      createParameter('k1', 1, nextID()),
      createParameter('k2', 0.5, nextID()),
      createParameter('k3', 10000, nextID())
    ];
  }

  var reactions = [
    createReaction('r1', nextID(), parameters[0], [], [byName.A])
  ];
  if (reactionCount >= 2) {
    reactions.push(createReaction(
      'r2',
      nextID(),
      reactionCount < 3 ? parameters[0] : parameters[1],
      [],
      [byName.B]
    ));
  }
  if (reactionCount >= 3) {
    reactions.push(createReaction(
      'r3',
      nextID(),
      parameters[2],
      [byName.A, byName.B],
      [byName.C]
    ));
  }

  return {
    species: species,
    parameters: parameters,
    reactions: reactions
  };
}

function buildSpatialMockupModel(options) {
  var config = options || {};
  var density = config.density || 'low';
  var reactionCount = Number(config.reactionCount || 1);

  getDensityPreset(density);
  if ([1, 2, 3].indexOf(reactionCount) < 0) {
    throw new Error('Spatial mockup reactionCount must be 1, 2, or 3.');
  }

  var currentID = 1;
  function nextID() {
    var id = currentID;
    currentID += 1;
    return id;
  }

  var components = createComponents(reactionCount, nextID);
  var modelSettings;
  if (reactionCount > 1) {
    modelSettings = {
      endSim: 20,
      timeStep: 0.05,
      timestepSize: 0.01
    };
  } else {
    modelSettings = {
      endSim: 20,
      timeStep: 1,
      timestepSize: 0.05
    };
  }

  return {
    is_spatial: true,
    defaultID: currentID,
    defaultMode: 'discrete',
    annotation: 'Created by the spatial model mockup.',
    volume: 1,
    modelSettings: modelSettings,
    domain: createDomain(density),
    species: components.species,
    initialConditions: [],
    parameters: components.parameters,
    reactions: components.reactions,
    refLinks: [],
    rules: [],
    eventsCollection: [],
    functionDefinitions: [],
    boundaryConditions: [],
    template_version: 1
  };
}

module.exports = {
  DENSITY_PRESETS: clone(DENSITY_PRESETS),
  buildSpatialMockupModel: buildSpatialMockupModel,
  getDensityPreset: getDensityPreset
};
