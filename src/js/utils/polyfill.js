/**
 * @fileOverview Polyfill functions for better cross-browser compatibility.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @version 1.0
 */

/**********************************************************************
 Copyright 2014-2016 Krisztián Nagy
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with this file.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

/*jslint plusplus: true */

(function polyfill() {
    "use strict";

    /**
     * Math.sign from ECMAScript 6, only implemented in Chrome and Firefox.
     * @param {Number} x
     * @returns {Number} Returns a 1 if the number is positive, -1 if it is negative,
     * 0 if it is 0, and NaN if it is not a number.
     */
    Math.sign = Math.sign || function (x) {
        x = +x; // convert to a number
        if (x === 0 || isNaN(x)) {
            return x;
        }
        return x > 0 ? 1 : -1;
    };

    /**
     * Math.log10 from ECMAScript 6, only implemented in Chrome, Firefox and recent
     * Opera.
     * @param {Number} x
     * @returns {Number}
     */
    Math.log10 = Math.log10 || function (x) {
        return Math.log(x) / Math.LN10;
    };

    /**
     * Math.log2 from ECMAScript 6, only implemented in Chrome, Firefox and recent
     * Opera.
     * @param {Number} x
     * @returns {Number}
     */
    Math.log2 = Math.log2 || function (x) {
        return Math.log(x) / Math.LN2;
    };

    /**
     * The seed of the standard random number function is not controllable, which
     * prevents consistent testing with the same pseudo random sample data. This
     * is a quick and relatively good replacement which returns a custom seeded
     * PRNG function.
     * @param {Number} s The seed the resulting function should use.
     * @returns {Function} A PRNG that returns pseudo random numbers between 0.0
     * and 1.0 with each call, and uses the supplied seed.
     */
    Math.seed = function (s) {
        return function () {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s);
        };
    };

    Math.radians = function (degrees) {
        return degrees * Math.PI / 180;
    };

    Math.degrees = function (radians) {
        return radians * 180 / Math.PI;
    };

    /**
     * Number.isInteger() from ECMAScript 6, not implemented in IE and Safari.
     * @param {Number} value
     * @returns {Boolean}
     */
    Number.isInteger = Number.isInteger || function (value) {
        return typeof value === "number" &&
                isFinite(value) &&
                Math.floor(value) === value;
    };

    /**
     * @typedef {Function} arrayFindCallback
     * @param {} element
     * @param {Number} index
     * @param {Array} array
     * @returns {Boolean}
     */
    /**
     * Returns the index of the first element stored in the array that passes the given test, or -1 if no elements pass the test.
     * @param {arrayFindCallback} callback The function to test the elements.
     * @param {Object} [thisArg] If given, this will be the value of this when the test function is called.
     * @returns {Number}
     */
    Array.prototype.findIndex = Array.prototype.findIndex || function (callback, thisArg) {
        var i;
        for (i = 0; i < this.length; i++) {
            if (callback.call(thisArg || callback, this[i], i, this)) {
                return i;
            }
        }
        return -1;
    };
    /**
     * Returns the first element stored in the array that passes the given test, or undefined if no elements pass the test.
     * @param {arrayFindCallback} callback The function to test the elements.
     * @param {Object} [thisArg] If given, this will be the value of this when the test function is called.
     * @returns {}
     */
    Array.prototype.find = Array.prototype.find || function (callback, thisArg) {
        var i;
        for (i = 0; i < this.length; i++) {
            if (callback.call(thisArg || callback, this[i], i, this)) {
                return this[i];
            }
        }
        return undefined;
    };


}());