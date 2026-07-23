const STORAGE_KEY = "solo-scheduler-state-v1";
const REMINDER_OFFSETS = [
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "2 hours", ms: 2 * 60 * 60 * 1000 },
  { label: "30 minutes", ms: 30 * 60 * 1000 }
];

const CATEGORIES = [
  { name: "Work", color: "#2563eb" },
  { name: "Personal", color: "#0f766e" },
  { name: "Health", color: "#16a34a" },
  { name: "Family", color: "#db2777" },
  { name: "Finance", color: "#d97706" },
  { name: "Travel", color: "#0891b2" },
  { name: "Other", color: "#64748b" }
];

const state = loadState();
const timers = new Map();

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  heroTitle: document.querySelector("#heroTitle"),
  completionRing: document.querySelector("#completionRing"),
  completionPercent: document.querySelector("#completionPercent"),
  statToday: document.querySelector("#statToday"),
  statBusy: document.querySelector("#statBusy"),
  statMissed: document.querySelector("#statMissed"),
  todayCount: document.querySelector("#todayCount"),
  todayList: document.querySelector("#todayList"),
  freeSlots: document.querySelector("#freeSlots"),
  upcomingCount: document.querySelector("#upcomingCount"),
  upcomingList: document.querySelector("#upcomingList"),
  calendarDate: document.querySelector("#calendarDate"),
  calendarCanvas: document.querySelector("#calendarCanvas"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilters: document.querySelector("#categoryFilters"),
  searchResults: document.querySelector("#searchResults"),
  categoryBars: document.querySelector("#categoryBars"),
  notificationState: document.querySelector("#notificationState"),
  insightSignal: document.querySelector("#insightSignal"),
  insightTotal: document.querySelector("#insightTotal"),
  insightDone: document.querySelector("#insightDone"),
  insightHigh: document.querySelector("#insightHigh"),
  displayName: document.querySelector("#displayName"),
  userEmail: document.querySelector("#userEmail"),
  appLock: document.querySelector("#appLock"),
  pinInput: document.querySelector("#pinInput"),
  emailReminders: document.querySelector("#emailReminders"),
  appointmentDialog: document.querySelector("#appointmentDialog"),
  appointmentForm: document.querySelector("#appointmentForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  appointmentId: document.querySelector("#appointmentId"),
  title: document.querySelector("#title"),
  startDateTime: document.querySelector("#startDateTime"),
  endDateTime: document.querySelector("#endDateTime"),
  category: document.querySelector("#category"),
  recurrence: document.querySelector("#recurrence"),
  priority: document.querySelector("#priority"),
  location: document.querySelector("#location"),
  tags: document.querySelector("#tags"),
  notes: document.querySelector("#notes"),
  attachments: document.querySelector("#attachments"),
  emailReminder: document.querySelector("#emailReminder"),
  conflictBox: document.querySelector("#conflictBox"),
  editorSlots: document.querySelector("#editorSlots"),
  deleteAppointment: document.querySelector("#deleteAppointment"),
  markDone: document.querySelector("#markDone"),
  closeDialog: document.querySelector("#closeDialog"),
  infoDialog: document.querySelector("#infoDialog"),
  closeInfo: document.querySelector("#closeInfo"),
  lockDialog: document.querySelector("#lockDialog"),
  unlockPin: document.querySelector("#unlockPin"),
  unlockError: document.querySelector("#unlockError"),
  unlockButton: document.querySelector("#unlockButton")
};

function loadState() {
  const fallback = {
    appointments: [],
    settings: {
      displayName: "My Schedule",
      email: "",
      appLock: false,
      pinHash: "",
      emailReminders: false,
      theme: "system"
    },
    calendarMode: "day",
    selectedCategory: "All"
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

function addDate(date, unit, amount) {
  const next = new Date(date);
  if (unit === "day") next.setDate(next.getDate() + amount);
  if (unit === "week") next.setDate(next.getDate() + amount * 7);
  if (unit === "month") next.setMonth(next.getMonth() + amount);
  return next;
}

function toDateTimeLocal(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  return new Date(value);
}

function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(date));
}

function formatTime(date) {
  return formatDate(date, { hour: "numeric", minute: "2-digit" });
}

function formatDay(date) {
  return formatDate(date, { weekday: "short", month: "short", day: "numeric" });
}

function categoryColor(name) {
  return CATEGORIES.find((category) => category.name === name)?.color ?? "#64748b";
}

function normalizeAppointment(appointment) {
  return {
    id: appointment.id ?? uid(),
    title: appointment.title?.trim() || "Untitled",
    start: new Date(appointment.start).toISOString(),
    end: new Date(appointment.end).toISOString(),
    category: appointment.category ?? "Personal",
    recurrence: appointment.recurrence ?? "None",
    priority: appointment.priority ?? "Normal",
    location: appointment.location?.trim() ?? "",
    tags: appointment.tags ?? [],
    notes: appointment.notes?.trim() ?? "",
    attachments: appointment.attachments?.trim() ?? "",
    emailReminder: Boolean(appointment.emailReminder),
    completed: Boolean(appointment.completed),
    createdAt: appointment.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function expandedAppointments(rangeStart, rangeEnd) {
  const result = [];
  const startLimit = new Date(rangeStart);
  const endLimit = new Date(rangeEnd);

  for (const base of state.appointments) {
    const start = new Date(base.start);
    const end = new Date(base.end);
    const duration = end - start;
    const recurrence = base.recurrence;

    if (recurrence === "None") {
      if (start < endLimit && startOfDay(end) >= startOfDay(startLimit)) result.push(base);
      continue;
    }

    let cursor = new Date(start);
    let guard = 0;
    while (cursor < endLimit && guard < 450) {
      const occurrenceEnd = new Date(cursor.getTime() + duration);
      if (occurrenceEnd > startLimit && cursor < endLimit) {
        result.push({
          ...base,
          occurrenceId: `${base.id}-${cursor.toISOString()}`,
          start: cursor.toISOString(),
          end: occurrenceEnd.toISOString(),
          isOccurrence: cursor.getTime() !== start.getTime()
        });
      }
      if (recurrence === "Daily") cursor = addDate(cursor, "day", 1);
      if (recurrence === "Weekly") cursor = addDate(cursor, "week", 1);
      if (recurrence === "Monthly") cursor = addDate(cursor, "month", 1);
      guard += 1;
    }
  }

  return result.sort((a, b) => new Date(a.start) - new Date(b.start));
}

function appointmentsForDay(date) {
  return expandedAppointments(startOfDay(date), endOfDay(date));
}

function hasOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function conflicts(start, end, excludingId = "") {
  const checkStart = new Date(start);
  const checkEnd = new Date(end);
  return expandedAppointments(addDate(checkStart, "month", -1), addDate(checkEnd, "month", 1)).filter((item) => {
    if (item.id === excludingId) return false;
    return hasOverlap(checkStart, checkEnd, new Date(item.start), new Date(item.end));
  });
}

function freeSlots(date, minimumMinutes = 30) {
  const dayStart = startOfDay(date);
  dayStart.setHours(8, 0, 0, 0);
  const dayEnd = startOfDay(date);
  dayEnd.setHours(20, 0, 0, 0);
  const busy = appointmentsForDay(date)
    .map((item) => ({
      start: new Date(Math.max(new Date(item.start), dayStart)),
      end: new Date(Math.min(new Date(item.end), dayEnd))
    }))
    .filter((item) => item.start < item.end)
    .sort((a, b) => a.start - b.start);

  const slots = [];
  let cursor = dayStart;
  for (const block of busy) {
    if ((block.start - cursor) / 60000 >= minimumMinutes) {
      slots.push({ start: new Date(cursor), end: new Date(block.start) });
    }
    if (block.end > cursor) cursor = block.end;
  }
  if ((dayEnd - cursor) / 60000 >= minimumMinutes) {
    slots.push({ start: new Date(cursor), end: dayEnd });
  }
  return slots;
}

function renderAppointmentCard(appointment) {
  const card = document.createElement("article");
  card.className = "appointment-card";
  card.style.setProperty("--card-color", categoryColor(appointment.category));
  card.innerHTML = `
    <div class="bar"></div>
    <div>
      <h4>${escapeHTML(appointment.title)}${appointment.priority === "High" ? " !" : ""}</h4>
      <p>${formatDay(appointment.start)} · ${formatTime(appointment.start)} - ${formatTime(appointment.end)}</p>
      ${appointment.location ? `<p>${escapeHTML(appointment.location)}</p>` : ""}
      ${appointment.tags?.length ? `<div class="tag-list">${appointment.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("")}</div>` : ""}
    </div>
  `;
  card.addEventListener("click", () => openEditor(appointment.id));
  return card;
}

function renderTimeline(container, appointments, emptyText) {
  container.replaceChildren();
  if (!appointments.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }
  appointments.forEach((appointment) => container.append(renderAppointmentCard(appointment)));
}

function renderSlots(container, slots) {
  container.replaceChildren();
  if (!slots.length) {
    const empty = document.createElement("span");
    empty.className = "slot-pill";
    empty.textContent = "No free slots";
    container.append(empty);
    return;
  }
  slots.slice(0, 10).forEach((slot) => {
    const pill = document.createElement("span");
    pill.className = "slot-pill";
    const minutes = Math.round((slot.end - slot.start) / 60000);
    pill.textContent = `${formatTime(slot.start)} · ${minutes} min free`;
    container.append(pill);
  });
}

function renderDashboard() {
  const now = new Date();
  const today = appointmentsForDay(now);
  const upcoming = expandedAppointments(now, addDate(now, "month", 6)).filter((item) => new Date(item.start) > now).slice(0, 8);
  const missed = state.appointments.filter((item) => new Date(item.end) < now && !item.completed);
  const busyHours = Math.round(today.reduce((sum, item) => sum + (new Date(item.end) - new Date(item.start)), 0) / 3600000);
  const completed = state.appointments.filter((item) => item.completed).length;
  const completion = state.appointments.length ? completed / state.appointments.length : 0;

  els.todayLabel.textContent = formatDate(now, { weekday: "long", month: "long", day: "numeric" });
  els.heroTitle.textContent = today.length ? "Your day has shape." : "Clear schedule, clear head.";
  els.statToday.textContent = today.length;
  els.statBusy.textContent = `${busyHours}h`;
  els.statMissed.textContent = missed.length;
  els.todayCount.textContent = `${today.length} item${today.length === 1 ? "" : "s"}`;
  els.upcomingCount.textContent = `${upcoming.length} item${upcoming.length === 1 ? "" : "s"}`;
  els.completionPercent.textContent = `${Math.round(completion * 100)}%`;
  els.completionRing.style.strokeDashoffset = String(169.65 - 169.65 * completion);

  renderTimeline(els.todayList, today, "No appointments today");
  renderTimeline(els.upcomingList, upcoming, "Nothing upcoming");
  renderSlots(els.freeSlots, freeSlots(now));
}

function renderCalendar() {
  const selected = new Date(`${els.calendarDate.value}T12:00:00`);
  const mode = state.calendarMode;
  els.calendarCanvas.replaceChildren();

  if (mode === "day") renderDay(selected);
  if (mode === "week") renderWeek(selected);
  if (mode === "month") renderMonth(selected);
  if (mode === "agenda") renderAgenda();
}

function renderDay(date) {
  const list = appointmentsForDay(date);
  for (let hour = 0; hour < 24; hour += 1) {
    const row = document.createElement("div");
    row.className = "hour-row";
    const labelDate = startOfDay(date);
    labelDate.setHours(hour);
    const hourItems = list.filter((item) => new Date(item.start).getHours() === hour);
    row.innerHTML = `<div class="hour-label">${formatTime(labelDate)}</div>`;
    const content = document.createElement("div");
    if (hourItems.length) {
      hourItems.forEach((item) => content.append(renderAppointmentCard(item)));
    } else {
      const line = document.createElement("div");
      line.className = "hour-line";
      content.append(line);
    }
    row.append(content);
    els.calendarCanvas.append(row);
  }
}

function renderWeek(date) {
  const weekStart = startOfDay(date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  for (let index = 0; index < 7; index += 1) {
    const day = addDate(weekStart, "day", index);
    const row = document.createElement("div");
    row.className = "day-row";
    row.innerHTML = `<div class="day-label">${formatDay(day)}</div>`;
    const content = document.createElement("div");
    const items = appointmentsForDay(day);
    if (items.length) items.forEach((item) => content.append(renderAppointmentCard(item)));
    else {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Free day";
      content.append(empty);
    }
    row.append(content);
    els.calendarCanvas.append(row);
  }
}

function renderMonth(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = addDate(first, "day", -first.getDay());
  const grid = document.createElement("div");
  grid.className = "month-grid";
  for (let index = 0; index < 42; index += 1) {
    const day = addDate(gridStart, "day", index);
    const items = appointmentsForDay(day);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "month-cell";
    cell.innerHTML = `
      <strong>${day.getDate()}</strong>
      <div class="dots">${items.slice(0, 4).map((item) => `<i style="--dot-color:${categoryColor(item.category)}"></i>`).join("")}</div>
    `;
    cell.style.opacity = day.getMonth() === date.getMonth() ? "1" : "0.45";
    cell.addEventListener("click", () => {
      els.calendarDate.value = toDateInput(day);
      state.calendarMode = "day";
      document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("is-selected", button.dataset.mode === "day"));
      renderCalendar();
    });
    grid.append(cell);
  }
  els.calendarCanvas.append(grid);
}

function renderAgenda() {
  const now = new Date();
  const items = expandedAppointments(addDate(now, "month", -1), addDate(now, "month", 6));
  renderTimeline(els.calendarCanvas, items, "No appointments in agenda");
}

function renderSearch() {
  els.categoryFilters.replaceChildren();
  ["All", ...CATEGORIES.map((item) => item.name)].forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip-button";
    button.textContent = category;
    button.classList.toggle("is-selected", state.selectedCategory === category);
    button.addEventListener("click", () => {
      state.selectedCategory = category;
      saveState();
      renderSearch();
    });
    els.categoryFilters.append(button);
  });

  const query = els.searchInput.value.trim().toLowerCase();
  const items = state.appointments.filter((item) => {
    const categoryMatch = state.selectedCategory === "All" || item.category === state.selectedCategory;
    const haystack = [item.title, item.location, item.notes, item.tags.join(" "), item.attachments].join(" ").toLowerCase();
    return categoryMatch && (!query || haystack.includes(query));
  });
  renderTimeline(els.searchResults, items.sort((a, b) => new Date(a.start) - new Date(b.start)), "No matching appointments");
}

function renderInsights() {
  const total = state.appointments.length;
  const done = state.appointments.filter((item) => item.completed).length;
  const high = state.appointments.filter((item) => item.priority === "High").length;
  const today = appointmentsForDay(new Date());

  els.insightTotal.textContent = total;
  els.insightDone.textContent = done;
  els.insightHigh.textContent = high;
  els.insightSignal.textContent = today.length >= 7 ? "Dense day" : today.length ? "Balanced" : "Open day";
  els.notificationState.textContent = notificationStatusLabel();

  els.categoryBars.replaceChildren();
  CATEGORIES.forEach((category) => {
    const count = state.appointments.filter((item) => item.category === category.name).length;
    const row = document.createElement("div");
    row.className = "category-bar";
    row.innerHTML = `
      <header><span>${category.name}</span><strong>${count}</strong></header>
      <div class="bar-track"><div class="bar-fill" style="--bar-width:${total ? (count / total) * 100 : 0}%; --bar-color:${category.color}"></div></div>
    `;
    els.categoryBars.append(row);
  });
}

function renderSettings() {
  els.displayName.value = state.settings.displayName;
  els.userEmail.value = state.settings.email;
  els.appLock.checked = state.settings.appLock;
  els.emailReminders.checked = state.settings.emailReminders;
  els.pinInput.value = "";
}

function renderAll() {
  renderDashboard();
  renderCalendar();
  renderSearch();
  renderInsights();
  renderSettings();
  scheduleActiveReminders();
}

function openEditor(id = "", initialStart = new Date()) {
  const appointment = state.appointments.find((item) => item.id === id);
  const start = appointment ? new Date(appointment.start) : new Date(initialStart);
  const end = appointment ? new Date(appointment.end) : new Date(start.getTime() + 60 * 60 * 1000);

  els.dialogTitle.textContent = appointment ? "Edit Appointment" : "New Appointment";
  els.appointmentId.value = appointment?.id ?? "";
  els.title.value = appointment?.title ?? "";
  els.startDateTime.value = toDateTimeLocal(start);
  els.endDateTime.value = toDateTimeLocal(end);
  els.category.value = appointment?.category ?? "Personal";
  els.recurrence.value = appointment?.recurrence ?? "None";
  els.priority.value = appointment?.priority ?? "Normal";
  els.location.value = appointment?.location ?? "";
  els.tags.value = appointment?.tags?.join(", ") ?? "";
  els.notes.value = appointment?.notes ?? "";
  els.attachments.value = appointment?.attachments ?? "";
  els.emailReminder.checked = Boolean(appointment?.emailReminder);
  els.deleteAppointment.hidden = !appointment;
  els.markDone.hidden = !appointment;
  els.markDone.textContent = appointment?.completed ? "Mark Open" : "Mark Done";
  refreshEditorAvailability();
  els.appointmentDialog.showModal();
}

function refreshEditorAvailability() {
  const start = fromDateTimeLocal(els.startDateTime.value);
  const end = fromDateTimeLocal(els.endDateTime.value);
  const id = els.appointmentId.value;
  if (!start || !end || end <= start) {
    els.conflictBox.hidden = false;
    els.conflictBox.textContent = "End time must be after start time.";
    return;
  }
  const matches = conflicts(start, end, id);
  els.conflictBox.hidden = matches.length === 0;
  els.conflictBox.textContent = matches.length
    ? `${matches.length} conflict${matches.length === 1 ? "" : "s"} detected: ${matches.map((item) => item.title).join(", ")}`
    : "";
  renderSlots(els.editorSlots, freeSlots(start));
}

function saveAppointment(event) {
  event.preventDefault();
  const id = els.appointmentId.value || uid();
  const existing = state.appointments.find((item) => item.id === id);
  const appointment = normalizeAppointment({
    ...existing,
    id,
    title: els.title.value,
    start: fromDateTimeLocal(els.startDateTime.value),
    end: fromDateTimeLocal(els.endDateTime.value),
    category: els.category.value,
    recurrence: els.recurrence.value,
    priority: els.priority.value,
    location: els.location.value,
    tags: els.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
    notes: els.notes.value,
    attachments: els.attachments.value,
    emailReminder: els.emailReminder.checked,
    completed: existing?.completed ?? false
  });

  if (new Date(appointment.end) <= new Date(appointment.start)) {
    refreshEditorAvailability();
    return;
  }

  const index = state.appointments.findIndex((item) => item.id === id);
  if (index >= 0) state.appointments[index] = appointment;
  else state.appointments.push(appointment);

  saveState();
  els.appointmentDialog.close();
  renderAll();
}

function deleteCurrentAppointment() {
  const id = els.appointmentId.value;
  state.appointments = state.appointments.filter((item) => item.id !== id);
  saveState();
  els.appointmentDialog.close();
  renderAll();
}

function toggleCurrentDone() {
  const id = els.appointmentId.value;
  const appointment = state.appointments.find((item) => item.id === id);
  if (!appointment) return;
  appointment.completed = !appointment.completed;
  appointment.updatedAt = new Date().toISOString();
  saveState();
  els.appointmentDialog.close();
  renderAll();
}

function scheduleActiveReminders() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();

  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = Date.now();
  const horizon = now + 24 * 60 * 60 * 1000;
  expandedAppointments(new Date(now), new Date(horizon + 24 * 60 * 60 * 1000)).forEach((appointment) => {
    REMINDER_OFFSETS.forEach((offset) => {
      const triggerAt = new Date(appointment.start).getTime() - offset.ms;
      if (triggerAt <= now || triggerAt > horizon) return;
      const timer = setTimeout(() => showNotification(appointment, offset.label), triggerAt - now);
      timers.set(`${appointment.id}-${offset.ms}-${appointment.start}`, timer);
    });
  });
}

function showNotification(appointment, label) {
  const title = appointment.title;
  const body = `${label} before ${formatTime(appointment.start)}${appointment.location ? ` at ${appointment.location}` : ""}`;
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "SHOW_NOTIFICATION",
      title,
      body,
      appointmentId: appointment.id
    });
  } else if ("Notification" in window) {
    new Notification(title, { body, icon: "./assets/icon.svg" });
  }
}

function notificationStatusLabel() {
  if (!("Notification" in window)) return "Unsupported";
  if (Notification.permission === "granted") return "Enabled";
  if (Notification.permission === "denied") return "Denied";
  return "Not enabled";
}

function toDateInput(date) {
  return toDateTimeLocal(date).slice(0, 10);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function applyTheme() {
  const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = state.settings.theme === "dark" || (state.settings.theme === "system" && preferredDark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function seedIfEmpty() {
  if (state.appointments.length) return;
  const first = new Date();
  first.setHours(10, 0, 0, 0);
  const second = new Date();
  second.setHours(15, 30, 0, 0);
  state.appointments = [
    normalizeAppointment({
      title: "Review weekly priorities",
      start: first,
      end: new Date(first.getTime() + 45 * 60000),
      category: "Work",
      priority: "High",
      tags: ["planning"],
      notes: "Check conflicts and open focus blocks."
    }),
    normalizeAppointment({
      title: "Personal errand",
      start: second,
      end: new Date(second.getTime() + 60 * 60000),
      category: "Personal",
      priority: "Normal",
      location: "Nearby",
      tags: ["life"]
    })
  ];
  saveState();
}

function bindEvents() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.nav;
      document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.view === view));
      document.querySelectorAll("[data-nav]").forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });

  document.querySelector("#addButton").addEventListener("click", () => openEditor());
  document.querySelector("#themeToggle").addEventListener("click", () => {
    const currentDark = document.documentElement.dataset.theme === "dark";
    state.settings.theme = currentDark ? "light" : "dark";
    saveState();
    applyTheme();
  });

  document.querySelectorAll("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      const date = new Date();
      if (button.dataset.quick === "tomorrow") date.setDate(date.getDate() + 1);
      if (button.dataset.quick === "nextWeek") date.setDate(date.getDate() + 7);
      if (button.dataset.quick === "nextMonth") date.setMonth(date.getMonth() + 1);
      date.setMinutes(0, 0, 0);
      openEditor("", date);
    });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.calendarMode = button.dataset.mode;
      saveState();
      document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("is-selected", item === button));
      renderCalendar();
    });
  });

  els.calendarDate.addEventListener("change", renderCalendar);
  els.searchInput.addEventListener("input", renderSearch);
  els.appointmentForm.addEventListener("submit", saveAppointment);
  els.closeDialog.addEventListener("click", () => els.appointmentDialog.close());
  els.deleteAppointment.addEventListener("click", deleteCurrentAppointment);
  els.markDone.addEventListener("click", toggleCurrentDone);
  els.startDateTime.addEventListener("change", refreshEditorAvailability);
  els.endDateTime.addEventListener("change", refreshEditorAvailability);

  [els.displayName, els.userEmail, els.appLock, els.emailReminders].forEach((input) => {
    input.addEventListener("change", () => {
      state.settings.displayName = els.displayName.value;
      state.settings.email = els.userEmail.value;
      state.settings.appLock = els.appLock.checked;
      state.settings.emailReminders = els.emailReminders.checked;
      saveState();
    });
  });

  els.pinInput.addEventListener("change", async () => {
    const pin = els.pinInput.value.trim();
    if (pin.length < 4) return;
    state.settings.pinHash = await hashPIN(pin);
    state.settings.appLock = true;
    els.appLock.checked = true;
    els.pinInput.value = "";
    saveState();
  });

  els.unlockButton.addEventListener("click", unlockApp);
  els.unlockPin.addEventListener("keydown", (event) => {
    if (event.key === "Enter") unlockApp();
  });

  document.querySelector("#enableNotifications").addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
    renderInsights();
    scheduleActiveReminders();
  });

  document.querySelector("#installHelp").addEventListener("click", () => els.infoDialog.showModal());
  els.closeInfo.addEventListener("click", () => els.infoDialog.close());
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}

async function hashPIN(pin) {
  const data = new TextEncoder().encode(`solo-scheduler:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function unlockApp() {
  const hash = await hashPIN(els.unlockPin.value.trim());
  if (hash === state.settings.pinHash) {
    els.unlockError.textContent = "";
    els.unlockPin.value = "";
    els.lockDialog.close();
    return;
  }
  els.unlockError.textContent = "Incorrect PIN.";
}

function maybeLock() {
  if (state.settings.appLock && state.settings.pinHash) {
    els.lockDialog.showModal();
  }
}

function populateSelects() {
  els.category.innerHTML = CATEGORIES.map((category) => `<option>${category.name}</option>`).join("");
}

function init() {
  applyTheme();
  seedIfEmpty();
  populateSelects();
  bindEvents();
  els.calendarDate.value = toDateInput(new Date());
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("is-selected", button.dataset.mode === state.calendarMode));
  renderAll();
  registerServiceWorker();
  maybeLock();
}

init();
