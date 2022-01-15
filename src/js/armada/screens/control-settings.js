/**
 * Copyright 2014-2022, Krisztián Nagy
 * @file This module manages and provides the Control settings screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for formatting strings and for the keycode table
 * @param screens The controls screen is cubclassed from HTMLScreen
 * @param components Used for creating sliders
 * @param game Used for navigation
 * @param gamepad Used for querying connected controller devices
 * @param strings Used for translation support
 * @param armadaScreens Used for common screen constants
 * @param control Used to access and modify control settings of the game
 */
define([
    "utils/utils",
    "modules/screens",
    "modules/components",
    "modules/game",
    "modules/control/gamepad",
    "armada/strings",
    "armada/screens/shared",
    "armada/control"
], function (utils, screens, components, game, gamepad, strings, armadaScreens, control) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            TITLE_HEADING_ID = "title",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            SETTINGS_TITLE_ID = "settingsTitle",
            SETTINGS_CONTAINER_ID = "settingsContainer",
            MOUSE_SETTINGS_CONTAINER_ID = "mouseSettingsContainer",
            NO_CONTROLLER_ID = "noController",
            CONTROLLER_SETTINGS_CONTAINER_ID = "controllerSettingsContainer",
            TABLES_CONTAINER_ID = "tablesContainer",
            MOUSE_TURN_SENSITIVITY_SLIDER_ID = "mouseTurnSensitivitySlider",
            CONTROLLER_SELECTOR_ID = "controllerSelector",
            CLICKABLE_CLASS_NAME = "clickable",
            HIGHLIGHTED_CLASS_NAME = "highlightedItem",
            TABLE_TITLE_CLASS_NAME = "controls tableTitle",
            TABLE_ID_PREFIX = "table_",
            TABLE_CLASS_NAME = "controlsTable outerContainer",
            CONTROL_STRING_DURING_SETTING = "?",
            SHIFT_CODE = 16,
            CTRL_CODE = 17,
            ALT_CODE = 18,
            DETECT_CONTROLLERS_INTERVAL = 1000,
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
     * Take a gamepad string id (Gamepad.id) as returned by the Gamepad API and
     * transform it to something more user presentable
     * @param {String} id
     * @returns {String}
     */
    function _getControllerDisplayName(id) {
        var index;
        // Chrome (97) adds the vendor and product codes at the end of gamepad ids
        index = id.indexOf(' (Vendor:');
        if (index < 0) {
            // if the gamepad is mapped to a standard mapping, Chrome (97) adds
            // STANDARD GAMEPAD before the vendor and product codes
            index = id.indexOf(' (STANDARD GAMEPAD');
        }
        if (index >= 0) {
            return id.substring(0, index);
        }
        // Firefox (96) adds the vendor and product codes before the rest of the id
        // delimited with dashes
        if ((id.length > 10) &&
                utils.isHexString(id.substring(0, 4)) && (id[4] === "-") &&
                utils.isHexString(id.substring(5, 9)) && (id[9] === "-")) {
            return id.substring(10);
        }
        return id;
    }
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
        interpreter.setAndStoreBinding({
            action: _actionUnderSetting,
            key: utils.getKeyOfCode(event.keyCode),
            shift: _settingShiftState,
            ctrl: _settingCtrlState,
            alt: _settingAltState
        });
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
                    cssFilename: armadaScreens.CONTROLS_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                undefined,
                {
                    "escape": _closeScreen
                },
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /**
         * The id for the gamepad detection interval
         * @type Number
         */
        this._detectGamepadsInterval = -1;
        /**
         * The list of connected gamepads returned by the Gamepad API in the same
         * order as their options are presented in the controller selector
         * (contains no null values)
         * @type Gamepad[]
         */
        this._gamepadOptions = null;
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
        this._settingsTitle = this.registerSimpleComponent(SETTINGS_TITLE_ID);
        /**
         * @type SimpleComponent
         */
        this._settingsContainer = this.registerSimpleComponent(SETTINGS_CONTAINER_ID);
        /**
         * @type SimpleComponent
         */
        this._controllerSettingsContainer = this.registerSimpleComponent(CONTROLLER_SETTINGS_CONTAINER_ID);
        /**
         * @type SimpleComponent
         */
        this._noController = this.registerSimpleComponent(NO_CONTROLLER_ID);
        /**
         * @type Slider
         */
        this._mouseTurnSensitivitySlider = this.registerExternalComponent(
                new components.Slider(
                        MOUSE_TURN_SENSITIVITY_SLIDER_ID,
                        armadaScreens.SLIDER_SOURCE,
                        {cssFilename: armadaScreens.SLIDER_CSS},
                        {id: strings.CONTROLS.MOUSE_TURN_SENSITIVITY.name},
                        {
                            min: 0,
                            max: 0.5,
                            step: 0.01,
                            "default": 0.25
                        },
                        function (value) {
                            control.getInputInterpreter(control.MOUSE_NAME).setAndStoreDisplacementAreaRelativeSize(1 - value);
                        }),
                MOUSE_SETTINGS_CONTAINER_ID);
        /**
         * @type Selector
         */
        this._controllerSelector = this.registerExternalComponent(
                new components.Selector(
                        CONTROLLER_SELECTOR_ID,
                        armadaScreens.SELECTOR_SOURCE,
                        {cssFilename: armadaScreens.SELECTOR_CSS},
                        {id: strings.CONTROLS.CONTROLLER.name},
                        []),
                CONTROLLER_SETTINGS_CONTAINER_ID);
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
            this._updateValues();
            this._generateTables();
            return false;
        }.bind(this);
        this._settingsTitle.getElement().onclick = function () {
            this._settingsContainer.setVisible(!this._settingsContainer.isVisible());
            armadaScreens.playButtonClickSound(true);
        }.bind(this);
        this._settingsTitle.getElement().onmouseenter = function () {
            armadaScreens.playButtonSelectSound(true);
        }.bind(this);
        this._controllerSelector.onChange = function (stepping) {
            var index = this._controllerSelector.getSelectedIndex();
            if ((stepping === 0) ||
                    !control.getInputInterpreter(control.JOYSTICK_NAME)
                    .setGamepad((index < this._gamepadOptions.length) ? this._gamepadOptions[index] : null)) {
                this._updateControllers();
            }
        }.bind(this);
        this._settingsContainer.hide();
    };
    /**
     * @override
     */
    ControlsScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._defaultsButton.setContent(strings.get(strings.SETTINGS.DEFAULTS));
        this._updateValues();
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
                    tableId,
                    h2Element, tableElement, theadElement, thElement, tbodyElement, actions, trElement, td1Element, td2Element,
                    actionStringDefinitionObject = {},
                    tableToggleFunction = function (id) {
                        var element = this.getElement(id);
                        element.hidden = !element.hidden;
                        armadaScreens.playButtonClickSound(true);
                    },
                    tableSelectFunction = function () {
                        armadaScreens.playButtonSelectSound(true);
                    },
                    keySetterFunction = function () {
                        startKeySetting(this);
                    };
            tablesContainer.innerHTML = "";
            for (i = 0; i < gameControllers.length; i++) {
                tableId = TABLE_ID_PREFIX + gameControllers[i].getType();
                h2Element = document.createElement("h2");
                h2Element.innerHTML = utils.formatString(
                        strings.get(strings.CONTROLS.CONTROLLER_TYPE_HEADING),
                        {controllerType: strings.get(strings.CONTOLLER.PREFIX, gameControllers[i].getType())});
                h2Element.className = TABLE_TITLE_CLASS_NAME;
                h2Element.onclick = tableToggleFunction.bind(this, tableId);
                h2Element.onmouseenter = tableSelectFunction;
                tablesContainer.appendChild(h2Element);
                tableElement = document.createElement("table");
                tableElement.id = this._getElementID(tableId);
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
                tableElement.hidden = true;
                tablesContainer.appendChild(tableElement);
            }
        }.bind(this));
    };
    /**
     * Updates the option list and the current value of the controller selector based on the detected gamepads
     * and the currently set one
     */
    ControlsScreen.prototype._updateControllers = function () {
        var gamepads, gamepadIds, i, index, currentGamepad;
        gamepads = gamepad.getDevices();
        gamepadIds = [];
        this._gamepadOptions = [];
        for (i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                gamepadIds.push(_getControllerDisplayName(gamepads[i].id));
                this._gamepadOptions.push(gamepads[i]);
            }
        }
        if (gamepadIds.length > 0) {
            gamepadIds.push(strings.get(strings.CONTROLS.CONTROLLER_DISABLED));
            this._controllerSelector.setValueList(gamepadIds);
            currentGamepad = control.getInputInterpreter(control.JOYSTICK_NAME).updateGamepad();
            index = this._gamepadOptions.indexOf(currentGamepad);
            this._controllerSelector.selectValueWithIndex(currentGamepad ? ((index >= 0) ? index : 0) : this._gamepadOptions.length);
            this._noController.hide();
            this._controllerSettingsContainer.show();
        } else {
            this._noController.show();
            this._controllerSettingsContainer.hide();
        }
    };
    /**
     * Updates the component states based on the current controls settings
     */
    ControlsScreen.prototype._updateValues = function () {
        this._mouseTurnSensitivitySlider.setNumericValue(1 - control.getInputInterpreter(control.MOUSE_NAME).getDisplacementAreaRelativeSize());
        this._updateControllers();
    };
    /**
     * @override
     * @returns {Boolean}
     */
    ControlsScreen.prototype.show = function () {
        if (screens.HTMLScreen.prototype.show.call(this)) {
            this._updateValues();
            return true;
        }
        return false;
    };
    /**
     * @override
     * @param {Boolean} active
     */
    ControlsScreen.prototype.setActive = function (active) {
        screens.HTMLScreen.prototype.setActive.call(this, active);
        if (active) {
            this._detectGamepadsInterval = setInterval(this._updateControllers.bind(this), DETECT_CONTROLLERS_INTERVAL);
        } else {
            if (this._detectGamepadsInterval >= 0) {
                clearInterval(this._detectGamepadsInterval);
                this._detectGamepadsInterval = -1;
            }
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getControlsScreen: function () {
            return new ControlsScreen();
        }
    };
});