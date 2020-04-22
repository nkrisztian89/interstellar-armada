/**
 * Copyright 2014-2020 Krisztián Nagy
 * @file Provides various simple, general usage utility methods.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, setTimeout, NaN */

define(function () {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            /**
             * Indicates a method to be used when scaling a clip-space (or otherwise relative) coordinate to a viewport.
             * @enum {String}
             * @type Object
             */
            ScaleMode = {
                /**
                 * Scale the coordinate using the width of the viewport.
                 */
                WIDTH: "width",
                /**
                 * Scale the coordinate using the height of the viewport.
                 */
                HEIGHT: "height",
                /**
                 * Scale X coordinates using the width and Y coordinates using the height of the viewport.
                 */
                ASPECT: "aspect",
                /**
                 * Scale the coordinate using either the width or the height of the viewport, whichever is smaller.
                 */
                MINIMUM: "minimum",
                /**
                 * Scale the coordinate using either the width or the height of the viewport, whichever is larger.
                 */
                MAXIMUM: "maximum"
            },
            /**
             * A convenience enum storing the numeric mouse button identifiers as they appear in the "which" property of MouseEvent events
             * by meaningful names
             * @enum {Number}
             * @type Object
             */
            MouseButton = {
                LEFT: 1,
                MIDDLE: 2,
                RIGHT: 3
            },
            // ------------------------------------------------------------------------------
            // constants
            EMPTY_STRING = "",
            UNDERSCORE = "_",
            SPACE = " ",
            DASH = "-",
            EMPTY_ARRAY = [],
            EMPTY_OBJECT = {},
            NUMBER_THOUSANDS_DELIMITER = " ",
            DEG = 180 / Math.PI,
            RAD = Math.PI / 180,
            HALF_PI = 0.5 * Math.PI,
            DOUBLE_PI = 2 * Math.PI,
            // ------------------------------------------------------------------------------
            // private variables
            _keyCodeTable = {
                "backspace": 8,
                "tab": 9,
                "enter": 13,
                "shift": 16,
                "ctrl": 17,
                "alt": 18,
                "pause": 19,
                "caps lock": 20,
                "escape": 27,
                "space": 32,
                "page up": 33,
                "page down": 34,
                "end": 35,
                "home": 36,
                "left": 37,
                "up": 38,
                "right": 39,
                "down": 40,
                "insert": 45,
                "delete": 46,
                "0": 48, "1": 49, "2": 50, "3": 51, "4": 52, "5": 53, "6": 54, "7": 55, "8": 56, "9": 57,
                "A": 65, "B": 66, "C": 67, "D": 68, "E": 69, "F": 70, "G": 71, "H": 72, "I": 73, "J": 74,
                "K": 75, "L": 76, "M": 77, "N": 78, "O": 79, "P": 80, "Q": 81, "R": 82, "S": 83, "T": 84,
                "U": 85, "V": 86, "W": 87, "X": 88, "Y": 89, "Z": 90,
                "left window": 91, "right window": 92, "select": 93,
                "numpad 0": 96, "numpad 1": 97, "numpad 2": 98, "numpad 3": 99, "numpad 4": 100,
                "numpad 5": 101, "numpad 6": 102, "numpad 7": 103, "numpad 8": 104, "numpad 9": 105,
                "numpad *": 106, "numpad +": 107, "numpad -": 109, "numpad /": 111,
                "F1": 112, "F2": 113, "F3": 114, "F4": 115, "F5": 116, "F6": 117, "F7": 118, "F8": 119, "F9": 120,
                "F10": 121, "F11": 122, "F12": 123,
                ";": 186, "=": 187, ",": 188, "-": 189, ".": 190, "/": 191, "`": 192, "[": 219, "\\": 220, "]": 221, "'": 222
                // Firefox: "-": 173, "=": 61, ";": 59
            },
            // ------------------------------------------------------------------------------
            // interface
            exports = {};
    // ------------------------------------------------------------------------------
    // public constants
    exports.EMPTY_ARRAY = EMPTY_ARRAY;
    exports.EMPTY_STRING = EMPTY_STRING;
    exports.EMPTY_OBJECT = EMPTY_OBJECT;
    exports.DEG = DEG;
    exports.RAD = RAD;
    exports.HALF_PI = HALF_PI;
    exports.DOUBLE_PI = DOUBLE_PI;
    // ------------------------------------------------------------------------------
    // public enums
    exports.ScaleMode = ScaleMode;
    exports.MouseButton = MouseButton;
    // ------------------------------------------------------------------------------
    // public functions
    /**
     * Returns whether generic coordinates or sizes (in cases where there is no separate X and Y and thus no aspect scaling possible, such
     * as for font sizes) should scale with the width of the viewport according to the passed scaling mode, if the viewport has the passed
     * size.
     * @param {ScaleMode} scaleMode
     * @param {Number} width
     * @param {Number} height
     * @returns {Boolean}
     */
    exports.scalesWithWidth = function (scaleMode, width, height) {
        return ((scaleMode === ScaleMode.WIDTH) || ((scaleMode === ScaleMode.MINIMUM) && (width < height)) || ((scaleMode === ScaleMode.MAXIMUM) && (width >= height)));
    };
    /**
     * Returns whether X coordinates or widths should scale with the width of the viewport according to the passed scaling mode, if the 
     * viewport has the passed size.
     * @param {ScaleMode} scaleMode
     * @param {Number} width
     * @param {Number} height
     * @returns {Boolean}
     */
    exports.xScalesWithWidth = function (scaleMode, width, height) {
        return ((scaleMode === ScaleMode.ASPECT) || (scaleMode === ScaleMode.WIDTH) || ((scaleMode === ScaleMode.MINIMUM) && (width < height)) || ((scaleMode === ScaleMode.MAXIMUM) && (width >= height)));
    };
    /**
     * Returns whether Y coordinates or heights should scale with the height of the viewport according to the passed scaling mode, if the 
     * viewport has the passed size.
     * @param {ScaleMode} scaleMode
     * @param {Number} width
     * @param {Number} height
     * @returns {Boolean}
     */
    exports.yScalesWithHeight = function (scaleMode, width, height) {
        return ((scaleMode === ScaleMode.ASPECT) || (scaleMode === ScaleMode.HEIGHT) || ((scaleMode === ScaleMode.MINIMUM) && (height < width)) || ((scaleMode === ScaleMode.MAXIMUM) && (height >= width)));
    };
    /**
     * Returns a [red,green,blue] array representing an RGB color based on the
     * data stored in the attributes of the passed XML tag.
     * @param {Element} tag
     * @returns {Number[3]}
     */
    exports.getRGBColorFromXMLTag = function (tag) {
        return [
            parseFloat(tag.getAttribute("r")),
            parseFloat(tag.getAttribute("g")),
            parseFloat(tag.getAttribute("b"))
        ];
    };
    /**
     * Returns a [width,height,depth] array representing an 3D dimensions based on the
     * data stored in the attributes of the passed XML tag.
     * @param {Element} tag
     * @returns {Number[3]}
     */
    exports.getDimensionsFromXMLTag = function (tag) {
        return [
            parseFloat(tag.getAttribute("w")),
            parseFloat(tag.getAttribute("h")),
            parseFloat(tag.getAttribute("d"))
        ];
    };
    /**
     * Evaluates mathematically the string representation of a simple expression 
     * containing only multiplication operators and floating point numbers (and
     * possibly space characters), and returns the result.
     * @param {String} productExpression
     * @returns {Number}
     */
    exports.evaluateProduct = function (productExpression) {
        var operands, result, i;
        operands = productExpression.split("*");
        result = 1;
        for (i = 0; i < operands.length; i++) {
            result *= parseFloat(operands[i]);
        }
        return result;
    };
    /**
     * Returns the first XML element under the passed parent element (or XML
     * document root element, if a document was passed) that has the passed
     * tag name, if it exists. If no element with the passed tag name was
     * found, shows an error to the user.
     * @param {Document|Element} parent
     * @param {String} tagName
     * @returns {Element}
     */
    exports.getFirstXMLElement = function (parent, tagName) {
        var elements = parent.getElementsByTagName(tagName);
        if (elements.length > 0) {
            return elements[0];
        }
        return null;
    };
    /**
     * Returns the key code of the key passed in human readable string form.
     * @see KeyboardInputInterpreter#getKeyCodeTable
     * @param {String} key
     * @returns {Number}
     */
    exports.getKeyCodeOf = function (key) {
        return key ?
                (key[0] === "#" ?
                        parseInt(key.slice(1), 10) :
                        _keyCodeTable[key]) :
                -1;
    };
    /**
     * Returns the key in human readable string form corresponding to the key code
     * passed as parameter.
     * @see KeyboardInputInterpreter#getKeyCodeTable
     * @param {Number} keyCode
     * @returns {String}
     */
    exports.getKeyOfCode = function (keyCode) {
        var key;
        for (key in _keyCodeTable) {
            if (_keyCodeTable[key] === keyCode) {
                return key;
            }
        }
        return "#" + keyCode;
    };
    /**
     * Compares whether two arrays contain the same values in the same order. Checks for nested arrays as well.
     * @param {Array} array1
     * @param {Array} array2
     * @returns {Boolean}
     */
    exports.arraysEqual = function (array1, array2) {
        var i, l;
        if (!array2) {
            return false;
        }
        if (array1.length !== array2.length) {
            return false;
        }
        for (i = 0, l = array1.length; i < l; i++) {
            // Check if we have nested arrays
            if (array1[i] instanceof Array && array2[i] instanceof Array) {
                if (!array1[i].equals(array2[i])) {
                    return false;
                }
            } else if (array1[i] !== array2[i]) {
                return false;
            }
        }
        return true;
    };
    /**
     * Compares whether two objects have the same own enumerable properties with the same values.
     * Values of properties are checked strictly! Properties that point to equivalent, but different objects or arrays are considered 
     * different.
     * @param {Object} object1
     * @param {Object} object2
     * @returns {Boolean}
     */
    exports.objectsEqual = function (object1, object2) {
        var keys1, keys2, i;
        if ((object1 === null) && (object2 === null)) {
            return true;
        }
        if (object1) {
            keys1 = Object.keys(object1).sort();
        } else {
            return false;
        }
        if (object2) {
            keys2 = Object.keys(object2).sort();
        } else {
            return false;
        }
        if (keys1.length !== keys2.length) {
            return false;
        }
        for (i = 0; i < keys1.length; i++) {
            if ((keys1[i] !== keys2[i]) || (object1[keys1[i]] !== object2[keys2[i]])) {
                return false;
            }
        }
        return true;
    };
    /**
     * Checks whether the passed two variables are equivalent. That is, they have the same value or they refer to objects / arrays that
     * have equivalent properties / elements (even if the reference itself is different) 
     * The types of the two values must be the same.
     * @param {} a
     * @param {} b
     * @returns {Boolean}
     */
    exports.equivalent = function (a, b) {
        var i, l, ka, kb;
        // objects and arrays are (recursively) compared based on the equivalency of their properties / elements
        if (((typeof a) === "object") && ((typeof b) === "object")) {
            if ((a === null) || (b === null)) {
                return (a === b);
            }
            if ((a instanceof Array) && (b instanceof  Array)) {
                if (a.length !== b.length) {
                    return false;
                }
                for (i = 0, l = a.length; i < l; i++) {
                    if (!exports.equivalent(a[i], b[i])) {
                        return false;
                    }
                }
                return true;
            }
            ka = Object.keys(a).sort();
            kb = Object.keys(b).sort();
            if (ka.length !== kb.length) {
                return false;
            }
            for (i = 0, l = ka.length; i < l; i++) {
                if ((ka[i] !== kb[i]) || !exports.equivalent(a[ka[i]], b[kb[i]])) {
                    return false;
                }
            }
            return true;
        }
        // primitives are strictly checked (types must be the same, "1" is not equivalent to 1)
        return a === b;
    };
    /**
     * Returns a shallow copy of the passed data
     * @param {} data Any type of data
     * @returns {}
     */
    exports.shallowCopy = function (data) {
        var result, i, propertyNames;
        if (typeof data === "object") {
            if (data instanceof Array) {
                return data.slice();
            }
            result = {};
            propertyNames = Object.keys(data);
            for (i = 0; i < propertyNames.length; i++) {
                result[propertyNames[i]] = data[propertyNames[i]];
            }
            return result;
        }
        return data;
    };
    /**
     * Returns a deep copy (recursive copy by values) of the passed data
     * @param {} data Any type of data
     * @returns {}
     */
    exports.deepCopy = function (data) {
        var result, i, propertyNames;
        if (typeof data === "object") {
            if (data instanceof Array) {
                result = [];
                for (i = 0; i < data.length; i++) {
                    result.push(exports.deepCopy(data[i]));
                }
                return result;
            }
            result = {};
            propertyNames = Object.keys(data);
            for (i = 0; i < propertyNames.length; i++) {
                result[propertyNames[i]] = exports.deepCopy(data[propertyNames[i]]);
            }
            return result;
        }
        return data;
    };
    /**
     * Removes the passed element from the passed array, if it is a part of it
     * @param {Array} array
     * @param {} element
     * @returns {Boolean} Whether the element was found and removed
     */
    exports.removeFromArray = function (array, element) {
        var index = array.indexOf(element);
        if (index >= 0) {
            array.splice(index, 1);
            return true;
        }
        return false;
    };
    /**
     * Returns a value that is guaranteed to be among the possible values of an enumeration object.
     * @param {Object} enumObject
     * @param {any} value
     * @param {any} [defaultValue]
     * @returns {}
     */
    exports.getSafeEnumValue = function (enumObject, value, defaultValue) {
        var p;
        defaultValue = defaultValue ? exports.getSafeEnumValue(enumObject, defaultValue) : null;
        for (p in enumObject) {
            if (enumObject.hasOwnProperty(p)) {
                if (value === enumObject[p]) {
                    return value;
                }
            }
        }
        return defaultValue || null;
    };
    /**
     * Returns a value that is guaranteed to be among the possible values of an enumeration object.
     * @param {Object} enumObject
     * @param {String} key The key for the value - this will be converted to a constant name!
     * @param {any} [defaultValue]
     * @returns {any}
     */
    exports.getSafeEnumValueForKey = function (enumObject, key, defaultValue) {
        defaultValue = (defaultValue !== undefined) ? exports.getSafeEnumValue(enumObject, defaultValue) : null;
        key = exports.constantName(key);
        if (enumObject.hasOwnProperty(key)) {
            return enumObject[key];
        }
        return (defaultValue !== undefined) ? defaultValue : null;
    };
    /**
     * Returns an array of the possible values of an object serving as an enum.
     * @param {Object} enumObject
     * @returns {Array}
     */
    exports.getEnumValues = function (enumObject) {
        var result = [], p;
        for (p in enumObject) {
            if (enumObject.hasOwnProperty(p)) {
                result.push(enumObject[p]);
            }
        }
        return result;
    };
    /**
     * Returns an array with the possible keys of an enum definition object,
     * converted to camelCase.
     * E.g. {VALUE: 1, OTHER_VALUE: 2} -> ["value", "otherValue"]
     * @param {Object} enumObject
     * @returns {Array}
     */
    exports.getEnumKeys = function (enumObject) {
        var result = Object.keys(enumObject), i;
        for (i = 0; i < result.length; i++) {
            result[i] = exports.camelCase(result[i]);
        }
        return result;
    };
    /**
     * Returns an object that can be used as an enum definition object with the
     * valid enum values being the strings in the passed array.
     * @param {String[]} enumValues
     * @returns {Object}
     */
    exports.getEnumObject = function (enumValues) {
        var result = {}, i;
        for (i = 0; i < enumValues.length; i++) {
            result[enumValues[i]] = enumValues[i];
        }
        return result;
    };
    /**
     * Returns the key of a property of the given object that has the given value, if any.
     * @param {Object} obj
     * @param {} value
     * @returns {String}
     */
    exports.getKeyOfValue = function (obj, value) {
        var key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (obj[key] === value) {
                    return key;
                }
            }
        }
        return null;
    };
    /**
     * Returns a string converted from the given number, padded by "0"s at the beginning, if it has fewer digits than specified
     * @param {Number} num The number to convert to string
     * @param {Number} digits The minimum amount of digits the resulting string should contain
     * @param {Number} [radix=10] The base of the numeric system to use (e.g. 16 for hex)
     * @returns {String}
     */
    exports.getPaddedStringForNumber = function (num, digits, radix) {
        var i, result = num.toString(radix || 10);
        for (i = result.length; i < digits; i++) {
            result = "0" + result;
        }
        return result;
    };
    /**
     * Returns a string converted from the given number, with NUMBER_THOUSANDS_DELIMITER inserted after every 3 digits left of the decimal
     * mark
     * @param {Number} num
     * @returns {String}
     */
    exports.getDelimitedStringForNumber = function (num) {
        if (num >= 1000) {
            return exports.getDelimitedStringForNumber(Math.floor(num / 1000)) + NUMBER_THOUSANDS_DELIMITER + exports.getPaddedStringForNumber(num % 1000, 3);
        }
        return num.toString();
    };
    /**
     * Returns a string describing a length (distance) in human-readable form based on its value in meters.
     * @param {Number} lengthInMeters
     * @returns {String}
     */
    exports.getLengthString = function (lengthInMeters) {
        return (lengthInMeters < 2000) ?
                ((lengthInMeters < 100) ?
                        lengthInMeters.toPrecision(3) + " m" :
                        Math.round(lengthInMeters) + " m") :
                ((lengthInMeters < 100000) ?
                        (lengthInMeters / 1000).toPrecision(3) + " km" :
                        exports.getDelimitedStringForNumber(Math.round(lengthInMeters / 1000)) + " km");
    };
    /**
     * Returns a string describing a mass (weight) in human-readable form based on its value in kilograms.
     * @param {Number} massInKilograms
     * @returns {String}
     */
    exports.getMassString = function (massInKilograms) {
        return (massInKilograms < 2000) ?
                ((massInKilograms < 100) ?
                        massInKilograms.toPrecision(3) + " kg" :
                        Math.round(massInKilograms) + " kg") :
                ((massInKilograms < 100000) ?
                        (massInKilograms / 1000).toPrecision(3) + " t" :
                        exports.getDelimitedStringForNumber(Math.round(massInKilograms / 1000)) + " t");
    };
    /**
     * Returns a string describing a time (duration) in human-readable form based on its value in milliseconds.
     * @param {Number} timeInMs
     * @returns {String}
     */
    exports.getTimeString = function (timeInMs) {
        return (timeInMs < 1000) ?
                timeInMs + " ms" :
                ((timeInMs < 60000) ?
                        (Math.round(timeInMs / 10) / 100) + " s" :
                        exports.formatTimeToMinutes(timeInMs));
    };
    /**
     * Converts the string to all uppercase and replaces spaces and dashes with underscores as well as inserts underscores before uppercase letters
     * @param {String} string
     * @returns {String}
     */
    exports.constantName = function (string) {
        var result = "", i;
        for (i = 0; i < string.length; i++) {
            if (string[i].match(/[A-Z]/)) {
                result += UNDERSCORE;
            }
            result += ((string[i] === SPACE) || (string[i] === DASH)) ? UNDERSCORE : string[i].toUpperCase();
        }
        return result;
    };
    /**
     * Converts the passed string from CONSTANT_NAME_FORMAT to camelCaseFormat
     * @param {String} string
     * @returns {String}
     */
    exports.camelCase = function (string) {
        var result = "", i, capital = false;
        for (i = 0; i < string.length; i++) {
            if (string[i] === UNDERSCORE) {
                capital = true;
            } else {
                result += capital ? string[i] : string[i].toLowerCase();
                capital = false;
            }
        }
        return result;
    };
    /**
     * Replaces parts of a string marked by curly braces with the properties of the passed object
     * that have the same name as indicated between the curly braces and returns the resulting
     * string. (e.g. Called with "Hello, {name}!", {name: "Peter"} parameters, will return "Hello, Peter!")
     * @param {String} string
     * @param {Object} replacements
     * @returns {String}
     */
    exports.formatString = function (string, replacements) {
        var replacementName, str = string.toString();
        for (replacementName in replacements) {
            if (replacements.hasOwnProperty(replacementName)) {
                str = str.replace(new RegExp("\\{" + replacementName + "\\}", "gi"), replacements[replacementName]);
            }
        }
        return str;
    };
    /**
     * Returns a MM:SS format string representing the time duration / interval of the passed amount of milliseconds
     * (if longer than 60 minutes, the full amount will be in minutes, e.g. 120:00 would be 2 hours)
     * @param {Number} milliseconds
     * @returns {String}
     */
    exports.formatTimeToMinutes = function (milliseconds) {
        var min, sec;
        min = Math.floor(milliseconds / 60000);
        sec = Math.floor(milliseconds / 1000) % 60;
        return exports.getPaddedStringForNumber(min, 2) + ":" + exports.getPaddedStringForNumber(sec, 2);
    };
    /**
     * Returns a SS.mm format string representing the time duration / interval of the passed amount of milliseconds
     * (if longer than 60 seconds, the extra time will be ignored)
     * @param {Number} milliseconds
     * @returns {String}
     */
    exports.formatTimeToSeconds = function (milliseconds) {
        var sec, ms;
        sec = Math.floor(milliseconds / 1000) % 60;
        ms = Math.floor((milliseconds % 1000) / 10);
        return exports.getPaddedStringForNumber(sec, 2) + "." + exports.getPaddedStringForNumber(ms, 2);
    };
    /**
     * Adds the passed function to the event queue without any delay.
     * @param {Function} functionToExecute
     */
    exports.executeAsync = function (functionToExecute) {
        setTimeout(functionToExecute, 0);
    };
    /**
     * Returns whether a given 2D point is within a given 2D rectangle.
     * @param {Number} x The X coordinate of the point to check.
     * @param {Number} y The Y coordinate of the point to check.
     * @param {Number} left The X coordinate of the left side of the rectangle.
     * @param {Number} bottom The Y coordinate of the bottom side of the rectangle. (the smaller Y coordinate)
     * @param {Number} right The X coordinate of the right side of the rectangle.
     * @param {Number} top The Y coordinate of the bottom side of the rectangle. (the larger Y coordinate)
     * @returns {Boolean}
     */
    exports.pointInRect = function (x, y, left, bottom, right, top) {
        return (x >= left) && (x <= right) && (y >= bottom) && (y <= top);
    };
    /**
     * Extracts the part after folders and before the extension from the passed file path and returns it.
     * @param {String} path
     * @returns {String}
     */
    exports.getFilenameWithoutExtension = function (path) {
        var dotIndex = path.lastIndexOf("."), slashIndex = path.lastIndexOf("/");
        path = (dotIndex > 0) ? path.substr(0, dotIndex) : path;
        path = (slashIndex > 0) ? path.substr(slashIndex + 1) : path;
        return path;
    };
    /**
     * 
     * @param {Number} value1
     * @param {Number} value2
     * @param {Number} value2Ratio
     * @returns {Number}
     */
    exports.getLinearMix = function (value1, value2, value2Ratio) {
        return value1 * (1 - value2Ratio) + value2 * value2Ratio;
    };
    /**
     * Returns an RGBA color that is the result of mixing the two passed RGBA colors with the second color
     * having the given ratio. (using a simple linear combination of the components of the colors)
     * @param {Number[4]} color1
     * @param {Number[4]} color2
     * @param {Number} color2Ratio A number between 0.0 and 1.0 indicating the relative amount of the second
     * color in the result.
     * @returns {Number[4]}
     */
    exports.getMixedColor = function (color1, color2, color2Ratio) {
        var color1Ratio = 1 - color2Ratio;
        return [
            color1[0] * color1Ratio + color2[0] * color2Ratio,
            color1[1] * color1Ratio + color2[1] * color2Ratio,
            color1[2] * color1Ratio + color2[2] * color2Ratio,
            color1[3] * color1Ratio + color2[3] * color2Ratio
        ];
    };
    /**
     * Returns the luminance value of the passed RGB color
     * @param {Number[3]} color
     * @returns {Number}
     */
    exports.getLuminance = function (color) {
        return 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];
    };
    /**
     * Multiplies the given RGBA color with the given RGBA filter and also returns it.
     * @param {Number[4]} color
     * @param {Number[4]} filter
     * @returns {Number[4]} The modified color
     */
    exports.filterColor = function (color, filter) {
        color[0] *= filter[0];
        color[1] *= filter[1];
        color[2] *= filter[2];
        color[3] *= filter[3];
        return color;
    };
    /**
     * Applies the given gamma correction to the given color, and returns the modified color.
     * @param {Number[3]} color
     * @param {Number} gamma
     * @returns {Number[3]}
     */
    exports.gammaCorrect = function (color, gamma) {
        color[0] = Math.pow(color[0], 1.0 / gamma);
        color[1] = Math.pow(color[1], 1.0 / gamma);
        color[2] = Math.pow(color[2], 1.0 / gamma);
        return color;
    };
    /**
     * Converts the passed RGBA color from a 4 component float vector format to a string that can be used to set that color in CSS.
     * @param {Number[4]} color
     * @returns {String}
     */
    exports.getCSSColor = function (color) {
        return "rgba(" +
                Math.round(color[0] * 255) + "," +
                Math.round(color[1] * 255) + "," +
                Math.round(color[2] * 255) + "," +
                color[3] + ")";
    };
    /**
     * Converts the given, 3 component float color to a hex string (such as "#ff0000")
     * @param {Number[3]} color
     * @returns {String}
     */
    exports.getHexColor = function (color) {
        return "#" +
                exports.getPaddedStringForNumber(Math.round(color[0] * 255), 2, 16) +
                exports.getPaddedStringForNumber(Math.round(color[1] * 255), 2, 16) +
                exports.getPaddedStringForNumber(Math.round(color[2] * 255), 2, 16);
    };
    /**
     * Convert the given hex color string (such as "#ff0000") to a 3 component float color
     * @param {String} hexColor
     * @returns {Number[3]}
     */
    exports.getColor3FromHex = function (hexColor) {
        var result = [0, 0, 0];
        result[0] = parseInt(hexColor.substr(1, 2), 16) / 255;
        result[1] = parseInt(hexColor.substr(3, 2), 16) / 255;
        result[2] = parseInt(hexColor.substr(5, 2), 16) / 255;
        return result;
    };
    /**
     * Solves the quadratic equation a * x^2 + b * x + c = 0 for x, and returns the greater of the two solutions. Returns NaN if there is
     * no solution.
     * @param {Number} a
     * @param {Number} b
     * @param {Number} c
     * @returns {Number}
     */
    exports.getGreaterSolutionOfQuadraticEquation = function (a, b, c) {
        var d = b * b - 4 * a * c;
        return (d >= 0) ? ((Math.sqrt(d) - b) / (2 * a)) : NaN;
    };
    /**
     * Solves the 4th degree equation a * x^4 + c * x^2 + d * x + e = 0 for x, and returns the smallest positive,
     * non-complex solution (or NaN, if such a solution doesn't exist)
     * @param {Number} a
     * @param {Number} c
     * @param {Number} d
     * @param {Number} e
     * @returns {Number}
     */
    exports.getSmallestPositiveSolutionOf4thDegreeEquationWithoutDegree3 = function (a, c, d, e) {
        var 
            A = c / a,
            B = d / a,
            C = e / a,
            P = -(A * A / 48) - (C / 4),
            Q = -(A * A * A / 864) - (B * B / 64) + (A * C / 24),
            delta = (Q * Q / 4) + (P * P * P / 27),
            sqrtDelta, u, v, w, aux, x1, x2, Y1, Y2, Y3, x3, x4;
        if (delta >= 0) {
            if ((B === 0) && (A > 0) && (C === (A * A / 4))) {
                return NaN;
            } else {
                sqrtDelta = Math.sqrt(delta);
                u = Math.cbrt(-Q / 2 + sqrtDelta);
                v = Math.cbrt(-Q / 2 - sqrtDelta);
                aux = (A / 6) + 2 * (u + v);
                w = Math.sqrt(-(A / 3) - (u + v) + Math.sqrt(aux * aux - C));
                aux = ((B > 0) ? -1 : 1) * Math.sqrt(-(A / 6) + u + v);
                x1 = aux + w;
                x2 = aux - w;
                if (x1 < 0) {
                    return x2;
                } else if (x2 < 0) {
                    return x1;
                } else {
                    return Math.min(x1, x2);
                }
            }
        } else {
            aux = 2 * Math.sqrt(-P / 3);
            w = 1 / 3 * Math.acos(-Q / 2 / Math.sqrt(-Math.pow(P / 3, 3)));
            Y1 = -(A / 6) + aux * Math.cos(w);
            Y2 = -(A / 6) + aux * Math.cos(2 * Math.PI / 3 + w);
            Y3 = -(A / 6) + aux * Math.cos(4 * Math.PI / 3 + w);
            if ((C > (A * A / 4)) || (A > 0)) {
                return NaN;
            } else {
                aux = ((B > 0) ? -1 : 1) * Math.sqrt(Y1);
                Y2 = Math.sqrt(Y2);
                Y3 = Math.sqrt(Y3);
                w = Y2 + Y3;
                x1 = aux + w;
                x2 = aux - w;
                w = Y2 - Y3;
                x3 = -aux + w;
                x4 = -aux - w;
                if (x1 < 0) {
                    if (x2 < 0) {
                        if (x3 < 0) {
                            if (x4 < 0) {
                                return NaN;
                            } else {
                                return x4;
                            }
                        } else {
                            if (x4 < 0) {
                                return x3;
                            } else {
                                return Math.min(x3, x4);
                            }
                        }
                    } else {
                        if (x3 < 0) {
                            if (x4 < 0) {
                                return x2;
                            } else {
                                return Math.min(x2, x4);
                            }
                        } else {
                            if (x4 < 0) {
                                return Math.min(x2, x3);
                            } else {
                                return Math.min(x2, x3, x4);
                            }
                        }
                    }
                } else {
                    if (x2 < 0) {
                        if (x3 < 0) {
                            if (x4 < 0) {
                                return x1;
                            } else {
                                return Math.min(x1, x4);
                            }
                        } else {
                            if (x4 < 0) {
                                return Math.min(x1, x3);
                            } else {
                                return Math.min(x1, x3, x4);
                            }
                        }
                    } else {
                        if (x3 < 0) {
                            if (x4 < 0) {
                                return Math.min(x1, x2);
                            } else {
                                return Math.min(x1, x2, x4);
                            }
                        } else {
                            if (x4 < 0) {
                                return Math.min(x1, x2, x3);
                            } else {
                                return Math.min(x1, x2, x3, x4);
                            }
                        }
                    }
                }
            }
        }
    };
    /**
     * Returns whether the current environment supports touch events
     * @returns {Boolean}
     */
    exports.areTouchEventsSupported = function () {
        return "ontouchstart" in window;
    };
    return exports;
});