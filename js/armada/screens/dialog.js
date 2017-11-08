/**
 * Copyright 2017 Krisztián Nagy
 * @file This module manages and provides the Dialog screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, window, document, setInterval, clearInterval */

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
            HEADER_ID = "header",
            MESSAGE_ID = "message",
            LEFT_BUTTON_ID = "leftButton",
            MIDDLE_BUTTON_ID = "middleButton",
            RIGHT_BUTTON_ID = "rightButton";
    // ##############################################################################
    /**
     * @class A class to represent the Mission debriefing screen in the game. Describes the dynamic behaviour on that screen.
     * @extends HTMLScreen
     */
    function DialogScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.DIALOG_SCREEN_NAME,
                armadaScreens.DIALOG_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.DIALOG_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                undefined,
                {
                    "left": this._selectPrevious.bind(this),
                    "right": this._selectNext.bind(this),
                    "enter": this._activateSelected.bind(this),
                    "escape": function () {
                        game.closeSuperimposedScreen();
                        if (this._onClose) {
                            this._onClose();
                        }
                    }.bind(this)
                });
        /** @type SimpleComponent */
        this._header = this.registerSimpleComponent(HEADER_ID);
        /** @type SimpleComponent */
        this._message = this.registerSimpleComponent(MESSAGE_ID);
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
     * @typedef {Object} DialogScreen~ButtonData
     * @property {String} caption 
     * @property {Function} action 
     */
    /**
     * @typedef {Object} DialogScreen~Data
     * @property {String} header
     * @property {String} message
     * @property {String} messageClass 
     * @property {DialogScreen~ButtonData[]} buttons
     * @property {Function} [onClose]
     */
    /**
     * Sets the contents of the screen's HTML element
     * @param {DialogScreen~Data} data
     */
    DialogScreen.prototype.setup = function (data) {
        var i;
        // setting event handlers
        this._onClose = data.onClose;
        // setting header and message
        this._header.setVisible(data.header && (data.header.length > 0));
        if (this._header.isVisible()) {
            this._header.setContent(data.header);
        }
        if (data.messageClass) {
            this._message.getElement().className += " " + data.messageClass;
        }
        this._message.setContent(data.message);
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
            this._buttons[i].setVisible(true);
        }
        this._activeButtonCount = data.buttons.length;
        while (i < this._buttons.length) {
            this._buttons[i].setVisible(false);
            i++;
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        dialogScreen: new DialogScreen()
    };
});