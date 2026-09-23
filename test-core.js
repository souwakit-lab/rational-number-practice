const assert = require("node:assert/strict");
const core = require("./game-core.js");
const mathRenderer = require("./math-renderer.js");

assert.equal(core.LEVEL_XP, 500);

const fixed = (values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

const level1 = core.generateQuestion(1, fixed([0.1, 0.25, 0.5]));
assert.equal(level1.level, 1);
assert.ok(!level1.tex.includes("left("));

const level2 = core.generateQuestion(2, fixed([0.1, 0.25, 0.5]));
assert.equal(level2.level, 2);
assert.ok(!level2.tex.includes("\\left("));
assert.ok(level2.tex.split(" ").some((part) => Math.abs(Number(part)) >= 10));

const level3 = core.generateQuestion(3, fixed([0.1, 0.2, 0.3, 0.7, 0.5]));
assert.equal(level3.level, 3);
assert.match(level3.tex, /\\left\(-/);

const level4 = core.generateQuestion(4, fixed([0.1, 0.2, 0.3, 0.7, 0.5]));
assert.equal(level4.level, 4);
assert.match(level4.tex, /\\frac/);

for (let index = 0; index < 250; index += 1) {
  const one = core.generateQuestion(1);
  const oneNumbers = one.tex.match(/-?\d+/g).map(Number);
  assert.ok(oneNumbers.every((value) => Math.abs(value) <= 10));

  const two = core.generateQuestion(2);
  const twoNumbers = two.tex.match(/-?\d+/g).map(Number);
  assert.ok(twoNumbers.every((value) => Math.abs(value) <= 40));
  assert.ok(twoNumbers.some((value) => Math.abs(value) >= 10));

  const three = core.generateQuestion(3);
  const threeNumbers = three.tex.match(/-?\d+/g).map(Number);
  assert.match(three.tex, /\\left\(-/);
  assert.ok(threeNumbers.every((value) => Math.abs(value) <= 40));

  assert.match(core.generateQuestion(4).tex, /\\frac/);
}
assert.deepEqual(mathRenderer.tokenize("-\\frac{3}{4} + \\left(-2\\right)"), [
  { type: "text", value: "−" },
  { type: "fraction", numerator: "3", denominator: "4" },
  { type: "text", value: " + (−2)" },
]);
assert.equal(mathRenderer.plainText("-\\frac{3}{4}"), "−3/4");
assert.equal(mathRenderer.plainText("\\frac{\\square}{5}"), "□/5");

assert.equal(core.parseAnswer("-3/4").toFraction(), "-3/4");
assert.equal(core.parseAnswer("6/8").toFraction(), "3/4");
assert.equal(core.parseAnswer("2/0"), null);
assert.equal(core.parseAnswer("1.5"), null);

let progress = { level: 1, xp: 495, total: 0, correct: 0, streak: 0 };
let result = core.applyResult(progress, true);
assert.equal(result.progress.level, 2);
assert.equal(result.progress.xp, 10);
assert.equal(result.leveledUp, true);

progress = { level: 2, xp: 5, total: 1, correct: 1, streak: 1 };
result = core.applyResult(progress, false);
assert.equal(result.progress.xp, 0);
assert.equal(result.progress.streak, 0);

progress = { level: 4, xp: 495, total: 0, correct: 0, streak: 0 };
result = core.applyResult(progress, true);
assert.equal(result.progress.level, 4);
assert.equal(result.progress.xp, 500);
assert.equal(result.completed, true);

console.log("All rational-number core tests passed.");
