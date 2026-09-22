const assert = require("node:assert/strict");
const core = require("./game-core.js");

const fixed = (values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

const level1 = core.generateQuestion(1, fixed([0.1, 0.25, 0.5]));
assert.equal(level1.level, 1);
assert.ok(!level1.tex.includes("left("));

const level2 = core.generateQuestion(2, fixed([0.1, 0.25, 0.5]));
assert.equal(level2.level, 2);
assert.match(level2.tex, /\\left\(-/);

const level3 = core.generateQuestion(3, fixed([0.1, 0.2, 0.3, 0.7, 0.5]));
assert.equal(level3.level, 3);
assert.match(level3.tex, /\\frac/);

assert.equal(core.parseAnswer("-3/4").toFraction(), "-3/4");
assert.equal(core.parseAnswer("6/8").toFraction(), "3/4");
assert.equal(core.parseAnswer("2/0"), null);
assert.equal(core.parseAnswer("1.5"), null);

let progress = { level: 1, xp: 295, total: 0, correct: 0, streak: 0 };
let result = core.applyResult(progress, true);
assert.equal(result.progress.level, 2);
assert.equal(result.progress.xp, 10);
assert.equal(result.leveledUp, true);

progress = { level: 2, xp: 5, total: 1, correct: 1, streak: 1 };
result = core.applyResult(progress, false);
assert.equal(result.progress.xp, 0);
assert.equal(result.progress.streak, 0);

console.log("All rational-number core tests passed.");
