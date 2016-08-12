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
    BODY = {
        baseType: "object",
        name: "Body",
        properties: {
            POSITION: {
                name: "position",
                type: "vector3"
            },
            SIZE: {
                name: "size",
                type: "vector3"
            }
        }
    },
    WEAPON_SLOT = {
        baseType: "object",
        name: "WeaponSlot",
        properties: {
            POSITION: {
                name: "position",
                type: "vector3"
            },
            MAX_GRADE: {
                name: "maxGrade",
                type: "number"
            }
        }
    },
    THRUSTER = {
        baseType: "object",
        name: "Thruster",
        properties: {
            POSITION: {
                name: "position",
                type: "vector3"
            },
            SIZE: {
                name: "size",
                type: "number"
            }
        }
    },
    THRUSTER_SLOT = {
        baseType: "object",
        name: "ThrusterSlot",
        properties: {
            GROUP: {
                name: "group",
                type: "number"
            },
            USES: {
                name: "uses",
                type: "array",
                elementType: "string"
            },
            THRUSTERS: {
                name: "thrusters",
                type: "array",
                elementType: THRUSTER
            }
        }
    },
    VIEW = {
        baseType: "object",
        name: "View",
        properties: {
            NAME: {
                name: "name",
                type: "string"
            },
            IS_AIMING_VIEW: {
                name: "isAimingView",
                type: "boolean"
            },
            FOV: {
                name: "fov",
                type: "number"
            },
            FOV_RANGE: {
                name: "fovRange",
                type: "range"
            },
            FPS: {
                name: "fps",
                type: "boolean"
            },
            FOLLOWS_POSITION: {
                name: "followsPosition",
                type: "boolean"
            },
            MOVABLE: {
                name: "movable",
                type: "boolean"
            },
            TURNABLE: {
                name: "turnable",
                type: "boolean"
            },
            ALPHA_RANGE: {
                name: "alphaRange",
                type: "range"
            },
            BETA_RANGE: {
                name: "betaRange",
                type: "range"
            },
            ROTATION_CENTER_IS_OBJECT: {
                name: "rotationCenterIsObject",
                type: "boolean"
            },
            DISTANCE_RANGE: {
                name: "distanceRange",
                type: "range"
            },
            POSITION: {
                name: "position",
                type: "vector3"
            },
            RESETS_ON_FOCUS_CHANGE: {
                name: "resetsOnFocusChange",
                type: "boolean"
            }
        }
    },
    WEAPON = {
        baseType: "object",
        name: "Weapon",
        properties: {
            CLASS: {
                name: "class",
                type: "string",
                classReference: "weaponClasses"
            }
        }
    },
    PROPULSION = {
        baseType: "object",
        name: "Propulsion",
        properties: {
            CLASS: {
                name: "class",
                type: "string",
                classReference: "propulsionClasses"
            }
        }
    },
    EQUIPMENT_PROFILE = {
        baseType: "object",
        name: "EquipmentProfile",
        properties: {
            NAME: {
                name: "name",
                type: "string"
            },
            WEAPONS: {
                name: "weapons",
                type: "array",
                elementType: WEAPON
            },
            PROPULSION: {
                name: "propulsion",
                type: PROPULSION
            }
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
            type: "pairs"
        },
        MASS: {
            name: "mass",
            type: "number"
        },
        BODIES: {
            name: "bodies",
            type: "array",
            elementType: BODY
        },
        WEAPON_SLOTS: {
            name: "weaponSlots",
            type: "array",
            elementType: WEAPON_SLOT
        },
        MAX_PROPULSION_GRADE: {
            name: "maxPropulsionGrade",
            type: "number"
        },
        THRUSTER_SLOTS: {
            name: "thrusterSlots",
            type: "array",
            elementType: THRUSTER_SLOT
        },
        VIEWS: {
            name: "views",
            type: "array",
            elementType: VIEW
        },
        EQUIPMENT_PROFILES: {
            name: "equipmentProfiles",
            type: "array",
            elementType: EQUIPMENT_PROFILE
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