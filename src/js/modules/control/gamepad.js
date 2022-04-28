/**
 * Copyright 2014-2018, 2020-2022 Krisztián Nagy
 * @file Provides an input interpreter subclass (based on the base class provided by the generic control module) to
 * catch and process input from a joystick or gamepad using the Gamepad API.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for formatting control strings
 * @param application Used for logging and error displaying functionality
 * @param strings For translation support of control strings
 * @param control We build on the generic functionality and classes of this module
 */
define([
    "utils/utils",
    "modules/application",
    "modules/strings",
    "modules/control/control"
], function (utils, application, strings, control) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // constants
            DELIMITER = "_",
            GAMEPAD_BUTTON_INDEX_SUFFIX = "_gamepad_button",
            GAMEPAD_AXIS_INDEX_SUFFIX = "_gamepad_axisIndex",
            GAMEPAD_AXIS_POSITIVE_SUFFIX = "_gamepad_axisPositive",
            PREFERRED_GAMEPAD_SUFFIX = "preferredGamepad",
            PREFERRED_PROFILES_SUFFIX = "preferredProfiles",
            VIBRATION_ENABLED_SUFFIX = "vibrationEnabled",
            PREFERRED_GAMEPAD_NULL_VALUE = "null",
            EMPTY_LIST = [],
            GAMEPAD_UNSET = -2,
            GAMEPAD_DISABLED = -1,
            // ----------------------------------------------------------------------
            // string definitions for translation of control strings
            JOYSTICK_BUTTON = {
                name: "joystick" + strings.CATEGORY_SEPARATOR + "button",
                defaultValue: "button {index}"
            },
            JOYSTICK_AXIS = {
                name: "joystick" + strings.CATEGORY_SEPARATOR + "axis",
                defaultValue: "axis {index} {direction}"
            },
            JOYSTICK_DIRECTION_POSITIVE = {
                name: "joystick" + strings.CATEGORY_SEPARATOR + "positiveDirection",
                defaultValue: "positive"
            },
            JOYSTICK_DIRECTION_NEGATIVE = {
                name: "joystick" + strings.CATEGORY_SEPARATOR + "negativeDirection",
                defaultValue: "negative"
            },
            // -------------------------------------------------------------------------
            // private variables
            /**
             * When saving to or loading from local storage, the names of any settings of this module will be prefixed by this string.
             * @type String
             */
            _modulePrefix = "",
            /**
             * Whether the Gamepad API is supported by the browser
             * @type Boolean
             */
            _gamepadsSupported = !!navigator.getGamepads,
            // -------------------------------------------------------------------------
            /**
             * Public function to query the list of Gamepad objects detected by the browser.
             * Chrome (97) returns the nonstandard GamepadList object, while Firefox (96)
             * returns an array of Gamepad objects. GamepadList has a [] operator and length
             * property similar to arrays, but other array functions (indexOf, map etc) don't
             * work with it. It is planned to be switched to an array in later versions.
             * @type Function
             * @returns {Gamepad[]|GamepadList}
             */
            getDevices = _gamepadsSupported ?
            function () {
                return navigator.getGamepads();
            } :
            function () {
                return EMPTY_LIST;
            };
    // -------------------------------------------------------------------------
    // functions
    /**
     * Sets a prefix string to be used before the setting names when saving to or loading from local storage.
     * @param {String} value
     */
    function setModulePrefix(value) {
        _modulePrefix = value;
    }
    // #########################################################################
    /**
     * @class Represents the assignment of a gamepad/joystick action (moving an 
     * axis or pressing a button) to an in-game action. (such as fire)
     * @extends ControlBinding
     * @param {Object} [dataJSON] If given, the properties will be initialized from
     * the data stored in this JSON object.
     * @param {String} [profileName] The name of the input profile this binding
     * belongs to
     */
    function GamepadBinding(dataJSON, profileName) {
        /**
         * Which mouse button should be pressed to trigger this binding.
         * @type Number
         */
        this._button = this.BUTTON_NONE;
        /**
         * Which axis should be moved to trigger this binding.
         * @type Number
         */
        this._axisIndex = this.AXIS_NONE;
        /**
         * Whether the correspoding axis is needed to be moved in the positive direction to trigger this binding.
         * @type Boolean
         */
        this._axisPositive = false;
        control.ControlBinding.call(this, dataJSON, profileName);
    }
    GamepadBinding.prototype = new control.ControlBinding();
    GamepadBinding.prototype.constructor = GamepadBinding;
    /**
     * Button index value for no button set
     * @constant
     * @type Number
     */
    GamepadBinding.prototype.BUTTON_NONE = -1;
    /**
     * Axis index value for no axis set
     * @constant
     * @type Number
     */
    GamepadBinding.prototype.AXIS_NONE = -1;
    /**
     * @override
     * Loads the properties of the binding as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    GamepadBinding.prototype.loadFromJSON = function (dataJSON) {
        control.ControlBinding.prototype.loadFromJSON.call(this, dataJSON);
        if ((typeof dataJSON.button) === "number") {
            this._button = dataJSON.button;
        }
        if ((typeof dataJSON.axis) === "string") {
            this._axisIndex = Math.abs(parseInt(dataJSON.axis, 10));
            this._axisPositive = (dataJSON.axis[0] !== "-");
        }
    };
    /**
     * Get the prefix to be used when storing the data of this binding in local storage
     * @returns {String}
     */
    GamepadBinding.prototype._getLocalStoragePrefix = function () {
        return _modulePrefix + this._profileName + DELIMITER + this._actionName;
    };
    /**
     * @override
     * Saves the properties of this binding to HTML5 local storage.
     */
    GamepadBinding.prototype.saveToLocalStorage = function () {
        var prefix = this._getLocalStoragePrefix();
        localStorage[prefix + GAMEPAD_BUTTON_INDEX_SUFFIX] = this._button;
        localStorage[prefix + GAMEPAD_AXIS_INDEX_SUFFIX] = this._axisIndex;
        localStorage[prefix + GAMEPAD_AXIS_POSITIVE_SUFFIX] = this._axisPositive;
    };
    /**
     * @override
     * Loads the properties of the binding if they are stored in the HTML5 local
     * storage object.
     */
    GamepadBinding.prototype.loadFromLocalStorage = function () {
        var prefix = this._getLocalStoragePrefix();
        if (localStorage[prefix + GAMEPAD_BUTTON_INDEX_SUFFIX] !== undefined) {
            this._button = parseInt(localStorage[prefix + GAMEPAD_BUTTON_INDEX_SUFFIX], 10);
            this._axisIndex = parseInt(localStorage[prefix + GAMEPAD_BUTTON_INDEX_SUFFIX], 10);
            this._axisPositive = (localStorage[prefix + GAMEPAD_AXIS_POSITIVE_SUFFIX] === "true");
        }
    };
    /**
     * @override
     * Removes the properties of this binding from the HTML5 local storage.
     */
    GamepadBinding.prototype.removeFromLocalStorage = function () {
        var prefix = this._getLocalStoragePrefix();
        localStorage.removeItem(prefix + GAMEPAD_BUTTON_INDEX_SUFFIX);
        localStorage.removeItem(prefix + GAMEPAD_AXIS_INDEX_SUFFIX);
        localStorage.removeItem(prefix + GAMEPAD_AXIS_POSITIVE_SUFFIX);
    };
    /**
     * Returns how much is the gamepad action  triggered according to the current gamepad 
     * state passed as parameter. Gamepad actions can have different trigger intensities
     * (the gamepad axes are offset to a different degree), therefore the returned
     * value is an integer.
     * @param {Object} gamepad The gamepad object containing the current gamepad
     * state.
     * @returns {Number} Whether the action was triggerend and with what intensity.
     * Zero means the action was not triggered, a positive value represents the 
     * intensity.
     */
    GamepadBinding.prototype.getTriggeredIntensity = function (gamepad) {
        if (!gamepad) {
            return 0;
        }
        // first if this is a button assignment, check the state of the appropriate
        // gamepad button
        if (this._button !== this.BUTTON_NONE) {
            if (gamepad.buttons[this._button]) {
                return gamepad.buttons[this._button].value;
            }
            return 0;
        }
        if (this._axisIndex !== this.AXIS_NONE) {
            if (gamepad.axes.length > this._axisIndex) {
                return Math.max((gamepad.axes[this._axisIndex] * (this._axisPositive ? 1 : -1)), 0);
            }
            return 0;
        }
        return 0;
    };
    /**
     * @override
     * Returns a string representation describing the action the user needs
     * to perform to trigger this binding.
     * @returns {String}
     */
    GamepadBinding.prototype.getControlString = function () {
        if (this._button !== this.BUTTON_NONE) {
            return utils.formatString(strings.get(JOYSTICK_BUTTON), {index: (this._button + 1)});
        }
        if (this._axisIndex !== this.AXIS_NONE) {
            return utils.formatString(strings.get(JOYSTICK_AXIS), {
                index: (this._axisIndex + 1),
                direction: (this._axisPositive ?
                        strings.get(JOYSTICK_DIRECTION_POSITIVE) :
                        strings.get(JOYSTICK_DIRECTION_NEGATIVE))});
        }
        return "";
    };
    /**
     * @override
     * Returns whether this binding has the same control (button/axis) configuration as the passed one (and so it conflicts with it)
     * @param {GamepadBinding} otherGamepadBinding
     */
    GamepadBinding.prototype.bindsTheSameControls = function (otherGamepadBinding) {
        return (this._button === otherGamepadBinding._button) &&
                (this._axisIndex === otherGamepadBinding._axisIndex);
    };
    // #########################################################################
    /**
     * @class This class stores a set of actions and associated sensitivity modifiers that can be used
     * by GamepadInputInterpreters to apply different sensitivities when triggering different actions.
     * @param {Object} dataJSON
     */
    function GamepadSensitivityActionGroup(dataJSON) {
        /**
         * This factor will be applied for graded (dynamic) intensities.
         * @type Number
         */
        this._sensitivityFactor = dataJSON.sensitivityFactor || 0;
        /**
         * If set to true, when encountering an action stored in this group, the intensity will be set to
         * static (undefined), losing any graded (dynamic) intensity even if the action was triggered by
         * a (partially moved) axis.
         * @type Boolean
         */
        this._staticSensitivity = (dataJSON.staticSensitivity === true);
        /**
         * If set to true, the intensity of triggered actions in this group will be based on the squared value
         * of the intensity reported by the gamepad.
         */
        this._quadraticIntensity = (dataJSON.quadraticSensitivity === true);
        /**
         * This array stores the names of action the sensitivity modifiers should apply to.
         * @type Array
         */
        this._actionNames = dataJSON.actionNames;
        if (this._sensitivityFactor && this._staticSensitivity) {
            application.showError("Sensitivity action group defined with both factored and static sensitivity!", application.ErrorSeverity.MINOR);
        }
    }
    /**
     * Checks whether the action with the passed name is in this group, and if so, returns the modified intensity for it.
     * @param {Number} baseIntensity The intensity of this triggered action before any modifiers.
     * @param {String} actionName The name of the action to check.
     * @returns {(Number|undefined)} Will be a positive number or zero if the action is in the group and the modified 
     * intensity is graded (dynamic) or undefined if it is static, and will be -1 if the action is not in the group.
     */
    GamepadSensitivityActionGroup.prototype.getIntensityForAction = function (baseIntensity, actionName) {
        if (this._actionNames.indexOf(actionName) >= 0) {
            return this._staticSensitivity ? undefined : (baseIntensity * (this._quadraticIntensity ? baseIntensity : 1) * this._sensitivityFactor);
        }
        return -1;
    };
    /**
     * @class Monitors the gamepad/joystick inputs and stores the current state 
     * of the gamepad/joystick. 
     * Can load and store gamepad bindings and based on the current state and the 
     * bindings, determine the list of currently triggered actions that controllers 
     * can/should execute.
     * @extends InputInterpreter
     * @param {Object} [dataJSON] Upon initialization, it can load the bindings from
     * this JSON object if specified.
     */
    function GamepadInputInterpreter(dataJSON) {
        /**
         * A reference to the gamepad(/joystick) this interpreter is listening to.
         * @type Gamepad
         */
        this._gamepad = null;
        /**
         * The index of the gamepad that was specifically selected by the user to be used
         * @type Number
         */
        this._gamepadSetIndex = localStorage[_modulePrefix + PREFERRED_GAMEPAD_SUFFIX] === PREFERRED_GAMEPAD_NULL_VALUE ? GAMEPAD_DISABLED : GAMEPAD_UNSET;
        /**
         * Whether the next time we are querying the list of connected gamepads, we should
         * try to find and select the one the user chose last time
         * @type Boolean
         */
        this._detectingPreference = !!localStorage[_modulePrefix + PREFERRED_GAMEPAD_SUFFIX];
        /**
         * The id of the gamepad the user selected to use, loaded from local storage
         * @type String
         */
        this._preferredGamepadId = localStorage[_modulePrefix + PREFERRED_GAMEPAD_SUFFIX];
        /**
         * Whether vibration effects are enabled. If this is true and vibration support is detected,
         * calling vibrate() will play the passed vibration effect.
         * @type Boolean
         */
        this._vibrationEnabled = false;
        /**
         * The parameters for the available vibration effects to play. The keys are names of the
         * vibration effects (can be passed to the vibrate() method), and the values are objects
         * holding the parameters.
         * Supported parameters (as of Chrome 98):
         * - duration (number, ms)
         * - strongMagnitude (number, 0-1)
         * - weakMagnitude (number, 0-1)
         * @type Object
         */
        this._vibrationEffects = null;
        /**
         * 
         * @type GamepadSensitivityActionGroup[]
         */
        this._sensitivityActionGroups = null;
        control.InputInterpreter.call(this, GamepadBinding, dataJSON);
    }
    GamepadInputInterpreter.prototype = new control.InputInterpreter();
    GamepadInputInterpreter.prototype.constructor = GamepadInputInterpreter;
    /**
     * @override
     * Returns of the name of the device this interpreter monitors. Every input
     * interpreter should implement this function.
     * @returns {String}
     */
    GamepadInputInterpreter.prototype.getDeviceName = function () {
        return "joystick";
    };
    /**
     * @override
     */
    GamepadInputInterpreter.prototype.resetState = function () {
        this._gamepad = null;
    };
    /**
     * @override
     * Loads the properties of the interpreter such as the (default) gamepad bindings
     * from the passed JSON object.
     * @param {Object} dataJSON
     */
    GamepadInputInterpreter.prototype.loadFromJSON = function (dataJSON) {
        var i;
        control.InputInterpreter.prototype.loadFromJSON.call(this, dataJSON);
        this._sensitivityActionGroups = [];
        if (dataJSON.sensitivityProfile && dataJSON.sensitivityProfile.actionGroups) {
            for (i = 0; i < dataJSON.sensitivityProfile.actionGroups.length; i++) {
                this._sensitivityActionGroups.push(new GamepadSensitivityActionGroup(dataJSON.sensitivityProfile.actionGroups[i]));
            }
        }
        this._vibrationEnabled = !!dataJSON.vibrationEnabled || false;
        this._vibrationEffects = dataJSON.vibrationEffects || {};
    };
    /**
     * @override
     */
    GamepadInputInterpreter.prototype.loadFromLocalStorage = function () {
        control.InputInterpreter.prototype.loadFromLocalStorage.call(this);
        if (localStorage[_modulePrefix + VIBRATION_ENABLED_SUFFIX] !== undefined) {
            this._vibrationEnabled = localStorage[_modulePrefix + VIBRATION_ENABLED_SUFFIX] === true.toString();
        }
    };
    /**
     * An event handler for the event that fires when a new gamepad is connected. Stores the received Gamepad object for use
     * @param {GamepadEvent} event
     */
    GamepadInputInterpreter.prototype.handleGamepadConnected = function (event) {
        if (!this._gamepad && (this._gamepadSetIndex === GAMEPAD_UNSET)) {
            this._gamepad = event.gamepad;
            this.setProfile(this._getProfile(event.gamepad), false);
        }
    };
    /**
     * @override
     * Sets the event handlers to grab a gamepad object for this interpreter
     * once it has become available for the web application.
     * The triggered actions can be queried from this interpreter after this 
     * method has been called.
     */
    GamepadInputInterpreter.prototype.startListening = function () {
        control.InputInterpreter.prototype.startListening.call(this);
        window.addEventListener("gamepadconnected", function (event) {
            this.handleGamepadConnected(event);
        }.bind(this));
    };
    /**
     * @override
     * The input state will not be updated after this call.
     * The triggered actions cannot be queried from this interpreter after this 
     * function has been called.
     */
    GamepadInputInterpreter.prototype.stopListening = function () {
        control.InputInterpreter.prototype.stopListening.call(this);
        window.ongamepadconnected = null;
    };
    /**
     * @override
     * Checks if the action with the supplied name is triggered based on the current input state.
     * @param {String} actionName
     * @returns {(ActionTrigger|null)} Null, if the action is not triggered
     */
    GamepadInputInterpreter.prototype.checkAction = function (actionName) {
        var baseIntensity, i, finalIntensity;
        baseIntensity = this._currentProfile[actionName].getTriggeredIntensity(this._gamepad);
        if (baseIntensity > 0) {
            for (i = 0; i < this._sensitivityActionGroups.length; i++) {
                finalIntensity = this._sensitivityActionGroups[i].getIntensityForAction(baseIntensity, actionName);
                if ((finalIntensity === undefined) || (finalIntensity > 0)) {
                    return {
                        name: actionName,
                        intensity: finalIntensity,
                        source: this
                    };
                }
            }
            return {
                name: actionName,
                intensity: baseIntensity,
                source: this
            };
        }
        return null;
    };
    /**
     * Query the list of gamepads returned by the Gamepad API and select the one to be used 
     * @returns {Gamepad} The chosen Gamepad object is also returned
     */
    GamepadInputInterpreter.prototype.updateGamepad = function () {
        var gamepads, i, index;
        gamepads = getDevices();
        // if the player selected a specific controller to use, we choose it unless it is disconnected
        if (this._gamepadSetIndex !== GAMEPAD_UNSET) {
            if (gamepads[this._gamepadSetIndex]) {
                this._gamepad = gamepads[this._gamepadSetIndex];
            } else {
                this._gamepadSetIndex = GAMEPAD_UNSET;
            }
        }
        // if the player hasn't selected a specific controller (or it was disconnected), we choose one automatically
        if (this._gamepadSetIndex === GAMEPAD_UNSET) {
            index = (this._gamepad !== null) ? this._gamepad.index : -1;
            this._gamepad = null;
            // if we haven't detected any controllers so far, try to choose one based on the previous user preference
            if (this._detectingPreference) {
                for (i = 0; i < gamepads.length; i++) {
                    if (gamepads[i]) {
                        this._detectingPreference = false;
                        if (gamepads[i].id === this._preferredGamepadId) {
                            this._setGamepad(gamepads[i]);
                            break;
                        } else if (this._gamepad === null) {
                            this._gamepad = gamepads[i];
                            this.setProfile(this._getProfile(gamepads[i]), false);
                        }
                    }
                }
            } else {
                // if we don't have a specific controller selected and have already detected controllers in the past,
                // go with the first connected one
                for (i = 0; i < gamepads.length; i++) {
                    if (gamepads[i]) {
                        this._gamepad = gamepads[i];
                        if (gamepads[i].index !== index) {
                            this.setProfile(this._getProfile(gamepads[i]), false);
                        }
                        break;
                    }
                }
            }
        }
        return this._gamepad;
    };
    /**
     * @override
     * Returns the list of currently triggered actions and their intensity based on 
     * the internally stored gamepad state and gamepad bindings.
     * @param {Function} [actionFilterFunction] If given, every triggered action will be tested against this function (by passing its name
     * as a parameter), and only added to the resulting list if the function returns true.
     * @returns {Object[][]} The lists of action names and intensities, grouped by the triggering controls (if two actions were triggered
     * by the same controls, they will be in the same array, and the result itself is an array of such arrays. The name (String) property 
     * stores the action's name and the intensity (Number) property the intensity.
     */
    GamepadInputInterpreter.prototype.getTriggeredActions = function (actionFilterFunction) {
        if (!this.isListening() || (this._gamepadSetIndex === GAMEPAD_DISABLED)) {
            return EMPTY_LIST;
        }
        // Firefox continuously updates the Gamepad object obtained from the gamepadconnected event, but it has to be manually
        // refreshed for Chrome to get an up-to-date state, so we do it right before the query
        this.updateGamepad();
        if (this._gamepad !== null) {
            return control.InputInterpreter.prototype.getTriggeredActions.call(this, actionFilterFunction);
        }
        return EMPTY_LIST;
    };
    /**
     * Returns the id of the profile that should be used with the passed Gamepad, based on
     * user preference and profile keyword lists
     * @param {Gamepad} gamepad
     * @returns {String}
     */
    GamepadInputInterpreter.prototype._getProfile = function (gamepad) {
        var preferences, i, j, keywords, profileNames, id;
        preferences = this._getProfilePreferences();
        if (preferences[gamepad.id]) {
            return preferences[gamepad.id];
        }
        profileNames = Object.keys(this._profileKeywords);
        id = gamepad.id.toLowerCase();
        for (i = 0; i < profileNames.length; i++) {
            keywords = this._profileKeywords[profileNames[i]];
            if (keywords) {
                for (j = 0; j < keywords.length; j++) {
                    if (id.indexOf(keywords[j]) >= 0) {
                        return profileNames[i];
                    }
                }
            }
        }
        return this._defaultProfileName;
    };
    /**
     * @private
     * This is an internal method to execute the things needed to be done when a specific gamepad is selected by
     * the user or loaded from preference. From outside the class, setGamepad() is available which also handles
     * the case when no gamepad (null) is to be selected and checks if the passed gamepad is valid and connected
     * @param {Gamepad} gamepad
     */
    GamepadInputInterpreter.prototype._setGamepad = function (gamepad) {
        this._gamepad = gamepad;
        this._gamepadSetIndex = gamepad.index;
        this._preferredGamepadId = gamepad.id;
        localStorage[_modulePrefix + PREFERRED_GAMEPAD_SUFFIX] = gamepad.id;
        this.setProfile(this._getProfile(gamepad), false);
    };
    /**
     * Sets a specific Gamepad to be used and also saves this preference into local storage so that next time the same
     * controller can be automatically selected from the list of controllers even if it is not the first one
     * @param {Gamepad|null} gamepad If null, the preference is set to disable all gamepads
     * @returns {Boolean} Whether the passed gamepad has been successfully selected
     */
    GamepadInputInterpreter.prototype.setGamepad = function (gamepad) {
        var i, gamepads = getDevices();
        if (!gamepad) {
            this._gamepadSetIndex = GAMEPAD_DISABLED;
            this._preferredGamepadId = PREFERRED_GAMEPAD_NULL_VALUE;
            localStorage[_modulePrefix + PREFERRED_GAMEPAD_SUFFIX] = PREFERRED_GAMEPAD_NULL_VALUE;
            return true;
        }
        for (i = 0; i < gamepads.length; i++) {
            if (gamepads[i] === gamepad) {
                this._setGamepad(gamepad);
                return true;
            }
        }
        return false;
    };
    /**
     * @override
     */
    GamepadInputInterpreter.prototype.removeFromLocalStorage = function () {
        control.InputInterpreter.prototype.removeFromLocalStorage.call(this);
        localStorage.removeItem(_modulePrefix + PREFERRED_GAMEPAD_SUFFIX);
        localStorage.removeItem(_modulePrefix + PREFERRED_PROFILES_SUFFIX);
        localStorage.removeItem(_modulePrefix + VIBRATION_ENABLED_SUFFIX);
        this._gamepadSetIndex = GAMEPAD_UNSET;
        this._preferredGamepadId = "";
    };
    /**
     * Returns an object containing the profiles selected by the user for all the
     * gamepads, with the gamepad ids as the keys and the profile names as values
     * @returns {Object}
     */
    GamepadInputInterpreter.prototype._getProfilePreferences = function () {
        var data, string = localStorage[_modulePrefix + PREFERRED_PROFILES_SUFFIX];
        if (!string) {
            return {};
        }
        try {
            data = JSON.parse(string);
        } catch (e) {
            return {};
        }
        if (data && (typeof data === "object")) {
            return data;
        }
        return {};
    };
    /**
     * @override
     * @param {String} name
     * @param {Boolean} [saveToLocalStorage=true]
     */
    GamepadInputInterpreter.prototype.setProfile = function (name, saveToLocalStorage) {
        var preferences;
        control.InputInterpreter.prototype.setProfile.call(this, name);
        if ((this._gamepad !== null) && (saveToLocalStorage !== false)) {
            preferences = this._getProfilePreferences();
            preferences[this._gamepad.id] = this._currentProfileName;
            localStorage[_modulePrefix + PREFERRED_PROFILES_SUFFIX] = JSON.stringify(preferences);
        }
    };
    /**
     * Returns whether controller vibration effects are supported for the currently set controller.
     * @returns {Boolean}
     */
    GamepadInputInterpreter.prototype.isVibrationSupported = function () {
        return (this._gamepad !== null) && this._gamepad.vibrationActuator && (this._gamepad.vibrationActuator.type === "dual-rumble") && (typeof this._gamepad.vibrationActuator.playEffect === "function");
    };
    /**
     * Returns whether vibration effects are currently enabled.
     * @returns {Boolean}
     */
    GamepadInputInterpreter.prototype.isVibrationEnabled = function () {
        return this._vibrationEnabled;
    };
    /**
     * Enables/disables vibration effects. If they are enabled and also supported (by the browser and the current controller), calling vibrate() will play the
     * passed vibration effect.
     * @param {Boolean} value
     * @param {Boolean} [saveToLocalStorage=true]
     */
    GamepadInputInterpreter.prototype.setVibrationEnabled = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        this._vibrationEnabled = value;
        if (saveToLocalStorage) {
            localStorage[_modulePrefix + VIBRATION_ENABLED_SUFFIX] = value.toString();
        }
    };
    /**
     * Plays the vibration effect with the passed name on the current controller, if it exists and vibration effects are supported and turned on.
     * @param {String} effectName
     */
    GamepadInputInterpreter.prototype.vibrate = function (effectName) {
        if (this._vibrationEnabled && this._gamepad && this._gamepad.vibrationActuator && this._vibrationEffects.hasOwnProperty(effectName)) {
            this._gamepad.vibrationActuator.playEffect("dual-rumble", this._vibrationEffects[effectName]);
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        setModulePrefix: setModulePrefix,
        getDevices: getDevices,
        GamepadInputInterpreter: GamepadInputInterpreter
    };
});
