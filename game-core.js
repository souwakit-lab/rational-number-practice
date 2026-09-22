(function attachCore(root, factory) {
  const FractionClass = typeof module !== "undefined" && module.exports
    ? require("./vendor/fraction.min.js")
    : root.Fraction;
  const api = factory(FractionClass);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RationalGameCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore(FractionClass) {
  const LEVEL_XP = 300;

  function randomInt(min, max, rng) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function nonZeroInt(min, max, rng) {
    let value = 0;
    while (value === 0) value = randomInt(min, max, rng);
    return value;
  }

  function integerTex(value) {
    return value < 0 ? `-${Math.abs(value)}` : String(value);
  }

  function fractionTex(value) {
    const text = value.toFraction();
    const negative = text.startsWith("-");
    const unsigned = negative ? text.slice(1) : text;
    if (!unsigned.includes("/")) return `${negative ? "-" : ""}${unsigned}`;
    const [numerator, denominator] = unsigned.split("/");
    return `${negative ? "-" : ""}\\frac{${numerator}}{${denominator}}`;
  }

  function calculate(left, operator, right) {
    return operator === "+" ? left.add(right) : left.sub(right);
  }

  function generateQuestion(level, rng = Math.random) {
    const operator = rng() < 0.5 ? "+" : "-";
    if (level === 1) {
      const leftValue = nonZeroInt(-9, 9, rng);
      const rightValue = randomInt(1, 9, rng);
      const left = new FractionClass(leftValue);
      const right = new FractionClass(rightValue);
      return {
        level,
        type: "整數加減",
        tex: `${integerTex(leftValue)} ${operator} ${integerTex(rightValue)}`,
        answer: calculate(left, operator, right),
      };
    }

    if (level === 2) {
      const leftValue = nonZeroInt(-12, 12, rng);
      const rightValue = -randomInt(1, 12, rng);
      const left = new FractionClass(leftValue);
      const right = new FractionClass(rightValue);
      return {
        level,
        type: "括號與負數",
        tex: `${integerTex(leftValue)} ${operator} \\left(${integerTex(rightValue)}\\right)`,
        answer: calculate(left, operator, right),
      };
    }

    const left = new FractionClass(nonZeroInt(-9, 9, rng), randomInt(2, 9, rng));
    const right = new FractionClass(nonZeroInt(-9, 9, rng), randomInt(2, 9, rng));
    const rightTex = right.s < 0 ? `\\left(${fractionTex(right)}\\right)` : fractionTex(right);
    return {
      level: 3,
      type: "有理數分數",
      tex: `${fractionTex(left)} ${operator} ${rightTex}`,
      answer: calculate(left, operator, right),
    };
  }

  function parseAnswer(raw) {
    const text = String(raw || "").trim();
    if (!/^-?\d+(?:\/\d+)?$/.test(text)) return null;
    if (text.includes("/") && Number(text.split("/")[1]) === 0) return null;
    try {
      return new FractionClass(text);
    } catch {
      return null;
    }
  }

  function applyResult(progress, isCorrect) {
    const next = { ...progress };
    next.total += 1;
    if (isCorrect) {
      next.correct += 1;
      next.streak += 1;
      next.xp += 15;
    } else {
      next.streak = 0;
      next.xp = Math.max(0, next.xp - 10);
    }

    let leveledUp = false;
    let completed = false;
    if (next.xp >= LEVEL_XP) {
      if (next.level < 3) {
        next.xp -= LEVEL_XP;
        next.level += 1;
        leveledUp = true;
      } else {
        next.xp = LEVEL_XP;
        completed = true;
      }
    }
    return { progress: next, leveledUp, completed };
  }

  return { LEVEL_XP, generateQuestion, parseAnswer, fractionTex, applyResult };
});
