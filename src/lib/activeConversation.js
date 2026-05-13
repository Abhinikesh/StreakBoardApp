/**
 * src/lib/activeConversation.js
 *
 * Module-level presence tracker: records which friendId (if any) the user
 * is currently viewing in ConversationScreen.
 *
 * Used by App.js to suppress foreground push notifications when the user
 * is already looking at that conversation.
 */

let _activeFriendId = null;

/** Call when ConversationScreen gains focus. */
export const setActiveConversation   = (id) => { _activeFriendId = id; };

/** Call when ConversationScreen loses focus / unmounts. */
export const clearActiveConversation = ()  => { _activeFriendId = null; };

/** Returns the currently-active friendId, or null. */
export const getActiveConversation   = ()  => _activeFriendId;
