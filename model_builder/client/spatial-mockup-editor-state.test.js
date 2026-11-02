'use strict';

var assert = require('assert');
var editorState = require('./spatial-mockup-editor-state');

function speciesIdByName(state) {
  var byName = {};
  Object.keys(state.species).forEach(function (id) {
    byName[state.species[id].name] = state.species[id].id;
  });
  return byName;
}

function withDefaultSpecies(density) {
  return editorState.createEditorState({
    density: density || 'low',
    speciesNames: ['A', 'B', 'C', 'D']
  });
}

function testEmptyModelDefaults() {
  var state = editorState.createEditorState({ density: 'low' });

  assert.deepStrictEqual(editorState.listSpeciesNames(state), []);
  assert.deepStrictEqual(editorState.listReactions(state), []);
  assert.deepStrictEqual(state.parameters, {});
  assert.strictEqual(editorState.suggestSpeciesName(state), 'A');

  var model = editorState.toSmdl(state);
  assert.strictEqual(model.is_spatial, true);
  assert.strictEqual(model.defaultMode, 'discrete');
  assert.strictEqual(model.template_version, 1);
  assert.strictEqual(model.domain.template_version, 2);
  assert.deepStrictEqual(model.species, []);
  assert.deepStrictEqual(model.reactions, []);
  assert.deepStrictEqual(model.parameters, []);
  assert.deepStrictEqual(model.initialConditions, []);
  assert.deepStrictEqual(model.modelSettings, {
    endSim: 20,
    timeStep: 1,
    timestepSize: 0.05
  });
}

function testAddAndRemoveSpecies() {
  var state = editorState.createEditorState({ density: 'low' });

  var first = editorState.addSpecies(state, { name: 'A' });
  assert.strictEqual(first.name, 'A');
  assert.strictEqual(first.initialCount, 0);
  assert.strictEqual(editorState.suggestSpeciesName(state), 'B');

  editorState.addSpecies(state, { name: 'protein' });
  assert.deepStrictEqual(editorState.listSpeciesNames(state), ['A', 'protein']);

  assert.throws(function () {
    editorState.addSpecies(state, { name: 'A' });
  }, /already exists/);

  assert.throws(function () {
    editorState.addSpecies(state, { name: '1bad' });
  }, /Species names/);

  editorState.removeSpecies(state, first.id);
  assert.deepStrictEqual(editorState.listSpeciesNames(state), ['protein']);
  assert.strictEqual(editorState.suggestSpeciesName(state), 'A');

  var byName = speciesIdByName(state);
  editorState.addReaction(state, {
    name: 'r1',
    rateExpression: 1,
    products: [{ speciesId: byName.protein, ratio: 1 }]
  });
  assert.throws(function () {
    editorState.removeSpecies(state, byName.protein);
  }, /used by: r1/);
}

function testUpdateSpeciesAndInitialCount() {
  var state = editorState.createEditorState({ density: 'low' });
  var species = editorState.addSpecies(state, { name: 'A', initialCount: 10 });

  assert.strictEqual(species.initialCount, 10);
  assert.strictEqual(species.value, 10);

  editorState.updateSpecies(state, species.id, {
    name: 'Alpha',
    initialCount: 50
  });
  assert.strictEqual(state.species[species.id].name, 'Alpha');
  assert.strictEqual(state.species[species.id].initialCount, 50);
  assert.strictEqual(state.species[species.id].value, 50);

  var model = editorState.toSmdl(state);
  assert.strictEqual(model.initialConditions.length, 1);
  assert.strictEqual(model.initialConditions[0].icType, 'Scatter');
  assert.strictEqual(model.initialConditions[0].count, 50);
  assert.deepStrictEqual(model.initialConditions[0].types, [1]);
  assert.strictEqual(model.initialConditions[0].specie.name, 'Alpha');
  assert.strictEqual(model.species[0].value, 50);
  assert.strictEqual(model.domain.types[1].name, 'Domain');

  editorState.addSpecies(state, { name: 'B', initialCount: 20 });
  model = editorState.toSmdl(state);
  assert.strictEqual(model.initialConditions.length, 2);
  assert.deepStrictEqual(
    model.initialConditions.map(function (item) {
      return item.specie.name + ':' + item.count;
    }),
    ['Alpha:50', 'B:20']
  );

  editorState.updateSpecies(state, species.id, {
    name: 'Alpha',
    initialCount: 0
  });
  model = editorState.toSmdl(state);
  assert.strictEqual(model.initialConditions.length, 1);
  assert.strictEqual(model.initialConditions[0].specie.name, 'B');

  var restored = editorState.fromSmdl(editorState.toSmdl(state));
  assert.strictEqual(restored.species[species.id].initialCount, 0);
  assert.strictEqual(
    restored.species[Object.keys(restored.species).map(Number).sort()[1]].initialCount,
    20
  );
  assert.deepStrictEqual(editorState.toSmdl(restored), model);

  var high = editorState.addSpecies(state, { name: 'Gamma', initialCount: 5000 });
  assert.strictEqual(high.initialCount, 5000);

  assert.throws(function () {
    editorState.addSpecies(state, { name: 'Delta', initialCount: -1 });
  }, /Initial molecules/);

  assert.throws(function () {
    editorState.addSpecies(state, { name: 'Epsilon', initialCount: 1.5 });
  }, /Initial molecules/);

  assert.throws(function () {
    editorState.updateSpecies(state, species.id, {
      name: '1bad',
      initialCount: 10
    });
  }, /Species names/);
}

function testCompartmentsAndSpeciesAssignment() {
  var state = editorState.createEditorState({ density: 'low' });
  assert.deepStrictEqual(editorState.listCompartments(state).map(function (item) {
    return item.name;
  }), ['Domain']);

  var nucleus = editorState.addCompartment(state, { name: 'Nucleus' });
  var cytoplasm = editorState.addCompartment(state, { name: 'Cytoplasm' });
  assert.strictEqual(editorState.suggestCompartmentName(state), 'Membrane');
  assert.strictEqual(nucleus.radius, 0.8);
  assert.strictEqual(cytoplasm.radius, 0.8);
  assert.strictEqual(editorState.listCompartments(state)[0].radius, 1);

  var a = editorState.addSpecies(state, {
    name: 'A',
    initialCount: 10,
    compartmentId: nucleus.id
  });
  var b = editorState.addSpecies(state, {
    name: 'B',
    initialCount: 20,
    compartmentId: cytoplasm.id
  });

  assert.strictEqual(editorState.particlesAssignedToCompartment(state, nucleus.id), 10);
  assert.strictEqual(editorState.particlesAssignedToCompartment(state, cytoplasm.id), 20);
  assert.strictEqual(editorState.speciesAssignedToCompartment(state, nucleus.id).length, 1);

  editorState.updateSpecies(state, a.id, {
    name: 'A',
    initialCount: 50,
    compartmentId: cytoplasm.id
  });
  assert.strictEqual(editorState.particlesAssignedToCompartment(state, nucleus.id), 0);
  assert.strictEqual(editorState.particlesAssignedToCompartment(state, cytoplasm.id), 70);

  var model = editorState.toSmdl(state);
  assert.deepStrictEqual(model.domain.types.map(function (item) {
    return [item.typeID, item.name];
  }), [
    [0, 'Un-Assigned'],
    [1, 'Domain'],
    [2, 'Nucleus'],
    [3, 'Cytoplasm']
  ]);
  assert.deepStrictEqual(model.species[0].types, [3]);
  assert.deepStrictEqual(model.species[1].types, [3]);
  assert.deepStrictEqual(model.initialConditions[0].types, [3]);

  assert.throws(function () {
    editorState.removeCompartment(state, cytoplasm.id);
  }, /used by/);

  editorState.removeSpecies(state, a.id);
  editorState.removeSpecies(state, b.id);
  editorState.removeCompartment(state, cytoplasm.id);
  assert.deepStrictEqual(editorState.listCompartments(state).map(function (item) {
    return item.name;
  }), ['Domain', 'Nucleus']);

  editorState.addSpecies(state, {
    name: 'A',
    initialCount: 10,
    compartmentId: nucleus.id
  });
  var restored = editorState.fromSmdl(editorState.toSmdl(state));
  assert.deepStrictEqual(editorState.listCompartments(restored).map(function (item) {
    return item.name;
  }), ['Domain', 'Nucleus']);
  assert.strictEqual(
    editorState.listCompartments(restored).filter(function (item) {
      return item.name === 'Nucleus';
    })[0].typeID,
    2
  );
  var restoredSpecies = editorState.listSpecies(restored)[0];
  assert.strictEqual(
    restored.compartments[restoredSpecies.compartmentId].name,
    'Nucleus'
  );
  assert.deepStrictEqual(restoredSpecies.types, [2]);
  assert.strictEqual(
    restored.compartments[restoredSpecies.compartmentId].radius,
    0.8
  );
}

function testNestedSphereDomain() {
  var state = editorState.createEditorState({ density: 'low' });
  editorState.updateCompartment(state, editorState.listCompartments(state)[0].id, {
    name: 'Cytoplasm',
    radius: 1
  });
  var nucleus = editorState.addCompartment(state, { name: 'Nucleus', radius: 0.4 });
  editorState.addSpecies(state, {
    name: 'A',
    initialCount: 10,
    compartmentId: nucleus.id
  });
  editorState.addReaction(state, {
    name: 'r1',
    rateExpression: 1,
    products: [{ speciesId: editorState.listSpecies(state)[0].id, ratio: 1 }]
  });

  var model = editorState.toSmdl(state);
  assert.strictEqual(model.domain.shapes.length, 2);
  assert.strictEqual(model.domain.actions.length, 2);
  assert.strictEqual(model.domain.shapes[0].name, 'Cytoplasm');
  assert.strictEqual(model.domain.shapes[0].fillable, true);
  assert.strictEqual(model.domain.shapes[0].radius, 1);
  assert.strictEqual(model.domain.shapes[0].formula, 'True');
  assert.strictEqual(model.domain.shapes[1].name, 'Nucleus');
  assert.strictEqual(model.domain.shapes[1].fillable, false);
  assert.strictEqual(model.domain.shapes[1].radius, 0.4);
  assert.strictEqual(model.domain.shapes[1].formula, '(x*x)+(y*y)+(z*z) < 0.16');
  assert.strictEqual(
    editorState.listCompartments(state)[0].formula,
    '(x*x)+(y*y)+(z*z) < 1'
  );
  assert.strictEqual(nucleus.formula, '(x*x)+(y*y)+(z*z) < 0.16');
  assert.strictEqual(model.domain.actions[0].type, 'Fill Action');
  assert.strictEqual(model.domain.actions[0].shape, 'Cytoplasm');
  assert.strictEqual(model.domain.actions[0].typeID, 1);
  assert.strictEqual(model.domain.actions[1].type, 'Set Action');
  assert.strictEqual(model.domain.actions[1].shape, 'Nucleus');
  assert.strictEqual(model.domain.actions[1].typeID, 2);
  assert.deepStrictEqual(model.domain.x_lim, [-1, 1]);
  assert.deepStrictEqual(model.species[0].types, [2]);
  assert.deepStrictEqual(model.reactions[0].types, [2]);

  var restored = editorState.fromSmdl(model);
  assert.deepStrictEqual(editorState.listCompartments(restored).map(function (item) {
    return [item.name, item.radius];
  }), [
    ['Cytoplasm', 1],
    ['Nucleus', 0.4]
  ]);
  assert.deepStrictEqual(editorState.toSmdl(restored).domain.actions, model.domain.actions);

  assert.throws(function () {
    editorState.addCompartment(state, { name: 'TooBig', radius: 1 });
  }, /smaller radius/);
}

function testDensityPresets() {
  var expected = {
    low: { radius: 1, deltas: 0.5, deltar: 0.5 },
    medium: { radius: 1, deltas: 0.3, deltar: 0.2 },
    high: { radius: 1, deltas: 0.2, deltar: 0.1 }
  };

  Object.keys(expected).forEach(function (density) {
    var model = editorState.toSmdl(withDefaultSpecies(density));
    var shape = model.domain.shapes[0];

    assert.strictEqual(shape.lattice, 'Spherical Lattice');
    assert.strictEqual(shape.radius, expected[density].radius);
    assert.strictEqual(shape.deltas, expected[density].deltas);
    assert.strictEqual(shape.deltar, expected[density].deltar);
    assert.strictEqual(model.domain.actions[0].shape, shape.name);
    assert.strictEqual(model.domain.actions[0].typeID, 1);
  });

  assert.throws(function () {
    editorState.createEditorState({ density: 'invalid' });
  }, /Unknown spatial mockup density/);
}

function testCylinderDomain() {
  var state = editorState.createEditorState({ density: 'medium', shape: 'cylinder' });
  assert.strictEqual(state.shape, 'cylinder');

  var model = editorState.toSmdl(state);
  assert.strictEqual(model.domain.template_version, 1);
  assert.strictEqual(model.domain.particles.length, 1059);
  assert.deepStrictEqual(model.domain.x_lim, [-5, 5]);
  assert.deepStrictEqual(model.domain.y_lim, [-1, 1]);
  assert.deepStrictEqual(model.domain.z_lim, [-1, 1]);
  assert.ok(!model.domain.actions || model.domain.actions.length === 0);
  assert.strictEqual(model.domain.types.length, 4);
  assert.strictEqual(model.domain.types[1].name, 'Middle');

  editorState.setShape(state, 'sphere');
  model = editorState.toSmdl(state);
  assert.strictEqual(model.domain.shapes[0].lattice, 'Spherical Lattice');
  assert.deepStrictEqual(model.domain.x_lim, [-1, 1]);

  var restored = editorState.fromSmdl(editorState.toSmdl(
    editorState.createEditorState({ density: 'low', shape: 'cylinder' })
  ));
  assert.strictEqual(restored.shape, 'cylinder');
  assert.deepStrictEqual(editorState.toSmdl(restored), editorState.toSmdl(
    editorState.createEditorState({ density: 'low', shape: 'cylinder' })
  ));

  assert.throws(function () {
    editorState.setShape(state, 'cube');
  }, /Unknown domain shape/);
}

function testCylinderShapeModeling() {
  var state = editorState.createEditorState({ density: 'low', shape: 'cylinder' });
  editorState.addSpecies(state, { name: 'A' });
  var terms = editorState.buildTemplateTerms(state, 'creation');
  editorState.addReaction(state, {
    name: 'r1',
    rateExpression: 1,
    reactants: terms.reactants,
    products: terms.products
  });

  var model = editorState.toSmdl(state);
  assert.deepStrictEqual(model.species[0].types, [1, 2]);
  assert.strictEqual(model.species[0].diffusionConst, 0.1);
  assert.deepStrictEqual(model.reactions[0].types, [2]);
  assert.strictEqual(model.reactions[0].massaction, false);
  assert.strictEqual(model.reactions[0].propensity, 'r1_rate / left * vol');
  assert.strictEqual(model.reactions[0].odePropensity, 'r1_rate');
  assert.strictEqual(Number(model.parameters.find(function (parameter) {
    return parameter.name === 'r1_rate';
  }).expression), 100);
  assert.strictEqual(state.endSim, 100);
  assert.deepStrictEqual(model.modelSettings, {
    endSim: 100,
    timeStep: 1,
    timestepSize: 1
  });
  assert.ok(model.parameters.some(function (parameter) {
    return parameter.name === 'left';
  }));
  assert.ok(model.parameters.some(function (parameter) {
    return parameter.name === 'right';
  }));

  editorState.addSpecies(state, { name: 'B' });
  var bTerms = editorState.buildTemplateTerms(state, 'creation');
  // Prefer B as the creation product for the Edge2 reaction.
  bTerms.products = [{ speciesId: speciesIdByName(state).B, ratio: 1 }];
  editorState.addReaction(state, {
    name: 'r2',
    rateExpression: 1,
    reactants: bTerms.reactants,
    products: bTerms.products
  });
  model = editorState.toSmdl(state);
  assert.deepStrictEqual(model.species[0].types, [1, 2]);
  assert.deepStrictEqual(model.species[1].types, [1, 3]);
  assert.deepStrictEqual(model.reactions[0].types, [2]);
  assert.deepStrictEqual(model.reactions[1].types, [3]);
  assert.strictEqual(model.reactions[1].propensity, 'r2_rate / right * vol');
  assert.strictEqual(model.reactions[1].massaction, false);
  assert.strictEqual(model.reactions.length, 3);
  assert.strictEqual(model.reactions[2].massaction, true);
  assert.deepStrictEqual(
    model.reactions[2].reactants.map(function (entry) { return entry.specie.name; }).sort(),
    ['A', 'B']
  );
  assert.deepStrictEqual(model.reactions[2].products, []);
  assert.deepStrictEqual(model.reactions[2].types, [1, 2, 3]);

  editorState.setEndSim(state, 500);
  model = editorState.toSmdl(state);
  assert.strictEqual(model.modelSettings.endSim, 500);

  editorState.setShape(state, 'sphere');
  model = editorState.toSmdl(state);
  assert.deepStrictEqual(model.species[0].types, [1]);
  assert.strictEqual(model.species[0].diffusionConst, 0);
  assert.deepStrictEqual(model.reactions[0].types, [1]);
  assert.strictEqual(model.modelSettings.endSim, 500);
}

function testTemplateTerms() {
  var state = withDefaultSpecies('low');

  function describe(templateId) {
    var terms = editorState.buildTemplateTerms(state, templateId);
    function names(entries) {
      return entries.map(function (entry) {
        return entry.ratio + state.species[entry.speciesId].name;
      });
    }
    return names(terms.reactants).join('+') + '>' + names(terms.products).join('+');
  }

  assert.strictEqual(describe('creation'), '>1A');
  assert.strictEqual(describe('destruction'), '1A>');
  assert.strictEqual(describe('change'), '1A>1B');
  assert.strictEqual(describe('dimerization'), '2A>1B');
  assert.strictEqual(describe('merge'), '1A+1B>1C');
  assert.strictEqual(describe('split'), '1A>1B+1C');
  assert.strictEqual(describe('four'), '1A+1B>1C+1D');
  assert.strictEqual(describe('custom-massaction'), '1A>1B');

  assert.throws(function () {
    editorState.buildTemplateTerms(state, 'nope');
  }, /Unknown reaction template/);

  assert.throws(function () {
    editorState.buildTemplateTerms(
      editorState.createEditorState({ density: 'low' }),
      'creation'
    );
  }, /at least one species/);

  // Templates reuse the first species when the pool runs short.
  var small = editorState.createEditorState({ density: 'low', speciesNames: ['A', 'B'] });
  var terms = editorState.buildTemplateTerms(small, 'four');
  assert.deepStrictEqual(terms.products.map(function (entry) {
    return small.species[entry.speciesId].name;
  }), ['A', 'A']);
}

function testAddReactionFromTemplate() {
  var state = withDefaultSpecies('medium');

  var creation = editorState.addReaction(state, {
    name: editorState.suggestReactionName(state),
    rateExpression: 10,
    reactants: [],
    products: editorState.buildTemplateTerms(state, 'creation').products
  });
  assert.strictEqual(creation.name, 'r1');
  assert.strictEqual(editorState.formatReaction(state, creation), 'r1: \u2205 \u2192 A');
  assert.deepStrictEqual(state.modelSettings, {
    endSim: 20,
    timeStep: 1,
    timestepSize: 0.05
  });

  var mergeTerms = editorState.buildTemplateTerms(state, 'merge');
  var merge = editorState.addReaction(state, {
    name: editorState.suggestReactionName(state),
    rateExpression: 2.5,
    reactants: mergeTerms.reactants,
    products: mergeTerms.products
  });
  assert.strictEqual(merge.name, 'r2');
  assert.strictEqual(editorState.formatReaction(state, merge), 'r2: A + B \u2192 C');
  assert.deepStrictEqual(state.modelSettings, {
    endSim: 20,
    timeStep: 1,
    timestepSize: 0.01
  });

  var model = editorState.toSmdl(state);
  assert.deepStrictEqual(model.reactions.map(function (item) {
    return item.name;
  }), ['r1', 'r2']);
  assert.deepStrictEqual(model.parameters.map(function (item) {
    return [item.name, item.expression];
  }), [['r1_rate', 10], ['r2_rate', 2.5]]);
  assert.strictEqual(model.reactions[0].products[0].specie.name, 'A');
  assert.strictEqual(model.reactions[1].rate.name, 'r2_rate');
  assert.deepStrictEqual(model.reactions[1].reactants.map(function (item) {
    return item.specie.name;
  }), ['A', 'B']);
}

function testStoichiometryIsPreserved() {
  var state = withDefaultSpecies('low');
  var byName = speciesIdByName(state);

  var reaction = editorState.addReaction(state, {
    name: 'bind',
    rateExpression: 1,
    reactants: [
      { speciesId: byName.A, ratio: 2 },
      { speciesId: byName.B, ratio: 1 }
    ],
    products: [{ speciesId: byName.C, ratio: 3 }]
  });

  assert.strictEqual(editorState.formatReaction(state, reaction), 'bind: 2 A + B \u2192 3 C');

  var expanded = editorState.toSmdl(state).reactions[0];
  assert.strictEqual(expanded.reactants[0].ratio, 2);
  assert.strictEqual(expanded.reactants[0].specie.name, 'A');
  assert.strictEqual(expanded.products[0].ratio, 3);
  assert.strictEqual(expanded.products[0].specie.name, 'C');
}

function testRemoveReaction() {
  var state = withDefaultSpecies('low');
  var byName = speciesIdByName(state);

  var first = editorState.addReaction(state, {
    name: 'r1',
    rateExpression: 1,
    products: [{ speciesId: byName.A, ratio: 1 }]
  });
  editorState.addReaction(state, {
    name: 'r2',
    rateExpression: 1,
    products: [{ speciesId: byName.B, ratio: 1 }]
  });
  assert.strictEqual(Object.keys(state.parameters).length, 2);

  editorState.removeReaction(state, first.id);

  assert.deepStrictEqual(editorState.listReactions(state).map(function (item) {
    return item.name;
  }), ['r2']);
  assert.deepStrictEqual(Object.keys(state.parameters).map(function (id) {
    return state.parameters[id].name;
  }), ['r2_rate']);
  assert.deepStrictEqual(state.modelSettings, {
    endSim: 20,
    timeStep: 1,
    timestepSize: 0.05
  });
  // The freed name becomes available again.
  assert.strictEqual(editorState.suggestReactionName(state), 'r1');

  assert.throws(function () {
    editorState.removeReaction(state, 9999);
  }, /Unknown reaction id/);
}

function testUpdateReaction() {
  var state = withDefaultSpecies('low');
  var byName = speciesIdByName(state);
  var reaction = editorState.addReaction(state, {
    name: 'r1',
    rateExpression: 1,
    products: [{ speciesId: byName.A, ratio: 1 }]
  });

  editorState.updateReaction(state, reaction.id, {
    name: 'bind',
    rateExpression: 2.5,
    reactants: [{ speciesId: byName.A, ratio: 1 }],
    products: [{ speciesId: byName.B, ratio: 1 }]
  });

  assert.strictEqual(
    editorState.formatReaction(state, state.reactions[reaction.id]),
    'bind: A \u2192 B'
  );
  assert.strictEqual(state.parameters[reaction.rateParameterId].name, 'bind_rate');
  assert.strictEqual(state.parameters[reaction.rateParameterId].expression, 2.5);

  assert.throws(function () {
    editorState.updateReaction(state, reaction.id, {
      name: 'bad name',
      rateExpression: 1,
      products: [{ speciesId: byName.A, ratio: 1 }]
    });
  }, /Reaction names/);
}

function testRoundTrip() {
  var state = withDefaultSpecies('high');
  var byName = speciesIdByName(state);
  editorState.updateSpecies(state, byName.A, { name: 'A', initialCount: 10 });
  var terms = editorState.buildTemplateTerms(state, 'merge');
  editorState.addReaction(state, {
    name: 'r1',
    rateExpression: 4,
    reactants: terms.reactants,
    products: terms.products
  });
  var model = editorState.toSmdl(state);

  var restored = editorState.fromSmdl(model);
  assert.strictEqual(restored.density, 'high');
  assert.deepStrictEqual(editorState.listSpeciesNames(restored), ['A', 'B', 'C', 'D']);
  assert.deepStrictEqual(editorState.toSmdl(restored), model);
}

function testValidation() {
  var state = withDefaultSpecies('low');
  var byName = speciesIdByName(state);
  editorState.addReaction(state, {
    name: 'r1',
    rateExpression: 1,
    products: [{ speciesId: byName.A, ratio: 1 }]
  });

  assert.throws(function () {
    editorState.addReaction(state, {
      name: 'r1',
      rateExpression: 1,
      products: [{ speciesId: byName.A, ratio: 1 }]
    });
  }, /already exists/);

  assert.throws(function () {
    editorState.addReaction(state, {
      name: 'bad reaction',
      rateExpression: 1,
      products: [{ speciesId: byName.A, ratio: 1 }]
    });
  }, /Reaction names/);

  assert.throws(function () {
    editorState.addReaction(state, {
      name: 'empty',
      rateExpression: 1,
      reactants: [],
      products: []
    });
  }, /at least one/);

  assert.throws(function () {
    editorState.addReaction(state, {
      name: 'bad_stoich',
      rateExpression: 1,
      products: [{ speciesId: byName.A, ratio: 0 }]
    });
  }, /positive integer/);

  assert.throws(function () {
    editorState.addReaction(state, {
      name: 'bad_rate',
      rateExpression: -1,
      products: [{ speciesId: byName.A, ratio: 1 }]
    });
  }, /non-negative number/);

  assert.throws(function () {
    editorState.addReaction(state, {
      name: 'unknown_species',
      rateExpression: 1,
      products: [{ speciesId: 9999, ratio: 1 }]
    });
  }, /unknown species id/);
}

function testCustomShapeFormula() {
  var state = editorState.createEditorState({ density: 'low' });
  var domain = editorState.listCompartments(state)[0];
  assert.strictEqual(domain.formula, editorState.sphereFormula(1));

  editorState.updateCompartment(state, domain.id, {
    name: 'Shell',
    radius: 1,
    formula: '(x*x)+(y*y)+(z*z) < 1 and (x*x)+(y*y)+(z*z) > 0.25'
  });
  var model = editorState.toSmdl(state);
  assert.strictEqual(
    model.domain.shapes[0].formula,
    '(x*x)+(y*y)+(z*z) < 1 and (x*x)+(y*y)+(z*z) > 0.25'
  );

  // Changing radius alone keeps a customized formula.
  editorState.updateCompartment(state, domain.id, {
    name: 'Shell',
    radius: 0.8
  });
  assert.strictEqual(
    editorState.listCompartments(state)[0].formula,
    '(x*x)+(y*y)+(z*z) < 1 and (x*x)+(y*y)+(z*z) > 0.25'
  );

  // Default formula tracks radius until customized.
  var nucleus = editorState.addCompartment(state, { name: 'Nucleus', radius: 0.4 });
  assert.strictEqual(nucleus.formula, editorState.sphereFormula(0.4));
  editorState.updateCompartment(state, nucleus.id, {
    name: 'Nucleus',
    radius: 0.2
  });
  assert.strictEqual(
    editorState.listCompartments(state).find(function (item) {
      return item.name === 'Nucleus';
    }).formula,
    editorState.sphereFormula(0.2)
  );
}

function testFormulaExamplesScaleWithRadius() {
  assert.strictEqual(
    editorState.halfSphereFormula(0.7),
    '(x*x)+(y*y)+(z*z) < 0.49 and z > 0'
  );
  assert.strictEqual(
    editorState.hollowSphereFormula(1),
    '(x*x)+(y*y)+(z*z) < 1 and (x*x)+(y*y)+(z*z) > 0.16'
  );
  assert.strictEqual(
    editorState.hollowSphereFormula(0.7),
    '(x*x)+(y*y)+(z*z) < 0.49 and (x*x)+(y*y)+(z*z) > 0.0784'
  );
  assert.strictEqual(editorState.shapeFormulaForExample('solid', 0.7), editorState.sphereFormula(0.7));
  assert.strictEqual(editorState.matchShapeFormulaExample(editorState.halfSphereFormula(0.7), 0.7), 'half');
  assert.strictEqual(editorState.matchShapeFormulaExample('z > 0', 0.7), 'custom');
}

function testInlineEcoliLayout() {
  var state = editorState.createEditorState({ density: 'low' });
  editorState.setArrangement(state, 'inline');
  var left = editorState.listCompartments(state)[0];
  editorState.updateCompartment(state, left.id, {
    name: 'LeftCap',
    radius: 1,
    lattice: 'sphere',
    formula: editorState.halfSphereFormula(1)
  });
  var body = editorState.addCompartment(state, {
    name: 'Body',
    radius: 1,
    lattice: 'cylinder',
    length: 2
  });
  editorState.addCompartment(state, {
    name: 'RightCap',
    radius: 1,
    lattice: 'sphere',
    formula: editorState.halfSphereFormula(1)
  });
  editorState.addSpecies(state, {
    name: 'A',
    initialCount: 10,
    compartmentId: body.id
  });

  var model = editorState.toSmdl(state);
  assert.strictEqual(model.domain.arrangement, 'inline');
  assert.strictEqual(model.domain.actions.length, 3);
  model.domain.actions.forEach(function (action) {
    assert.strictEqual(action.type, 'Fill Action');
  });
  assert.strictEqual(model.domain.shapes[0].formula, '(x*x)+(y*y)+(z*z) < 1 and x < 0');
  assert.deepStrictEqual(model.domain.shapes[0].center, [1, 0, 0]);
  assert.strictEqual(model.domain.shapes[1].lattice, 'Cylindrical Lattice');
  assert.strictEqual(model.domain.shapes[1].length, 2);
  assert.deepStrictEqual(model.domain.shapes[1].center, [1.5, 0, 0]);
  assert.strictEqual(model.domain.shapes[2].formula, '(x*x)+(y*y)+(z*z) < 1 and x > 0');
  assert.deepStrictEqual(model.domain.shapes[2].center, [2, 0, 0]);
  assert.strictEqual(model.species[0].diffusionConst, 0.1);
  assert.deepStrictEqual(model.species[0].types, [1, 2, 3]);
  assert.deepStrictEqual(model.initialConditions[0].types, [2]);

  var restored = editorState.fromSmdl(model);
  assert.strictEqual(restored.arrangement, 'inline');
  assert.strictEqual(editorState.listCompartments(restored)[1].lattice, 'cylinder');
  assert.strictEqual(
    editorState.matchShapeFormulaExample(editorState.listCompartments(restored)[0].formula, 1),
    'half'
  );
}

function testDiffusionPreviewUsesAssignedSpecies() {
  var empty = editorState.createEditorState({ density: 'low' });
  assert.throws(function () {
    editorState.diffusionPreviewModel(empty);
  }, /initial particle count/);

  var single = editorState.createEditorState({ density: 'low' });
  editorState.addSpecies(single, { name: 'A', initialCount: 20 });
  var singleModel = editorState.diffusionPreviewModel(single);
  assert.strictEqual(singleModel.species.length, 1);
  assert.strictEqual(singleModel.species[0].name, 'A');
  assert.strictEqual(singleModel.species[0].diffusionConst, 0.1);
  assert.deepStrictEqual(singleModel.species[0].types, [1]);
  assert.strictEqual(singleModel.reactions.length, 0);
  assert.strictEqual(singleModel.initialConditions.length, 1);
  assert.strictEqual(singleModel.initialConditions[0].icType, 'Scatter');
  assert.strictEqual(singleModel.initialConditions[0].count, 20);
  assert.deepStrictEqual(singleModel.initialConditions[0].types, [1]);

  var nested = editorState.createEditorState({ density: 'low' });
  editorState.applyDomainExample(nested, 'nested-cell');
  var nucleus = editorState.listCompartments(nested)[1];
  editorState.addSpecies(nested, {
    name: 'A',
    initialCount: 10,
    compartmentId: nucleus.id
  });
  var nestedModel = editorState.diffusionPreviewModel(nested);
  assert.deepStrictEqual(nestedModel.species[0].types, [1, 2]);
  assert.deepStrictEqual(nestedModel.initialConditions[0].types, [nucleus.typeID]);
  assert.strictEqual(nestedModel.initialConditions[0].count, 10);

  var state = editorState.createEditorState({ density: 'low' });
  editorState.applyDomainExample(state, 'ecoli-cell');
  var caps = editorState.listCompartments(state);
  editorState.addSpecies(state, {
    name: 'A',
    initialCount: 10,
    compartmentId: caps[0].id
  });
  editorState.addSpecies(state, {
    name: 'B',
    initialCount: 0,
    compartmentId: caps[2].id
  });
  var model = editorState.diffusionPreviewModel(state);
  assert.strictEqual(model.species.length, 1);
  assert.strictEqual(model.species[0].name, 'A');
  assert.strictEqual(model.species[0].diffusionConst, 0.1);
  assert.deepStrictEqual(model.species[0].types, [1, 2, 3]);
  assert.strictEqual(model.reactions.length, 0);
  assert.strictEqual(model.parameters.length, 0);
  assert.strictEqual(model.initialConditions[0].icType, 'Scatter');
  assert.strictEqual(model.initialConditions[0].count, 10);
  assert.deepStrictEqual(model.initialConditions[0].types, [caps[0].typeID]);
  assert.deepStrictEqual(editorState.listSpeciesNames(state), ['A', 'B']);
}

function testDomainExamples() {
  var state = editorState.createEditorState({ density: 'low' });
  editorState.addSpecies(state, { name: 'A', initialCount: 10 });
  editorState.applyDomainExample(state, 'nested-cell');
  var nested = editorState.listCompartments(state);
  assert.strictEqual(state.arrangement, 'nested');
  assert.deepStrictEqual(nested.map(function (item) { return item.name; }), ['Cytoplasm', 'Nucleus']);
  assert.strictEqual(nested[0].radius, 1);
  assert.strictEqual(nested[1].radius, 0.4);
  assert.strictEqual(nested[0].formula, editorState.sphereFormula(1));
  assert.strictEqual(nested[1].formula, editorState.sphereFormula(0.4));
  assert.strictEqual(editorState.listSpecies(state)[0].compartmentId, nested[0].id);

  var model = editorState.toSmdl(state);
  assert.strictEqual(model.domain.shapes[0].fillable, true);
  assert.strictEqual(model.domain.actions[1].type, 'Set Action');

  editorState.applyDomainExample(state, 'ecoli-cell');
  var ecoli = editorState.listCompartments(state);
  assert.strictEqual(state.arrangement, 'inline');
  assert.deepStrictEqual(ecoli.map(function (item) { return item.name; }), [
    'RightCap', 'Cylinder', 'LeftCap'
  ]);
  assert.strictEqual(ecoli[1].lattice, 'cylinder');
  assert.strictEqual(ecoli[1].length, 2);
  assert.strictEqual(ecoli[0].formula, editorState.halfSphereFormula(1));
  assert.strictEqual(ecoli[2].formula, editorState.halfSphereFormula(1));
  var preview = editorState.toSmdl(state);
  assert.strictEqual(preview.domain.shapes.length, 3);
  assert.strictEqual(preview.domain.shapes[0].formula, '(x*x)+(y*y)+(z*z) < 1 and x < 0');
  assert.strictEqual(preview.domain.shapes[2].formula, '(x*x)+(y*y)+(z*z) < 1 and x > 0');
  assert.strictEqual(preview.domain.shapes[1].lattice, 'Cylindrical Lattice');
}

function run() {
  testEmptyModelDefaults();
  testAddAndRemoveSpecies();
  testUpdateSpeciesAndInitialCount();
  testCompartmentsAndSpeciesAssignment();
  testNestedSphereDomain();
  testCustomShapeFormula();
  testFormulaExamplesScaleWithRadius();
  testInlineEcoliLayout();
  testDiffusionPreviewUsesAssignedSpecies();
  testDomainExamples();
  testDensityPresets();
  testCylinderDomain();
  testCylinderShapeModeling();
  testTemplateTerms();
  testAddReactionFromTemplate();
  testStoichiometryIsPreserved();
  testRemoveReaction();
  testUpdateReaction();
  testRoundTrip();
  testValidation();
  console.log('spatial-mockup-editor-state tests passed');
}

run();
