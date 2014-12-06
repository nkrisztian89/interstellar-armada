"use strict";

/**
 * @fileOverview Collection of some general utility functions used in different
 * modules.
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
 * @namespace The namespace holding the general utility functions.
 */
var Utils = Utils || {};
/**
 * Returns a [red,green,blue] array representing an RGB color based on the
 * data stored in the attributes of the passed XML tag.
 * @param {Element} tag
 * @returns {Number[3]}
 */
Utils.getRGBColorFromXMLTag = function (tag) {
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
Utils.getDimensionsFromXMLTag = function (tag) {
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
Utils.evaluateProduct = function (productExpression) {
    var operands = productExpression.split("*");
    var result = 1;
    for (var i = 0; i < operands.length; i++) {
        result *= parseFloat(operands[i]);
    }
    return result;
};