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

    var exports = {};
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

    return exports;
});