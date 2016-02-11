/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define */

define(function () {
    "use strict";
    var
            exports = {},
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
                "*": 106, "numpad '+'": 107, "numpad '-'": 109, "/": 111,
                "f1": 112, "f2": 113, "f3": 114, "f4": 115, "f5": 116, "f6": 117, "f7": 118, "f8": 119, "f9": 120,
                "f10": 121, "f11": 122, "f12": 123,
                "-": 173, ",": 188, ".": 190
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
     * Returns a value that is guaranteed to be among the possible values of an enumeration object.
     * @param {Object} enumObject
     * @param {any} value
     * @param {any} [defaultValue]
     * @returns {}
     */
    exports.getSafeEnumValue = function (enumObject, value, defaultValue) {
        var p;
        defaultValue = defaultValue ? this(enumObject, defaultValue) : null;
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
    return exports;
});