/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides some common functions to be used for the Interstellar Armada editor.
 * Interstellar Armada for the editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document */
/*jslint plusplus: true */

define(function () {
    "use strict";
    /**
     * @typedef {Object} Editor~Item
     * @property {String} (enum ItemType) type
     * @property {String} name
     * @property {String} category
     * @property {GenericResource|GenericClass} reference
     * @property {Object} data
     */
    /**
     * @typedef {Object} Editor~Preview
     * @property {Function} refresh
     * @property {Function} handleDataChanged
     */
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        /**
         * Creates and returns an HTML <select> element storing the given options (with the same value and text)
         * @param {String[]} options The options to include in the element
         * @param {String} selected The initial text of the element (should be one of the options)
         * @param {Boolean} includeNone If true, an additional, "none" option will be included as the first one
         * @param {Function} onchange The function to set as the element's onchange handler.
         * @returns {Element}
         */
        createSelector: function (options, selected, includeNone, onchange) {
            var result = document.createElement("select"), s, i;
            s = includeNone ? '<option value="none">none</option>' : '';
            for (i = 0; i < options.length; i++) {
                s += '<option value="' + options[i] + '">' + options[i] + '</option>';
            }
            result.innerHTML = s;
            if (selected) {
                result.value = selected;
            }
            result.onchange = onchange;
            return result;
        }
    };
});