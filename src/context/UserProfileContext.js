/**
 * src/context/UserProfileContext.js
 *
 * Lightweight context that caches the fields users can edit in EditProfileScreen
 * (bio, bannerColor, name, pinnedBadge).
 *
 * ProfileScreen writes the initial values here after its API fetch.
 * EditProfileScreen reads the initial values from here AND writes back
 * immediately after a successful PUT — so ProfileScreen re-renders
 * with the new data the moment the user taps "Save Changes", without
 * waiting for a network re-fetch.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const UserProfileContext = createContext(null);

export function UserProfileProvider({ children }) {
  const [profileCache, setProfileCache] = useState({
    name:        '',
    bio:         '',
    bannerColor: '#7C3AED',
    pinnedBadge: null,
    avatar:      null,
  });

  /**
   * Merge a partial profile update into the cache.
   * Accepts any subset of { name, bio, bannerColor, pinnedBadge, avatar }.
   */
  const updateProfileCache = useCallback((patch) => {
    setProfileCache((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <UserProfileContext.Provider value={{ profileCache, updateProfileCache }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used inside UserProfileProvider');
  return ctx;
}
