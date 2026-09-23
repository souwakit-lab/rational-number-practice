(function attachMathRenderer(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RationalMathRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMathRenderer() {
  function displayText(value) {
    return String(value || "")
      .replace(/\\left/g, "")
      .replace(/\\right/g, "")
      .replace(/\\square/g, "□")
      .replace(/-/g, "−");
  }

  function tokenize(tex) {
    const source = String(tex || "").replace(/\\left/g, "").replace(/\\right/g, "");
    const tokens = [];
    const fractionPattern = /\\frac\{([^{}]*)\}\{([^{}]*)\}/g;
    let cursor = 0;
    let match;
    while ((match = fractionPattern.exec(source))) {
      if (match.index > cursor) tokens.push({ type: "text", value: displayText(source.slice(cursor, match.index)) });
      tokens.push({ type: "fraction", numerator: displayText(match[1]), denominator: displayText(match[2]) });
      cursor = fractionPattern.lastIndex;
    }
    if (cursor < source.length) tokens.push({ type: "text", value: displayText(source.slice(cursor)) });
    return tokens;
  }

  function plainText(tex) {
    return tokenize(tex).map((token) => token.type === "fraction"
      ? `${token.numerator}/${token.denominator}`
      : token.value).join("");
  }

  function render(element, tex) {
    const expression = document.createElement("span");
    expression.className = "math-expression";
    tokenize(tex).forEach((token) => {
      if (token.type === "text") {
        expression.append(document.createTextNode(token.value));
        return;
      }
      const fraction = document.createElement("span");
      fraction.className = "math-fraction";
      const numerator = document.createElement("span");
      const denominator = document.createElement("span");
      numerator.textContent = token.numerator;
      denominator.textContent = token.denominator;
      fraction.append(numerator, denominator);
      expression.append(fraction);
    });
    element.textContent = "";
    element.append(expression);
    element.setAttribute("aria-label", plainText(tex));
  }

  return { tokenize, plainText, render };
});
