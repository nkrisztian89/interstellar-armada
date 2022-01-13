/**
 * Copyright 2018-2022 Krisztián Nagy
 * @file Provides an input interpreter subclass (based on the base class provided by the generic control module) to
 * catch and process input from a touchscreen.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for formatting control strings and handling enums
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
            /**
             * An enumeration to define the main types of gestures that are available
             * @type Object
             */
            GestureType = {
                TAP: 0, // action is triggered when the user finishes a touch at (around) the same place it started within a short period of time
                LONG_TAP: 1, // action is triggered when the user finishes a touch at (around) the same place it started after a longer time
                TWO_POINT_TAP: 2, // action is triggered when the user finishes touches with two fingers at (around) the same places they started after a short period of time
                THREE_POINT_TAP: 3, // action is triggered when the user finishes touches with three fingers at (around) the same places they started after a short period of time
                HOLD: 4, // action is triggered while the user holds a finger on the screen (distance from the starting point is available as intensity)
                SLIDE: 5, // action is triggered continuously after the user touches and moves the finger (even after release),
                // with an intensity proportional to the passed distance  
                SWIPE: 6 // action is triggered when the user releases after swiping on the screen
            },
            // ----------------------------------------------------------------------
            // constants
            /** Tap gestures (except long tap) need to be finished within this much time to be triggered, in milliseconds
             * @type Number */
            SHORT_TAP_TIMEOUT = 300,
            /** Long tap gestures need to be finished within this much time to be triggered, in milliseconds
             * @type Number */
            LONG_TAP_TIMEOUT = 2000,
            /** Swipe gestures need to be finished within this much time to be triggered, in milliseconds
             * @type Number */
            SWIPE_TIMEOUT = 1000,
            /** The maximum distance between touch start and end positions for tap gestures to be triggered (across both X and Y axes), in pixels
             * @type Number */
            TAP_DEADZONE = 20,
            /** The minimum distance between touch start and end positions for hold and slide gestures to be triggered, in pixels
             * @type Number */
            MOVE_DEADZONE = 5,
            /** The default range value for hold and slide gestures (the _range property gets this value if it was not specified in the data - see property description for details)
             * @type Number */
            DEFAULT_MOVE_RANGE = 0.5,
            /** Some predefined areas that can be referenced by their keys in the touch binding definition objects
             * @type Object */
            TOUCH_AREA = {
                NONE: {x: [0, 0], y: [0, 0]},
                FULL: {x: [0, 1], y: [0, 1]},
                "top-left": {x: [0, 0.5], y: [0, 0.5]},
                "top-right": {x: [0.5, 1], y: [0, 0.5]},
                "bottom-left": {x: [0, 0.5], y: [0.5, 1]},
                "bottom-right": {x: [0.5, 1], y: [0.5, 1]},
                "left": {x: [0, 0.5], y: [0, 1]},
                "right": {x: [0.5, 1], y: [0, 1]}
            },
            DIRECTION_LEFT = "left",
            DIRECTION_RIGHT = "right",
            DIRECTION_UP = "up",
            DIRECTION_DOWN = "down",
            TOUCH_AREA_SUFFIX = "_touch_area",
            TOUCH_TYPE_SUFFIX = "_touch_type",
            TOUCH_MOVE_X_SUFFIX = "_touch_moveX",
            TOUCH_MOVE_Y_SUFFIX = "_touch_moveY",
            TOUCH_RANGE_SUFFIX = "_touch_range",
            // ----------------------------------------------------------------------
            // string definitions for translation of control strings
            TAP_STRING = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "tap",
                defaultValue: "tap {area} of the screen"
            },
            LONG_TAP_STRING = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "longTap",
                defaultValue: "long tap {area} of the screen"
            },
            TWO_POINT_TAP_STRING = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "twoPointTap",
                defaultValue: "tap {area} of the screen with two fingers"
            },
            THREE_POINT_TAP_STRING = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "threePointTap",
                defaultValue: "tap {area} of the screen with three fingers"
            },
            SWIPE_STRING = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "swipe",
                defaultValue: "swipe {direction} on {area} of the screen"
            },
            HOLD_STRING_NO_DIRECTION = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "hold",
                defaultValue: "tap and hold on {area} of the screen"
            },
            HOLD_STRING_WITH_DIRECTION = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "holdDirection",
                defaultValue: "swipe {direction} and hold on {area} of the screen"
            },
            SLIDE_STRING = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "slide",
                defaultValue: "slide {direction} on {area} of the screen"
            },
            TOUCH_DIRECTION_LEFT = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "leftDirection",
                defaultValue: "left"
            },
            TOUCH_DIRECTION_RIGHT = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "rightDirection",
                defaultValue: "right"
            },
            TOUCH_DIRECTION_UP = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "upDirection",
                defaultValue: "up"
            },
            TOUCH_DIRECTION_DOWN = {
                name: "touch" + strings.CATEGORY_SEPARATOR + "downDirection",
                defaultValue: "down"
            },
            // -------------------------------------------------------------------------
            // private variables
            /**
             * When saving to or loading from local storage, the names of any settings of this module will be prefixed by this string.
             * @type String
             */
            _modulePrefix = "";
    /**
     * @typedef {Object} ExtendedTouch
     * @property {Number} identifier 
     * @property {DOMHighResTimeStamp} startTime 
     * @property {Number} startX 
     * @property {Number} startY 
     * @property {Number} previousX 
     * @property {Number} previousY 
     * @property {Number} currentX 
     * @property {Number} currentY 
     * @property {Boolean} false
     * @property {TouchBinding} capturedBy
     * @property {Number} age 
     */
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
     * @class Represents the assignment of a touch action (gesture) to an in-game action. (such as fire)
     * @extends ControlBinding
     * @param {Object} [dataJSON] If given, the properties will be initialized from
     * the data stored in this JSON object.
     * @param {String} [profileName] The name of the input profile this binding
     * belongs to
     */
    function TouchBinding(dataJSON, profileName) {
        /**
         * The area on the screen where to touch for this gesture (like texture coordinates: [0,0] top left to [1,1] bottom right)
         * x (Number[2]): X range, y( Number[2]): Y range
         * @type Object
         */
        this._area = TOUCH_AREA.NONE;
        /**
         * (enum GestureType) What kind of gesture does the user need to make to trigger the action of this binding 
         * @type String
         */
        this._type = null;
        /**
         * The gesture (tap) needs to be finished within this amount of time (ms)
         * @type Number
         */
        this._timeout = 0;
        /**
         * How many fingers to touch with for this gesture
         * @type Number
         */
        this._count = 1;
        /**
         * For hold and slide gestures, the distance from the starting point at which intensity will be considered 1.0, as a ratio of the shorter side of the screen
         * (e.g. the value of 0.5 on a screen with 1920x1080 resolution will indicate a distance of 540 pixels)
         * @type Number
         */
        this._range = 0;
        /**
         * Marks the X direction of movement for swipe annd similar gestures (-1: left, 0: none, 1: right)
         * @type Number
         */
        this._moveX = 0;
        /**
         * Marks the Y direction of movement for swipe annd similar gestures (-1: up, 0: none, 1: down)
         * @type Number
         */
        this._moveY = 0;
        /**
         * The current X offset for slide gestures, in pixels (remember even while there are no active touches)
         * @type Number
         */
        this._currentX = 0;
        /**
         * The current Y offset for slide gestures, in pixels (remember even while there are no active touches)
         * @type Number
         */
        this._currentY = 0;
        /**
         * Touches captured for this gesture (for taps only)
         * @type Array
         */
        this._touches = [];
        /**
         * Cached value of the calculated area in pixels for the current viewport resolution
         * @type Number
         */
        this._areaPx = null;
        /**
         * Cached value of the calculated range in pixels for the current viewport resolution
         * @type Number
         */
        this._rangePx = 0;
        /**
         * Cached value of the reciprocal of the calculated range in pixels for the current viewport resolution
         * @type Number
         */
        this._rangeFactor = 0;
        control.ControlBinding.call(this, dataJSON, profileName);
    }
    TouchBinding.prototype = new control.ControlBinding();
    TouchBinding.prototype.constructor = TouchBinding;
    /**
     * @private
     * Calculates the values of properties that are derived from the one loaded from JSON / local storage
     * or just have fixed default values.
     */
    TouchBinding.prototype._initDerivedProperties = function () {
        this._areaPx = utils.deepCopy(this._area);
        switch (this._type) {
            case GestureType.TWO_POINT_TAP:
                this._count = 2;
                break;
            case GestureType.THREE_POINT_TAP:
                this._count = 3;
                break;
            default:
                this._count = 1;
        }
        this._timeout = (this._type === GestureType.LONG_TAP) ? LONG_TAP_TIMEOUT : SHORT_TAP_TIMEOUT;
        this._rangePx = 0;
        this._rangeFactor = 0;
        this._currentX = 0;
        this._currentY = 0;
    };
    /**
     * @override
     * Loads the properties of the binding as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    TouchBinding.prototype.loadFromJSON = function (dataJSON) {
        control.ControlBinding.prototype.loadFromJSON.call(this, dataJSON);
        if ((typeof dataJSON.area) === "string") {
            this._area = TOUCH_AREA[dataJSON.area];
        } else {
            this._area = TOUCH_AREA.FULL;
        }
        if ((typeof dataJSON.type) === "string") {
            this._type = utils.getSafeEnumValueForKey(GestureType, dataJSON.type);
        }
        this._range = dataJSON.range || DEFAULT_MOVE_RANGE;
        this._moveX = 0;
        this._moveY = 0;
        if ((typeof dataJSON.direction) === "string") {
            switch (dataJSON.direction) {
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
        }
        this._initDerivedProperties();
    };
    /**
     * @override
     * Saves the properties of this binding to HTML5 local storage.
     */
    TouchBinding.prototype.saveToLocalStorage = function () {
        localStorage[_modulePrefix + this._actionName + TOUCH_AREA_SUFFIX] = JSON.stringify(this._area);
        localStorage[_modulePrefix + this._actionName + TOUCH_TYPE_SUFFIX] = this._type;
        localStorage[_modulePrefix + this._actionName + TOUCH_MOVE_X_SUFFIX] = this._moveX;
        localStorage[_modulePrefix + this._actionName + TOUCH_MOVE_Y_SUFFIX] = this._moveY;
        localStorage[_modulePrefix + this._actionName + TOUCH_RANGE_SUFFIX] = this._range;
    };
    /**
     * @override
     * Loads the properties of the binding if they are stored in the HTML5 local
     * storage object.
     */
    TouchBinding.prototype.loadFromLocalStorage = function () {
        if (localStorage[_modulePrefix + this._actionName + TOUCH_TYPE_SUFFIX] !== undefined) {
            this._area = JSON.parse(localStorage[_modulePrefix + this._actionName + TOUCH_AREA_SUFFIX]);
            this._type = localStorage[_modulePrefix + this._actionName + TOUCH_TYPE_SUFFIX];
            this._moveX = parseInt(localStorage[_modulePrefix + this._actionName + TOUCH_MOVE_X_SUFFIX], 10);
            this._moveY = parseInt(localStorage[_modulePrefix + this._actionName + TOUCH_MOVE_Y_SUFFIX], 10);
            this._range = parseInt(localStorage[_modulePrefix + this._actionName + TOUCH_RANGE_SUFFIX], 10);
            this._initDerivedProperties();
        }
    };
    /**
     * @override
     * Removes the properties of this binding from the HTML5 local storage.
     */
    TouchBinding.prototype.removeFromLocalStorage = function () {
        localStorage.removeItem(_modulePrefix + this._actionName + TOUCH_AREA_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + TOUCH_TYPE_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + TOUCH_MOVE_X_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + TOUCH_MOVE_Y_SUFFIX);
        localStorage.removeItem(_modulePrefix + this._actionName + TOUCH_RANGE_SUFFIX);
    };
    /**
     * Updates the cached value for area and range checking for the current screen size.
     * @param {Number} width Width of the viewport, in pixels
     * @param {Number} height Height of the viewport, in pixels
     */
    TouchBinding.prototype.setScreenSize = function (width, height) {
        this._areaPx.x[0] = this._area.x[0] * width;
        this._areaPx.x[1] = this._area.x[1] * width;
        this._areaPx.y[0] = this._area.y[0] * height;
        this._areaPx.y[1] = this._area.y[1] * height;
        this._rangePx = this._range * Math.min(width, height);
        this._rangeFactor = 1 / (this._rangePx || 1);
    };
    /**
     * @private
     * @param {ExtendedTouch} touch
     * @returns {Boolean}
     */
    TouchBinding.prototype._touchStartedInArea = function (touch) {
        return (touch.startX >= this._areaPx.x[0]) && (touch.startX <= this._areaPx.x[1]) &&
                (touch.startY >= this._areaPx.y[0]) && (touch.startY <= this._areaPx.y[1]);
    };
    /**
     * Returns how much is the touch action triggered according to the current touch 
     * state passed as parameter. Touch actions can have different trigger intensities
     * (e.g. depending on distance from starting point for hold gesture), therefore the 
     * returned value is a number.
     * @param {Array.<ExtendedTouch>} touches The list of active touches (including 
     * the ones that ended since the last simulation step, with their finished property 
     * set to true
     * @returns {Number} Whether the action was triggered and with what intensity.
     * Zero means the action was not triggered, a positive value represents the 
     * intensity.
     */
    TouchBinding.prototype.getTriggeredIntensity = function (touches) {
        var i, touch, long, releaseCount;
        switch (this._type) {
            // single-point tap gestures are much simpler than multi finger ones, handle them separately
            case GestureType.TAP:
            case GestureType.LONG_TAP:
                // the touches are order by creation time, older touches are further back in the array, we are only interested
                // in the ones newer than our timeout value
                for (i = touches.length - 1; i >= 0; i--) {
                    touch = touches[i];
                    if (touch.age > this._timeout) {
                        return 0;
                    }
                    if ((touch.capturedBy === null) && (this._touchStartedInArea(touch)) &&
                            (Math.abs(touch.currentX - touch.startX) <= TAP_DEADZONE) &&
                            (Math.abs(touch.currentY - touch.startY) <= TAP_DEADZONE) && (touch.finished === true)) {
                        touch.capturedBy = this;
                        return 1;
                    }
                }
                return 0;
            case GestureType.TWO_POINT_TAP:
            case GestureType.THREE_POINT_TAP:
                // multi-point taps are handled in two steps:
                // first, we check if there were the right number of touches happening within the tap timeout
                // if so, we capture those touches, so other tap events will not be triggered based on them
                // we follow up if the touches are ended before the timout expires (and are not captured by
                // other bindings), and if so, trigger the action
                // capturing is reset each step!
                // this way a three-point tap can be defined earlier in the binding list, and it will capture 
                // the 3 touches every step before other events are processed, and so a two-point or single-point
                // tap binding later in the array will not trigger when the first one or two of those touches are ended
                // (e.g. menu opening is three-point tap on any part of the screen, it is defined as the first binding)
                if (this._touches.length > 0) {
                    // if we have captured our touches already, follow them up
                    releaseCount = 0;
                    for (i = 0; i < this._count; i++) {
                        touch = this._touches[i];
                        // if any of the touches expired or were captured by another binding (e.g. this is a two-point
                        // tap gesture, and a third tap started, and there is a three-point tap gesture defined as well,
                        // in that case that three-point gesture could capture the three taps so we cancel this one)
                        if ((touch.age > this._timeout) || ((touch.capturedBy !== null) && (touch.capturedBy !== this))) {
                            this._touches.length = 0;
                            return 0;
                        }
                        // count how many of the touches have already finished
                        if (touch.finished === true) {
                            releaseCount++;
                        }
                    }
                    // there were no expired or captured touches, so renew our capturing over them
                    for (i = 0; i < this._count; i++) {
                        this._touches[i].capturedBy = this;
                    }
                    // if all the touches have finished, we trigger and reset
                    if (releaseCount === this._count) {
                        this._touches.length = 0;
                        return 1;
                    }
                } else {
                    // if we have not captured our touches yet, look for applicable touches among the touch state
                    // since touches are added in the order they are started, the youngest ones are back in the array
                    for (i = touches.length - 1; i >= 0; i--) {
                        touch = touches[i];
                        // no more young enough touches available, break the loop
                        if (touch.age > this._timeout) {
                            break;
                        }
                        // check if this touch is applicable - in the right area, now a swipe, not captured
                        if ((touch.capturedBy === null) && (this._touchStartedInArea(touch)) &&
                                (Math.abs(touch.currentX - touch.startX) <= TAP_DEADZONE) &&
                                (Math.abs(touch.currentY - touch.startY) <= TAP_DEADZONE)) {
                            // if we haven't yet found enough touches, we add this one, but if there are more than what we need, cancel
                            // the process - an instant three-point tap does not qualify for a two-point tap
                            if (this._touches.length < this._count) {
                                this._touches.push(touch);
                            } else {
                                this._touches.length = 0;
                                return 0;
                            }
                        }
                    }
                    // if there are exactly the number of relevant touches that we need, we can capture them and continue with the follow-up
                    // branch from now on - otherwise, reset the process, keep looking
                    if (this._touches.length === this._count) {
                        for (i = 0; i < this._count; i++) {
                            this._touches[i].capturedBy = this;
                        }
                    } else {
                        this._touches.length = 0;
                        return 0;
                    }
                }
                return 0;
            case GestureType.SWIPE:
                // simply check if we have a finished touch that qualifies
                for (i = 0; i < touches.length; i++) {
                    touch = touches[i];
                    if (touch.finished === true) {
                        long = touch.age >= SWIPE_TIMEOUT;
                        if (!long && this._touchStartedInArea(touch) &&
                                ((((touch.currentX - touch.startX) > TAP_DEADZONE) && (this._moveX > 0)) ||
                                        (((touch.currentX - touch.startX) < -TAP_DEADZONE) && (this._moveX < 0)) ||
                                        (((touch.currentY - touch.startY) > TAP_DEADZONE) && (this._moveY > 0)) ||
                                        (((touch.currentY - touch.startY) < -TAP_DEADZONE) && (this._moveY < 0)))) {
                            return 1;
                        }
                    }
                }
                return 0;
            case GestureType.HOLD:
                // simply check if we have an ongoing touch that qualifies
                for (i = 0; i < touches.length; i++) {
                    touch = touches[i];
                    if ((touch.finished === false) && (this._touchStartedInArea(touch))) {
                        // cap intensity between 0 and 1
                        if (this._moveX > 0) {
                            return Math.min(Math.max(0, (touch.currentX - touch.startX - MOVE_DEADZONE) * this._rangeFactor), 1);
                        } else if (this._moveX < 0) {
                            return Math.min(Math.max(0, (touch.startX - touch.currentX - MOVE_DEADZONE) * this._rangeFactor), 1);
                        } else if (this._moveY > 0) {
                            return Math.min(Math.max(0, (touch.currentY - touch.startY - MOVE_DEADZONE) * this._rangeFactor), 1);
                        } else if (this._moveY < 0) {
                            return Math.min(Math.max(0, (touch.startY - touch.currentY - MOVE_DEADZONE) * this._rangeFactor), 1);
                        } else {
                            return 1;
                        }
                    }
                }
                break;
            case GestureType.SLIDE:
                // reset offset (currentX, currentY) on short touch:
                for (i = 0; i < touches.length; i++) {
                    touch = touches[i];
                    if (touch.finished === true) {
                        long = touch.age >= SHORT_TAP_TIMEOUT;
                        if (!long && this._touchStartedInArea(touch) &&
                                (Math.abs(touch.currentX - touch.startX) <= MOVE_DEADZONE) &&
                                (Math.abs(touch.currentY - touch.startY) <= MOVE_DEADZONE)) {
                            this._currentX = 0;
                            this._currentY = 0;
                            return 0;
                        }
                    }
                }
                // change offset (currentX, currentY) based on ongoing touch:
                for (i = 0; i < touches.length; i++) {
                    touch = touches[i];
                    if ((touch.finished === false) && (this._touchStartedInArea(touch))) {
                        this._currentX += touch.currentX - touch.previousX;
                        this._currentY += touch.currentY - touch.previousY;
                        if (this._currentX > this._rangePx + MOVE_DEADZONE) {
                            this._currentX = this._rangePx + MOVE_DEADZONE;
                        } else if (this._currentX < -this._rangePx - MOVE_DEADZONE) {
                            this._currentX = -this._rangePx - MOVE_DEADZONE;
                        }
                        if (this._currentY > this._rangePx + MOVE_DEADZONE) {
                            this._currentY = this._rangePx + MOVE_DEADZONE;
                        } else if (this._currentY < -this._rangePx - MOVE_DEADZONE) {
                            this._currentY = -this._rangePx - MOVE_DEADZONE;
                        }
                    }
                }
                // return the intensity (capped to 0-1 range) based on the current offset
                if (this._moveX > 0) {
                    return Math.min(Math.max(0, (this._currentX - MOVE_DEADZONE) * this._rangeFactor), 1);
                } else if (this._moveX < 0) {
                    return Math.min(Math.max(0, (-this._currentX - MOVE_DEADZONE) * this._rangeFactor), 1);
                } else if (this._moveY > 0) {
                    return Math.min(Math.max(0, (this._currentY - MOVE_DEADZONE) * this._rangeFactor), 1);
                } else if (this._moveY < 0) {
                    return Math.min(Math.max(0, (-this._currentY - MOVE_DEADZONE) * this._rangeFactor), 1);
                } else {
                    return 0;
                }
        }
        return 0;
    };
    /**
     * @override
     * Returns a string representation describing the action the user needs
     * to perform to trigger this binding.
     * @returns {String}
     */
    TouchBinding.prototype.getControlString = function () {
        var direction = "", area = "";
        if (this._moveX < 0) {
            direction = strings.get(TOUCH_DIRECTION_LEFT);
        } else if (this._moveX > 0) {
            direction = strings.get(TOUCH_DIRECTION_RIGHT);
        } else if (this._moveY < 0) {
            direction = strings.get(TOUCH_DIRECTION_UP);
        } else if (this._moveY > 0) {
            direction = strings.get(TOUCH_DIRECTION_DOWN);
        }
        area = strings.get(strings.TOUCH_AREA.PREFIX, utils.getKeyOfValue(TOUCH_AREA, this._area));
        switch (this._type) {
            case GestureType.TAP:
                return utils.formatString(strings.get(TAP_STRING), {area: area});
            case GestureType.LONG_TAP:
                return utils.formatString(strings.get(LONG_TAP_STRING), {area: area});
            case GestureType.TWO_POINT_TAP:
                return utils.formatString(strings.get(TWO_POINT_TAP_STRING), {area: area});
            case GestureType.THREE_POINT_TAP:
                return utils.formatString(strings.get(THREE_POINT_TAP_STRING), {area: area});
            case GestureType.SWIPE:
                return utils.formatString(strings.get(SWIPE_STRING), {area: area, direction: direction});
            case GestureType.HOLD:
                if ((this._moveX !== 0) || (this._moveY !== 0)) {
                    return utils.formatString(strings.get(HOLD_STRING_WITH_DIRECTION), {area: area, direction: direction});
                } else {
                    return utils.formatString(strings.get(HOLD_STRING_NO_DIRECTION), {area: area});
                }
            case GestureType.SLIDE:
                return utils.formatString(strings.get(SLIDE_STRING), {area: area, direction: direction});
        }
        return "";
    };
    /**
     * @override
     * Returns whether this binding has the same control configuration as the passed one (and so it conflicts with it)
     * @param {TouchBinding} otherBinding
     */
    TouchBinding.prototype.bindsTheSameControls = function (otherBinding) {
        return (this._type === otherBinding._type) &&
                (this._moveX === otherBinding._moveX) &&
                (this._moveY === otherBinding._moveY) &&
                utils.objectsEqual(this._area, otherBinding._area);
    };
    // #########################################################################
    /**
     * @class Monitors the touch input and stores the currently ongoing touches.
     * Can load and store touch bindings and based on the current state and the 
     * bindings, determine the list of currently triggered actions that controllers 
     * can/should execute.
     * @extends InputInterpreter
     * @param {Object} [dataJSON] Upon initialization, it can load the bindings from
     * this JSON object if specified.
     */
    function TouchInputInterpreter(dataJSON) {
        /**
         * The list of ongoing touches, and also the ones that have been ended
         * since the last processing step (getTriggeredActions() call)
         * @type Array.<ExtendedTouch>
         */
        this._touches = [];
        // Create bound event listeners
        this._handleTouchStart = this._handleTouchStart.bind(this);
        this._handleTouchMove = this._handleTouchMove.bind(this);
        this._handleTouchEnd = this._handleTouchEnd.bind(this);
        control.InputInterpreter.call(this, TouchBinding, dataJSON);
    }
    TouchInputInterpreter.prototype = new control.InputInterpreter();
    TouchInputInterpreter.prototype.constructor = TouchInputInterpreter;
    /**
     * @override
     * @returns {String}
     */
    TouchInputInterpreter.prototype.getDeviceName = function () {
        return "touch";
    };
    /**
     * @override
     */
    TouchInputInterpreter.prototype.resetState = function () {
        this._touches = [];
    };
    /**
     * Updates the cached values that depend on the screen size and are used to
     * e.g. check if touches fall inside screen regions. Needs to be called when 
     * the screen size changes.
     * @param {Number} x The X coordinate of the screen center, in pixels.
     * @param {Number} y The Y coordinate of the screen center, in pixels.
     */
    TouchInputInterpreter.prototype.setScreenCenter = function (x, y) {
        var i, keys;
        keys = Object.keys(this._currentProfile);
        for (i = 0; i < keys.length; i++) {
            this._currentProfile[keys[i]].setScreenSize(x * 2, y * 2);
        }
    };
    /**
     * @private
     * Creates and stores an ExtendedTouch object for the current state
     * @param {Touch} touch As acquired from the touch events
     * @param {DOMHighResTimestamp} now Current timestamp
     */
    TouchInputInterpreter.prototype._addTouch = function (touch, now) {
        this._touches.push({
            identifier: touch.identifier,
            startTime: now,
            startX: touch.clientX,
            startY: touch.clientY,
            previousX: touch.clientX,
            previousY: touch.clientY,
            currentX: touch.clientX,
            currentY: touch.clientY,
            finished: false,
            capturedBy: null,
            age: 0
        });
    };
    /**
     * @private
     * Updates the ExtendedTouch object corresponding to the passed Touch
     * (matched by identifier) in the current touches list
     * @param {Touch} touch As acquired from the touch events
     */
    TouchInputInterpreter.prototype._updateTouch = function (touch) {
        var i;
        // linear search is fine, this array will not really be larger than five elements
        for (i = 0; i < this._touches.length; i++) {
            if ((this._touches[i].identifier === touch.identifier) && (this._touches[i].finished === false)) {
                this._touches[i].currentX = touch.clientX;
                this._touches[i].currentY = touch.clientY;
                return;
            }
        }
    };
    /**
     * @private
     * Marks the ExtendedTouch object corresponding to the passed Touch
     * (matched by identifier) for removal from the current touches list (will
     * happen after the next processing of bindings)
     * @param {Touch} touch As acquired from the touch events
     */
    TouchInputInterpreter.prototype._removeTouch = function (touch) {
        var i;
        // linear search is fine, this array will not really be larger than five elements
        for (i = 0; i < this._touches.length; i++) {
            if (this._touches[i].identifier === touch.identifier) {
                this._touches[i].finished = true;
                return;
            }
        }
    };
    /**
     * @private
     * @param {TouchEvent} event
     * @returns {Boolean}
     */
    TouchInputInterpreter.prototype._handleTouchStart = function (event) {
        var i, now = performance.now();
        event.preventDefault();
        for (i = 0; i < event.changedTouches.length; i++) {
            this._addTouch(event.changedTouches[i], now);
        }
        return false;
    };
    /**
     * @private
     * @param {TouchEvent} event
     * @returns {Boolean}
     */
    TouchInputInterpreter.prototype._handleTouchMove = function (event) {
        var i;
        event.preventDefault();
        for (i = 0; i < event.changedTouches.length; i++) {
            this._updateTouch(event.changedTouches[i]);
        }
        return false;
    };
    /**
     * @private
     * @param {TouchEvent} event
     * @returns {Boolean}
     */
    TouchInputInterpreter.prototype._handleTouchEnd = function (event) {
        var i;
        event.preventDefault();
        for (i = 0; i < event.changedTouches.length; i++) {
            this._removeTouch(event.changedTouches[i]);
        }
        return false;
    };
    /**
     * @override
     * Sets the event handlers to react to touch events.
     * The triggered actions can be queried from this interpreter after this 
     * method has been called.
     */
    TouchInputInterpreter.prototype.startListening = function () {
        var options = {passive: false};
        control.InputInterpreter.prototype.startListening.call(this);
        document.addEventListener("touchstart", this._handleTouchStart, options);
        document.addEventListener("touchmove", this._handleTouchMove, options);
        document.addEventListener("touchend", this._handleTouchEnd, options);
        document.addEventListener("touchcancel", this._handleTouchEnd, options);
    };
    /**
     * @override
     * The input state will not be updated after this call.
     * The triggered actions cannot be queried from this interpreter after this 
     * function has been called.
     */
    TouchInputInterpreter.prototype.stopListening = function () {
        control.InputInterpreter.prototype.stopListening.call(this);
        document.removeEventListener("touchstart", this._handleTouchStart);
        document.removeEventListener("touchmove", this._handleTouchMove);
        document.removeEventListener("touchend", this._handleTouchEnd);
        document.removeEventListener("touchcancel", this._handleTouchEnd);
    };
    /**
     * @override
     * Checks if the action with the supplied name is triggered based on the current input state.
     * @param {String} actionName
     * @returns {(ActionTrigger|null)} Null, if the action is not triggered
     */
    TouchInputInterpreter.prototype.checkAction = function (actionName) {
        var intensity = this._currentProfile[actionName].getTriggeredIntensity(this._touches);
        if (intensity > 0) {
            return {
                name: actionName,
                intensity: intensity,
                source: this
            };
        }
        return null;
    };
    /**
     * @override
     * @param {Function} [actionFilterFunction] 
     * @returns {Object[][]}
     */
    TouchInputInterpreter.prototype.getTriggeredActions = function (actionFilterFunction) {
        var i, result, touch, now = performance.now();
        result = control.InputInterpreter.prototype.getTriggeredActions.call(this, actionFilterFunction);
        for (i = 0; i < this._touches.length; i++) {
            touch = this._touches[i];
            // we remove the touches finished since the last getTriggeredActions() call after letting
            // the bindings process them
            if (touch.finished) {
                this._touches.splice(i, 1);
                i--;
            } else {
                touch.previousX = touch.currentX;
                touch.previousY = touch.currentY;
                touch.age = now - touch.startTime;
                touch.capturedBy = null;
            }
        }
        return result;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        setModulePrefix: setModulePrefix,
        TouchInputInterpreter: TouchInputInterpreter
    };
});
