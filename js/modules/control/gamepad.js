/**
 * Copyright 2014-2018 Krisztián Nagy
 * @file Provides an input interpreter subclass (based on the base class provided by the generic control module) to
 * catch and process input from a joystick or gamepad.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, localStorage, window, navigator */

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
], function (utils, application,  strings, control) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // constants
            GAMEPAD_BUTTON_INDEX_SUFFIX = "_gamepad_button",
            GAMEPAD_AXIS_INDEX_SUFFIX = "_gamepad_axisIndex",
            GAMEPAD_AXIS_POSITIVE_SUFFIX = "_gamepad_axisPositive",
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
            _modulePrefix = "";
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
     */
    function GamepadBinding(dataJSON) {
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
        control.ControlBinding.call(this, dataJSON);
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
     * @override
     * Saves the properties of this binding to HTML5 local storage.
     */
    GamepadBinding.prototype.saveToLocalStorage = function () {
        localStorage[_modulePrefix + this._actionName + GAMEPAD_BUTTON_INDEX_SUFFIX] = this._button;
        localStorage[_modulePrefix + this._actionName + GAMEPAD_AXIS_INDEX_SUFFIX] = this._axisIndex;
        localStorage[_modulePrefix + this._actionName + GAMEPAD_AXIS_POSITIVE_SUFFIX] = this._axisPositive;
    };
    /**
     * @override
     * Loads the properties of the binding if they are stored in the HTML5 local
     * storage object.
     */
    GamepadBinding.prototype.loadFromLocalStorage = function () {
        if (localStorage[_modulePrefix + this._actionName + GAMEPAD_BUTTON_INDEX_SUFFIX] !== undefined) {
            this._button = parseInt(localStorage[_modulePrefix + this._actionName + GAMEPAD_BUTTON_INDEX_SUFFIX], 10);
            this._axisIndex = parseInt(localStorage[_modulePrefix + this._actionName + GAMEPAD_BUTTON_INDEX_SUFFIX], 10);
            this._axisPositive = (localStorage[_modulePrefix + this._actionName + GAMEPAD_AXIS_POSITIVE_SUFFIX] === "true");
        }
    };
    /**
     * @override
     * Removes the properties of this binding from the HTML5 local storage.
     */
    GamepadBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem(_modulePrefix + this._actionName + GAMEPAD_BUTTON_INDEX_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + GAMEPAD_AXIS_INDEX_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + GAMEPAD_AXIS_POSITIVE_SUFFIX);
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
            return (gamepad.buttons[this._button] === 1.0 ||
                    ((typeof (gamepad.buttons[this._button]) === "object") && gamepad.buttons[this._button].pressed)) ? 1 : 0;
        }
        if (this._axisIndex !== this.AXIS_NONE) {
            return Math.max((gamepad.axes[this._axisIndex] * (this._axisPositive ? 1 : -1)), 0);
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
    };
    /**
     * An event handler for the event that fires when a new gamepad is connected. Stores the received Gamepad object for use
     * @param {GamepadEvent} event
     */
    GamepadInputInterpreter.prototype.handleGamepadConnected = function (event) {
        if (!this._gamepad) {
            this._gamepad = event.gamepad;
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
        baseIntensity = this._bindings[actionName].getTriggeredIntensity(this._gamepad);
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
        var gamepads;
        if (!this.isListening()) {
            return [];
        }
        // Firefox continuously updates the Gamepad object obtained from the gamepadconnected event, but it has to be manually
        // refreshed for Chrome to get an up-to-date state, so we do it right before the query
        gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
        if (gamepads && (gamepads.length > 0)) {
            this._gamepad = gamepads[0];
        } else {
            this._gamepad = null;
        }
        if (this._gamepad) {
            return control.InputInterpreter.prototype.getTriggeredActions.call(this, actionFilterFunction);
        }
        return [];
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        setModulePrefix: setModulePrefix,
        GamepadBinding: GamepadBinding,
        GamepadInputInterpreter: GamepadInputInterpreter
    };
});
