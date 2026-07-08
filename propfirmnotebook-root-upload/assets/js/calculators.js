const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

function value(form, name) {
  const raw = form.elements[name]?.value ?? "0";
  const parsed = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(form, name) {
  return form.elements[name]?.value ?? "";
}

function setResults(container, items) {
  container.innerHTML = items.map((item) => `
    <div class="result-card">
      <span class="result-label">${item.label}</span>
      <span class="result-value ${item.tone || ""}">${item.value}</span>
      <span class="result-note">${item.note || ""}</span>
    </div>
  `).join("");
}

function trailingDrawdown(form, results) {
  const starting = value(form, "starting");
  const highest = value(form, "highest");
  const current = value(form, "current");
  const maxDrawdown = value(form, "maxDrawdown");
  const dailyLimit = value(form, "dailyLimit");
  const todayPl = value(form, "todayPl");
  const type = textValue(form, "type");

  const drawdownFloor = type === "trailing"
    ? Math.max(starting - maxDrawdown, highest - maxDrawdown)
    : starting - maxDrawdown;
  const cushion = current - drawdownFloor;
  const dailyRoom = dailyLimit + todayPl;
  const suggestedRisk = Math.max(0, Math.min(cushion * 0.2, dailyRoom * 0.5));
  const status = cushion <= 0 ? "Violation risk" : cushion < maxDrawdown * 0.25 ? "Very close" : "Room available";

  setResults(results, [
    { label: "Estimated drawdown floor", value: money.format(drawdownFloor), note: "Do not let equity fall below this." },
    { label: "Account cushion", value: money.format(cushion), tone: cushion <= 0 ? "danger" : cushion < maxDrawdown * 0.25 ? "warning" : "ok", note: status },
    { label: "Daily loss room left", value: money.format(dailyRoom), tone: dailyRoom <= 0 ? "danger" : dailyRoom < dailyLimit * 0.25 ? "warning" : "ok", note: "Based on today's current profit or loss." },
    { label: "Conservative max risk", value: money.format(suggestedRisk), note: "A cautious estimate, not trading advice." }
  ]);
}

function positionSize(form, results) {
  const account = value(form, "account");
  const riskPercent = value(form, "riskPercent");
  const stopDistance = value(form, "stopDistance");
  const pointValue = value(form, "pointValue");
  const dollarRisk = account * (riskPercent / 100);
  const unitRisk = stopDistance * pointValue;
  const size = unitRisk > 0 ? dollarRisk / unitRisk : 0;

  setResults(results, [
    { label: "Dollar risk", value: money.format(dollarRisk), note: "Total amount at risk if the stop is hit." },
    { label: "Estimated size", value: number.format(size), note: "Contracts, lots, shares, or units depending on market." },
    { label: "Half-risk size", value: number.format(size / 2), note: "Useful when market conditions are not ideal." },
    { label: "Quarter-risk size", value: number.format(size / 4), note: "Useful after losses or before news." }
  ]);
}

function dailyLossLimit(form, results) {
  const dailyLimit = value(form, "dailyLimit");
  const currentPl = value(form, "currentPl");
  const openPl = value(form, "openPl");
  const personalStop = value(form, "personalStop");
  const totalDayPl = currentPl + openPl;
  const firmRoom = dailyLimit + totalDayPl;
  const personalRoom = personalStop + totalDayPl;
  const status = firmRoom <= 0 ? "Stop now: firm limit at risk" : personalRoom <= 0 ? "Stop now: personal limit hit" : "Still inside limits";

  setResults(results, [
    { label: "Current day result", value: money.format(totalDayPl), note: "Closed and open profit/loss combined." },
    { label: "Firm loss room left", value: money.format(firmRoom), tone: firmRoom <= 0 ? "danger" : firmRoom < dailyLimit * 0.25 ? "warning" : "ok", note: "Distance before the firm limit is reached." },
    { label: "Personal stop room", value: money.format(personalRoom), tone: personalRoom <= 0 ? "danger" : personalRoom < personalStop * 0.25 ? "warning" : "ok", note: "Distance before your personal stop is reached." },
    { label: "Plain answer", value: status, tone: firmRoom <= 0 || personalRoom <= 0 ? "danger" : "ok", note: "When in doubt, stop before the rule forces you to." }
  ]);
}

function challengePlanner(form, results) {
  const account = value(form, "account");
  const targetPercent = value(form, "targetPercent");
  const maxLossPercent = value(form, "maxLossPercent");
  const days = value(form, "days");
  const riskPercent = value(form, "riskPercent");
  const target = account * (targetPercent / 100);
  const maxLoss = account * (maxLossPercent / 100);
  const dailyGoal = days > 0 ? target / days : 0;
  const riskPerTrade = account * (riskPercent / 100);
  const losingTrades = riskPerTrade > 0 ? Math.floor(maxLoss / riskPerTrade) : 0;

  setResults(results, [
    { label: "Profit target", value: money.format(target), note: "Amount needed to pass the target." },
    { label: "Average daily goal", value: money.format(dailyGoal), note: "A planning number, not a forced daily target." },
    { label: "Maximum loss amount", value: money.format(maxLoss), note: "The loss limit you must protect." },
    { label: "Full-risk losses before max loss", value: String(losingTrades), tone: losingTrades <= 3 ? "warning" : "ok", note: "Lower risk gives you more chances to recover." }
  ]);
}

function evaluationTracker(form, results) {
  const starting = value(form, "starting");
  const current = value(form, "current");
  const target = value(form, "target");
  const maxLoss = value(form, "maxLoss");
  const dailyLoss = value(form, "dailyLoss");
  const days = value(form, "days");
  const profit = current - starting;
  const targetProgress = target > 0 ? Math.max(0, Math.min(100, (profit / target) * 100)) : 0;
  const remainingTarget = Math.max(0, target - profit);
  const drawdownFloor = starting - maxLoss;
  const drawdownRoom = current - drawdownFloor;
  const dailyNeeded = days > 0 ? remainingTarget / days : remainingTarget;

  setResults(results, [
    { label: "Progress to target", value: `${number.format(targetProgress)}%`, tone: targetProgress >= 75 ? "ok" : "", note: `${money.format(remainingTarget)} still needed.` },
    { label: "Drawdown room", value: money.format(drawdownRoom), tone: drawdownRoom < maxLoss * 0.25 ? "warning" : "ok", note: "Distance from the overall loss limit." },
    { label: "Daily limit to respect", value: money.format(dailyLoss), note: "Know this number before placing trades." },
    { label: "Average needed per day", value: money.format(dailyNeeded), note: "Use this to plan calmly, not to force trades." }
  ]);
}

const calculators = {
  "trailing-drawdown": trailingDrawdown,
  "position-size": positionSize,
  "daily-loss-limit": dailyLossLimit,
  "challenge-planner": challengePlanner,
  "evaluation-tracker": evaluationTracker
};

document.querySelectorAll("[data-calculator]").forEach((calculator) => {
  const form = calculator.querySelector("form");
  const results = calculator.querySelector("[data-results]");
  const type = calculator.dataset.calculator;
  const run = calculators[type];

  if (!form || !results || !run) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(form, results);
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => run(form, results), 0);
  });

  run(form, results);
});
