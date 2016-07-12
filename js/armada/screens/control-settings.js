/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file This module manages and provides the Control settings screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, document */

/**
 * @param utils Used for formatting strings and for the keycode table
 * @param screens The controls screen is cubclassed from HTMLScreen
 * @param game Used for navigation
 * @param strings Used for translation support
 * @param armadaScreens Used for common screen constants
 * @param control Used to access and modify control settings of the game
 */
define([
    "utils/utils",
    "modules/screens",
    "modules/game",
    "armada/strings",
    "armada/screens/shared",
    "armada/control"
], function (utils, screens, game, strings, armadaScreens, control) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            TITLE_HEADING_ID = "title",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            TABLES_CONTAINER_ID = "tablesContainer",
            CLICKABLE_CLASS_NAME = "clickable",
            HIGHLIGHTED_CLASS_NAME = "highlightedItem",
            TABLE_CLASS_NAME = "horizontallyCentered outerContainer",
            CONTROL_STRING_DURING_SETTING = "?",
            SHIFT_CODE = 16,
            CTRL_CODE = 17,
            ALT_CODE = 18,
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * The name of the action currently being set (to get triggered by a new 
             * key). If null, the user is not setting any actions.
             * @type String
             */
            _actionUnderSetting = null,
            /**
             * While the user sets a new key,  tells if shift is being pressed down.
             * @type Boolean
             */
            _settingShiftState = false,
            /**
             * While the user sets a new key, tells if control is being pressed down.
             * @type Boolean
             */
            _settingCtrlState = false,
            /**
             * While the user sets a new key, tells if alt is being pressed down.
             * @type Boolean
             */
            _settingAltState = false;
    // ------------------------------------------------------------------------------
    // private functions    
    /**
     * Updates the cell content showing the currently set control for the given action 
     * @param {String} inputDevice
     * @param {String} actionName
     */
    function _updateControlStringForAction(inputDevice, actionName) {
        document.getElementById(actionName).innerHTML = control.getInputInterpreter(inputDevice).getControlStringForAction(actionName);
        document.getElementById(actionName).className = CLICKABLE_CLASS_NAME;
    }
    /**
     * Cancels an ongoing key setting by updating the internal state, refreshing the
     * UI (cancelling highlight and restoring it to show the original key) and cancelling
     * key event handlers.
     */
    function _stopKeySetting() {
        if (_actionUnderSetting !== null) {
            _updateControlStringForAction(control.KEYBOARD_NAME, _actionUnderSetting);
            _actionUnderSetting = null;
            document.onkeydown = null;
            document.onkeyup = null;
        }
    }
    /**
     * Handler for the keydown event to be active while the user is setting a new key
     * for an action. Updates the shift, control and alt states if one of those keys
     * is pressed, so that key combinations such as "ctrl + left" can be set.
     * @param {KeyboardEvent} event
     */
    function handleKeyDownWhileSetting(event) {
        if (event.keyCode === SHIFT_CODE) {
            _settingShiftState = true;
        }
        if (event.keyCode === CTRL_CODE) {
            _settingCtrlState = true;
        }
        if (event.keyCode === ALT_CODE) {
            _settingAltState = true;
        }
    }
    /**
     * Handler for the keyp event to be active while the user is setting a new key
     * for an action. This actually sets the key to the one that has been released,
     * taking into account the shift, control and alt states as well.
     * @param {KeyboardEvent} event
     */
    function handleKeyUpWhileSetting(event) {
        // if we released shift, ctrl or alt, update their state
        if (event.keyCode === SHIFT_CODE) {
            _settingShiftState = false;
        } else if (event.keyCode === CTRL_CODE) {
            _settingCtrlState = false;
        } else if (event.keyCode === ALT_CODE) {
            _settingAltState = false;
        }
        // respect the shift, ctrl, alt states and set the new key for the action
        var interpreter = control.getInputInterpreter(control.KEYBOARD_NAME);
        interpreter.setAndStoreBinding(new control.KeyBinding(
                _actionUnderSetting,
                utils.getKeyOfCode(event.keyCode),
                _settingShiftState,
                _settingCtrlState,
                _settingAltState));
        _stopKeySetting();
    }
    /**
     * Starts setting a new key for an action. Highlights the passed element and
     * sets up the key event handlers to update the action represented by this
     * element.
     * @param {Element} tdElement
     */
    function startKeySetting(tdElement) {
        var actionName = tdElement.getAttribute("id");
        // if we are already in the process of setting this action, just cancel it,
        // so setting an action can be cancelled by clicking on the same cell again
        if (_actionUnderSetting === actionName) {
            _stopKeySetting();
            // otherwise cancel if we are in a process of setting another action, and 
            // then start setting this one
        } else {
            _stopKeySetting();
            _actionUnderSetting = actionName;
            tdElement.innerHTML = CONTROL_STRING_DURING_SETTING;
            tdElement.className = HIGHLIGHTED_CLASS_NAME;
            _settingShiftState = false;
            _settingCtrlState = false;
            _settingAltState = false;
            document.onkeydown = function (event) {
                handleKeyDownWhileSetting(event);
            };
            document.onkeyup = function (event) {
                handleKeyUpWhileSetting(event);
            };
        }
    }
    /**
     * Stops the setting of the current key (if any) and closes the screen.
     */
    function _closeScreen() {
        _stopKeySetting();
        game.closeOrNavigateTo(armadaScreens.SETTINGS_SCREEN_NAME);
    }
    // ##############################################################################
    /**
     * @class Represents the controls screen, where the user can set up the game
     * controls.
     * @extends HTMLScreen
     */
    function ControlsScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.CONTROLS_SCREEN_NAME,
                armadaScreens.CONTROLS_SCREEN_SOURCE,
                {
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                {
                    "escape": _closeScreen
                });
        /**
         * @type SimpleComponent
         */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /**
         * @type SimpleComponent
         */
        this._titleHeading = this.registerSimpleComponent(TITLE_HEADING_ID);
        /**
         * @type SimpleComponent
         */
        this._defaultsButton = this.registerSimpleComponent(DEFAULTS_BUTTON_ID);
    }
    ControlsScreen.prototype = new screens.HTMLScreen();
    ControlsScreen.prototype.constructor = ControlsScreen;
    /**
     * @override
     */
    ControlsScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            _closeScreen();
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            _stopKeySetting();
            control.restoreDefaults();
            this._generateTables();
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    ControlsScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._backButton.setContent(strings.get(strings.CONTROLS.BACK));
        this._titleHeading.setContent(strings.get(strings.CONTROLS.TITLE));
        this._defaultsButton.setContent(strings.get(strings.SETTINGS.DEFAULTS));
        this._generateTables();
    };
    /**
     * Adds the table showing available actions and their assigned keys as well as
     * sets up a click handler for the cells showing the keys to initiate a change
     * of that key binding.
     */
    ControlsScreen.prototype._generateTables = function () {
        control.executeWhenReady(function () {
            var i, j, k, n,
                    tablesContainer = this.getElement(TABLES_CONTAINER_ID),
                    gameControllers = control.getControllers(),
                    h2Element, tableElement, theadElement, thElement, tbodyElement, actions, trElement, td1Element, td2Element,
                    actionStringDefinitionObject = {},
                    keySetterFunction = function () {
                        startKeySetting(this);
                    };
            tablesContainer.innerHTML = "";
            for (i = 0; i < gameControllers.length; i++) {
                h2Element = document.createElement("h2");
                h2Element.innerHTML = utils.formatString(
                        strings.get(strings.CONTROLS.CONTROLLER_TYPE_HEADING),
                        {controllerType: strings.get(strings.CONTOLLER.PREFIX, gameControllers[i].getType())});
                tablesContainer.appendChild(h2Element);
                tableElement = document.createElement("table");
                tableElement.className = TABLE_CLASS_NAME;
                theadElement = document.createElement("thead");
                for (j = 0, n = control.getInputInterpreters().length; j < n; j++) {
                    thElement = document.createElement("th");
                    thElement.innerHTML = strings.get(strings.INPUT.DEVICE_NAME_PREFIX, control.getInputInterpreters()[j].getDeviceName());
                    theadElement.appendChild(thElement);
                }
                theadElement.innerHTML += "<th>" + strings.get(strings.CONTROLS.ACTION) + "</th>";
                tbodyElement = document.createElement("tbody");
                actions = gameControllers[i].getActions();
                for (j = 0; j < actions.length; j++) {
                    actionStringDefinitionObject[actions[j].getName()] = strings.ACTION_DESCRIPTIONS.PREFIX.name + actions[j].getName();
                }
                for (j = 0; j < actions.length; j++) {
                    trElement = document.createElement("tr");
                    for (k = 0, n = control.getInputInterpreters().length; k < n; k++) {
                        td1Element = document.createElement("td");
                        if (control.getInputInterpreters()[k].getDeviceName() === control.KEYBOARD_NAME) {
                            td1Element.setAttribute("id", actions[j].getName());
                            td1Element.className = CLICKABLE_CLASS_NAME;
                            td1Element.onclick = keySetterFunction;
                        }
                        td1Element.innerHTML = control.getInputInterpreters()[k].getControlStringForAction(actions[j].getName());
                        trElement.appendChild(td1Element);
                    }
                    td2Element = document.createElement("td");
                    td2Element.innerHTML = strings.get(strings.ACTION_DESCRIPTIONS.PREFIX, actions[j].getName());
                    trElement.appendChild(td2Element);
                    tbodyElement.appendChild(trElement);
                }
                tableElement.appendChild(theadElement);
                tableElement.appendChild(tbodyElement);
                tablesContainer.appendChild(tableElement);
            }
        }.bind(this));
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        controlsScreen: new ControlsScreen()
    };
});