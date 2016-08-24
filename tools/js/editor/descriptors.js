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
 * @param utils Used to handle enums
 * @param budaScene Used to access enums
 * @param resources Used to retrieve resource name lists
 * @param config Used for configuration (setting) key strings
 * @param classes Used to access enums and retrieve class name lists
 */
define([
    "utils/utils",
    "modules/buda-scene",
    "modules/media-resources",
    "armada/configuration",
    "armada/classes"
], function (utils, budaScene, resources, config, classes) {
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
                COLOR3: "color3", // RGB
                COLOR4: "color4", // RGBA
                VECTOR3: "vector3",
                RANGE: "range",
                PAIRS: "pairs",
                ROTATIONS: "rotations",
                SET: "set",
                CONFINES: "confines"
            },
    Unit = {
        TIMES: "x",
        METERS: "m",
        METERS_PER_SECOND: "m/s",
        METERS_PER_SECOND_SQUARED: "m/s^2",
        SECONDS: "s",
        MILLISECONDS: "ms",
        DEGREES: "degrees",
        DEGREES_PER_SECOND: "deg/s",
        DEGREES_PER_SECOND_SQUARED: "deg/s^2",
        KILOGRAMS: "kg"
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
    NAME_PROPERTY_NAME = "name",
            BASED_ON_PROPERTY_NAME = "basedOn",
            /**
             * @typedef {Object} Editor~TypeDescriptor
             * @property {String} baseType (enum BaseType)
             * @property {String} [unit] For BaseType.NUMBER
             * @property {Boolean} [long=false] For BaseType.STRING
             * @property {String} [resourceReference] For BaseType.ENUM and BaseType.SET
             * @property {String} [classReference] For BaseType.ENUM and BaseType.SET
             * @property {String} [name] For BaseType.OBJECT and BaseType.SET
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
             * @property {Boolean} [optional=false] Whether undefined / null (= unset) is actually a valid value for this property
             * @property {} [defaultValue] If the value is undefined, it means the property will be taken as having this value
             * @property {Boolean} [defaultDerived] If the value is undefined, the value of the property will be derived (calculated) from other properties
             * @property {Boolean} [globalDefault] If the value is undefined, the value of the property will be set from a global (configuration) variable
             * @property {String} [settingName] If globalDefault is true, the name of the setting from where the default value is retrieved from can be given here
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
    SCALE = {
        baseType: BaseType.NUMBER,
        unit: Unit.TIMES
    },
    METERS = {
        baseType: BaseType.NUMBER,
        unit: Unit.METERS
    },
    METERS_PER_SECOND = {
        baseType: BaseType.NUMBER,
        unit: Unit.METERS_PER_SECOND
    },
    METERS_PER_SECOND_SQUARED = {
        baseType: BaseType.NUMBER,
        unit: Unit.METERS_PER_SECOND_SQUARED
    },
    MILLISECONDS = {
        baseType: BaseType.NUMBER,
        unit: Unit.MILLISECONDS
    },
    DEGREES = {
        baseType: BaseType.NUMBER,
        unit: Unit.DEGREES
    },
    DEGREES_PER_SECOND = {
        baseType: BaseType.NUMBER,
        unit: Unit.DEGREES_PER_SECOND
    },
    DEGREES_PER_SECOND_SQUARED = {
        baseType: BaseType.NUMBER,
        unit: Unit.DEGREES_PER_SECOND_SQUARED
    },
    KILOGRAMS = {
        baseType: BaseType.NUMBER,
        unit: Unit.KILOGRAMS
    },
    /**
     * @type Editor~TypeDescriptor
     */
    MODEL_REFERENCE = {
        baseType: BaseType.ENUM,
        resourceReference: "models"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SHADER_REFERENCE = {
        baseType: BaseType.ENUM,
        resourceReference: "shaders"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    TEXTURE_REFERENCE = {
        baseType: BaseType.ENUM,
        resourceReference: "textures"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    CUBEMAP_REFERENCE = {
        baseType: BaseType.ENUM,
        resourceReference: "cubemaps"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SOUND_REFERENCE = {
        baseType: BaseType.ENUM,
        resourceReference: "soundEffects"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SKYBOX_CLASS_REFERENCE = {
        baseType: BaseType.ENUM,
        classReference: "skyboxClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    BACKGROUND_OBJECT_CLASS_REFERENCE = {
        baseType: BaseType.ENUM,
        classReference: "backgroundObjectClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    DUST_CLOUD_CLASS_REFERENCE = {
        baseType: BaseType.ENUM,
        classReference: "dustCloudClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SPACECRAFT_TYPE_REFERENCE = {
        baseType: BaseType.ENUM,
        classReference: "spacecraftTypes"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SPACECRAFT_CLASS_REFERENCE = {
        baseType: BaseType.ENUM,
        classReference: "spacecraftClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    EXPLOSION_CLASS_REFERENCE = {
        baseType: BaseType.ENUM,
        classReference: "explosionClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    PROJECTILE_CLASS_REFERENCE = {
        baseType: BaseType.ENUM,
        classReference: "projectileClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    WEAPON_CLASS_REFERENCE = {
        baseType: BaseType.ENUM,
        classReference: "weaponClasses"
    },
    /**
     * @type Editor~TypeDescriptor
     */
    PROPULSION_CLASS_REFERENCE = {
        baseType: BaseType.ENUM,
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
                type: SCALE
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
                type: BaseType.COLOR4
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
            type: BaseType.COLOR3
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
            type: METERS
        },
        COLOR: {
            name: "color",
            type: BaseType.COLOR4
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
                type: BaseType.COLOR4
            },
            SIZE: {
                name: "size",
                type: BaseType.NUMBER
            },
            TIME_TO_REACH: {
                name: "timeToReach",
                type: MILLISECONDS
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
                type: DEGREES
            },
            VELOCITY: {
                name: "velocity",
                type: METERS_PER_SECOND
            },
            VELOCITY_SPREAD: {
                name: "velocitySpread",
                type: METERS_PER_SECOND
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
                type: MILLISECONDS
            },
            DURATION: {
                name: "duration",
                type: MILLISECONDS
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
                type: BaseType.COLOR3
            },
            INTENSITY: {
                name: "intensity",
                type: BaseType.NUMBER
            },
            TIME_TO_REACH: {
                name: "timeToReach",
                type: MILLISECONDS
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
                type: SHADER_REFERENCE,
                defaultValue: "particle"
            },
            TEXTURE: {
                name: "texture",
                type: TEXTURE_REFERENCE
            },
            COLOR: {
                name: "color",
                type: BaseType.COLOR4,
                defaultValue: [1, 1, 1, 1]
            },
            SIZE: {
                name: "size",
                type: SCALE,
                defaultValue: 1
            },
            DURATION: {
                name: "duration",
                type: MILLISECONDS
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
                type: SOUND_REFERENCE
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
            type: SCALE
        },
        MASS: {
            name: "mass",
            type: KILOGRAMS
        },
        DURATION: {
            name: "duration",
            type: MILLISECONDS
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
            type: BaseType.COLOR3
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
     * @type Editor~TypeDescriptor
     */
    BARREL = {
        baseType: BaseType.OBJECT,
        name: "Barrel",
        properties: {
            PROJECTILE: {
                name: "projectile",
                type: PROJECTILE_CLASS_REFERENCE
            },
            PROJECTILE_VELOCITY: {
                name: "projectileVelocity",
                type: METERS_PER_SECOND
            },
            POSITION: {
                name: "position",
                type: BaseType.VECTOR3
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    WEAPON_ROTATION_STYLE = {
        baseType: BaseType.ENUM,
        values: classes.WeaponRotationStyle
    },
    /**
     * @type Editor~TypeDescriptor
     */
    WEAPON_ROTATOR = {
        baseType: BaseType.OBJECT,
        name: "WeaponRotator",
        properties: {
            AXIS: {
                name: "axis",
                type: BaseType.VECTOR3
            },
            CENTER: {
                name: "center",
                type: BaseType.VECTOR3
            },
            RANGE: {
                name: "range",
                type: BaseType.RANGE
            },
            DEFAULT_ANGLE: {
                name: "defaultAngle",
                type: DEGREES
            },
            ROTATION_RATE: {
                name: "rotationRate",
                type: DEGREES_PER_SECOND
            },
            TRANSFORM_GROUP_INDEX: {
                name: "transformGroupIndex",
                type: BaseType.NUMBER
            }
        }
    },
    /**
     * The descriptor object for weapon classes, describing their properties
     * @type Editor~ItemDescriptor
     */
    WEAPON_CLASS = {
        NAME: {
            name: "name",
            type: BaseType.STRING
        },
        SHADER: {
            name: "shader",
            type: SHADER_REFERENCE
        },
        MODEL: {
            name: "model",
            type: MODEL_REFERENCE
        },
        TEXTURE: {
            name: "texture",
            type: TEXTURE_REFERENCE
        },
        DEFAULT_LUMINOSITY_FACTORS: {
            name: "defaultLuminosityFactors",
            type: LUMINOSITY_FACTOR_PAIRS
        },
        GRADE: {
            name: "grade",
            type: BaseType.NUMBER
        },
        COOLDOWN: {
            name: "cooldown",
            type: MILLISECONDS
        },
        BARRELS: {
            name: "barrels",
            type: BaseType.ARRAY,
            elementType: BARREL
        },
        ATTACHMENT_POINT: {
            name: "attachmentPoint",
            type: BaseType.VECTOR3
        },
        ROTATION_STYLE: {
            name: "rotationStyle",
            type: WEAPON_ROTATION_STYLE
        },
        BASE_POINT: {
            name: "basePoint",
            type: BaseType.VECTOR3
        },
        ROTATORS: {
            name: "rotators",
            type: BaseType.ARRAY,
            elementType: WEAPON_ROTATOR
        },
        FIRE_SOUND: {
            name: "fireSound",
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
            type: BaseType.COLOR4
        },
        GRADE: {
            name: "grade",
            type: BaseType.NUMBER
        },
        REFERENCE_MASS: {
            name: "referenceMass",
            type: KILOGRAMS
        },
        THRUST: {
            name: "thrust",
            type: METERS_PER_SECOND_SQUARED
        },
        ANGULAR_THRUST: {
            name: "angularThrust",
            type: DEGREES_PER_SECOND_SQUARED
        },
        MAX_MOVE_BURN_LEVEL: {
            name: "maxMoveBurnLevel",
            type: BaseType.NUMBER
        },
        MAX_TURN_BURN_LEVEL: {
            name: "maxTurnBurnLevel",
            type: BaseType.NUMBER
        },
        THRUSTER_SOUND: {
            name: "thrusterSound",
            type: SOUND_DESCRIPTOR
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SPACECRAFT_TYPES = {
        baseType: BaseType.SET,
        name: "SpacecraftTypes",
        classReference: "spacecraftTypes"
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
            type: SPACECRAFT_TYPES
        },
        BAD_AGAINST: {
            name: "badAgainst",
            type: SPACECRAFT_TYPES
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SPACECRAFT_TURN_STYLE = {
        baseType: BaseType.ENUM,
        values: classes.SpacecraftTurnStyle
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
                type: BaseType.ROTATIONS,
                optional: true
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
                type: BaseType.VECTOR3,
                optional: true,
                defaultValue: [0, 0, 0]
            },
            ARRAY: {
                name: "array",
                type: BaseType.BOOLEAN,
                defaultValue: false
            },
            COUNT: {
                name: "count",
                type: BaseType.NUMBER,
                optional: true
            },
            START_POSITION: {
                name: "startPosition",
                type: BaseType.VECTOR3,
                optional: true
            },
            TRANSLATION_VECTOR: {
                name: "translationVector",
                type: BaseType.VECTOR3,
                optional: true
            },
            ROTATIONS: {
                name: "rotations",
                type: BaseType.ROTATIONS,
                optional: true
            },
            MAX_GRADE: {
                name: "maxGrade",
                type: BaseType.NUMBER,
                optional: false,
                defaultValue: 1
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
                type: SCALE
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
                elementType: THRUSTER,
                optional: true
            },
            ARRAY: {
                name: "array",
                type: BaseType.BOOLEAN,
                defaultValue: false
            },
            COUNT: {
                name: "count",
                type: BaseType.NUMBER,
                optional: true
            },
            START_POSITION: {
                name: "startPosition",
                type: BaseType.VECTOR3,
                optional: true
            },
            TRANSLATION_VECTOR: {
                name: "translationVector",
                type: BaseType.VECTOR3,
                optional: true
            },
            SIZE: {
                name: "size",
                type: SCALE,
                optional: true
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    BASE_ORIENTATION = {
        baseType: BaseType.ENUM,
        values: budaScene.CameraOrientationConfiguration.prototype.BaseOrientation
    },
    /**
     * @type Editor~TypeDescriptor
     */
    POINT_TO_FALLBACK = {
        baseType: BaseType.ENUM,
        values: budaScene.CameraOrientationConfiguration.prototype.PointToFallback
    },
    /**
     * @type Editor~TypeDescriptor
     */
    OBJECT_VIEW_LOOK_AT_MODE = {
        baseType: BaseType.ENUM,
        values: classes.ObjectViewLookAtMode
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
                type: DEGREES,
                globalDefault: true,
                settingName: config.CAMERA_SETTINGS.DEFAULT_FOV
            },
            FOV_RANGE: {
                name: "fovRange",
                type: BaseType.RANGE,
                globalDefault: true,
                settingName: config.CAMERA_SETTINGS.DEFAULT_FOV_RANGE
            },
            SPAN: {
                name: "span",
                type: METERS,
                globalDefault: true,
                settingName: config.CAMERA_SETTINGS.DEFAULT_SPAN
            },
            SPAN_RANGE: {
                name: "spanRange",
                type: BaseType.RANGE,
                globalDefault: true,
                settingName: config.CAMERA_SETTINGS.DEFAULT_SPAN_RANGE
            },
            FPS: {
                name: "fps",
                type: BaseType.BOOLEAN,
                defaultValue: false
            },
            FOLLOWS_POSITION: {
                name: "followsPosition",
                type: BaseType.BOOLEAN
            },
            BASE_ORIENTATION: {
                name: "baseOrientation",
                type: BASE_ORIENTATION,
                defaultDerived: true
            },
            POINT_TO_FALLBACK: {
                name: "pointToFallback",
                type: POINT_TO_FALLBACK,
                optional: true
            },
            STARTS_WITH_RELATIVE_POSITION: {
                name: "startsWithRelativePosition",
                type: BaseType.BOOLEAN,
                optional: true
            },
            LOOK_AT: {
                name: "lookAt",
                type: OBJECT_VIEW_LOOK_AT_MODE
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
                type: BaseType.RANGE,
                defaultDerived: true
            },
            BETA_RANGE: {
                name: "betaRange",
                type: BaseType.RANGE,
                defaultDerived: true
            },
            ROTATION_CENTER_IS_OBJECT: {
                name: "rotationCenterIsObject",
                type: BaseType.BOOLEAN,
                defaultDerived: true
            },
            DISTANCE_RANGE: {
                name: "distanceRange",
                type: BaseType.RANGE,
                optional: true
            },
            CONFINES: {
                name: "confines",
                type: BaseType.CONFINES,
                optional: true
            },
            RESETS_WHEN_LEAVING_CONFINES: {
                name: "resetsWhenLeavingConfines",
                type: BaseType.BOOLEAN,
                optional: true
            },
            POSITION: {
                name: "position",
                type: BaseType.VECTOR3
            },
            ROTATIONS: {
                name: "rotations",
                type: BaseType.ROTATIONS,
                optional: true
            },
            MOVES_RELATIVE_TO_OBJECT: {
                name: "movesRelativeToObject",
                type: BaseType.BOOLEAN,
                defaultValue: false
            },
            RESETS_ON_FOCUS_CHANGE: {
                name: "resetsOnFocusChange",
                type: BaseType.BOOLEAN,
                optional: true
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
                type: BaseType.STRING,
                defaultValue: "custom"
            },
            WEAPONS: {
                name: "weapons",
                type: BaseType.ARRAY,
                elementType: WEAPON,
                optional: true
            },
            PROPULSION: {
                name: "propulsion",
                type: PROPULSION,
                optional: true
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    DAMAGE_INDICATOR = {
        baseType: BaseType.OBJECT,
        name: "DamageIndicator",
        properties: {
            HULL_INTEGRITY: {
                name: "hullIntegrity",
                type: BaseType.NUMBER
            },
            CLASS: {
                name: "class",
                type: EXPLOSION_CLASS_REFERENCE
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SPACECRAFT_LIGHT = {
        baseType: BaseType.OBJECT,
        name: "Light",
        properties: {
            POSITION: {
                name: "position",
                type: BaseType.VECTOR3
            },
            COLOR: {
                name: "color",
                type: BaseType.COLOR3
            },
            INTENSITY: {
                name: "intensity",
                type: BaseType.NUMBER,
                defaultValue: 1
            },
            SPOT_DIRECTION: {
                name: "spotDirection",
                type: BaseType.VECTOR3,
                optional: true
            },
            SPOT_CUTOFF_ANGLE: {
                name: "spotCutoffAngle",
                type: DEGREES,
                optional: true
            },
            SPOT_FULL_INTENSITY_ANGLE: {
                name: "spotFullIntensityAngle",
                type: DEGREES,
                optional: true
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    BLINKER = {
        baseType: BaseType.OBJECT,
        name: "Blinker",
        properties: {
            PARTICLE: {
                name: "particle",
                type: PARTICLE_DESCRIPTOR
            },
            POSITION: {
                name: "position",
                type: BaseType.VECTOR3
            },
            PERIOD: {
                name: "period",
                type: MILLISECONDS,
                defaultValue: 1
            },
            BLINKS: {
                name: "blinks",
                type: BaseType.ARRAY,
                elementType: BaseType.NUMBER
            },
            INTENSITY: {
                name: "intensity",
                type: BaseType.NUMBER,
                defaultValue: 1
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
        BASED_ON: {
            name: "basedOn",
            type: SPACECRAFT_CLASS_REFERENCE,
            optional: true
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
        TURN_STYLE: {
            name: "turnStyle",
            type: SPACECRAFT_TURN_STYLE,
            defaultValue: classes.SpacecraftTurnStyle.YAW_PITCH
        },
        ATTACK_VECTOR: {
            name: "attackVector",
            type: BaseType.VECTOR3,
            defaultValue: [0, 1, 0]
        },
        ATTACK_THRESHOLD_ANGLE: {
            name: "attackThresholdAngle",
            type: DEGREES,
            defaultValue: 0
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
            type: BaseType.COLOR4
        },
        DEFAULT_LUMINOSITY_FACTORS: {
            name: "defaultLuminosityFactors",
            type: LUMINOSITY_FACTOR_PAIRS,
            optional: true
        },
        MASS: {
            name: "mass",
            type: KILOGRAMS
        },
        BODIES: {
            name: "bodies",
            type: BaseType.ARRAY,
            elementType: BODY
        },
        WEAPON_SLOTS: {
            name: "weaponSlots",
            type: BaseType.ARRAY,
            elementType: WEAPON_SLOT,
            optional: true
        },
        MAX_PROPULSION_GRADE: {
            name: "maxPropulsionGrade",
            type: BaseType.NUMBER
        },
        THRUSTER_SLOTS: {
            name: "thrusterSlots",
            type: BaseType.ARRAY,
            elementType: THRUSTER_SLOT,
            optional: true
        },
        VIEWS: {
            name: "views",
            type: BaseType.ARRAY,
            elementType: VIEW
        },
        EQUIPMENT_PROFILES: {
            name: "equipmentProfiles",
            type: BaseType.ARRAY,
            elementType: EQUIPMENT_PROFILE,
            optional: true
        },
        HUM_SOUND: {
            name: "humSound",
            type: SOUND_DESCRIPTOR,
            optional: true
        },
        EXPLOSION: {
            name: "explosion",
            type: EXPLOSION_CLASS_REFERENCE
        },
        EXPLOSION_SOUND: {
            name: "explosionSound",
            type: SOUND_DESCRIPTOR
        },
        SHOW_TIME_RATIO_DURING_EXPLOSION: {
            name: "showTimeRatioDuringExplosion",
            type: BaseType.NUMBER
        },
        DAMAGE_INDICATORS: {
            name: "damageIndicators",
            type: BaseType.ARRAY,
            elementType: DAMAGE_INDICATOR
        },
        LIGHTS: {
            name: "lights",
            type: BaseType.ARRAY,
            elementType: SPACECRAFT_LIGHT
        },
        BLINKERS: {
            name: "blinkers",
            type: BaseType.ARRAY,
            elementType: BLINKER
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    SKYBOX = {
        baseType: BaseType.OBJECT,
        name: "Skybox",
        properties: {
            CLASS: {
                name: "class",
                type: SKYBOX_CLASS_REFERENCE
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    BACKGROUND_OBJECT_POSITION = {
        baseType: BaseType.OBJECT,
        name: "BackgroundObjectPosition",
        properties: {
            ANGLE_ALPHA: {
                name: "angleAlpha",
                type: DEGREES
            },
            ANGLE_BETA: {
                name: "angleBeta",
                type: DEGREES
            },
            ANGLE_GAMMA: {
                name: "angleGamma",
                type: DEGREES,
                defaultValue: 0
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    BACKGROUND_OBJECT = {
        baseType: BaseType.OBJECT,
        name: "BackgroundObject",
        properties: {
            CLASS: {
                name: "class",
                type: BACKGROUND_OBJECT_CLASS_REFERENCE
            },
            POSITION: {
                name: "position",
                type: BACKGROUND_OBJECT_POSITION
            }
        }
    },
    /**
     * @type Editor~TypeDescriptor
     */
    DUST_CLOUD = {
        baseType: BaseType.OBJECT,
        name: "DustCloud",
        properties: {
            CLASS: {
                name: "class",
                type: DUST_CLOUD_CLASS_REFERENCE
            }
        }
    },
    /**
     * The descriptor object for spacecraft classes, describing their properties
     * @type Editor~ItemDescriptor
     */
    ENVIRONMENT = {
        SKYBOXES: {
            name: "skyboxes",
            type: BaseType.ARRAY,
            elementType: SKYBOX
        },
        BACKGROUND_OBJECTS: {
            name: "backgroundObjects",
            type: BaseType.ARRAY,
            elementType: BACKGROUND_OBJECT
        },
        DUST_CLOUDS: {
            name: "dustClouds",
            type: BaseType.ARRAY,
            elementType: DUST_CLOUD
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
            if (this._descriptor.properties[props[i]].name === NAME_PROPERTY_NAME) {
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
     * For number types, returns the unit of measurement
     * @returns {String}
     */
    Type.prototype.getUnit = function () {
        return this._descriptor.unit;
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
    /**
     * For enum and set types, returns the list of possible values
     * @returns {String[]}
     */
    Type.prototype.getValues = function () {
        if (this._descriptor.values) {
            return utils.getEnumValues(this._descriptor.values);
        }
        if (this._descriptor.resourceReference) {
            return resources.getResourceNames(this._descriptor.resourceReference);
        }
        if (this._descriptor.classReference) {
            return classes.getClassNames(this._descriptor.classReference);
        }
        document.crash();
    };
    /**
     * For object types, returns the object storing the property descriptors
     * @returns {Object}
     */
    Type.prototype.getProperties = function () {
        return this._descriptor.properties;
    };
    // ------------------------------------------------------------------------------
    // Public functions
    /**
     * 
     * @param {Editor~PropertyDescriptor} propertyDescriptor
     * @param {Object} parent
     * @returns {String[]}
     */
    function getPropertyValues(propertyDescriptor, parent) {
        var values = new Type(propertyDescriptor.type).getValues();
        if (parent && (propertyDescriptor.name === BASED_ON_PROPERTY_NAME)) {
            utils.removeFromArray(values, parent[NAME_PROPERTY_NAME]);
        }
        return values;
    }
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        BaseType: BaseType,
        ThrusterUse: ThrusterUse,
        NAME_PROPERTY_NAME: NAME_PROPERTY_NAME,
        BASED_ON_PROPERTY_NAME: BASED_ON_PROPERTY_NAME,
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
            "weaponClasses": WEAPON_CLASS,
            "propulsionClasses": PROPULSION_CLASS,
            "spacecraftTypes": SPACECRAFT_TYPE,
            "spacecraftClasses": SPACECRAFT_CLASS,
            "environments": ENVIRONMENT
        },
        Type: Type,
        getPropertyValues: getPropertyValues
    };
});