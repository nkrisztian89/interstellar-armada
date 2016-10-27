/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides various simple, general usage utility methods.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
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
            EMPTY_ARRAY = [],
            NUMBER_THOUSANDS_DELIMITER = " ",
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
                "a": 65, "b": 66, "c": 67, "d": 68, "e": 69, "f": 70, "g": 71, "h": 72, "i": 73, "j": 74,
                "k": 75, "l": 76, "m": 77, "n": 78, "o": 79, "p": 80, "q": 81, "r": 82, "s": 83, "t": 84,
                "u": 85, "v": 86, "w": 87, "x": 88, "y": 89, "z": 90,
                "left window": 91, "right window": 92, "select": 93,
                "numpad 0": 96, "numpad 1": 97, "numpad 2": 98, "numpad 3": 99, "numpad 4": 100,
                "numpad 5": 101, "numpad 6": 102, "numpad 7": 103, "numpad 8": 104, "numpad 9": 105,
                "*": 106, "numpad +": 107, "numpad -": 109, "/": 111,
                "f1": 112, "f2": 113, "f3": 114, "f4": 115, "f5": 116, "f6": 117, "f7": 118, "f8": 119, "f9": 120,
                "f10": 121, "f11": 122, "f12": 123,
                "-": 173, ",": 188, ".": 190
            },
            // ------------------------------------------------------------------------------
            // interface
            exports = {};
    // ------------------------------------------------------------------------------
    // public constants
    exports.EMPTY_ARRAY = EMPTY_ARRAY;
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
     * Converts the string to all uppercase and replaces spaces with underscores as well as inserts underscores before uppercase letters
     * @param {String} string
     * @returns {String}
     */
    exports.constantName = function (string) {
        var result = "", i;
        for (i = 0; i < string.length; i++) {
            if (string[i].match(/[A-Z]/)) {
                result += "_";
            }
            result += (string[i] === " ") ? "_" : string[i].toUpperCase();
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
     * Trears the passed string as a filename and returns the part of it that comes before its extension (if it has any).
     * @param {String} filename
     * @returns {String}
     */
    exports.getFilenameWithoutExtension = function (filename) {
        var dotIndex = filename.lastIndexOf(".");
        return (dotIndex > 0) ? filename.substr(0, dotIndex) : filename;
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
    return exports;
});