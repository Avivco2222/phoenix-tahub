"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Notification {
  id: number;
  msg: string;
  type: 'success' | 'warning' | 'info' | 'kudos';
  time: string;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (msg: string, type: Notification['type']) => void;
  markAllAsRead: () => void;
  clearNotification: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, msg: "ברוך הבא ל-TAHub! המערכת מסונכרנת.", type: 'info', time: 'עכשיו', read: false }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = (msg: string, type: Notification['type']) => {
    setNotifications(prev => [{
      id: Date.now(),
      msg,
      type,
      time: 'ממש עכשיו',
      read: false
    }, ...prev]);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllAsRead, clearNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
