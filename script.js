/* Study Tracker - script.js (refactored)
   - Modular, self-contained IIFE
   - Clear sections: constants, DOM refs, utils, storage, state, renderers, calendar, events, init
*/

(function StudyTrackerModule() {
	'use strict';

	// ----------------------
	// Constants / DOM refs
	// ----------------------
	const STORAGE_KEY = 'study-tracker-logs-v1';
	const THEME_KEY = 'study-tracker-theme-v1';
	const GOAL_KEY = 'study-tracker-goal-v1';

	// DOM elements (assumes script loaded after DOM or elements exist)
	const el = {
		form: document.getElementById('log-form'),
		subjectInput: document.getElementById('subject'),
		minutesInput: document.getElementById('minutes'),
		dateInput: document.getElementById('date'),
		logsList: document.getElementById('logs-list'),
		totalMinutesEl: document.getElementById('total-minutes'),
		streakEl: document.getElementById('streak'),
		noLogsEl: document.getElementById('no-logs'),
		logsTitle: document.getElementById('logs-title'),
		calendarEl: document.getElementById('calendar'),
		calendarMonthEl: document.getElementById('calendar-month'),
		calPrev: document.getElementById('cal-prev'),
		calNext: document.getElementById('cal-next'),
		themeToggle: document.getElementById('theme-toggle'),
		downloadReportBtn: document.getElementById('download-report'),
		subjectTotalsEl: document.getElementById('subject-totals'),
		weeklyChartCtx: document.getElementById('weekly-chart'),
		dailyGoalInput: document.getElementById('daily-goal'),
		saveGoalBtn: document.getElementById('save-goal'),
		goalValueEl: document.getElementById('goal-value'),
		goalPercentEl: document.getElementById('goal-percent'),
		goalBarFill: document.getElementById('goal-bar-fill'),
		productivityText: document.getElementById('productivity-text'),
		productivityFill: document.getElementById('productivity-fill'),
		timerDisplay: document.getElementById('timer-display'),
		timerStart: document.getElementById('timer-start'),
		timerPause: document.getElementById('timer-pause'),
		timerReset: document.getElementById('timer-reset')
	};

	// ----------------------
	// Module state
	// ----------------------
	let selectedDate = null; // null => today
	let calCursor = new Date();
	let weeklyChart = null;

	// Set default date input to today (if element exists)
	if (el.dateInput) el.dateInput.value = toISODate(new Date());

	// ----------------------
	// Utilities
	// ----------------------
	function toISODate(date) {
		const d = new Date(date);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function genId() {
		return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
	}

	function formatMinutes(mins) {
		const m = Number(mins) || 0;
		if (m < 60) return `${m}m`;
		const h = Math.floor(m / 60);
		const r = m % 60;
		return r === 0 ? `${h}h` : `${h}h ${r}m`;
	}

	// ----------------------
	// Storage helpers
	// ----------------------
	function loadLogs() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : [];
		} catch (err) {
			console.error('Failed to load logs', err);
			return [];
		}
	}

	function saveLogs(logs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)); }

	function loadGoal() { const raw = localStorage.getItem(GOAL_KEY); return raw ? Number(raw) : 0; }
	function saveGoal(v) { localStorage.setItem(GOAL_KEY, String(Number(v) || 0)); }

	// ----------------------
	// Core data operations
	// ----------------------
	function addLog({ subject, minutes, date }) {
		const logs = loadLogs();
		const entry = {
			id: genId(),
			subject: (subject || '').trim(),
			minutes: Number(minutes) || 0,
			date: toISODate(date),
			createdAt: new Date().toISOString()
		};
		logs.push(entry);
		saveLogs(logs);
		render();
	}

	function deleteLog(id) {
		const logs = loadLogs().filter(l => l.id !== id);
		saveLogs(logs);
		render();
	}

	function logsForDate(dateISO) {
		return loadLogs().filter(l => l.date === dateISO).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
	}

	function totalMinutes(logs) { return logs.reduce((s, l) => s + (Number(l.minutes) || 0), 0); }

	// ----------------------
	// Analytics helpers
	// ----------------------
	function subjectTotals() {
		const map = new Map();
		loadLogs().forEach(l => {
			const s = l.subject || 'Untitled';
			map.set(s, (map.get(s) || 0) + Number(l.minutes || 0));
		});
		return map;
	}

	function weekTotals(refDate = new Date()) {
		const start = new Date(refDate);
		// shift to Monday
		const day = start.getDay();
		const diffToMonday = (day + 6) % 7;
		start.setDate(start.getDate() - diffToMonday);
		start.setHours(0, 0, 0, 0);

		const days = Array.from({ length: 7 }).map((_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			return toISODate(d);
		});

		const logs = loadLogs();
		const byDay = days.map(d => logs.filter(l => l.date === d).reduce((s, l) => s + Number(l.minutes || 0), 0));
		return { days, byDay };
	}

	// ----------------------
	// Renderers
	// ----------------------
	function renderSubjectTotals() {
		const map = subjectTotals();
		if (!el.subjectTotalsEl) return;
		el.subjectTotalsEl.innerHTML = '';
		if (!map.size) return void (el.subjectTotalsEl.innerHTML = '<li class="muted">No subjects yet</li>');
		for (const [subject, mins] of map.entries()) {
			const li = document.createElement('li');
			li.textContent = `${subject} — ${mins} min`;
			el.subjectTotalsEl.appendChild(li);
		}
	}

	function renderWeeklyChart() {
		if (!el.weeklyChartCtx) return;
		const { days, byDay } = weekTotals();
		const labels = days.map(d => new Date(d).toLocaleDateString(undefined, { weekday: 'short' }));
		const data = byDay;

		if (!weeklyChart) {
			weeklyChart = new Chart(el.weeklyChartCtx, {
				type: 'bar',
				data: { labels, datasets: [{ label: 'Minutes', data, backgroundColor: 'rgba(55, 81, 255, 0.7)' }] },
				options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
			});
		} else {
			weeklyChart.data.labels = labels;
			weeklyChart.data.datasets[0].data = data;
			weeklyChart.update();
		}
	}

	function renderGoal() {
		if (!el.goalValueEl) return;
		const goal = loadGoal(); // stored in minutes
		// display as hours/minutes
		el.goalValueEl.textContent = formatMinutes(goal);
		const todayISO = toISODate(new Date());
		const minutesToday = logsForDate(todayISO).reduce((s, l) => s + Number(l.minutes || 0), 0);
		const pct = goal > 0 ? Math.min(100, Math.round((minutesToday / goal) * 100)) : 0;
		if (el.goalPercentEl) el.goalPercentEl.textContent = pct + '%';
		if (el.goalBarFill) el.goalBarFill.style.width = pct + '%';
	}

	// ----------------------
	// Productivity score
	// ----------------------
	function calculateProductivityScore() {
		// Total weekly minutes and weekly goal (daily goal * 7)
		const { byDay } = weekTotals();
		const totalWeekly = byDay.reduce((s, v) => s + v, 0);
		const dailyGoal = loadGoal(); // minutes
		const weeklyGoal = dailyGoal * 7;

		const streak = calculateStreak();

		const todayISO = toISODate(new Date());
		const minutesToday = logsForDate(todayISO).reduce((s, l) => s + Number(l.minutes || 0), 0);
		const dailyPct = dailyGoal > 0 ? Math.min(100, Math.round((minutesToday / dailyGoal) * 100)) : 0;

		// Apply formula
		let score = 0;
		if (weeklyGoal > 0) score += (totalWeekly / weeklyGoal) * 50;
		// else leave the weekly component at 0
		score += (streak * 5);
		score += (dailyPct * 0.5);

		// Cap and round
		score = Math.round(Math.min(100, score));

		return { score, totalWeekly, weeklyGoal, streak, dailyPct };
	}

	function renderProductivityScore() {
		if (!el.productivityText || !el.productivityFill) return;
		const { score } = calculateProductivityScore();
		el.productivityText.textContent = `Your Productivity Score: ${score}/100`;
		el.productivityFill.style.width = score + '%';
	}

	// ----------------------
	// Study Heatmap (last 30 days)
	// ----------------------
	function getLastNDates(n = 30) {
		const dates = [];
		const today = new Date();
		for (let i = n - 1; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(today.getDate() - i);
			dates.push(toISODate(d));
		}
		return dates;
	}

	function dayTotalMap() {
		const logs = loadLogs();
		const map = new Map();
		logs.forEach(l => {
			const d = l.date;
			map.set(d, (map.get(d) || 0) + Number(l.minutes || 0));
		});
		return map;
	}

	function heatmapLevelForMinutes(mins) {
		if (!mins || mins <= 0) return 0;
		if (mins <= 30) return 1; // low
		if (mins <= 90) return 2; // medium
		return 3; // high
	}

	function renderHeatmap() {
		const container = document.getElementById('study-heatmap');
		const tooltip = document.getElementById('heatmap-tooltip');
		if (!container) return;
		container.innerHTML = '';
		const dates = getLastNDates(30);
		const totals = dayTotalMap();

		// set month label (e.g. "Feb 1 - Mar 2")
		const monthLabelEl = document.getElementById('heatmap-month');
		if (monthLabelEl && dates.length) {
			const start = new Date(dates[0]);
			const end = new Date(dates[dates.length - 1]);
			const fmt = (d) => d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
			monthLabelEl.textContent = `${fmt(start)} — ${fmt(end)}`;
		}

		dates.forEach(dISO => {
			const mins = totals.get(dISO) || 0;
			const lvl = heatmapLevelForMinutes(mins);
			const day = document.createElement('div');
			day.className = `heatmap-day level-${lvl}`;
			const inner = document.createElement('div'); inner.className = 'day-inner';
			// extract day number
			const dayNum = new Date(dISO).getDate();
			inner.textContent = String(dayNum);
			day.appendChild(inner);

			// tooltip handlers
			day.addEventListener('mouseover', (ev) => {
				if (!tooltip) return;
				tooltip.style.display = 'block';
				tooltip.textContent = `${dISO} — ${mins} min`;
			});
			day.addEventListener('mousemove', (ev) => {
				if (!tooltip) return;
				tooltip.style.left = (ev.clientX + 12) + 'px';
				tooltip.style.top = (ev.clientY + 12) + 'px';
			});
			day.addEventListener('mouseout', () => { if (tooltip) tooltip.style.display = 'none'; });

			container.appendChild(day);
		});
	}

	function calculateStreak() {
		const logs = loadLogs();
		if (!logs.length) return 0;
		const daysSet = new Set(logs.map(l => l.date));
		let streak = 0;
		let cursor = new Date();
		while (true) {
			const dISO = toISODate(cursor);
			if (daysSet.has(dISO)) {
				streak += 1;
				cursor.setDate(cursor.getDate() - 1);
			} else break;
		}
		return streak;
	}

	// Main render function
	function render() {
		const showDate = selectedDate || toISODate(new Date());
		const showLogs = logsForDate(showDate);

		if (el.totalMinutesEl) el.totalMinutesEl.textContent = formatMinutes(totalMinutes(showLogs));
		if (el.streakEl) el.streakEl.textContent = calculateStreak();
		if (el.logsTitle) el.logsTitle.textContent = (showDate === toISODate(new Date())) ? "Today's Logs" : `Logs for ${showDate}`;

		// render logs list
		if (el.logsList) {
			el.logsList.innerHTML = '';
			if (!showLogs.length) {
				if (el.noLogsEl) el.noLogsEl.style.display = 'block';
			} else {
				if (el.noLogsEl) el.noLogsEl.style.display = 'none';
				showLogs.forEach(log => {
					const li = document.createElement('li');
					const left = document.createElement('div'); left.className = 'log-left';

					const subj = document.createElement('div'); subj.className = 'log-subject'; subj.textContent = log.subject || '—';
					const meta = document.createElement('div'); meta.className = 'log-meta';
					meta.textContent = `${formatMinutes(log.minutes)} • ${new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

					left.appendChild(subj); left.appendChild(meta);

					const actions = document.createElement('div'); actions.className = 'log-actions';
					const delBtn = document.createElement('button'); delBtn.title = 'Delete log'; delBtn.textContent = '🗑️';
					delBtn.addEventListener('click', () => { if (confirm('Delete this log?')) deleteLog(log.id); });
					actions.appendChild(delBtn);

					li.appendChild(left); li.appendChild(actions);
					el.logsList.appendChild(li);
				});
			}
		}

		// update calendar and analytics
		renderCalendar();
		renderSubjectTotals();
		renderWeeklyChart();
		renderGoal();
		renderProductivityScore();
		renderHeatmap();
	}

	// ----------------------
	// Calendar
	// ----------------------
	function firstDayOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
	function lastDayOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

	function renderCalendar() {
		if (!el.calendarEl || !el.calendarMonthEl) return;
		const cursor = calCursor;
		el.calendarMonthEl.textContent = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

		const first = firstDayOfMonth(cursor);
		const last = lastDayOfMonth(cursor);
		const startWeekday = first.getDay();

		const logs = loadLogs();
		const daysWithLogs = new Set(logs.map(l => l.date));

		el.calendarEl.innerHTML = '';
		const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		dayNames.forEach(dn => { const dnEl = document.createElement('div'); dnEl.className = 'day-name'; dnEl.textContent = dn; el.calendarEl.appendChild(dnEl); });

		for (let i = 0; i < startWeekday; i++) {
			const blank = document.createElement('div'); blank.className = 'day'; blank.textContent = ''; el.calendarEl.appendChild(blank);
		}

		for (let d = 1; d <= last.getDate(); d++) {
			const dt = new Date(cursor.getFullYear(), cursor.getMonth(), d);
			const iso = toISODate(dt);
			const dayEl = document.createElement('div'); dayEl.className = 'day'; dayEl.textContent = String(d);
			if (iso === toISODate(new Date())) dayEl.classList.add('today');
			if (selectedDate === iso) dayEl.classList.add('selected');
			if (daysWithLogs.has(iso)) dayEl.classList.add('has-log');
			dayEl.addEventListener('click', () => { selectedDate = iso; if (el.dateInput) el.dateInput.value = iso; render(); });
			el.calendarEl.appendChild(dayEl);
		}
	}

	// ----------------------
	// Events / initialization
	// ----------------------

	// ----------------------
	// Focus Timer
	// ----------------------
	const TIMER_DURATION = 25 * 60; // 25 mins in seconds
	let timerInterval = null;
	let timerRemaining = TIMER_DURATION;
	let timerEndTime = null;

	function formatTime(seconds) {
		const m = Math.floor(seconds / 60).toString().padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function renderTimer() {
		if (el.timerDisplay) el.timerDisplay.textContent = formatTime(timerRemaining);
	}

	function tickTimer() {
		if (timerEndTime) {
			const now = Math.floor(Date.now() / 1000);
			const diff = timerEndTime - now;
			timerRemaining = Math.max(0, diff);
		} else {
			timerRemaining--;
		}

		saveTimerState();
		renderTimer();

		if (timerRemaining <= 0) {
			completeTimer();
		}
	}

	function startTimer() {
		if (timerInterval) return;
		if (timerRemaining <= 0) timerRemaining = TIMER_DURATION;

		if (!timerEndTime || timerEndTime < Math.floor(Date.now() / 1000)) {
			timerEndTime = Math.floor(Date.now() / 1000) + timerRemaining;
		}

		timerInterval = setInterval(tickTimer, 1000);
		saveTimerState();
	}

	function pauseTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
			timerEndTime = null;
			saveTimerState();
		}
	}

	function resetTimer() {
		pauseTimer();
		timerRemaining = TIMER_DURATION;
		timerEndTime = null;
		saveTimerState();
		renderTimer();
	}

	function completeTimer() {
		pauseTimer();
		timerRemaining = TIMER_DURATION;
		saveTimerState();
		renderTimer();

		// play sound
		playBeep();

		// Auto log
		const subject = el.subjectInput && el.subjectInput.value.trim() ? el.subjectInput.value.trim() : 'Focus Session';
		addLog({ subject, minutes: 25, date: toISODate(new Date()) });

		setTimeout(() => {
			alert('Focus session complete! 25 minutes logged.');
		}, 100);
	}

	function playBeep() {
		try {
			const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
			const oscillator = audioCtx.createOscillator();
			const gainNode = audioCtx.createGain();

			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5

			gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
			gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
			gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);

			oscillator.connect(gainNode);
			gainNode.connect(audioCtx.destination);

			oscillator.start(audioCtx.currentTime);
			oscillator.stop(audioCtx.currentTime + 0.5);
		} catch (e) {
			console.error("Audio playback error:", e);
		}
	}

	function saveTimerState() {
		const state = {
			timerRemaining,
			timerEndTime,
			isRunning: !!timerInterval
		};
		localStorage.setItem('study-tracker-timer-v1', JSON.stringify(state));
	}

	function loadTimerState() {
		try {
			const raw = localStorage.getItem('study-tracker-timer-v1');
			if (raw) {
				const state = JSON.parse(raw);
				// If it was running and has an end time
				if (state.timerEndTime && state.isRunning) {
					const now = Math.floor(Date.now() / 1000);
					const diff = state.timerEndTime - now;

					if (diff <= 0) {
						// It finished while away
						timerRemaining = 0;
						completeTimer();
						return;
					} else {
						timerRemaining = diff;
						timerEndTime = state.timerEndTime;
						startTimer();
					}
				} else {
					timerRemaining = state.timerRemaining || TIMER_DURATION;
				}
			}
		} catch (err) {
			console.error("Error loading timer state", err);
		}
		renderTimer();
	}

	if (el.timerStart) el.timerStart.addEventListener('click', startTimer);
	if (el.timerPause) el.timerPause.addEventListener('click', pauseTimer);
	if (el.timerReset) el.timerReset.addEventListener('click', resetTimer);

	if (el.calPrev) el.calPrev.addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
	if (el.calNext) el.calNext.addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });
	if (el.form) el.form.addEventListener('reset', () => { selectedDate = null; if (el.dateInput) el.dateInput.value = toISODate(new Date()); render(); });

	function setTheme(theme) { if (theme === 'dark') document.body.classList.add('dark-theme'); else document.body.classList.remove('dark-theme'); localStorage.setItem(THEME_KEY, theme); }
	if (el.themeToggle) el.themeToggle.addEventListener('click', () => { const isDark = document.body.classList.contains('dark-theme'); setTheme(isDark ? 'light' : 'dark'); });
	const savedTheme = localStorage.getItem(THEME_KEY) || 'light'; setTheme(savedTheme);

	if (el.downloadReportBtn) {
		el.downloadReportBtn.addEventListener('click', () => {
			const logs = loadLogs();
			let csvContent = 'Subject,Minutes,Date\n';
			logs.forEach(log => {
				const subject = (log.subject || '').includes(',') ? `"${log.subject}"` : (log.subject || '');
				csvContent += `${subject},${log.minutes || 0},${log.date || ''}\n`;
			});

			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.setAttribute('href', url);
			link.setAttribute('download', 'study-report.csv');
			link.style.display = 'none';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		});
	}

	if (el.saveGoalBtn) el.saveGoalBtn.addEventListener('click', () => {
		// input is hours (can be decimal). store goal in minutes for internal calculations.
		const hours = Number(el.dailyGoalInput.value || 0);
		const minutes = Math.max(0, Math.round(hours * 60));
		saveGoal(minutes);
		renderGoal();
		el.dailyGoalInput.value = '';
	});

	if (el.form) el.form.addEventListener('submit', (e) => {
		e.preventDefault();
		const subject = (el.subjectInput.value || '').trim();
		const minutes = el.minutesInput.value;
		const date = el.dateInput.value || toISODate(new Date());
		if (!subject) return void alert('Please enter a subject');
		if (!minutes || Number(minutes) <= 0) return void alert('Please enter minutes studied');
		addLog({ subject, minutes, date });
		if (el.subjectInput) el.subjectInput.value = '';
		if (el.minutesInput) el.minutesInput.value = '';
	});

	// ensure calendar shows current month and initial render
	calCursor = new Date();
	renderCalendar();
	render();
	loadTimerState();

	// expose debug API
	window._studyTracker = { loadLogs, saveLogs, addLog, deleteLog, calculateStreak };

})();
