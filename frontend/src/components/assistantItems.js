const BASE_KEY = "voiceai_assistant_items";

function getStorageKey(userId) {
  return userId ? `${BASE_KEY}_${userId}` : `${BASE_KEY}_guest`;
}

export function loadAssistantItems(userId) {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(userId)) || "[]");
  } catch {
    return [];
  }
}

export function saveAssistantItems(items, userId) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(items));
  window.dispatchEvent(new Event("voiceai-items-updated"));
}

export function addAssistantItem(item, userId) {
  const items = loadAssistantItems(userId);

  const exists = items.some(
    (x) => x.id === item.id && x.type === item.type
  );

  if (exists) return items;

  const next = [
    ...items,
    {
      ...item,
      userId,
      notified: false,
      createdAt: item.createdAt || new Date().toISOString(),
    },
  ];

  saveAssistantItems(next, userId);
  return next;
}

export function removeAssistantItem(id, userId) {
  const items = loadAssistantItems(userId);
  const next = items.filter((item) => item.id !== id);
  saveAssistantItems(next, userId);
  return next;
}

export function clearAssistantItemsByType(type, userId) {
  const items = loadAssistantItems(userId);
  const next = items.filter((item) => item.type !== type);
  saveAssistantItems(next, userId);
  return next;
}

export function parseTimeToday(timeText) {
  const raw = String(timeText || "").toLowerCase().trim();

  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const ampm = match[3];

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  if (hour > 23 || minute > 59) return null;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date;
}

export function isItemDue(item) {
  if (item.type === "task") return false;

  const timeText = item.timeText || item.time || "";
  const due = parseTimeToday(timeText);

  if (!due) return false;

  return new Date() >= due;
}