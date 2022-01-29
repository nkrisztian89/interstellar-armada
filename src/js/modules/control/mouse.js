/**
 * Copyright 2014-2018, 2020-2022 Krisztián Nagy
 * @file Provides an input interpreter subclass (based on the base class provided by the generic control module) to
 * catch and process input from the mouse.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for formatting control strings
 * @param strings For translation support of control strings
 * @param control We build on the generic functionality and classes of this module
 */
define([
    "utils/utils",
    "modules/strings",
    "modules/control/control"
], function (utils, strings, control) {
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
            // ----------------------------------------------------------------------
            // string definitions for translation of control strings
            MOUSE_LEFT_BUTTON = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "leftButton",
                defaultValue: "left click"
            },
            MOUSE_RIGHT_BUTTON = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "rightButton",
                defaultValue: "right click"
            },
            MOUSE_MIDDLE_BUTTON = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "middleButton",
                defaultValue: "middle click"
            },
            MOUSE_FROM_CENTER = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "fromCenter",
                defaultValue: "{move} {toDirection} from center"
            },
            MOUSE_NOT_FROM_CENTER = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "notFromCenter",
                defaultValue: "{move} {toDirection}"
            },
            MOUSE_MOVE = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "move",
                defaultValue: "move"
            },
            MOUSE_DIRECTION_LEFT = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "leftDirection",
                defaultValue: "left"
            },
            MOUSE_DIRECTION_RIGHT = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "rightDirection",
                defaultValue: "right"
            },
            MOUSE_DIRECTION_UP = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "upDirection",
                defaultValue: "up"
            },
            MOUSE_DIRECTION_DOWN = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "downDirection",
                defaultValue: "down"
            },
            MOUSE_SCROLL = {
                name: "mouse" + strings.CATEGORY_SEPARATOR + "scroll",
                defaultValue: "scroll"
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
     * @class Represents the assignment of a mouse action (such as move, click...) 
     * to an in-game action. (such as fire)
     * @extends ControlBinding
     * @param {Object} [dataJSON] If given, the properties will be initialized from
     * the data stored in this JSON object.
     * @param {String} [profileName] The name of the input profile this binding
     * belongs to
     */
    function MouseBinding(dataJSON, profileName) {
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
        control.ControlBinding.call(this, dataJSON, profileName);
    }
    MouseBinding.prototype = new control.ControlBinding();
    MouseBinding.prototype.constructor = MouseBinding;
    /**
     * @override
     * Loads the properties of the key binding as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    MouseBinding.prototype.loadFromJSON = function (dataJSON) {
        control.ControlBinding.prototype.loadFromJSON.call(this, dataJSON);
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
                return strings.get(MOUSE_LEFT_BUTTON);
            case MouseButtonName.MIDDLE:
                return strings.get(MOUSE_MIDDLE_BUTTON);
            case MouseButtonName.RIGHT:
                return strings.get(MOUSE_RIGHT_BUTTON);
        }
        result = this._measuredFromCenter ?
                strings.get(MOUSE_FROM_CENTER) :
                strings.get(MOUSE_NOT_FROM_CENTER);
        if (this._moveX < 0) {
            direction = strings.get(MOUSE_DIRECTION_LEFT);
        } else if (this._moveX > 0) {
            direction = strings.get(MOUSE_DIRECTION_RIGHT);
        } else if (this._moveY < 0) {
            direction = strings.get(MOUSE_DIRECTION_UP);
        } else if (this._moveY > 0) {
            direction = strings.get(MOUSE_DIRECTION_DOWN);
        }
        if (direction) {
            result = utils.formatString(result, {
                move: strings.get(MOUSE_MOVE),
                toDirection: direction
            });
            return result;
        }
        direction = null;
        result = strings.get(MOUSE_NOT_FROM_CENTER);
        if (this._scrollX < 0) {
            direction = strings.get(MOUSE_DIRECTION_LEFT);
        } else if (this._scrollX > 0) {
            direction = strings.get(MOUSE_DIRECTION_RIGHT);
        } else if (this._scrollY < 0) {
            direction = strings.get(MOUSE_DIRECTION_UP);
        } else if (this._scrollY > 0) {
            direction = strings.get(MOUSE_DIRECTION_DOWN);
        }
        if (direction) {
            result = utils.formatString(result, {
                move: strings.get(MOUSE_SCROLL),
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
        // only calculate the displacement if we have a valid mouse position
        relativeX = this._measuredFromCenter ?
                ((mousePosition[0] >= 0) ?
                        mousePosition[0] - screenCenter[0] :
                        0) :
                mousePositionChange[0];
        if (this._moveX !== 0) {
            return relativeX * this._moveX;
        }
        relativeY = this._measuredFromCenter ?
                ((mousePosition[1] >= 0) ?
                        mousePosition[1] - screenCenter[1] :
                        0) :
                mousePositionChange[1];
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
         * A cahced value of the mininum of the X and Y coordinates of the screen center.
         * @type Number
         */
        this._screenSize = 0;
        /**
         * The current mouse position as obtained from the mouse event.
         * @type Number[2]
         */
        this._mousePosition = [-1, -1];
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
         * center will reach 1.0 at the distance that is the screen size (the smaller one of width / height)
         * multiplied by this factor.
         * @type Number
         */
        this._displacementAreaRelativeSize = 0;
        /**
         * The distance from the center of the screen (along X and Y) at (and above) which the intensity of
         * actions that depend on displacement is at maximum, in pixels.
         * @type Number
         */
        this._maxDisplacement = 0;
        /**
         * The factor mouse displacement will be multiplied by to get the action intensity (maximum 1.0)
         * based on the displacement area relative size and the screen size (cached value).
         * @type Number
         */
        this._displacementFactor = 1;
        /**
         * The actions the would derive their intensity from displacement of the mouse 
         * from the center will not be triggered unless the displacement exceeds this
         * magnitude (in pixels).
         * @type Number
         */
        this._displacementDeadzone = 0;
        /**
         * Whether the pointer is currently locked by some element
         * @type Boolean
         */
        this._pointerLock = false;
        this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
        control.InputInterpreter.call(this, MouseBinding, dataJSON);
    }
    MouseInputInterpreter.prototype = new control.InputInterpreter();
    MouseInputInterpreter.prototype.constructor = MouseInputInterpreter;
    /**
     * Updates the factor mouse displacement will be multiplied by to get the action intensity (maximum 1.0)
     * based on the displacement area relative size and the screen size.
     */
    MouseInputInterpreter.prototype._updateDisplacementFactor = function () {
        this._maxDisplacement = (this._screenSize || 1) * this._displacementAreaRelativeSize;
        this._displacementFactor = 1 / this._maxDisplacement;
        this._maxDisplacement += this._displacementDeadzone;
    };
    /**
     * Updates the screen center relative to which the mouse position is sent to the
     * binding to check if they are triggered. Needs to be called when the center
     * changes, e.g. the window is resized.
     * @param {Number} x The X coordinate.
     * @param {Number} y The Y coordinate.
     */
    MouseInputInterpreter.prototype.setScreenCenter = function (x, y) {
        this._screenCenter = [x, y];
        this._screenSize = Math.min(x, y);
        this._updateDisplacementFactor();
        this._mousePosition = [x, y];
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
     * @override
     */
    MouseInputInterpreter.prototype.resetState = function () {
        var i;
        for (i = 0; i < this._currentlyPressedButtons.length; i++) {
            this._currentlyPressedButtons[i] = false;
        }
        this._mousePosition = [-1, -1];
        this._mousePositionChange = [0, 0];
        this._scrollChange = [0, 0];
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
     * Returns the mouse displacement sensitivity.
     * @returns {Number}
     */
    MouseInputInterpreter.prototype.getDisplacementAreaRelativeSize = function () {
        return this._displacementAreaRelativeSize;
    };
    /**
     * Sets the mouse displacement sensitivity and stores the setting in HTML5 local storage.
     * @param {Number} displacementAreaRelativeSize
     */
    MouseInputInterpreter.prototype.setAndStoreDisplacementAreaRelativeSize = function (displacementAreaRelativeSize) {
        this._displacementAreaRelativeSize = displacementAreaRelativeSize;
        this._updateDisplacementFactor();
        localStorage[_modulePrefix + "mouse_displacementAreaRelativeSize"] = this._displacementAreaRelativeSize;
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
        control.InputInterpreter.prototype.loadFromJSON.call(this, dataJSON);
        this._moveSensitivity = dataJSON.sensitivityProfile.moveSensitivity;
        this._displacementAreaRelativeSize = dataJSON.sensitivityProfile.displacementAreaRelativeSize;
        this._updateDisplacementFactor();
        this._displacementDeadzone = dataJSON.sensitivityProfile.displacementDeadzone;
    };
    /**
     * @override
     * Loads the properties of the interpreter such as the (custom local) mouse bindings
     * from HTML5 local storage.
     */
    MouseInputInterpreter.prototype.loadFromLocalStorage = function () {
        control.InputInterpreter.prototype.loadFromLocalStorage.call(this);
        if (localStorage[_modulePrefix + "mouse_moveSensitivity"] !== undefined) {
            this._moveSensitivity = parseFloat(localStorage[_modulePrefix + "mouse_moveSensitivity"]);
        }
        if (localStorage[_modulePrefix + "mouse_displacementAreaRelativeSize"] !== undefined) {
            this._displacementAreaRelativeSize = parseFloat(localStorage[_modulePrefix + "mouse_displacementAreaRelativeSize"]);
            this._updateDisplacementFactor();
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
        control.InputInterpreter.prototype.removeFromLocalStorage.call(this);
        localStorage.removeItem(_modulePrefix + "mouse_moveSensitivity");
        localStorage.removeItem(_modulePrefix + "mouse_displacementAreaRelativeSize");
        localStorage.removeItem(_modulePrefix + "mouse_displacementDeadzone");
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
        // we add up all movements of the mouse and null it out after every query for triggered actions, so all movements between two
        // queries are considered
        // only add the movement if we have a valid mouse position
        if (this._mousePosition[0] >= 0) {
            if (this._pointerLock) {
                this._mousePositionChange[0] += event.movementX;
                this._mousePositionChange[1] += event.movementY;
            } else {
                this._mousePositionChange[0] += (event.clientX - this._mousePosition[0]);
                this._mousePositionChange[1] += (event.clientY - this._mousePosition[1]);
            }
        }
        if (this._pointerLock) {
            this._mousePosition[0] = Math.min(Math.max(
                    this._screenCenter[0] - this._maxDisplacement,
                    this._mousePosition[0] + event.movementX),
                    this._screenCenter[0] + this._maxDisplacement);
            this._mousePosition[1] = Math.min(Math.max(
                    this._screenCenter[1] - this._maxDisplacement,
                    this._mousePosition[1] + event.movementY),
                    this._screenCenter[1] + this._maxDisplacement);
        } else {
            this._mousePosition = [event.clientX, event.clientY];
        }
    };
    /**
     * An event handler for the wheel event, updating the stored scrolling state
     * @param {WheelEvent} event
     */
    MouseInputInterpreter.prototype.handleWheel = function (event) {
        // changes are accumulated and reset to zero when processed
        this._scrollChange[0] += event.deltaX;
        this._scrollChange[1] += event.deltaY;
    };
    /**
     * An event handler for the pointer lock change event (update internal
     * state so that the other event handlers work properly both when the
     * pointer is locked and when not)
     */
    MouseInputInterpreter.prototype.handlePointerLockChange = function () {
        this._pointerLock = !!document.pointerLockElement;
    };
    /**
     * @override
     * Sets the event handlers on the document to start updating the stored internal
     * state of the mouse. The triggered actions can be queried from this interpreter 
     * after this function has been called.
     */
    MouseInputInterpreter.prototype.startListening = function () {
        control.InputInterpreter.prototype.startListening.call(this);
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
        this.handlePointerLockChange();
        document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    };
    /**
     * @override
     * Cancels the event handlers on the document that update the internal state.
     * The triggered actions cannot be queried from this interpreter after this 
     * function has been called.
     */
    MouseInputInterpreter.prototype.stopListening = function () {
        control.InputInterpreter.prototype.stopListening.call(this);
        document.onmousedown = null;
        document.onmouseup = null;
        document.onmousemove = null;
        document.onwheel = null;
        document.onclick = null;
        document.oncontextmenu = null;
        document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    };
    /**
     * @override
     * Checks if the action with the supplied name is triggered based on the current input state.
     * @param {String} actionName
     * @returns {(ActionTrigger|null)} Null, if the action is not triggered
     */
    MouseInputInterpreter.prototype.checkAction = function (actionName) {
        var actionIntensity =
                this._currentProfile[actionName].getTriggeredIntensity(
                this._currentlyPressedButtons,
                this._mousePosition,
                this._mousePositionChange,
                this._screenCenter,
                this._scrollChange);
        return (actionIntensity >= 0) ?
                {
                    name: actionName,
                    intensity: (this._currentProfile[actionName].isMeasuredFromCenter() === true) ?
                            Math.min(1, Math.max(0, actionIntensity - this._displacementDeadzone) * this._displacementFactor) :
                            (actionIntensity * this._moveSensitivity),
                    source: this
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
        var result = control.InputInterpreter.prototype.getTriggeredActions.call(this, actionFilterFunction);
        // null out the mouse movements added up since the last query
        this._mousePositionChange = [0, 0];
        this._scrollChange = [0, 0];
        return result;
    };
    /**
     * Returns the currently stored mouse position.
     * @returns {Number[2]}
     */
    MouseInputInterpreter.prototype.getMousePosition = function () {
        return this._mousePosition;
    };
    /**
     * Returns whether the currently stored mouse position is outside the set displacement deadzone.
     * @returns {Boolean}
     */
    MouseInputInterpreter.prototype.isMouseDisplaced = function () {
        return (Math.abs(this._mousePosition[0] - this._screenCenter[0]) > this._displacementDeadzone) ||
                (Math.abs(this._mousePosition[1] - this._screenCenter[1]) > this._displacementDeadzone);
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        setModulePrefix: setModulePrefix,
        MouseInputInterpreter: MouseInputInterpreter
    };
});
