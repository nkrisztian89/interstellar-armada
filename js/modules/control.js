/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, localStorage, document, window, navigator */

/**
 * @param utils Used for the keycode and getting key of property value utility functions
 * @param application Used for logging and error displaying functionality
 * @param asyncResource ControlContext is a subclass of AsyncResource
 * @param strings For translation support of control strings
 */
define([
    "utils/utils",
    "modules/application",
    "modules/async-resource",
    "modules/strings"
], function (utils, application, asyncResource, strings) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // enums
            MouseButtonName = {
                NONE: "none",
                LEFT: "left",
                MIDDLE: "middle",
                RIGHT: "right"
            },
    // ----------------------------------------------------------------------
    // constants
    SHIFT_CODE = 16,
            CTRL_CODE = 17,
            ALT_CODE = 18,
            CONTROL_STRING_COMBINE = " + ",
            KEY_SUFFIX = "_key",
            SHIFT_STATE_SUFFIX = "_shift",
            CTRL_STATE_SUFFIX = "_ctrl",
            ALT_STATE_SUFFIX = "_alt",
            /**
             * The index of the element is the index of the button
             * @type Array
             */
            MOUSE_BUTTON_NAMES = [
                MouseButtonName.NONE,
                MouseButtonName.LEFT,
                MouseButtonName.MIDDLE,
                MouseButtonName.RIGHT
            ],
            DIRECTION_LEFT = "left",
            DIRECTION_RIGHT = "right",
            DIRECTION_UP = "up",
            DIRECTION_DOWN = "down",
            MOUSE_BUTTON_INDEX_SUFFIX = "_button",
            MOUSE_MOVE_X_SUFFIX = "_moveX",
            MOUSE_MOVE_Y_SUFFIX = "_moveY",
            MOUSE_FROM_CENTER_SUFFIX = "_measuredFromCenter",
            MOUSE_SCROLL_X_SUFFIX = "_scrollX",
            MOUSE_SCROLL_Y_SUFFIX = "_scrollY",
            GAMEPAD_BUTTON_INDEX_SUFFIX = "_gamepad_button",
            GAMEPAD_AXIS_INDEX_SUFFIX = "_gamepad_axisIndex",
            GAMEPAD_AXIS_POSITIVE_SUFFIX = "_gamepad_axisPositive",
            // ----------------------------------------------------------------------
            // string definitions for translation of control strings
            KEY_STRING_PREFIX = {name: "key."},
    MOUSE_LEFT_BUTTON = {
        name: "mouse.leftButton",
        defaultValue: "left click"
    },
    MOUSE_RIGHT_BUTTON = {
        name: "mouse.rightButton",
        defaultValue: "right click"
    },
    MOUSE_MIDDLE_BUTTON = {
        name: "mouse.middleButton",
        defaultValue: "middle click"
    },
    MOUSE_FROM_CENTER = {
        name: "mouse.fromCenter",
        defaultValue: "{move} {toDirection} from center"
    },
    MOUSE_NOT_FROM_CENTER = {
        name: "mouse.notFromCenter",
        defaultValue: "{move} {toDirection}"
    },
    MOUSE_MOVE = {
        name: "mouse.move",
        defaultValue: "move"
    },
    MOUSE_DIRECTION_LEFT = {
        name: "mouse.leftDirection",
        defaultValue: "left"
    },
    MOUSE_DIRECTION_RIGHT = {
        name: "mouse.rightDirection",
        defaultValue: "right"
    },
    MOUSE_DIRECTION_UP = {
        name: "mouse.upDirection",
        defaultValue: "up"
    },
    MOUSE_DIRECTION_DOWN = {
        name: "mouse.downDirection",
        defaultValue: "down"
    },
    MOUSE_SCROLL = {
        name: "mouse.scroll",
        defaultValue: "scroll"
    },
    JOYSTICK_BUTTON = {
        name: "joystick.button",
        defaultValue: "button {index}"
    },
    JOYSTICK_AXIS = {
        name: "joystick.axis",
        defaultValue: "axis {index} {direction}"
    },
    JOYSTICK_DIRECTION_POSITIVE = {
        name: "joystick.positiveDirection",
        defaultValue: "positive"
    },
    JOYSTICK_DIRECTION_NEGATIVE = {
        name: "joystick.negativeDirection",
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
     * @class A generic superclass for classes that represent the bindig of certain controls to an action.
     * A subclass should be created for each specific input device that implements setting, loading, saving,
     * comparing control settings for the binding and checking the action trigger state.
     * @param {(Object|String)} dataJSONOrActionName
     */
    function ControlBinding(dataJSONOrActionName) {
        /**
         * Name of the action the stored control is assigned to. {@link Controller}s
         * will process this name and execute the appropriate action.
         * @type String
         */
        this._actionName = ((typeof dataJSONOrActionName) === "string" ?
                dataJSONOrActionName :
                null);
        // if a JSON object was specified, initialize the properties from there
        if ((typeof dataJSONOrActionName) === "object") {
            this.loadFromJSON(dataJSONOrActionName);
        }
    }
    /**
     * Returns the name of the action assigned in this binding. Has to be a name
     * that can be processed by the appropriate {@link Controller}s.
     * @returns {String}
     */
    ControlBinding.prototype.getActionName = function () {
        return this._actionName;
    };
    /**
     * Returns a string describing the control assigned to the action in this binding.
     * @returns {String}
     */
    ControlBinding.prototype.getControlString = function () {
        application.showError("Cannot get control string of generic control binding!");
        return null;
    };
    /**
     * Loads the properties of this binding from a JSON object. Needs to be overridden for each specific binding
     * subclass to load their properties.
     * @param {Object} dataJSON
     */
    ControlBinding.prototype.loadFromJSON = function (dataJSON) {
        this._actionName = dataJSON.action;
    };
    /**
     * Saves the properties of this binding to local storage. Needs to be overridden for each specific binding
     * subclass to save their properties.
     */
    ControlBinding.prototype.saveToLocalStorage = function () {
        application.showError("Cannot save generic control binding to local storage!");
    };
    /**
     * Loads the properties of this binding from local storage. Needs to be overridden for each specific binding
     * subclass to load their properties.
     */
    ControlBinding.prototype.loadFromLocalStorage = function () {
        application.showError("Cannot load generic control binding from local storage!");
    };
    /**
     * Removes the properties of this binding from local storage. Needs to be overridden for each specific binding
     * subclass to remove their properties.
     */
    ControlBinding.prototype.removeFromLocalStorage = function () {
        application.showError("Cannot remove generic control binding from local storage!");
    };
    /**
     * Needs to be ovverridden to check whether this binding binds the same controls as another binding of the same type.
     */
    ControlBinding.prototype.bindsTheSameControls = function () {
        application.showError("Cannot check if generic control binds the same controls as another binding!");
        return true;
    };
    // #########################################################################
    /**
     * @class A generic common superclass for input interpreters which needs to be subclassed for each different input device.
     * This class provides the common general functionality. The subclasses need to add their model of the input device's state,
     * additional operations for saving / loading its settings and a managing the trigger state check for the stored bindings.
     * @param {Function} bindingClass The constructor function of the binding class this interpreter will use (has te be a subclass
     * of ControlBinding)
     * @param {Object} dataJSON If given, any specific interpreter settings can be loaded from this JSON object
     */
    function InputInterpreter(bindingClass, dataJSON) {
        /**
         * Whether the interpreter is currently listening for input (the event  handlers are set) and is updating
         * the internal state it holds about its input device.
         * A listening interpreter will also disable most default actions for the input device it is listening to.
         * @type Boolean
         */
        this._listening = false;
        /**
         * Whether the interpreter is currently processing the input state it maintains to trigger actions based on its
         * stored binding. If the interpreter is not listening, processing is not possible, but the enabled state can
         * be set and is stored independently.
         * @type Boolean
         */
        this._enabled = true;
        /**
         * The constructor function of the binding class this interpreter uses (a subclass of ControlBinding).
         * @type Function
         */
        this._bindingClass = bindingClass;
        /**
         * An associative array storing the active bindings by the names of the actions that they are associated to.
         * @type Object.<String, ControlBinding>
         */
        this._bindings = {};
        // if a JSON was specified, initialize the bindings from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    /**
     * Returns a descriptive name of the device this interpreter handles to show for the user.
     * @returns {String}
     */
    InputInterpreter.prototype.getDeviceName = function () {
        return "Generic";
    };
    /**
     * Whether the interpreter is currently listening for input (and thus also intercepting it, preventing most default actions)
     * @returns {Boolean}
     */
    InputInterpreter.prototype.isListening = function () {
        return this._listening;
    };
    /**
     * Makes the interpreter start intercepting events related to its input device to update the internal state it stores about it as well
     * as prevent default actions for these events. If the interpreter is also enabled, it will also be able to query it for the list and
     * intensities of the actions that are triggered based on the current input state and its bindings.
     * Needs to be overridden to set add the setting of event handlers and other optional settings.
     */
    InputInterpreter.prototype.startListening = function () {
        this._listening = true;
    };
    /**
     * The interpreter will stop listening after calling this method, canceling any event handlers related to its input device. Since its
     * stored state of the device will not be updated any more, attempting to get the list of triggered actions will result in an empty
     * array, even if th interpeter is enabled.
     * Needs to be overridden to set add the canceling of event handlers and other optional settings.
     */
    InputInterpreter.prototype.stopListening = function () {
        this._listening = false;
    };
    /**
     * Changes the listening state of the interpreter to its opposite.
     */
    InputInterpreter.prototype.toggleListening = function () {
        if (this._listening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    };
    /**
     * Returns whether the interpreter is currently at enabled state, meaning it can be queried for triggered actions (if it is currently
     * also in listening state)
     * @returns {Boolean}
     */
    InputInterpreter.prototype.isEnabled = function () {
        return this._enabled;
    };
    /**
     * Sets the interpreter to enabled state, in which it will return the list of triggered actions and their intensities when queried,
     * but only if it is also set to listen to events.
     * @returns {Boolean}
     */
    InputInterpreter.prototype.enable = function () {
        this._enabled = true;
    };
    /**
     * Sets the interpreter to disabled state, in which it will not return any triggered actions when queried, even if it is listening
     * to events and keeping its model of the input device state updated.
     * @returns {Boolean}
     */
    InputInterpreter.prototype.disable = function () {
        this._enabled = false;
    };
    /**
     * Changes the enabled state of the interpreter to its opposite.
     */
    InputInterpreter.prototype.toggleEnabled = function () {
        if (this._enabled) {
            this.disable();
        } else {
            this.enable();
        }
    };
    /**
     * If there is no control bound yet to the action associated with the passed 
     * binding, adds the binding. If there already is a binding, overwrites it with
     * the passed binding, as there can be no two different controls bound to the
     * same action for now. This method is for setting default bindings.
     * @param {ControlBinding} binding
     */
    InputInterpreter.prototype.setBinding = function (binding) {
        this._bindings[binding.getActionName()] = binding;
    };
    /**
     * Sets (adds or overwrites) the binding associated with the action of the 
     * passed binding, and also stores the binding in HTML5 local storage. This 
     * method is for setting custom local bindings.
     * @param {ControlBinding} binding
     */
    InputInterpreter.prototype.setAndStoreBinding = function (binding) {
        this.setBinding(binding);
        binding.saveToLocalStorage();
    };
    /**
     * Loads the properties of the interpreter such as the (default) bindings
     * from the passed JSON object.
     * @param {Object} dataJSON
     */
    InputInterpreter.prototype.loadFromJSON = function (dataJSON) {
        var i;
        for (i = 0; i < dataJSON.bindings.length; i++) {
            this.setBinding(new this._bindingClass(dataJSON.bindings[i]));
        }
    };
    /**
     * Loads the properties of the interpreter such as the (custom local) bindings
     * from HTML5 local storage.
     */
    InputInterpreter.prototype.loadFromLocalStorage = function () {
        var actionName;
        for (actionName in this._bindings) {
            if (this._bindings.hasOwnProperty(actionName)) {
                this._bindings[actionName].loadFromLocalStorage();
            }
        }
    };
    /**
     * Removes custom bindings stored in HTML5 local storage.
     */
    InputInterpreter.prototype.removeFromLocalStorage = function () {
        var actionName;
        for (actionName in this._bindings) {
            if (this._bindings.hasOwnProperty(actionName)) {
                this._bindings[actionName].removeFromLocalStorage();
            }
        }
    };
    /**
     * Returns a string describing the control assigned to the action with the passed name.
     * @param {String} actionName
     * @returns {String}
     */
    InputInterpreter.prototype.getControlStringForAction = function (actionName) {
        if (this._bindings[actionName] !== undefined) {
            return this._bindings[actionName].getControlString();
        }
        return "";
    };
    /**
     * @typedef {Object} ActionTrigger
     * @property {String} name
     * @property {Number} [intensity]
     */
    /**
     * Adds a new triggered action to the group that was triggered by the same controls
     * @param {Array} actionsByBindings A list of groups of triggered actions, where each group was triggered by the same controls
     * @param {(ActionTrigger|null)} action
     * @param {Binding} binding The binding that triggered the action
     */
    InputInterpreter.prototype._addActionByBinding = function (actionsByBindings, action, binding) {
        var i;
        if (!action) {
            return;
        }
        for (i = 0; i < actionsByBindings.length; i++) {
            if (binding.bindsTheSameControls(actionsByBindings[i].binding)) {
                actionsByBindings[i].actions.push(action);
                return;
            }
        }
        actionsByBindings.push({
            binding: binding,
            actions: [action]
        });
    };
    /**
     * Needs to be overridden to check whether the action with the supplied name is triggered based on the currently maintained input state
     * and if yes, with what intensity. (if it has a specific intensity)
     * @param {String} actionName
     * @returns {(ActionTrigger|null)} Null, if the action is not triggered
     */
    InputInterpreter.prototype.checkAction = function (actionName) {
        application.showError("Cannot check if action '" + actionName + "' is triggered with a generic input interpreter!");
    };
    /**
     * Returns the list of currently triggered actions based on the internally stored input device state and the control bindings.
     * @param {Function} [actionFilterFunction] If given, every triggered action will be tested against this function (by passing its name
     * as a parameter), and only added to the resulting list if the function returns true.
     * @returns {Object[][]} The lists of action names and intensities, grouped by the triggering controls (if two actions were triggered
     * by the same controls, they will be in the same array, and the result itself is an array of such arrays. The name (String) property 
     * stores the action's name and the intensity (Number) property the intensity.
     */
    InputInterpreter.prototype.getTriggeredActions = function (actionFilterFunction) {
        var result = [], actionName, actionsByBindings = [], i;
        if (!this.isListening() || !this.isEnabled()) {
            return result;
        }
        for (actionName in this._bindings) {
            if (this._bindings.hasOwnProperty(actionName)) {
                if (!actionFilterFunction || actionFilterFunction(actionName)) {
                    this._addActionByBinding(actionsByBindings, this.checkAction(actionName), this._bindings[actionName]);
                }
            }
        }
        for (i = 0; i < actionsByBindings.length; i++) {
            result.push(actionsByBindings[i].actions);
        }
        return result;
    };
    // #########################################################################
    /**
     * @class Represents a key (combination) - action association.
     * @extends ControlBinding
     * @param {Object|String} [dataJSONOrActionName] If a string is given, it will
     * be taken as the name of the action to be assigned. Otherwise it is taken as
     * a JSON object storing all the properties.
     * @param {String} [key] The string representation of the key associated in this
     * binding.
     * @param {Boolean} [shiftState] Whether shift should be pressed in this key 
     * combination (next to the primary key being pressed).
     * @param {Boolean} [ctrlState] Whether ctrl should be pressed in this key 
     * combination (next to the primary key being pressed).
     * @param {Boolean} [altState] Whether alt should be pressed in this key 
     * combination (next to the primary key being pressed).
     */
    function KeyBinding(dataJSONOrActionName, key, shiftState, ctrlState, altState) {
        /**
         * The string representation of the key. 
         * @see KeyboardInputInterpreter#getKeyCodeTable
         * @type String
         */
        this._key = key || null;
        /**
         * The key code of the key, same as passed in the keyCode property of the event
         * argument of key event handlers.
         * @type Number
         */
        this._keyCode = utils.getKeyCodeOf(key);
        /**
         * Whether shift should be pressed in this key combination (next to _key being pressed).
         * @type Boolean
         */
        this._shiftState = (shiftState === undefined) ? false : (shiftState || (this._keyCode === SHIFT_CODE));
        /**
         * Whether ctrl should be pressed in this key combination (next to _key being pressed).
         * @type Boolean
         */
        this._ctrlState = (ctrlState === undefined) ? false : (ctrlState || (this._keyCode === CTRL_CODE));
        /**
         * Whether alt should be pressed in this key combination (next to _key being pressed).
         * @type Boolean
         */
        this._altState = (altState === undefined) ? false : (altState || (this._keyCode === ALT_CODE));
        ControlBinding.call(this, dataJSONOrActionName);
        application.log("Created key binding: " + this._actionName + " - " + this.getControlString(), 3);
    }
    KeyBinding.prototype = new ControlBinding();
    KeyBinding.prototype.constructor = KeyBinding;
    /**
     * @override
     * Loads the properties of the key binding as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    KeyBinding.prototype.loadFromJSON = function (dataJSON) {
        ControlBinding.prototype.loadFromJSON.call(this, dataJSON);
        this.setKey(dataJSON.key);
        this._shiftState = (dataJSON.shift === true) || (this._keyCode === SHIFT_CODE);
        this._ctrlState = (dataJSON.ctrl === true) || (this._keyCode === CTRL_CODE);
        this._altState = (dataJSON.alt === true) || (this._keyCode === ALT_CODE);
    };
    /**
     * @override
     * Saves the properties of this key binding to HTML5 local storage.
     */
    KeyBinding.prototype.saveToLocalStorage = function () {
        localStorage[_modulePrefix + this._actionName + KEY_SUFFIX] = this._key;
        localStorage[_modulePrefix + this._actionName + SHIFT_STATE_SUFFIX] = this._shiftState;
        localStorage[_modulePrefix + this._actionName + CTRL_STATE_SUFFIX] = this._ctrlState;
        localStorage[_modulePrefix + this._actionName + ALT_STATE_SUFFIX] = this._altState;
    };
    /**
     * @override
     * Loads the properties of the key binding if they are stored in the HTML5 local
     * storage object.
     */
    KeyBinding.prototype.loadFromLocalStorage = function () {
        if (localStorage[_modulePrefix + this._actionName + KEY_SUFFIX] !== undefined) {
            this.setKey(localStorage[_modulePrefix + this._actionName + KEY_SUFFIX]);
            this._shiftState = (localStorage[_modulePrefix + this._actionName + SHIFT_STATE_SUFFIX] === "true");
            this._ctrlState = (localStorage[_modulePrefix + this._actionName + CTRL_STATE_SUFFIX] === "true");
            this._altState = (localStorage[_modulePrefix + this._actionName + ALT_STATE_SUFFIX] === "true");
        }
    };
    /**
     * @override
     * Removes the properties of this key binding from the HTML5 local storage.
     */
    KeyBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem(_modulePrefix + this._actionName + KEY_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + SHIFT_STATE_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + CTRL_STATE_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + ALT_STATE_SUFFIX);
    };
    /**
     * Returns the string representation of the key assigned in this key binding.
     * (without respect to the shift, ctrl and alt states).
     * @returns {String}
     */
    KeyBinding.prototype.getKey = function () {
        return this._key;
    };
    /**
     * Assigns the passed key, binding it to the action assigned in this key binding.
     * The key needs to be given in string form. @see KeyboardInputInterpreter#getKeyCodeTable
     * @param {String} key
     */
    KeyBinding.prototype.setKey = function (key) {
        this._key = key;
        this._keyCode = utils.getKeyCodeOf(this._key);
    };
    /**
     * Returns if pressing shift is part of the key combination assigned in this
     * key binding.
     * @returns {Boolean}
     */
    KeyBinding.prototype.getShiftState = function () {
        return this._shiftState;
    };
    /**
     * Returns if pressing ctrl is part of the key combination assigned in this
     * key binding. 
     * @returns {Boolean}
     */
    KeyBinding.prototype.getCtrlState = function () {
        return this._ctrlState;
    };
    /**
     * Returns if pressing alt is part of the key combination assigned in this
     * key binding. 
     * @returns {Boolean}
     */
    KeyBinding.prototype.getAltState = function () {
        return this._altState;
    };
    /**
     * @override
     * Returns a string that describes the key combination that is bound to the action in this binding to show to the user.
     * @returns {String}
     */
    KeyBinding.prototype.getControlString = function () {
        var result, modifier;
        result = strings.get(KEY_STRING_PREFIX, this._key, this._key);
        if (this._shiftState && (this._keyCode !== SHIFT_CODE)) {
            modifier = utils.getKeyOfCode(SHIFT_CODE);
            modifier = strings.get(KEY_STRING_PREFIX, modifier, modifier);
            result = modifier + CONTROL_STRING_COMBINE + result;
        }
        if ((this._ctrlState) && (this._keyCode !== CTRL_CODE)) {
            modifier = utils.getKeyOfCode(CTRL_CODE);
            modifier = strings.get(KEY_STRING_PREFIX, modifier, modifier);
            result = modifier + CONTROL_STRING_COMBINE + result;
        }
        if ((this._altState) && (this._keyCode !== ALT_CODE)) {
            modifier = utils.getKeyOfCode(ALT_CODE);
            modifier = strings.get(KEY_STRING_PREFIX, modifier, modifier);
            result = modifier + CONTROL_STRING_COMBINE + result;
        }
        return result;
    };
    /**
     * Returns if the key combination is triggered according to the keyboard state
     * passed as parameter.
     * @param {Boolean[]} currentlyPressedKeys An array indicating the current pressed
     * state of each key on the keyboard. The index in the array corresponds to the
     * keyCode property of the event argument of the key event handlers.
     * @returns {Boolean}
     */
    KeyBinding.prototype.isTriggered = function (currentlyPressedKeys) {
        return (currentlyPressedKeys[this._keyCode] &&
                (currentlyPressedKeys[SHIFT_CODE] || !this._shiftState) &&
                (currentlyPressedKeys[CTRL_CODE] || !this._ctrlState) &&
                (currentlyPressedKeys[ALT_CODE] || !this._altState));
    };
    /**
     * @override
     * Returns whether this binding has the same key configuration as the passed one (and so it conflicts with it)
     * @param {KeyBinding} otherKeyBinding
     */
    KeyBinding.prototype.bindsTheSameControls = function (otherKeyBinding) {
        return (this._keyCode === otherKeyBinding._keyCode);
    };
    // #########################################################################
    /**
     * @class Monitors the keyboard inputs and stores the current state of which
     * keys are pressed. Can load and store key bindings and based on the current
     * state and the key bindings, determine the list of currently triggered actions
     * that controllers can/should execute.
     * @extends InputInterpreter
     * @param {Object} [dataJSON] Upon initialization, it can load the key bindings from
     * this JSON object if specified.
     */
    function KeyboardInputInterpreter(dataJSON) {
        InputInterpreter.call(this, KeyBinding, dataJSON);
        /**
         * An array indicating the current pressed state of each key on the keyboard. 
         * The index in the array corresponds to the keyCode property of the event 
         * argument of the key event handlers.
         * @type Boolean[256]
         */
        this._currentlyPressedKeys = new Array(256);
    }
    KeyboardInputInterpreter.prototype = new InputInterpreter();
    KeyboardInputInterpreter.prototype.constructor = KeyboardInputInterpreter;
    /**
     * @override
     * Returns of the name of the device this interpreter monitors. Every input
     * interpreter should implement this function.
     * @returns {String}
     */
    KeyboardInputInterpreter.prototype.getDeviceName = function () {
        return "keyboard";
    };
    /**
     * Returns whether the default browser actions for the key of the passed code
     * should be enabled while this interpreter is active.
     * @param {Number} keyCode
     * @returns {Boolean}
     */
    KeyboardInputInterpreter.prototype.defaultActionEnabledForKey = function (keyCode) {
        return ["f5", "f11", 'escape'].indexOf(utils.getKeyOfCode(keyCode)) >= 0;
    };
    /**
     * Updates the internally stored state of the keyboard, marking all keys as 
     * non-pressed.
     */
    KeyboardInputInterpreter.prototype.cancelPressedKeys = function () {
        var i;
        for (i = 0; i < this._currentlyPressedKeys.length; i++) {
            this._currentlyPressedKeys[i] = false;
        }
    };
    /**
     * An event handler for the keydown event, updating the stored state of the 
     * keyboard.
     * @param {KeyboardEvent} event
     */
    KeyboardInputInterpreter.prototype.handleKeyDown = function (event) {
        this._currentlyPressedKeys[event.keyCode] = true;
        if (!this.defaultActionEnabledForKey(event.keyCode)) {
            event.preventDefault();
            event.stopPropagation();
        }
    };
    /**
     * An event handler for the keyup event, updating the stored state of the 
     * keyboard.
     * @param {KeyboardEvent} event
     */
    KeyboardInputInterpreter.prototype.handleKeyUp = function (event) {
        this._currentlyPressedKeys[event.keyCode] = false;
        if (!this.defaultActionEnabledForKey(event.keyCode)) {
            event.preventDefault();
            event.stopPropagation();
        }
    };
    /**
     * @override
     * Sets the event handlers on the document to start updating the stored internal
     * state on key presses and releases. The triggered actions can be queried from
     * this interpreter after this function has been called.
     */
    KeyboardInputInterpreter.prototype.startListening = function () {
        InputInterpreter.prototype.startListening.call(this);
        this.cancelPressedKeys();
        document.onkeydown = function (event) {
            this.handleKeyDown(event);
        }.bind(this);
        document.onkeyup = function (event) {
            this.handleKeyUp(event);
        }.bind(this);
        document.onkeypress = function (event) {
            if (!this.defaultActionEnabledForKey(event.keyCode)) {
                event.preventDefault();
                event.stopPropagation();
            }
        }.bind(this);
    };
    /**
     * @override
     * Cancels the event handlers on the document that update the internal state.
     * The triggered actions cannot be queried from this interpreter after this 
     * function has been called.
     */
    KeyboardInputInterpreter.prototype.stopListening = function () {
        InputInterpreter.prototype.stopListening.call(this);
        document.onkeydown = null;
        document.onkeyup = null;
        this.cancelPressedKeys();
    };
    /**
     * @override
     * Checks if the action with the supplied name is triggered based on the current input state.
     * @param {String} actionName
     * @returns {(ActionTrigger|null)} Null, if the action is not triggered
     */
    KeyboardInputInterpreter.prototype.checkAction = function (actionName) {
        return (this._bindings[actionName].isTriggered(this._currentlyPressedKeys)) ?
                {name: actionName} :
                null;
    };
    // #########################################################################
    /**
     * @class Represents the assignment of a mouse action (such as move, click...) 
     * to an in-game action. (such as fire)
     * @extends ControlBinding
     * @param {Object} [dataJSON] If given, the properties will be initialized from
     * the data stored in this JSON object.
     */
    function MouseBinding(dataJSON) {
        /**
         * Which mouse button should be pressed to trigger this binding.
         * Possible values:
         * 0: none
         * 1: left
         * 2: middle
         * 3: right
         * @type Number
         * @default 0
         */
        this._buttonIndex = 0;
        /**
         * What kind of horizontal mouse movement needs to take place to trigger 
         * this binding.
         * Possible values:
         * 0: none
         * -1: movement to the left
         * 1: movement to the right
         * @type Number
         * @default 0
         */
        this._moveX = 0;
        /**
         * What kind of vertical mouse movement needs to take place to trigger 
         * this binding.
         * Possible values:
         * 0: none
         * -1: movement upward
         * 1: movement downward
         * @type Number
         * @default 0
         */
        this._moveY = 0;
        /**
         * Whether the movement (displacement) should be calculated relative to the
         * screen (canvas) center (or relative to the previous mouse position).
         * @type Boolean
         * @default false
         */
        this._measuredFromCenter = false;
        /**
         * What kind of mouse scrolling needs to take place on the X axis to trigger this binding.
         * Possible values:
         * 0: none
         * -1: scroll left
         * 1: scroll right
         * @type Number
         * @default 0
         */
        this._scrollX = 0;
        /**
         * What kind of mouse scrolling needs to take place on the Y axis to trigger this binding.
         * Possible values:
         * 0: none
         * 1: scroll downward
         * -1: scroll upward
         * @type Number
         * @default 0
         */
        this._scrollY = 0;
        ControlBinding.call(this, dataJSON);
    }
    MouseBinding.prototype = new ControlBinding();
    MouseBinding.prototype.constructor = MouseBinding;
    /**
     * @override
     * Loads the properties of the key binding as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    MouseBinding.prototype.loadFromJSON = function (dataJSON) {
        ControlBinding.prototype.loadFromJSON.call(this, dataJSON);
        this._buttonIndex = MOUSE_BUTTON_NAMES.indexOf(dataJSON.button);
        this._moveX = 0;
        this._moveY = 0;
        switch (dataJSON.move) {
            case DIRECTION_LEFT:
                this._moveX = -1;
                break;
            case DIRECTION_RIGHT:
                this._moveX = 1;
                break;
            case DIRECTION_UP:
                this._moveY = -1;
                break;
            case DIRECTION_DOWN:
                this._moveY = 1;
                break;
        }
        this._measuredFromCenter = (dataJSON.fromCenter === true);
        this._scrollX = 0;
        this._scrollY = 0;
        switch (dataJSON.scroll) {
            case DIRECTION_LEFT:
                this._scrollX = -1;
                break;
            case DIRECTION_RIGHT:
                this._scrollX = 1;
                break;
            case DIRECTION_UP:
                this._scrollY = -1;
                break;
            case DIRECTION_DOWN:
                this._scrollY = 1;
                break;
        }
    };
    /**
     * @override
     * Saves the properties of this mouse binding to HTML5 local storage.
     */
    MouseBinding.prototype.saveToLocalStorage = function () {
        localStorage[_modulePrefix + this._actionName + MOUSE_BUTTON_INDEX_SUFFIX] = this._buttonIndex;
        localStorage[_modulePrefix + this._actionName + MOUSE_MOVE_X_SUFFIX] = this._moveX;
        localStorage[_modulePrefix + this._actionName + MOUSE_MOVE_Y_SUFFIX] = this._moveY;
        localStorage[_modulePrefix + this._actionName + MOUSE_FROM_CENTER_SUFFIX] = this._measuredFromCenter;
        localStorage[_modulePrefix + this._actionName + MOUSE_SCROLL_X_SUFFIX] = this._scrollX;
        localStorage[_modulePrefix + this._actionName + MOUSE_SCROLL_Y_SUFFIX] = this._scrollY;
    };
    /**
     * @override
     * Loads the properties of the mouse binding if they are stored in the HTML5 local
     * storage object.
     */
    MouseBinding.prototype.loadFromLocalStorage = function () {
        if (localStorage[_modulePrefix + this._actionName + MOUSE_BUTTON_INDEX_SUFFIX] !== undefined) {
            this._buttonIndex = parseInt(localStorage[_modulePrefix + this._actionName + MOUSE_BUTTON_INDEX_SUFFIX], 10);
            this._moveX = parseInt(localStorage[_modulePrefix + this._actionName + MOUSE_MOVE_X_SUFFIX], 10);
            this._moveY = parseInt(localStorage[_modulePrefix + this._actionName + MOUSE_MOVE_Y_SUFFIX], 10);
            this._measuredFromCenter = (localStorage[_modulePrefix + this._actionName + MOUSE_FROM_CENTER_SUFFIX] === "true");
            this._scrollX = parseInt(localStorage[_modulePrefix + this._actionName + MOUSE_SCROLL_X_SUFFIX], 10);
            this._scrollY = parseInt(localStorage[_modulePrefix + this._actionName + MOUSE_SCROLL_Y_SUFFIX], 10);
        }
    };
    /**
     * @override
     * Removes the properties of this mouse binding from the HTML5 local storage.
     */
    MouseBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem(_modulePrefix + this._actionName + MOUSE_BUTTON_INDEX_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + MOUSE_MOVE_X_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + MOUSE_MOVE_Y_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + MOUSE_FROM_CENTER_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + MOUSE_SCROLL_X_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + MOUSE_SCROLL_Y_SUFFIX);
    };
    /**
     * Returns if the binding trigger intensity depends on the displacement of the
     * mouse from the center of the screen.
     * @returns {Boolean}
     */
    MouseBinding.prototype.isMeasuredFromCenter = function () {
        return this._measuredFromCenter;
    };
    /**
     * @override
     * Returns a string representation describing the mouse action the user needs
     * to perform to trigger this binding.
     * @returns {String}
     */
    MouseBinding.prototype.getControlString = function () {
        var result = "", direction = null;
        switch (MOUSE_BUTTON_NAMES[this._buttonIndex]) {
            case MouseButtonName.LEFT:
                return strings.get(MOUSE_LEFT_BUTTON, "", MOUSE_LEFT_BUTTON.defaultValue);
            case MouseButtonName.MIDDLE:
                return strings.get(MOUSE_MIDDLE_BUTTON, "", MOUSE_MIDDLE_BUTTON.defaultValue);
            case MouseButtonName.RIGHT:
                return strings.get(MOUSE_RIGHT_BUTTON, "", MOUSE_RIGHT_BUTTON.defaultValue);
        }
        result = this._measuredFromCenter ?
                strings.get(MOUSE_FROM_CENTER, "", MOUSE_FROM_CENTER.defaultValue) :
                strings.get(MOUSE_NOT_FROM_CENTER, "", MOUSE_NOT_FROM_CENTER.defaultValue);
        if (this._moveX < 0) {
            direction = strings.get(MOUSE_DIRECTION_LEFT, "", MOUSE_DIRECTION_LEFT.defaultValue);
        } else if (this._moveX > 0) {
            direction = strings.get(MOUSE_DIRECTION_RIGHT, "", MOUSE_DIRECTION_RIGHT.defaultValue);
        } else if (this._moveY < 0) {
            direction = strings.get(MOUSE_DIRECTION_UP, "", MOUSE_DIRECTION_UP.defaultValue);
        } else if (this._moveY > 0) {
            direction = strings.get(MOUSE_DIRECTION_DOWN, "", MOUSE_DIRECTION_DOWN.defaultValue);
        }
        if (direction) {
            result = utils.formatString(result, {
                move: strings.get(MOUSE_MOVE, "", MOUSE_MOVE.defaultValue),
                toDirection: direction
            });
            return result;
        }
        direction = null;
        result = strings.get(MOUSE_NOT_FROM_CENTER, "", MOUSE_NOT_FROM_CENTER.defaultValue);
        if (this._scrollX < 0) {
            direction = strings.get(MOUSE_DIRECTION_LEFT, "", MOUSE_DIRECTION_LEFT.defaultValue);
        } else if (this._scrollX > 0) {
            direction = strings.get(MOUSE_DIRECTION_RIGHT, "", MOUSE_DIRECTION_RIGHT.defaultValue);
        } else if (this._scrollY < 0) {
            direction = strings.get(MOUSE_DIRECTION_UP, "", MOUSE_DIRECTION_UP.defaultValue);
        } else if (this._scrollY > 0) {
            direction = strings.get(MOUSE_DIRECTION_DOWN, "", MOUSE_DIRECTION_DOWN.defaultValue);
        }
        if (direction) {
            result = utils.formatString(result, {
                move: strings.get(MOUSE_SCROLL, "", MOUSE_SCROLL.defaultValue),
                toDirection: direction
            });
        }
        return result;
    };
    /**
     * Returns how much is the mouse action  triggered according to the current mouse 
     * state passed as parameter. Mouse actions can have different trigger intensities
     * (the mouse moving faster/further from the base point), therefore the returned
     * value is an integer.
     * @param {Boolean[]} currentlyPressedButtons The current press state of the 
     * mouse buttons. Arrangement: [left,middle,right]
     * @param {Number[2]} mousePosition The current [x,y] position of the mouse on the screen
     * @param {Number[2]} mousePositionChange The difference of the current position from the one at the previous trigger check ([x,y])
     * @param {Number[2]} screenCenter The coordinates of the center of the screen ([x,y])
     * @param {Number[2]} scrollChange The change in scroll position from the one at the previous trigger check ([x,y])
     * @returns {Number} Whether the action was triggerend and with what intensity.
     * Zero means the action was not triggered, a positive value represents the 
     * intensity.
     */
    MouseBinding.prototype.getTriggeredIntensity = function (currentlyPressedButtons, mousePosition, mousePositionChange, screenCenter, scrollChange) {
        var relativeX, relativeY;
        // first if this is a button assignment, check the state of the appropriate
        // mouse button
        if (this._buttonIndex > 0) {
            return (currentlyPressedButtons[this._buttonIndex] === true) ? 1 : -1;
        }
        if (!mousePosition) {
            return 0;
        }
        // check movement on X and Y axes
        // movement in the negative direction is represented by '-1' value of _moveX/Y,
        // therefore multiplying with the actual movement will be positive if it was
        // in the same direction
        relativeX = this._measuredFromCenter ? mousePosition[0] - screenCenter[0] : mousePositionChange[0];
        if (this._moveX !== 0) {
            return relativeX * this._moveX;
        }
        relativeY = this._measuredFromCenter ? mousePosition[1] - screenCenter[1] : mousePositionChange[1];
        if (this._moveY !== 0) {
            return relativeY * this._moveY;
        }
        if (this._scrollX !== 0) {
            return scrollChange[0] * this._scrollX;
        }
        if (this._scrollY !== 0) {
            return scrollChange[1] * this._scrollY;
        }
    };
    /**
     * @override
     * Returns whether this binding has the same control (button/axis) configuration as the passed one (and so it conflicts with it)
     * @param {MouseBinding} otherMouseBinding
     */
    MouseBinding.prototype.bindsTheSameControls = function (otherMouseBinding) {
        return (this._buttonIndex === otherMouseBinding._buttonIndex) &&
                (((this._moveX === 0) && (otherMouseBinding._moveX === 0)) || ((this._moveX * otherMouseBinding._moveX) !== 0)) &&
                (((this._moveY === 0) && (otherMouseBinding._moveY === 0)) || ((this._moveY * otherMouseBinding._moveY) !== 0)) &&
                (((this._scrollX === 0) && (otherMouseBinding._scrollX === 0)) || ((this._scrollX * otherMouseBinding._scrollX) !== 0)) &&
                (((this._scrollY === 0) && (otherMouseBinding._scrollY === 0)) || ((this._scrollY * otherMouseBinding._scrollY) !== 0));
    };
    // #########################################################################
    /**
     * @class Monitors the mouse inputs and stores the current state of the mouse. 
     * Can load and store mouse bindings and based on the current state and the 
     * bindings, determine the list of currently triggered actions that controllers 
     * can/should execute.
     * @extends InputInterpreter
     * @param {Object} [dataJSON] Upon initialization, it can load the mouse bindings from
     * this JSON object if specified.
     */
    function MouseInputInterpreter(dataJSON) {
        /**
         * An array storing the press state of mouse buttons.
         * Arrangement: [left,middle,right]
         * @type Boolean[3]
         */
        this._currentlyPressedButtons = [false, false, false];
        /**
         * Stores the center of the screen, relative to which the mouse coordinates
         * can be considered by bindings (instead of the change in mouse position) 
         * so that control is possible when the mouse does not need to be moved 
         * continuously for e.g. continuous turning.
         * @type Number[2]
         */
        this._screenCenter = [0, 0];
        /**
         * The current mouse position as obtained from the mouse event.
         * @type Number[2]
         */
        this._mousePosition = null;
        /**
         * The change in mouse position since the last time the inputs were processed.
         * @type Number[2]
         */
        this._mousePositionChange = [0, 0];
        /**
         * The scrolling that happened on axes X and Y since the last time the inputs were processed.
         * @type Number[2]
         */
        this._scrollChange = [0, 0];
        /**
         * The intensity of actions derived from the speed of the mouse movement
         * will be multiplied by this factor.
         * @type Number
         */
        this._moveSensitivity = 0;
        /**
         * The intensity of actions derived from displacement of the mouse from the
         * center will be multiplied by this factor.
         * @type Number
         */
        this._displacementSensitivity = 0;
        /**
         * The actions the would derive their intensity from displacement of the mouse 
         * from the center will not be triggered unless the displacement exceeds this
         * magnitude (in pixels).
         * @type Number
         */
        this._displacementDeadzone = 0;
        InputInterpreter.call(this, MouseBinding, dataJSON);
    }
    MouseInputInterpreter.prototype = new InputInterpreter();
    MouseInputInterpreter.prototype.constructor = MouseInputInterpreter;
    /**
     * Updates the screen center relative to which the mouse position is sent to the
     * binding to check if they are triggered. Needs to be called when the center
     * changes, e.g. the window is resized.
     * @param {Number} x The X coordinate.
     * @param {Number} y The Y coordinate.
     */
    MouseInputInterpreter.prototype.setScreenCenter = function (x, y) {
        this._screenCenter = [x, y];
        this._mousePosition = null;
        this._mousePositionChange = [0, 0];
        this._scrollChange = [0, 0];
    };
    /**
     * @override
     * Returns of the name of the device this interpreter monitors. Every input
     * interpreter should implement this function.
     * @returns {String}
     */
    MouseInputInterpreter.prototype.getDeviceName = function () {
        return "mouse";
    };
    /**
     * Sets the mouse move sensitivity and stores the setting in HTML5 local storage.
     * @param {Number} moveSensitivity
     */
    MouseInputInterpreter.prototype.setAndStoreMoveSensitivity = function (moveSensitivity) {
        this._moveSensitivity = moveSensitivity;
        localStorage[_modulePrefix + "mouse_moveSensitivity"] = this._moveSensitivity;
    };
    /**
     * Sets the mouse displacement sensitivity and stores the setting in HTML5 local storage.
     * @param {Number} displacementSensitivity
     */
    MouseInputInterpreter.prototype.setAndStoreDisplacementSensitivity = function (displacementSensitivity) {
        this._displacementSensitivity = displacementSensitivity;
        localStorage[_modulePrefix + "mouse_displacementSensitivity"] = this._displacementSensitivity;
    };
    /**
     * Sets the mouse displacement deadzone and stores the setting in HTML5 local storage.
     * @param {Number} displacementDeadzone
     */
    MouseInputInterpreter.prototype.setAndStoreDisplacementDeadzone = function (displacementDeadzone) {
        this._displacementDeadzone = displacementDeadzone;
        localStorage[_modulePrefix + "mouse_displacementDeadzone"] = this._displacementDeadzone;
    };
    /**
     * @override
     * Loads the properties of the interpreter such as the (default) mouse bindings
     * from the passed JSON object.
     * @param {Object} dataJSON
     */
    MouseInputInterpreter.prototype.loadFromJSON = function (dataJSON) {
        InputInterpreter.prototype.loadFromJSON.call(this, dataJSON);
        this._moveSensitivity = dataJSON.sensitivityProfile.moveSensitivity;
        this._displacementSensitivity = dataJSON.sensitivityProfile.displacementSensitivity;
        this._displacementDeadzone = dataJSON.sensitivityProfile.displacementDeadzone;
    };
    /**
     * @override
     * Loads the properties of the interpreter such as the (custom local) mouse bindings
     * from HTML5 local storage.
     */
    MouseInputInterpreter.prototype.loadFromLocalStorage = function () {
        InputInterpreter.prototype.loadFromLocalStorage.call(this);
        if (localStorage[_modulePrefix + "mouse_moveSensitivity"] !== undefined) {
            this._moveSensitivity = parseFloat(localStorage[_modulePrefix + "mouse_moveSensitivity"]);
        }
        if (localStorage[_modulePrefix + "mouse_displacementSensitivity"] !== undefined) {
            this._displacementSensitivity = parseFloat(localStorage[_modulePrefix + "mouse_displacementSensitivity"]);
        }
        if (localStorage[_modulePrefix + "mouse_displacementDeadzone"] !== undefined) {
            this._displacementDeadzone = parseInt(localStorage[_modulePrefix + "mouse_displacementDeadzone"], 10);
        }
    };
    /**
     * @override
     * Removes custom mouse bindings stored in HTML5 local storage.
     */
    MouseInputInterpreter.prototype.removeFromLocalStorage = function () {
        InputInterpreter.prototype.removeFromLocalStorage.call(this);
        localStorage.removeItem(_modulePrefix + "mouse_moveSensitivity");
        localStorage.removeItem(_modulePrefix + "mouse_displacementSensitivity");
        localStorage.removeItem(_modulePrefix + "mouse_displacementDeadzone");
    };
    /**
     * Updates the internally stored state of the mouse buttons, marking all buttons 
     * as non-pressed.
     */
    MouseInputInterpreter.prototype.cancelPressedButtons = function () {
        var i;
        for (i = 0; i < this._currentlyPressedButtons.length; i++) {
            this._currentlyPressedButtons[i] = false;
        }
    };
    /**
     * An event handler for the mousedown event, updating the stored state of the 
     * mouse.
     * @param {MouseEvent} event
     */
    MouseInputInterpreter.prototype.handleMouseDown = function (event) {
        this._currentlyPressedButtons[event.which] = true;
        event.preventDefault();
        return false;
    };
    /**
     * An event handler for the mouseup event, updating the stored state of the 
     * mouse.
     * @param {MouseEvent} event
     */
    MouseInputInterpreter.prototype.handleMouseUp = function (event) {
        this._currentlyPressedButtons[event.which] = false;
        event.preventDefault();
        return false;
    };
    /**
     * An event handler for the mousemove event, updating the stored state of the 
     * mouse.
     * @param {MouseEvent} event
     */
    MouseInputInterpreter.prototype.handleMouseMove = function (event) {
        if (this._mousePosition !== null) {
            // we add up all movements of the mouse and null it out after every query for triggered actions, so all movements between two
            // queries are considered
            this._mousePositionChange = [
                this._mousePositionChange[0] + (event.clientX - this._mousePosition[0]),
                this._mousePositionChange[1] + (event.clientY - this._mousePosition[1])
            ];
        } else {
            this._mousePositionChange = [0, 0];
        }
        this._mousePosition = [event.clientX, event.clientY];
    };
    /**
     * An event handler for the wheel event , updating the stored scrolling state
     * @param {WheelEvent} event
     */
    MouseInputInterpreter.prototype.handleWheel = function (event) {
        // changes are accumulated and reset to zero when processed
        this._scrollChange[0] += event.deltaX;
        this._scrollChange[1] += event.deltaY;
    };
    /**
     * @override
     * Sets the event handlers on the document to start updating the stored internal
     * state of the mouse. The triggered actions can be queried from this interpreter 
     * after this function has been called.
     */
    MouseInputInterpreter.prototype.startListening = function () {
        InputInterpreter.prototype.startListening.call(this);
        this.cancelPressedButtons();
        this._mousePosition = null;
        this._mousePositionChange = [0, 0];
        document.onmousedown = function (event) {
            this.handleMouseDown(event);
        }.bind(this);
        document.onmouseup = function (event) {
            this.handleMouseUp(event);
        }.bind(this);
        document.onmousemove = function (event) {
            this.handleMouseMove(event);
        }.bind(this);
        document.onwheel = function (event) {
            this.handleWheel(event);
        }.bind(this);
        document.onclick = function (event) {
            event.preventDefault();
            return false;
        };
        document.oncontextmenu = function (event) {
            event.preventDefault();
            return false;
        };
    };
    /**
     * @override
     * Cancels the event handlers on the document that update the internal state.
     * The triggered actions cannot be queried from this interpreter after this 
     * function has been called.
     */
    MouseInputInterpreter.prototype.stopListening = function () {
        InputInterpreter.prototype.stopListening.call(this);
        document.onmousedown = null;
        document.onmouseup = null;
        document.onmousemove = null;
        document.onwheel = null;
        document.onclick = null;
        document.oncontextmenu = null;
        this.cancelPressedButtons();
        this._mousePosition = null;
        this._mousePositionChange = [0, 0];
        this._scrollChange = [0, 0];
    };
    /**
     * @override
     * Checks if the action with the supplied name is triggered based on the current input state.
     * @param {String} actionName
     * @returns {(ActionTrigger|null)} Null, if the action is not triggered
     */
    MouseInputInterpreter.prototype.checkAction = function (actionName) {
        var actionIntensity =
                this._bindings[actionName].getTriggeredIntensity(
                this._currentlyPressedButtons,
                this._mousePosition,
                this._mousePositionChange,
                this._screenCenter,
                this._scrollChange);
        return (actionIntensity >= 0) ?
                {
                    name: actionName,
                    intensity: (this._bindings[actionName].isMeasuredFromCenter() === true) ?
                            Math.max(0, (actionIntensity - this._displacementDeadzone) * this._displacementSensitivity) :
                            (actionIntensity * this._moveSensitivity)
                } :
                null;
    };
    /**
     * @override
     * Returns the list of currently triggered actions based on the internally stored input device state and the control bindings.
     * @param {Function} [actionFilterFunction] If given, every triggered action will be tested against this function (by passing its name
     * as a parameter), and only added to the resulting list if the function returns true.
     * @returns {Object[][]} The lists of action names and intensities, grouped by the triggering controls (if two actions were triggered
     * by the same controls, they will be in the same array, and the result itself is an array of such arrays. The name (String) property 
     * stores the action's name and the intensity (Number) property the intensity.
     */
    MouseInputInterpreter.prototype.getTriggeredActions = function (actionFilterFunction) {
        var result = InputInterpreter.prototype.getTriggeredActions.call(this, actionFilterFunction);
        // null out the mouse movements added up since the last query
        this._mousePositionChange = [0, 0];
        this._scrollChange = [0, 0];
        return result;
    };
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
        ControlBinding.call(this, dataJSON);
    }
    GamepadBinding.prototype = new ControlBinding();
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
        ControlBinding.prototype.loadFromJSON.call(this, dataJSON);
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
            return utils.formatString(strings.get(JOYSTICK_BUTTON, "", JOYSTICK_BUTTON.defaultValue), {index: (this._button + 1)});
        }
        if (this._axisIndex !== this.AXIS_NONE) {
            return utils.formatString(strings.get(JOYSTICK_AXIS, "", JOYSTICK_AXIS.defaultValue), {
                index: (this._axisIndex + 1),
                direction: (this._axisPositive ?
                        strings.get(JOYSTICK_DIRECTION_POSITIVE, "", JOYSTICK_DIRECTION_POSITIVE.defaultValue) :
                        strings.get(JOYSTICK_DIRECTION_NEGATIVE, "", JOYSTICK_DIRECTION_NEGATIVE.defaultValue))});
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
         * This array stores the names of action the sensitivity modifiers should apply to.
         * @type Array
         */
        this._actionNames = dataJSON.actionNames;
        if (this._sensitivityFactor && this._staticSensitivity) {
            application.showError("Sensitivity action group defined with both factored and static sensitivity!", "minor");
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
            return this._staticSensitivity ? undefined : (baseIntensity * this._sensitivityFactor);
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
        InputInterpreter.call(this, GamepadBinding, dataJSON);
    }
    GamepadInputInterpreter.prototype = new InputInterpreter();
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
     * Loads the properties of the interpreter such as the (default) gamepad bindings
     * from the passed JSON object.
     * @param {Object} dataJSON
     */
    GamepadInputInterpreter.prototype.loadFromJSON = function (dataJSON) {
        var i;
        InputInterpreter.prototype.loadFromJSON.call(this, dataJSON);
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
        InputInterpreter.prototype.startListening.call(this);
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
        InputInterpreter.prototype.stopListening.call(this);
        window.ongamepadconnected = null;
        this._gamepad = null;
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
                        intensity: finalIntensity
                    };
                }
            }
            return {
                name: actionName,
                intensity: baseIntensity
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
            return InputInterpreter.prototype.getTriggeredActions.call(this, actionFilterFunction);
        }
        return [];
    };
    // #########################################################################
    /**
     * @class Represents an in-game action that can be triggered by the user and a 
     * controller can execute certain functions on methods on their controlled 
     * entities based on whether or not the action is currently triggered.
     * @param {Object} [dataJSON] If given, the properties will be initialized from
     * the data stored in this JSON object.
     */
    function Action(dataJSON) {
        /**
         * The name of the action used to identify it. Has to be unique within the
         * game. Input interpreters generate a list of action names based on what
         * is stored in their bindings, and controllers process this list to execute
         * the actions stored in their recognized action list.
         * @type String
         */
        this._name = null;
        /**
         * A longer, human readable description to be display in the control settings
         * screen.
         * @type String
         */
        this._description = null;
        /**
         * Whether the action is to be continuously executed while being triggered,
         * or only to be executed once a new trigger has been initiated.
         * @type Boolean
         */
        this._continuous = false;
        /**
         * Whether the action is currently being triggered or not.
         * @type Boolean
         */
        this._triggered = false;
        /**
         * If the action is triggered, then with what intensity. The value null
         * corresponds to a trigger without a specific intensity (such as trigger by
         * a key press)
         * @type Number
         */
        this._intensity = this.INTENSITY_NOT_SPECIFIED;
        /**
         * Whether the action has already been executed for the current trigger.
         * (non continuous actions will not fire unless this is reset to false by
         * the end of the current trigger and then a new trigger starts)
         * @type Boolean
         */
        this._executed = false;
        /**
         * Whether the non-triggered action has already been executed after the last trigger.
         * (non continuous actions will not fire their non-trigger continuously either)
         */
        this._nonTriggeredExecuted = true;
        /**
         * The function to execute when the action is triggered.
         * @type Function
         */
        this._executeTriggered = null;
        /**
         * The function to execute when the action is not being triggered.
         * @type Function
         */
        this._executeNonTriggered = null;
        // if a JSON was specified, initialize the properties from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    /**
     * Value for the intensity of an action that has not been set in this round
     * @constant 
     * @type Number
     */
    Action.prototype.INTENSITY_NOT_SPECIFIED = -3;
    /**
     * Value for the intensity of an action that has been triggered by a keypress (which does not have fine grades of intensity)
     * @constant 
     * @type Number
     */
    Action.prototype.INTENSITY_KEYPRESS = -2;
    /**
     * Returns the name of this action for identification within the program.
     * @returns {String}
     */
    Action.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the human readable description of this action that can be displayed
     * to the user.
     * @returns {String}
     */
    Action.prototype.getDescription = function () {
        return this._description;
    };
    /**
     * Loads the properties of the action as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    Action.prototype.loadFromJSON = function (dataJSON) {
        this._name = dataJSON.name;
        this._description = dataJSON.description;
        this._continuous = dataJSON.continuous === true;
        this._triggered = false;
        this._intensity = this.INTENSITY_NOT_SPECIFIED;
        this._executed = false;
        this._nonTriggeredExecuted = true;
    };
    /**
     * Sets the action's trigger state and intensity.
     * @param {Boolean} triggered The new trigger state of the action to be set.
     * @param {Number} intensity The new intensity of the action to be set. Will
     * be ignored if not given. If multiple triggers try to set the intensity, 
     * the highest one or the one with the  without intensity will be considered.
     */
    Action.prototype.setTriggered = function (triggered, intensity) {
        this._triggered = triggered;
        if ((intensity !== undefined) && ((this._intensity === this.INTENSITY_NOT_SPECIFIED) || ((this._intensity >= 0) && intensity > this._intensity))) {
            this._intensity = intensity;
        } else if (intensity === undefined) {
            this._intensity = this.INTENSITY_KEYPRESS;
        }
    };
    /**
     * Sets the function to be executed when the action is triggered.
     * @param {Function} executeTriggered
     */
    Action.prototype.setExecuteTriggered = function (executeTriggered) {
        this._executeTriggered = executeTriggered;
    };
    /**
     * Sets the function to be executed when the action is not triggered. (or has
     * already been executed for this trigger, if it is not continuous)
     * @param {Function} executeNonTriggered
     */
    Action.prototype.setExecuteNonTriggered = function (executeNonTriggered) {
        this._executeNonTriggered = executeNonTriggered;
    };
    /**
     * Executes the appropriate function based on whether the action is currently
     * triggered and if it is continuous. For continuous actions, the {@link Action#_executeTriggered}
     * function is executed continuously while the trigger lasts, whereas for 
     * non-continuous actions, it is executed once a new trigger starts. In any other
     * case, the {@link Action#_executeNonTriggered} function is executed. It also
     * resets the trigger state of the action.
     */
    Action.prototype.execute = function () {
        if (this._continuous === true) {
            if (this._triggered === true) {
                if (this._executeTriggered !== null) {
                    this._executeTriggered((this._intensity >= 0) ? this._intensity : null);
                }
            } else {
                if (this._executeNonTriggered !== null) {
                    this._executeNonTriggered();
                }
            }
        } else {
            if ((this._triggered === true) && (this._executed === false)) {
                if (this._executeTriggered !== null) {
                    this._executeTriggered((this._intensity >= 0) ? this._intensity : null);
                }
                this._executed = true;
            } else {
                if ((this._triggered === false) && (this._nonTriggeredExecuted === false)) {
                    if (this._executeNonTriggered !== null) {
                        this._executeNonTriggered();
                    }
                    this._nonTriggeredExecuted = true;
                }
                if (this._triggered === false) {
                    this._executed = false;
                } else {
                    this._nonTriggeredExecuted = false;
                }
            }
        }
        // We cancel the trigger after every execution. Before calling this function
        // the appropriate triggers have to be set by checking the current inputs.
        this._triggered = false;
        this._intensity = this.INTENSITY_NOT_SPECIFIED;
    };
    // #########################################################################
    /**
     * @class The superclass for all controllers. A controller is responsible for
     * processing triggered actions sent by the input interpreters and applying
     * them to the domain (entity) it is controlling. Controllers for different
     * domains are implemented as the subclasses for this class.
     * @param {Object} [dataJSON] If given, the properties will be initialized loading
     * the data from this JSON object
     */
    function Controller(dataJSON) {
        /**
         * A reference to the control context this controller has been added to.
         * @type ControlContext
         */
        this._context = null;
        /**
         * The associative array of the actions recognized by the controller. The keys
         * are the names of the actions, while the values are the {@link Action}s
         * themselves.
         * @type Object
         */
        this._actions = {};
        // if a JSON object was specified, initialize the properties from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    /**
     * Sets the referenced control context for this controller. Call when it is added to the context.
     * @param {ControlContext} value
     */
    Controller.prototype.setContext = function (value) {
        this._context = value;
    };
    /**
     * Returns the type (domain) of the controller. This needs to be implemented for
     * the sublasses.
     * @returns {String}
     */
    Controller.prototype.getType = function () {
        application.showError("Attempting to get the type of a generic controller object!");
        return "none (generic)";
    };
    /**
     * Returns an array containing all the actions that are recognized by this controller.
     * @returns {Action[]}
     */
    Controller.prototype.getActions = function () {
        var result = [], actionName;
        for (actionName in this._actions) {
            if (this._actions.hasOwnProperty(actionName)) {
                result.push(this._actions[actionName]);
            }
        }
        return result;
    };
    /**
     * Loads the properties of the controller as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    Controller.prototype.loadFromJSON = function (dataJSON) {
        var i;
        for (i = 0; i < dataJSON.actions.length; i++) {
            this._actions[dataJSON.actions[i].name] = new Action(dataJSON.actions[i]);
        }
    };
    /**
     * Assigns the given function to the action with the given name. After this,
     * the function will be executed whenever the action with the given name is
     * triggered or when it is not triggered, depending on the value of the 'triggered'
     * parameter.
     * @param {String} actionName The name of the action for the function to be
     * associated with.
     * @param {Boolean} triggered The function will be executed whenever the trigger
     * state of the action is the same as this value.
     * @param {Function} actionFunction The function to be assigned to the triggered/
     * non-triggered state of the action.
     */
    Controller.prototype.setActionFunction = function (actionName, triggered, actionFunction) {
        if (this._actions[actionName]) {
            if (triggered === true) {
                this._actions[actionName].setExecuteTriggered(actionFunction);
            } else {
                this._actions[actionName].setExecuteNonTriggered(actionFunction);
            }
        } else {
            application.showError("Attempting to initialize action '" + actionName + "', but no such action was defined " +
                    "for '" + this.getType() + "' type controllers.", "severe", "The action definition might be missing from the " +
                    "settings file, or the settings file has not been loaded properly. The game is still playable, " +
                    "but this action will not work until the error with the settings file is corrected and the game " +
                    "is restarted.");
        }
    };
    /**
     * Associates the given function to the on and off trigger states of the action
     * with the given name
     * @param {String} actionName The name of the action for the functions to be
     * associated with.
     * @param {Function} functionWhenTriggered The function to execute when the
     * action is triggered.
     * @param {Function} functionWhenNotTriggered The function to execute when the
     * action is not triggered.
     */
    Controller.prototype.setActionFunctions = function (actionName, functionWhenTriggered, functionWhenNotTriggered) {
        this.setActionFunction(actionName, true, functionWhenTriggered);
        this.setActionFunction(actionName, false, functionWhenNotTriggered);
    };
    /**
     * Executes the list of passed actions. If an action is passed more times, this
     * will still execute it only once.
     * @param {Object[][]} triggeredActions The grouped lists of actions in the form of objects
     * where the 'name' (String) property identifies the name of the action and the
     * (optional) 'intensity' (Number) property determines the intensity with which
     * the action is to be executed. Actions that have been triggered by the same controls should
     * be grouped together, and therefore this method expects an array of arrays.
     */
    Controller.prototype.executeActions = function (triggeredActions) {
        var i, j, actionName, actionIntensity;
        // first we go through the groups of actions
        for (i = 0; i < triggeredActions.length; i++) {
            // in each group, if there are multiple actions that this controller can handle then choose the one with the highest intensity
            // e.g. movement or turning in opposite directions can appear here together if bound to the same axis, but one will have an
            // intensity of 0
            actionName = null;
            actionIntensity = -1;
            for (j = 0; j < triggeredActions[i].length; j++) {
                if (this._actions[triggeredActions[i][j].name] !== undefined) {
                    // non-graded (undefined) intensity always beets the graded ones
                    if (((triggeredActions[i][j].intensity !== undefined) && (actionIntensity !== undefined) && (triggeredActions[i][j].intensity > actionIntensity)) ||
                            ((actionIntensity !== undefined) && (triggeredActions[i][j].intensity === undefined))) {
                        actionName = triggeredActions[i][j].name;
                        actionIntensity = triggeredActions[i][j].intensity;
                    }
                }
            }
            // if an action was chosen, set its trigger, but only if it has a non-zero intensity - e.g. turning in opposite directions can
            // both appear as 0 intensity actions (if bound to the same axis), to indicate that the axis is occupied with those actions even
            // if no turning has been triggered at the moment - this is why here this action group is cleared here anyway, to ensure that lower
            // priority controllers will not receive their conflicting actions from the same group
            if (actionName) {
                if ((actionIntensity === undefined) || (actionIntensity > 0)) {
                    this._actions[actionName].setTriggered(true, actionIntensity);
                }
                triggeredActions[i] = [];
            }
        }
        // Execute all the stored actions, each exactly once.
        for (actionName in this._actions) {
            if (this._actions.hasOwnProperty(actionName)) {
                this._actions[actionName].execute();
            }
        }
    };
    // #########################################################################
    /**
     * @class A control context holds interpreter objects that translate the user 
     * input coming from different devices (such as keyboard or mouse) into actions,
     * and the controllers that can process those actions and execute the appropriate
     * methods of in-game entities they control.
     * @extends AsyncResource
     */
    function ControlContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * The JSON object wich stores the control settings.
         * @type Object
         */
        this._dataJSON = null;
        /**
         * An associative array storing the input interpreter constructor functions of the recognized interpreter types that
         * can be initialized from JSON by this context. The keys are the names by which the interpreter type has to be referred to
         * in the JSON object.
         * @type Object.<String, Function>
         */
        this._inputInterpreterTypes = {};
        /**
         * The array of input interpreters wich collect the user input from different
         * devices (each interpreter is capable of querying one device) and translate
         * them into actions that can be processed by the controllers.
         * @type InputInterpreter[]
         */
        this._inputInterpreters = null;
        /**
         * An associative array of the stored input interpreters organized by a string representation of their types so that
         * they can be accessed by it quickly.
         * @type Object.<String, InputInterpreter>
         */
        this._inputInterpretersByType = {};
        /**
         * An associative array storing the controller constructor functions of the recognized controller types that
         * can be loaded from JSON by this context. The keys are the names by which the controller type has to be referred to
         * in the JSON object.
         * @type Object.<String, Function>
         */
        this._controllerTypes = {};
        /**
         * The list of controllers, which control various entities found in the game.
         * @type Controller[]
         */
        this._controllers = null;
        /**
         * Has the same references to controllers as the _controllers field, but in the current priority order (when multiple actions are
         * triggered by the same controls, the action of the controller coming first in the priority queue will be executed)
         * @type Controller[]
         */
        this._controllersPriorityQueue = null;
        /**
         * An associative array of the stored controllers organized by a string representation of their types so that
         * they can be accessed by it quickly.
         * @type Object.<String, Controller>
         */
        this._controllersByType = {};
        /**
         * Whether the control context is currently listening for user input (through
         * its interpreter objects).
         * @type Boolean
         */
        this._listening = false;
        /**
         * Associative array of the names of disabled actions. The action names are
         * the keys, and if the corresponding action is disabled, the value is true.
         * Disabled actions are not passed to the controllers for processing, even
         * if they would be triggered user input.
         * @type Object
         */
        this._disabledActions = {};
    }
    ControlContext.prototype = new asyncResource.AsyncResource();
    ControlContext.prototype.constructor = ControlContext;
    /**
     * Registers the input interpreter constructor function of the given intepreter type so that from this point on interpreter of such type
     * can be added or initialized from JSON when loading this context. The interpreter type has to be identified by the same name
     * in the JSON as given here.
     * @param {String} inputInterpreterTypeName
     * @param {Function} inputInterpreterTypeConstructor
     */
    ControlContext.prototype.registerInputInterpreterType = function (inputInterpreterTypeName, inputInterpreterTypeConstructor) {
        this._inputInterpreterTypes[inputInterpreterTypeName] = inputInterpreterTypeConstructor;
    };
    /**
     * Adds a new input interpreter to the list of interpreters that are used to
     * collect user input from supported devices and translate it to action name /
     * intensity pairs. It is only allowed to add interpreters of previously registered
     * types.
     * @param {InputInterpreter} inputInterpreter
     */
    ControlContext.prototype.addInputInterpreter = function (inputInterpreter) {
        var interpreterTypeName = utils.getKeyOfValue(this._inputInterpreterTypes, inputInterpreter.constructor);
        if (interpreterTypeName) {
            this._inputInterpreters.push(inputInterpreter);
            // saving another reference for easier access
            this._inputInterpretersByType[interpreterTypeName] = inputInterpreter;
        } else {
            application.showError("Attempting to add an input interpreter of an unregistered type to the control context!", "severe", "Interpreter type: " + inputInterpreter.constructor.name);
        }
    };
    /**
     * Returns the list of current input interpreters.
     * @returns {InputInterpreter[]}
     */
    ControlContext.prototype.getInputInterpreters = function () {
        return this._inputInterpreters;
    };
    /**
     * Returns the stored intepreter of the given type. (indicating the input device)
     * @param {String} interpreterTypeName The same name that was used when registering this type 
     * @return {InputInterpreter}
     */
    ControlContext.prototype.getInputInterpreter = function (interpreterTypeName) {
        if (this._inputInterpretersByType[interpreterTypeName]) {
            return this._inputInterpretersByType[interpreterTypeName];
        }
        application.showError("Asked for a interpreter of type '" + interpreterTypeName + "', which does not exist!");
        return null;
    };
    /**
     * Registers the constructor function of the given controller type so that from this point on controllers of such type
     * can be added or initialized from JSON when loading this context. The controller type has to be identified by the same name
     * in the JSON as given here.
     * @param {String} controllerTypeName
     * @param {Function} controllerTypeConstructor
     */
    ControlContext.prototype.registerControllerType = function (controllerTypeName, controllerTypeConstructor) {
        this._controllerTypes[controllerTypeName] = controllerTypeConstructor;
    };
    /**
     * Adds a new controller to the list of controllers that are used to process actions translated by the input interpreters. 
     * It is only allowed to add controllers of previously registered types.
     * @param {Controller} controller
     */
    ControlContext.prototype.addController = function (controller) {
        var controllerTypeName = utils.getKeyOfValue(this._controllerTypes, controller.constructor);
        if (controllerTypeName) {
            this._controllers.push(controller);
            // saving another reference for easier access
            this._controllersByType[controllerTypeName] = controller;
            controller.setContext(this);
        } else {
            application.showError("Attempting to add a controller of an unregistered type to the control context!", "severe", "Controller type: " + controller.prototype.constructor.name);
        }
    };
    /**
     * Returns the list of all controllers stored in the control context. This can
     * be used to display the available controls for all controllers on the control
     * settings screen.
     * @returns {Controller[]}
     */
    ControlContext.prototype.getControllers = function () {
        return this._controllers;
    };
    /**
     * Returns the stored controller of the given type.
     * @param {String} controllerTypeName The same name that was used when registering this type 
     * @return {Controller}
     */
    ControlContext.prototype.getController = function (controllerTypeName) {
        if (this._controllersByType[controllerTypeName]) {
            return this._controllersByType[controllerTypeName];
        }
        application.showError("Asked for a controller of type '" + controllerTypeName + "', which does not exist!");
        return null;
    };
    /**
     * Makes the passed controller the first in the priority queue, so that if one control would trigger actions of two different 
     * controllers, one of them being the passed controller, the action belonging to it will be executed. Can only be used with controllers
     * that have been previously added to the context, calling it with a different controller will have no effect. The other controllers
     * remain in the default priority order.
     * @param {Controller} controller
     */
    ControlContext.prototype.makeControllerPriority = function (controller) {
        var i;
        this._controllersPriorityQueue = [];
        for (i = 0; i < this._controllers.length; i++) {
            if (this._controllers[i] === controller) {
                this._controllersPriorityQueue.push(this._controllers[i]);
                break;
            }
        }
        for (i = 0; i < this._controllers.length; i++) {
            if (this._controllers[i] !== controller) {
                this._controllersPriorityQueue.push(this._controllers[i]);
            }
        }
    };
    /**
     * Resets the default priority order of the stored controllers (the order in which they were added).
     */
    ControlContext.prototype.restoreDefaultControllerPriorityOrder = function () {
        this._controllersPriorityQueue = this._controllers;
    };
    /**
     * Disables the action with the given name. While disabled, this action will not
     * be passed to the controllers for processing, even if user input would trigger
     * it.
     * @param {String} actionName
     */
    ControlContext.prototype.disableAction = function (actionName) {
        this._disabledActions[actionName] = true;
    };
    /**
     * Enables the action with the given name.
     * @param {String} actionName
     */
    ControlContext.prototype.enableAction = function (actionName) {
        this._disabledActions[actionName] = false;
    };
    /**
     * Executes the main control flow: gathers all the triggered and non-disabled 
     * actions translated  by the stored input interpreters and processes them using 
     * all stored controllers.
     */
    ControlContext.prototype.control = function () {
        var
                i,
                triggeredActions,
                actionFilterFunction = function (actionName) {
                    return !this._disabledActions[actionName];
                }.bind(this);
        if (this._listening) {
            triggeredActions = [];
            for (i = 0; i < this._inputInterpreters.length; i++) {
                triggeredActions = triggeredActions.concat(this._inputInterpreters[i].getTriggeredActions(actionFilterFunction));
            }
            for (i = 0; i < this._controllersPriorityQueue.length; i++) {
                this._controllersPriorityQueue[i].executeActions(triggeredActions);
            }
        }
    };
    /**
     * Loads the control configuration (the controllers) stored in a JSON object.
     * @param {Object} dataJSON The JSON object that stores the control settings.
     */
    ControlContext.prototype.loadConfigurationFromJSON = function (dataJSON) {
        var i, n;
        this._controllers = [];
        for (i = 0, n = dataJSON.controllers.length; i < n; i++) {
            if (this._controllerTypes[dataJSON.controllers[i].type]) {
                this.addController(new this._controllerTypes[dataJSON.controllers[i].type](dataJSON.controllers[i]));
            } else {
                application.showError("Attempting to load unregistered controller type: '" + dataJSON.controllers[i].type + "'!",
                        "severe",
                        (Object.keys(this._controllerTypes).length > 0) ?
                        ("Every controller to be loaded must be of one of the registered types: " + Object.keys(this._controllerTypes).join(", ") + ".") :
                        "There are no types registered and thus loading controllers is not possible.");
            }
        }
        this._controllersPriorityQueue = this._controllers;
    };
    /**
     * Loads the control settings (input interpreters with bindings) stored in a JSON object.
     * @param {Object} dataJSON The JSON object that stores the control settings.
     * @param {Boolean} [onlyRestoreSettings=false] Whether to only restore the
     * default settings by overwriting the changed ones from the data in the JSON,
     * or to initialize the whole context from zero, creating all the necessary
     * objects.
     */
    ControlContext.prototype.loadSettingsFromJSON = function (dataJSON, onlyRestoreSettings) {
        var i, n;
        // if a whole new initialization is needed, create and load all controllers
        // and interpreters from the JSON
        if (!onlyRestoreSettings) {
            this._dataJSON = dataJSON;
            this._inputInterpreters = [];
            for (i = 0, n = dataJSON.inputDevices.length; i < n; i++) {
                if (this._inputInterpreterTypes[dataJSON.inputDevices[i].type]) {
                    this.addInputInterpreter(new this._inputInterpreterTypes[dataJSON.inputDevices[i].type](dataJSON.inputDevices[i]));
                } else {
                    application.showError("Attempting to load unregistered input device type: '" + dataJSON.inputDevices[i].type + "'!",
                            "severe",
                            (Object.keys(this._inputInterpreterTypes).length > 0) ?
                            ("Every input device interpreter to be loaded must be of one of the registered types: " + Object.keys(this._inputInterpreterTypes).join(", ") + ".") :
                            "There are no types registered and thus loading input interpreters is not possible.");
                }
            }
            // if only the defaults need to be restored, go through the stored interpreters 
            // and delete their custom bindings as well as reload their default from the JSON
        } else {
            for (i = 0, n = dataJSON.inputDevices.length; i < n; i++) {
                this._inputInterpreters[i].removeFromLocalStorage();
                this._inputInterpreters[i].loadFromJSON(dataJSON.inputDevices[i]);
            }
        }
    };
    /**
     * Load custom settings for the stored input interpreters from HTML5 local storage.
     */
    ControlContext.prototype.loadSettingsFromLocalStorage = function () {
        var i;
        for (i = 0; i < this._inputInterpreters.length; i++) {
            this._inputInterpreters[i].loadFromLocalStorage();
        }
        this.setToReady();
    };
    /**
     * Restore the default settings stored in the JSON object from where they were originally
     * loaded.
     */
    ControlContext.prototype.restoreDefaults = function () {
        this.loadSettingsFromJSON(this._dataJSON, true);
    };
    /**
     * Activate all event handlers that listen for user inputs for each stored input
     * interpreter.
     */
    ControlContext.prototype.startListening = function () {
        this.executeWhenReady(function () {
            var i;
            for (i = 0; i < this._inputInterpreters.length; i++) {
                this._inputInterpreters[i].startListening();
            }
            this._listening = true;
        });
    };
    /**
     * Cancel all event handlers that listen for user input for each stored input
     * interpreter.
     */
    ControlContext.prototype.stopListening = function () {
        this.executeWhenReady(function () {
            var i;
            for (i = 0; i < this._inputInterpreters.length; i++) {
                this._inputInterpreters[i].stopListening();
            }
            this._listening = false;
        });
    };
    /**
     * Sets the screen center to the given coordinates for all input interpreters
     * that need this data (e.g. mouse control interpreter for control based on relative 
     * pointer position)
     * @param {Number} x The X coordinate of the center.
     * @param {Number} y The Y coordinate of the center.
     */
    ControlContext.prototype.setScreenCenter = function (x, y) {
        this.executeWhenReady(function () {
            var i;
            for (i = 0; i < this._inputInterpreters.length; i++) {
                if (this._inputInterpreters[i].setScreenCenter) {
                    this._inputInterpreters[i].setScreenCenter(x, y);
                }
            }
        });
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        setModulePrefix: setModulePrefix,
        ControlBinding: ControlBinding,
        KeyBinding: KeyBinding,
        KeyboardInputInterpreter: KeyboardInputInterpreter,
        MouseBinding: MouseBinding,
        MouseInputInterpreter: MouseInputInterpreter,
        GamepadBinding: GamepadBinding,
        GamepadInputInterpreter: GamepadInputInterpreter,
        Controller: Controller,
        ControlContext: ControlContext
    };
});
