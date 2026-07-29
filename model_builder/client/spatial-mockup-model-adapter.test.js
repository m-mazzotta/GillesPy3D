'use strict';

var assert = require('assert');
var adapter = require('./spatial-mockup-model-adapter');

function testDensityPresets() {
  var expected = {
    low: { radius: 1, deltas: 0.5, deltar: 0.5 },
    medium: { radius: 1, deltas: 0.3, deltar: 0.2 },
    high: { radius: 1, deltas: 0.2, deltar: 0.1 }
  };
  var expectedSettings = {
    low: { endSim: 20, timeStep: 1, timestepSize: 0.05 },
    medium: { endSim: 20, timeStep: 1, timestepSize: 0.05 },
    high: { endSim: 20, timeStep: 1, timestepSize: 0.05 }
  };

  Object.keys(expected).forEach(function (density) {
    var model = adapter.buildSpatialMockupModel({
      density: density,
      reactionCount: 1
    });
    var shape = model.domain.shapes[0];

    assert.strictEqual(shape.lattice, 'Spherical Lattice');
    assert.strictEqual(shape.radius, expected[density].radius);
    assert.strictEqual(shape.deltas, expected[density].deltas);
    assert.strictEqual(shape.deltar, expected[density].deltar);
    assert.strictEqual(model.domain.actions[0].shape, shape.name);
    assert.strictEqual(model.domain.actions[0].typeID, 1);
    assert.deepStrictEqual(model.modelSettings, expectedSettings[density]);
  });
}

function testCanonicalModelShape() {
  var model = adapter.buildSpatialMockupModel({
    density: 'low',
    reactionCount: 1
  });

  assert.strictEqual(model.is_spatial, true);
  assert.strictEqual(model.defaultMode, 'discrete');
  assert.strictEqual(model.template_version, 1);
  assert.strictEqual(model.domain.template_version, 2);
  assert.deepStrictEqual(model.initialConditions, []);
  assert.deepStrictEqual(model.boundaryConditions, []);
  assert.deepStrictEqual(model.species.map(function (item) {
    return item.name;
  }), ['A']);
  assert.deepStrictEqual(model.parameters.map(function (item) {
    return [item.name, item.expression];
  }), [['P', 10]]);
  assert.strictEqual(model.reactions[0].products[0].specie.name, 'A');
  assert.strictEqual(model.reactions[0].rate.name, 'P');
  assert.strictEqual(model.defaultID, 4);
}

function testReactionModels() {
  var twoReactionModel = adapter.buildSpatialMockupModel({
    density: 'low',
    reactionCount: 2
  });

  assert.deepStrictEqual(twoReactionModel.species.map(function (item) {
    return item.name;
  }), ['A', 'B']);
  assert.deepStrictEqual(twoReactionModel.reactions.map(function (item) {
    return item.name;
  }), ['r1', 'r2']);
  assert.strictEqual(twoReactionModel.reactions[1].products[0].specie.name, 'B');
  assert.strictEqual(twoReactionModel.defaultID, 6);
  assert.deepStrictEqual(twoReactionModel.modelSettings, {
    endSim: 20,
    timeStep: 0.05,
    timestepSize: 0.01
  });

  var threeReactionModel = adapter.buildSpatialMockupModel({
    density: 'high',
    reactionCount: 3
  });

  assert.deepStrictEqual(threeReactionModel.species.map(function (item) {
    return item.name;
  }), ['A', 'B', 'C']);
  assert.deepStrictEqual(threeReactionModel.parameters.map(function (item) {
    return [item.name, item.expression];
  }), [['k1', 1], ['k2', 0.5], ['k3', 10000]]);
  assert.deepStrictEqual(threeReactionModel.reactions[2].reactants.map(function (item) {
    return item.specie.name;
  }), ['A', 'B']);
  assert.strictEqual(threeReactionModel.reactions[2].products[0].specie.name, 'C');
  assert.strictEqual(threeReactionModel.reactions[2].rate.name, 'k3');
  assert.strictEqual(threeReactionModel.defaultID, 10);
  assert.deepStrictEqual(threeReactionModel.modelSettings, {
    endSim: 20,
    timeStep: 0.05,
    timestepSize: 0.01
  });
}

function testValidation() {
  assert.throws(function () {
    adapter.buildSpatialMockupModel({ density: 'invalid', reactionCount: 1 });
  }, /Unknown spatial mockup density/);

  assert.throws(function () {
    adapter.buildSpatialMockupModel({ density: 'low', reactionCount: 4 });
  }, /reactionCount must be 1, 2, or 3/);
}

testDensityPresets();
testCanonicalModelShape();
testReactionModels();
testValidation();

console.log('Spatial mockup model adapter tests passed.');
