export const formatDateHe = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return date.toLocaleDateString("he-IL");
};

export const formatTimeHe = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
};
