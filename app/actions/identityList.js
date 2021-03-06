// @flow
import { createAction } from 'redux-actions'
import Identity from 'models/Identity'
import * as profile from './profile'
import * as scheduler from 'utils/scheduler'
import * as chat from './chat'
import * as contactList from './contactList'
import * as settings from './settings'
import * as shareList from './shareList'
import * as profileResolver from './contactResolver'
import { PROFILE_PUBLISH_PERIOD } from 'models/Profile'
import { getLoginStore, getFullStore, dropFullStore } from 'store/index'


export const priv = {
  selectIdenty: createAction('IDENTITYLIST_IDENTITY_SELECT',
    (identity: Identity) => (identity)
  ),
  resetIdentity: createAction('IDENTITYLIST_IDENTITY_RESET'),
}

/**
 * Login using the given identity and load the user data
 * @param identity
 * @param password
 * @returns {Promise}
 */
export function login(identity: Identity, password: ?string = null) {
  return async function (dispatch) {
    const fullStore = await getFullStore(identity.storageKey, identity.identity)
    const fullStoreDispatch = fullStore.dispatch

    await fullStoreDispatch(profile.checkKeys())
    await fullStoreDispatch(profile.checkPassword(password))

    await dispatch(priv.selectIdenty(identity))

    // Update the theme with the user settings
    dispatch(settings.setTheme(fullStore.getState().settings.theme))

    // Start listening to network events
    fullStoreDispatch(chat.subscribe())
    fullStoreDispatch(contactList.subscribe())
    fullStoreDispatch(shareList.subscribe())
    fullStoreDispatch(profileResolver.subscribe())

    // Start publishing the profile periodically
    scheduler.startTimeBetween(fullStoreDispatch,
      'publishProfile',
      profile.publish(),
      PROFILE_PUBLISH_PERIOD
    )

    // Start dialing relay connection to contacts periodically
    scheduler.startTimeBetween(fullStoreDispatch,
      'relayConnectDirectoryContacts',
      contactList.relayConnectDirectoryContacts(),
      60 * 60 * 1000, // 1 hour
      2 * 1000 // 2 seconds delay
    )

    // Start updating contacts periodically
    scheduler.startTimeBetween(fullStoreDispatch,
      'updateAllContacts',
      contactList.updateAllContacts(),
      60 * 60 * 1000, // 1 hour
      3 * 60 * 1000 // 3 minutes delay
    )

    scheduler.startTimeBetween(fullStoreDispatch,
      'pingAllContacts',
      contactList.pingAllContacts(),
      2 * 60 * 1000, // 2 minutes,
      4 * 1000 // 4 seconds delay
    )

    scheduler.startTimeBetween(fullStoreDispatch,
      'queryAllContactsList',
      contactList.queryAllContactsList(),
      60 * 60 * 1000, // 1 hour
      2 * 60 * 1000 // 2 minutes delay
    )

    // slow timer to check all share's data
    scheduler.startTimeBetween(fullStoreDispatch,
      'updateAllLocalities',
      shareList.updateAllLocalities(),
      5 * 60 * 1000, // 5 minutes
      60 * 1000 // 1 minute delay
    )

    // fast timer to check active shares's data
    scheduler.startTimeBetween(fullStoreDispatch,
      'updateActivesLocalities',
      shareList.updateActivesLocalities(),
      1000 // 1 seconds
    )

    // re-trigger active shares download
    fullStoreDispatch(shareList.restartDownloadings())
  }
}

/**
 * Logout, persist and unload the user data
 * @returns {Promise}
 */
export function logout() {
  return async function (dispatch) {
    dropFullStore()

    const loginStore = await getLoginStore()
    await loginStore.dispatch(priv.resetIdentity())

    // Stop any scheduled tasks
    scheduler.stopAll()

    // Stop listening to network events
    dispatch(chat.unsubscribe())
    dispatch(contactList.unsubscribe())
    dispatch(shareList.unsubscribe())
    dispatch(profileResolver.unsubscribe())
  }
}
