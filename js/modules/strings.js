/**
 * Copyright 2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 0.1
 */

/*jslint nomen: true, white: true*/
/*global define */

/**
 * Used for parsing the string definition JSON with property and type verification
 * @param types
 * @param application Used for displaying error messages
 */
define([
    "utils/types",
    "modules/application"
], function (types, application) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            CATEGORY_SEPARATOR = ".",
            // ------------------------------------------------------------------------------
            // holder for the exported functions
            exports = {},
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * 
             * @type String
             */
            _currentLanguage = null,
            /**
             * 
             * @type Object
             */
            _requiredStrings = {},
            /**
             * 
             * @type Object
             */
            _allStrings = {};
    /**
     * Returns the currently used language
     * @returns {String}
     */
    exports.getLanguage = function () {
        return _currentLanguage;
    };
    /**
     * After calling this, strings will be returned in the given language (if loaded)
     * @param {String} value
     */
    exports.setLanguage = function (value) {
        if (_allStrings.hasOwnProperty(value)) {
            _currentLanguage = value;
        } else {
            application.showError("Cannot set language to '" + value + "', as there are no strings loaded for that language!");
        }
    };
    /**
     * Returns whether a strings file has been loaded for the specified language F
     * @param {String} language
     * @returns {Boolean}
     */
    exports.languageIsLoaded = function (language) {
        return _allStrings.hasOwnProperty(language);
    };
    /**
     * Recursively creates a flat JSON object out of the passed one by using concatenated keys (separated by a separator) instead of nested
     * objects (i.e. {"super": { "sub": "value" }} becomes {"super.sub": "value"})
     * @param {Object} categoryObject This object gets modified to be flat
     */
    function _flatten(categoryObject) {
        var categoryName, stringName;
        for (categoryName in categoryObject) {
            if (categoryObject.hasOwnProperty(categoryName) && (typeof categoryObject[categoryName] === "object")) {
                _flatten(categoryObject[categoryName]);
                for (stringName in categoryObject[categoryName]) {
                    if (categoryObject[categoryName].hasOwnProperty(stringName)) {
                        categoryObject[categoryName + CATEGORY_SEPARATOR + stringName] = categoryObject[categoryName][stringName];
                    }
                }
                // the original category object is deleted so it will not be processed
                delete categoryObject[categoryName];
            }
        }
    }
    /**
     * @param {String} language
     * @param {Object} stringsJSON
     * @param {Object} stringDefinitions
     */
    exports.loadStrings = function (language, stringsJSON, stringDefinitions) {
        var categoryName;
        _requiredStrings[language] = {};
        // first, keys organized into categories are moved up to the first level of the JSON structure, so the processing will need to handle
        // a simple flat JSON
        _flatten(stringsJSON);
        // now we handle the simple flat JSON containing all the strings by their keys
        for (categoryName in stringDefinitions) {
            if (stringDefinitions.hasOwnProperty(categoryName) && (typeof stringDefinitions[categoryName] === "object")) {
                types.getVerifiedObject("strings." + categoryName, stringsJSON, stringDefinitions[categoryName], _requiredStrings[language], false, true, "string");
            }
        }
        _allStrings[language] = types.getVerifiedObject("strings." + categoryName, stringsJSON, {}, null, true, true, "string");
        if (!_currentLanguage) {
            exports.setLanguage(language);
        }
    };
    /**
     * 
     * @param {Object} stringDefinitionObject
     * @param {String} [suffix]
     * @param {String} [defaultValue]
     * @returns {String}
     */
    exports.get = function (stringDefinitionObject, suffix, defaultValue) {
        return (_allStrings[_currentLanguage] && _allStrings[_currentLanguage][stringDefinitionObject.name + (suffix || "")]) ||
                defaultValue ||
                stringDefinitionObject.defaultValue ||
                (stringDefinitionObject.name + (suffix || ""));
    };
    /**
     * 
     * @param {Object} stringDefinitionObject
     * @param {String} [suffix]
     * @returns {Boolean}
     */
    exports.has = function (stringDefinitionObject, suffix) {
        return _allStrings[_currentLanguage] && (_allStrings[_currentLanguage][stringDefinitionObject.name + (suffix || "")] !== undefined);
    };
    exports.CATEGORY_SEPARATOR = CATEGORY_SEPARATOR;
    return exports;
});
