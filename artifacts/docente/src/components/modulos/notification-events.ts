// Shared by Server and Client Components, so it must not live in a "use client" module.
// Dispatched on window after a notification is marked as read so the shell bell refreshes its count.
export const NOTIFICATIONS_CHANGED_EVENT = "docente:notifications-changed";
