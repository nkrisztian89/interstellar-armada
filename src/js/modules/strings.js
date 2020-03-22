/**
 * Copyright 2016, 2020 Krisztián Nagy
 * @file A stateful module that stores translation strings for different languages for the application and provides functions to load these
 * strings from an object 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 0.1
 */

/*global define */

/**
 * @param types Used for parsing the string definition JSON with property and type verification
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
     * @typedef {Object} StringDefinitionObject Based on the property definition object in the types module.
     * @property {String} name The string is identified by this key.
     * @property {String} [defaultValue] The presence of this automatically makes the string optional.
     * @property {Boolean} [optional] To make the string optional without a default value.
     */
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
     * @param {String} language The (ID of) the language for which to load the strings.
     * @param {Object} stringsJSON This object needs to contain the strings for the given language. Structure:
     * {
     *   "categoryNameOne": {
     *     "stringNameOne": "stringEins"
     *   },
     *   "categoryNameTwo": {
     *     "stringNameTwo": "stringZwei",
     *     "subcategoryNameOne": {
     *       "anotherStringName": "anotherStringInGerman"
     *     }
     *   }
     * @param {Object} stringDefinitions This object is used to verify the content of the strings JSON. Its structure:
     * {
     *   "stringCategoryOne": {
     *     "stringWhichIsRequiredToBeInTheStringObject": {
     *       name: "categoryNameOne.stringNameOne"
     *     }
     *   },
     *   "stringCategoryTwo": {  
     *     "thisStringIsNotRequired": {
     *       name: "categoryNameTwo.stringNameTwo",
     *       defaultValue: "string2"
     *     },
     *     "thisIsNotRequiredEitherButItDoesntHaveAValue": {
     *       name: "categoryNameTwo.subcategoryNameOne.anotherStringName",
     *       optional: true
     *     }
     *   }
     *   The categories are matched based on what is given in the name property using dot notation, the categories in the definition object
     *   does not need to be organized the same way (can be just one big category)
     *   The format is based on the types module object definition format, see there for more details.
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
     * Returns the string identified by the passed definition object for the currently set language.
     * @param {StringDefinitionObject} stringDefinitionObject If there is no available string with the name specified in this object, the
     * default value specified in it will be returned (if it exists)
     * @param {String} [suffix] If given, will be appended at the end of the name specified in the definition object.
     * @param {String} [defaultValue] If given, will override the default value given in the definition object.
     * @returns {String}
     */
    exports.get = function (stringDefinitionObject, suffix, defaultValue) {
        return (_allStrings[_currentLanguage] && _allStrings[_currentLanguage][stringDefinitionObject.name + (suffix || "")]) ||
                defaultValue ||
                stringDefinitionObject.defaultValue ||
                (stringDefinitionObject.name + (suffix || ""));
    };
    /**
     * Returns whether there is a string set for given string definition in the current language.
     * @param {StringDefinitionObject} stringDefinitionObject
     * @param {String} [suffix]
     * @returns {Boolean}
     */
    exports.has = function (stringDefinitionObject, suffix) {
        return _allStrings[_currentLanguage] && (_allStrings[_currentLanguage][stringDefinitionObject.name + (suffix || "")] !== undefined);
    };
    exports.CATEGORY_SEPARATOR = CATEGORY_SEPARATOR;
    return exports;
});
