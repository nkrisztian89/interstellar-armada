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
 * 
 * @param utils Used for the keycode utility functions
 * @param application Used for logging and error displaying functionality
 * @param asyncResource ControlContext is a subclass of AsyncResource
 * @param armada GeneralController accesses global game functionality
 */
define([
    "utils/utils",
    "modules/application",
    "modules/async-resource",
    "armada/armada"
], function (utils, application, asyncResource, armada) {
    "use strict";
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
        this._shiftState = (shiftState === undefined) ? false : (shiftState || (this._key === "shift"));
        /**
         * Whether ctrl should be pressed in this key combination (next to _key being pressed).
         * @type Boolean
         */
        this._ctrlState = (ctrlState === undefined) ? false : (ctrlState || (this._key === "ctrl"));
        /**
         * Whether alt should be pressed in this key combination (next to _key being pressed).
         * @type Boolean
         */
        this._altState = (altState === undefined) ? false : (altState || (this._key === "alt"));
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
        this._shiftState = (dataJSON.shift === true) || (this._key === "shift");
        this._ctrlState = (dataJSON.ctrl === true) || (this._key === "ctrl");
        this._altState = (dataJSON.alt === true) || (this._key === "alt");
    };
    /**
     * @override
     * Saves the properties of this key binding to HTML5 local storage.
     */
    KeyBinding.prototype.saveToLocalStorage = function () {
        localStorage['interstellarArmada_control_' + this._actionName + '_key'] = this._key;
        localStorage['interstellarArmada_control_' + this._actionName + '_shift'] = this._shiftState;
        localStorage['interstellarArmada_control_' + this._actionName + '_ctrl'] = this._ctrlState;
        localStorage['interstellarArmada_control_' + this._actionName + '_alt'] = this._altState;
    };
    /**
     * @override
     * Loads the properties of the key binding if they are stored in the HTML5 local
     * storage object.
     */
    KeyBinding.prototype.loadFromLocalStorage = function () {
        if (localStorage['interstellarArmada_control_' + this._actionName + '_key'] !== undefined) {
            this.setKey(localStorage['interstellarArmada_control_' + this._actionName + '_key']);
            this._shiftState = (localStorage['interstellarArmada_control_' + this._actionName + '_shift'] === "true");
            this._ctrlState = (localStorage['interstellarArmada_control_' + this._actionName + '_ctrl'] === "true");
            this._altState = (localStorage['interstellarArmada_control_' + this._actionName + '_alt'] === "true");
        }
    };
    /**
     * @override
     * Removes the properties of this key binding from the HTML5 local storage.
     */
    KeyBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_key');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_shift');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_ctrl');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_alt');
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
        var result;
        result = this._key;
        if (this._shiftState && (this._key !== "shift")) {
            result = "shift + " + result;
        }
        if ((this._ctrlState) && (this._key !== "ctrl")) {
            result = "ctrl + " + result;
        }
        if ((this._altState) && (this._key !== "alt")) {
            result = "alt + " + result;
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
                (currentlyPressedKeys[16] || !this._shiftState) &&
                (currentlyPressedKeys[17] || !this._ctrlState) &&
                (currentlyPressedKeys[18] || !this._altState));
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
        return "Keyboard";
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
        this._button = 0;
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
         * -1: movement downward
         * 1: movement upward
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
        switch (dataJSON.button) {
            case "left":
                this._button = 1;
                break;
            case "middle":
                this._button = 2;
                break;
            case "right":
                this._button = 3;
                break;
            default:
                this._button = 0;
        }
        this._moveX = 0;
        this._moveY = 0;
        switch (dataJSON.move) {
            case "left":
                this._moveX = -1;
                break;
            case "right":
                this._moveX = 1;
                break;
            case "up":
                this._moveY = -1;
                break;
            case "down":
                this._moveY = 1;
                break;
        }
        this._measuredFromCenter = (dataJSON.fromCenter === true);
    };
    /**
     * @override
     * Saves the properties of this mouse binding to HTML5 local storage.
     */
    MouseBinding.prototype.saveToLocalStorage = function () {
        localStorage['interstellarArmada_control_' + this._actionName + '_button'] = this._button;
        localStorage['interstellarArmada_control_' + this._actionName + '_moveX'] = this._moveX;
        localStorage['interstellarArmada_control_' + this._actionName + '_moveY'] = this._moveY;
        localStorage['interstellarArmada_control_' + this._actionName + '_measuredFromCenter'] = this._measuredFromCenter;
    };
    /**
     * @override
     * Loads the properties of the mouse binding if they are stored in the HTML5 local
     * storage object.
     */
    MouseBinding.prototype.loadFromLocalStorage = function () {
        if (localStorage['interstellarArmada_control_' + this._actionName + '_button'] !== undefined) {
            this._button = parseInt(localStorage['interstellarArmada_control_' + this._actionName + '_button'], 10);
            this._moveX = parseInt(localStorage['interstellarArmada_control_' + this._actionName + '_moveX'], 10);
            this._moveY = parseInt(localStorage['interstellarArmada_control_' + this._actionName + '_moveY'], 10);
            this._measuredFromCenter = (localStorage['interstellarArmada_control_' + this._actionName + '_measuredFromCenter'] === "true");
        }
    };
    /**
     * @override
     * Removes the properties of this mouse binding from the HTML5 local storage.
     */
    MouseBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_button');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_moveX');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_moveY');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_measuredFromCenter');
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
        switch (this._button) {
            case 1:
                return "left click";
            case 2:
                return "middle click";
            case 3:
                return "right click";
        }
        var result = this._measuredFromCenter ? " from center" : "";
        if (this._moveX < 0) {
            result = "move left" + result;
        } else if (this._moveX > 0) {
            result = "move right" + result;
        } else if (this._moveY < 0) {
            result = "move up" + result;
        } else if (this._moveY > 0) {
            result = "move down" + result;
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
     * @returns {Number} Whether the action was triggerend and with what intensity.
     * Zero means the action was not triggered, a positive value represents the 
     * intensity.
     */
    MouseBinding.prototype.getTriggeredIntensity = function (currentlyPressedButtons, mousePosition, mousePositionChange, screenCenter) {
        var relativeX, relativeY;
        // first if this is a button assignment, check the state of the appropriate
        // mouse button
        if (this._button > 0) {
            return (currentlyPressedButtons[this._button] === true) ? 1 : -1;
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
    };
    /**
     * @override
     * Returns whether this binding has the same control (button/axis) configuration as the passed one (and so it conflicts with it)
     * @param {MouseBinding} otherMouseBinding
     */
    MouseBinding.prototype.bindsTheSameControls = function (otherMouseBinding) {
        return (this._button === otherMouseBinding._button) &&
                (((this._moveX === 0) && (otherMouseBinding._moveX === 0)) || ((this._moveX * otherMouseBinding._moveX) !== 0)) &&
                (((this._moveY === 0) && (otherMouseBinding._moveY === 0)) || ((this._moveY * otherMouseBinding._moveY) !== 0));
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
    MouseInputInterpreter.prototype.constructor = InputInterpreter;
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
    };
    /**
     * @override
     * Returns of the name of the device this interpreter monitors. Every input
     * interpreter should implement this function.
     * @returns {String}
     */
    MouseInputInterpreter.prototype.getDeviceName = function () {
        return "Mouse";
    };
    /**
     * Sets the mouse move sensitivity and stores the setting in HTML5 local storage.
     * @param {Number} moveSensitivity
     */
    MouseInputInterpreter.prototype.setAndStoreMoveSensitivity = function (moveSensitivity) {
        this._moveSensitivity = moveSensitivity;
        localStorage.interstellarArmada_control_mouse_moveSensitivity = this._moveSensitivity;
    };
    /**
     * Sets the mouse displacement sensitivity and stores the setting in HTML5 local storage.
     * @param {Number} displacementSensitivity
     */
    MouseInputInterpreter.prototype.setAndStoreDisplacementSensitivity = function (displacementSensitivity) {
        this._displacementSensitivity = displacementSensitivity;
        localStorage.interstellarArmada_control_mouse_displacementSensitivity = this._displacementSensitivity;
    };
    /**
     * Sets the mouse displacement deadzone and stores the setting in HTML5 local storage.
     * @param {Number} displacementDeadzone
     */
    MouseInputInterpreter.prototype.setAndStoreDisplacementDeadzone = function (displacementDeadzone) {
        this._displacementDeadzone = displacementDeadzone;
        localStorage.interstellarArmada_control_mouse_displacementDeadzone = this._displacementDeadzone;
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
        if (localStorage.interstellarArmada_control_mouse_moveSensitivity !== undefined) {
            this._moveSensitivity = parseFloat(localStorage.interstellarArmada_control_mouse_moveSensitivity);
        }
        if (localStorage.interstellarArmada_control_mouse_displacementSensitivity !== undefined) {
            this._displacementSensitivity = parseFloat(localStorage.interstellarArmada_control_mouse_displacementSensitivity);
        }
        if (localStorage.interstellarArmada_control_mouse_displacementDeadzone !== undefined) {
            this._displacementDeadzone = parseInt(localStorage.interstellarArmada_control_mouse_displacementDeadzone, 10);
        }
    };
    /**
     * @override
     * Removes custom mouse bindings stored in HTML5 local storage.
     */
    MouseInputInterpreter.prototype.removeFromLocalStorage = function () {
        InputInterpreter.prototype.removeFromLocalStorage.call(this);
        localStorage.removeItem("interstellarArmada_control_mouse_moveSensitivity");
        localStorage.removeItem("interstellarArmada_control_mouse_displacementSensitivity");
        localStorage.removeItem("interstellarArmada_control_mouse_displacementDeadzone");
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
        document.onclick = null;
        document.oncontextmenu = null;
        this.cancelPressedButtons();
        this._mousePosition = null;
        this._mousePositionChange = [0, 0];
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
                this._screenCenter);
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
        localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_button'] = this._button;
        localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_axisIndex'] = this._axisIndex;
        localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_axisPositive'] = this._axisPositive;
    };
    /**
     * @override
     * Loads the properties of the binding if they are stored in the HTML5 local
     * storage object.
     */
    GamepadBinding.prototype.loadFromLocalStorage = function () {
        if (localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_button'] !== undefined) {
            this._button = parseInt(localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_axisIndex'], 10);
            this._axisIndex = parseInt(localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_button'], 10);
            this._axisPositive = (localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_axisPositive'] === "true");
        }
    };
    /**
     * @override
     * Removes the properties of this binding from the HTML5 local storage.
     */
    GamepadBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_gamepad_button');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_gamepad_axisIndex');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_gamepad_axisPositive');
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
            return "button " + this._button;
        }
        if (this._axisIndex !== this.AXIS_NONE) {
            return "axis " + this._axisIndex + " " + (this._axisPositive ? "positive" : "negative");
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
         * Used for yaw, pitch, roll
         * @type Number
         */
        this._turnSensitivity = 1;
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
        return "Joystick";
    };
    /**
     * @override
     * Loads the properties of the interpreter such as the (default) gamepad bindings
     * from the passed JSON object.
     * @param {Object} dataJSON
     */
    GamepadInputInterpreter.prototype.loadFromJSON = function (dataJSON) {
        InputInterpreter.prototype.loadFromJSON.call(this, dataJSON);
        this._turnSensitivity = dataJSON.sensitivityProfile.turnSensitivity;
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
        var actionIntensity, isTurnAction, isCameraTurnAction;
        actionIntensity = this._bindings[actionName].getTriggeredIntensity(this._gamepad);
        if (actionIntensity > 0) {
            isTurnAction =
                    (actionName === "yawLeft" || actionName === "yawRight" ||
                            actionName === "pitchUp" || actionName === "pitchDown" ||
                            actionName === "rollLeft" || actionName === "rollRight");
            isCameraTurnAction =
                    (actionName === "cameraTurnLeft" || actionName === "cameraTurnRight" ||
                            actionName === "cameraTurnUp" || actionName === "cameraTurnDown" ||
                            actionName === "cameraRollLeft" || actionName === "cameraRollRight");
            return {
                name: actionName,
                intensity: (isTurnAction ? (actionIntensity * this._turnSensitivity) : (isCameraTurnAction ? undefined : actionIntensity))
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
     * @returns {Action}
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
     * Creates a controller object.
     * @class The superclass for all controllers. A controller is responsible for
     * processing triggered actions sent by the input interpreters and applying
     * them to the domain (entity) it is controlling. Controllers for different
     * domains are implemented as the subclasses for this class.
     * @param {Object} [dataJSON] If given, the properties will be initialized loading
     * the data from this JSON object
     * @returns {Controller}
     */
    function Controller(dataJSON) {
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
     * Creates a general controller object.
     * @class The general controller processes and executes the actions that are related
     * to general game control during a battle, (such as 'pause' or 'quit') and not 
     * associated with any particular object.
     * @param {Object} dataJSON The JSON object which contains the data to load the properties
     * of the recognized actions from.
     * @returns {GeneralController}
     */
    function GeneralController(dataJSON) {
        Controller.call(this, dataJSON);
        /**
         * The level which this controller controls.
         * @type Level
         */
        this._level = null;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should be have been created by now.
        // quitting to the menu
        this.setActionFunction("quit", true, function () {
            armada.getScreen().pauseBattle();
            armada.setScreen("ingameMenu", true, [64, 64, 64], 0.5);
        });
        // pausing the game
        this.setActionFunction("pause", true, function () {
            // showing an info box automatically pauses the game as implemented in
            // the BattleScreen class
            armada.getScreen().showMessage("Game paused.");
        });
        this.setActionFunction("stopTime", true, function () {
            armada.getScreen().toggleTime();
        });
        // switching to pilot mode
        this.setActionFunction("switchToPilotMode", true, function () {
            armada.control().switchToPilotMode(this._level.getPilotedSpacecraft());
        }.bind(this));
        // switching to spectator mode
        this.setActionFunction("switchToSpectatorMode", true, function () {
            armada.control().switchToSpectatorMode(true);
        });
        // toggling the visibility of hitboxes
        this.setActionFunction("toggleHitboxVisibility", true, function () {
            this._level.toggleHitboxVisibility();
        }.bind(this));
        // toggling the visibility of texts on screen
        this.setActionFunction("toggleTextVisibility", true, function () {
            armada.getScreen().toggleTextVisibility();
        });
        // toggling the mouse controls
        this.setActionFunction("toggleMouseControls", true, function () {
            armada.control().getInterpreter("mouse").toggleEnabled();
            if (armada.control().isInPilotMode()) {
                if (armada.control().getInterpreter("mouse").isEnabled()) {
                    document.body.style.cursor = 'crosshair';
                } else {
                    document.body.style.cursor = 'default';
                }
            }
        });
        // toggling the joystick controls
        this.setActionFunction("toggleJoystickControls", true, function () {
            armada.control().getInterpreter("joystick").toggleEnabled();
        });
    }
    GeneralController.prototype = new Controller();
    GeneralController.prototype.constructor = GeneralController;
    /**
     * Returns the string representation of the type (domain) of the controller.
     * This will be shown to users on the control settings page, which groups controls
     * based on domains.
     * @returns {String}
     */
    GeneralController.prototype.getType = function () {
        return "General";
    };
    /**
     * Sets the controlled level to the one passed as parameter.
     * @param {Level} level
     */
    GeneralController.prototype.setLevel = function (level) {
        this._level = level;
    };
    // #########################################################################
    /**
     * Creates a fighter controller object.
     * @class The fighter controller pocesses and executes the actions with which
     * the user can control a space fighter.
     * @extends Controller
     * @param {Object} dataJSON The JSON object which contains the data to load the properties
     * of the recognized actions from.
     * @returns {FighterController}
     */
    function FighterController(dataJSON) {
        Controller.call(this, dataJSON);
        /**
         * A reference to the spacecraft (fighter) which this controller controls.
         * @type Spacecraft
         */
        this._controlledSpacecraft = null;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should have been created
        // fire the primary weapons of the fighter
        this.setActionFunction("fire", true, function () {
            this._controlledSpacecraft.fire();
        }.bind(this));
        // changing flight mode (free or compensated)
        this.setActionFunction("changeFlightMode", true, function () {
            this._controlledSpacecraft.changeFlightMode();
        }.bind(this));
        // switch to next target
        this.setActionFunction("nextTarget", true, function () {
            this._controlledSpacecraft.targetNext();
        }.bind(this));
        // forward burn
        this.setActionFunctions("forward", function (i) {
            this._controlledSpacecraft.forward(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopForward();
        }.bind(this));
        // reverse burn
        this.setActionFunctions("reverse", function (i) {
            this._controlledSpacecraft.reverse(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopReverse();
        }.bind(this));
        // strafing to left and right
        this.setActionFunctions("strafeLeft", function (i) {
            this._controlledSpacecraft.strafeLeft(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopLeftStrafe();
        }.bind(this));
        this.setActionFunctions("strafeRight", function (i) {
            this._controlledSpacecraft.strafeRight(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopRightStrafe();
        }.bind(this));
        // strafing up and down
        this.setActionFunctions("raise", function (i) {
            this._controlledSpacecraft.raise(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopRaise();
        }.bind(this));
        this.setActionFunctions("lower", function (i) {
            this._controlledSpacecraft.lower(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopLower();
        }.bind(this));
        // resetting speed to 0
        this.setActionFunction("resetSpeed", true, function () {
            this._controlledSpacecraft.resetSpeed();
        }.bind(this));
        // turning along the 3 axes
        this.setActionFunction("yawLeft", true, function (i) {
            this._controlledSpacecraft.yawLeft(i);
        }.bind(this));
        this.setActionFunction("yawRight", true, function (i) {
            this._controlledSpacecraft.yawRight(i);
        }.bind(this));
        this.setActionFunction("pitchUp", true, function (i) {
            this._controlledSpacecraft.pitchUp(i);
        }.bind(this));
        this.setActionFunction("pitchDown", true, function (i) {
            this._controlledSpacecraft.pitchDown(i);
        }.bind(this));
        this.setActionFunction("rollLeft", true, function (i) {
            this._controlledSpacecraft.rollLeft(i);
        }.bind(this));
        this.setActionFunction("rollRight", true, function (i) {
            this._controlledSpacecraft.rollRight(i);
        }.bind(this));
    }
    FighterController.prototype = new Controller();
    FighterController.prototype.constructor = FighterController;
    /**
     * Returns the string representation of the type (domain) of the controller.
     * This will be shown to users on the control settings page, which groups controls
     * based on domains.
     * @returns {String}
     */
    FighterController.prototype.getType = function () {
        return "Fighter";
    };
    /**
     * Sets the controlled spacecraft (fighter) for this controller. After called,
     * all controls will take effect on the spacecraft passed here as a parameter.
     * @param {Spacecraft} controlledSpacecraft
     */
    FighterController.prototype.setControlledSpacecraft = function (controlledSpacecraft) {
        this._controlledSpacecraft = controlledSpacecraft;
    };
    /**
     * Same as the method of the parent class, but with a check if there if there is
     * a controlled spacecraft present.
     * @param {Object[]} triggeredActions See {@link Controller#executeActions}
     */
    FighterController.prototype.executeActions = function (triggeredActions) {
        if (this._controlledSpacecraft) {
            if (!this._controlledSpacecraft.canBeReused()) {
                Controller.prototype.executeActions.call(this, triggeredActions);
            } else {
                this._controlledSpacecraft = null;
            }
        }
    };
    // #########################################################################
    /**
     * Creates a camera controller object.
     * @class The camera controller pocesses and executes the actions with which
     * the user can control the camera that is used to render the battle scene.
     * @extends Controller
     * @param {Object} dataJSON
     * @returns {CameraController}
     */
    function CameraController(dataJSON) {
        Controller.call(this, dataJSON);
        /**
         * A reference to the controlled camera object.
         * @type Camera
         */
        this._controlledCamera = null;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should have been created.
        this.setActionFunctions("controlCamera", function () {
            armada.control().makeControllerPriority(this);
        }.bind(this), function () {
            if (this._controlledCamera.getConfiguration().shouldAutoReset()) {
                this._controlledCamera.transitionToConfigurationDefaults();
            }
            armada.control().restoreDefaultControllerPriorityOrder();
        }.bind(this));
        // turning the camera in the four directions
        this.setActionFunctions("cameraTurnLeft", function (i) {
            this._controlledCamera.turnLeft(i);
        }.bind(this), function () {
            this._controlledCamera.stopLeftTurn();
        }.bind(this));
        this.setActionFunctions("cameraTurnRight", function (i) {
            this._controlledCamera.turnRight(i);
        }.bind(this), function () {
            this._controlledCamera.stopRightTurn();
        }.bind(this));
        this.setActionFunctions("cameraTurnUp", function (i) {
            this._controlledCamera.turnUp(i);
        }.bind(this), function () {
            this._controlledCamera.stopUpTurn();
        }.bind(this));
        this.setActionFunctions("cameraTurnDown", function (i) {
            this._controlledCamera.turnDown(i);
        }.bind(this), function () {
            this._controlledCamera.stopDownTurn();
        }.bind(this));
        this.setActionFunctions("cameraRollLeft", function (i) {
            this._controlledCamera.rollLeft(i);
        }.bind(this), function () {
            this._controlledCamera.stopLeftRoll();
        }.bind(this));
        this.setActionFunctions("cameraRollRight", function (i) {
            this._controlledCamera.rollRight(i);
        }.bind(this), function () {
            this._controlledCamera.stopRightRoll();
        }.bind(this));
        //moving the camera along the 3 axes
        this.setActionFunctions("cameraMoveLeft", function () {
            this._controlledCamera.moveLeft();
        }.bind(this), function () {
            this._controlledCamera.stopLeftMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveRight", function () {
            this._controlledCamera.moveRight();
        }.bind(this), function () {
            this._controlledCamera.stopRightMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveUp", function () {
            this._controlledCamera.moveUp();
        }.bind(this), function () {
            this._controlledCamera.stopUpMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveDown", function () {
            this._controlledCamera.moveDown();
        }.bind(this), function () {
            this._controlledCamera.stopDownMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveForward", function () {
            this._controlledCamera.moveForward();
        }.bind(this), function () {
            this._controlledCamera.stopForwardMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveBackward", function () {
            this._controlledCamera.moveBackward();
        }.bind(this), function () {
            this._controlledCamera.stopBackwardMove();
        }.bind(this));
        // zooming
        this.setActionFunction("cameraDecreaseFOV", true, function () {
            this._controlledCamera.decreaseFOV();
        }.bind(this));
        this.setActionFunction("cameraIncreaseFOV", true, function () {
            this._controlledCamera.increaseFOV();
        }.bind(this));
        // changing the view
        this.setActionFunction("nextView", true, function () {
            this._controlledCamera.changeToNextView();
        }.bind(this));
        this.setActionFunction("previousView", true, function () {
            this._controlledCamera.changeToPreviousView();
        }.bind(this));
        // following another object
        this.setActionFunction("followNext", true, function () {
            this._controlledCamera.followNextNode(true);
        }.bind(this));
        this.setActionFunction("followPrevious", true, function () {
            this._controlledCamera.followPreviousNode(true);
        }.bind(this));
        this.setActionFunction("resetView", true, function () {
            this._controlledCamera.transitionToConfigurationDefaults();
        }.bind(this));
    }
    CameraController.prototype = new Controller();
    CameraController.prototype.constructor = CameraController;
    /**
     * Returns the string representation of the type (domain) of the controller.
     * This will be shown to users on the control settings page, which groups controls
     * based on domains.
     * @returns {String}
     */
    CameraController.prototype.getType = function () {
        return "Camera";
    };
    /**
     * Sets the controlled camera for this controller. After called, all controls 
     * will take effect on the camera passed here as a parameter.
     * @param {Camera} controlledCamera
     */
    CameraController.prototype.setControlledCamera = function (controlledCamera) {
        this._controlledCamera = controlledCamera;
    };
    /**
     * Sets the controlled camera to follow the passed visual object from now on.
     * @param {Object3D} renderableObject
     */
    CameraController.prototype.setCameraToFollowObject = function (renderableObject) {
        this._controlledCamera.followObject(renderableObject, false);
    };
    /**
     * Sets the controlled camera to free control (not following any objects)
     */
    CameraController.prototype.setToFreeCamera = function () {
        this._controlledCamera.setToFreeCamera(false);
    };
    /**
     * Checks if there is a controlled camera set, and if there is one, executes the 
     * actions on the camera.
     * @param {Object[]} triggeredActions See {@link Controller#executeActions}
     */
    CameraController.prototype.executeActions = function (triggeredActions) {
        if (this._controlledCamera) {
            Controller.prototype.executeActions.call(this, triggeredActions);
        }
    };
    // #########################################################################
    /**
     * Creates a control context object.
     * @class A control context holds interpreter objects that translate the user 
     * input coming from different devices (such as keyboard or mouse) into actions,
     * and the controllers that can process those actions and execute the appropriate
     * methods of in-game entities they control.
     * @extends AsyncResource
     * @returns {ControlContext}
     */
    function ControlContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * The JSON object wich stores the control settings.
         * @type Object
         */
        this._dataJSON = null;
        /**
         * The array of input interpreters wich collect the user input from different
         * devices (each interpreter is capable of querying one device) and translate
         * them into actions that can be processed by the controllers.
         * @type (KeyboardInputInterpreter|MouseInputInterpreter)[]
         */
        this._inputInterpreters = null;
        /**
         * A reference to the keyboard input interpreter from the interpreter list 
         * for easier access.
         * @type KeyboardInputInterpreter
         */
        this._keyboardInterpreter = null;
        /**
         * A reference to the mouse input interpreter from the interpreter list 
         * for easier access.
         * @type MouseInputInterpreter
         */
        this._mouseInterpreter = null;
        /**
         * A reference to the gamepad/joystick input interpreter from the interpreter list 
         * for easier access.
         * @type GamepadInputInterpreter
         */
        this._joystickInterpreter = null;
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
         * Whether the control context is currently listening for user input (through
         * its interpreter objects).
         * @type Boolean
         */
        this._listening = false;
        /**
         * A reference to the general controller from the controller list for easier 
         * access.
         * @type GeneralController
         */
        this._generalController = null;
        /**
         * A reference to the fighter controller from the controller list for easier 
         * access.
         * @type FighterController
         */
        this._fighterController = null;
        /**
         * A reference to the camera controller from the controller list for easier 
         * access.
         * @type CameraController
         */
        this._cameraController = null;
        /**
         * Associative array of the names of disabled actions. The action names are
         * the keys, and if the corresponding action is disabled, the value is true.
         * Disabled actions are not passed to the controllers for processing, even
         * if they would be triggered user input.
         * @type Object
         */
        this._disabledActions = {};
        /**
         * Whether the context is currently in the mode for controlling a spacecraft as a pilot (as opposed to spectator mode, controlling
         * a free camera)
         * @type Boolean
         */
        this._pilotingMode = false;
    }
    ControlContext.prototype = new asyncResource.AsyncResource();
    ControlContext.prototype.constructor = ControlContext;
    /**
     * Adds a new input interpreter to the list of interpreters that are used to
     * collect user input from supported devices and translate it to action name /
     * intensity pairs.
     * @param {KeyboardInputInterpreter|MouseInputInterpreter} inputInterpreter
     */
    ControlContext.prototype.addInputInterpreter = function (inputInterpreter) {
        this._inputInterpreters.push(inputInterpreter);
        // saving another reference for easier access
        if (inputInterpreter instanceof KeyboardInputInterpreter) {
            this._keyboardInterpreter = this._inputInterpreters[this._inputInterpreters.length - 1];
        }
        if (inputInterpreter instanceof MouseInputInterpreter) {
            this._mouseInterpreter = this._inputInterpreters[this._inputInterpreters.length - 1];
        }
        if (inputInterpreter instanceof GamepadInputInterpreter) {
            this._joystickInterpreter = this._inputInterpreters[this._inputInterpreters.length - 1];
        }
    };
    /**
     * Returns the list of current input interpreters.
     * @returns {(KeyboardInputInterpreter|MouseInputInterpreter)[]}
     */
    ControlContext.prototype.getInputInterpreters = function () {
        return this._inputInterpreters;
    };
    /**
     * Returns the stored intepreter of the given type. (indicating the input device)
     * @param {String} interpreterType An all lowercase representation of the type,
     * e.g. "keyboard" or "mouse"
     * @return {KeyboardInputInterpreter|MouseInputInterpreter|GamepadInputInterpreter}
     */
    ControlContext.prototype.getInterpreter = function (interpreterType) {
        if (this["_" + interpreterType + "Interpreter"]) {
            return this["_" + interpreterType + "Interpreter"];
        }
        application.showError("Asked for a interpreter of type '" + interpreterType + "', which does not exist!");
    };
    /**
     * Adds a new controller to the list of controllers that are used to process 
     * actions translated by the input interpreters.
     * @param {Controller} controller
     */
    ControlContext.prototype.addController = function (controller) {
        this._controllers.push(controller);
        // saving another reference for easier access
        if (controller instanceof GeneralController) {
            this._generalController = this._controllers[this._controllers.length - 1];
        }
        if (controller instanceof FighterController) {
            this._fighterController = this._controllers[this._controllers.length - 1];
        }
        if (controller instanceof CameraController) {
            this._cameraController = this._controllers[this._controllers.length - 1];
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
     * @param {String} controllerType An all lowercase representation of the type,
     * e.g. "general" or "camera"
     * @return {Controller}
     */
    ControlContext.prototype.getController = function (controllerType) {
        if (this["_" + controllerType + "Controller"]) {
            return this["_" + controllerType + "Controller"];
        }
        application.showError("Asked for a controller of type '" + controllerType + "', which does not exist!");
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
     * Loads the control settings stored in a JSON object.
     * @param {Object} dataJSON The JSON object that stores the control settings.
     * @param {Boolean} [onlyRestoreSettings=false] Whether to only restore the
     * default settings by overwriting the changed ones from the data in the JSON,
     * or to initialize the whole context from zero, creating all the necessary
     * objects.
     */
    ControlContext.prototype.loadFromJSON = function (dataJSON, onlyRestoreSettings) {
        var i, n;
        // if a whole new initialization is needed, create and load all controllers
        // and interpreters from the JSON
        if (!onlyRestoreSettings) {
            this._dataJSON = dataJSON;
            this._controllers = [];
            for (i = 0, n = dataJSON.controllers.length; i < n; i++) {
                switch (dataJSON.controllers[i].type) {
                    case "general":
                        this.addController(new GeneralController(dataJSON.controllers[i]));
                        break;
                    case "fighter":
                        this.addController(new FighterController(dataJSON.controllers[i]));
                        break;
                    case "camera":
                        this.addController(new CameraController(dataJSON.controllers[i]));
                        break;
                    default:
                        application.showError("Unrecognized controller type: '" + dataJSON.controllers[i].type + "'!",
                                "severe", "Every controller defined in the settings file must be of one of the following types: " +
                                "general, fighter, camera.");
                }
            }
            this._controllersPriorityQueue = this._controllers;
            this._inputInterpreters = [];
            for (i = 0, n = dataJSON.inputDevices.length; i < n; i++) {
                switch (dataJSON.inputDevices[i].type) {
                    case "keyboard":
                        this.addInputInterpreter(new KeyboardInputInterpreter(dataJSON.inputDevices[i]));
                        break;
                    case "mouse":
                        this.addInputInterpreter(new MouseInputInterpreter(dataJSON.inputDevices[i]));
                        break;
                    case "joystick":
                        this.addInputInterpreter(new GamepadInputInterpreter(dataJSON.inputDevices[i]));
                        break;
                    default:
                        application.showError("Unrecognized input device type: '" + dataJSON.inputDevices[i].type + "'!",
                                "severe", "Every input device defined in the settings file must be of one of the following types: " +
                                "keyboard, mouse.");
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
    ControlContext.prototype.loadFromLocalStorage = function () {
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
        this.loadFromJSON(this._dataJSON, true);
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
    /**
     * Returns whether the context is currently in the mode for controlling a spacecraft as a pilot (as opposed to spectator mode, 
     * controlling a free camera)
     * @returns {Boolean}
     */
    ControlContext.prototype.isInPilotMode = function () {
        return this._pilotingMode;
    };
    /**
     * Switches to piloting game mode, putting the player in the pilot seat of the given spacecraft.
     * @param {Spacecraft} pilotedSpacecraft
     */
    ControlContext.prototype.switchToPilotMode = function (pilotedSpacecraft) {
        if (!pilotedSpacecraft || this._pilotingMode) {
            return;
        }
        this._pilotingMode = true;
        this._fighterController.setControlledSpacecraft(pilotedSpacecraft);
        this._cameraController.setCameraToFollowObject(pilotedSpacecraft.getVisualModel());
        this.disableAction("followNext");
        this.disableAction("followPrevious");
        armada.getScreen().setHeaderContent("Piloting " + pilotedSpacecraft.getClassName() + " " + pilotedSpacecraft.getTypeName());
        armada.getScreen().showCrosshair();
        armada.getScreen().showUI();
        if (armada.control().getInterpreter("mouse").isEnabled()) {
            document.body.style.cursor = 'crosshair';
        }
    };
    /**
     * Switches to spectator mode, in which the player can freely move the camera
     * around or follow and inspect any object in the scene.
     * @param {Boolean} [freeCamera=false] Whether to set the camera free at the current position and location.
     */
    ControlContext.prototype.switchToSpectatorMode = function (freeCamera) {
        this._pilotingMode = false;
        this._fighterController.setControlledSpacecraft(null);
        if (freeCamera) {
            this._cameraController.setToFreeCamera(false);
        }
        this.enableAction("followNext");
        this.enableAction("followPrevious");
        armada.getScreen().setHeaderContent("Spectator mode");
        armada.getScreen().hideCrosshair();
        armada.getScreen().hideUI();
        document.body.style.cursor = 'default';
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        KeyBinding: KeyBinding,
        KeyboardInputInterpreter: KeyboardInputInterpreter,
        ControlContext: ControlContext
    };
});
