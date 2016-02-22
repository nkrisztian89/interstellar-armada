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
            exports = {},
            /**
             * 
             * @type String
             */
            _currentLanguage = null,
            /**
             * 
             * @type Object
             */
            _strings = {};
    /**
     * 
     * @param {String} value
     */
    exports.setLanguage = function (value) {
        if (_strings.hasOwnProperty(value)) {
            _currentLanguage = value;
        } else {
            application.showError("Cannot set language to '" + value + "', as there are no strings loaded for that language!");
        }
    };
    exports.languageIsLoaded = function (language) {
        return _strings.hasOwnProperty(language);
    };
    /**
     * @param {String} language
     * @param {Object} stringsJSON
     * @param {Object} stringDefinitions
     */
    exports.loadStrings = function (language, stringsJSON, stringDefinitions) {
        var categoryName;
        _strings[language] = {};
        for (categoryName in stringDefinitions) {
            if (stringDefinitions.hasOwnProperty(categoryName) && (typeof stringDefinitions[categoryName] === "object")) {
                types.getVerifiedObject("strings." + categoryName, stringsJSON, stringDefinitions[categoryName], _strings[language], true, "string");
            }
        }
        if (!_currentLanguage) {
            exports.setLanguage(language);
        }
    };
    /**
     * 
     * @param {Object} stringDefinitionObject
     */
    exports.get = function (stringDefinitionObject) {
        return _strings[_currentLanguage][stringDefinitionObject.name] || stringDefinitionObject.name;
    };
    return exports;
});
