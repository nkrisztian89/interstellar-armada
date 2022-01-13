/**
 * Copyright 2014-2018, 2020-2022 Krisztián Nagy
 * @file Provides an input interpreter subclass (based on the base class provided by the generic control module) to
 * catch and process input from the keyboard.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for the keycode utility function
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
            SHIFT_CODE = 16,
            CTRL_CODE = 17,
            ALT_CODE = 18,
            CONTROL_STRING_COMBINE = " + ",
            KEY_SUFFIX = "_key",
            SHIFT_STATE_SUFFIX = "_shift",
            CTRL_STATE_SUFFIX = "_ctrl",
            ALT_STATE_SUFFIX = "_alt",
            // ----------------------------------------------------------------------
            // string definitions for translation of control strings
            KEY_STRING_PREFIX = {name: "key" + strings.CATEGORY_SEPARATOR},
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
     * @class Represents a key (combination) - action association.
     * @extends ControlBinding
     * @param {Object} [dataJSON] If a string is given, it will
     * be taken as the name of the action to be assigned. Otherwise it is taken as
     * a JSON object storing all the properties.
     * @param {String} [profileName] The name of the input profile this binding
     * belongs to
     */
    function KeyBinding(dataJSON, profileName) {
        /**
         * The string representation of the key. 
         * @see KeyboardInputInterpreter#getKeyCodeTable
         * @type String
         */
        this._key = null;
        /**
         * The key code of the key, same as passed in the keyCode property of the event
         * argument of key event handlers.
         * @type Number
         */
        this._keyCode = 0;
        /**
         * Whether shift should be pressed in this key combination (next to _key being pressed).
         * @type Boolean
         */
        this._shiftState = false;
        /**
         * Whether ctrl should be pressed in this key combination (next to _key being pressed).
         * @type Boolean
         */
        this._ctrlState = false;
        /**
         * Whether alt should be pressed in this key combination (next to _key being pressed).
         * @type Boolean
         */
        this._altState = false;
        control.ControlBinding.call(this, dataJSON, profileName);
        application.log_DEBUG("Created key binding: " + this._actionName + " - " + this.getControlString(), 3);
    }
    KeyBinding.prototype = new control.ControlBinding();
    KeyBinding.prototype.constructor = KeyBinding;
    /**
     * @override
     * Loads the properties of the key binding as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    KeyBinding.prototype.loadFromJSON = function (dataJSON) {
        control.ControlBinding.prototype.loadFromJSON.call(this, dataJSON);
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
        control.InputInterpreter.call(this, KeyBinding, dataJSON);
        /**
         * An array indicating the current pressed state of each key on the keyboard. 
         * The index in the array corresponds to the keyCode property of the event 
         * argument of the key event handlers.
         * @type Boolean[256]
         */
        this._currentlyPressedKeys = new Array(256);
    }
    KeyboardInputInterpreter.prototype = new control.InputInterpreter();
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
     * @override
     * Updates the internally stored state of the keyboard, marking all keys as non-pressed.
     */
    KeyboardInputInterpreter.prototype.resetState = function () {
        var i;
        for (i = 0; i < this._currentlyPressedKeys.length; i++) {
            this._currentlyPressedKeys[i] = false;
        }
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
        control.InputInterpreter.prototype.startListening.call(this);
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
        control.InputInterpreter.prototype.stopListening.call(this);
        document.onkeydown = null;
        document.onkeyup = null;
        document.onkeypress = null;
    };
    /**
     * @override
     * Checks if the action with the supplied name is triggered based on the current input state.
     * @param {String} actionName
     * @returns {(ActionTrigger|null)} Null, if the action is not triggered
     */
    KeyboardInputInterpreter.prototype.checkAction = function (actionName) {
        return (this._currentProfile[actionName].isTriggered(this._currentlyPressedKeys)) ?
                {name: actionName, source: this} :
                null;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        setModulePrefix: setModulePrefix,
        KeyboardInputInterpreter: KeyboardInputInterpreter
    };
});
