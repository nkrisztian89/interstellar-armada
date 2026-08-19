/**
 * Copyright 2026 Krisztián Nagy
 * @file This module exports the showError() function for displaying errors using the ErrorDialog screen for Interstellar Armada.
 * Before its setScreensReady() function is called, critical errors are directly injected into the splash screen while non-critical
 * ones are queued to be displayed afterwards.
 * The actual error dialog screen this module uses is exported by dialog.js.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param application Used for logging
 * @param game Used for error severities, screen navigation and pausing / resuming an ongoing battle
 * @param utils Used to format the repeat counter / suppressed error count into the displayed message
 * @param armadaScreens Used for common screen constants
 * @param strings Used for translation support
 */
define([
    "modules/application",
    "modules/game",
    "utils/utils",
    "armada/screens/shared",
    "armada/strings"
], function (application, game, utils, armadaScreens, strings) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            /**
             * At most this many distinct errors are queued while one is being displayed - further ones are dropped and just counted
             * @type Number
             */
            MAX_QUEUE_LENGTH = 8,
            SPLASH_ERROR_ID = "splashError",
            SPLASH_ERROR_TEXT_ID = "splashErrorText",
            SPLASH_ERROR_RELOAD_ID = "splashErrorReload",
            SPLASH_PROGRESS_ID = "splashProgress",
            CRITICAL_CLASS = "critical",
            SEVERE_CLASS = "severe",
            MINOR_CLASS = "minor",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * @typedef {Object} ErrorEntry
             * @property {String} key The key used to identify (deduplicate / mute) this error, based on its message and details
             * @property {String} message The main error message
             * @property {String} severity (enum game.ErrorSeverity) The error severity level (influences dialog header/style) and exact handling flow
             * @property {String} [details] Optional error details, hidden behind a "show details" expander in the dialog by default
             * @property {Boolean} disableIgnore Whether the "ignore this error" option is disabled for this error so it can be muted
             * @property {Number} count How many times this error has been encountered (and deduplicated) in the current queue
             */
            /**
             * The entry currently displayed on the error dialog screen, or null if none is shown at the moment.
             * @type ErrorEntry|null
             */
            _displayedEntry = null,
            /**
             * Entries waiting to be displayed once the current one is dismissed, oldest first.
             * @type ErrorEntry[]
             */
            _queue = [],
            /**
             * The keys of the errors dismissed using the "ignore this error" option, which should therefore not be shown
             * again during this session.
             * @type Set.<String>
             */
            _ignoredEntryKeys = new Set(),
            /**
             * How many distinct errors were dropped (not queued) because the queue was full. Shown as a footnote on the next displayed
             * error, then reset to 0.
             * @type Number
             */
            _suppressedCount = 0,
            /**
             * Set to true once a critical error has been displayed. Afterwards, the application is considered non-functional and only
             * reloading the page can help, so all further errors are ignored.
             * @type Boolean
             */
            _halted = false,
            /**
             * True while inside the error handling code to avoid infinite recursion if the error handling itself triggers another error.
             * @type Boolean
             */
            _handlingError = false,
            /**
             * Whether an ongoing battle has been paused because of the error(s) currently being shown, and therefore needs to be resumed
             * once the last one is dismissed.
             * @type Boolean
             */
            _pausedBattle = false,
            /**
             * While false, critical errors are injected to the splash screen and non-critical ones are queued instead of being displayed.
             * @type Boolean
             */
            _screensReady = false,
            /**
             * The non-critical errors that were triggered while _screensReady was still false, waiting to be displayed once the game
             * finishes booting.
             * @type ErrorEntry[]|null
             */
            _preScreenQueue = [],
            /**
             * Moves on to the next queued error or resumes the game, if none is left.
             * Declared here because of circular reference with _display().
             * @type Function
             */
            _dismissError;
    // ------------------------------------------------------------------------------
    // private functions
    /**
     * Returns the key used to identify (deduplicate / mute) an error by its message and details.
     * @param {String} message
     * @param {String} [details]
     * @returns {String}
     */
    function _getEntryKey(message, details) {
        return message + "\n" + (details || "");
    }
    /**
     * @param {String} message
     * @param {String} [severity] (enum game.ErrorSeverity)
     * @param {String} [details]
     * @param {Boolean} [disableIgnore=false] See showError()
     * @returns {ErrorEntry}
     */
    function _createEntry(message, severity, details, disableIgnore) {
        return {
            key: _getEntryKey(message, details),
            message: message,
            severity: severity,
            details: details,
            disableIgnore: !!disableIgnore,
            count: 1
        };
    }
    /**
     * Reloads the page. The action of the "restart game" button, as well as of the splash-level fallback's reload button.
     */
    function _restartGame() {
        location.reload();
    }
    /**
     * Returns whether the battle screen is the currently active screen - i.e. whether a battle is actually in progress and
     * visible, as opposed to being covered already by the in-game menu or another popup.
     * @returns {Boolean}
     */
    function _isBattleActive() {
        var currentScreen = game.getScreen();
        return !!currentScreen && (currentScreen.getName() === armadaScreens.BATTLE_SCREEN_NAME);
    }
    /**
     * Pauses the battle screen, if it is currently active and not already paused because of an earlier error in the same session.
     * @param {Boolean} [stop=false] Whether to force a full stop, also halting the render loop in multiplayer (used for critical
     * errors, where nothing but a reload should keep happening)
     */
    function _pauseBattle(stop) {
        if (!_pausedBattle && _isBattleActive()) {
            game.getScreen(armadaScreens.BATTLE_SCREEN_NAME).pauseBattle(stop);
            _pausedBattle = true;
        } else if (_pausedBattle && stop) {
            game.getScreen(armadaScreens.BATTLE_SCREEN_NAME).pauseBattle(stop);
        }
    }
    /**
     * Resumes the battle if previously paused by _pauseBattle().
     */
    function _resumeBattle() {
        if (_pausedBattle) {
            _pausedBattle = false;
            game.getScreen(armadaScreens.BATTLE_SCREEN_NAME).resumeBattle();
        }
    }
    /**
     * Closes the error dialog and moves on to the next queued error (or resumes the game, if none is left), without muting anything.
     * The "continue" button action, as well as the escape key action (both only used for non-critical errors).
     */
    function _continueError() {
        game.closeSuperimposedScreen(true);
        _dismissError();
    }
    /**
     * Mutes the error with the given key so it will not be shown again this session, then behaves like _continueError(). The "ignore
     * this error" button action.
     * @param {String} key
     */
    function _ignoreError(key) {
        _ignoredEntryKeys.add(key);
        _continueError();
    }
    /**
     * Assembles and returns the dialog data to display the given entry.
     * @param {ErrorEntry} entry
     * @returns {DialogScreen~Data}
     */
    function _createDialogData(entry) {
        var header, boxClass, message, buttons,
                critical = entry.severity === game.ErrorSeverity.CRITICAL,
                severe = entry.severity === game.ErrorSeverity.SEVERE;
        // header text and CSS class
        switch (entry.severity) {
            case game.ErrorSeverity.CRITICAL:
                header = strings.get(strings.ERROR_DIALOG.HEADER_CRITICAL);
                boxClass = CRITICAL_CLASS;
                break;
            case game.ErrorSeverity.SEVERE:
                header = strings.get(strings.ERROR_DIALOG.HEADER_SEVERE);
                boxClass = SEVERE_CLASS;
                break;
            default:
                header = strings.get(strings.ERROR_DIALOG.HEADER_MINOR);
                boxClass = MINOR_CLASS;
        }
        // main message text, with repeat counter and suppressed error count if applicable
        message = entry.message;
        if (entry.count > 1) {
            message += utils.formatString(strings.get(strings.ERROR_DIALOG.REPEAT_SUFFIX), {count: entry.count});
        }
        if (_suppressedCount > 0) {
            message += "\n\n" + utils.formatString(strings.get(strings.ERROR_DIALOG.SUPPRESSED_NOTE), {count: _suppressedCount});
            _suppressedCount = 0;
        }
        // buttons, appropriate for severity and other entry properties
        buttons = [];
        if (severe || critical) {
            buttons.push({caption: strings.get(strings.ERROR_DIALOG.RESTART_BUTTON), action: _restartGame});
        }
        if (!critical) {
            if (!entry.disableIgnore) {
                buttons.push({caption: strings.get(strings.ERROR_DIALOG.IGNORE_BUTTON), action: _ignoreError.bind(null, entry.key)});
            }
            buttons.push({caption: strings.get(strings.ERROR_DIALOG.CONTINUE_BUTTON), action: _continueError});
        }
        return {
            header: header,
            message: message,
            details: entry.details,
            plainText: true,
            escapeDisabled: critical,
            boxClass: boxClass,
            buttons: buttons,
            onClose: critical ? null : _dismissError
        };
    }
    /**
     * Updates the error dialog screen to display the current entry.
     */
    function _refreshDialogData() {
        game.getScreen(armadaScreens.ERROR_DIALOG_SCREEN_NAME).setup(_createDialogData(_displayedEntry));
    }
    /**
     * Superimposes the error dialog screen to display the given entry.
     * @param {ErrorEntry} entry
     */
    function _displayEntry(entry) {
        _displayedEntry = entry;
        _refreshDialogData();
        game.setScreen(armadaScreens.ERROR_DIALOG_SCREEN_NAME, true, armadaScreens.SUPERIMPOSE_BACKGROUND_COLOR);
    }
    /**
     * Shows the next queued error, if any, otherwise clears the display state, resumes a battle that was paused 
     * because of the error(s) just dismissed, and executes the pending navigation request if one came in while
     * the error dialog was displayed.
     */
    _dismissError = function () {
        var next = _queue.shift();
        if (next) {
            _displayEntry(next);
        } else {
            _displayedEntry = null;
            _resumeBattle();
            game.executePendingNavigation();
        }
    };
    /**
     * Queues the given entry to be displayed once the current one is dismissed, or displays it right away if none is shown at the moment.
     * Handles queue overflow and deduplicates repeated errors (bumping a counter instead of showing it again).
     * @param {ErrorEntry} entry
     */
    function _queueEntry(entry) {
        var i;
        if (_ignoredEntryKeys.has(entry.key) && !entry.disableIgnore) {
            return;
        }
        if (_displayedEntry && (_displayedEntry.key === entry.key)) {
            _displayedEntry.count++;
            _refreshDialogData();
            return;
        }
        for (i = 0; i < _queue.length; i++) {
            if (_queue[i].key === entry.key) {
                _queue[i].count++;
                return;
            }
        }
        if (!_displayedEntry) {
            _pauseBattle(false);
            _displayEntry(entry);
        } else if (_queue.length < MAX_QUEUE_LENGTH) {
            _queue.push(entry);
        } else {
            _suppressedCount++;
        }
    }
    /**
     * Queues the given non-critical entry, encountered before the game has finished booting.
     * Handles deduplication of repeated errors (bumping a counter instead of showing it again).
     * @param {ErrorEntry} entry
     */
    function _queuePreScreen(entry) {
        var i;
        for (i = 0; i < _preScreenQueue.length; i++) {
            if (_preScreenQueue[i].key === entry.key) {
                _preScreenQueue[i].count++;
                return;
            }
        }
        _preScreenQueue.push(entry);
    }
    /**
     * Inject the passed error message + details directly into the splash screen. Used when a critical error
     * is encountered before the game has finished booting, so the error dialog screen is not available yet.
     * @param {String} message
     * @param {String} [details]
     */
    function _showAtSplash(message, details) {
        var container = document.getElementById(SPLASH_ERROR_ID),
                text = document.getElementById(SPLASH_ERROR_TEXT_ID),
                reloadButton = document.getElementById(SPLASH_ERROR_RELOAD_ID),
                progress = document.getElementById(SPLASH_PROGRESS_ID);
        if (!container) {
            return;
        }
        reloadButton.addEventListener("click", _restartGame);
        text.textContent += (text.textContent ? "\n\n" : "") + message + (details ? "\n\n" + details : "");
        container.hidden = false;
        if (progress) {
            progress.hidden = true;
        }
    }
    // ------------------------------------------------------------------------------
    // public functions
    /**
     * To be called once the game has finished booting (the splash screen has been removed and the start screen is showing), so
     * showError() can start displaying errors using the error dialog screen.
     * Displays all non-critical errors that arrived while still booting, in the order they occurred.
     */
    function setScreensReady() {
        var pending = _preScreenQueue, i;
        _preScreenQueue = null;
        _screensReady = true;
        for (i = 0; i < pending.length; i++) {
            _queueEntry(pending[i]);
        }
    }
    /**
     * The override for application.showError() that displays the error using the game's own error dialog screen,
     * with advanced features such as repeat counting, muting, queuing multiple errors and handling the special
     * case of errors arriving before the screen system is ready.
     * @param {String} message
     * @param {String} [severity] (enum game.ErrorSeverity) Errors without a severity are treated as minor.
     * @param {String} [details]
     * @param {Boolean} [disableIgnore=false] Whether to hide the option to ignore repeated errors of the same type. If true,
     * the current error will be displayed even if its type is otherwise muted. (useful for errors that arrive as response to
     * deliberate user action, to avoid lack of feedback being confusing)
     */
    function showError(message, severity, details, disableIgnore) {
        /** @type ErrorEntry */
        var entry;
        if (_handlingError) {
            application.log_DEBUG("Error encountered while already handling another error, not showing a separate dialog for it: " + message);
            return;
        }
        _handlingError = true;
        try {
            if (_halted) {
                return;
            }
            if (severity === game.ErrorSeverity.CRITICAL) {
                _halted = true;
                _queue.length = 0;
                _preScreenQueue = null;
                if (!_screensReady) {
                    _showAtSplash(message, details);
                    return;
                }
                entry = _createEntry(message, severity, details, disableIgnore);
                _pauseBattle(true);
                if (_displayedEntry) {
                    _displayedEntry = entry;
                    _refreshDialogData();
                } else {
                    _displayEntry(entry);
                }
                return;
            }
            entry = _createEntry(message, severity, details, disableIgnore);
            if (!_screensReady) {
                _queuePreScreen(entry);
                return;
            }
            _queueEntry(entry);
        } finally {
            _handlingError = false;
        }
    }
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        setScreensReady: setScreensReady,
        showError: showError
    };
});
