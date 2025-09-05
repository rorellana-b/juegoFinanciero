/* app.js — ¿Quién Quiere Ser Financiero? */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---------- Configuración ----------
  const MONEY_LADDER = [
    "Squiz",
    "Alcancia",
    "Portatarjeta",
    "Monedero",
    "Lapicero",
  ];
  const SAFE_STEPS = new Set([1, 3]);

  const QUESTION_TIME = 60; // segundos

  let QUESTIONS = [];

  // ---------- Estado del juego ----------
  const state = {
    currentIdx: 0,
    shuffled: [],
    money: 0,
    selected: null,
    used5050: false,
    usedAudience: false,
    usedSkip: false,
    streak: 0,
    timeLeft: QUESTION_TIME,
    timerId: null,
  };

  // ---------- Utilidades ----------
  const shuffle = (arr) =>
    arr
      .slice()
      .map((v) => [Math.random(), v])
      .sort((a, b) => a[0] - b[0])
      .map((x) => x[1]);
  const formatMoney = (n) => `${n}`;

  const safeFloor = (currentIdx) => {
    let safePrize = null;
    for (let i = 0; i <= currentIdx; i++) {
      if (SAFE_STEPS.has(i)) safePrize = MONEY_LADDER[i];
    }
    return safePrize || "Nada";
  };

  const speak = (msg) => {
    const live = $("#live-region");
    if (!live) return;
    live.textContent = msg;
  };

  // ---------- Elementos ----------
  const screens = {
    menu: $("#screen-menu"),
    how: $("#screen-how"),
    game: $("#screen-game"),
    gameover: $("#screen-gameover"),
  };
  const questionEl = $("#question");
  const optionEls = [$("#opt-0"), $("#opt-1"), $("#opt-2"), $("#opt-3")];
  const btnStart = $("#btn-start");
  const btnHow = $("#btn-how");
  const btnBackMenu = $("#btn-back-menu");
  const btnConfirm = $("#btn-confirm");
  const btnNext = $("#btn-next");
  const ll5050 = $("#ll-5050");
  const llAudience = $("#ll-audience");
  const llSkip = $("#ll-skip");
  const audienceChart = $("#audience-chart");
  const moneyEl = $("#money");
  const streakEl = $("#streak");
  const timerEl = $("#timer");
  const ladderList = $("#ladder-list");
  const overText = $("#over-text");
  const btnRetry = $("#btn-retry");
  const btnMenu = $("#btn-menu");

  // ---------- Cargar preguntas ----------
  async function cargarPreguntas() {
    if (QUESTIONS.length) return; // evitar recarga
    try {
      const res = await fetch("data/preguntas.json");
      if (!res.ok) throw new Error("No se pudieron cargar las preguntas");
      QUESTIONS = await res.json();
    } catch (err) {
      console.error(err);
      alert("Error al cargar preguntas");
    }
  }

  // ---------- Escalera ----------
  function renderLadder() {
    ladderList.innerHTML = "";
    for (let i = 0; i < MONEY_LADDER.length; i++) {
      const amount = MONEY_LADDER[i];
      const li = document.createElement("li");
      li.dataset.amount = String(amount);
      li.innerHTML = `<span class="step">${
        MONEY_LADDER.length - i
      }</span> <span class="amount">${formatMoney(amount)}</span>`;
      if (SAFE_STEPS.has(amount)) li.classList.add("safe");
      ladderList.appendChild(li);
    }
    highlightLadder();
  }
  function highlightLadder() {
    const step = MONEY_LADDER.length - state.currentIdx;
    $$("#ladder-list li").forEach((li) => li.classList.remove("active"));
    const active = $(`#ladder-list li:nth-child(${step})`);
    if (active) active.classList.add("active");
  }

  // ---------- Pantallas ----------
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ---------- Temporizador ----------
  function startTimer() {
    clearInterval(state.timerId);
    state.timeLeft = QUESTION_TIME;
    timerEl.textContent = `${state.timeLeft}s`;
    state.timerId = setInterval(() => {
      state.timeLeft--;
      timerEl.textContent = `${state.timeLeft}s`;
      if (state.timeLeft <= 0) {
        clearInterval(state.timerId);
        lockOptions();
        revealAnswer();
        gameOver(false, true);
      }
    }, 1000);
  }
  function stopTimer() {
    clearInterval(state.timerId);
  }

  // ---------- Juego ----------
  async function startGame() {
    await cargarPreguntas();

    state.currentIdx = 0;
    state.money = 0;
    state.selected = null;
    state.used5050 = false;
    state.usedAudience = false;
    state.usedSkip = false;
    state.streak = 0;

    moneyEl.textContent = formatMoney(0);
    streakEl.textContent = "0";

    // Mezclar y preparar preguntas
    const shuffledQuestions = shuffle(QUESTIONS)
      .slice(0, MONEY_LADDER.length)
      .map((q) => {
        const optIdx = [0, 1, 2, 3];
        const shuffledIdx = shuffle(optIdx);
        const options = shuffledIdx.map((i) => q.options[i]);
        const newAnswerIndex = options.indexOf(q.options[q.answerIndex]);
        return { ...q, options, answerIndex: newAnswerIndex };
      });
    state.shuffled = shuffledQuestions;

    // Reset UI lifelines
    [ll5050, llAudience, llSkip].forEach((btn) => btn.classList.remove("used"));
    audienceChart.classList.remove("active");
    audienceChart.setAttribute("aria-hidden", "true");
    audienceChart.innerHTML = "";

    renderLadder();
    showScreen("game");
    loadQuestion();
  }

  function loadQuestion() {
    startTimer();
    highlightLadder();
    const q = state.shuffled[state.currentIdx];
    questionEl.textContent = `${state.currentIdx + 1}. ${q.q}`;
    optionEls.forEach((btn, i) => {
      btn.textContent = q.options[i];
      btn.classList.remove("selected", "correct", "wrong");
      btn.disabled = false;
      btn.hidden = false;
      btn.setAttribute("aria-pressed", "false");
    });
    state.selected = null;
    btnConfirm.disabled = true;
    btnNext.disabled = true;
  }

  function lockOptions() {
    optionEls.forEach((btn) => (btn.disabled = true));
  }

  function handleSelectOption(i) {
    optionEls.forEach((btn) => btn.classList.remove("selected"));
    const btn = optionEls[i];
    btn.classList.add("selected");
    optionEls.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    state.selected = i;
    btnConfirm.disabled = false;
    speak(`Opción ${String.fromCharCode(65 + i)} seleccionada.`);
  }

  function revealAnswer() {
    const q = state.shuffled[state.currentIdx];
    optionEls.forEach((btn, i) => {
      if (i === q.answerIndex) btn.classList.add("correct");
      else if (btn.classList.contains("selected")) btn.classList.add("wrong");
    });
  }

  function confirmAnswer() {
    if (state.selected === null) return;
    stopTimer();
    lockOptions();
    const q = state.shuffled[state.currentIdx];
    const correct = state.selected === q.answerIndex;
    revealAnswer();

    if (correct) {
      state.streak++;
      streakEl.textContent = String(state.streak);
      state.money = MONEY_LADDER[MONEY_LADDER.length - 1 - state.currentIdx];
      moneyEl.textContent = formatMoney(state.money);
      btnNext.disabled = false;
      btnConfirm.disabled = true;
      speak("¡Respuesta correcta!");
      if (state.currentIdx >= MONEY_LADDER.length - 1) gameOver(true, false);
    } else {
      gameOver(false, false);
    }
  }

  function nextQuestion() {
    state.currentIdx++;
    if (state.currentIdx >= state.shuffled.length) {
      gameOver(true, false);
      return;
    }
    loadQuestion();
  }

  function gameOver(won, timeOut) {
    stopTimer();
    lockOptions();
    revealAnswer();
    const minTake = safeFloor(state.money);
    const finalMoney = won ? MONEY_LADDER[MONEY_LADDER.length - 1] : minTake;
    overText.innerHTML = won
      ? `🎉 <strong>¡Felicidades!</strong> Completaste el juego y ganaste <strong>${formatMoney(
          finalMoney
        )}</strong>.<br/>Racha: ${state.streak}.`
      : timeOut
      ? `⏰ Se acabó el tiempo. Te llevas <strong>${formatMoney(
          finalMoney
        )}</strong>. ¡Sigue practicando!`
      : `❌ Respuesta incorrecta.`;
    showScreen("gameover");
    const best = Number(localStorage.getItem("bestMoney") || "0");
    if (finalMoney > best)
      localStorage.setItem("bestMoney", String(finalMoney));
  }

  // ---------- Comodines ----------
  function use5050() {
    if (state.used5050) return;
    const q = state.shuffled[state.currentIdx];
    const wrongs = [0, 1, 2, 3].filter((i) => i !== q.answerIndex);
    shuffle(wrongs)
      .slice(0, 2)
      .forEach((i) => (optionEls[i].hidden = true));
    state.used5050 = true;
    ll5050.classList.add("used");
  }

  function useAudience() {
    if (state.usedAudience) return;
    const q = state.shuffled[state.currentIdx];
    const base = [0, 0, 0, 0];
    let remaining = 100;
    const correctBias = 40 + Math.floor(Math.random() * 21);
    base[q.answerIndex] = correctBias;
    remaining -= correctBias;
    const others = [0, 1, 2, 3].filter((i) => i !== q.answerIndex);
    others.forEach((i, idx) => {
      const val =
        idx === others.length - 1
          ? remaining
          : Math.floor(Math.random() * (remaining - (others.length - idx - 1)));
      base[i] = val;
      remaining -= val;
    });
    showAudienceChart(base);
    state.usedAudience = true;
    llAudience.classList.add("used");
  }

  function showAudienceChart(percentages) {
    audienceChart.innerHTML = `<div class="bars">
      ${percentages
        .map(
          (p, i) => `
        <div class="bar">
          <div class="label">${String.fromCharCode(65 + i)}</div>
          <div class="value" style="width:${p}%"></div>
          <div class="pct" style="margin-left:.5rem;color:#d6defa;font-weight:700">${p}%</div>
        </div>
      `
        )
        .join("")}
    </div>`;
    audienceChart.classList.add("active");
    audienceChart.setAttribute("aria-hidden", "false");
  }

  function useSkip() {
    if (state.usedSkip) return;
    state.usedSkip = true;
    llSkip.classList.add("used");
    const remaining = QUESTIONS.filter((q) => !state.shuffled.includes(q));
    if (remaining.length > 0) {
      const replacement =
        remaining[Math.floor(Math.random() * remaining.length)];
      const idxs = [0, 1, 2, 3];
      const sh = shuffle(idxs);
      const opts = sh.map((i) => replacement.options[i]);
      const ans = opts.indexOf(replacement.options[replacement.answerIndex]);
      state.shuffled[state.currentIdx] = {
        ...replacement,
        options: opts,
        answerIndex: ans,
      };
    }
    loadQuestion();
  }

  // ---------- Eventos ----------
  optionEls.forEach((btn, i) => {
    btn.addEventListener("click", () => handleSelectOption(i));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelectOption(i);
      }
    });
  });
  btnConfirm.addEventListener("click", confirmAnswer);
  btnNext.addEventListener("click", nextQuestion);
  btnStart.addEventListener("click", startGame);
  btnHow.addEventListener("click", () => showScreen("how"));
  btnBackMenu.addEventListener("click", () => showScreen("menu"));
  ll5050.addEventListener("click", use5050);
  llAudience.addEventListener("click", useAudience);
  llSkip.addEventListener("click", useSkip);
  btnRetry.addEventListener("click", startGame);
  btnMenu.addEventListener("click", () => showScreen("menu"));

  // ---------- Inicial UI ----------
  renderLadder();
  showScreen("menu");
})();
