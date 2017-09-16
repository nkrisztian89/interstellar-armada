/**
 * Copyright 2016-2017 Krisztián Nagy
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
 * @param managedGL Used to access enums
 * @param egomModel Used to access enums
 * @param camera Used to access enums
 * @param resources Used to retrieve resource name lists
 * @param config Used for configuration (setting) key strings
 * @param graphics Used to access contants
 * @param classes Used to access enums and retrieve class name lists
 * @param equipment Used to access enums 
 * @param common Used to access enums (ItemType)
 */
define([
    "utils/utils",
    "modules/managed-gl",
    "modules/egom-model",
    "modules/scene/camera",
    "modules/media-resources",
    "armada/configuration",
    "armada/graphics",
    "armada/logic/classes",
    "armada/logic/equipment",
    "editor/common"
], function (utils, managedGL, egomModel, camera, resources, config, graphics, classes, equipment, common) {
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
                ENUM: "enum", // string or number that must have a value from a fixed set (defined in an object such as {FIRST: 1, SECOND: 2} -> value must be 1 or 2)
                ASSOCIATIVE_ARRAY: "associativeArray", // object with custom properties
                COLOR3: "color3", // [r, g, b]
                COLOR4: "color4", // [r, g, b, a]
                VECTOR3: "vector3", // [x, y, z]
                RANGE: "range", // [min, max]
                PAIRS: "pairs", // [[a, b], [a, b], ...]
                ROTATIONS: "rotations", // [{axis: "X"/"Y"/"Z", degrees: x}, ...]
                SET: "set", // array where all elements must be members of an enum
                CONFINES: "confines" // [[minX, maxX], [minY, maxY], [minZ, maxZ]]
            },
            Unit = {
                TIMES: "x",
                METERS: "m",
                METERS_PER_SECOND: "m/s",
                METERS_PER_SECOND_SQUARED: "m/s²",
                SECONDS: "s",
                MILLISECONDS: "ms",
                PER_SECOND: "/s",
                DEGREES: "°",
                DEGREES_PER_SECOND: "°/s",
                DEGREES_PER_SECOND_SQUARED: "°/s²",
                KILOGRAMS: "kg",
                PERCENT: "%"
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
            ThrusterUse = equipment.ThrusterUse,
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
             * @property {String|Editor~TypeDescriptor} [elementType] For BaseType.ARRAY and BaseType.ASSOCIATIVE_ARRAY
             * @property {String[]} [validKeys] For BaseType.ASSOCIATIVE_ARRAY (if not given, all keys valid)
             */
            /**
             * @typedef {Object} Editor~PropertyDescriptor
             * @property {String} name
             * @property {String|Editor~TypeDescriptor} type (if string: enum BaseType)
             * @property {Boolean} [optional=false] Whether undefined / null (= unset) is actually a valid value for this property
             * @property {} [defaultValue] If the value is undefined, it means the property will be taken as having this value. 
             * Use this for properties for which the game logic actually replaces undefined values with a proper value upon loading.
             * When a new object is created having this property, this default value will be set for it. (unless an explicit newValue is 
             * specified)
             * @property {Boolean} [defaultDerived] If the value is undefined, the value of the property will be derived (calculated) from other properties
             * @property {Boolean} [globalDefault] If the value is undefined, the value of the property will be set from a global (configuration) variable
             * @property {String} [settingName] If globalDefault is true, the name of the setting from where the default value is retrieved from can be given here
             * @property {} [newValue] When a new object is created having this property, this value will be set as its value.
             * @property {Boolean} [createDefaultElement] If the property is of an array type, its default value should be an array with one
             * element having its default value (instead of an empty array)
             */
            /**
             * @typedef {Object.<String, PropertyDescriptor>} Editor~ItemDescriptor
             */
            // ------------------------------------------------------------------------------
            // private functions used for constants
            /**
             * Returns a type descriptor describing an array type that has elements of the passed type
             * @param {Editor~TypeDescriptor} elementType
             * @returns {Editor~TypeDescriptor}
             */
            _createTypedArrayType = function (elementType) {
                return {
                    baseType: BaseType.ARRAY,
                    elementType: elementType
                };
            },
            /**
             * Returns a type descriptor describing an associative array type that has elements of the passed type
             * @param {Editor~TypeDescriptor} elementType
             * @returns {Editor~TypeDescriptor}
             */
            _createTypedAssociativeArrayType = function (elementType) {
                return {
                    baseType: BaseType.ASSOCIATIVE_ARRAY,
                    elementType: elementType
                };
            },
            // ------------------------------------------------------------------------------
            // Constants
            NAME_PROPERTY_NAME = "name",
            BASED_ON_PROPERTY_NAME = "basedOn",
            /**
             * @type Editor~TypeDescriptor
             */
            NUMBER_ARRAY = _createTypedArrayType(BaseType.NUMBER),
            /**
             * @type Editor~TypeDescriptor
             */
            STRING_ARRAY = _createTypedArrayType(BaseType.STRING),
            /**
             * @type Editor~TypeDescriptor
             */
            STRING_ASSOCIATIVE_ARRAY = _createTypedAssociativeArrayType(BaseType.STRING),
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
            PER_SECOND = {
                baseType: BaseType.NUMBER,
                unit: Unit.PER_SECOND
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
            PERCENT = {
                baseType: BaseType.NUMBER,
                unit: Unit.PERCENT
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
            JUMP_ENGINE_CLASS_REFERENCE = {
                baseType: BaseType.ENUM,
                classReference: "jumpEngineClasses"
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SHIELD_CLASS_REFERENCE = {
                baseType: BaseType.ENUM,
                classReference: "shieldClasses"
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
             * The descriptor object for texture resources, describing their properties
             * @type Editor~ItemDescriptor
             */
            TEXTURE = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                BASEPATH: {
                    name: "basepath",
                    type: BaseType.STRING
                },
                FORMAT: {
                    name: "format",
                    type: BaseType.STRING
                },
                USE_MIPMAP: {
                    name: "useMipmap",
                    type: BaseType.BOOLEAN
                },
                TYPE_SUFFIXES: {
                    name: "typeSuffixes",
                    type: STRING_ASSOCIATIVE_ARRAY
                },
                QUALITY_SUFFIXES: {
                    name: "qualitySuffixes",
                    type: STRING_ASSOCIATIVE_ARRAY
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            CUBEMAP_IMAGE_NAMES = {
                baseType: BaseType.OBJECT,
                name: "CubemapImageNames",
                properties: {
                    POS_X: {
                        name: "posX",
                        type: BaseType.STRING
                    },
                    NEG_X: {
                        name: "negX",
                        type: BaseType.STRING
                    },
                    POS_Y: {
                        name: "posY",
                        type: BaseType.STRING
                    },
                    NEG_Y: {
                        name: "negY",
                        type: BaseType.STRING
                    },
                    POS_Z: {
                        name: "posZ",
                        type: BaseType.STRING
                    },
                    NEG_Z: {
                        name: "negZ",
                        type: BaseType.STRING
                    }
                }
            },
            /**
             * The descriptor object for cubemap resources, describing their properties
             * @type Editor~ItemDescriptor
             */
            CUBEMAP = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                BASEPATH: {
                    name: "basepath",
                    type: BaseType.STRING
                },
                FORMAT: {
                    name: "format",
                    type: BaseType.STRING
                },
                IMAGE_NAMES: {
                    name: "imageNames",
                    type: CUBEMAP_IMAGE_NAMES
                },
                QUALITY_SUFFIXES: {
                    name: "qualitySuffixes",
                    type: STRING_ASSOCIATIVE_ARRAY
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SHADER_VARIANTS = {
                baseType: BaseType.ASSOCIATIVE_ARRAY,
                validKeys: [
                    graphics.SHADER_VARIANT_WITHOUT_SHADOWS_NAME,
                    graphics.SHADER_VARIANT_WITHOUT_DYNAMIC_LIGHTS_NAME,
                    classes.SHADER_VARIANT_INSTANCED_NAME
                ],
                elementType: SHADER_REFERENCE
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SHADER_BLEND_MODE = {
                baseType: BaseType.ENUM,
                values: managedGL.ShaderBlendMode
            },
            /**
             * @type Editor~TypeDescriptor
             */
            VERTEX_ATTRIBUTE_ROLE = {
                baseType: BaseType.ENUM,
                name: "VertexAttributeRole",
                values: egomModel.VertexAttributeRole
            },
            /**
             * The descriptor object for shader resources, describing their properties
             * @type Editor~ItemDescriptor
             */
            SHADER = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                VARIANTS: {
                    name: "variants",
                    type: SHADER_VARIANTS,
                    optional: true
                },
                VERTEX_SHADER_SOURCE: {
                    name: "vertexShaderSource",
                    type: BaseType.STRING
                },
                FRAGMENT_SHADER_SOURCE: {
                    name: "fragmentShaderSource",
                    type: BaseType.STRING
                },
                BLEND_MODE: {
                    name: "blendMode",
                    type: SHADER_BLEND_MODE
                },
                VERTEX_ATTRIBUTE_ROLES: {
                    name: "vertexAttributeRoles",
                    type: _createTypedAssociativeArrayType(VERTEX_ATTRIBUTE_ROLE)
                },
                INSTANCE_ATTRIBUTE_ROLES: {
                    name: "instanceAttributeRoles",
                    type: STRING_ASSOCIATIVE_ARRAY,
                    optional: true
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MODEL_FILE_DESCRIPTOR = {
                baseType: BaseType.OBJECT,
                name: "ModelFileDescriptor",
                properties: {
                    SUFFIX: {
                        name: "suffix",
                        type: BaseType.STRING
                    },
                    MAX_LOD: {
                        name: "maxLOD",
                        type: BaseType.NUMBER
                    }
                }
            },
            /**
             * The descriptor object for model resources, describing their properties
             * @type Editor~ItemDescriptor
             */
            MODEL = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                BASEPATH: {
                    name: "basepath",
                    type: BaseType.STRING
                },
                FORMAT: {
                    name: "format",
                    type: BaseType.STRING
                },
                FILES: {
                    name: "files",
                    type: _createTypedArrayType(MODEL_FILE_DESCRIPTOR)
                }
            },
            /**
             * The descriptor object for sound effect resources, describing their properties
             * @type Editor~ItemDescriptor
             */
            SOUND_EFFECT = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                SAMPLES: {
                    name: "samples",
                    type: STRING_ARRAY
                }
            },
            /**
             * The descriptor object for music resources, describing their properties
             * @type Editor~ItemDescriptor
             */
            MUSIC = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                SAMPLES: {
                    name: "sample",
                    type: BaseType.STRING
                }
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
                    type: _createTypedArrayType(BACKGROUND_OBJECT_LAYER)
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
                    HAS_PROJECTILE_MODEL: {
                        name: "hasProjectileModel",
                        type: BaseType.BOOLEAN,
                        defaultValue: false
                    },
                    PROJECTILE_MODEL_WIDTH: {
                        name: "projectileModelWidth",
                        type: BaseType.NUMBER,
                        optional: true,
                        defaultValue: 1
                    },
                    PROJECTILE_MODEL_INTERSECTION: {
                        name: "projectileModelIntersection",
                        type: BaseType.NUMBER,
                        optional: true,
                        defaultValue: 0
                    },
                    DIMENSIONS: {
                        name: "dimensions",
                        type: BaseType.VECTOR3,
                        defaultValue: [0, 0, 0]
                    },
                    DIRECTION_SPREAD: {
                        name: "directionSpread",
                        type: DEGREES,
                        defaultValue: 0
                    },
                    VELOCITY: {
                        name: "velocity",
                        type: METERS_PER_SECOND,
                        defaultValue: 0
                    },
                    VELOCITY_SPREAD: {
                        name: "velocitySpread",
                        type: METERS_PER_SECOND,
                        defaultValue: 0
                    },
                    INITIAL_NUMBER: {
                        name: "initialNumber",
                        type: BaseType.NUMBER,
                        defaultValue: 0
                    },
                    SPAWN_NUMBER: {
                        name: "spawnNumber",
                        type: BaseType.NUMBER,
                        defaultValue: 0
                    },
                    SPAWN_TIME: {
                        name: "spawnTime",
                        type: MILLISECONDS,
                        defaultValue: 1
                    },
                    DURATION: {
                        name: "duration",
                        type: MILLISECONDS,
                        defaultValue: 1
                    },
                    DELAY: {
                        name: "delay",
                        type: MILLISECONDS,
                        defaultValue: 0
                    },
                    SHADER: {
                        name: "shader",
                        type: SHADER_REFERENCE,
                        globalDefault: true,
                        settingName: config.EDITOR_SETTINGS.DEFAULT_PARTICLE_SHADER
                    },
                    TEXTURE: {
                        name: "texture",
                        type: TEXTURE_REFERENCE
                    },
                    PARTICLE_STATES: {
                        name: "particleStates",
                        type: _createTypedArrayType(PARTICLE_STATE),
                        createDefaultElement: true
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
                        type: BaseType.NUMBER,
                        defaultValue: 1
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
                    type: _createTypedArrayType(PARTICLE_EMITTER)
                },
                LIGHT_STATES: {
                    name: "lightStates",
                    type: _createTypedArrayType(LIGHT_STATE),
                    optional: true,
                    createDefaultElement: true
                },
                SOUND_EFFECT: {
                    name: "soundEffect",
                    type: SOUND_DESCRIPTOR,
                    optional: true
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
                        globalDefault: true,
                        settingName: config.EDITOR_SETTINGS.DEFAULT_PARTICLE_SHADER
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
                    type: NUMBER_ARRAY
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
                EXPLOSION: {
                    name: "explosion",
                    type: EXPLOSION_CLASS_REFERENCE
                },
                SHIELD_EXPLOSION: {
                    name: "shieldExplosion",
                    type: EXPLOSION_CLASS_REFERENCE
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
                    type: _createTypedArrayType(BARREL)
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
                    type: _createTypedArrayType(WEAPON_ROTATOR)
                },
                FIRE_SOUND: {
                    name: "fireSound",
                    type: SOUND_DESCRIPTOR
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: BaseType.NUMBER
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
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: BaseType.NUMBER
                }
            },
            /**
             * The descriptor object for jump engine classes, describing their properties
             * @type Editor~ItemDescriptor
             */
            JUMP_ENGINE_CLASS = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                ENGAGE_SOUND: {
                    name: "engageSound",
                    type: SOUND_DESCRIPTOR
                },
                DISENGAGE_SOUND: {
                    name: "disengageSound",
                    type: SOUND_DESCRIPTOR
                },
                PREPARE_VELOCITY: {
                    name: "prepareVelocity",
                    type: METERS_PER_SECOND
                },
                PREPARE_DURATION: {
                    name: "prepareDuration",
                    type: MILLISECONDS
                },
                PREPARE_SOUND: {
                    name: "prepareSound",
                    type: SOUND_DESCRIPTOR
                },
                CANCEL_SOUND: {
                    name: "cancelSound",
                    type: SOUND_DESCRIPTOR
                },
                JUMP_OUT_ACCELERATION: {
                    name: "jumpOutAcceleration",
                    type: METERS_PER_SECOND_SQUARED
                },
                JUMP_OUT_DURATION: {
                    name: "jumpOutDuration",
                    type: MILLISECONDS
                },
                JUMP_OUT_SCALING: {
                    name: "jumpOutScaling",
                    type: BaseType.NUMBER
                },
                JUMP_OUT_SOUND: {
                    name: "jumpOutSound",
                    type: SOUND_DESCRIPTOR
                },
                JUMP_OUT_EXPLOSION: {
                    name: "jumpOutExplosion",
                    type: EXPLOSION_CLASS_REFERENCE
                },
                JUMP_IN_DECELERATION: {
                    name: "jumpInDeceleration",
                    type: METERS_PER_SECOND_SQUARED
                },
                JUMP_IN_DURATION: {
                    name: "jumpInDuration",
                    type: MILLISECONDS
                },
                JUMP_IN_VELOCITY: {
                    name: "jumpInVelocity",
                    type: METERS_PER_SECOND
                },
                JUMP_IN_SCALING: {
                    name: "jumpInScaling",
                    type: BaseType.NUMBER
                },
                JUMP_IN_SOUND: {
                    name: "jumpInSound",
                    type: SOUND_DESCRIPTOR
                },
                JUMP_IN_EXPLOSION: {
                    name: "jumpInExplosion",
                    type: EXPLOSION_CLASS_REFERENCE
                }
            },
            /**
             * The descriptor object for shield classes, describing their properties
             * @type Editor~ItemDescriptor
             */
            SHIELD_CLASS = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                CAPACITY: {
                    name: "capacity",
                    type: BaseType.NUMBER
                },
                RECHARGE_DELAY: {
                    name: "rechargeDelay",
                    type: MILLISECONDS
                },
                RECHARGE_RATE: {
                    name: "rechargeRate",
                    type: PER_SECOND
                },
                RECHARGE_COLOR: {
                    name: "rechargeColor",
                    type: BaseType.COLOR3
                },
                RECHARGE_ANIMATION_DURATION: {
                    name: "rechargeAnimationDuration",
                    type: MILLISECONDS
                },
                RECHARGE_START_SOUND: {
                    name: "rechargeStartSound",
                    type: SOUND_DESCRIPTOR
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: BaseType.NUMBER
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
                        type: _createTypedArrayType(THRUSTER),
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
                values: camera.CameraOrientationConfiguration.BaseOrientation
            },
            /**
             * @type Editor~TypeDescriptor
             */
            POINT_TO_FALLBACK = {
                baseType: BaseType.ENUM,
                values: camera.CameraOrientationConfiguration.PointToFallback
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
                    },
                    EXCLUDE_FROM_CYCLE: {
                        name: "excludeFromCycle",
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
                    },
                    SLOT_INDEX: {
                        name: "slotIndex",
                        type: BaseType.NUMBER,
                        optional: true,
                        defaultDerived: true
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
            JUMP_ENGINE = {
                baseType: BaseType.OBJECT,
                name: "JumpEngine",
                properties: {
                    CLASS: {
                        name: "class",
                        type: JUMP_ENGINE_CLASS_REFERENCE
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SHIELD = {
                baseType: BaseType.OBJECT,
                name: "Shield",
                properties: {
                    CLASS: {
                        name: "class",
                        type: SHIELD_CLASS_REFERENCE
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
                        type: _createTypedArrayType(WEAPON),
                        optional: true
                    },
                    PROPULSION: {
                        name: "propulsion",
                        type: PROPULSION,
                        optional: true
                    },
                    JUMP_ENGINE: {
                        name: "jumpEngine",
                        type: JUMP_ENGINE,
                        optional: true
                    },
                    SHIELD: {
                        name: "shield",
                        type: SHIELD,
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
                        type: PERCENT,
                        newValue: 50
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
                        type: NUMBER_ARRAY
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
                    type: BaseType.STRING,
                    newValue: "unnamed"
                },
                DESCRIPTION: {
                    name: "description",
                    type: LONG_STRING,
                    newValue: "-"
                },
                SHOW_IN_DATABASE: {
                    name: "showInDatabase",
                    type: BaseType.BOOLEAN
                },
                HITPOINTS: {
                    name: "hitpoints",
                    type: BaseType.NUMBER,
                    newValue: 1
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
                    type: KILOGRAMS,
                    newValue: 1
                },
                BODIES: {
                    name: "bodies",
                    type: _createTypedArrayType(BODY)
                },
                WEAPON_SLOTS: {
                    name: "weaponSlots",
                    type: _createTypedArrayType(WEAPON_SLOT),
                    optional: true
                },
                MAX_PROPULSION_GRADE: {
                    name: "maxPropulsionGrade",
                    type: BaseType.NUMBER,
                    newValue: 1
                },
                THRUSTER_SLOTS: {
                    name: "thrusterSlots",
                    type: _createTypedArrayType(THRUSTER_SLOT),
                    optional: true
                },
                VIEWS: {
                    name: "views",
                    type: _createTypedArrayType(VIEW)
                },
                EQUIPMENT_PROFILES: {
                    name: "equipmentProfiles",
                    type: _createTypedArrayType(EQUIPMENT_PROFILE),
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
                SHOW_TIME_RATIO_DURING_EXPLOSION: {
                    name: "showTimeRatioDuringExplosion",
                    type: BaseType.NUMBER,
                    newValue: 1
                },
                DAMAGE_INDICATORS: {
                    name: "damageIndicators",
                    type: _createTypedArrayType(DAMAGE_INDICATOR)
                },
                LIGHTS: {
                    name: "lights",
                    type: _createTypedArrayType(SPACECRAFT_LIGHT)
                },
                BLINKERS: {
                    name: "blinkers",
                    type: _createTypedArrayType(BLINKER)
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: BaseType.NUMBER,
                    newValue: 1
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
                    SIZE: {
                        name: "size",
                        type: SCALE,
                        newValue: 100
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
                    type: _createTypedArrayType(SKYBOX)
                },
                BACKGROUND_OBJECTS: {
                    name: "backgroundObjects",
                    type: _createTypedArrayType(BACKGROUND_OBJECT)
                },
                DUST_CLOUDS: {
                    name: "dustClouds",
                    type: _createTypedArrayType(DUST_CLOUD)
                }
            };
    /**
     * @class
     * Represents a basic or complex type.
     * @param {String|Editor~TypeDescriptor|Editor~ItemDescriptor} type Either string, for basic types (from enum BaseType), or an object 
     * with a baseType property containing the base type string and other properties containing the additional parameters of the type.
     * Item descriptors are also accepted, taking them as an unnamed object type with the given properties
     */
    function Type(type) {
        /**
         * @type Editor~TypeDescriptor
         */
        this._descriptor = (typeof type === "string") ? {baseType: type} : type;
        // interpret descriptors without a baseType as item descriptors
        if (!this._descriptor.baseType) {
            this._descriptor = {
                baseType: BaseType.OBJECT,
                properties: this._descriptor
            };
        }
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
     * 
     * @returns {Editor~TypeDescriptor}
     */
    Type.prototype.getDescriptor = function () {
        return this._descriptor;
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
     * Returns whether this type is a reference string (e.g. resource or class reference) type
     * @returns {Boolean}
     */
    Type.prototype.isItemReference = function () {
        return !!this._descriptor.resourceReference || !!this._descriptor.classReference;
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
     * For reference string types, returns the ItemType corresponding to the type of reference
     * @returns {ItemType}
     */
    Type.prototype.getReferenceItemType = function () {
        if (this.getResourceReference()) {
            return common.ItemType.RESOURCE;
        }
        if (this.getClassReference()) {
            return common.ItemType.CLASS;
        }
        common.ItemType.NONE;
    };
    /**
     * For reference string types, returns the name of the category of items it references
     * @returns {String}
     */
    Type.prototype.getReferenceItemCategory = function () {
        return this._descriptor.resourceReference || this._descriptor.classReference;
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
    /**
     * For associative arrays, returns the list of valid keys. If there is no restriction on valid keys, no array is returned.
     * @returns {String[]}
     */
    Type.prototype.getValidKeys = function () {
        return this._descriptor.validKeys;
    };
    /**
     * Returns the type of elements for arrays and associative arrays.
     * @returns {Type}
     */
    Type.prototype.getElementType = function () {
        return new Type(this._descriptor.elementType);
    };
    /**
     * Returns the type of the first members of pairs (for pairs type)
     * @returns {Type}
     */
    Type.prototype.getFirstType = function () {
        return new Type(this._descriptor.first.type);
    };
    /**
     * Returns the type of the second members of pairs (for pairs type)
     * @returns {Type}
     */
    Type.prototype.getSecondType = function () {
        return new Type(this._descriptor.second.type);
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
        // an object cannot reference itself (e.g. a fighter class cannot be based on itself)
        if (parent && (propertyDescriptor.name === BASED_ON_PROPERTY_NAME)) {
            utils.removeFromArray(values, parent[NAME_PROPERTY_NAME]);
        }
        return values;
    }
    // ------------------------------------------------------------------------------
    // Initialization
    graphics.executeWhenReady(function () {
        // shader variants can be set for graphics quality levels (which will be used instead of the original shader in case the corresponding
        // graphics quality is set)
        SHADER_VARIANTS.validKeys = graphics.getShaderComplexities().concat(SHADER_VARIANTS.validKeys);
    });
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
            "textures": TEXTURE,
            "cubemaps": CUBEMAP,
            "shaders": SHADER,
            "models": MODEL,
            "soundEffects": SOUND_EFFECT,
            "music": MUSIC,
            "skyboxClasses": SKYBOX_CLASS,
            "backgroundObjectClasses": BACKGROUND_OBJECT_CLASS,
            "dustCloudClasses": DUST_CLOUD_CLASS,
            "explosionClasses": EXPLOSION_CLASS,
            "projectileClasses": PROJECTILE_CLASS,
            "weaponClasses": WEAPON_CLASS,
            "propulsionClasses": PROPULSION_CLASS,
            "jumpEngineClasses": JUMP_ENGINE_CLASS,
            "shieldClasses": SHIELD_CLASS,
            "spacecraftTypes": SPACECRAFT_TYPE,
            "spacecraftClasses": SPACECRAFT_CLASS,
            "environments": ENVIRONMENT
        },
        Type: Type,
        getPropertyValues: getPropertyValues
    };
});