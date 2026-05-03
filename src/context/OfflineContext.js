/**
 * src/context/OfflineContext.js
 *
 * Provides: isOnline, pendingCount, toast message, triggerSync()
 * Listens for connectivity changes and auto-syncs the pending queue.
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncPendingQueue, refreshCacheFromServer } from '../lib/syncManager';
import { getPendingQueue } from '../lib/offlineStore';

const OfflineContext = createContext({
  isOnline:     true,
  pendingCount: 0,
  toast:        null,
  triggerSync:  () => {},
});

export function OfflineProvider({ children }) {
  const [isOnline,     setIsOnline]     = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [toast,        setToast]        = useState(null); // { msg, id }
  const toastTimer = useRef(null);
  const wasOffline = useRef(false);

  const showToast = useCallback((msg) => {
    const id = Date.now();
    setToast({ msg, id });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const q = await getPendingQueue();
    setPendingCount(q.length);
  }, []);

  const triggerSync = useCallback(async () => {
    const count = await syncPendingQueue();
    await refreshPendingCount();
    if (count > 0) {
      await refreshCacheFromServer();
      showToast(`✓ Synced ${count} change${count !== 1 ? 's' : ''}`);
    }
  }, [refreshPendingCount, showToast]);

  // NetInfo subscription
  useEffect(() => {
    refreshPendingCount();

    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(!!online);

      if (online && wasOffline.current) {
        // Just came back online — sync
        triggerSync();
      }
      wasOffline.current = !online;
    });

    return () => { unsub(); clearTimeout(toastTimer.current); };
  }, [triggerSync, refreshPendingCount]);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, toast, triggerSync, showToast, refreshPendingCount }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineContext);
}
