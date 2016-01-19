"use strict";

/**
 * @fileOverview Polyfill functions for better cross-browser compatibility.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1-dev
 */

/**********************************************************************
 Copyright 2014 Krisztián Nagy
 
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
