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


function riskOfRuin(form, results) {
  const account = value(form, "account");
  const riskPercent = value(form, "riskPercent");
  const winRate = value(form, "winRate");
  const rewardRisk = value(form, "rewardRisk");
  const maxLoss = value(form, "maxLoss");
  const numTrades = value(form, "numTrades");

  const riskPerTrade = account * (riskPercent / 100);
  const winProb = winRate / 100;
  const lossProb = 1 - winProb;
  const expectancy = (winProb * rewardRisk - lossProb) * riskPerTrade;
  const losingStreakRisk = Math.pow(lossProb, 3);
  const survivalPressure = expectancy <= 0 ? "Negative expectancy: long-term bleed" : expectancy > riskPerTrade * 0.5 ? "Positive edge" : "Marginal edge";
  const drawdownExposure = maxLoss > 0 ? (riskPerTrade / maxLoss) * 100 : 0;
  const suggestedRisk = expectancy <= 0 ? riskPercent : Math.max(0.25, riskPercent * 0.75);

  setResults(results, [
    { label: "Expected value per trade", value: money.format(expectancy), tone: expectancy <= 0 ? "danger" : expectancy > riskPerTrade * 0.5 ? "ok" : "warning", note: survivalPressure },
    { label: "3-trade losing streak chance", value: `${number.format(losingStreakRisk * 100)}%`, tone: losingStreakRisk > 0.3 ? "warning" : "ok", note: "Probability of 3 consecutive losses." },
    { label: "Drawdown exposure per trade", value: `${number.format(drawdownExposure)}%`, tone: drawdownExposure > 10 ? "warning" : "ok", note: "Risk per trade as % of max loss." },
    { label: "Suggested risk adjustment", value: `${suggestedRisk}%`, tone: suggestedRisk < riskPercent ? "warning" : "ok", note: suggestedRisk < riskPercent ? "Reduce risk to improve survival." : "Current risk level is reasonable." }
  ]);
}

function rewardRisk(form, results) {
  const entry = value(form, "entry");
  const stop = value(form, "stop");
  const target = value(form, "target");
  const dollarRisk = value(form, "dollarRisk");
  const dollarReward = value(form, "dollarReward");

  const hasPrices = entry > 0 && stop > 0 && target > 0;
  const hasDollars = dollarRisk > 0 && dollarReward > 0;

  let rrRatio = 0;
  let breakEvenWR = 0;
  let interpretation = "Enter values to calculate.";

  if (hasPrices) {
    const riskDist = Math.abs(entry - stop);
    const rewardDist = Math.abs(target - entry);
    rrRatio = riskDist > 0 ? rewardDist / riskDist : 0;
    breakEvenWR = rrRatio > 0 ? (1 / (1 + rrRatio)) * 100 : 50;
    interpretation = rrRatio >= 3 ? "Strong setup" : rrRatio >= 2 ? "Good setup" : rrRatio >= 1 ? "Acceptable" : "Poor ratio";
  } else if (hasDollars) {
    rrRatio = dollarRisk > 0 ? dollarReward / dollarRisk : 0;
    breakEvenWR = rrRatio > 0 ? (1 / (1 + rrRatio)) * 100 : 50;
    interpretation = rrRatio >= 3 ? "Strong setup" : rrRatio >= 2 ? "Good setup" : rrRatio >= 1 ? "Acceptable" : "Poor ratio";
  }

  setResults(results, [
    { label: "Reward:Risk ratio", value: `${number.format(rrRatio)}:1`, tone: rrRatio >= 2 ? "ok" : rrRatio >= 1 ? "warning" : "danger", note: interpretation },
    { label: "Break-even win rate", value: `${number.format(breakEvenWR)}%`, note: "You need to win this often just to break even." },
    { label: "Interpretation", value: interpretation, tone: rrRatio >= 2 ? "ok" : rrRatio >= 1 ? "warning" : "danger", note: "Higher ratios give you more room to be wrong." }
  ]);
}

function lotSize(form, results) {
  const account = value(form, "account");
  const riskPercent = value(form, "riskPercent");
  const entry = value(form, "entry");
  const stop = value(form, "stop");
  const instrumentValue = value(form, "instrumentValue");

  const dollarRisk = account * (riskPercent / 100);
  const stopDistance = Math.abs(entry - stop);
  const lotSize = stopDistance > 0 && instrumentValue > 0 ? dollarRisk / (stopDistance * instrumentValue) : 0;
  const exposure = lotSize * entry * instrumentValue;

  setResults(results, [
    { label: "Dollar risk", value: money.format(dollarRisk), note: `Risking ${riskPercent}% of ${money.format(account)}.` },
    { label: "Lot size / contracts", value: number.format(lotSize), note: "Adjust based on your broker's contract specifications." },
    { label: "Approximate exposure", value: money.format(exposure), note: "Total notional value of the position." }
  ]);
}

function profitSplit(form, results) {
  const profit = value(form, "profit");
  const splitPercent = value(form, "splitPercent");
  const fees = value(form, "fees");

  const traderShare = profit * (splitPercent / 100);
  const firmShare = profit - traderShare;
  const netEstimate = traderShare - fees;

  setResults(results, [
    { label: "Trader payout", value: money.format(traderShare), note: `${splitPercent}% of ${money.format(profit)}.` },
    { label: "Firm share", value: money.format(firmShare), note: `What the firm keeps (${100 - splitPercent}%).` },
    { label: "Net estimate", value: money.format(netEstimate), tone: netEstimate < 0 ? "danger" : "ok", note: fees > 0 ? `After deducting ${money.format(fees)} in fees/deductions.` : "No fees applied." }
  ]);
}

const calculators = {
  "trailing-drawdown": trailingDrawdown,
  "position-size": positionSize,
  "daily-loss-limit": dailyLossLimit,
  "challenge-planner": challengePlanner,
  "evaluation-tracker": evaluationTracker,
  "risk-of-ruin": riskOfRuin,
  "reward-risk": rewardRisk,
  "lot-size": lotSize,
  "profit-split": profitSplit
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
