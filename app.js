(() => {
  "use strict";

  const STORAGE_KEYS = {
    sentences: "de_ar_sentences_v1",
    theme: "de_ar_theme",
    streak: "de_ar_streak",
    lastQuizDate: "de_ar_last_quiz_date"
  };

  const els = {
    tabButtons: document.querySelectorAll(".tab-btn"),
    views: document.querySelectorAll(".view"),
    managerView: document.getElementById("managerView"),
    quizSetupView: document.getElementById("quizSetupView"),
    quizModeView: document.getElementById("quizModeView"),
    resultsView: document.getElementById("resultsView"),
    germanInput: document.getElementById("germanInput"),
    arabicInput: document.getElementById("arabicInput"),
    saveSentenceBtn: document.getElementById("saveSentenceBtn"),
    clearFieldsBtn: document.getElementById("clearFieldsBtn"),
    sentenceList: document.getElementById("sentenceList"),
    searchInput: document.getElementById("searchInput"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFileInput: document.getElementById("importFileInput"),
    questionCountSelect: document.getElementById("questionCountSelect"),
    shuffleToggle: document.getElementById("shuffleToggle"),
    timerToggle: document.getElementById("timerToggle"),
    feedbackToggle: document.getElementById("feedbackToggle"),
    startQuizBtn: document.getElementById("startQuizBtn"),
    dailyQuizBtn: document.getElementById("dailyQuizBtn"),
    themeToggle: document.getElementById("themeToggle"),
    totalSentences: document.getElementById("totalSentences"),
    streakCount: document.getElementById("streakCount"),
    progressText: document.getElementById("progressText"),
    timerText: document.getElementById("timerText"),
    progressFill: document.getElementById("progressFill"),
    promptText: document.getElementById("promptText"),
    answersContainer: document.getElementById("answersContainer"),
    feedbackText: document.getElementById("feedbackText"),
    quizCard: document.getElementById("quizCard"),
    nextQuestionBtn: document.getElementById("nextQuestionBtn"),
    exitQuizBtn: document.getElementById("exitQuizBtn"),
    resultScore: document.getElementById("resultScore"),
    resultPercentage: document.getElementById("resultPercentage"),
    resultMessage: document.getElementById("resultMessage"),
    retryQuizBtn: document.getElementById("retryQuizBtn"),
    backToManagerBtn: document.getElementById("backToManagerBtn"),
    toast: document.getElementById("toast"),
    emptyStateTemplate: document.getElementById("emptyStateTemplate")
  };

  const storageManager = {
    getSentences() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.sentences);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },

    saveSentences(list) {
      localStorage.setItem(STORAGE_KEYS.sentences, JSON.stringify(list));
    },

    addSentence(sentence) {
      const list = this.getSentences();
      list.unshift(sentence);
      this.saveSentences(list);
      return list;
    },

    updateSentence(id, updates) {
      const list = this.getSentences().map((item) => (item.id === id ? { ...item, ...updates } : item));
      this.saveSentences(list);
      return list;
    },

    deleteSentence(id) {
      const list = this.getSentences().filter((item) => item.id !== id);
      this.saveSentences(list);
      return list;
    },

    getTheme() {
      return localStorage.getItem(STORAGE_KEYS.theme) || "light";
    },

    setTheme(theme) {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    },

    getStreakData() {
      const streak = Number(localStorage.getItem(STORAGE_KEYS.streak) || 0);
      const lastQuizDate = localStorage.getItem(STORAGE_KEYS.lastQuizDate);
      return { streak, lastQuizDate };
    },

    updateStreak() {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { streak, lastQuizDate } = this.getStreakData();

      let nextStreak = streak;
      if (!lastQuizDate) {
        nextStreak = 1;
      } else if (lastQuizDate === today) {
        nextStreak = streak;
      } else if (lastQuizDate === yesterday) {
        nextStreak = streak + 1;
      } else {
        nextStreak = 1;
      }

      localStorage.setItem(STORAGE_KEYS.streak, String(nextStreak));
      localStorage.setItem(STORAGE_KEYS.lastQuizDate, today);
      return nextStreak;
    }
  };

  const animationHelpers = {
    toastTimer: null,

    showToast(message) {
      els.toast.textContent = message;
      els.toast.classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        els.toast.classList.remove("show");
      }, 2100);
    },

    flashQuizCard(type) {
      els.quizCard.classList.remove("success", "error");
      void els.quizCard.offsetWidth;
      els.quizCard.classList.add(type);
      setTimeout(() => els.quizCard.classList.remove(type), 450);
    }
  };

  const quizEngine = {
    state: {
      config: null,
      pool: [],
      questions: [],
      index: 0,
      score: 0,
      selectedAnswer: null,
      isAnswered: false,
      timerLeft: 20,
      timerRef: null,
      lastConfig: null
    },

    start(config, sourceList) {
      this.resetRuntime();
      this.state.config = config;
      this.state.lastConfig = config;

      const pool = [...sourceList];
      if (config.shuffle) {
        this.shuffle(pool);
      }

      const amount = Math.min(config.count, pool.length);
      this.state.pool = pool;
      this.state.questions = pool.slice(0, amount);
      this.state.index = 0;
      this.state.score = 0;
      this.state.isAnswered = false;

      return this.state.questions.length;
    },

    resetRuntime() {
      clearInterval(this.state.timerRef);
      this.state.timerRef = null;
      this.state.timerLeft = 20;
      this.state.selectedAnswer = null;
      this.state.isAnswered = false;
    },

    getCurrentQuestion() {
      return this.state.questions[this.state.index] || null;
    },

    makeOptions(correctValue, direction) {
      const allValues = this.state.pool
        .map((q) => (direction === "ar_to_de" ? q.german : q.arabic))
        .filter(Boolean)
        .filter((v, idx, arr) => arr.indexOf(v) === idx)
        .filter((v) => v !== correctValue);

      this.shuffle(allValues);
      const picks = allValues.slice(0, 3);
      const options = [...picks, correctValue];
      this.shuffle(options);
      return options;
    },

    checkAnswer(userAnswer, correctAnswer) {
      const normalizedUser = this.normalize(userAnswer);
      const normalizedCorrect = this.normalize(correctAnswer);
      const isCorrect = normalizedUser === normalizedCorrect;
      if (isCorrect) {
        this.state.score += 1;
      }
      this.state.isAnswered = true;
      return isCorrect;
    },

    nextQuestion() {
      this.state.index += 1;
      this.state.isAnswered = false;
      this.state.selectedAnswer = null;
      this.state.timerLeft = 20;
      return this.state.index < this.state.questions.length;
    },

    getResult() {
      const total = this.state.questions.length;
      const score = this.state.score;
      const percentage = total ? Math.round((score / total) * 100) : 0;
      return { score, total, percentage };
    },

    normalize(text) {
      return String(text || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    },

    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  };

  const uiRenderer = {
    state: {
      editingId: null,
      searchTerm: "",
      sentenceList: storageManager.getSentences()
    },

    init() {
      this.applyTheme(storageManager.getTheme());
      this.renderSentenceList();
      this.updateStats();
      this.populateQuestionCountOptions();
      this.bindEvents();
      this.showView("managerView");
    },

    bindEvents() {
      els.saveSentenceBtn.addEventListener("click", () => this.onSaveSentence());
      els.clearFieldsBtn.addEventListener("click", () => this.clearFields());
      els.searchInput.addEventListener("input", (e) => {
        this.state.searchTerm = e.target.value.trim().toLowerCase();
        this.renderSentenceList();
      });

      els.exportBtn.addEventListener("click", () => this.exportJSON());
      els.importBtn.addEventListener("click", () => els.importFileInput.click());
      els.importFileInput.addEventListener("change", (e) => this.importJSON(e));
      els.themeToggle.addEventListener("click", () => this.toggleTheme());

      els.tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => this.showView(btn.dataset.view));
      });

      els.startQuizBtn.addEventListener("click", () => this.startQuiz(false));
      els.dailyQuizBtn.addEventListener("click", () => {
        this.showView("quizSetupView");
        this.startQuiz(true);
      });

      els.nextQuestionBtn.addEventListener("click", () => this.onNextQuestion());
      els.exitQuizBtn.addEventListener("click", () => this.exitToManager());
      els.retryQuizBtn.addEventListener("click", () => this.retryQuiz());
      els.backToManagerBtn.addEventListener("click", () => this.exitToManager());

      document.addEventListener("keydown", (e) => this.onKeyboardShortcuts(e));
    },

    onKeyboardShortcuts(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        this.onSaveSentence();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        els.searchInput.focus();
      }

      if (e.key === "Escape") {
        if (els.quizModeView.classList.contains("active") || els.resultsView.classList.contains("active")) {
          this.exitToManager();
        }
      }

      if (e.key === "Enter" && els.quizModeView.classList.contains("active")) {
        this.onNextQuestion();
      }
    },

    showView(viewId) {
      els.views.forEach((view) => view.classList.remove("active"));
      const target = document.getElementById(viewId);
      if (target) {
        target.classList.add("active");
      }

      els.tabButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.view === viewId);
      });
    },

    clearFields() {
      els.germanInput.value = "";
      els.arabicInput.value = "";
      this.state.editingId = null;
      els.saveSentenceBtn.textContent = "Save Sentence";
      els.germanInput.focus();
    },

    onSaveSentence() {
      const german = els.germanInput.value.trim();
      const arabic = els.arabicInput.value.trim();

      if (!german || !arabic) {
        animationHelpers.showToast("Please fill in both German and Arabic fields.");
        return;
      }

      if (this.state.editingId) {
        this.state.sentenceList = storageManager.updateSentence(this.state.editingId, { german, arabic });
        animationHelpers.showToast("Sentence updated.");
      } else {
        const entry = {
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          german,
          arabic,
          createdAt: new Date().toISOString()
        };
        this.state.sentenceList = storageManager.addSentence(entry);
        animationHelpers.showToast("Sentence saved.");
      }

      this.clearFields();
      this.renderSentenceList();
      this.updateStats();
      this.populateQuestionCountOptions();
    },

    renderSentenceList() {
      const all = this.state.sentenceList;
      const filtered = all.filter((item) => {
        if (!this.state.searchTerm) return true;
        const haystack = `${item.german} ${item.arabic}`.toLowerCase();
        return haystack.includes(this.state.searchTerm);
      });

      els.sentenceList.innerHTML = "";

      if (!filtered.length) {
        const empty = els.emptyStateTemplate.content.firstElementChild.cloneNode(true);
        if (all.length && this.state.searchTerm) {
          empty.querySelector("h3").textContent = "No matches found";
          empty.querySelector("p").textContent = "Try another keyword or clear search.";
        }
        els.sentenceList.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      filtered.forEach((item) => {
        const card = document.createElement("article");
        card.className = "sentence-item glass";
        card.dataset.id = item.id;
        card.innerHTML = `
          <p><strong>DE:</strong> ${this.escapeHTML(item.german)}</p>
          <p class="arabic-output" dir="rtl"><strong>AR:</strong> ${this.escapeHTML(item.arabic)}</p>
          <p class="meta">Added: ${new Date(item.createdAt).toLocaleString()}</p>
          <div class="item-actions">
            <button class="edit" type="button" aria-label="Edit sentence">Edit</button>
            <button class="delete" type="button" aria-label="Delete sentence">Delete</button>
          </div>
        `;

        card.querySelector(".edit").addEventListener("click", () => this.editSentence(item.id));
        card.querySelector(".delete").addEventListener("click", () => this.deleteSentence(card, item.id));
        fragment.appendChild(card);
      });

      els.sentenceList.appendChild(fragment);
    },

    editSentence(id) {
      const item = this.state.sentenceList.find((entry) => entry.id === id);
      if (!item) return;
      this.state.editingId = id;
      els.germanInput.value = item.german;
      els.arabicInput.value = item.arabic;
      els.saveSentenceBtn.textContent = "Update Sentence";
      els.germanInput.focus();
      animationHelpers.showToast("Edit mode enabled.");
      this.showView("managerView");
    },

    deleteSentence(card, id) {
      card.classList.add("removing");
      setTimeout(() => {
        this.state.sentenceList = storageManager.deleteSentence(id);
        this.renderSentenceList();
        this.updateStats();
        this.populateQuestionCountOptions();
        animationHelpers.showToast("Sentence deleted.");
      }, 260);
    },

    populateQuestionCountOptions() {
      const total = this.state.sentenceList.length;
      const current = Number(els.questionCountSelect.value || 5);
      els.questionCountSelect.innerHTML = "";

      if (!total) {
        const option = new Option("0", "0", true, true);
        els.questionCountSelect.add(option);
        els.startQuizBtn.disabled = true;
        return;
      }

      const max = Math.min(20, total);
      for (let i = 1; i <= max; i += 1) {
        const option = new Option(String(i), String(i));
        if (i === Math.min(current, max)) option.selected = true;
        els.questionCountSelect.add(option);
      }
      els.startQuizBtn.disabled = false;
    },

    updateStats() {
      const total = this.state.sentenceList.length;
      els.totalSentences.textContent = String(total);
      const { streak } = storageManager.getStreakData();
      els.streakCount.textContent = `${streak} day${streak === 1 ? "" : "s"}`;
    },

    startQuiz(isDailyMode) {
      const list = this.state.sentenceList;
      if (list.length < 2) {
        animationHelpers.showToast("Add at least 2 sentences to start quiz.");
        return;
      }

      const direction = document.querySelector("input[name='direction']:checked").value;
      const answerMode = document.querySelector("input[name='answerMode']:checked").value;
      const count = isDailyMode ? Math.min(5, list.length) : Number(els.questionCountSelect.value || 5);

      const config = {
        count,
        direction,
        answerMode,
        shuffle: els.shuffleToggle.checked,
        timer: els.timerToggle.checked,
        instantFeedback: els.feedbackToggle.checked
      };

      const amount = quizEngine.start(config, list);
      if (!amount) {
        animationHelpers.showToast("No valid quiz questions available.");
        return;
      }

      this.showView("quizModeView");
      this.renderQuizQuestion();
    },

    renderQuizQuestion() {
      const question = quizEngine.getCurrentQuestion();
      if (!question) {
        this.finishQuiz();
        return;
      }

      const cfg = quizEngine.state.config;
      const showingArabic = cfg.direction === "ar_to_de";
      const prompt = showingArabic ? question.arabic : question.german;
      const correct = showingArabic ? question.german : question.arabic;

      els.feedbackText.textContent = "";
      els.feedbackText.className = "feedback";
      els.nextQuestionBtn.disabled = true;

      const idx = quizEngine.state.index + 1;
      const total = quizEngine.state.questions.length;
      els.progressText.textContent = `Question ${idx}/${total}`;
      els.progressFill.style.width = `${((idx - 1) / total) * 100}%`;

      els.promptText.textContent = prompt;
      els.promptText.dir = showingArabic ? "rtl" : "ltr";
      els.promptText.classList.toggle("arabic-output", showingArabic);

      els.answersContainer.innerHTML = "";
      quizEngine.state.isAnswered = false;

      if (cfg.answerMode === "multiple") {
        const options = quizEngine.makeOptions(correct, cfg.direction);
        options.forEach((value) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "option-btn";
          btn.textContent = value;
          if (cfg.direction === "de_to_ar") {
            btn.classList.add("arabic-output");
            btn.dir = "rtl";
          }

          btn.addEventListener("click", () => this.handleAnswer(value, correct, btn));
          els.answersContainer.appendChild(btn);
        });
      } else {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Type your answer...";
        input.setAttribute("aria-label", "Type your answer");
        if (cfg.direction === "de_to_ar") {
          input.classList.add("arabic-output");
          input.dir = "rtl";
        }

        const submit = document.createElement("button");
        submit.type = "button";
        submit.className = "btn btn-soft";
        submit.textContent = "Check Answer";

        submit.addEventListener("click", () => {
          this.handleAnswer(input.value, correct, null);
        });

        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit.click();
          }
        });

        els.answersContainer.append(input, submit);
        input.focus();
      }

      this.handleTimer();
    },

    handleTimer() {
      clearInterval(quizEngine.state.timerRef);
      const cfg = quizEngine.state.config;

      if (!cfg.timer) {
        els.timerText.classList.add("hidden");
        return;
      }

      quizEngine.state.timerLeft = 20;
      els.timerText.classList.remove("hidden");
      els.timerText.textContent = `${quizEngine.state.timerLeft}s`;

      quizEngine.state.timerRef = setInterval(() => {
        quizEngine.state.timerLeft -= 1;
        els.timerText.textContent = `${quizEngine.state.timerLeft}s`;

        if (quizEngine.state.timerLeft <= 0) {
          clearInterval(quizEngine.state.timerRef);
          if (!quizEngine.state.isAnswered) {
            const q = quizEngine.getCurrentQuestion();
            const correct = quizEngine.state.config.direction === "ar_to_de" ? q.german : q.arabic;
            this.handleAnswer("", correct, null, true);
          }
        }
      }, 1000);
    },

    handleAnswer(answerValue, correctAnswer, selectedButton, forcedTimeout = false) {
      if (quizEngine.state.isAnswered) return;

      clearInterval(quizEngine.state.timerRef);

      const isCorrect = quizEngine.checkAnswer(answerValue, correctAnswer);
      const cfg = quizEngine.state.config;

      if (cfg.answerMode === "multiple") {
        const options = [...els.answersContainer.querySelectorAll(".option-btn")];
        options.forEach((btn) => {
          btn.disabled = true;
          if (quizEngine.normalize(btn.textContent) === quizEngine.normalize(correctAnswer)) {
            btn.classList.add("correct");
          }
        });

        if (selectedButton && !isCorrect) {
          selectedButton.classList.add("wrong");
        }
      }

      if (cfg.instantFeedback || !isCorrect || forcedTimeout) {
        if (isCorrect) {
          els.feedbackText.textContent = "Correct!";
          els.feedbackText.classList.add("correct");
          animationHelpers.flashQuizCard("success");
        } else {
          els.feedbackText.textContent = `Wrong. Correct answer: ${correctAnswer}`;
          els.feedbackText.classList.add("wrong");
          animationHelpers.flashQuizCard("error");
        }
      }

      els.nextQuestionBtn.disabled = false;
      if (forcedTimeout) {
        els.feedbackText.textContent = `Time's up. Correct answer: ${correctAnswer}`;
        els.feedbackText.classList.add("wrong");
      }
    },

    onNextQuestion() {
      if (!quizEngine.state.isAnswered) return;

      const hasMore = quizEngine.nextQuestion();
      if (hasMore) {
        this.renderQuizQuestion();
      } else {
        this.finishQuiz();
      }
    },

    finishQuiz() {
      clearInterval(quizEngine.state.timerRef);
      const result = quizEngine.getResult();
      const streak = storageManager.updateStreak();
      this.updateStats();

      els.resultScore.textContent = `Score: ${result.score}/${result.total}`;
      els.resultPercentage.textContent = `Accuracy: ${result.percentage}%`;
      els.resultMessage.textContent = this.getMotivationalMessage(result.percentage, streak);

      els.progressFill.style.width = "100%";
      this.showView("resultsView");
    },

    retryQuiz() {
      const cfg = quizEngine.state.lastConfig;
      if (!cfg) {
        this.showView("quizSetupView");
        return;
      }

      const amount = quizEngine.start(cfg, this.state.sentenceList);
      if (!amount) {
        animationHelpers.showToast("Need more sentences to retry this quiz.");
        this.showView("managerView");
        return;
      }

      this.showView("quizModeView");
      this.renderQuizQuestion();
    },

    exitToManager() {
      clearInterval(quizEngine.state.timerRef);
      this.showView("managerView");
    },

    getMotivationalMessage(percentage, streak) {
      if (percentage === 100) return `Perfect run. ${streak}-day streak is growing.`;
      if (percentage >= 80) return `Great job. You're building strong recall.`;
      if (percentage >= 60) return `Solid progress. Review mistakes and run it again.`;
      return `Keep going. Consistency beats intensity.`;
    },

    toggleTheme() {
      const current = document.body.classList.contains("dark") ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      this.applyTheme(next);
      storageManager.setTheme(next);
    },

    applyTheme(theme) {
      document.body.classList.toggle("dark", theme === "dark");
      els.themeToggle.innerHTML = theme === "dark" ? "<span aria-hidden='true'>☀</span>" : "<span aria-hidden='true'>☾</span>";
    },

    exportJSON() {
      const payload = JSON.stringify(this.state.sentenceList, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "deutsch-arabic-sentences.json";
      a.click();
      URL.revokeObjectURL(url);
      animationHelpers.showToast("Exported as JSON.");
    },

    importJSON(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || "[]"));
          if (!Array.isArray(data)) throw new Error("Invalid format");

          const cleaned = data
            .map((item) => ({
              id: item.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
              german: String(item.german || "").trim(),
              arabic: String(item.arabic || "").trim(),
              createdAt: item.createdAt || new Date().toISOString()
            }))
            .filter((item) => item.german && item.arabic);

          if (!cleaned.length) {
            animationHelpers.showToast("No valid entries found in file.");
            return;
          }

          const existing = storageManager.getSentences();
          const dedupeMap = new Map();
          [...cleaned, ...existing].forEach((item) => {
            const key = `${quizEngine.normalize(item.german)}|${quizEngine.normalize(item.arabic)}`;
            if (!dedupeMap.has(key)) dedupeMap.set(key, item);
          });

          const merged = [...dedupeMap.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          storageManager.saveSentences(merged);
          this.state.sentenceList = merged;

          this.renderSentenceList();
          this.updateStats();
          this.populateQuestionCountOptions();
          animationHelpers.showToast(`Imported ${cleaned.length} sentence(s).`);
        } catch {
          animationHelpers.showToast("Import failed. Invalid JSON file.");
        } finally {
          event.target.value = "";
        }
      };
      reader.readAsText(file);
    },

    escapeHTML(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
  };

  uiRenderer.init();
})();
