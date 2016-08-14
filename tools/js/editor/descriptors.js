/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides the descriptor objects that outline the structure of properties for the various resource / class categories of 
 * Interstellar Armada for the editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document */
/*jslint white: true, plusplus: true, nomen: true */

/**
 * @param classes
 */
define([
    "armada/classes"
], function (classes) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Enums
            BaseType = {
                BOOLEAN: "boolean",
                NUMBER: "number",
                STRING: "string",
                ARRAY: "array",
                OBJECT: "object",
                ENUM: "enum",
                COLOR: "color",
                VECTOR3: "vector3",
                RANGE: "range",
                PAIRS: "pairs",
                ROTATIONS: "rotations",
                SET: "set"
            },
    /**
     * The possible axes for rotations
     * @enum {String}
     * @type Object
     */
    Axis = {
        X: "X",
        Y: "Y",
        Z: "Z"
    },
    ThrusterUse = {
        FORWARD: "forward",
        REVERSE: "reverse",
        STRAFE_LEFT: "strafeLeft",
        STRAFE_RIGHT: "strafeRight",
        RAISE: "raise",
        LOWER: "lower",
        YAW_LEFT: "yawLeft",
        YAW_RIGHT: "yawRight",
        PITCH_UP: "pitchUp",
        PITCH_DOWN: "pitchDown",
        ROLL_LEFT: "rollLeft",
        ROLL_RIGHT: "rollRight"
    },
    // ------------------------------------------------------------------------------
    // Constants
    /**
     * @typedef {Object} Editor~TypeDescriptor
     * @property {String} baseType (enum BaseType)
     * @property {Boolean} [long=false] For BaseType.STRING
     * @property {String} [resourceReference] For BaseType.STRING
     * @property {String} [classReference] For BaseType.STRING
     * @property {String} [name] For BaseType.OBJECT
     * @property {Editor~ItemDescriptor} [properties] For BaseType.OBJECT
     * @property {Object} [values] For BaseType.ENUM and BaseType.SET
     * @property {Editor~PropertyDescriptor} [first] For BaseType.PAIRS
     * @property {Editor~PropertyDescriptor} [second] For BaseType.PAIRS
     */
    /**
     * @typedef {Object} Editor~PropertyDescriptor
     * @property {String} name
     * @property {String|Editor~TypeDescriptor} type (if string: enum BaseType)
     * @property {String|Editor~TypeDescriptor} [elementType] given only if baseType is BaseType.ARRAY - same format as type
     */
    /**
     * @typedef {Object.<String, PropertyDescriptor>} Editor~ItemDescriptor
     */
    /**
     * @type Editor~TypeDescriptor
     */
    LONG_STRING = {
        baseType: BaseType.STRING,
        long: true
    },
    /**
     * @type Editor~TypeDescriptor
     */
    MODEL_REFERENCE = {
        baseType: BaseType.STRING,
        resourceReference: "models"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SHADER_REFERENCE = {
        baseType: BaseType.STRING,
        resourceReference: "shaders"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    TEXTURE_REFERENCE = {
        baseType: BaseType.STRING,
        resourceReference: "textures"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    CUBEMAP_REFERENCE = {
        baseType: BaseType.STRING,
        resourceReference: "cubemaps"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SPACECRAFT_TYPE_REFERENCE = {
        baseType: BaseType.STRING,
        classReference: "spacecraftTypes"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    EXPLOSION_CLASS_REFERENCE = {
        baseType: BaseType.STRING,
        classReference: "explosionClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    WEAPON_CLASS_REFERENCE = {
        baseType: BaseType.STRING,
        classReference: "weaponClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    PROPULSION_CLASS_REFERENCE = {
        baseType: BaseType.STRING,
        classReference: "propulsionClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    LUMINOSITY_FACTOR_PAIRS = {
        baseType: BaseType.PAIRS,
        first: {
            name: "group",
            type: BaseType.NUMBER
        },
        second: {
            name: "luminosity",
            type: BaseType.NUMBER
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    AXIS = {
        baseType: BaseType.ENUM,
        values: Axis
    },
    /**
     * The descriptor object for skybox classes, describing their properties
     * @type Editor~ItemDescriptor
     */
    SKYBOX_CLASS = {
        NAME: {
            name: "name",
            type: BaseType.STRING
        },
        SHADER: {
            name: "shader",
            type: SHADER_REFERENCE
        },
        CUBEMAP: {
            name: "cubemap",
            type: CUBEMAP_REFERENCE
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    BACKGROUND_OBJECT_LAYER = {
        baseType: BaseType.OBJECT,
        name: "Layer",
        properties: {
            SIZE: {
                name: "size",
                type: BaseType.NUMBER
            },
            SHADER: {
                name: "shader",
                type: SHADER_REFERENCE
            },
            TEXTURE: {
                name: "texture",
                type: TEXTURE_REFERENCE
            },
            COLOR: {
                name: "color",
                type: BaseType.COLOR
            }
        }
    },
    /**
     * The descriptor object for background object classes, describing their properties
     * @type Editor~ItemDescriptor
     */
    BACKGROUND_OBJECT_CLASS = {
        NAME: {
            name: "name",
            type: BaseType.STRING
        },
        LIGHT_COLOR: {
            name: "lightColor",
            type: BaseType.COLOR
        },
        LAYERS: {
            name: "layers",
            type: BaseType.ARRAY,
            elementType: BACKGROUND_OBJECT_LAYER
        }
    },
    /**
     * The descriptor object for dust cloud classes, describing their properties
     * @type Editor~ItemDescriptor
     */
    DUST_CLOUD_CLASS = {
        NAME: {
            name: "name",
            type: BaseType.STRING
        },
        SHADER: {
            name: "shader",
            type: SHADER_REFERENCE
        },
        NUMBER_OF_PARTICLES: {
            name: "numberOfParticles",
            type: BaseType.NUMBER
        },
        RANGE: {
            name: "range",
            type: BaseType.NUMBER
        },
        COLOR: {
            name: "color",
            type: BaseType.COLOR
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    PARTICLE_EMITTER_TYPE = {
        baseType: BaseType.ENUM,
        values: classes.ParticleEmitterType
    },
    /**
     * @type Editor~TypeDescriptor
     */
    PARTICLE_STATE = {
        baseType: BaseType.OBJECT,
        name: "ParticleState",
        properties: {
            COLOR: {
                name: "color",
                type: BaseType.COLOR
            },
            SIZE: {
                name: "size",
                type: BaseType.NUMBER
            },
            TIME_TO_REACH: {
                name: "timeToReach",
                type: BaseType.NUMBER
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    PARTICLE_EMITTER = {
        baseType: BaseType.OBJECT,
        name: "ParticleEmitter",
        properties: {
            TYPE: {
                name: "type",
                type: PARTICLE_EMITTER_TYPE
            },
            DIMENSIONS: {
                name: "dimensions",
                type: BaseType.VECTOR3
            },
            DIRECTION_SPREAD: {
                name: "directionSpread",
                type: BaseType.NUMBER
            },
            VELOCITY: {
                name: "velocity",
                type: BaseType.NUMBER
            },
            VELOCITY_SPREAD: {
                name: "velocitySpread",
                type: BaseType.NUMBER
            },
            INITIAL_NUMBER: {
                name: "initialNumber",
                type: BaseType.NUMBER
            },
            SPAWN_NUMBER: {
                name: "spawnNumber",
                type: BaseType.NUMBER
            },
            SPAWN_TIME: {
                name: "spawnTime",
                type: BaseType.NUMBER
            },
            DURATION: {
                name: "duration",
                type: BaseType.NUMBER
            },
            SHADER: {
                name: "shader",
                type: SHADER_REFERENCE
            },
            TEXTURE: {
                name: "texture",
                type: TEXTURE_REFERENCE
            },
            PARTICLE_STATES: {
                name: "particleStates",
                type: BaseType.ARRAY,
                elementType: PARTICLE_STATE
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    LIGHT_STATE = {
        baseType: BaseType.OBJECT,
        name: "LightState",
        properties: {
            COLOR: {
                name: "color",
                type: BaseType.COLOR
            },
            INTENSITY: {
                name: "intensity",
                type: BaseType.NUMBER
            },
            TIME_TO_REACH: {
                name: "timeToReach",
                type: BaseType.NUMBER
            }
        }
    },
    /**
     * The descriptor object for propulsion classes, describing their properties
     * @type Editor~ItemDescriptor
     */
    EXPLOSION_CLASS = {
        NAME: {
            name: "name",
            type: BaseType.STRING
        },
        PARTICLE_EMITTERS: {
            name: "particleEmitters",
            type: BaseType.ARRAY,
            elementType: PARTICLE_EMITTER
        },
        LIGHT_STATES: {
            name: "lightStates",
            type: BaseType.ARRAY,
            elementType: LIGHT_STATE
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    PARTICLE_DESCRIPTOR = {
        baseType: BaseType.OBJECT,
        name: "ParticleDescriptor",
        properties: {
            SHADER: {
                name: "shader",
                type: SHADER_REFERENCE
            },
            TEXTURE: {
                name: "texture",
                type: TEXTURE_REFERENCE
            },
            COLOR: {
                name: "color",
                type: BaseType.COLOR
            },
            SIZE: {
                name: "size",
                type: BaseType.NUMBER
            },
            DURATION: {
                name: "duration",
                type: BaseType.NUMBER
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SOUND_DESCRIPTOR = {
        baseType: BaseType.OBJECT,
        name: "SoundDescriptor",
        properties: {
            NAME: {
                name: "name",
                type: BaseType.STRING
            },
            VOLUME: {
                name: "volume",
                type: BaseType.NUMBER
            },
            ROLLOFF: {
                name: "rolloff",
                type: BaseType.NUMBER
            }
        }
    },
    /**
     * The descriptor object for projectile classes, describing their properties
     * @type Editor~ItemDescriptor
     */
    PROJECTILE_CLASS = {
        NAME: {
            name: "name",
            type: BaseType.STRING
        },
        DAMAGE: {
            name: "damage",
            type: BaseType.NUMBER
        },
        SHADER: {
            name: "shader",
            type: SHADER_REFERENCE
        },
        TEXTURE: {
            name: "texture",
            type: TEXTURE_REFERENCE
        },
        SIZE: {
            name: "size",
            type: BaseType.NUMBER
        },
        MASS: {
            name: "mass",
            type: BaseType.NUMBER
        },
        DURATION: {
            name: "duration",
            type: BaseType.NUMBER
        },
        INTERSECTION_POSITIONS: {
            name: "intersectionPositions",
            type: BaseType.ARRAY,
            elementType: BaseType.NUMBER
        },
        WIDTH: {
            name: "width",
            type: BaseType.NUMBER
        },
        MUZZLE_FLASH: {
            name: "muzzleFlash",
            type: PARTICLE_DESCRIPTOR
        },
        LIGHT_COLOR: {
            name: "lightColor",
            type: BaseType.COLOR
        },
        LIGHT_INTENSITY: {
            name: "lightIntensity",
            type: BaseType.NUMBER
        },
        EXLOSION: {
            name: "explosion",
            type: EXPLOSION_CLASS_REFERENCE
        },
        HIT_SOUND: {
            name: "hitSound",
            type: SOUND_DESCRIPTOR
        }
    },
    /**
     * The descriptor object for propulsion classes, describing their properties
     * @type Editor~ItemDescriptor
     */
    PROPULSION_CLASS = {
        NAME: {
            name: "name",
            type: BaseType.STRING
        },
        SHADER: {
            name: "shader",
            type: SHADER_REFERENCE
        },
        TEXTURE: {
            name: "texture",
            type: TEXTURE_REFERENCE
        },
        COLOR: {
            name: "color",
            type: BaseType.COLOR
        },
        GRADE: {
            name: "grade",
            type: BaseType.NUMBER
        },
        REFERENCE_MASS: {
            name: "referenceMass",
            type: BaseType.NUMBER
        },
        THRUST: {
            name: "thrust",
            type: BaseType.NUMBER
        },
        ANGULAR_THRUST: {
            name: "angularThrust",
            type: BaseType.NUMBER
        },
        MAX_MOVE_BURN_LEVEL: {
            name: "maxMoveBurnLevel",
            type: BaseType.NUMBER
        },
        MAX_TURN_BURN_LEVEL: {
            name: "maxTurnBurnLevel",
            type: BaseType.NUMBER
        }
    },
    /**
     * The descriptor object for spacecraft types, describing their properties
     * @type Editor~ItemDescriptor
     */
    SPACECRAFT_TYPE = {
        NAME: {
            name: "name",
            type: BaseType.STRING
        },
        IS_FIGHTER_TYPE: {
            name: "isFighterType",
            type: BaseType.BOOLEAN
        },
        FULL_NAME: {
            name: "fullName",
            type: BaseType.STRING
        },
        DESCRIPTION: {
            name: "description",
            type: LONG_STRING
        },
        GOOD_AGAINST: {
            name: "goodAgainst",
            type: BaseType.ARRAY,
            elementType: SPACECRAFT_TYPE_REFERENCE
        },
        BAD_AGAINST: {
            name: "badAgainst",
            type: BaseType.ARRAY,
            elementType: SPACECRAFT_TYPE_REFERENCE
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    BODY = {
        baseType: BaseType.OBJECT,
        name: "Body",
        properties: {
            POSITION: {
                name: "position",
                type: BaseType.VECTOR3
            },
            ROTATIONS: {
                name: "rotations",
                type: BaseType.ROTATIONS
            },
            SIZE: {
                name: "size",
                type: BaseType.VECTOR3
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    WEAPON_SLOT = {
        baseType: BaseType.OBJECT,
        name: "WeaponSlot",
        properties: {
            POSITION: {
                name: "position",
                type: BaseType.VECTOR3
            },
            MAX_GRADE: {
                name: "maxGrade",
                type: BaseType.NUMBER
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    THRUSTER = {
        baseType: BaseType.OBJECT,
        name: "Thruster",
        properties: {
            POSITION: {
                name: "position",
                type: BaseType.VECTOR3
            },
            SIZE: {
                name: "size",
                type: BaseType.NUMBER
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    THRUSTER_USES = {
        baseType: BaseType.SET,
        name: "ThrusterUses",
        values: ThrusterUse
    },
    /**
     * @type Editor~TypeDescriptor
     */
    THRUSTER_SLOT = {
        baseType: BaseType.OBJECT,
        name: "ThrusterSlot",
        properties: {
            GROUP: {
                name: "group",
                type: BaseType.NUMBER
            },
            USES: {
                name: "uses",
                type: THRUSTER_USES
            },
            THRUSTERS: {
                name: "thrusters",
                type: BaseType.ARRAY,
                elementType: THRUSTER
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    VIEW = {
        baseType: BaseType.OBJECT,
        name: "View",
        properties: {
            NAME: {
                name: "name",
                type: BaseType.STRING
            },
            IS_AIMING_VIEW: {
                name: "isAimingView",
                type: BaseType.BOOLEAN
            },
            FOV: {
                name: "fov",
                type: BaseType.NUMBER
            },
            FOV_RANGE: {
                name: "fovRange",
                type: BaseType.RANGE
            },
            FPS: {
                name: "fps",
                type: BaseType.BOOLEAN
            },
            FOLLOWS_POSITION: {
                name: "followsPosition",
                type: BaseType.BOOLEAN
            },
            MOVABLE: {
                name: "movable",
                type: BaseType.BOOLEAN
            },
            TURNABLE: {
                name: "turnable",
                type: BaseType.BOOLEAN
            },
            ALPHA_RANGE: {
                name: "alphaRange",
                type: BaseType.RANGE
            },
            BETA_RANGE: {
                name: "betaRange",
                type: BaseType.RANGE
            },
            ROTATION_CENTER_IS_OBJECT: {
                name: "rotationCenterIsObject",
                type: BaseType.BOOLEAN
            },
            DISTANCE_RANGE: {
                name: "distanceRange",
                type: BaseType.RANGE
            },
            POSITION: {
                name: "position",
                type: BaseType.VECTOR3
            },
            ROTATIONS: {
                name: "rotations",
                type: BaseType.ROTATIONS
            },
            RESETS_ON_FOCUS_CHANGE: {
                name: "resetsOnFocusChange",
                type: BaseType.BOOLEAN
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    WEAPON = {
        baseType: BaseType.OBJECT,
        name: "Weapon",
        properties: {
            CLASS: {
                name: "class",
                type: WEAPON_CLASS_REFERENCE
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    PROPULSION = {
        baseType: BaseType.OBJECT,
        name: "Propulsion",
        properties: {
            CLASS: {
                name: "class",
                type: PROPULSION_CLASS_REFERENCE
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    EQUIPMENT_PROFILE = {
        baseType: BaseType.OBJECT,
        name: "EquipmentProfile",
        properties: {
            NAME: {
                name: "name",
                type: BaseType.STRING
            },
            WEAPONS: {
                name: "weapons",
                type: BaseType.ARRAY,
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
     * @type Editor~ItemDescriptor
     */
    SPACECRAFT_CLASS = {
        NAME: {
            name: "name",
            type: BaseType.STRING
        },
        TYPE: {
            name: "type",
            type: SPACECRAFT_TYPE_REFERENCE
        },
        FULL_NAME: {
            name: "fullName",
            type: BaseType.STRING
        },
        DESCRIPTION: {
            name: "description",
            type: LONG_STRING
        },
        SHOW_IN_DATABASE: {
            name: "showInDatabase",
            type: BaseType.BOOLEAN
        },
        HITPOINTS: {
            name: "hitpoints",
            type: BaseType.NUMBER
        },
        ARMOR: {
            name: "armor",
            type: BaseType.NUMBER
        },
        MODEL: {
            name: "model",
            type: MODEL_REFERENCE
        },
        SHADER: {
            name: "shader",
            type: SHADER_REFERENCE
        },
        TEXTURE: {
            name: "texture",
            type: TEXTURE_REFERENCE
        },
        FACTION_COLOR: {
            name: "factionColor",
            type: BaseType.COLOR
        },
        DEFAULT_LUMINOSITY_FACTORS: {
            name: "defaultLuminosityFactors",
            type: LUMINOSITY_FACTOR_PAIRS
        },
        MASS: {
            name: "mass",
            type: BaseType.NUMBER
        },
        BODIES: {
            name: "bodies",
            type: BaseType.ARRAY,
            elementType: BODY
        },
        WEAPON_SLOTS: {
            name: "weaponSlots",
            type: BaseType.ARRAY,
            elementType: WEAPON_SLOT
        },
        MAX_PROPULSION_GRADE: {
            name: "maxPropulsionGrade",
            type: BaseType.NUMBER
        },
        THRUSTER_SLOTS: {
            name: "thrusterSlots",
            type: BaseType.ARRAY,
            elementType: THRUSTER_SLOT
        },
        VIEWS: {
            name: "views",
            type: BaseType.ARRAY,
            elementType: VIEW
        },
        EQUIPMENT_PROFILES: {
            name: "equipmentProfiles",
            type: BaseType.ARRAY,
            elementType: EQUIPMENT_PROFILE
        }
    };
    /**
     * @class
     * Represents a basic or complex type.
     * @param {String|Editor~TypeDescriptor} type Either string, for basic types (from enum BaseType), or an object with a baseType property
     * containing the base type string and other properties containing the additional parameters of the type.
     */
    function Type(type) {
        /**
         * @type Editor~TypeDescriptor
         */
        this._descriptor = (typeof type === "string") ? {baseType: type} : type;
    }
    /**
     * Returns whether there is a property named "name" among the properties this (object based) type
     * @returns {Boolean}
     */
    Type.prototype.hasNameProperty = function () {
        var props, i;
        if (!this._descriptor.properties) {
            return false;
        }
        props = Object.keys(this._descriptor.properties);
        for (i = 0; i < props.length; i++) {
            if (this._descriptor.properties[props[i]].name === "name") {
                return true;
            }
        }
        return false;
    };
    /**
     * Returns the name of the type 
     * @returns {String}
     */
    Type.prototype.getName = function () {
        return this._descriptor.name;
    };
    /**
     * Returns a displayable name for the type 
     * @returns {String}
     */
    Type.prototype.getDisplayName = function () {
        if (this._descriptor.name) {
            return this._descriptor.name;
        }
        if (this._descriptor.resourceReference) {
            return this._descriptor.resourceReference;
        }
        if (this._descriptor.classReference) {
            return this._descriptor.classReference;
        }
        return this._descriptor.baseType;
    };
    /**
     * Returns the base type of this type
     * @returns {String} (enum BaseType)
     */
    Type.prototype.getBaseType = function () {
        return this._descriptor.baseType;
    };
    /**
     * For resource reference string types, returns the category of resources the type refers to
     * @returns {String}
     */
    Type.prototype.getResourceReference = function () {
        return this._descriptor.resourceReference;
    };
    /**
     * For class reference string types, returns the category of classes the type refers to
     * @returns {String}
     */
    Type.prototype.getClassReference = function () {
        return this._descriptor.classReference;
    };
    /**
     * For string types, returns whether the type is flagged as long
     * @returns {Boolean}
     */
    Type.prototype.isLong = function () {
        return this._descriptor.long;
    };
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        BaseType: BaseType,
        AXIS: AXIS,
        /**
         * @type Object.<String, Editor~ItemDescriptor>
         */
        itemDescriptors: {
            "skyboxClasses": SKYBOX_CLASS,
            "backgroundObjectClasses": BACKGROUND_OBJECT_CLASS,
            "dustCloudClasses": DUST_CLOUD_CLASS,
            "explosionClasses": EXPLOSION_CLASS,
            "projectileClasses": PROJECTILE_CLASS,
            "propulsionClasses": PROPULSION_CLASS,
            "spacecraftTypes": SPACECRAFT_TYPE,
            "spacecraftClasses": SPACECRAFT_CLASS
        },
        Type: Type
    };
});