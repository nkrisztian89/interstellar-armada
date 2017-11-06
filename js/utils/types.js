/**
 * Copyright 2016-2017 Krisztián Nagy
 * @file Provides type checking functionality for simple types (booleans, number, strings) as well as enums (with values defined in an object),
 * arrays and typed arrays, and custom objects through the usage of an object definition (i.e. schema) format. Types can be combined this
 * way and constraints can be set on types (such as a range for a number of an array's length, presence of certain properties, or passing
 * a custom check function).
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, localStorage */

/**
 * @param utils Used for enum functionality
 * @param application Used for displaying error messages
 */
define([
    "utils/utils",
    "modules/application"
], function (utils, application) {
    "use strict";
    var
            /**
             * Stores the various types of errors that can occur the type verification of a variable.
             * @type Object
             */
            Errors = {
                /**
                 * The value provided failed to pass the provided check function.
                 */
                CHECK_FAIL_ERROR: "checkFailError",
                /**
                 * The value provided does not have the required type.
                 */
                TYPE_ERROR: "typeError",
                /**
                 * The value provided is not one of the valid values defined in the passed enum object.
                 */
                ENUM_VALUE_ERROR: "enumValueError",
                /**
                 * The enum object parameter provided is invalid (not object or has no properties)
                 */
                INVALID_ENUM_OBJECT_ERROR: "invalidEnumObjectError"
            },
            /**
             * The log verbosity level to use when logging errors if no explicit level is given.
             * @type Number
             */
            DEFAULT_ERROR_LOG_VERBOSITY_LEVEL = 1,
            /**
             * The object that will be returned as the public interface of this module.
             */
            exports = {
                Errors: Errors
            };
    /**
     * Returns an error message for the case when a variable value of any type cannot be verified because it fails the supplied check, and a
     * default value will be used instead.
     * @param {String} name The name of the variable to be used to refer to it in the message
     * @param {} value
     * @param {} defaultValue
     * @param {String} [checkFailMessage] The explanation for message to be included
     */
    function _getCheckFailErrorMessage(name, value, defaultValue, checkFailMessage) {
        return "Invalid value for '" + name + "' (" + value + ")" + (checkFailMessage ? (": " + checkFailMessage) : ".") + " Using default value " + defaultValue + " instead.";
    }
    /**
     * Shows an error message for the case when a variable value of any type cannot be verified because it fails the supplied check, and a
     * default value will be used instead.
     * @param {String} name The name of the variable to be used to refer to it in the message
     * @param {} value
     * @param {} defaultValue
     * @param {String} [checkFailMessage] The explanation for message to be included
     */
    function _showCheckFailError(name, value, defaultValue, checkFailMessage) {
        application.showError(_getCheckFailErrorMessage(name, value, defaultValue, checkFailMessage));
    }
    /**
     * Logs an error message for the case when a variable value of any type cannot be verified because it fails the supplied check, and a
     * default value will be used instead.
     * @param {String} name
     * @param {} value
     * @param {} defaultValue
     * @param {String} [checkFailMessage]
     * @param {Number} [verbosityLevel=DEFAULT_ERROR_LOG_VERBOSITY_LEVEL]
     */
    function _logCheckFailError(name, value, defaultValue, checkFailMessage, verbosityLevel) {
        application.log(_getCheckFailErrorMessage(name, value, defaultValue, checkFailMessage), verbosityLevel !== undefined ? verbosityLevel : DEFAULT_ERROR_LOG_VERBOSITY_LEVEL);
    }
    /**
     * Returns an error message to be shown / logged when a variable value of any type fails type verification because if has a different type
     * than required.
     * @param {String} type
     * @param {String} name
     * @param {} value
     * @param {} defaultValue
     * @returns {String}
     */
    function _getTypeError(type, name, value, defaultValue) {
        return "Invalid value for '" + name +
                "'. Expected " + type + ", got a(n) " + ((typeof value === "object") ? value.constructor.name : (typeof value)) + " (" + value +
                "). Using default value " + ((defaultValue instanceof Array) ? ("[" + defaultValue.join(", ") + "]") : ("'" + defaultValue + "'")) + " instead.";
    }
    /**
     * Shows an error message for the case when a variable value of any type fails type verification because if has a different type
     * than required.
     * @param {String} type
     * @param {String} name
     * @param {} value
     * @param {} defaultValue
     * @returns {String}
     */
    function _showTypeError(type, name, value, defaultValue) {
        application.showError(_getTypeError(type, name, value, defaultValue));
    }
    /**
     * Logs an error message for the case when a variable value of any type fails type verification because if has a different type
     * than required.
     * @param {String} type
     * @param {String} name
     * @param {} value
     * @param {} defaultValue
     * @param {Number} [verbosityLevel=DEFAULT_ERROR_LOG_VERBOSITY_LEVEL]
     * @returns {String}
     */
    function _logTypeError(type, name, value, defaultValue, verbosityLevel) {
        application.log(_getTypeError(type, name, value, defaultValue), verbosityLevel !== undefined ? verbosityLevel : DEFAULT_ERROR_LOG_VERBOSITY_LEVEL);
    }
    /**
     * Returns an error message to be shown / logged when a variable value fails type verification because is not one of the available 
     * values defined by a passed enum object.
     * @param {String} name
     * @param {} value
     * @param {Object} enumObject
     * @param {} defaultValue
     * @returns {String}
     */
    function _getEnumValueError(name, value, enumObject, defaultValue) {
        return "Unrecognized '" + name + "' value: '" + value + "'. Possible values are are: " + utils.getEnumValues(enumObject).join(", ") + ". Default value '" + defaultValue + "' will be used instead.";
    }
    /**
     * Shows an error message for the case when a variable value fails type verification because is not one of the available values defined 
     * by a passed enum object.
     * @param {String} name
     * @param {} value
     * @param {Object} enumObject
     * @param {} defaultValue
     * @returns {String}
     */
    function _showEnumValueError(name, value, enumObject, defaultValue) {
        application.showError(_getEnumValueError(name, value, enumObject, defaultValue));
    }
    /**
     * Logs an error message for the case when a variable value fails type verification because is not one of the available values defined 
     * by a passed enum object.
     * @param {String} name
     * @param {} value
     * @param {Object} enumObject
     * @param {} defaultValue
     * @param {Number} [verbosityLevel=DEFAULT_ERROR_LOG_VERBOSITY_LEVEL]
     * @returns {String}
     */
    function _logEnumValueError(name, value, enumObject, defaultValue, verbosityLevel) {
        application.log(_getEnumValueError(name, value, enumObject, defaultValue), verbosityLevel !== undefined ? verbosityLevel : DEFAULT_ERROR_LOG_VERBOSITY_LEVEL);
    }
    // ----------------------------------------------------------------------
    // constants
    // generic type descriptors
    exports.NUMBER = "number";
    exports.VECTOR2 = {
        baseType: "array",
        length: 2,
        elementType: "number"
    };
    exports.VECTOR3 = {
        baseType: "array",
        length: 3,
        elementType: "number"
    };
    exports.COLOR3 = {
        baseType: "array",
        length: 3,
        elementType: "number",
        elementTypeParams: {
            range: [0, 1]
        }
    };
    exports.COLOR4 = {
        baseType: "array",
        length: 4,
        elementType: "number",
        elementTypeParams: {
            range: [0, 1]
        }
    };
    exports.DURATION = {
        baseType: "number",
        range: [0, undefined]
    };
    exports.ANGLE_DEGREES = {
        baseType: "number",
        range: [-360, 360]
    };
    // ----------------------------------------------------------------------
    // public functions
    /**
     * @typedef {Function} Types~BooleanCallback
     * @param {Boolean} safeValue
     * @returns {Boolean}
     */
    /**
     * @typedef {Object} Types~BooleanValueParams
     * @property {String} [name] The name of the variable you are trying to acquire a value for (to show in error messages)
     * @property {Boolean} [defaultValue] If the original value is invalid, this value will be returned instead.
     * @property {Types~BooleanCallback} [checkFunction] If the type of the value is correct and this function is given, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid.
     * @property {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @property {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     * @property {Boolean} [silentFallback=false]
     * @property {String} [error] enum Errors
     */
    /**
     * Returns a type-safe boolean value. If the given original value is invalid, will show an error message and return the given default 
     * value.
     * @param {} value The original value to be checked
     * @param {Types~BooleanValueParams} params
     * @returns {Boolean|null}
     */
    exports.getBooleanValue = function (value, params) {
        params = params || {};
        params.name = params.name || "unnamed boolean";
        if (typeof value === "boolean") {
            if (params.checkFunction && !params.checkFunction(value, params.parentObject)) {
                params.error = Errors.CHECK_FAIL_ERROR;
                if (!params.silentFallback) {
                    _showCheckFailError(params.name, value, params.defaultValue, params.checkFailMessage);
                } else {
                    _logCheckFailError(params.name, value, params.defaultValue, params.checkFailMessage);
                }
            } else {
                return value;
            }
        } else {
            params.error = Errors.TYPE_ERROR;
            if (!params.silentFallback) {
                _showTypeError("a boolean", params.name, value, params.defaultValue);
            } else {
                _logTypeError("a boolean", params.name, value, params.defaultValue);
            }
        }
        if (params.defaultValue !== null) {
            value = params.defaultValue;
            params.defaultValue = null;
            return exports.getBooleanValue(value, params);
        }
        return null;
    };
    /**
     * @typedef {Function} Types~NumberCallback
     * @param {Number} safeValue
     * @returns {Boolean}
     */
    /**
     * @typedef {Object} Types~NumberValueParams
     * @property {String} [name] The name of the variable you are trying to acquire a value for (to show in error messages)
     * @property {Number} [defaultValue] If the original value is invalid, this value will be returned instead.
     * @property {Types~NumberCallback} [checkFunction] If the type of the value is correct and this function is given, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid.
     * @property {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @property {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     * @property {Boolean} [silentFallback=false]
     */
    /**
     * Returns a type-safe number value. If the given original value is invalid, will show an error message and return the given default 
     * value.
     * @param {String} name The name of the variable you are trying to acquire a value for (to show in error messages)
     * @param {} value The original value to be checked
     * @param {Number} [defaultValue] If the original value is invalid, this value will be returned instead.
     * @param {Types~NumberCallback} [checkFunction] If the type of the value is correct and this function is given, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid.
     * @param {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @param {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     * @param {Boolean} [silentFallback=false]
     * @returns {Number|null}
     */
    exports.getNumberValue = function (name, value, defaultValue, checkFunction, checkFailMessage, parentObject, silentFallback) {
        if (typeof value === "number") {
            if (checkFunction) {
                if (!checkFunction(value, parentObject)) {
                    _showCheckFailError(name, value, defaultValue, checkFailMessage);
                    return (defaultValue !== null) ? exports.getNumberValue(name, defaultValue, null, checkFunction, checkFailMessage, parentObject) : null;
                }
            }
            return value;
        }
        if ((typeof defaultValue !== "number") || !silentFallback) {
            _showTypeError("a number", name, value, defaultValue);
        }
        return (defaultValue !== null) ? exports.getNumberValue(name, defaultValue, null, checkFunction, checkFailMessage, parentObject) : null;
    };
    /**
     * Returns a type-safe number value falling into a specific range. If the given original value is of invalid type, will show an error 
     * message and return the given default value, if it falls outside of the range, it will be increased / decreased to fit in (along with
     * showing an error message)
     * @param {String} name The name of the variable you are trying to acquire a value for (to show in error messages)
     * @param {} value The original value to be checked
     * @param {Number} [minValue] The minimum value for the range. If not given, check will be only done for the maximum value
     * @param {Number} [maxValue] The maximum value for the range. If not given, check will be only done for the minimum value
     * @param {Number} [defaultValue] If the original value is invalid, this value will be returned instead.
     * @param {Types~NumberCallback} [checkFunction] If the type of the value is correct and this function is given, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid.
     * @param {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @param {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     * @returns {Number|null}
     */
    exports.getNumberValueInRange = function (name, value, minValue, maxValue, defaultValue, checkFunction, checkFailMessage, parentObject) {
        if (typeof value === "number") {
            if (((minValue !== undefined) && (value < minValue)) || ((maxValue !== undefined) && (value > maxValue))) {
                application.showError("Invalid value for " + name + ": out of range (" + ((minValue !== undefined) ? minValue : "...") + "-" + ((maxValue !== undefined) ? maxValue : "...") + "). The setting will be changed to fit the valid range.");
                if (minValue !== undefined) {
                    value = Math.max(minValue, value);
                }
                if (maxValue !== undefined) {
                    value = Math.min(value, maxValue);
                }
            }
            if (checkFunction) {
                if (!checkFunction(value, parentObject)) {
                    _showCheckFailError(name, value, defaultValue, checkFailMessage);
                    return (defaultValue !== null) ? exports.getNumberValueInRange(name, defaultValue, minValue, maxValue, null, checkFunction, checkFailMessage, parentObject) : null;
                }
            }
            return value;
        }
        _showTypeError("a number", name, value, defaultValue);
        return (defaultValue !== null) ? exports.getNumberValueInRange(name, defaultValue, minValue, maxValue, null, checkFunction, checkFailMessage, parentObject) : null;
    };
    /**
     * @typedef {Function} Types~StringCallback
     * @param {String} safeValue
     * @returns {Boolean}
     */
    /**
     * @typedef {Object} Types~StringValueParams
     * @property {String} [name] The name of the variable you are trying to acquire a value for (to show in error messages)
     * @property {Number} [defaultValue] If the original value is invalid, this value will be returned instead.
     * @property {Types~StringCallback} [checkFunction] If the type of the value is correct and this function is given, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid.
     * @property {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @property {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     */
    /**
     * Returns a type-safe string value. If the given original value is invalid, will show an error message and return the given default 
     * value.
     * @param {String} name The name of the variable you are trying to acquire a value for (to show in error messages)
     * @param {} value The original value to be checked
     * @param {String} [defaultValue] If the original value is invalid, this value will be returned instead.
     * @param {Types~StringCallback} [checkFunction] If the type of the value is correct and this function is given, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid.
     * @param {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @param {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     * @returns {String|null}
     */
    exports.getStringValue = function (name, value, defaultValue, checkFunction, checkFailMessage, parentObject) {
        if (typeof value === "string") {
            if (checkFunction) {
                if (!checkFunction(value, parentObject)) {
                    _showCheckFailError(name, value, defaultValue, checkFailMessage);
                    return (defaultValue !== null) ? exports.getStringValue(name, defaultValue, null, checkFunction, checkFailMessage, parentObject) : null;
                }
            }
            return value;
        }
        _showTypeError("a string", name, value, defaultValue);
        return (defaultValue !== null) ? exports.getStringValue(name, defaultValue, null, checkFunction, checkFailMessage, parentObject) : null;
    };
    /**
     * @typedef {Object} Types~EnumValueParams
     * @property {String} [name] The name of the variable you are trying to acquire a value for (to show in error messages)
     * @property {String} [defaultValue] If the original value is invalid, this value will be returned instead.
     * @property {Types~NumberCallback} [checkFunction] If the type of the value is correct and this function is given, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid.
     * @property {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @property {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     * @property {Boolean} [silentFallback=false]
     * @property {String} [error] enum Errors
     */
    /**
     * If the given value is one of the possible enumeration values defined in the given enumeration object, it returns it, otherwise shows
     * a warning message about it to the user and returns the given default.
     * @param {Object} enumObject the object containing the valid enumeration values.
     * @param {} value The original value to be checked
     * @param {Types~EnumValueParams} params
     * @returns {}
     */
    exports.getEnumValue = function (enumObject, value, params) {
        var safeValue = utils.getSafeEnumValue(enumObject, value);
        params = params || {};
        params.name = params.name || "unnamed enum " + enumObject.constructor.name;
        if (safeValue !== null) {
            if (params.checkFunction && !params.checkFunction(safeValue, params.parentObject)) {
                params.error = Errors.CHECK_FAIL_ERROR;
                if (!params.silentFallback) {
                    _showCheckFailError(params.name, safeValue, params.defaultValue, params.checkFailMessage);
                } else {
                    _logCheckFailError(params.name, safeValue, params.defaultValue, params.checkFailMessage);
                }
            } else {
                return safeValue;
            }
        } else {
            if ((typeof enumObject !== "object") || (Object.keys(enumObject).length === 0)) {
                params.error = Errors.INVALID_ENUM_OBJECT_ERROR;
                application.showError("Invalid enum object specified for " + params.name + ": " + enumObject + ", and thus its value (" + value + ") cannot be verified!");
                return null;
            }
            params.error = Errors.ENUM_VALUE_ERROR;
            if (!params.silentFallback) {
                _showEnumValueError(params.name, value, enumObject, params.defaultValue);
            } else {
                _logEnumValueError(params.name, value, enumObject, params.defaultValue);
            }
        }
        if (params.defaultValue !== null) {
            value = params.defaultValue;
            params.defaultValue = null;
            return exports.getEnumValue(enumObject, value, params);
        }
        return null;
    };
    /**
     * @typedef {Function} Types~ObjectCallback
     * @param {Object} safeValue
     * @returns {Boolean}
     */
    /**
     * Returns a type-safe object value. If the given original value is invalid, will show an error message and return the given default 
     * value.
     * @param {String} name The name of the variable you are trying to acquire a value for (to show in error messages)
     * @param {} value The original value to be checked
     * @param {Object} [defaultValue] If the original value is invalid, this value will be returned instead.
     * @param {Types~ObjectCallback} [checkFunction] If the type of the value is correct and this function is given, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid.
     * @param {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @param {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     * @returns {Object|null}
     */
    exports.getObjectValue = function (name, value, defaultValue, checkFunction, checkFailMessage, parentObject) {
        if (typeof value === "object") {
            if (checkFunction) {
                if (!checkFunction(value, parentObject)) {
                    _showCheckFailError(name, value, defaultValue, checkFailMessage);
                    return (defaultValue !== null) ? exports.getObjectValue(name, defaultValue, null, checkFunction, checkFailMessage, parentObject) : null;
                }
            }
            return value;
        }
        _showTypeError("an object", name, value, defaultValue);
        return (defaultValue !== null) ? exports.getObjectValue(name, defaultValue, null, checkFunction, checkFailMessage, parentObject) : null;
    };
    /**
     * Executes type verification on a supplied value based on the passed type information. If the supplied value does not pass the
     * type verification, a default value will be returned.
     * @param {String} name The name of the variable you are trying to acquire a value for (to show in error messages)
     * @param {String|Object} type Either a string representation of the type (boolean/number/string/enum/object/array) or an object 
     * describing a custom value based on one of these. In the latter case the object has to contain its base type as the baseType properties
     * and any other type parameters directly as its properties
     * @param {} value The original value to be checked
     * @param {} defaultValue The default value to be returned in case the original value fails the verification
     * @param {Boolean} optional If true, undefined values will be accepted and returned without error, even if there is no default value set
     * @param {Object} [typeParams] The required and optional parameters to define the (constraints of the) type. Current options:
     * For number:
     * - (optional) range: an array of 2 optional numbers describing the minimum and maximum of the interval the value should be in
     * For enum:
     * - (required) values: the object that defines the valid enum values as its properties
     * For object:
     * - (optional) properties: an object to use for verifying the properties of the object
     * For array:
     * - (optional) elementType: if given, all elements of the array will be verified to be of this type. Can use the string or custom object
     * format as well
     * - (optional) elementTypeParams: any type parameters for the elements to be checked, in the same format as typeParams
     * - (optional) length: the array will only pass the verification if it has exactly the same length
     * @param {Function} [checkFunction] If the type of the value is correct and this function is given, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid. This will not be applied if the value to be tested is an object to be verified by an object definition object given through
     * the verify parameter.
     * @param {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @param {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     * @returns {}
     */
    exports.getValueOfType = function (name, type, value, defaultValue, optional, typeParams, checkFunction, checkFailMessage, parentObject) {
        typeParams = typeParams || {};
        if (value === undefined) {
            if (defaultValue !== undefined) {
                return (defaultValue !== null) ? exports.getValueOfType(name, type, defaultValue, null, optional, typeParams, checkFunction, checkFailMessage, parentObject) : null;
            }
            if (!optional) {
                application.showError("Missing required value of '" + name + "'!");
            }
            return undefined;
        }
        if (typeof type === "object") {
            // accept direct definition objects for describing properties
            if (!type.baseType) {
                return exports.getVerifiedObject(name, value, type);
            }
            return exports.getValueOfType(name, type.baseType, value, defaultValue, optional, type, checkFunction, checkFailMessage, parentObject);
        }
        switch (type) {
            case "boolean":
                return exports.getBooleanValue(value, {name: name, defaultValue: defaultValue, checkFunction: checkFunction, checkFailMessage: checkFailMessage, parentObject: parentObject});
            case "number":
                if (typeParams.range) {
                    return exports.getNumberValueInRange(name, value, typeParams.range[0], typeParams.range[1], defaultValue, checkFunction, checkFailMessage, parentObject);
                }
                return exports.getNumberValue(name, value, defaultValue, checkFunction, checkFailMessage, parentObject);
            case "string":
                return exports.getStringValue(name, value, defaultValue, checkFunction, checkFailMessage, parentObject);
            case "enum":
                if (typeParams.values) {
                    return exports.getEnumValue(typeParams.values, value, {name: name, defaultValue: defaultValue, checkFunction: checkFunction, checkFailMessage: checkFailMessage, parentObject: parentObject});
                }
                application.showError("Missing enum definition object for '" + name + "'!");
                return null;
            case "object":
                if (typeParams.properties) {
                    return exports.getVerifiedObject(name, value, typeParams.properties);
                }
                return exports.getObjectValue(name, value, defaultValue, checkFunction, checkFailMessage, parentObject);
            case "array":
                return exports.getArrayValue(name, value, typeParams.elementType, typeParams.elementTypeParams, typeParams, defaultValue, checkFunction, checkFailMessage, typeParams.elementCheck, typeParams.elementCheckFailMessage, parentObject);
            default:
                application.showError("Unknown type specified for '" + name + "': " + type);
                return null;
        }
    };
    /**
     * @typedef {Function} Types~ArrayCallback
     * @param {Array} safeValue
     * @returns {Boolean}
     */
    /**
     * Returns a type-safe array value. If the given original value is invalid, will show an error message and return the given default 
     * value.
     * @param {String} name The name of the variable you are trying to acquire a value for (to show in error messages)
     * @param {} value The original array to be checked
     * @param {String} [elementType] If given, the elements of the array will be checked to be of this type
     * @param {Object} [elementTypeParams] The type parameters for the elements (e.g. enum for enums, range for numbers, length for arrays)
     * @param {Number} [arrayParams] Can contain the required minimum, maximum or exact length of the array (minLength, maxLength, length)
     * @param {Array} [defaultValue] If the original value is invalid, this value will be returned instead.
     * @param {Types~ArrayCallback} [checkFunction] If the type of the value is correct and this function is give, it will be called with the 
     * value passed to it to perform any additional checks to confirm the validity of the value. It should return whether the value is 
     * valid.
     * @param {String} [checkFailMessage] An explanatory error message to show it the value is invalid because it fails the check.
     * @param {Function} [elementCheckFunction] A check function to be run for each element in the array
     * @param {String} [elementCheckFailMessage] An explanatory error message to show if elements of the array fail their check
     * @param {Object} [parentObject] If this value is the member of an object that is being verified, then this should be a reference to that object.
     * @returns {Boolean}
     */
    exports.getArrayValue = function (name, value, elementType, elementTypeParams, arrayParams, defaultValue, checkFunction, checkFailMessage, elementCheckFunction, elementCheckFailMessage, parentObject) {
        var result = [], resultElement;
        if (value instanceof Array) {
            if (arrayParams !== undefined) {
                if ((arrayParams.length !== undefined) && (value.length !== arrayParams.length)) {
                    application.showError("Invalid array length for '" + name + "'! Expected a length of " + arrayParams.length + " and got " + value.length + (defaultValue ? (". Using default value [" + defaultValue.join(", ") + "] instead.") : "."));
                    return defaultValue ? exports.getArrayValue(name, defaultValue, elementType, elementTypeParams, arrayParams, null, checkFunction, checkFailMessage, elementCheckFunction, elementCheckFailMessage, parentObject) : null;
                }
                if ((arrayParams.minLength !== undefined) && (value.length < arrayParams.minLength)) {
                    application.showError("Invalid array length for '" + name + "'! Expected a minimum length of " + arrayParams.minLength + " and got " + value.length + (defaultValue ? (". Using default value [" + defaultValue.join(", ") + "] instead.") : "."));
                    return defaultValue ? exports.getArrayValue(name, defaultValue, elementType, elementTypeParams, arrayParams, null, checkFunction, checkFailMessage, elementCheckFunction, elementCheckFailMessage, parentObject) : null;
                }
                if ((arrayParams.maxLength !== undefined) && (value.length > arrayParams.maxLength)) {
                    application.showError("Invalid array length for '" + name + "'! Expected a maximum length of " + arrayParams.maxLength + " and got " + value.length + (defaultValue ? (". Using default value [" + defaultValue.join(", ") + "] instead.") : "."));
                    return defaultValue ? exports.getArrayValue(name, defaultValue, elementType, elementTypeParams, arrayParams, null, checkFunction, checkFailMessage, elementCheckFunction, elementCheckFailMessage, parentObject) : null;
                }
            }
            if (elementType !== undefined) {
                value.forEach(function (element, index) {
                    resultElement = exports.getValueOfType(name + "[" + index + "]", elementType, element, null, false, elementTypeParams, elementCheckFunction, elementCheckFailMessage, parentObject);
                    if (resultElement !== null) {
                        result.push(resultElement);
                    }
                });
                value = result;
            }
            if (checkFunction) {
                if (!checkFunction(value)) {
                    _showCheckFailError(name, value, "[" + defaultValue.join(", ") + "]", checkFailMessage);
                    return (defaultValue !== null) ? exports.getArrayValue(name, defaultValue, elementType, elementTypeParams, arrayParams, null, checkFunction, checkFailMessage, elementCheckFunction, elementCheckFailMessage, parentObject) : null;
                }
            }
            return value;
        }
        _showTypeError("an array", name, value, defaultValue);
        return (defaultValue !== null) ? exports.getArrayValue(name, defaultValue, elementType, elementTypeParams, arrayParams, null, checkFunction, checkFailMessage, elementCheckFunction, elementCheckFailMessage, parentObject) : null;
    };
    /**
     * Verifies a given object's properties to be of certain types given by a passed object definition object. 
     * @param {String} name The value to be checked will be referred to by this name in error messages
     * @param {Object} value The object to be verified
     * @param {Object} definitionObject The object defining the properties as they should be. Each property should be defined as an object
     * itself, with a name property to identify it, a type property to describe the type (see getValueOfType), an optional defaultValue property,
     * which will cause the property to be added with this value, if it is missing from the original object (if a property without a default
     * value is missing, an error message will be displayed), and any other type parameters that getValueOfType accepts. If the original
     * object has any additional properties not included in the definition object, they will be discarded from the result, but an error
     * message will be shown about them.
     * @param {Object} [objectToAppendTo] If given, the resulting verified properties will be appended to this object instead of a new empty one
     * @param {Boolean} [doNotDiscard=false] If true, the properties of the object that are not in the definition will not be discarded
     * @param {Boolean} [silentDiscard=false] If true, there will be no warning shown about discarded / not defined but included properties
     * @param {String|Object} [propertyType] If given, the type can be omitted from the property definitions and if so, it will be considered to be this type
     * @returns {Object}
     */
    exports.getVerifiedObject = function (name, value, definitionObject, objectToAppendTo, doNotDiscard, silentDiscard, propertyType) {
        var propertyName, propertyDefinitionName, propertyDefinition, result = objectToAppendTo || {}, processedProperties = [], impliedType, i, impliedProperties;
        if (typeof value === "object") {
            for (propertyDefinitionName in definitionObject) {
                if (definitionObject.hasOwnProperty(propertyDefinitionName)) {
                    propertyDefinition = definitionObject[propertyDefinitionName];
                    if (result[propertyDefinition.name]) {
                        application.showError("'" + name + "' already has a property named '" + propertyDefinition.name + "', which will be overridden by a new value!");
                    }
                    // if no explicit type is given and the property definition object has no type either, imply that the property
                    // is of object type and the object properties of the property definition object describe the nested properties
                    // this way nested object can be described simply (e.g. parent: {name: "parentObject", CHILD: {name: "child", type: ...}}
                    // is equal to {name: "parentObject", type: {baseType: "object", properties: { CHILD: {name: "child", type: ... ...)
                    if (!propertyDefinition.type && !propertyType) {
                        impliedType = {};
                        impliedProperties = Object.keys(propertyDefinition);
                        for (i = 0; i < impliedProperties.length; i++) {
                            if (typeof propertyDefinition[impliedProperties[i]] === "object") {
                                impliedType[impliedProperties[i]] = propertyDefinition[impliedProperties[i]];
                            }
                        }
                    }
                    result[propertyDefinition.name] = exports.getValueOfType(
                            name + "." + propertyDefinition.name,
                            propertyDefinition.type || impliedType || propertyType,
                            value[propertyDefinition.name],
                            propertyDefinition.defaultValue,
                            propertyDefinition.optional,
                            {
                                // number
                                range: propertyDefinition.range,
                                // enum
                                values: propertyDefinition.values,
                                // array
                                elementType: propertyDefinition.elementType,
                                elementEnumObject: propertyDefinition.elementEnum,
                                length: propertyDefinition.length,
                                minLength: propertyDefinition.minLength,
                                maxLength: propertyDefinition.maxLength,
                                elementCheck: propertyDefinition.elementCheck,
                                elementCheckFailMessage: propertyDefinition.elementCheckFailMessage,
                                // object
                                properties: propertyDefinition.properties
                            },
                            propertyDefinition.check,
                            propertyDefinition.checkFailMessage,
                            value);
                    processedProperties.push(propertyDefinition.name);
                }
            }
            if (!silentDiscard || doNotDiscard) {
                for (propertyName in value) {
                    if (value.hasOwnProperty(propertyName)) {
                        if (processedProperties.indexOf(propertyName) < 0) {
                            if (!silentDiscard) {
                                application.showError(
                                        "Unrecognized property '" +
                                        propertyName + "' defined for '" + name +
                                        "'. The value of this property " +
                                        (propertyType ? "can be verified only against the default property type" : "cannot be verified ") +
                                        (doNotDiscard ? "but will be included." : "and will be discarded."));
                            }
                            if (doNotDiscard) {
                                if (propertyType) {
                                    result[propertyName] = exports.getValueOfType(
                                            name + "." + propertyName,
                                            propertyType,
                                            value[propertyName]);
                                } else {
                                    result[propertyName] = value[propertyName];
                                }

                            }
                        }
                    }
                }
            }
            return result;
        }
        application.showError("Invalid value for '" + name + "'. Expected an object, got a(n) " + (typeof value) + " (" + value + ").");
        return null;
    };
    /**
     * Reads, type verifies and returns a boolean value (or a supplied default) from local storage according to the specified parameters.
     * @param {String} storageLocation The key locating the value in local storage.
     * @param {Types~BooleanValueParams} params Same as for getBooleanValue.
     * @returns {null|Boolean}
     */
    exports.getBooleanValueFromLocalStorage = function (storageLocation, params) {
        var value;
        if (localStorage[storageLocation] === true.toString()) {
            value = true;
        } else if (localStorage[storageLocation] === false.toString()) {
            value = false;
        } else {
            value = localStorage[storageLocation];
        }
        params = params || {};
        params.name = params.name || "localStorage." + storageLocation;
        return exports.getBooleanValue(value, params);
    };
    /**
     * Reads, type verifies and returns a number value (or a supplied default) from local storage according to the specified parameters.
     * @param {String} storageLocation The key locating the value in local storage.
     * @param {Types~NumberValueParams} params
     * @returns {null|Number}
     */
    exports.getNumberValueFromLocalStorage = function (storageLocation, params) {
        var value = parseFloat(localStorage[storageLocation]);
        if (isNaN(value)) {
            value = localStorage[storageLocation];
        }
        params = params || {};
        params.name = params.name || "localStorage." + storageLocation;
        return exports.getNumberValue(params.name, value, params.defaultValue, params.checkFunction, params.checkFailMessage, params.parentObject, params.silentFallback);
    };
    /**
     * Reads, type verifies and returns an enum value (or a supplied default) from local storage according to the specified parameters.
     * @param {Object} enumObject The object describing the possible values for the enum.
     * @param {String} storageLocation The key locating the value in local storage.
     * @param {Types~EnumValueParams} params Same as for getEnumValue
     * @returns {any}
     */
    exports.getEnumValueFromLocalStorage = function (enumObject, storageLocation, params) {
        params = params || {};
        params.name = params.name || "localStorage." + storageLocation;
        return exports.getEnumValue(enumObject, localStorage[storageLocation], params);
    };
    /**
     * Reads, type verifies and returns a string value (or a supplied default) from local storage according to the specified parameters.
     * @param {String} storageLocation The key locating the value in local storage.
     * @param {Types~StringValueParams} params
     * @returns {null|String}
     */
    exports.getStringValueFromLocalStorage = function (storageLocation, params) {
        params = params || {};
        params.name = params.name || "localStorage." + storageLocation;
        return exports.getStringValue(params.name, localStorage[storageLocation], params.defaultValue, params.checkFunction, params.checkFailMessage);
    };
    /**
     * Reads, type verifies and returns a value of a given type (or a supplied default) from local storage according to the specified 
     * parameters. Currently only boolean and enum types are supported!
     * @param {String|Object} type The type descriptor string or object. (currently boolean / number / string / enum only!)
     * @param {String} storageLocation The key locating the value in local storage.
     * @param {Types~BooleanValueParams|Types~EnumValueParams} params
     * @returns {any}
     */
    exports.getValueOfTypeFromLocalStorage = function (type, storageLocation, params) {
        if (typeof type === "object") {
            params.values = type.values;
            return exports.getValueOfTypeFromLocalStorage(type.baseType, storageLocation, params);
        }
        switch (type) {
            case "boolean":
                return exports.getBooleanValueFromLocalStorage(storageLocation, params);
            case "number":
                return exports.getNumberValueFromLocalStorage(storageLocation, params);
            case "enum":
                return exports.getEnumValueFromLocalStorage(params.values, storageLocation, params);
            case "string":
                return exports.getStringValueFromLocalStorage(storageLocation, params);
            default:
                application.crash();
        }
    };
    /**
     * Returns a definition object defining an object structure with a string identifier ("name") and a numberic value.
     * @param {String} valueName The name of the property storing the numeric value.
     * @returns {Object}
     */
    exports.getNameAndValueDefinitionObject = function (valueName) {
        return {
            baseType: "object",
            properties: {
                NAME: {
                    name: "name",
                    type: "string"
                },
                VALUE: {
                    name: valueName,
                    type: "number"
                }
            }
        };
    };
    /**
     * Returns an object that can be used as an enum object in the type verification functions, based on an array storing the possible
     * enumeration values.
     * @param {Array} array
     * @returns {Object}
     */
    exports.getEnumObjectForArray = function (array) {
        var result = {}, i;
        for (i = 0; i < array.length; i++) {
            result[array[i]] = array[i];
        }
        return result;
    };
    // --------------------------------------------------------------------------------------------
    return exports;
});