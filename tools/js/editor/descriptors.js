/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides the descriptor objects that outline the structure of properties for the various resource / class categories of 
 * Interstellar Armada for the editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define */
/*jslint white: true */

define(function () {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Constants
            /**
             * The descriptor object for propulsion classes, describing their properties
             * @type Object
             */
            PROPULSION_CLASS = {
                NAME: {
                    name: "name",
                    type: "string"
                },
                SHADER: {
                    name: "shader",
                    type: "string",
                    resourceReference: "shaders"
                },
                TEXTURE: {
                    name: "texture",
                    type: "string",
                    resourceReference: "textures"
                },
                COLOR: {
                    name: "color",
                    type: "color"
                },
                GRADE: {
                    name: "grade",
                    type: "number"
                },
                REFERENCE_MASS: {
                    name: "referenceMass",
                    type: "number"
                },
                THRUST: {
                    name: "thrust",
                    type: "number"
                },
                ANGULAR_THRUST: {
                    name: "angularThrust",
                    type: "number"
                },
                MAX_MOVE_BURN_LEVEL: {
                    name: "maxMoveBurnLevel",
                    type: "number"
                },
                MAX_TURN_BURN_LEVEL: {
                    name: "maxTurnBurnLevel",
                    type: "number"
                }
            },
    /**
     * The descriptor object for spacecraft types, describing their properties
     * @type Object
     */
    SPACECRAFT_TYPE = {
        NAME: {
            name: "name",
            type: "string"
        },
        IS_FIGHTER_TYPE: {
            name: "isFighterType",
            type: "boolean"
        },
        FULL_NAME: {
            name: "fullName",
            type: "string"
        },
        DESCRIPTION: {
            name: "description",
            type: "string",
            long: true
        }
    },
    /**
     * The descriptor object for spacecraft classes, describing their properties
     * @type Object
     */
    SPACECRAFT_CLASS = {
        NAME: {
            name: "name",
            type: "string"
        },
        TYPE: {
            name: "type",
            type: "string",
            classReference: "spacecraftTypes"
        },
        FULL_NAME: {
            name: "fullName",
            type: "string"
        },
        DESCRIPTION: {
            name: "description",
            type: "string",
            long: true
        },
        SHOW_IN_DATABASE: {
            name: "showInDatabase",
            type: "boolean"
        },
        HITPOINTS: {
            name: "hitpoints",
            type: "number"
        },
        ARMOR: {
            name: "armor",
            type: "number"
        },
        MODEL: {
            name: "model",
            type: "string",
            resourceReference: "models"
        },
        SHADER: {
            name: "shader",
            type: "string",
            resourceReference: "shaders"
        },
        TEXTURE: {
            name: "texture",
            type: "string",
            resourceReference: "textures"
        },
        FACTION_COLOR: {
            name: "factionColor",
            type: "color"
        },
        DEFAULT_LUMINOSITY_FACTORS: {
            name: "defaultLuminosityFactors",
            type: "numericPairs"
        },
        MASS: {
            name: "mass",
            type: "number"
        }
    };
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        "propulsionClasses": PROPULSION_CLASS,
        "spacecraftTypes": SPACECRAFT_TYPE,
        "spacecraftClasses": SPACECRAFT_CLASS
    };
});