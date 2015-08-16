/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, localStorage, document, window */

define([
    "utils/utils",
    "modules/application",
    "modules/async-resource",
    "armada/armada"
], function (utils, application, asyncResource, armada) {
    "use strict";
    /**
     * @class Represents a key (combination) - action association.
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
         * Name of the action that is assigned to the key (combination). {@link Controller}s
         * will process this name and execute the appropriate action.
         * @name KeyBinding#_actionName
         * @type String
         */
        this._actionName = ((typeof dataJSONOrActionName) === "string" ?
              dataJSONOrActionName :
              null);
        /**
         * The string representation of the key. 
         * @see KeyboardInputInterpreter#getKeyCodeTable
         * @name KeyBinding#_key
         * @type String
         */
        this._key = key || null;
        /**
         * The key code of the key, same as passed in the keyCode property of the event
         * argument of key event handlers.
         * @name KeyBinding#_keyCode
         * @type Number
         */
        this._keyCode = utils.getKeyCodeOf(key);
        /**
         * Whether shift should be pressed in this key combination (next to _key being pressed).
         * @name KeyBinding#_shiftState
         * @type Boolean
         */
        this._shiftState = (shiftState === undefined) ? null : shiftState;
        /**
         * Whether ctrl should be pressed in this key combination (next to _key being pressed).
         * @name KeyBinding#_ctrlState
         * @type Boolean
         */
        this._ctrlState = (ctrlState === undefined) ? null : ctrlState;
        /**
         * Whether alt should be pressed in this key combination (next to _key being pressed).
         * @name KeyBinding#_altState
         * @type Boolean
         */
        this._altState = (altState === undefined) ? null : altState;
        // if a JSON object was specified, initialize the properties from there
        if ((typeof dataJSONOrActionName) === "object") {
            this.loadFromJSON(dataJSONOrActionName);
        }
        this.updateKeyString();
        application.log("Created key binding: " + this._actionName + " - " + this._keyString, 3);
    }

    /**
     * Loads the properties of the key binding as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    KeyBinding.prototype.loadFromJSON = function (dataJSON) {
        this._actionName = dataJSON.action;
        this.setKey(dataJSON.key);
        this._shiftState = (dataJSON.shift === true);
        this._ctrlState = (dataJSON.ctrl === true);
        this._altState = (dataJSON.alt === true);
        this.updateKeyString();
    };

    /**
     * Saves the properties of this key binding to HTML5 local storage.
     */
    KeyBinding.prototype.saveToLocalStorage = function () {
        localStorage['interstellarArmada_control_' + this._actionName + '_key'] = this._key;
        localStorage['interstellarArmada_control_' + this._actionName + '_shift'] = this._shiftState;
        localStorage['interstellarArmada_control_' + this._actionName + '_ctrl'] = this._ctrlState;
        localStorage['interstellarArmada_control_' + this._actionName + '_alt'] = this._altState;
    };

    /**
     * Loads the properties of the key binding if they are stored in the HTML5 local
     * storage object.
     */
    KeyBinding.prototype.loadFromLocalStorage = function () {
        if (localStorage['interstellarArmada_control_' + this._actionName + '_key'] !== undefined) {
            this.setKey(localStorage['interstellarArmada_control_' + this._actionName + '_key']);
            this._shiftState = (localStorage['interstellarArmada_control_' + this._actionName + '_shift'] === "true");
            this._ctrlState = (localStorage['interstellarArmada_control_' + this._actionName + '_ctrl'] === "true");
            this._altState = (localStorage['interstellarArmada_control_' + this._actionName + '_alt'] === "true");
            this.updateKeyString();
        }
    };

    /**
     * Removes the properties of this key binding from the HTML5 local storage.
     */
    KeyBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_key');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_shift');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_ctrl');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_alt');
    };

    /**
     * Returns the name of the action assigned in this key binding. Has to be a name
     * that can be processed by the appropriate {@link Controller}s.
     * @returns {String}
     */
    KeyBinding.prototype.getActionName = function () {
        return this._actionName;
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
     * key binding. (if not, the binding is only triggered when shift is NOT being
     * pressed)
     * @returns {Boolean}
     */
    KeyBinding.prototype.getShiftState = function () {
        return this._shiftState;
    };

    /**
     * Returns if pressing ctrl is part of the key combination assigned in this
     * key binding. (if not, the binding is only triggered when ctrl is NOT being
     * pressed)
     * @returns {Boolean}
     */
    KeyBinding.prototype.getCtrlState = function () {
        return this._ctrlState;
    };

    /**
     * Returns if pressing alt is part of the key combination assigned in this
     * key binding. (if not, the binding is only triggered when alt is NOT being
     * pressed)
     * @returns {Boolean}
     */
    KeyBinding.prototype.getAltState = function () {
        return this._altState;
    };

    /**
     * Updates the key string property that describes the combination assign in this
     * key binding (with shift, ctrl, alt states). It is automatically called when
     * a new primary key is set with setKey().
     */
    KeyBinding.prototype.updateKeyString = function () {
        this._keyString = this._key;
        if (this._shiftState) {
            this._keyString = "shift + " + this._keyString;
        }
        if (this._ctrlState) {
            this._keyString = "ctrl + " + this._keyString;
        }
        if (this._altState) {
            this._keyString = "alt + " + this._keyString;
        }
    };

    /**
     * Returns a string representing the whole key combination complete with shift,
     * ctrl, alt states and the primary key.
     * @returns {String}
     */
    KeyBinding.prototype.getKeyString = function () {
        return this._keyString;
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
              (currentlyPressedKeys[16] === this._shiftState) &&
              (currentlyPressedKeys[17] === this._ctrlState) &&
              (currentlyPressedKeys[18] === this._altState));
    };

    /**
     * @class Monitors the keyboard inputs and stores the current state of which
     * keys are pressed. Can load and store key bindings and based on the current
     * state and the key bindings, determine the list of currently triggered actions
     * that controllers can/should execute.
     * @param {Object} [dataJSON] Upon initialization, it can load the key bindings from
     * this JSON object if specified.
     */
    function KeyboardInputInterpreter(dataJSON) {
        /**
         * An array indicating the current pressed state of each key on the keyboard. 
         * The index in the array corresponds to the keyCode property of the event 
         * argument of the key event handlers.
         * @name KeyboardInputInterpreter#_currentlyPressedKeys
         * @type Boolean[256]
         */
        this._currentlyPressedKeys = new Array(256);
        /**
         * An associative array storing the active key bindings by the names of the
         * actions that they are associated to.
         * @name KeyboardInputInterpreter#_bindings
         * @type Object
         */
        this._bindings = {};
        /**
         * Whether the interpreter is currently listening for input (the event  handlers
         * are set).
         * @name KeyboardInputInterpreter#_listening
         * @type Boolean
         */
        this._listening = false;
        // if a JSON was specified, initialize the bindings from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }

    /**
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
     * If there is no key bound yet to the action associated with the passed key
     * binding, adds the binding. If there already is a binding, overwrites it with
     * the passed binding, as there can be no two key combinations be bound to the
     * same action for now. This method is for setting default bindings.
     * @see KeyboardInputInterpreter#setAndStoreKeyBinding
     * @param {KeyBinding} keyBinding
     */
    KeyboardInputInterpreter.prototype.setKeyBinding = function (keyBinding) {
        this._bindings[keyBinding.getActionName()] = keyBinding;
    };

    /**
     * Sets (adds or overwrites) the key binding associated with the action of the 
     * passed binding, and also stores the binding in HTML5 local storage. This 
     * method is for setting custom local bindings.
     * @see KeyboardInputInterpreter#setKeyBinding
     * @param {KeyBinding} keyBinding
     */
    KeyboardInputInterpreter.prototype.setAndStoreKeyBinding = function (keyBinding) {
        this.setKeyBinding(keyBinding);
        keyBinding.saveToLocalStorage();
    };

    /**
     * Returns a string describing the key combination assigned to the action with
     * the passed name.
     * @param {String} actionName
     * @returns {String}
     */
    KeyboardInputInterpreter.prototype.getControlStringForAction = function (actionName) {
        if (this._bindings[actionName] !== undefined) {
            return this._bindings[actionName].getKeyString();
        }
        return "";
    };

    /**
     * Loads the properties of the interpreter such as the (default) key bindings
     * from the passed JSON object.
     * @param {Object} dataJSON
     */
    KeyboardInputInterpreter.prototype.loadFromJSON = function (dataJSON) {
        var i;
        for (i = 0; i < dataJSON.bindings.length; i++) {
            this.setKeyBinding(new KeyBinding(dataJSON.bindings[i]));
        }
    };

    /**
     * Loads the properties of the interpreter such as the (custom local) key bindings
     * from HTML5 local storage.
     */
    KeyboardInputInterpreter.prototype.loadFromLocalStorage = function () {
        var actionName;
        for (actionName in this._bindings) {
            if (this._bindings.hasOwnProperty(actionName)) {
                this._bindings[actionName].loadFromLocalStorage();
            }
        }
    };

    /**
     * Removes custom key bindings stored in HTML5 local storage.
     */
    KeyboardInputInterpreter.prototype.removeFromLocalStorage = function () {
        var actionName;
        for (actionName in this._bindings) {
            if (this._bindings.hasOwnProperty(actionName)) {
                this._bindings[actionName].removeFromLocalStorage();
            }
        }
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
     * Sets the event handlers on the document to start updating the stored internal
     * state on key presses and releases. The triggered actions can be queried from
     * this interpreter after this function has been called.
     */
    KeyboardInputInterpreter.prototype.startListening = function () {
        this.cancelPressedKeys();
        var self = this;
        document.onkeydown = function (e) {
            self.handleKeyDown(e);
        };
        document.onkeyup = function (e) {
            self.handleKeyUp(e);
        };
        document.onkeypress = function (e) {
            if (!self.defaultActionEnabledForKey(e.keyCode)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        this._listening = true;
    };

    /**
     * Cancels the event handlers on the document that update the internal state.
     * The triggered actions cannot be queried from this interpreter after this 
     * function has been called.
     */
    KeyboardInputInterpreter.prototype.stopListening = function () {
        document.onkeydown = null;
        document.onkeyup = null;
        this.cancelPressedKeys();
        this._listening = false;
    };

    /**
     * Returns the list of currently triggered actions based on the internally stored
     * keyboard state and key (combination) bindings.
     * @returns {Object[]} The list of action names as the "name" properties of the 
     * objects in the array.
     */
    KeyboardInputInterpreter.prototype.getTriggeredActions = function () {
        var result, keyBindingActionName;
        if (this._listening) {
            result = [];
            for (keyBindingActionName in this._bindings) {
                if (this._bindings.hasOwnProperty(keyBindingActionName)) {
                    if (this._bindings[keyBindingActionName].isTriggered(this._currentlyPressedKeys)) {
                        result.push({
                            name: keyBindingActionName
                        });
                    }
                }
            }
            return result;
        }
        application.showError("Cannot query the triggered action when the " + this.getDeviceName() + " interpreter is not listening for user input!");
    };

    /**
     * @class Represents the assignment of a mouse action (such as move, click...) 
     * to an in-game action. (such as fire)
     * @param {Object} [dataJSON] If given, the properties will be initialized from
     * the data stored in this JSON object.
     */
    function MouseBinding(dataJSON) {
        /**
         * Name of the in-game action the mouse action is bound to.
         * @name MouseBinding#_actionName
         * @type String
         */
        this._actionName = null;
        /**
         * Which mouse button should be pressed to trigger this binding.
         * Possible values:
         * 0: none
         * 1: left
         * 2: middle
         * 3: right
         * @name MouseBinding#_button
         * @type Number
         * @default 0
         */
        this._button = null;
        /**
         * What kind of horizontal mouse movement needs to take place to trigger 
         * this binding.
         * Possible values:
         * 0: none
         * -1: movement to the left
         * 1: movement to the right
         * @name MouseBinding#_moveX
         * @type Number
         * @default 0
         */
        this._moveX = null;
        /**
         * What kind of vertical mouse movement needs to take place to trigger 
         * this binding.
         * Possible values:
         * 0: none
         * -1: movement downward
         * 1: movement upward
         * @name MouseBinding#_moveY
         * @type Number
         * @default 0
         */
        this._moveY = null;
        /**
         * Whether the movement (displacement) should be calculated relative to the
         * screen (canvas) center (or relative to the previous mouse position).
         * @name MouseBinding#_measuredFromCenter
         * @type Boolean
         * @default false
         */
        this._measuredFromCenter = null;
        // if a JSON object was specified, initialize the properties from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    /**
     * Loads the properties of the key binding as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    MouseBinding.prototype.loadFromJSON = function (dataJSON) {
        this._actionName = dataJSON.action;
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
     * Saves the properties of this mouse binding to HTML5 local storage.
     */
    MouseBinding.prototype.saveToLocalStorage = function () {
        localStorage['interstellarArmada_control_' + this._actionName + '_button'] = this._button;
        localStorage['interstellarArmada_control_' + this._actionName + '_moveX'] = this._moveX;
        localStorage['interstellarArmada_control_' + this._actionName + '_moveY'] = this._moveY;
        localStorage['interstellarArmada_control_' + this._actionName + '_measuredFromCenter'] = this._measuredFromCenter;
    };

    /**
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
     * Removes the properties of this mouse binding from the HTML5 local storage.
     */
    MouseBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_button');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_moveX');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_moveY');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_measuredFromCenter');
    };

    /**
     * Returns the name of the action assigned in this key binding. Has to be a name
     * that can be processed by the appropriate {@link Controller}s.
     * @returns {String}
     */
    MouseBinding.prototype.getActionName = function () {
        return this._actionName;
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
     * Returns how much is the mouse action  triggered according to the current mouse 
     * state passed as parameter. Mouse actions can have different trigger intensities
     * (the mouse moving faster/further from the base point), therefore the returned
     * value is an integer.
     * @param {Boolean[]} currentlyPressedButtons The current press state of the 
     * mouse buttons. Arrangement: [left,middle,right]
     * @param {Number} xFromCenter The current X coordinate of the mouse relative to 
     * the center.
     * @param {Number} yFromCenter The current Y coordinate of the mouse relative to 
     * the center.
     * @param {Number} deltaX The change of the X coordinate of the mouse since the 
     * last time trigger was checked.
     * @param {Number} deltaY The change of the Y coordinate of the mouse since the 
     * last time trigger was checked.
     * @returns {Number} Whether the action was triggerend and with what intensity.
     * Zero means the action was not triggered, a positive value represents the 
     * intensity.
     */
    MouseBinding.prototype.getTriggeredIntensity = function (currentlyPressedButtons, xFromCenter, yFromCenter, deltaX, deltaY) {
        var relativeX, relativeY;
        // first if this is a button assignment, check the state of the appropriate
        // mouse button
        if (this._button > 0) {
            return (currentlyPressedButtons[this._button] === true) ? 1 : 0;
        }
        // check movement on X and Y axes
        // movement in the negative direction is represented by '-1' value of _moveX/Y,
        // therefore multiplying with the actual movement will be positive if it was
        // in the same direction
        relativeX = this._measuredFromCenter ? xFromCenter : deltaX;
        if (this._moveX !== 0) {
            return ((relativeX * this._moveX) > 0) ? (relativeX * this._moveX) : 0;
        }
        relativeY = this._measuredFromCenter ? yFromCenter : deltaY;
        if (this._moveY !== 0) {
            return ((relativeY * this._moveY) > 0) ? (relativeY * this._moveY) : 0;
        }
    };

    /**
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
     * Creates a mouse interpreter object.
     * @class Monitors the mouse inputs and stores the current state of the mouse. 
     * Can load and store mouse bindings and based on the current state and the 
     * bindings, determine the list of currently triggered actions that controllers 
     * can/should execute.
     * @param {Object} [dataJSON] Upon initialization, it can load the mouse bindings from
     * this JSON object if specified.
     * @returns {MouseInputInterpreter}
     */
    function MouseInputInterpreter(dataJSON) {
        /**
         * An array storing the press state of mouse buttons.
         * Arrangement: [left,middle,right]
         * @name MouseInputInterpreter#_currentlyPressedButtons
         * @type Boolean[3]
         */
        this._currentlyPressedButtons = new Array(3);
        /**
         * Stores the center of the screen, relative to which the mouse coordinates
         * can be considered by bindings (instead of the change in mouse position) 
         * so that control is possible when the mouse does not need to be moved 
         * continuously for e.g. continuous turning.
         * @name MouseInputInterpreter#_screenCenterX
         * @type Number[2]
         */
        this._screenCenter = [null, null];
        /**
         * The current mouse position as obtained from the mouse event.
         * @name MouseInputInterpreter#_mousePosition
         * @type Number[2]
         */
        this._mousePosition = [null, null];
        /**
         * The change in mouse position since the last time the inputs were processed.
         * @name MouseInputInterpreter#_mousePositionChange
         * @type Number[2]
         */
        this._mousePositionChange = [null, null];
        /**
         * The intensity of actions derived from the speed of the mouse movement
         * will be multiplied by this factor.
         * @name MouseInputInterpreter#_moveSensitivity
         * @type Number
         */
        this._moveSensitivity = null;
        /**
         * The intensity of actions derived from displacement of the mouse from the
         * center will be multiplied by this factor.
         * @name MouseInputInterpreter#_displacementSensitivity
         * @type Number
         */
        this._displacementSensitivity = null;
        /**
         * The actions the would derive their intensity from displacement of the mouse 
         * from the center will not be triggered unless the displacement exceeds this
         * magnitude (in pixels).
         * @name MouseInputInterpreter#_displacementDeadzone
         * @type Number
         */
        this._displacementDeadzone = null;
        /**
         * An associative array storing the active mouse bindings by the names of the
         * actions that they are associated to.
         * @name MouseInputInterpreter#_bindings
         * @type Object
         */
        this._bindings = {};
        /**
         * Whether the interpreter is currently listening for input (the event  handlers
         * are set).
         * @name MouseInputInterpreter#_listening
         * @type Boolean
         */
        this._listening = false;
        // if a JSON object was specified, initialize the bindings from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }

    /**
     * Updates the screen center relative to which the mouse position is sent to the
     * binding to check if they are triggered. Needs to be called when the center
     * changes, e.g. the window is resized.
     * @param {Number} x The X coordinate.
     * @param {Number} y The Y coordinate.
     */
    MouseInputInterpreter.prototype.setScreenCenter = function (x, y) {
        this._screenCenter = [x, y];
    };

    /**
     * Returns of the name of the device this interpreter monitors. Every input
     * interpreter should implement this function.
     * @returns {String}
     */
    MouseInputInterpreter.prototype.getDeviceName = function () {
        return "Mouse";
    };

    /**
     * If there is no mouse action bound yet to the in-game action associated with 
     * the passed binding, adds the binding. If there already is a binding, overwrites 
     * it with the passed binding, as there can be no two mouse actions be bound to the
     * same in-game action for now. This method is for setting default bindings.
     * @see MouseInputInterpreter#setAndStoreBinding
     * @param {MouseBinding} binding
     */
    MouseInputInterpreter.prototype.setBinding = function (binding) {
        this._bindings[binding.getActionName()] = binding;
    };

    /**
     * Sets (adds or overwrites) the mouse binding associated with the in-game action of the 
     * passed binding, and also stores the binding in HTML5 local storage. This 
     * method is for setting custom local bindings.
     * @see MouseInputInterpreter#setBinding
     * @param {MouseBinding} binding
     */
    MouseInputInterpreter.prototype.setAndStoreBinding = function (binding) {
        this.setBinding(binding);
        binding.saveToLocalStorage();
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
     * Returns a string describing the mouse actions assigned to the action with
     * the passed name.
     * @param {String} actionName
     * @returns {String}
     */
    MouseInputInterpreter.prototype.getControlStringForAction = function (actionName) {
        if (this._bindings[actionName] !== undefined) {
            return this._bindings[actionName].getControlString();
        }
        return "";
    };

    /**
     * Loads the properties of the interpreter such as the (default) mouse bindings
     * from the passed JSON object.
     * @param {Object} dataJSON
     */
    MouseInputInterpreter.prototype.loadFromJSON = function (dataJSON) {
        var i;
        this._moveSensitivity = dataJSON.sensitivityProfile.moveSensitivity;
        this._displacementSensitivity = dataJSON.sensitivityProfile.displacementSensitivity;
        this._displacementDeadzone = dataJSON.sensitivityProfile.displacementDeadzone;
        for (i = 0; i < dataJSON.bindings.length; i++) {
            this.setBinding(new MouseBinding(dataJSON.bindings[i]));
        }
    };

    /**
     * Loads the properties of the interpreter such as the (custom local) mouse bindings
     * from HTML5 local storage.
     */
    MouseInputInterpreter.prototype.loadFromLocalStorage = function () {
        var actionName;
        if (localStorage.interstellarArmada_control_mouse_moveSensitivity !== undefined) {
            this._moveSensitivity = parseFloat(localStorage.interstellarArmada_control_mouse_moveSensitivity);
        }
        if (localStorage.interstellarArmada_control_mouse_displacementSensitivity !== undefined) {
            this._displacementSensitivity = parseFloat(localStorage.interstellarArmada_control_mouse_displacementSensitivity);
        }
        if (localStorage.interstellarArmada_control_mouse_displacementDeadzone !== undefined) {
            this._displacementDeadzone = parseInt(localStorage.interstellarArmada_control_mouse_displacementDeadzone, 10);
        }
        for (actionName in this._bindings) {
            if (this._bindings.hasOwnProperty(actionName)) {
                this._bindings[actionName].loadFromLocalStorage();
            }
        }
    };

    /**
     * Removes custom mouse bindings stored in HTML5 local storage.
     */
    MouseInputInterpreter.prototype.removeFromLocalStorage = function () {
        var actionName;
        localStorage.removeItem("interstellarArmada_control_mouse_moveSensitivity");
        localStorage.removeItem("interstellarArmada_control_mouse_displacementSensitivity");
        localStorage.removeItem("interstellarArmada_control_mouse_displacementDeadzone");
        for (actionName in this._bindings) {
            if (this._bindings.hasOwnProperty(actionName)) {
                this._bindings[actionName].removeFromLocalStorage();
            }
        }
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
        if (this._mousePosition[0] !== null) {
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
     * Sets the event handlers on the document to start updating the stored internal
     * state of the mouse. The triggered actions can be queried from this interpreter 
     * after this function has been called.
     */
    MouseInputInterpreter.prototype.startListening = function () {
        this.cancelPressedButtons();
        this._mousePosition = [null, null];
        this._mousePositionChange = [0, 0];
        var self = this;
        document.onmousedown = function (e) {
            self.handleMouseDown(e);
        };
        document.onmouseup = function (e) {
            self.handleMouseUp(e);
        };
        document.onmousemove = function (e) {
            self.handleMouseMove(e);
        };
        document.onclick = function (e) {
            e.preventDefault();
            return false;
        };
        document.oncontextmenu = function (e) {
            e.preventDefault();
            return false;
        };
        this._listening = true;
    };

    /**
     * Cancels the event handlers on the document that update the internal state.
     * The triggered actions cannot be queried from this interpreter after this 
     * function has been called.
     */
    MouseInputInterpreter.prototype.stopListening = function () {
        document.onmousedown = null;
        document.onmouseup = null;
        document.onmousemove = null;
        document.onclick = null;
        document.oncontextmenu = null;
        this._listening = false;
    };

    /**
     * Returns the list of currently triggered actions and their intensity based on 
     * the internally stored mouse state and mouse bindings.
     * @returns {Object[]} The list of action names and intensities. The name 
     * (String) property stores the action's name and the intensity (Number) property 
     * the intensity.
     */
    MouseInputInterpreter.prototype.getTriggeredActions = function () {
        var result = [], bindingActionName, actionIntensity;
        for (bindingActionName in this._bindings) {
            if (this._bindings.hasOwnProperty(bindingActionName)) {
                actionIntensity =
                      this._bindings[bindingActionName].getTriggeredIntensity(
                      this._currentlyPressedButtons,
                      this._mousePosition[0] - this._screenCenter[0],
                      this._mousePosition[1] - this._screenCenter[1],
                      this._mousePositionChange[0],
                      this._mousePositionChange[1]);
                if (this._bindings[bindingActionName].isMeasuredFromCenter() === true) {
                    if (actionIntensity > this._displacementDeadzone) {
                        result.push({
                            name: bindingActionName,
                            intensity: (actionIntensity - this._displacementDeadzone) * this._displacementSensitivity
                        });
                    }
                } else {
                    if (actionIntensity > 0) {
                        result.push({
                            name: bindingActionName,
                            intensity: actionIntensity * this._moveSensitivity
                        });
                    }
                }
            }
        }
        this._mousePositionChange = [0, 0];
        return result;
    };
    /**
     * @class Represents the assignment of a gamepad/joystick action (moving an 
     * axis or pressing a button) to an in-game action. (such as fire)
     * @param {Object} [dataJSON] If given, the properties will be initialized from
     * the data stored in this JSON object.
     */
    function GamepadBinding(dataJSON) {
        /**
         * Name of the in-game action the gamepad action is bound to.
         * @name GamepadBinding#_actionName
         * @type String
         */
        this._actionName = null;
        /**
         * Which mouse button should be pressed to trigger this binding.
         * @name GamepadBinding#_button
         * @type Number
         */
        this._button = null;
        this._axisIndex = null;
        this._axisPositive = null;
        // if a JSON object was specified, initialize the properties from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    /**
     * Loads the properties of the binding as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    GamepadBinding.prototype.loadFromJSON = function (dataJSON) {
        this._actionName = dataJSON.action;
        if ((typeof dataJSON.button) === "number") {
            this._button = dataJSON.button;
        }
        if ((typeof dataJSON.axis) === "string") {
            this._axisIndex = Math.abs(parseInt(dataJSON.axis, 10));
            this._axisPositive = (dataJSON.axis[0] !== "-");
        }
    };
    /**
     * Saves the properties of this binding to HTML5 local storage.
     */
    GamepadBinding.prototype.saveToLocalStorage = function () {
        localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_button'] = this._button;
        localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_axisIndex'] = this._axisIndex;
        localStorage['interstellarArmada_control_' + this._actionName + '_gamepad_axisPositive'] = this._axisPositive;
    };
    /**
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
     * Removes the properties of this binding from the HTML5 local storage.
     */
    GamepadBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_gamepad_button');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_gamepad_axisIndex');
        localStorage.removeItem('interstellarArmada_control_' + this._actionName + '_gamepad_axisPositive');
    };
    /**
     * Returns the name of the action assigned in this binding. Has to be a name
     * that can be processed by the appropriate {@link Controller}s.
     * @returns {String}
     */
    GamepadBinding.prototype.getActionName = function () {
        return this._actionName;
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
        if (this._button !== null) {
            return (gamepad.buttons[this._button] === 1.0 ||
                  ((typeof (gamepad.buttons[this._button]) === "object") && gamepad.buttons[this._button].pressed)) ? 1 : 0;
        }
        if (this._axisIndex !== null) {
            return Math.max((gamepad.axes[this._axisIndex] * (this._axisPositive ? 1 : -1)), 0);
        }
        return 0;
    };
    /**
     * Returns a string representation describing the action the user needs
     * to perform to trigger this binding.
     * @returns {String}
     */
    GamepadBinding.prototype.getControlString = function () {
        if (this._button !== null) {
            return "button " + this._button;
        }
        if (this._axisIndex !== null) {
            return "axis " + this._axisIndex + " " + (this._axisPositive ? "positive" : "negative");
        }
        return "";
    };
    /**
     * @class Monitors the gamepad/joystick inputs and stores the current state 
     * of the gamepad/joystick. 
     * Can load and store gamepad bindings and based on the current state and the 
     * bindings, determine the list of currently triggered actions that controllers 
     * can/should execute.
     * @param {Object} [dataJSON] Upon initialization, it can load the bindings from
     * this JSON object if specified.
     * @returns {GamepadInputInterpreter}
     */
    function GamepadInputInterpreter(dataJSON) {
        this._deviceType = "Joystick";
        this._gamepad = null;
        /**
         * An associative array storing the active gamepad bindings by the names of the
         * actions that they are associated to.
         * @name GamepadInputInterpreter#_bindings
         * @type Object
         */
        this._bindings = {};
        /**
         * Whether the interpreter is currently listening for input.
         * @name GamepadInputInterpreter#_listening
         * @type Boolean
         */
        this._listening = false;
        /**
         * Used for yaw, pitch, roll
         * @type Number
         */
        this._turnSensitivity = 1;
        // if a JSON object was specified, initialize the bindings from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    /**
     * Returns of the name of the device this interpreter monitors. Every input
     * interpreter should implement this function.
     * @returns {String}
     */
    GamepadInputInterpreter.prototype.getDeviceName = function () {
        return this._deviceType;
    };
    /**
     * If there is no gamepad action bound yet to the in-game action associated with 
     * the passed binding, adds the binding. If there already is a binding, overwrites 
     * it with the passed binding, as there can be no two gamepad actions be bound to the
     * same in-game action for now. This method is for setting default bindings.
     * @see GamepadInputInterpreter#setAndStoreBinding
     * @param {MouseBinding} binding
     */
    GamepadInputInterpreter.prototype.setBinding = function (binding) {
        this._bindings[binding.getActionName()] = binding;
    };
    /**
     * Sets (adds or overwrites) the gamepad binding associated with the in-game action of the 
     * passed binding, and also stores the binding in HTML5 local storage. This 
     * method is for setting custom local bindings.
     * @see GamepadInputInterpreter#setBinding
     * @param {GamepadBinding} binding
     */
    GamepadInputInterpreter.prototype.setAndStoreBinding = function (binding) {
        this.setBinding(binding);
        binding.saveToLocalStorage();
    };
    /**
     * Returns a string describing the gamepad action assigned to the action with
     * the passed name.
     * @param {String} actionName
     * @returns {String}
     */
    GamepadInputInterpreter.prototype.getControlStringForAction = function (actionName) {
        if (this._bindings[actionName] !== undefined) {
            return this._bindings[actionName].getControlString();
        }
        return "";
    };
    /**
     * Loads the properties of the interpreter such as the (default) gamepad bindings
     * from the passed JSON object.
     * @param {Object} dataJSON
     */
    GamepadInputInterpreter.prototype.loadFromJSON = function (dataJSON) {
        var i;
        this._turnSensitivity = dataJSON.sensitivityProfile.turnSensitivity;
        for (i = 0; i < dataJSON.bindings.length; i++) {
            this.setBinding(new GamepadBinding(dataJSON.bindings[i]));
        }
    };
    /**
     * Loads the properties of the interpreter such as the (custom local) gamepad bindings
     * from HTML5 local storage.
     */
    GamepadInputInterpreter.prototype.loadFromLocalStorage = function () {
        var actionName;
        for (actionName in this._bindings) {
            if (this._bindings.hasOwnProperty(actionName)) {
                this._bindings[actionName].loadFromLocalStorage();
            }
        }
    };
    /**
     * Removes custom mouse bindings stored in HTML5 local storage.
     */
    GamepadInputInterpreter.prototype.removeFromLocalStorage = function () {
        var actionName;
        for (actionName in this._bindings) {
            if (this._bindings.hasOwnProperty(actionName)) {
                this._bindings[actionName].removeFromLocalStorage();
            }
        }
    };
    GamepadInputInterpreter.prototype.handleGamepadConnected = function (event) {
        if (!this._gamepad) {
            this._gamepad = event.gamepad;
        }
    };
    /**
     * Sets the event handlers to grab a gamepad object for this interpreter
     * once it has become available for the web application.
     * The triggered actions can be queried from this interpreter after this 
     * method has been called.
     */
    GamepadInputInterpreter.prototype.startListening = function () {
        var self = this;
        window.addEventListener("gamepadconnected", function (e) {
            self.handleGamepadConnected(e);
        });
        this._listening = true;
    };
    /**
     * The triggered actions cannot be queried from this interpreter after this 
     * function has been called.
     */
    GamepadInputInterpreter.prototype.stopListening = function () {
        window.ongamepadconnected = null;
        this._listening = false;
    };
    /**
     * Returns the list of currently triggered actions and their intensity based on 
     * the internally stored gamepad state and gamepad bindings.
     * @returns {Object[]} The list of action names and intensities. The name 
     * (String) property stores the action's name and the intensity (Number) property 
     * the intensity.
     */
    GamepadInputInterpreter.prototype.getTriggeredActions = function () {
        var result = [], bindingActionName, actionIntensity, isTurnAction;
        for (bindingActionName in this._bindings) {
            if (this._bindings.hasOwnProperty(bindingActionName)) {
                actionIntensity = this._bindings[bindingActionName].getTriggeredIntensity(this._gamepad);
                if (actionIntensity > 0) {
                    isTurnAction =
                          (bindingActionName === "yawLeft" || bindingActionName === "yawRight" ||
                                bindingActionName === "pitchUp" || bindingActionName === "pitchDown" ||
                                bindingActionName === "rollLeft" || bindingActionName === "rollRight" ||
                                bindingActionName === "cameraTurnLeft" || bindingActionName === "cameraTurnRight" ||
                                bindingActionName === "cameraTurnUp" || bindingActionName === "cameraTurnDown");
                    result.push({
                        name: bindingActionName,
                        intensity: actionIntensity * (isTurnAction ? this._turnSensitivity : 1)
                    });
                }
            }
        }
        return result;
    };
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
         * @name Action#_name
         * @type String
         */
        this._name = null;
        /**
         * A longer, human readable description to be display in the control settings
         * screen.
         * @name Action#_description
         * @type String
         */
        this._description = null;
        /**
         * Whether the action is to be continuously executed while being triggered,
         * or only to be executed once a new trigger has been initiated.
         * @name Action#_continuous
         * @type Boolean
         */
        this._continuous = null;
        /**
         * Whether the action is currently being triggered or not.
         * @name Action#_triggered
         * @type Boolean
         */
        this._triggered = null;
        /**
         * If the action is triggered, then with what intensity. The value null
         * corresponds to a trigger without a specific intensity (such as trigger by
         * a key press)
         * @name Action#_intensity
         * @type Number
         */
        this._intensity = null;
        /**
         * Whether the action has already been executed for the current trigger.
         * (non continuous actions will not fire unless this is reset to false by
         * the end of the current trigger and then a new trigger starts)
         * @name Action#_executed
         * @type Boolean
         */
        this._executed = null;
        /**
         * The function to execute when the action is triggered.
         * @name Action#_executeTriggered
         * @type Function
         */
        this._executeTriggered = null;
        /**
         * The function to execute when the action is not being triggered.
         * @name Action#_executeNonTriggered
         * @type Function
         */
        this._executeNonTriggered = null;
        // if a JSON was specified, initialize the properties from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }

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
        this._intensity = null;
        this._executed = false;
    };

    /**
     * Sets the action's trigger state and intensity.
     * @param {Boolean} triggered The new trigger state of the action to be set.
     * @param {Number} intensity The new intensity of the action to be set. Will
     * be ignored if not given or if the intensity of the action has already been
     * set (if multiple triggers try to set the intensity, the first one will be
     * effective)
     */
    Action.prototype.setTriggered = function (triggered, intensity) {
        this._triggered = triggered;
        if ((intensity !== undefined) && (this._intensity === null)) {
            this._intensity = intensity;
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
                    this._executeTriggered(this._intensity);
                }
            } else {
                if (this._executeNonTriggered !== null) {
                    this._executeNonTriggered();
                }
            }
        } else {
            if ((this._triggered === true) && (this._executed === false)) {
                if (this._executeTriggered !== null) {
                    this._executeTriggered(this._intensity);
                }
                this._executed = true;
            } else {
                if (this._executeNonTriggered !== null) {
                    this._executeNonTriggered();
                }
                if (this._triggered === false) {
                    this._executed = false;
                }
            }
        }
        // We cancel the trigger after every execution. Before calling this function
        // the appropriate triggers have to be set by checking the current inputs.
        this._triggered = false;
        this._intensity = null;
    };

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
         * @name Controller#_actions
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
     * @param {Object[]} triggeredActions The list of actions in the form of objects
     * where the 'name' (String) property identifies the name of the action and the
     * (optional) 'intensity' (Number) property determines the intensity with which
     * the action is to be executed.
     */
    Controller.prototype.executeActions = function (triggeredActions) {
        var i, actionName;
        // First set the triggers for the stored action. If the same action is in
        // the list several times, setting the trigger will have no new effect,
        // unless an intensity is added.
        for (i = 0; i < triggeredActions.length; i++) {
            if (this._actions[triggeredActions[i].name] !== undefined) {
                this._actions[triggeredActions[i].name].setTriggered(true, triggeredActions[i].intensity);
            }
        }
        // Execute all the stored actions, each exactly once.
        for (actionName in this._actions) {
            if (this._actions.hasOwnProperty(actionName)) {
                this._actions[actionName].execute();
            }
        }
    };

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
         * @name GeneralController#_level
         * @type Level
         */
        this._level = null;

        // The superclass constructor above loads the data from the JSON, so all action
        // properties should be have been created by now.

        var self = this;

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
        // switching to pilot mode
        this.setActionFunction("switchToPilotMode", true, function () {
            armada.control().switchToPilotMode(self._level.getPilotedSpacecraft());
        });
        // switching to spectator mode
        this.setActionFunction("switchToSpectatorMode", true, function () {
            armada.control().switchToSpectatorMode();
        });
        // toggling the visibility of hitboxes
        this.setActionFunction("toggleHitboxVisibility", true, function () {
            self._level.toggleHitboxVisibility();
        });
        // toggling the visibility of texts on screen
        this.setActionFunction("toggleTextVisibility", true, function () {
            armada.getScreen().toggleTextVisibility();
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
         * @name FighterController#_controlledSpacecraft
         * @type Spacecraft
         */
        this._controlledSpacecraft = null;

        // The superclass constructor above loads the data from the JSON, so all action
        // properties should have been created

        var self = this;

        // fire the primary weapons of the fighter
        this.setActionFunction("fire", true, function () {
            self._controlledSpacecraft.fire();
        });
        // changing flight mode (free or compensated)
        this.setActionFunction("changeFlightMode", true, function () {
            self._controlledSpacecraft.changeFlightMode();
        });
        // forward burn
        this.setActionFunctions("forward", function (i) {
            self._controlledSpacecraft.forward(i);
        }, function () {
            self._controlledSpacecraft.stopForward();
        });
        // reverse burn
        this.setActionFunctions("reverse", function (i) {
            self._controlledSpacecraft.reverse(i);
        }, function () {
            self._controlledSpacecraft.stopReverse();
        });
        // strafing to left and right
        this.setActionFunctions("strafeLeft", function (i) {
            self._controlledSpacecraft.strafeLeft(i);
        }, function () {
            self._controlledSpacecraft.stopLeftStrafe();
        });
        this.setActionFunctions("strafeRight", function (i) {
            self._controlledSpacecraft.strafeRight(i);
        }, function () {
            self._controlledSpacecraft.stopRightStrafe();
        });
        // strafing up and down
        this.setActionFunctions("raise", function (i) {
            self._controlledSpacecraft.raise(i);
        }, function () {
            self._controlledSpacecraft.stopRaise();
        });
        this.setActionFunctions("lower", function (i) {
            self._controlledSpacecraft.lower(i);
        }, function () {
            self._controlledSpacecraft.stopLower();
        });
        // resetting speed to 0
        this.setActionFunction("resetSpeed", true, function () {
            self._controlledSpacecraft.resetSpeed();
        });
        // turning along the 3 axes
        this.setActionFunction("yawLeft", true, function (i) {
            self._controlledSpacecraft.yawLeft(i);
        });
        this.setActionFunction("yawRight", true, function (i) {
            self._controlledSpacecraft.yawRight(i);
        });
        this.setActionFunction("pitchUp", true, function (i) {
            self._controlledSpacecraft.pitchUp(i);
        });
        this.setActionFunction("pitchDown", true, function (i) {
            self._controlledSpacecraft.pitchDown(i);
        });
        this.setActionFunction("rollLeft", true, function (i) {
            self._controlledSpacecraft.rollLeft(i);
        });
        this.setActionFunction("rollRight", true, function (i) {
            self._controlledSpacecraft.rollRight(i);
        });
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
            Controller.prototype.executeActions.call(this, triggeredActions);
        }
    };

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
         * @name CameraController#_controlledCamera
         * @type SceneCamera
         */
        this._controlledCamera = null;

        // The superclass constructor above loads the data from the JSON, so all action
        // properties should have been created

        var self = this;

        // turning the camera in the four directions
        this.setActionFunctions("cameraTurnLeft", function (i) {
            self._controlledCamera.turnLeft(i);
        }, function () {
            self._controlledCamera.stopLeftTurn();
        });
        this.setActionFunctions("cameraTurnRight", function (i) {
            self._controlledCamera.turnRight(i);
        }, function () {
            self._controlledCamera.stopRightTurn();
        });
        this.setActionFunctions("cameraTurnUp", function (i) {
            self._controlledCamera.turnUp(i);
        }, function () {
            self._controlledCamera.stopUpTurn();
        });
        this.setActionFunctions("cameraTurnDown", function (i) {
            self._controlledCamera.turnDown(i);
        }, function () {
            self._controlledCamera.stopDownTurn();
        });
        //moving the camera along the 3 axes
        this.setActionFunctions("cameraMoveLeft", function () {
            self._controlledCamera.moveLeft();
        }, function () {
            self._controlledCamera.stopLeftMove();
        });
        this.setActionFunctions("cameraMoveRight", function () {
            self._controlledCamera.moveRight();
        }, function () {
            self._controlledCamera.stopRightMove();
        });
        this.setActionFunctions("cameraMoveUp", function () {
            self._controlledCamera.moveUp();
        }, function () {
            self._controlledCamera.stopUpMove();
        });
        this.setActionFunctions("cameraMoveDown", function () {
            self._controlledCamera.moveDown();
        }, function () {
            self._controlledCamera.stopDownMove();
        });
        this.setActionFunctions("cameraMoveForward", function () {
            self._controlledCamera.moveForward();
        }, function () {
            self._controlledCamera.stopForwardMove();
        });
        this.setActionFunctions("cameraMoveBackward", function () {
            self._controlledCamera.moveBackward();
        }, function () {
            self._controlledCamera.stopBackwardMove();
        });
        // zooming
        this.setActionFunction("cameraDecreaseFOV", true, function () {
            self._controlledCamera.decreaseFOV();
        });
        this.setActionFunction("cameraIncreaseFOV", true, function () {
            self._controlledCamera.increaseFOV();
        });
        // changing the view
        this.setActionFunction("changeView", true, function () {
            self._controlledCamera.changeToNextView();
        });
        // following another object
        this.setActionFunction("followNext", true, function () {
            self._controlledCamera.followNextObject();
        });
        this.setActionFunction("followPrevious", true, function () {
            self._controlledCamera.followPreviousObject();
        });
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
     * @param {SceneCamera} controlledCamera
     */
    CameraController.prototype.setControlledCamera = function (controlledCamera) {
        this._controlledCamera = controlledCamera;
    };

    /**
     * Sets the controlled camera to follow the passed visual object from now on.
     * @param {RenderableObject} renderableObject
     */
    CameraController.prototype.setCameraToFollowObject = function (renderableObject) {
        this._controlledCamera.followObject(renderableObject);
    };

    /**
     * Sets the controlled camera to free control (not following any objects)
     */
    CameraController.prototype.setToFreeCamera = function () {
        this._controlledCamera.followObject(null);
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

    /**
     * Creates a control context object.
     * @class A control context holds interpreter objects that translate the user 
     * input coming from different devices (such as keyboard or mouse) into actions,
     * and the controllers that can process those actions and execute the appropriate
     * methods of in-game entities they control.
     * @extends asyncResource.AsyncResource
     * @returns {ControlContext}
     */
    function ControlContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * The JSON object wich stores the control settings.
         * @name ControlContext#_dataJSON
         * @type Object
         */
        this._dataJSON = null;
        /**
         * The array of input interpreters wich collect the user input from different
         * devices (each interpreter is capable of querying one device) and translate
         * them into actions that can be processed by the controllers.
         * @name ControlContext#_inputInterpreters
         * @type (KeyboardInputInterpreter|MouseInputInterpreter)[]
         */
        this._inputInterpreters = null;
        /**
         * A reference to the keyboard input interpreter from the interpreter list 
         * for easier access.
         * @name ControlContext#_keyboardInterpreter
         * @type KeyboardInputInterpreter
         */
        this._keyboardInterpreter = null;
        /**
         * A reference to the mouse input interpreter from the interpreter list 
         * for easier access.
         * @name ControlContext#_mouseInterpreter
         * @type MouseInputInterpreter
         */
        this._mouseInterpreter = null;
        this._joystickInterpreter = null;
        /**
         * The list of controllers, which control various entities found in the game.
         * @name ControlContext#_controllers
         * @type Controller[]
         */
        this._controllers = null;
        /**
         * Whether the control context is currently listening for user input (through
         * its interpreter objects).
         * @name ControlContext#_listening
         * @type Boolean
         */
        this._listening = null;
        /**
         * A reference to the general controller from the controller list for easier 
         * access.
         * @name ControlContext#_generalController
         * @type GeneralController
         */
        this._generalController = null;
        /**
         * A reference to the fighter controller from the controller list for easier 
         * access.
         * @name ControlContext#_fighterController
         * @type FighterController
         */
        this._fighterController = null;
        /**
         * A reference to the camera controller from the controller list for easier 
         * access.
         * @name ControlContext#_cameraController
         * @type CameraController
         */
        this._cameraController = null;
        /**
         * Associative array of the names of disabled actions. The action names are
         * the keys, and if the corresponding action is disabled, the value is true.
         * Disabled actions are not passed to the controllers for processing, even
         * if they would be triggered user input.
         * @name ControlContext#_disabledActions
         * @type Object
         */
        this._disabledActions = {};
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
              actionFilterFunction = function (action) {
                  return !this._disabledActions[action.name];
              }.bind(this);
        if (this._listening) {
            triggeredActions = [];

            for (i = 0; i < this._inputInterpreters.length; i++) {
                triggeredActions = triggeredActions.concat(this._inputInterpreters[i].getTriggeredActions().filter(actionFilterFunction));
            }
            for (i = 0; i < this._controllers.length; i++) {
                this._controllers[i].executeActions(triggeredActions);
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
     * Switches to piloting game mode, putting the player in the pilot seat of the
     * given spacecraft.
     * @param {Spacecraft} pilotedSpacecraft
     */
    ControlContext.prototype.switchToPilotMode = function (pilotedSpacecraft) {
        this._fighterController.setControlledSpacecraft(pilotedSpacecraft);
        pilotedSpacecraft.resetViewCameras();
        this._cameraController.setCameraToFollowObject(pilotedSpacecraft.getVisualModel());
        this.disableAction("followNext");
        this.disableAction("followPrevious");
        this.disableAction("cameraMoveLeft");
        this.disableAction("cameraMoveRight");
        this.disableAction("cameraMoveUp");
        this.disableAction("cameraMoveDown");
        this.disableAction("cameraMoveForward");
        this.disableAction("cameraMoveBackward");
        this.disableAction("cameraTurnLeft");
        this.disableAction("cameraTurnRight");
        this.disableAction("cameraTurnUp");
        this.disableAction("cameraTurnDown");
        armada.getScreen().setHeaderContent("Piloting " + pilotedSpacecraft.getClassName() + " " + pilotedSpacecraft.getTypeName());
        armada.getScreen().showCrosshair();
        armada.getScreen().showUI();
        document.body.style.cursor = 'crosshair';
    };

    /**
     * Switches to spectator mode, in which the player can freely move the camera
     * around or follow and inspect any object in the scene.
     */
    ControlContext.prototype.switchToSpectatorMode = function () {
        this._fighterController.setControlledSpacecraft(null);
        this._cameraController.setToFreeCamera();
        this.enableAction("followNext");
        this.enableAction("followPrevious");
        this.enableAction("cameraMoveLeft");
        this.enableAction("cameraMoveRight");
        this.enableAction("cameraMoveUp");
        this.enableAction("cameraMoveDown");
        this.enableAction("cameraMoveForward");
        this.enableAction("cameraMoveBackward");
        this.enableAction("cameraTurnLeft");
        this.enableAction("cameraTurnRight");
        this.enableAction("cameraTurnUp");
        this.enableAction("cameraTurnDown");
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
