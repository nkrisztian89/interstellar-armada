/**
 * Copyright 2017-2026 Krisztián Nagy
 * @file This module manages and provides the Dialog and Error dialog screens of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param game Used for navigation 
 * @param screens The debriefing screen is a subclass of HTMLScreen
 * @param armadaScreens Used for navigation
 */
define([
    "modules/game",
    "modules/screens",
    "armada/screens/shared"
], function (game, screens, armadaScreens) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BOX_ID = "box",
            HEADER_ID = "headerText",
            MESSAGE_ID = "message",
            SHOW_DETAILS_ID = "showDetails",
            DETAILS_ID = "details",
            LEFT_BUTTON_ID = "leftButton",
            MIDDLE_BUTTON_ID = "middleButton",
            RIGHT_BUTTON_ID = "rightButton";
    // ##############################################################################
    /**
     * @class A class to represent the Dialog and ErrorDialog screens of the game. Describes the dynamic behaviour on those screens.
     * @extends HTMLScreen
     * @param {Boolean} [isErrorDialog=false] If true, this instance is set up as the error dialog screen (own name / HTML / CSS /
     * background) instead of the regular dialog screen, setup() accepts the error-dialog-only data properties (see
     * DialogScreen~Data), and it blocks ScreenManager navigation while shown (see HTMLScreen.blocksNavigation()).
     */
    function DialogScreen(isErrorDialog) {
        screens.HTMLScreen.call(this,
                isErrorDialog ? armadaScreens.ERROR_DIALOG_SCREEN_NAME : armadaScreens.DIALOG_SCREEN_NAME,
                isErrorDialog ? armadaScreens.ERROR_DIALOG_SCREEN_SOURCE : armadaScreens.DIALOG_SCREEN_SOURCE,
                {
                    cssFilename: isErrorDialog ? armadaScreens.ERROR_DIALOG_SCREEN_CSS : armadaScreens.DIALOG_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME + " " + (isErrorDialog ? armadaScreens.ERROR_DIALOG_BACKGROUND_CLASS_NAME : armadaScreens.DIALOG_BACKGROUND_CLASS_NAME),
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                undefined,
                {
                    "left": this._selectPrevious.bind(this),
                    "right": this._selectNext.bind(this),
                    "enter": this._activateSelected.bind(this),
                    "escape": function () {
                        if (this._escapeDisabled) {
                            return;
                        }
                        game.closeSuperimposedScreen(true);
                        if (this._onClose) {
                            this._onClose();
                        }
                    }.bind(this)
                },
                undefined,
                isErrorDialog);
        /** @type SimpleComponent */
        this._box = this.registerSimpleComponent(BOX_ID);
        /** @type SimpleComponent */
        this._header = this.registerSimpleComponent(HEADER_ID);
        /** @type SimpleComponent */
        this._message = this.registerSimpleComponent(MESSAGE_ID);
        /** @type SimpleComponent */
        this._showDetails = isErrorDialog ? this.registerSimpleComponent(SHOW_DETAILS_ID) : null;
        /** @type SimpleComponent */
        this._details = isErrorDialog ? this.registerSimpleComponent(DETAILS_ID) : null;
        /** @type SimpleComponent */
        this._leftButton = this.registerSimpleComponent(LEFT_BUTTON_ID);
        /** @type SimpleComponent */
        this._middleButton = this.registerSimpleComponent(MIDDLE_BUTTON_ID);
        /** @type SimpleComponent */
        this._rightButton = this.registerSimpleComponent(RIGHT_BUTTON_ID);
        /** @type SimpleComponent[] */
        this._buttons = [this._leftButton, this._middleButton, this._rightButton];
        /** @type Number */
        this._selectedIndex = -1;
        /** @type Number */
        this._activeButtonCount = 0;
        /** @type Function */
        this._buttonLeaveHandler = this._selectIndex.bind(this, -1);
        /** @type Function */
        this._onClose = null;
        /**
         * While true, the escape key does nothing on this screen (used for the error dialog screen to force the use of its
         * buttons for critical errors, where no dismiss/continue option is offered)
         * @type Boolean
         */
        this._escapeDisabled = false;
        /**
         * The class last added to the box element by setup() (see DialogScreen~Data.boxClass), if any - tracked so it can be removed
         * again before a new one is added.
         * @type String
         */
        this._boxClass = null;
    }
    DialogScreen.prototype = new screens.HTMLScreen();
    DialogScreen.prototype.constructor = DialogScreen;
    /**
     * 
     * @param {Number} index
     */
    DialogScreen.prototype._selectIndex = function (index) {
        if (index !== this._selectedIndex) {
            if (this._selectedIndex >= 0) {
                this._buttons[this._selectedIndex].unselect();
            }
            this._selectedIndex = index;
            if (this._selectedIndex >= 0) {
                this._buttons[this._selectedIndex].select();
                armadaScreens.playButtonSelectSound(true);
            }
        }
    };
    /**
     * 
     */
    DialogScreen.prototype._selectNext = function () {
        this._selectIndex((this._selectedIndex + 1) % this._activeButtonCount);
    };
    /**
     * 
     */
    DialogScreen.prototype._selectPrevious = function () {
        var index = (this._selectedIndex > 0) ? this._selectedIndex : this._activeButtonCount;
        this._selectIndex((index - 1) % this._buttons.length);
    };
    /**
     * 
     */
    DialogScreen.prototype._activateSelected = function () {
        if (this._selectedIndex >= 0) {
            this._buttons[this._selectedIndex].getElement().onclick();
        }
    };
    /**
     * @override
     * @param {Boolean} active
     */
    DialogScreen.prototype.setActive = function (active) {
        screens.HTMLScreen.prototype.setActive.call(this, active);
        this._selectIndex(-1);
    };
    /**
     * 
     * @param {Function} action
     * @returns {Function}
     */
    DialogScreen.prototype._createButtonClickHandler = function (action) {
        return function () {
            action();
            armadaScreens.playButtonClickSound(true);
        };
    };
    /**
     * @override
     */
    DialogScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        if (this._showDetails) {
            this._showDetails.getElement().onclick = function () {
                this._showDetails.hide();
                this._details.show();
            }.bind(this);
        }
    };
    /**
     * @typedef {Object} DialogScreen~ButtonData
     * @property {String} caption 
     * @property {Function} action 
     */
    /**
     * @typedef {Object} DialogScreen~Data
     * @property {String} header
     * @property {String} message
     * @property {String} messageClass
     * @property {String} [details] Error dialog only
     * @property {DialogScreen~ButtonData[]} buttons
     * @property {Function} [onClose] Called when the screen is closed via the escape key (not called when a button closes it - the
     * button's own action is responsible for that)
     * @property {Boolean} [plainText=false] If true, message is set as text content instead of HTML content, so it cannot contain
     * markup - used for the error dialog screen, as error messages can contain arbitrary text (e.g. file names, JSON snippets)
     * @property {Boolean} [escapeDisabled=false] If true, the escape key does nothing while this dialog is shown - used for critical
     * errors on the error dialog screen, where only its own button is allowed to dismiss it
     * @property {String} [boxClass] If given, added as a class to the box element (replacing whatever was added by a previous setup()
     * call on this same screen instance, if any)
     */
    /**
     * Sets the contents of the screen's HTML element
     * @param {DialogScreen~Data} data
     */
    DialogScreen.prototype.setup = function (data) {
        var i;
        // setting event handlers
        this._onClose = data.onClose;
        this._escapeDisabled = !!data.escapeDisabled;
        // setting the box class
        if (this._boxClass) {
            this._box.getElement().classList.remove(this._boxClass);
        }
        this._boxClass = data.boxClass || null;
        if (this._boxClass) {
            this._box.getElement().classList.add(this._boxClass);
        }
        // setting header and message
        this._header.setVisible(data.header && (data.header.length > 0));
        if (this._header.isVisible()) {
            this._header.setContent(data.header);
        }
        if (data.messageClass) {
            this._message.getElement().className += " " + data.messageClass;
        }
        if (data.plainText) {
            this._message.setTextContent(data.message);
            if (this._details) {
                this._details.setTextContent(data.details || "");
                this._details.hide();
            }
        } else {
            this._message.setContent(data.message);
            if (this._details) {
                this._details.setContent(data.details || "");
                this._details.hide();
            }
        }
        if (this._showDetails) {
            this._showDetails.setVisible(!!data.details);
        }
        // setting up buttons
        // remove previous event listeners
        for (i = 0; i < this._buttons.length; i++) {
            this._buttons[i].getElement().onclick = null;
            this._buttons[i].getElement().onmousemove = null;
            this._buttons[i].getElement().onmouseleave = null;
        }
        // setting captions and adding new listeners
        for (i = 0; i < data.buttons.length; i++) {
            this._buttons[i].setContent(data.buttons[i].caption);
            this._buttons[i].getElement().onclick = this._createButtonClickHandler(data.buttons[i].action);
            this._buttons[i].getElement().onmousemove = this._selectIndex.bind(this, i);
            this._buttons[i].getElement().onmouseleave = this._buttonLeaveHandler;
            this._buttons[i].show();
        }
        this._activeButtonCount = data.buttons.length;
        while (i < this._buttons.length) {
            this._buttons[i].hide();
            i++;
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getDialogScreen: function () {
            return new DialogScreen();
        },
        getErrorDialogScreen: function () {
            return new DialogScreen(true);
        }
    };
});