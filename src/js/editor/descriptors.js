/**
 * Copyright 2016-2017, 2019-2023 Krisztián Nagy
 * @file Provides the descriptor objects that outline the structure of properties for the various resource / class categories of 
 * Interstellar Armada for the editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used to handle enums
 * @param managedGL Used to access enums
 * @param egomModel Used to access enums
 * @param camera Used to access enums
 * @param resources Used to retrieve resource name lists
 * @param config Used for configuration (setting) key strings
 * @param graphics Used to access contants
 * @param strings Used to access string key lists
 * @param classes Used to access enums and retrieve class name lists
 * @param environments Used to retrieve environment name lists
 * @param missions Used to access enums
 * @param conditions Used to access enums
 * @param missionActions Used to access enums
 * @param missionEvents Used to access enums
 * @param equipment Used to access enums 
 * @param formations Used to access enums 
 * @param spacecraft Used to access enums 
 * @param ai Used to access the list of valid AI types
 * @param battle Used to access HUD enums
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
    "armada/strings",
    "armada/logic/classes",
    "armada/logic/environments",
    "armada/logic/missions",
    "armada/logic/missions/conditions",
    "armada/logic/missions/actions",
    "armada/logic/missions/events",
    "armada/logic/equipment",
    "armada/logic/formations",
    "armada/logic/spacecraft",
    "armada/logic/ai",
    "armada/screens/battle",
    "editor/common"
], function (
        utils,
        managedGL, egomModel, camera, resources,
        config, graphics, strings,
        classes, environments, missions, conditions, missionActions, missionEvents, equipment, formations, spacecraft, ai,
        battle,
        common) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Imports
            ConditionType = conditions.ConditionType,
            ActionType = missionActions.ActionType,
            TriggerWhen = missionEvents.TriggerWhen,
            TriggerWhich = missionEvents.TriggerWhich,
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
                TIMES: "×",
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
             * @property {String} [environmentReference] For BaseType.ENUM and BaseType.SET
             * @property {String} [missionReference] For BaseType.ENUM and BaseType.SET
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
             * @property {Boolean} [globalDefault] If the value is undefined, the value of the property will be set from a global (configuration) variable
             * @property {String} [settingName] If globalDefault is true, the name of the setting from where the default value is retrieved from can be given here
             * @property {} [newValue] When a new object is created having this property, this value will be set as its value.
             * @property {String} [defaultText] The text to show in the editor when the property is unset and has no default value or it is better to show
             * some explanation instead of the default value
             * @property {Function} [getSuggestions] Function to return a list of auto-complete suggestions to display for a string property
             */
            /**
             * @typedef {Object.<String, PropertyDescriptor>} Editor~ItemDescriptor
             */
            // ------------------------------------------------------------------------------
            // private functions used for constants
            /**
             * Returns a type descriptor describing an array type that has elements of the passed type
             * @param {Editor~TypeDescriptor} elementType
             * @param {Object} [length]
             * @param {Function} [getPreviewText]
             * @param {Number} [showCount] If getPreviewText is not given, generates one that shows the
             * elements of the array separated by commas if there are this many or fewer elements
             * @returns {Editor~TypeDescriptor}
             */
            _createTypedArrayType = function (elementType, length, getPreviewText, showCount) {
                return {
                    baseType: BaseType.ARRAY,
                    elementType: elementType,
                    fixedLength: length && length.fixed,
                    minLength: length && length.min,
                    maxLength: length && length.max,
                    getPreviewText: getPreviewText || (showCount ? function (array) {
                        if (array.length > 0 && array.length <= showCount) {
                            return "[" + array.join(", ") + "]";
                        }
                    } : undefined)
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
            /**
             * Returns a type descriptor describing an range type
             * @param {Boolean} minRequired
             * @param {Boolean} maxRequired
             * @param {Editor~TypeDescriptor} [elementType] from enum Unit
             * @returns {Editor~TypeDescriptor}
             */
            _createRangeType = function (minRequired, maxRequired, elementType) {
                return {
                    baseType: BaseType.RANGE,
                    minRequired: minRequired,
                    maxRequired: maxRequired,
                    elementType: elementType
                };
            },
            // ------------------------------------------------------------------------------
            // Constants
            NAME_PROPERTY_NAME = "name",
            BASED_ON_PROPERTY_NAME = "basedOn",
            LONG_TEXT_PREVIEW_LENGTH = 12,
            SPACECRAFT_AWAY_COLOR = "#666666",
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
            NON_NEGATIVE_SCALE = {
                baseType: BaseType.NUMBER,
                unit: Unit.TIMES,
                min: 0
            },
            GROWTH_RATE = {
                baseType: BaseType.NUMBER,
                unit: Unit.TIMES,
                min: 1
            },
            POSITIVE_SCALE = {
                baseType: BaseType.NUMBER,
                unit: Unit.TIMES,
                min: 0.001
            },
            DISTANCE = {
                baseType: BaseType.NUMBER,
                unit: Unit.METERS,
                min: 0
            },
            POSITIVE_DISTANCE = {
                baseType: BaseType.NUMBER,
                unit: Unit.METERS,
                min: 1
            },
            POSITIVE_LENGTH = {
                baseType: BaseType.NUMBER,
                unit: Unit.METERS,
                min: 0.001
            },
            METERS_PER_SECOND = {
                baseType: BaseType.NUMBER,
                unit: Unit.METERS_PER_SECOND
            },
            NON_NEGATIVE_METERS_PER_SECOND = {
                baseType: BaseType.NUMBER,
                unit: Unit.METERS_PER_SECOND,
                min: 0
            },
            POSITIVE_METERS_PER_SECOND = {
                baseType: BaseType.NUMBER,
                unit: Unit.METERS_PER_SECOND,
                min: 0.001
            },
            METERS_PER_SECOND_SQUARED = {
                baseType: BaseType.NUMBER,
                unit: Unit.METERS_PER_SECOND_SQUARED
            },
            POSITIVE_METERS_PER_SECOND_SQUARED = {
                baseType: BaseType.NUMBER,
                unit: Unit.METERS_PER_SECOND_SQUARED,
                min: 0.001
            },
            MILLISECONDS = {
                baseType: BaseType.NUMBER,
                unit: Unit.MILLISECONDS,
                integer: true
            },
            NON_NEGATIVE_MILLISECONDS = {
                baseType: BaseType.NUMBER,
                unit: Unit.MILLISECONDS,
                integer: true,
                min: 0
            },
            POSITIVE_MILLISECONDS = {
                baseType: BaseType.NUMBER,
                unit: Unit.MILLISECONDS,
                integer: true,
                min: 1
            },
            SPAWN_INTERVAL = {
                baseType: BaseType.NUMBER,
                unit: Unit.MILLISECONDS,
                integer: true,
                min: 10
            },
            POSITIVE_PER_SECOND = {
                baseType: BaseType.NUMBER,
                unit: Unit.PER_SECOND,
                min: 0.001
            },
            DEGREES = {
                baseType: BaseType.NUMBER,
                unit: Unit.DEGREES,
                min: -360,
                max: 360
            },
            NON_NEGATIVE_DEGREES = {
                baseType: BaseType.NUMBER,
                unit: Unit.DEGREES,
                min: 0,
                max: 360
            },
            NON_NEGATIVE_DEGREES_180 = {
                baseType: BaseType.NUMBER,
                unit: Unit.DEGREES,
                min: 0,
                max: 180
            },
            POSITIVE_DEGREES_180 = {
                baseType: BaseType.NUMBER,
                unit: Unit.DEGREES,
                min: 0.1,
                max: 180
            },
            DEGREES_BETA = {
                baseType: BaseType.NUMBER,
                unit: Unit.DEGREES,
                min: -90,
                max: 90
            },
            POSITIVE_DEGREES_PER_SECOND = {
                baseType: BaseType.NUMBER,
                unit: Unit.DEGREES_PER_SECOND,
                min: 0.001
            },
            POSITIVE_DEGREES_PER_SECOND_SQUARED = {
                baseType: BaseType.NUMBER,
                unit: Unit.DEGREES_PER_SECOND_SQUARED,
                min: 0.001
            },
            KILOGRAMS = {
                baseType: BaseType.NUMBER,
                unit: Unit.KILOGRAMS,
                min: 0.001
            },
            POSITIVE_INT_PERCENT = {
                baseType: BaseType.NUMBER,
                unit: Unit.PERCENT,
                integer: true,
                min: 1,
                max: 100
            },
            NON_NEGATIVE_INT_PERCENT = {
                baseType: BaseType.NUMBER,
                unit: Unit.PERCENT,
                integer: true,
                min: 0,
                max: 100
            },
            NON_NEGATIVE_INTEGER = {
                baseType: BaseType.NUMBER,
                integer: true,
                min: 0
            },
            POSITIVE_INTEGER = {
                baseType: BaseType.NUMBER,
                integer: true,
                min: 1
            },
            RATIO = {
                baseType: BaseType.NUMBER,
                min: 0,
                max: 1
            },
            POSITIVE_RATIO = {
                baseType: BaseType.NUMBER,
                min: 0.001,
                max: 1
            },
            NON_NEGATIVE_NUMBER = {
                baseType: BaseType.NUMBER,
                min: 0
            },
            POSITIVE_NUMBER = {
                baseType: BaseType.NUMBER,
                min: 0.001
            },
            TRANSFORM_GROUP_INDEX = {
                baseType: BaseType.NUMBER,
                integer: true,
                min: 0,
                max: 1 // = config.graphics.shaders.maxGroupTransforms - 1
            },
            LUMINOSITY_GROUP_INDEX = {
                baseType: BaseType.NUMBER,
                integer: true,
                min: 0,
                max: 19 // = config.graphics.shaders.maxLuminosityFactors - 1
            },
            /**
             * @type Editor~TypeDescriptor
             */
            NON_NEGATIVE_MILLISECONDS_ARRAY = _createTypedArrayType(NON_NEGATIVE_MILLISECONDS, {min: 1}),
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
            MUSIC_REFERENCE = {
                baseType: BaseType.ENUM,
                resourceReference: "music"
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
            MISSILE_CLASS_REFERENCE = {
                baseType: BaseType.ENUM,
                classReference: "missileClasses"
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
            SENSORS_CLASS_REFERENCE = {
                baseType: BaseType.ENUM,
                classReference: "sensorsClasses"
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
            ENVIRONMENT_REFERENCE = {
                baseType: BaseType.ENUM,
                environmentReference: "environments"
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MISSION_REFERENCE = {
                baseType: BaseType.ENUM,
                missionReference: "missions"
            },
            /**
             * @type Editor~TypeDescriptor
             */
            LUMINOSITY_FACTOR_PAIRS = {
                baseType: BaseType.PAIRS,
                first: {
                    name: "group",
                    type: LUMINOSITY_GROUP_INDEX
                },
                second: {
                    name: "luminosity",
                    type: RATIO
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
             * @type Editor~TypeDescriptor
             */
            TEXTURE_IMAGE_FORMAT = {
                baseType: BaseType.ENUM,
                values: {
                    PNG: "png",
                    JPG: "jpg",
                    JPEG: "jpeg",
                    WEBP: "webp"
                }
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
                    type: TEXTURE_IMAGE_FORMAT
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
                    type: TEXTURE_IMAGE_FORMAT
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
                        type: NON_NEGATIVE_INTEGER
                    }
                }
            },
            /**
             * Supported model file formats
             * @type Editor~TypeDescriptor
             */
            MODEL_FORMAT = {
                baseType: BaseType.ENUM,
                values: {
                    EGM: "egm"
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
                    type: MODEL_FORMAT
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
                    type: SHADER_REFERENCE,
                    newValue: "skybox"
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
                        type: POSITIVE_SCALE,
                        defaultValue: 1
                    },
                    SHADER: {
                        name: "shader",
                        type: SHADER_REFERENCE,
                        newValue: "backgroundBillboard"
                    },
                    TEXTURE: {
                        name: "texture",
                        type: TEXTURE_REFERENCE
                    },
                    COLOR: {
                        name: "color",
                        type: BaseType.COLOR4,
                        defaultValue: [1, 1, 1, 1]
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
                    type: BaseType.COLOR3,
                    optional: true,
                    defaultText: "no light emitted"
                },
                LAYERS: {
                    name: "layers",
                    type: _createTypedArrayType(BACKGROUND_OBJECT_LAYER, {min: 1})
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
                    type: SHADER_REFERENCE,
                    newValue: "dust"
                },
                NUMBER_OF_PARTICLES: {
                    name: "numberOfParticles",
                    type: POSITIVE_INTEGER
                },
                RANGE: {
                    name: "range",
                    type: POSITIVE_DISTANCE
                },
                COLOR: {
                    name: "color",
                    type: BaseType.COLOR3,
                    defaultValue: [1, 1, 1]
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            PARTICLE_EMITTER_TYPE = {
                baseType: BaseType.ENUM,
                values: classes.ParticleEmitterType
            },
            _particleStateIsNotFirst = function (data, parent) {
                return data !== parent.particleStates[0];
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
                        type: BaseType.COLOR4,
                        defaultValue: [1, 1, 1, 1]
                    },
                    SIZE: {
                        name: "size",
                        type: NON_NEGATIVE_NUMBER,
                        defaultValue: 1
                    },
                    TIME_TO_REACH: {
                        name: "timeToReach",
                        type: NON_NEGATIVE_MILLISECONDS,
                        defaultValue: 0,
                        isValid: _particleStateIsNotFirst
                    }
                }
            },
            _emitterHasProjectileModel = function (data) {
                return data.hasProjectileModel;
            },
            _emitterHasDirection = function (data) {
                return data.type && (data.type !== classes.ParticleEmitterType.OMNIDIRECTIONAL);
            },
            _emitterIsSpawning = function (data) {
                return data.spawnNumber > 0;
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
                        type: PARTICLE_EMITTER_TYPE,
                        defaultValue: classes.ParticleEmitterType.OMNIDIRECTIONAL
                    },
                    HAS_PROJECTILE_MODEL: {
                        name: "hasProjectileModel",
                        type: BaseType.BOOLEAN,
                        defaultValue: false
                    },
                    PROJECTILE_MODEL_WIDTH: {
                        name: "projectileModelWidth",
                        type: RATIO,
                        optional: true,
                        defaultValue: 1,
                        isValid: _emitterHasProjectileModel
                    },
                    PROJECTILE_MODEL_INTERSECTION: {
                        name: "projectileModelIntersection",
                        type: BaseType.NUMBER,
                        optional: true,
                        defaultValue: 0,
                        isValid: _emitterHasProjectileModel
                    },
                    DIMENSIONS: {
                        name: "dimensions",
                        type: BaseType.VECTOR3,
                        defaultValue: [0, 0, 0]
                    },
                    DIRECTION_SPREAD: {
                        name: "directionSpread",
                        type: NON_NEGATIVE_DEGREES,
                        defaultValue: 0,
                        isValid: _emitterHasDirection
                    },
                    VELOCITY: {
                        name: "velocity",
                        type: METERS_PER_SECOND,
                        defaultValue: 0
                    },
                    VELOCITY_SPREAD: {
                        name: "velocitySpread",
                        type: NON_NEGATIVE_METERS_PER_SECOND,
                        defaultValue: 0
                    },
                    INITIAL_NUMBER: {
                        name: "initialNumber",
                        type: NON_NEGATIVE_INTEGER,
                        defaultValue: 0
                    },
                    SPAWN_NUMBER: {
                        name: "spawnNumber",
                        type: NON_NEGATIVE_INTEGER,
                        defaultValue: 0
                    },
                    SPAWN_TIME: {
                        name: "spawnTime",
                        type: SPAWN_INTERVAL,
                        newValue: 1000,
                        isRequired: _emitterIsSpawning,
                        isValid: _emitterIsSpawning
                    },
                    DURATION: {
                        name: "duration",
                        type: POSITIVE_MILLISECONDS,
                        optional: true,
                        isValid: _emitterIsSpawning,
                        defaultText: "infinite"
                    },
                    DELAY: {
                        name: "delay",
                        type: NON_NEGATIVE_MILLISECONDS,
                        defaultValue: 0
                    },
                    SHADER: {
                        name: "shader",
                        type: SHADER_REFERENCE,
                        newValue: "particle"
                    },
                    TEXTURE: {
                        name: "texture",
                        type: TEXTURE_REFERENCE
                    },
                    PARTICLE_STATES: {
                        name: "particleStates",
                        type: _createTypedArrayType(PARTICLE_STATE, {min: 2})
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
                        type: BaseType.COLOR3,
                        newValue: [1, 1, 1]
                    },
                    INTENSITY: {
                        name: "intensity",
                        type: NON_NEGATIVE_NUMBER
                    },
                    TIME_TO_REACH: {
                        name: "timeToReach",
                        type: NON_NEGATIVE_MILLISECONDS
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SOUND_DESCRIPTOR = {
                baseType: BaseType.OBJECT,
                name: "SoundDescriptor",
                getPreviewText: function (data) {
                    return "((" + ((data.name.length > 18) ? data.name.substring(0, 15) + "..." : data.name) + " | " + ((data.volume !== undefined) ? data.volume : 1) + "))";
                },
                properties: {
                    NAME: {
                        name: "name",
                        type: SOUND_REFERENCE
                    },
                    VOLUME: {
                        name: "volume",
                        type: NON_NEGATIVE_NUMBER,
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
                    type: _createTypedArrayType(PARTICLE_EMITTER, {min: 1})
                },
                LIGHT_STATES: {
                    name: "lightStates",
                    type: _createTypedArrayType(LIGHT_STATE, {min: 1}),
                    optional: true,
                    defaultText: "no light emitted"
                },
                SOUND_EFFECT: {
                    name: "soundEffect",
                    type: SOUND_DESCRIPTOR,
                    optional: true,
                    defaultText: "no sound"
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
                        newValue: "particle"
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
                        type: POSITIVE_SCALE,
                        defaultValue: 1
                    },
                    DURATION: {
                        name: "duration",
                        type: POSITIVE_MILLISECONDS
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TRAIL_DESCRIPTOR = {
                baseType: BaseType.OBJECT,
                name: "TrailDescriptor",
                properties: {
                    SHADER: {
                        name: "shader",
                        type: SHADER_REFERENCE,
                        newValue: "trail"
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
                        type: POSITIVE_SCALE,
                        defaultValue: 1
                    },
                    DURATION: {
                        name: "duration",
                        type: POSITIVE_MILLISECONDS,
                        newValue: 500
                    },
                    GROWTH_RATE: {
                        name: "growthRate",
                        type: GROWTH_RATE,
                        newValue: 2
                    }
                }
            },
            _hasLight = function (data) {
                return !!data.lightColor;
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
                    type: BaseType.NUMBER,
                    defaultValue: 0
                },
                SHADER: {
                    name: "shader",
                    type: SHADER_REFERENCE,
                    newValue: "billboard"
                },
                TEXTURE: {
                    name: "texture",
                    type: TEXTURE_REFERENCE
                },
                SIZE: {
                    name: "size",
                    type: POSITIVE_SCALE,
                    defaultValue: 1
                },
                MASS: {
                    name: "mass",
                    type: KILOGRAMS
                },
                DRAG_FACTOR: {
                    name: "dragFactor",
                    type: NON_NEGATIVE_SCALE,
                    defaultValue: 0
                },
                DURATION: {
                    name: "duration",
                    type: POSITIVE_MILLISECONDS
                },
                DISSIPATION_DURATION: {
                    name: "dissipationDuration",
                    type: POSITIVE_MILLISECONDS
                },
                INTERSECTION_POSITIONS: {
                    name: "intersectionPositions",
                    type: _createTypedArrayType(BaseType.NUMBER, {min: 1}),
                    optional: true,
                    defaultText: "no intersections"
                },
                WIDTH: {
                    name: "width",
                    type: POSITIVE_RATIO,
                    defaultValue: 1
                },
                MUZZLE_FLASH: {
                    name: "muzzleFlash",
                    type: PARTICLE_DESCRIPTOR
                },
                LIGHT_COLOR: {
                    name: "lightColor",
                    type: BaseType.COLOR3,
                    optional: true,
                    newValue: [1, 1, 1],
                    defaultText: "no light emitted"
                },
                LIGHT_INTENSITY: {
                    name: "lightIntensity",
                    type: POSITIVE_NUMBER,
                    isValid: _hasLight
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
                        type: POSITIVE_SCALE,
                        newValue: 1
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
            _hasNoCount = function (data) {
                return !data.count;
            },
            _hasCount = function (data) {
                return data.count > 0;
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
                        type: LUMINOSITY_GROUP_INDEX
                    },
                    USES: {
                        name: "uses",
                        type: THRUSTER_USES
                    },
                    THRUSTERS: {
                        name: "thrusters",
                        type: _createTypedArrayType(THRUSTER, {min: 1}),
                        isValid: _hasNoCount
                    },
                    COUNT: {
                        name: "count",
                        type: POSITIVE_INTEGER,
                        optional: true,
                        defaultText: "not an array"
                    },
                    POSITION: {
                        name: "position",
                        type: BaseType.VECTOR3,
                        isValid: _hasCount
                    },
                    VECTOR: {
                        name: "vector",
                        type: BaseType.VECTOR3,
                        isValid: _hasCount
                    },
                    SIZE: {
                        name: "size",
                        type: POSITIVE_SCALE,
                        newValue: 1,
                        isValid: _hasCount
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MISSILE_SIZE = {
                baseType: BaseType.ENUM,
                values: utils.getEnumObject(utils.getEnumKeys(classes.MissileSize))
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MISSILE_HOMING_MODE = {
                baseType: BaseType.ENUM,
                values: utils.getEnumObject(utils.getEnumKeys(classes.MissileHomingMode))
            },
            _getName = function (data) {
                return data.name;
            },
            _getShortName = function (data) {
                var name = data.fullName || data.name;
                return name.split(" ")[0].substring(0, 5);
            },
            _missileIsHoming = function (data) {
                return !!data.homingMode && (classes.MissileHomingMode[utils.constantName(data.homingMode)] !== classes.MissileHomingMode.NONE);
            },
            _missileNeedsLocking = function (data) {
                return !!data.lockingTime;
            },
            /**
             * The descriptor object for missile classes, describing their properties
             * @type Editor~ItemDescriptor
             */
            MISSILE_CLASS = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                FULL_NAME: {
                    name: "fullName",
                    type: BaseType.STRING,
                    optional: true,
                    getDerivedDefault: _getName,
                    updateOnValidate: true
                },
                SHORT_NAME: {
                    name: "shortName",
                    type: BaseType.STRING,
                    optional: true,
                    getDerivedDefault: _getShortName,
                    updateOnValidate: true
                },
                MODEL: {
                    name: "model",
                    type: MODEL_REFERENCE,
                    newValue: "mediumMissile"
                },
                MODEL_SCALE: {
                    name: "modelScale",
                    type: POSITIVE_SCALE,
                    optional: true,
                    defaultValue: 1
                },
                SHADER: {
                    name: "shader",
                    type: SHADER_REFERENCE,
                    newValue: "ship"
                },
                TEXTURE: {
                    name: "texture",
                    type: TEXTURE_REFERENCE
                },
                ANTI_SHIP: {
                    name: "antiShip",
                    type: BaseType.BOOLEAN,
                    defaultValue: false
                },
                DAMAGE: {
                    name: "damage",
                    type: BaseType.NUMBER,
                    defaultValue: 0
                },
                SIZE: {
                    name: "size",
                    type: MISSILE_SIZE
                },
                CAPACITY: {
                    name: "capacity",
                    type: POSITIVE_INTEGER,
                    defaultValue: 1
                },
                LENGTH: {
                    name: "length",
                    type: POSITIVE_LENGTH,
                    newValue: 1
                },
                HOMING_MODE: {
                    name: "homingMode",
                    type: MISSILE_HOMING_MODE,
                    optional: true,
                    defaultText: "not homing"
                },
                MASS: {
                    name: "mass",
                    type: KILOGRAMS,
                    newValue: 1
                },
                DRAG_FACTOR: {
                    name: "dragFactor",
                    type: NON_NEGATIVE_SCALE,
                    defaultValue: 1
                },
                LAUNCH_VELOCITY: {
                    name: "launchVelocity",
                    type: NON_NEGATIVE_METERS_PER_SECOND,
                    defaultValue: 0
                },
                IGNITION_TIME: {
                    name: "ignitionTime",
                    type: NON_NEGATIVE_MILLISECONDS,
                    defaultValue: 0
                },
                ACCELERATION: {
                    name: "acceleration",
                    type: POSITIVE_METERS_PER_SECOND_SQUARED,
                    newValue: 100
                },
                ANGULAR_ACCELERATION: {
                    name: "angularAcceleration",
                    type: POSITIVE_DEGREES_PER_SECOND_SQUARED,
                    newValue: 90,
                    isRequired: _missileIsHoming,
                    isValid: _missileIsHoming
                },
                MAIN_BURN_ANGLE_THRESHOLD: {
                    name: "mainBurnAngleThreshold",
                    type: POSITIVE_DEGREES_180,
                    newValue: 1,
                    isRequired: _missileIsHoming,
                    isValid: _missileIsHoming
                },
                DURATION: {
                    name: "duration",
                    type: POSITIVE_MILLISECONDS,
                    newValue: 1000
                },
                LOCKING_TIME: {
                    name: "lockingTime",
                    type: NON_NEGATIVE_MILLISECONDS,
                    defaultValue: 0,
                    isValid: _missileIsHoming
                },
                LOCKING_ANGLE: {
                    name: "lockingAngle",
                    type: POSITIVE_DEGREES_180,
                    optional: true,
                    defaultText: "unlimited",
                    isValid: _missileNeedsLocking
                },
                COOLDOWN: {
                    name: "cooldown",
                    type: POSITIVE_MILLISECONDS,
                    newValue: 1000
                },
                SALVO_COOLDOWN: {
                    name: "salvoCooldown",
                    type: POSITIVE_MILLISECONDS,
                    optional: true,
                    defaultText: "same as cooldown"
                },
                PROXIMITY_RANGE: {
                    name: "proximityRange",
                    type: DISTANCE,
                    defaultValue: 0
                },
                KINETIC_FACTOR: {
                    name: "kineticFactor",
                    type: POSITIVE_SCALE,
                    defaultValue: 1
                },
                LIGHT_COLOR: {
                    name: "lightColor",
                    type: BaseType.COLOR3,
                    optional: true,
                    newValue: [1, 1, 1],
                    defaultText: "no light emitted"
                },
                LIGHT_INTENSITY: {
                    name: "lightIntensity",
                    type: POSITIVE_NUMBER,
                    isValid: _hasLight
                },
                TRAIL: {
                    name: "trail",
                    type: TRAIL_DESCRIPTOR
                },
                EXPLOSION: {
                    name: "explosion",
                    type: EXPLOSION_CLASS_REFERENCE
                },
                SHIELD_EXPLOSION: {
                    name: "shieldExplosion",
                    type: EXPLOSION_CLASS_REFERENCE
                },
                LAUNCH_SOUND: {
                    name: "launchSound",
                    type: SOUND_DESCRIPTOR
                },
                START_SOUND: {
                    name: "startSound",
                    type: SOUND_DESCRIPTOR
                },
                PROPULSION: {
                    name: "propulsion",
                    type: PROPULSION_CLASS_REFERENCE
                },
                THRUSTER_SLOTS: {
                    name: "thrusterSlots",
                    type: _createTypedArrayType(THRUSTER_SLOT)
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: NON_NEGATIVE_INTEGER,
                    defaultValue: 0
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            BARREL = {
                baseType: BaseType.OBJECT,
                name: "Barrel",
                properties: {
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
                        type: BaseType.VECTOR3,
                        newValue: [0, 0, 1]
                    },
                    CENTER: {
                        name: "center",
                        type: BaseType.VECTOR3
                    },
                    RANGE: {
                        name: "range",
                        type: _createRangeType(true, true, DEGREES),
                        optional: true,
                        defaultText: "360°"
                    },
                    DEFAULT_ANGLE: {
                        name: "defaultAngle",
                        type: DEGREES,
                        defaultValue: 0
                    },
                    ROTATION_RATE: {
                        name: "rotationRate",
                        type: POSITIVE_DEGREES_PER_SECOND,
                        newValue: 1
                    },
                    TRANSFORM_GROUP_INDEX: {
                        name: "transformGroupIndex",
                        type: TRANSFORM_GROUP_INDEX
                    }
                }
            },
            _weaponCanRotate = function (data) {
                return data.rotationStyle && (data.rotationStyle !== classes.WeaponRotationStyle.NONE);
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
                FULL_NAME: {
                    name: "fullName",
                    type: BaseType.STRING,
                    optional: true,
                    getDerivedDefault: _getName,
                    updateOnValidate: true
                },
                SHADER: {
                    name: "shader",
                    type: SHADER_REFERENCE,
                    newValue: "ship"
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
                    type: LUMINOSITY_FACTOR_PAIRS,
                    optional: true,
                    defaultText: "all zeros"
                },
                PROJECTILE: {
                    name: "projectile",
                    type: PROJECTILE_CLASS_REFERENCE
                },
                PROJECTILE_VELOCITY: {
                    name: "projectileVelocity",
                    type: POSITIVE_METERS_PER_SECOND,
                    newValue: 1
                },
                COOLDOWN: {
                    name: "cooldown",
                    type: POSITIVE_MILLISECONDS
                },
                BARRELS: {
                    name: "barrels",
                    type: _createTypedArrayType(BARREL, {min: 1})
                },
                ATTACHMENT_POINT: {
                    name: "attachmentPoint",
                    type: BaseType.VECTOR3,
                    defaultValue: [0, 0, 0]
                },
                ROTATION_STYLE: {
                    name: "rotationStyle",
                    type: WEAPON_ROTATION_STYLE,
                    defaultValue: classes.WeaponRotationStyle.NONE
                },
                BASE_POINT: {
                    name: "basePoint",
                    type: BaseType.VECTOR3,
                    defaultValue: [0, 0, 0],
                    isValid: _weaponCanRotate
                },
                ROTATORS: {
                    name: "rotators",
                    type: _createTypedArrayType(WEAPON_ROTATOR, {fixed: 2}),
                    isRequired: _weaponCanRotate,
                    isValid: _weaponCanRotate
                },
                FIRE_SOUND: {
                    name: "fireSound",
                    type: SOUND_DESCRIPTOR
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: NON_NEGATIVE_INTEGER,
                    defaultValue: 0
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
                FULL_NAME: {
                    name: "fullName",
                    type: BaseType.STRING,
                    optional: true,
                    getDerivedDefault: _getName,
                    updateOnValidate: true
                },
                SHADER: {
                    name: "shader",
                    type: SHADER_REFERENCE,
                    newValue: "particle"
                },
                TEXTURE: {
                    name: "texture",
                    type: TEXTURE_REFERENCE
                },
                COLOR: {
                    name: "color",
                    type: BaseType.COLOR4,
                    newValue: [1, 1, 1, 1]
                },
                REFERENCE_MASS: {
                    name: "referenceMass",
                    type: KILOGRAMS,
                    newValue: 1
                },
                THRUST: {
                    name: "thrust",
                    type: POSITIVE_METERS_PER_SECOND_SQUARED,
                    newValue: 1
                },
                ANGULAR_THRUST: {
                    name: "angularThrust",
                    type: POSITIVE_DEGREES_PER_SECOND_SQUARED,
                    newValue: 1
                },
                MAX_MOVE_BURN_LEVEL: {
                    name: "maxMoveBurnLevel",
                    type: POSITIVE_RATIO,
                    newValue: 0.5
                },
                MAX_TURN_BURN_LEVEL: {
                    name: "maxTurnBurnLevel",
                    type: POSITIVE_RATIO,
                    newValue: 0.5
                },
                THRUSTER_SOUND: {
                    name: "thrusterSound",
                    type: SOUND_DESCRIPTOR
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: NON_NEGATIVE_INTEGER,
                    defaultValue: 0
                }
            },
            SENSORS_CLASS = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                FULL_NAME: {
                    name: "fullName",
                    type: BaseType.STRING,
                    optional: true,
                    getDerivedDefault: _getName,
                    updateOnValidate: true
                },
                RANGE: {
                    name: "range",
                    type: POSITIVE_DISTANCE,
                    newValue: 1
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: NON_NEGATIVE_INTEGER,
                    defaultValue: 0
                }
            },
            _getDefaultJumpInDeceleration = function (data) {
                return data.jumpOutAcceleration + " " + METERS_PER_SECOND_SQUARED.unit;
            },
            _getDefaultJumpInDuration = function (data) {
                return data.jumpOutDuration + " " + MILLISECONDS.unit;
            },
            _getDefaultJumpInVelocity = function (data) {
                return data.prepareVelocity + " " + METERS_PER_SECOND.unit;
            },
            _getDefaultJumpInScaling = function (data) {
                return (data.jumpOutScaling || 1) + " " + SCALE.unit;
            },
            _getDefaultJumpInSound = function (data) {
                return SOUND_DESCRIPTOR.getPreviewText(data.jumpOutSound);
            },
            _getDefaultJumpInExplosion = function (data) {
                return data.jumpOutExplosion;
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
                    type: NON_NEGATIVE_METERS_PER_SECOND
                },
                PREPARE_DURATION: {
                    name: "prepareDuration",
                    type: NON_NEGATIVE_MILLISECONDS
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
                    type: POSITIVE_METERS_PER_SECOND_SQUARED
                },
                JUMP_OUT_DURATION: {
                    name: "jumpOutDuration",
                    type: POSITIVE_MILLISECONDS
                },
                JUMP_OUT_SCALING: {
                    name: "jumpOutScaling",
                    type: POSITIVE_SCALE,
                    defaultValue: 1
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
                    type: POSITIVE_METERS_PER_SECOND_SQUARED,
                    optional: true,
                    getDerivedDefault: _getDefaultJumpInDeceleration,
                    updateOnValidate: true
                },
                JUMP_IN_DURATION: {
                    name: "jumpInDuration",
                    type: POSITIVE_MILLISECONDS,
                    optional: true,
                    getDerivedDefault: _getDefaultJumpInDuration,
                    updateOnValidate: true
                },
                JUMP_IN_VELOCITY: {
                    name: "jumpInVelocity",
                    type: METERS_PER_SECOND,
                    optional: true,
                    getDerivedDefault: _getDefaultJumpInVelocity,
                    updateOnValidate: true
                },
                JUMP_IN_SCALING: {
                    name: "jumpInScaling",
                    type: POSITIVE_SCALE,
                    optional: true,
                    getDerivedDefault: _getDefaultJumpInScaling,
                    updateOnValidate: true
                },
                JUMP_IN_SOUND: {
                    name: "jumpInSound",
                    type: SOUND_DESCRIPTOR,
                    optional: true,
                    getDerivedDefault: _getDefaultJumpInSound,
                    updateOnValidate: true
                },
                JUMP_IN_EXPLOSION: {
                    name: "jumpInExplosion",
                    type: EXPLOSION_CLASS_REFERENCE,
                    optional: true,
                    getDerivedDefault: _getDefaultJumpInExplosion,
                    updateOnValidate: true
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
                FULL_NAME: {
                    name: "fullName",
                    type: BaseType.STRING,
                    optional: true,
                    getDerivedDefault: _getName,
                    updateOnValidate: true
                },
                CAPACITY: {
                    name: "capacity",
                    type: POSITIVE_INTEGER
                },
                RECHARGE_DELAY: {
                    name: "rechargeDelay",
                    type: NON_NEGATIVE_MILLISECONDS
                },
                RECHARGE_RATE: {
                    name: "rechargeRate",
                    type: POSITIVE_PER_SECOND
                },
                RECHARGE_COLOR: {
                    name: "rechargeColor",
                    type: BaseType.COLOR3,
                    defaultValue: [1, 1, 1]
                },
                RECHARGE_ANIMATION_DURATION: {
                    name: "rechargeAnimationDuration",
                    type: POSITIVE_MILLISECONDS
                },
                RECHARGE_START_SOUND: {
                    name: "rechargeStartSound",
                    type: SOUND_DESCRIPTOR
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: NON_NEGATIVE_INTEGER,
                    defaultValue: 0
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
                    type: BaseType.BOOLEAN,
                    defaultValue: false
                },
                FULL_NAME: {
                    name: "fullName",
                    type: BaseType.STRING,
                    optional: true,
                    getDerivedDefault: _getName,
                    updateOnValidate: true
                },
                DESCRIPTION: {
                    name: "description",
                    type: LONG_STRING
                },
                GOOD_AGAINST: {
                    name: "goodAgainst",
                    type: SPACECRAFT_TYPES,
                    optional: true,
                    defaultText: "none"
                },
                BAD_AGAINST: {
                    name: "badAgainst",
                    type: SPACECRAFT_TYPES,
                    optional: true,
                    defaultText: "none"
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
            _isArray = function (data) {
                return data.count > 1;
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
                    COUNT: {
                        name: "count",
                        type: POSITIVE_INTEGER,
                        defaultValue: 1
                    },
                    VECTOR: {
                        name: "vector",
                        type: BaseType.VECTOR3,
                        isValid: _isArray,
                        isRequired: _isArray
                    },
                    ROTATIONS: {
                        name: "rotations",
                        type: BaseType.ROTATIONS,
                        optional: true
                    },
                    CLEAR: {
                        name: "clear",
                        description: "Whether a turret installed at this slot can freely fire in 360 degrees without hitting the ship",
                        type: BaseType.BOOLEAN,
                        defaultValue: false
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MISSILE_TUBE = {
                baseType: BaseType.OBJECT,
                name: "MissileTube",
                properties: {
                    POSITION: {
                        name: "position",
                        type: BaseType.VECTOR3
                    },
                    VECTOR: {
                        name: "vector",
                        type: BaseType.VECTOR3,
                        isValid: _isArray,
                        isRequired: _isArray
                    },
                    COUNT: {
                        name: "count",
                        type: POSITIVE_INTEGER,
                        defaultValue: 1
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MISSILE_LAUNCHER = {
                baseType: BaseType.OBJECT,
                name: "MissileLauncher",
                properties: {
                    TUBES: {
                        name: "tubes",
                        type: _createTypedArrayType(MISSILE_TUBE, {min: 1})
                    },
                    SIZE: {
                        name: "size",
                        type: MISSILE_SIZE
                    },
                    CAPACITY: {
                        name: "capacity",
                        type: POSITIVE_INTEGER
                    },
                    SALVO: {
                        name: "salvo",
                        type: POSITIVE_INTEGER,
                        defaultValue: 1
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
            _isFPS = function (data) {
                return !!data.fps;
            },
            _noLookAtSelf = function (data) {
                return data.lookAt !== classes.ObjectViewLookAtMode.SELF;
            },
            _followsPosition = function (data) {
                return (data.followsPosition !== undefined) ? data.followsPosition : _noLookAtSelf(data);
            },
            _pointsTowardObjects = function (data) {
                return !!data.lookAt && (data.lookAt !== classes.ObjectViewLookAtMode.NONE);
            },
            _canMove = function (data) {
                return !_followsPosition(data) || data.movable;
            },
            _canTurn = function (data) {
                return !_pointsTowardObjects(data);
            },
            _followsOrientation = function (data) {
                return (data.followsOrientation !== undefined) ? data.followsOrientation : _canTurn(data);
            },
            _canRotateAroundObject = function (data) {
                return _noLookAtSelf(data) && _followsPosition(data) && (!_followsOrientation(data) || data.turnable || data.rotations);
            },
            _turnableFPS = function (data) {
                return _isFPS(data) && !!data.turnable;
            },
            _canLookAt = function (data) {
                return !_followsOrientation(data) && !data.turnable;
            },
            _canStartRelative = function (data) {
                return !_followsPosition(data) && !data.rotationCenterIsObject;
            },
            _relativePosition = function (data) {
                return _followsPosition(data) || data.startsWithRelativePosition;
            },
            _canResetWhenLeavingConfines = function (data) {
                return (data.distanceRange || data.confines) && _relativePosition(data);
            },
            _requiresDistanceRange = function (data) {
                return (data.rotationCenterIsObject || _pointsTowardObjects(data)) && data.movable;
            },
            _canMoveRelative = function (data) {
                return _followsPosition(data) && _followsOrientation(data) && !data.rotationCenterIsObject && data.movable;
            },
            _canHaveDistanceRange = function (data) {
                return _canMove(data) && (_relativePosition(data) || _canTurn(data) || !data.confines);
            },
            _canHaveConfines = function (data) {
                return _canMove(data) && (_relativePosition(data) || _canTurn(data) || !data.distanceRange);
            },
            _canResetOnFocusChange = function (data) {
                return (_canMove(data) || data.turnable) && !(_pointsTowardObjects(data) && data.startsWithRelativePosition);
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
                    AIMING_VIEW: {
                        name: "aimingView",
                        type: BaseType.BOOLEAN,
                        defaultValue: false
                    },
                    FOV: {
                        name: "fov",
                        type: POSITIVE_DEGREES_180,
                        globalDefault: true,
                        settingName: config.CAMERA_SETTINGS.DEFAULT_FOV
                    },
                    FOV_RANGE: {
                        name: "fovRange",
                        type: _createRangeType(true, true, POSITIVE_DEGREES_180),
                        optional: true,
                        defaultText: "fixed"
                    },
                    SPAN: {
                        name: "span",
                        type: POSITIVE_LENGTH,
                        globalDefault: true,
                        settingName: config.CAMERA_SETTINGS.DEFAULT_SPAN
                    },
                    FPS: {
                        name: "fps",
                        type: BaseType.BOOLEAN,
                        defaultValue: false
                    },
                    FOLLOWS_POSITION: {
                        name: "followsPosition",
                        type: BaseType.BOOLEAN,
                        defaultValue: true,
                        isValid: _noLookAtSelf
                    },
                    FOLLOWS_ORIENTATION: {
                        name: "followsOrientation",
                        type: BaseType.BOOLEAN,
                        defaultValue: true,
                        isValid: _canTurn
                    },
                    BASE_ORIENTATION: {
                        name: "baseOrientation",
                        type: BASE_ORIENTATION,
                        globalDefault: true,
                        settingName: config.CAMERA_SETTINGS.DEFAULT_BASE_ORIENTATION,
                        isValid: _isFPS
                    },
                    POINT_TO_FALLBACK: {
                        name: "pointToFallback",
                        type: POINT_TO_FALLBACK,
                        globalDefault: true,
                        settingName: config.CAMERA_SETTINGS.DEFAULT_POINT_TO_FALLBACK,
                        isValid: _pointsTowardObjects
                    },
                    STARTS_WITH_RELATIVE_POSITION: {
                        name: "startsWithRelativePosition",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _canStartRelative
                    },
                    LOOK_AT: {
                        name: "lookAt",
                        type: OBJECT_VIEW_LOOK_AT_MODE,
                        defaultValue: classes.ObjectViewLookAtMode.NONE,
                        isValid: _canLookAt
                    },
                    MOVABLE: {
                        name: "movable",
                        type: BaseType.BOOLEAN,
                        defaultValue: false
                    },
                    TURNABLE: {
                        name: "turnable",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _canTurn
                    },
                    ALPHA_RANGE: {
                        name: "alphaRange",
                        type: _createRangeType(true, true, DEGREES),
                        optional: true,
                        defaultText: "unlimited",
                        isValid: _turnableFPS
                    },
                    BETA_RANGE: {
                        name: "betaRange",
                        type: _createRangeType(true, true, DEGREES_BETA),
                        defaultValue: [-90, 90],
                        isValid: _turnableFPS
                    },
                    ROTATION_CENTER_IS_OBJECT: {
                        name: "rotationCenterIsObject",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _canRotateAroundObject
                    },
                    DISTANCE_RANGE: {
                        name: "distanceRange",
                        type: _createRangeType(false, false, DISTANCE),
                        isRequired: _requiresDistanceRange,
                        updateOnValidate: true,
                        defaultText: "unlimited",
                        isValid: _canHaveDistanceRange
                    },
                    CONFINES: {
                        name: "confines",
                        type: BaseType.CONFINES,
                        optional: true,
                        defaultText: "no confines",
                        isValid: _canHaveConfines
                    },
                    RESETS_WHEN_LEAVING_CONFINES: {
                        name: "resetsWhenLeavingConfines",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _canResetWhenLeavingConfines
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
                        defaultValue: false,
                        isValid: _canMoveRelative
                    },
                    RESETS_ON_FOCUS_CHANGE: {
                        name: "resetsOnFocusChange",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _canResetOnFocusChange
                    },
                    EXCLUDE_FROM_CYCLE: {
                        name: "excludeFromCycle",
                        type: BaseType.BOOLEAN,
                        defaultValue: false
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            WEAPON = {
                baseType: BaseType.OBJECT,
                name: "Weapon",
                getName: function (data) {
                    return data.class;
                },
                properties: {
                    CLASS: {
                        name: "class",
                        type: WEAPON_CLASS_REFERENCE
                    },
                    SLOT_INDEX: {
                        name: "slotIndex",
                        type: NON_NEGATIVE_INTEGER,
                        optional: true,
                        defaultText: "auto"
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MISSILE = {
                baseType: BaseType.OBJECT,
                name: "Missile",
                getName: function (data) {
                    return data.class + " (" + data.amount + ")";
                },
                properties: {
                    CLASS: {
                        name: "class",
                        type: MISSILE_CLASS_REFERENCE
                    },
                    AMOUNT: {
                        name: "amount",
                        type: POSITIVE_INTEGER
                    },
                    LAUNCHER_INDEX: {
                        name: "launcherIndex",
                        type: NON_NEGATIVE_INTEGER,
                        optional: true,
                        defaultText: "auto"
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            PROPULSION = {
                baseType: BaseType.OBJECT,
                name: "Propulsion",
                getPreviewText: function (instance) {
                    return instance.class;
                },
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
            SENSORS = {
                baseType: BaseType.OBJECT,
                name: "Sensors",
                getPreviewText: function (instance) {
                    return instance.class;
                },
                properties: {
                    CLASS: {
                        name: "class",
                        type: SENSORS_CLASS_REFERENCE
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            JUMP_ENGINE = {
                baseType: BaseType.OBJECT,
                name: "JumpEngine",
                getPreviewText: function (instance) {
                    return instance.class;
                },
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
                getPreviewText: function (instance) {
                    return instance.class;
                },
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
            SPACECRAFT_LOADOUT_REFERENCE = {
                baseType: BaseType.ENUM,
                getValues: function (parent, topParent) {
                    if (topParent.loadouts) {
                        return topParent.loadouts.map(function (loadout) {
                            return loadout.name;
                        });
                    }
                    return [];
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            LOADOUT = {
                baseType: BaseType.OBJECT,
                name: "Loadout",
                properties: {
                    NAME: {
                        name: "name",
                        type: BaseType.STRING
                    },
                    BASED_ON: {
                        name: "basedOn",
                        type: SPACECRAFT_LOADOUT_REFERENCE,
                        optional: true,
                        defaultText: "none"
                    },
                    WEAPONS: {
                        name: "weapons",
                        type: _createTypedArrayType(WEAPON),
                        optional: true,
                        defaultText: "none"
                    },
                    MISSILES: {
                        name: "missiles",
                        type: _createTypedArrayType(MISSILE),
                        optional: true,
                        defaultText: "none"
                    },
                    PROPULSION: {
                        name: "propulsion",
                        type: PROPULSION,
                        optional: true,
                        defaultText: "none"
                    },
                    SENSORS: {
                        name: "sensors",
                        type: SENSORS,
                        optional: true,
                        defaultText: "none"
                    },
                    JUMP_ENGINE: {
                        name: "jumpEngine",
                        type: JUMP_ENGINE,
                        optional: true,
                        defaultText: "none"
                    },
                    SHIELD: {
                        name: "shield",
                        type: SHIELD,
                        optional: true,
                        defaultText: "none"
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            DAMAGE_INDICATOR = {
                baseType: BaseType.OBJECT,
                name: "DamageIndicator",
                getName: function (data) {
                    return data.hullIntegrity + "% - " + data.class;
                },
                properties: {
                    HULL_INTEGRITY: {
                        name: "hullIntegrity",
                        type: POSITIVE_INT_PERCENT,
                        newValue: 50
                    },
                    CLASS: {
                        name: "class",
                        type: EXPLOSION_CLASS_REFERENCE
                    }
                }
            },
            _isSpotLight = function (data) {
                return !!data.spotDirection;
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
                        type: BaseType.COLOR3,
                        defaultValue: [1, 1, 1]
                    },
                    INTENSITY: {
                        name: "intensity",
                        type: POSITIVE_NUMBER,
                        newValue: 10
                    },
                    SPOT_DIRECTION: {
                        name: "spotDirection",
                        type: BaseType.VECTOR3,
                        optional: true,
                        newValue: [0, 1, 0],
                        defaultText: "point light"
                    },
                    SPOT_CUTOFF_ANGLE: {
                        name: "spotCutoffAngle",
                        type: NON_NEGATIVE_DEGREES,
                        isValid: _isSpotLight,
                        newValue: 25
                    },
                    SPOT_FULL_INTENSITY_ANGLE: {
                        name: "spotFullIntensityAngle",
                        type: NON_NEGATIVE_DEGREES,
                        isValid: _isSpotLight,
                        newValue: 5
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
                        type: POSITIVE_MILLISECONDS,
                        newValue: 1000
                    },
                    BLINKS: {
                        name: "blinks",
                        type: NON_NEGATIVE_MILLISECONDS_ARRAY
                    },
                    INTENSITY: {
                        name: "intensity",
                        type: POSITIVE_NUMBER,
                        newValue: 10
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            LOADOUT_REFERENCE = {
                baseType: BaseType.ENUM,
                getValues: function (parent) {
                    if (parent.loadouts) {
                        return parent.loadouts.map(function (loadout) {
                            return loadout.name;
                        });
                    }
                    if (parent.basedOn) {
                        return classes.getSpacecraftClass(parent.basedOn).getLoadoutNames();
                    }
                    return [];
                }
            },
            _shownInDatabase = function (data) {
                return data.showInDatabase !== false;
            },
            _isShip = function (data) {
                return !!data.type && !classes.getSpacecraftType(data.type).isFighterType();
            },
            _hasLoadouts = function (data) {
                return (!!data.loadouts && (data.loadouts.length > 0)) || (data.basedOn && (classes.getSpacecraftClass(data.basedOn).getLoadoutNames().length > 0));
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
                    optional: true,
                    defaultText: "none"
                },
                TYPE: {
                    name: "type",
                    type: SPACECRAFT_TYPE_REFERENCE
                },
                FULL_NAME: {
                    name: "fullName",
                    type: BaseType.STRING,
                    optional: true,
                    getDerivedDefault: _getName,
                    updateOnValidate: true
                },
                SHOW_IN_DATABASE: {
                    name: "showInDatabase",
                    type: BaseType.BOOLEAN,
                    defaultValue: true
                },
                DESCRIPTION: {
                    name: "description",
                    type: LONG_STRING,
                    isValid: _shownInDatabase,
                    newValue: "-"
                },
                HITPOINTS: {
                    name: "hitpoints",
                    type: POSITIVE_INTEGER
                },
                ARMOR: {
                    name: "armor",
                    type: NON_NEGATIVE_NUMBER,
                    defaultValue: 0
                },
                TURN_STYLE: {
                    name: "turnStyle",
                    type: SPACECRAFT_TURN_STYLE,
                    isValid: _isShip,
                    defaultValue: classes.SpacecraftTurnStyle.YAW_PITCH
                },
                ATTACK_VECTOR: {
                    name: "attackVector",
                    type: BaseType.VECTOR3,
                    isValid: _isShip,
                    defaultValue: [0, 1, 0]
                },
                ATTACK_THRESHOLD_ANGLE: {
                    name: "attackThresholdAngle",
                    type: NON_NEGATIVE_DEGREES_180,
                    isValid: _isShip,
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
                    type: BaseType.COLOR4,
                    optional: true,
                    defaultText: "none"
                },
                DEFAULT_LUMINOSITY_FACTORS: {
                    name: "defaultLuminosityFactors",
                    type: LUMINOSITY_FACTOR_PAIRS,
                    optional: true,
                    defaultText: "all zeros"
                },
                MASS: {
                    name: "mass",
                    type: KILOGRAMS,
                    newValue: 10000
                },
                DRAG_FACTOR: {
                    name: "dragFactor",
                    type: NON_NEGATIVE_SCALE,
                    defaultValue: 1
                },
                LOCKING_TIME_FACTOR: {
                    name: "lockingTimeFactor",
                    type: NON_NEGATIVE_SCALE,
                    defaultValue: 1
                },
                BODIES: {
                    name: "bodies",
                    type: _createTypedArrayType(BODY, {min: 1})
                },
                WEAPON_SLOTS: {
                    name: "weaponSlots",
                    type: _createTypedArrayType(WEAPON_SLOT, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                MISSILE_LAUNCHERS: {
                    name: "missileLaunchers",
                    type: _createTypedArrayType(MISSILE_LAUNCHER, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                THRUSTER_SLOTS: {
                    name: "thrusterSlots",
                    type: _createTypedArrayType(THRUSTER_SLOT, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                VIEWS: {
                    name: "views",
                    type: _createTypedArrayType(VIEW, {min: 1})
                },
                LOADOUTS: {
                    name: "loadouts",
                    type: _createTypedArrayType(LOADOUT, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                DEFAULT_LOADOUT: {
                    name: "defaultLoadout",
                    type: LOADOUT_REFERENCE,
                    isValid: _hasLoadouts,
                    optional: true,
                    defaultText: "none",
                    updateOnValidate: true
                },
                HUM_SOUND: {
                    name: "humSound",
                    type: SOUND_DESCRIPTOR,
                    optional: true,
                    defaultText: "none"
                },
                COLLISION_SOUND: {
                    name: "collisionSound",
                    type: SOUND_DESCRIPTOR,
                    optional: true,
                    defaultText: "none"
                },
                EXPLOSION: {
                    name: "explosion",
                    type: EXPLOSION_CLASS_REFERENCE
                },
                SHOW_TIME_RATIO_DURING_EXPLOSION: {
                    name: "showTimeRatioDuringExplosion",
                    type: RATIO,
                    newValue: 0.5
                },
                DAMAGE_INDICATORS: {
                    name: "damageIndicators",
                    type: _createTypedArrayType(DAMAGE_INDICATOR, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                LIGHTS: {
                    name: "lights",
                    type: _createTypedArrayType(SPACECRAFT_LIGHT, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                BLINKERS: {
                    name: "blinkers",
                    type: _createTypedArrayType(BLINKER, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                SCORE_VALUE: {
                    name: "scoreValue",
                    type: NON_NEGATIVE_INTEGER,
                    defaultValue: 0
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SKYBOX = {
                baseType: BaseType.OBJECT,
                name: "Skybox",
                getName: function (data) {
                    return data.class;
                },
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
                getPreviewText: function (data) {
                    return (data.angleAlpha || 0) + "°, " + (data.angleBeta || 0) + "°" + ((data.angleGamma !== undefined) ? ", " + data.angleGamma + "°" : "");
                },
                properties: {
                    ANGLE_ALPHA: {
                        name: "angleAlpha",
                        type: DEGREES,
                        defaultValue: 0
                    },
                    ANGLE_BETA: {
                        name: "angleBeta",
                        type: DEGREES,
                        defaultValue: 0
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
                getName: function (data) {
                    return data.class + " (" + data.size + ")";
                },
                properties: {
                    CLASS: {
                        name: "class",
                        type: BACKGROUND_OBJECT_CLASS_REFERENCE
                    },
                    SIZE: {
                        name: "size",
                        type: POSITIVE_SCALE,
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
                getName: function (data) {
                    return data.class;
                },
                properties: {
                    CLASS: {
                        name: "class",
                        type: DUST_CLOUD_CLASS_REFERENCE
                    }
                }
            },
            _effectIsRelative = function (data) {
                return data.relativeToCamera !== false;
            },
            PARTICLE_EFFECT = {
                baseType: BaseType.OBJECT,
                name: "ParticleEffect",
                getName: function (data) {
                    return data.class;
                },
                properties: {
                    CLASS: {
                        name: "class",
                        type: EXPLOSION_CLASS_REFERENCE,
                        newValue: "blueNebula"
                    },
                    POSITION: {
                        name: "position",
                        type: BaseType.VECTOR3,
                        defaultValue: [0, 0, 0]
                    },
                    RELATIVE_TO_CAMERA: {
                        name: "relativeToCamera",
                        type: BaseType.BOOLEAN,
                        defaultValue: true
                    },
                    DIRECTION: {
                        name: "direction",
                        type: BaseType.VECTOR3,
                        defaultValue: [0, 0, 1]
                    },
                    RELATIVE_DIRECTION: {
                        name: "relativeDirection",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _effectIsRelative
                    }
                }
            },
            /**
             * The descriptor object for spacecraft classes, describing their properties
             * @type Editor~ItemDescriptor
             */
            ENVIRONMENT = {
                NAME: {
                    name: "name",
                    type: BaseType.STRING
                },
                LOCATION: {
                    name: "location",
                    type: BaseType.STRING
                },
                COLOR: {
                    name: "color",
                    type: BaseType.COLOR4,
                    defaultValue: [0, 0, 0, 0]
                },
                SKYBOXES: {
                    name: "skyboxes",
                    type: _createTypedArrayType(SKYBOX, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                BACKGROUND_OBJECTS: {
                    name: "backgroundObjects",
                    type: _createTypedArrayType(BACKGROUND_OBJECT, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                DUST_CLOUDS: {
                    name: "dustClouds",
                    type: _createTypedArrayType(DUST_CLOUD, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                PARTICLE_EFFECTS: {
                    name: "particleEffects",
                    type: _createTypedArrayType(PARTICLE_EFFECT, {min: 1}),
                    optional: true,
                    defaultText: "none"
                },
                SHADOWS: {
                    name: "shadows",
                    type: BaseType.BOOLEAN,
                    defaultValue: true
                },
                AMBIENT_COLOR: {
                    name: "ambientColor",
                    type: BaseType.COLOR3,
                    defaultValue: [0, 0, 0]
                },
                DRAG: {
                    name: "drag",
                    type: NON_NEGATIVE_NUMBER,
                    defaultValue: 0
                },
                ANGULAR_DRAG: {
                    name: "angularDrag",
                    type: NON_NEGATIVE_NUMBER,
                    defaultValue: 0
                },
                SENSOR_RANGE_FACTOR: {
                    name: "sensorRangeFactor",
                    type: NON_NEGATIVE_SCALE,
                    defaultValue: 1
                },
                LOCKING_TIME_FACTOR: {
                    name: "lockingTimeFactor",
                    type: NON_NEGATIVE_SCALE,
                    defaultValue: 1
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TEAM_FACTION = {
                baseType: BaseType.ENUM,
                getValues: function () {
                    var prefix = strings.FACTION.PREFIX.name, prefixLength = prefix.length;
                    return strings.getKeys(prefix).map(function (key) {
                        return key.substring(prefixLength);
                    });
                }
            },
            _teamHasNoName = function (data) {
                return !data.name;
            },
            _teamHasNoFaction = function (data) {
                return !data.faction;
            },
            _getDefaultTeamName = function (data) {
                return data.faction;
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TEAM = {
                baseType: BaseType.OBJECT,
                name: "Team",
                unpack: function (stringValue) {
                    return {
                        name: stringValue,
                        faction: stringValue
                    };
                },
                getName: function (instance) {
                    return instance.name || instance.faction;
                },
                properties: {
                    NAME: {
                        name: "name",
                        type: BaseType.STRING,
                        isRequired: _teamHasNoFaction,
                        getDerivedDefault: _getDefaultTeamName,
                        updateOnValidate: true
                    },
                    FACTION: {
                        name: "faction",
                        type: TEAM_FACTION,
                        isRequired: _teamHasNoName,
                        updateOnValidate: true
                    },
                    COLOR: {
                        name: "color",
                        type: BaseType.COLOR4,
                        optional: true
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            CONDITION_TYPE = {
                baseType: BaseType.ENUM,
                values: ConditionType
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SPACECRAFT_REFERENCE = {
                baseType: BaseType.ENUM,
                name: "Spacecraft",
                getValues: function (parent, topParent) {
                    var result = [], i, j, spacecraft;
                    if (topParent.spacecrafts) {
                        for (i = 0; i < topParent.spacecrafts.length; i++) {
                            spacecraft = topParent.spacecrafts[i];
                            if (spacecraft.name) {
                                result.push(spacecraft.name);
                            } else if (spacecraft.squad) {
                                if (spacecraft.count) {
                                    for (j = 0; j < spacecraft.count; j++) {
                                        result.push(spacecraft.squad + " " + (j + 1));
                                    }
                                } else {
                                    result.push(spacecraft.squad);
                                }
                            } else if (spacecraft.count && spacecraft.names) {
                                for (j = 0; j < Math.min(spacecraft.count, spacecraft.names.length); j++) {
                                    result.push(spacecraft.names[j]);
                                }
                            }
                        }
                    }
                    return result;
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SQUAD_REFERENCE = {
                baseType: BaseType.ENUM,
                name: "Squad",
                getValues: function (parent, topParent) {
                    var result = [], i, spacecraft, squad;
                    if (topParent.spacecrafts) {
                        for (i = 0; i < topParent.spacecrafts.length; i++) {
                            spacecraft = topParent.spacecrafts[i];
                            if (spacecraft.squad) {
                                if (spacecraft.squad.indexOf(" ") < 0) {
                                    result.push(spacecraft.squad);
                                } else {
                                    squad = spacecraft.squad.split(" ")[0];
                                    if (result.indexOf(squad) < 0) {
                                        result.push(squad);
                                    }
                                }
                            }
                        }
                    }
                    return result;
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TEAM_REFERENCE = {
                baseType: BaseType.ENUM,
                name: "Team",
                getValues: function (parent, topParent) {
                    if (topParent.teams) {
                        return topParent.teams.filter(function (team) {
                            return !!team.name || !!team.faction;
                        }).map(function (team) {
                            return team.name || team.faction;
                        });
                    }
                    return [];
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SUBJECT_GROUP = {
                baseType: BaseType.OBJECT,
                name: "SubjectGroup",
                getPreviewText: function (instance, parent) {
                    var prefix = "", subjects = [];
                    if (parent && parent.params && parent.params.which === conditions.ConditionSubjectsWhich.ANY) {
                        prefix = "any of ";
                    }
                    if (instance.spacecrafts) {
                        subjects = subjects.concat(instance.spacecrafts);
                    }
                    if (instance.squads) {
                        subjects = subjects.concat(instance.squads);
                    }
                    if (instance.teams) {
                        subjects = subjects.concat(instance.teams);
                    }
                    if (subjects.length === 0) {
                        return "none";
                    }
                    if (subjects.length === 1) {
                        return subjects[0];
                    }
                    if (subjects.length === 2) {
                        return prefix + subjects[0] + ", " + subjects[1];
                    }
                    if ((subjects.length === 3) && subjects[2] && (subjects[2].length < 9)) {
                        return prefix + subjects.join(", ");
                    }
                    return prefix + subjects[0] + ", " + subjects[1] + "... (" + (subjects.length - 2) + " more)";
                },
                properties: {
                    SPACECRAFTS: {
                        name: "spacecrafts",
                        type: _createTypedArrayType(SPACECRAFT_REFERENCE, undefined, undefined, 2),
                        optional: true
                    },
                    SQUADS: {
                        name: "squads",
                        type: _createTypedArrayType(SQUAD_REFERENCE, undefined, undefined, 3),
                        optional: true
                    },
                    TEAMS: {
                        name: "teams",
                        type: _createTypedArrayType(TEAM_REFERENCE, undefined, undefined, 3),
                        optional: true
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            CONDITION_SUBJECTS_WHICH = {
                baseType: BaseType.ENUM,
                values: conditions.ConditionSubjectsWhich
            },
            /**
             * @type Editor~TypeDescriptor
             */
            COUNT_CONDITION_RELATION = {
                baseType: BaseType.ENUM,
                values: conditions.CountConditionRelation
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TIME_CONDITION_WHEN = {
                baseType: BaseType.ENUM,
                values: conditions.TimeConditionWhen
            },
            /**
             * @type Editor~TypeDescriptor
             */
            EVENT_REFERENCE = {
                baseType: BaseType.ENUM,
                getValues: function (parent, topParent) {
                    if (topParent.events) {
                        return topParent.events.filter(function (event) {
                            return !!event.name;
                        }).map(function (event) {
                            return event.name;
                        });
                    }
                    return [];
                }
            },
            _hasWhichParam = function (data, parent) {
                return !!parent && (
                        (parent.type === ConditionType.DESTROYED) ||
                        (parent.type === ConditionType.HULL_INTEGRITY) ||
                        (parent.type === ConditionType.SHIELD_INTEGRITY) ||
                        (parent.type === ConditionType.DISTANCE) ||
                        (parent.type === ConditionType.AWAY) ||
                        (parent.type === ConditionType.ON_TEAM) ||
                        (parent.type === ConditionType.IS_TARGETED));
            },
            _parentIsCountCondition = function (data, parent) {
                return !!parent && (parent.type === ConditionType.COUNT);
            },
            _parentIsTimeCondition = function (data, parent) {
                return !!parent && (parent.type === ConditionType.TIME);
            },
            _parentIsIntegrityCondition = function (data, parent) {
                return !!parent && ((parent.type === ConditionType.HULL_INTEGRITY) || (parent.type === ConditionType.SHIELD_INTEGRITY));
            },
            _parentIsDistanceCondition = function (data, parent) {
                return !!parent && (parent.type === ConditionType.DISTANCE);
            },
            _hasByParam = function (data, parent) {
                return !!parent && (
                        (parent.type === ConditionType.HIT) ||
                        (parent.type === ConditionType.GETS_TARGETED) ||
                        (parent.type === ConditionType.IS_TARGETED));
            },
            _hasWithParam = function (data, parent) {
                return !!parent && (parent.type === ConditionType.COLLISION);
            },
            _parentIsAwayCondition = function (data, parent) {
                return !!parent && (parent.type === ConditionType.AWAY);
            },
            _parentIsOnTeamCondition = function (data, parent) {
                return !!parent && (parent.type === ConditionType.ON_TEAM);
            },
            _parentIsMissionStateCondition = function (data, parent) {
                return !!parent && (parent.type === ConditionType.MISSION_STATE);
            },
            _isRepeatTime = function (data, parent) {
                return _parentIsTimeCondition(data, parent) && (data.when === conditions.TimeConditionWhen.REPEAT);
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MISSION_STATE_SET = {
                baseType: BaseType.SET,
                name: "MissionStates",
                values: missionEvents.MissionState
            },
            /**
             * A merge of all the different possible condition parameters
             * @type Editor~TypeDescriptor
             */
            CONDITION_PARAMS = {
                baseType: BaseType.OBJECT,
                name: "ConditionParams",
                getPreviewText: function (instance, parent) {
                    var result = "";
                    // HullIntegrityCondition and ShieldIntegrityCondition params:
                    if (instance.minIntegrity !== undefined || instance.maxIntegrity !== undefined) {
                        if (instance.minIntegrity !== undefined) {
                            result += instance.minIntegrity + "% < ";
                        }
                        result += (parent && (parent.type === ConditionType.SHIELD_INTEGRITY)) ? "shield of " : "hull of ";
                        if (parent && parent.subjects) {
                            result += SUBJECT_GROUP.getPreviewText(parent.subjects, parent);
                        } else {
                            if (instance.which === conditions.ConditionSubjectsWhich.ANY) {
                                result += "any subjects";
                            } else {
                                result += "all subjects";
                            }
                        }
                        if (instance.maxIntegrity !== undefined) {
                            result += " < " + instance.maxIntegrity + "%";
                        }
                        return result;
                    }
                    // DistanceCondition params:
                    if (instance.minDistance !== undefined || instance.maxDistance !== undefined) {
                        if (instance.minDistance !== undefined) {
                            result += utils.getLengthString(instance.minDistance) + " < ";
                        }
                        result += "distance to " + instance.target;
                        if (instance.maxDistance !== undefined) {
                            result += " < " + utils.getLengthString(instance.maxDistance);
                        }
                        return result;
                    }
                    // OnTeamCondition params:
                    if (instance.team) {
                        if (instance.which) {
                            return instance.which + " on " + instance.team;
                        }
                        return "on " + instance.team;
                    }
                    // HitCondition/GetsTargetedCondition/IsTargetedCondition params:
                    if (instance.by !== undefined) {
                        if (instance.which) {
                            result = instance.which + ", ";
                        }
                        return result + "by " + SUBJECT_GROUP.getPreviewText(instance.by);
                    }
                    // CollisionCondition params:
                    if (instance.with !== undefined) {
                        return result + "with " + SUBJECT_GROUP.getPreviewText(instance.with);
                    }
                    // DestroyedCondition/AwayCondition params:
                    if (instance.which) {
                        if (instance.away !== undefined) {
                            return instance.which + " " + (instance.away ? "away" : "present");
                        }
                        return instance.which;
                    }
                    if (instance.away !== undefined) {
                        return (instance.away ? "away" : "present");
                    }
                    // CountCondition params:
                    if (instance.relation !== undefined) {
                        return instance.relation + " " + instance.count;
                    }
                    // TimeCondition params:
                    if (instance.when !== undefined) {
                        return instance.when + (instance.maxCount ? " (" + instance.maxCount + "x)" : "") + ": " + utils.getTimeString(instance.time) + (instance.start ? " after " + instance.start : "");
                    }
                    if (instance.missionStates !== undefined) {
                        return "state is " + (instance.missionStates.join(" or ") || "unknown");
                    }
                    return "none";
                },
                properties: {
                    // DestroyedCondition params:
                    WHICH: {
                        name: "which",
                        type: CONDITION_SUBJECTS_WHICH,
                        isRequired: _hasWhichParam,
                        isValid: _hasWhichParam
                    },
                    // CountCondition params:
                    COUNT: {
                        name: "count",
                        type: NON_NEGATIVE_INTEGER,
                        isRequired: _parentIsCountCondition,
                        isValid: _parentIsCountCondition
                    },
                    RELATION: {
                        name: "relation",
                        type: COUNT_CONDITION_RELATION,
                        isRequired: _parentIsCountCondition,
                        isValid: _parentIsCountCondition
                    },
                    // TimeCondition params:
                    TIME: {
                        name: "time",
                        type: NON_NEGATIVE_MILLISECONDS,
                        isRequired: _parentIsTimeCondition,
                        isValid: _parentIsTimeCondition
                    },
                    WHEN: {
                        name: "when",
                        type: TIME_CONDITION_WHEN,
                        isRequired: _parentIsTimeCondition,
                        isValid: _parentIsTimeCondition
                    },
                    START: {
                        name: "start",
                        type: EVENT_REFERENCE,
                        optional: true,
                        isValid: _parentIsTimeCondition,
                        defaultText: "mission start"
                    },
                    MAX_COUNT: {
                        name: "maxCount",
                        type: POSITIVE_INTEGER,
                        optional: true,
                        isValid: _isRepeatTime,
                        defaultText: "infinite"
                    },
                    START_VALUE: {
                        name: "startValue",
                        type: MILLISECONDS,
                        optional: true,
                        isValid: _isRepeatTime,
                        defaultValue: 0
                    },
                    // HullIntegrityCondition and ShieldIntegrityCondition params:
                    MIN_INTEGRITY: {
                        name: "minIntegrity",
                        type: NON_NEGATIVE_INT_PERCENT,
                        optional: true,
                        isValid: _parentIsIntegrityCondition,
                        defaultText: "0%"
                    },
                    MAX_INTEGRITY: {
                        name: "maxIntegrity",
                        type: NON_NEGATIVE_INT_PERCENT,
                        optional: true,
                        isValid: _parentIsIntegrityCondition,
                        defaultText: "100%"
                    },
                    // DistanceCondition params:
                    TARGET: {
                        name: "target",
                        type: SPACECRAFT_REFERENCE,
                        isValid: _parentIsDistanceCondition,
                        isRequired: _parentIsDistanceCondition
                    },
                    MIN_DISTANCE: {
                        name: "minDistance",
                        type: POSITIVE_DISTANCE,
                        optional: true,
                        isValid: _parentIsDistanceCondition,
                        defaultText: "0"
                    },
                    MAX_DISTANCE: {
                        name: "maxDistance",
                        type: POSITIVE_DISTANCE,
                        optional: true,
                        isValid: _parentIsDistanceCondition,
                        defaultText: "infinity"
                    },
                    // HitCondition params:
                    BY: {
                        name: "by",
                        type: SUBJECT_GROUP,
                        optional: true,
                        isValid: _hasByParam,
                        defaultText: "any"
                    },
                    // CollisionCondition params:
                    WITH: {
                        name: "with",
                        type: SUBJECT_GROUP,
                        optional: true,
                        isValid: _hasWithParam,
                        defaultText: "any"
                    },
                    // AwayCondition params:
                    AWAY: {
                        name: "away",
                        type: BaseType.BOOLEAN,
                        optional: true,
                        isValid: _parentIsAwayCondition,
                        defaultValue: true
                    },
                    // OnTeamCondition params:
                    TEAM: {
                        name: "team",
                        type: TEAM_REFERENCE,
                        isValid: _parentIsOnTeamCondition,
                        isRequired: _parentIsOnTeamCondition
                    },
                    // MissionStateCondition params:
                    MISSION_STATES: {
                        name: "missionStates",
                        type: MISSION_STATE_SET,
                        isValid: _parentIsMissionStateCondition,
                        isRequired: _parentIsMissionStateCondition
                    }
                }
            },
            _conditionCanHaveSubjects = function (data) {
                return (data.type === ConditionType.DESTROYED) ||
                        (data.type === ConditionType.COUNT) ||
                        (data.type === ConditionType.HULL_INTEGRITY) ||
                        (data.type === ConditionType.SHIELD_INTEGRITY) ||
                        (data.type === ConditionType.DISTANCE) ||
                        (data.type === ConditionType.HIT) ||
                        (data.type === ConditionType.COLLISION) ||
                        (data.type === ConditionType.AWAY) ||
                        (data.type === ConditionType.ON_TEAM) ||
                        (data.type === ConditionType.GETS_TARGETED) ||
                        (data.type === ConditionType.IS_TARGETED);
            },
            _conditionCanHaveParams = function (data) {
                return ((data.type === ConditionType.DESTROYED) && data.subjects && new conditions.SubjectGroup(data.subjects).isMulti()) ||
                        (data.type === ConditionType.COUNT) ||
                        (data.type === ConditionType.TIME) ||
                        (data.type === ConditionType.HULL_INTEGRITY) ||
                        (data.type === ConditionType.SHIELD_INTEGRITY) ||
                        (data.type === ConditionType.DISTANCE) ||
                        (data.type === ConditionType.HIT) ||
                        (data.type === ConditionType.COLLISION) ||
                        (data.type === ConditionType.AWAY) ||
                        (data.type === ConditionType.ON_TEAM) ||
                        (data.type === ConditionType.MISSION_STATE) ||
                        (data.type === ConditionType.GETS_TARGETED) ||
                        (data.type === ConditionType.IS_TARGETED);
            },
            _conditionMustHaveParams = function (data) {
                return (data.type === ConditionType.COUNT) ||
                        (data.type === ConditionType.TIME) ||
                        (data.type === ConditionType.HULL_INTEGRITY) ||
                        (data.type === ConditionType.SHIELD_INTEGRITY) ||
                        (data.type === ConditionType.DISTANCE) ||
                        (data.type === ConditionType.ON_TEAM) ||
                        (data.type === ConditionType.MISSION_STATE);
            },
            _getConditionParamDefault = function (data) {
                switch (data.type) {
                    case ConditionType.DESTROYED:
                        return "all";
                    case ConditionType.AWAY:
                        return "all away";
                    default:
                        return "none";
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            CONDITION = {
                baseType: BaseType.OBJECT,
                name: "Condition",
                getName: function (instance) {
                    if (instance.type) {
                        return instance.type;
                    }
                    return "condition";
                },
                getPreviewText: function (instance) {
                    if (instance.type) {
                        switch (instance.type) {
                            case ConditionType.COUNT:
                                return "count of " + SUBJECT_GROUP.getPreviewText(instance.subjects || utils.EMPTY_OBJECT, instance) + " " + CONDITION_PARAMS.getPreviewText(instance.params || utils.EMPTY_OBJECT, instance);
                            case ConditionType.DESTROYED:
                                return SUBJECT_GROUP.getPreviewText(instance.subjects || utils.EMPTY_OBJECT, instance) + " destroyed";
                            case ConditionType.TIME:
                                return instance.params ? CONDITION_PARAMS.getPreviewText(instance.params, instance) : "time";
                            case ConditionType.HULL_INTEGRITY:
                                return (instance.params && ((instance.params.minIntegrity !== undefined) || (instance.params.maxIntegrity !== undefined))) ?
                                        CONDITION_PARAMS.getPreviewText(instance.params, instance) : "incomplete hull condition";
                            case ConditionType.SHIELD_INTEGRITY:
                                return (instance.params && ((instance.params.minIntegrity !== undefined) || (instance.params.maxIntegrity !== undefined))) ?
                                        CONDITION_PARAMS.getPreviewText(instance.params, instance) : "incomplete shield condition";
                            case ConditionType.DISTANCE:
                                return (instance.params && ((instance.params.minDistance !== undefined) || (instance.params.maxDistance !== undefined))) ?
                                        SUBJECT_GROUP.getPreviewText(instance.subjects || utils.EMPTY_OBJECT, instance) + ": " + CONDITION_PARAMS.getPreviewText(instance.params, instance) :
                                        "incomplete distance condition";
                            case ConditionType.HIT:
                                return SUBJECT_GROUP.getPreviewText(instance.subjects || utils.EMPTY_OBJECT, instance) + " hit" + ((instance.params && instance.params.by) ? " " + CONDITION_PARAMS.getPreviewText(instance.params, instance) : "");
                            case ConditionType.COLLISION:
                                return SUBJECT_GROUP.getPreviewText(instance.subjects || utils.EMPTY_OBJECT, instance) + " collides" + ((instance.params && instance.params.with) ? " " + CONDITION_PARAMS.getPreviewText(instance.params, instance) : "");
                            case ConditionType.AWAY:
                                return SUBJECT_GROUP.getPreviewText(instance.subjects || utils.EMPTY_OBJECT, instance) + " " +
                                        ((!instance.params || (instance.params.away !== false)) ? "away" : "present");
                            case ConditionType.ON_TEAM:
                                return SUBJECT_GROUP.getPreviewText(instance.subjects || utils.EMPTY_OBJECT, instance) + " on " +
                                        ((instance.params && instance.params.team) || "unknown");
                            case ConditionType.MISSION_STATE:
                                return "mission state is " + ((instance.params && instance.params.missionStates && instance.params.missionStates.join(" or ")) || "unknown");
                            case ConditionType.GETS_TARGETED:
                                return SUBJECT_GROUP.getPreviewText(instance.subjects || utils.EMPTY_OBJECT, instance) + " gets targeted" + ((instance.params && instance.params.by) ? " " + CONDITION_PARAMS.getPreviewText(instance.params, instance) : "");
                            case ConditionType.IS_TARGETED:
                                return SUBJECT_GROUP.getPreviewText(instance.subjects || utils.EMPTY_OBJECT, instance) + " is targeted" + ((instance.params && instance.params.by) ? " by " + SUBJECT_GROUP.getPreviewText(instance.params.by) : "");
                        }
                        return instance.type;
                    }
                    return "condition";
                },
                properties: {
                    TYPE: {
                        name: "type",
                        type: CONDITION_TYPE
                    },
                    SUBJECTS: {
                        name: "subjects",
                        type: SUBJECT_GROUP,
                        isRequired: _conditionCanHaveSubjects,
                        isValid: _conditionCanHaveSubjects
                    },
                    PARAMS: {
                        name: "params",
                        type: CONDITION_PARAMS,
                        isRequired: _conditionMustHaveParams,
                        isValid: _conditionCanHaveParams,
                        updateOnValidate: true,
                        getDerivedDefault: _getConditionParamDefault
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TRIGGER_WHICH = {
                baseType: BaseType.ENUM,
                values: TriggerWhich
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TRIGGER_WHEN = {
                baseType: BaseType.ENUM,
                values: TriggerWhen
            },
            _triggerHasConditions = function (data) {
                return data.conditions && (data.conditions.length > 0);
            },
            _triggerHasMultipleConditions = function (data) {
                return data.conditions && (data.conditions.length > 1);
            },
            _getTriggerDefaultOnce = function (data) {
                var i;
                if (data.conditions) {
                    for (i = 0; i < data.conditions.length; i++) {
                        if (conditions.createCondition(data.conditions[i]).canChangeMultipleTimes()) {
                            return false;
                        }
                    }
                }
                return true;
            },
            _isTriggerOnceValid = function (data) {
                return !_getTriggerDefaultOnce(data);
            },
            _triggerIsOneShot = function (data) {
                return (data.once === true) ||
                        ((data.once === undefined) && _getTriggerDefaultOnce(data));
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TRIGGER = {
                baseType: BaseType.OBJECT,
                name: "Trigger",
                getPreviewText: function (instance) {
                    var whichAny = instance.which === TriggerWhich.ANY,
                            whenFalse = instance.when === TriggerWhen.BECOMES_FALSE,
                            result = (instance.delay ? utils.getTimeString(instance.delay) + " after " : "");
                    if (instance.conditions && (instance.conditions.length > 0)) {
                        if (instance.conditions.length > 2) {
                            result = result + (whichAny ? "any of " : "") + instance.conditions.length + " conditions" + (whenFalse ? " become false" : "");
                        } else if (instance.conditions.length > 1) {
                            result = result + (whenFalse ? (whichAny ? "not " : "neither ") : "") +
                                    instance.conditions.map(CONDITION.getPreviewText).join(whenFalse ? (whichAny ? " and " : " nor ") : (whichAny ? " or " : " and "));
                        } else {
                            result = result + (whenFalse ? "not " : "") + CONDITION.getPreviewText(instance.conditions[0], instance);
                        }
                        return result;
                    }
                    return result + "mission start";
                },
                properties: {
                    CONDITIONS: {
                        name: "conditions",
                        type: _createTypedArrayType(CONDITION, {min: 1}, function (instance) {
                            if (instance.length > 0 && instance.length <= 2) {
                                return "[" + instance.map(CONDITION.getPreviewText).join(", ") + "]";
                            }
                        }),
                        optional: true
                    },
                    WHICH: {
                        name: "which",
                        type: TRIGGER_WHICH,
                        defaultValue: TriggerWhich.ALL,
                        isValid: _triggerHasMultipleConditions
                    },
                    WHEN: {
                        name: "when",
                        type: TRIGGER_WHEN,
                        defaultValue: TriggerWhen.BECOMES_TRUE,
                        isValid: _triggerHasConditions
                    },
                    ONCE: {
                        name: "once",
                        type: BaseType.BOOLEAN,
                        getDerivedDefault: _getTriggerDefaultOnce,
                        isValid: _isTriggerOnceValid,
                        optional: true
                    },
                    DELAY: {
                        name: "delay",
                        type: NON_NEGATIVE_MILLISECONDS,
                        defaultValue: 0,
                        isValid: _triggerIsOneShot
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            ACTION_TYPE = {
                baseType: BaseType.ENUM,
                values: ActionType
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SPACECRAFT_COMMAND = {
                baseType: BaseType.ENUM,
                values: ai.SpacecraftCommand
            },
            /**
             * @type Editor~TypeDescriptor
             */
            JUMP_COMMAND_WAY = {
                baseType: BaseType.ENUM,
                values: ai.JumpCommandWay
            },
            /**
             * @type Editor~TypeDescriptor
             */
            FORMATION_TYPE = {
                baseType: BaseType.ENUM,
                values: formations.FormationType
            },
            /**
             * @type Editor~TypeDescriptor
             */
            FORMATION = {
                baseType: BaseType.OBJECT,
                name: "SpacecraftFormation",
                getPreviewText: function (instance) {
                    return instance.type + (instance.spacing ? " (" + instance.spacing.join(", ") + ")" : "");
                },
                properties: {
                    TYPE: {
                        name: "type",
                        type: FORMATION_TYPE
                    },
                    SPACING: {
                        name: "spacing",
                        type: BaseType.VECTOR3
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            JUMP_COMMAND_PARAMS = {
                baseType: BaseType.OBJECT,
                name: "JumpCommandParams",
                getPreviewText: function (instance) {
                    return (instance.way || "") + (instance.anchor ? " (" + instance.anchor + ")" : "");
                },
                properties: {
                    WAY: {
                        name: "way",
                        type: JUMP_COMMAND_WAY,
                        optional: true
                    },
                    FORMATION: {
                        name: "formation",
                        type: FORMATION,
                        optional: true
                    },
                    ANCHOR: {
                        name: "anchor",
                        type: SPACECRAFT_REFERENCE,
                        optional: true
                    },
                    DISTANCE: {
                        name: "distance",
                        type: DISTANCE,
                        optional: true
                    },
                    POSITION: {
                        name: "position",
                        type: BaseType.VECTOR3,
                        optional: true
                    },
                    ROTATIONS: {
                        name: "rotations",
                        type: BaseType.ROTATIONS,
                        optional: true
                    },
                    RELATIVE: {
                        name: "relative",
                        type: BaseType.BOOLEAN,
                        optional: true
                    },
                    FALLBACK_POSITION: {
                        name: "fallbackPosition",
                        type: BaseType.VECTOR3,
                        optional: true
                    },
                    FALLBACK_ROTATIONS: {
                        name: "fallbackRotations",
                        type: BaseType.ROTATIONS,
                        optional: true
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TARGET_COMMAND_PARAMS = {
                baseType: BaseType.OBJECT,
                name: "TargetCommandParams",
                getPreviewText: function (instance) {
                    var result;
                    if (instance.single) {
                        result = instance.single;
                    } else if (instance.list) {
                        if (instance.list.length < 4) {
                            result = instance.list.join(", ");
                        } else {
                            result = "list (" + instance.list.length + ")";
                        }
                    } else if (instance.squads) {
                        if (instance.squads.length < 4) {
                            result = instance.squads.join(", ");
                        } else {
                            result = instance.squads.length + " squads";
                        }
                    } else if (instance.none) {
                        result = "none";
                    }
                    if (instance.priority) {
                        result += "!";
                    }
                    return result;
                },
                properties: {
                    SINGLE: {
                        name: "single",
                        type: SPACECRAFT_REFERENCE,
                        optional: true
                    },
                    LIST: {
                        name: "list",
                        type: _createTypedArrayType(SPACECRAFT_REFERENCE),
                        optional: true
                    },
                    SQUADS: {
                        name: "squads",
                        type: _createTypedArrayType(SQUAD_REFERENCE),
                        optional: true
                    },
                    NONE: {
                        name: "none",
                        type: BaseType.BOOLEAN,
                        optional: true
                    },
                    PRIORITY: {
                        name: "priority",
                        type: BaseType.BOOLEAN,
                        optional: true
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            REACH_DISTANCE_COMMAND_PARAMS = {
                baseType: BaseType.OBJECT,
                name: "ReachDistanceCommandParams",
                getPreviewText: function (instance) {
                    var result = "";
                    if (instance.minDistance) {
                        result += instance.minDistance + " m < ";
                    }
                    result += "distance";
                    if (instance.target) {
                        result += " to " + instance.target;
                    }
                    if (instance.maxDistance) {
                        result += " < " + instance.maxDistance + " m";
                    }
                    return result;
                },
                properties: {
                    TARGET: {
                        name: "target",
                        type: SPACECRAFT_REFERENCE
                    },
                    MIN_DISTANCE: {
                        name: "minDistance",
                        type: POSITIVE_DISTANCE,
                        optional: true
                    },
                    MAX_DISTANCE: {
                        name: "maxDistance",
                        type: POSITIVE_DISTANCE,
                        optional: true
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            HUD_SECTION = {
                baseType: BaseType.ENUM,
                values: battle.HUDSection
            },
            /**
             * @type Editor~TypeDescriptor
             */
            HUD_SECTION_STATE = {
                baseType: BaseType.ENUM,
                values: battle.HUDSectionState
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MESSAGE_REFERENCE = {
                baseType: BaseType.ENUM,
                getValues: function (parent, topParent, itemName) {
                    var prefix = strings.MISSION.PREFIX.name + utils.getFilenameWithoutExtension(itemName) + strings.MISSION.MESSAGES_SUFFIX.name, prefixLength = prefix.length;
                    return strings.getKeys(prefix).map(function (key) {
                        return key.substring(prefixLength);
                    });
                }
            },
            _parentIsMessageAction = function (data, parent) {
                return !!parent && (parent.type === ActionType.MESSAGE);
            },
            _messageCanHaveDuration = function (data, parent) {
                return _parentIsMessageAction(data, parent) && !data.permanent;
            },
            _messageCanBePermanent = function (data, parent) {
                return _parentIsMessageAction(data, parent) && (data.duration === undefined);
            },
            _parentIsCommandAction = function (data, parent) {
                return !!parent && (parent.type === ActionType.COMMAND);
            },
            _parentIsSetPropertiesAction = function (data, parent) {
                return !!parent && (parent.type === ActionType.SET_PROPERTIES);
            },
            _parentCanHaveHullShieldParams = function (data, parent) {
                return !!parent && (parent.type === ActionType.SET_PROPERTIES) || (parent.type === ActionType.REPAIR) || (parent.type === ActionType.DAMAGE);
            },
            _isJumpCommandActionParams = function (data, parent) {
                return _parentIsCommandAction(data, parent) && (data.command === ai.SpacecraftCommand.JUMP);
            },
            _isTargetCommandActionParams = function (data, parent) {
                return _parentIsCommandAction(data, parent) && (data.command === ai.SpacecraftCommand.TARGET);
            },
            _isReachDistanceCommandActionParams = function (data, parent) {
                return _parentIsCommandAction(data, parent) && (data.command === ai.SpacecraftCommand.REACH_DISTANCE);
            },
            _parentIsHUDAction = function (data, parent) {
                return !!parent && (parent.type === ActionType.HUD);
            },
            _missionHasMessages = function (data, parent, itemName) {
                var prefix = strings.MISSION.PREFIX.name + utils.getFilenameWithoutExtension(itemName) + strings.MISSION.MESSAGES_SUFFIX.name;
                return !!parent && (parent.type === ActionType.MESSAGE) && (strings.getKeys(prefix).length > 0);
            },
            _requiresMessage = function (data, parent, itemName) {
                return _parentIsMessageAction(data, parent) && !_missionHasMessages(data, parent, itemName);
            },
            _getStringPreview = function (string) {
                return (string.length > 0) ? (string.substr(0, LONG_TEXT_PREVIEW_LENGTH) + ((string.length > LONG_TEXT_PREVIEW_LENGTH) ? "..." : "")) : "...";
            },
            _getPropertiesText = function (params, operator) {
                var parts = [];
                operator = operator || "=";
                if (params.hull !== undefined) {
                    parts.push("hull" + operator + params.hull + "%");
                }
                if (params.shield !== undefined) {
                    parts.push("shield" + operator + params.shield + "%");
                }
                if (params.team !== undefined) {
                    parts.push("team" + operator + params.team);
                }
                if (params.disableFiring !== undefined) {
                    parts.push((params.disableFiring ? "disable" : "enable") + " firing");
                }
                return parts.join(", ");
            },
            /**
             * A merge of all the different possible action parameters
             * @type Editor~TypeDescriptor
             */
            ACTION_PARAMS = {
                baseType: BaseType.OBJECT,
                name: "ActionParams",
                getPreviewText: function (instance) {
                    // MessageAction params:
                    if ((instance.text !== undefined) || (instance.textID !== undefined)) {
                        return "message" + (instance.text ? " (" + _getStringPreview(instance.text) + ")" : (instance.textID ? " (" + instance.textID + ")" : ""));
                    }
                    // CommandAction params:
                    if (instance.command !== undefined) {
                        if (instance.jump && instance.jump.way) {
                            return instance.command + " " + instance.jump.way;
                        }
                        if (instance.target) {
                            return instance.command + " " + TARGET_COMMAND_PARAMS.getPreviewText(instance.target, instance);
                        }
                        if (instance.reachDistance) {
                            if (instance.reachDistance.minDistance) {
                                if (instance.reachDistance.maxDistance) {
                                    return "get to " + instance.reachDistance.minDistance + "-" + instance.reachDistance.maxDistance + " m from " + instance.reachDistance.target;
                                } else {
                                    return "get away to " + instance.reachDistance.minDistance + " m from " + instance.reachDistance.target;
                                }
                            } else if (instance.reachDistance.maxDistance) {
                                return "approach " + instance.reachDistance.target + " to " + instance.reachDistance.maxDistance + " m";
                            }
                        }
                        return instance.command;
                    }
                    // SetPropertiesAction params:
                    if (instance.hull !== undefined || instance.shield !== undefined || instance.team !== undefined || instance.disableFiring !== undefined) {
                        return _getPropertiesText(instance, ": ");
                    }
                    // HUDAction params:
                    if (instance.state !== undefined) {
                        return "HUD: " + (instance.section ? instance.section + " " : "") + instance.state;
                    }
                    return "none";
                },
                properties: {
                    // MessageAction params:
                    TEXT: {
                        name: "text",
                        type: LONG_STRING,
                        newValue: "Test",
                        isRequired: _requiresMessage,
                        isValid: _parentIsMessageAction
                    },
                    TEXT_ID: {
                        name: "textID",
                        type: MESSAGE_REFERENCE,
                        optional: true,
                        isValid: _missionHasMessages
                    },
                    SOURCE: {
                        name: "source",
                        type: SPACECRAFT_REFERENCE,
                        optional: true,
                        defaultText: "none",
                        isValid: _parentIsMessageAction
                    },
                    DURATION: {
                        name: "duration",
                        type: POSITIVE_MILLISECONDS,
                        optional: true,
                        defaultText: "automatic",
                        isValid: _messageCanHaveDuration
                    },
                    PERMANENT: {
                        name: "permanent",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _messageCanBePermanent
                    },
                    URGENT: {
                        name: "urgent",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _parentIsMessageAction
                    },
                    TYPEWRITER: {
                        name: "typewriter",
                        type: BaseType.BOOLEAN,
                        defaultValue: true,
                        isValid: _parentIsMessageAction
                    },
                    SILENT: {
                        name: "silent",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _parentIsMessageAction
                    },
                    NO_BACKGROUND: {
                        name: "noBackground",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _parentIsMessageAction
                    },
                    COLOR: {
                        name: "color",
                        type: BaseType.COLOR4,
                        optional: true,
                        isValid: _parentIsMessageAction
                    },
                    // CommandAction params:
                    COMMAND: {
                        name: "command",
                        type: SPACECRAFT_COMMAND,
                        isRequired: _parentIsCommandAction,
                        isValid: _parentIsCommandAction
                    },
                    JUMP: {
                        name: "jump",
                        type: JUMP_COMMAND_PARAMS,
                        optional: true,
                        isValid: _isJumpCommandActionParams
                    },
                    TARGET: {
                        name: "target",
                        type: TARGET_COMMAND_PARAMS,
                        optional: true,
                        isValid: _isTargetCommandActionParams
                    },
                    REACH_DISTANCE: {
                        name: "reachDistance",
                        type: REACH_DISTANCE_COMMAND_PARAMS,
                        optional: true,
                        isValid: _isReachDistanceCommandActionParams
                    },
                    // SetPropertiesAction params:
                    HULL: {
                        name: "hull",
                        type: NON_NEGATIVE_INT_PERCENT,
                        optional: true,
                        defaultText: "unchanged",
                        isValid: _parentCanHaveHullShieldParams
                    },
                    SHIELD: {
                        name: "shield",
                        type: NON_NEGATIVE_INT_PERCENT,
                        optional: true,
                        defaultText: "unchanged",
                        isValid: _parentCanHaveHullShieldParams
                    },
                    TEAM: {
                        name: "team",
                        type: TEAM_REFERENCE,
                        optional: true,
                        defaultText: "unchanged",
                        isValid: _parentIsSetPropertiesAction
                    },
                    DISABLE_FIRING: {
                        name: "disableFiring",
                        type: BaseType.BOOLEAN,
                        optional: true,
                        defaultText: "unchanged",
                        isValid: _parentIsSetPropertiesAction
                    },
                    // HUDAction params:
                    SECTION: {
                        name: "section",
                        type: HUD_SECTION,
                        optional: true,
                        isValid: _parentIsHUDAction
                    },
                    STATE: {
                        name: "state",
                        type: HUD_SECTION_STATE,
                        isRequired: _parentIsHUDAction,
                        isValid: _parentIsHUDAction
                    }
                }
            },
            _actionCanHaveSubjects = function (data) {
                return (data.type === ActionType.COMMAND) || (data.type === ActionType.SET_PROPERTIES) || (data.type === ActionType.REPAIR) || (data.type === ActionType.DAMAGE);
            },
            _actionCanHaveParams = function (data) {
                return [
                    ActionType.MESSAGE,
                    ActionType.COMMAND,
                    ActionType.SET_PROPERTIES,
                    ActionType.REPAIR,
                    ActionType.DAMAGE,
                    ActionType.HUD
                ].indexOf(data.type) >= 0;
            },
            /**
             * @type Editor~TypeDescriptor
             */
            ACTION = {
                baseType: BaseType.OBJECT,
                name: "Action",
                getName: function (instance) {
                    var result = "";
                    if (instance.delay) {
                        result = utils.getTimeString(instance.delay) + " | ";
                    }
                    if (instance.type) {
                        switch (instance.type) {
                            case ActionType.MESSAGE:
                                if (instance.params) {
                                    result = result + ACTION_PARAMS.getPreviewText(instance.params, instance);
                                }
                                break;
                            case ActionType.COMMAND:
                                if (instance.subjects && instance.params) {
                                    result = result + SUBJECT_GROUP.getPreviewText(instance.subjects, instance) + ": " + ACTION_PARAMS.getPreviewText(instance.params, instance);
                                } else {
                                    result = result + instance.type;
                                }
                                break;
                            case ActionType.HUD:
                                if (instance.params) {
                                    result = result + ACTION_PARAMS.getPreviewText(instance.params, instance);
                                }
                                break;
                            case ActionType.SET_PROPERTIES:
                                if (!instance.params) {
                                    result = result + "set properties";
                                }
                                result = result + (instance.subjects ? SUBJECT_GROUP.getPreviewText(instance.subjects, instance) : "set") + ":" +
                                        _getPropertiesText(instance.params);
                                break;
                            case ActionType.REPAIR:
                                if (!instance.params) {
                                    result = result + "repair";
                                }
                                result = result + (instance.subjects ? SUBJECT_GROUP.getPreviewText(instance.subjects, instance) : "repair") + ":" +
                                        _getPropertiesText(instance.params, "+");
                                break;
                            case ActionType.DAMAGE:
                                if (!instance.params) {
                                    result = result + "damage";
                                }
                                result = result + (instance.subjects ? SUBJECT_GROUP.getPreviewText(instance.subjects, instance) : "damage") + ":" +
                                        _getPropertiesText(instance.params, "-");
                                break;
                            default:
                                result = result + instance.type;
                        }
                    } else {
                        result = result + "action";
                    }
                    return result;
                },
                properties: {
                    TYPE: {
                        name: "type",
                        type: ACTION_TYPE
                    },
                    DELAY: {
                        name: "delay",
                        type: NON_NEGATIVE_MILLISECONDS,
                        defaultValue: 0
                    },
                    SUBJECTS: {
                        name: "subjects",
                        type: SUBJECT_GROUP,
                        isRequired: _actionCanHaveSubjects,
                        isValid: _actionCanHaveSubjects
                    },
                    PARAMS: {
                        name: "params",
                        type: ACTION_PARAMS,
                        isRequired: _actionCanHaveParams,
                        isValid: _actionCanHaveParams,
                        updateOnValidate: true
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            MISSION_EVENT = {
                baseType: BaseType.OBJECT,
                name: "MissionEvent",
                getName: function (instance) {
                    if (instance.name) {
                        return instance.name;
                    }
                    if (instance.actions && (instance.actions.length > 0) && (instance.actions[0].type === ActionType.WIN)) {
                        return "win";
                    }
                    if (instance.actions && (instance.actions.length > 0) && (instance.actions[0].type === ActionType.LOSE)) {
                        return "lose";
                    }
                    if (instance.trigger && (!instance.trigger.conditions || instance.trigger.conditions.length === 0)) {
                        return "start";
                    }
                    if (instance.actions) {
                        if (instance.actions.length > 1) {
                            if (instance.trigger && instance.trigger.conditions && (instance.trigger.conditions.length === 1)) {
                                return CONDITION.getPreviewText(instance.trigger.conditions[0]);
                            }
                            return instance.actions.length + " actions";
                        } else if (instance.actions.length === 1) {
                            return ACTION.getName(instance.actions[0]);
                        }
                    }
                    return "event";
                },
                properties: {
                    NAME: {
                        name: "name",
                        type: BaseType.STRING,
                        optional: true
                    },
                    TRIGGER: {
                        name: "trigger",
                        type: TRIGGER
                    },
                    ACTIONS: {
                        name: "actions",
                        type: _createTypedArrayType(ACTION)
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SCENE_VIEW_LOOK_AT_MODE = {
                baseType: BaseType.ENUM,
                values: classes.SceneViewLookAtMode
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SCENE_VIEW = {
                baseType: BaseType.OBJECT,
                name: "SceneView",
                properties: {
                    NAME: {
                        name: "name",
                        type: BaseType.STRING
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
                        type: DISTANCE,
                        globalDefault: true,
                        settingName: config.CAMERA_SETTINGS.DEFAULT_SPAN
                    },
                    FPS: {
                        name: "fps",
                        type: BaseType.BOOLEAN,
                        defaultValue: false
                    },
                    BASE_ORIENTATION: {
                        name: "baseOrientation",
                        type: BASE_ORIENTATION,
                        globalDefault: true,
                        settingName: config.CAMERA_SETTINGS.DEFAULT_BASE_ORIENTATION,
                        isValid: _isFPS
                    },
                    POINT_TO_FALLBACK: {
                        name: "pointToFallback",
                        type: POINT_TO_FALLBACK,
                        optional: true
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
                        type: _createRangeType(true, true, DEGREES),
                        optional: true,
                        defaultText: "unlimited",
                        isValid: _turnableFPS
                    },
                    BETA_RANGE: {
                        name: "betaRange",
                        type: _createRangeType(true, true, DEGREES_BETA),
                        defaultValue: [-90, 90],
                        isValid: _turnableFPS
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
                    EXCLUDE_FROM_CYCLE: {
                        name: "excludeFromCycle",
                        type: BaseType.BOOLEAN,
                        optional: true
                    },
                    TURN_AROUND_ALL: {
                        name: "turnAroundAll",
                        type: BaseType.BOOLEAN,
                        defaultValue: false
                    },
                    LOOK_AT: {
                        name: "lookAt",
                        type: SCENE_VIEW_LOOK_AT_MODE
                    },
                    DISTANCE_RANGE: {
                        name: "distanceRange",
                        type: BaseType.RANGE,
                        optional: true
                    },
                    STARTS_WITH_RELATIVE_POSITION: {
                        name: "startsWithRelativePosition",
                        type: BaseType.BOOLEAN,
                        optional: true
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            AI_TYPE = {
                baseType: BaseType.ENUM,
                values: utils.getEnumObject(ai.getAITypes())
            },
            /**
             * @type Editor~TypeDescriptor
             */
            CLASS_LOADOUT_REFERENCE = {
                name: "loadout",
                baseType: BaseType.ENUM,
                getValues: function (parent) {
                    var spacecraftClass;
                    if (parent.class) {
                        spacecraftClass = classes.getSpacecraftClass(parent.class);
                        return spacecraftClass.getLoadoutNames();
                    }
                    return [];
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SPACECRAFT_COUNT = {
                baseType: BaseType.NUMBER,
                integer: true,
                min: 1,
                max: 9
            },
            _craftIsSingle = function (data) {
                return !data.count || (data.count === 1);
            },
            _craftIsMulti = function (data) {
                return data.count && (data.count > 1);
            },
            _craftCanBePiloted = function (data) {
                return _craftIsSingle(data) && !data.away;
            },
            _multiCraftCanBePiloted = function (data) {
                return _craftIsMulti(data) && !data.away;
            },
            _craftCanHaveLoadouts = function (data) {
                return _craftIsMulti(data) && !data.loadout && !data.equipment;
            },
            _craftHasNoLoadouts = function (data) {
                return !data.loadouts || (data.loadouts.length === 0);
            },
            _craftCanHaveLoadout = function (data) {
                return _craftHasNoLoadouts(data) && !data.equipment;
            },
            _craftCanHaveEquipment = function (data) {
                return _craftHasNoLoadouts(data) && !data.loadout;
            },
            _getDefaultLoadout = function (data) {
                var spacecraftClass;
                if (data.class) {
                    spacecraftClass = classes.getSpacecraftClass(data.class);
                    return spacecraftClass.getDefaultLoadout() || "none";
                }
            },
            _craftIsNotPiloted = function (data) {
                return !data.piloted && !data.pilotedIndex;
            },
            _craftIsNotPilotedSingle = function (data) {
                return !data.piloted;
            },
            _craftCanHavePositions = function (data) {
                return _craftIsMulti(data) && !data.position && !data.formation;
            },
            _craftHasNoPositions = function (data) {
                return !data.positions;
            },
            _craftCanHaveFormation = function (data) {
                return data.count && _craftHasNoPositions(data);
            },
            _craftCanHaveInitialBlinkTimeDelta = function (data) {
                return _craftIsMulti(data) && (data.initialBlinkTime !== undefined);
            },
            /**
             * @type Editor~TypeDescriptor
             */
            SPACECRAFT = {
                baseType: BaseType.OBJECT,
                name: "Spacecraft",
                getName: function (instance) {
                    return instance.name || (instance.squad || instance.class) + (instance.count ? (" (" + instance.count + ")") : "");
                },
                getColor: function (instance) {
                    return instance.away ? SPACECRAFT_AWAY_COLOR : undefined;
                },
                properties: {
                    NAME: {
                        name: "name",
                        type: BaseType.STRING,
                        optional: true,
                        isValid: _craftIsSingle
                    },
                    SQUAD: {
                        name: "squad",
                        type: BaseType.STRING,
                        optional: true,
                        getSuggestions: function () {
                            return strings.getKeys("squad").map(function (key) {
                                return key.substring(6);
                            });
                        },
                        defaultText: "none"
                    },
                    TEAM: {
                        name: "team",
                        type: TEAM_REFERENCE,
                        optional: true
                    },
                    CLASS: {
                        name: "class",
                        type: SPACECRAFT_CLASS_REFERENCE
                    },
                    AI: {
                        name: "ai",
                        type: AI_TYPE,
                        optional: true,
                        defaultText: "none",
                        isValid: _craftIsNotPilotedSingle
                    },
                    POSITION: {
                        name: "position",
                        type: BaseType.VECTOR3,
                        optional: true,
                        isValid: _craftHasNoPositions,
                        defaultValue: [0, 0, 0]
                    },
                    ROTATIONS: {
                        name: "rotations",
                        type: BaseType.ROTATIONS,
                        optional: true
                    },
                    LOADOUT: {
                        name: "loadout",
                        type: CLASS_LOADOUT_REFERENCE,
                        optional: true,
                        isValid: _craftCanHaveLoadout,
                        getDerivedDefault: _getDefaultLoadout,
                        updateOnValidate: true
                    },
                    EQUIPMENT: {
                        name: "equipment",
                        type: LOADOUT,
                        optional: true,
                        isValid: _craftCanHaveEquipment,
                        defaultText: "from loadout",
                        updateOnValidate: true
                    },
                    AWAY: {
                        name: "away",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _craftIsNotPiloted
                    },
                    PILOTED: {
                        name: "piloted",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _craftCanBePiloted
                    },
                    INITIAL_TARGET: {
                        name: "initialTarget",
                        type: SPACECRAFT_REFERENCE,
                        optional: true
                    },
                    EXCLUDE_FROM_REFERENCE_SCORE: {
                        name: "excludeFromReferenceScore",
                        type: BaseType.BOOLEAN,
                        defaultValue: false,
                        isValid: _craftIsNotPiloted
                    },
                    INITIAL_BLINK_TIME: {
                        name: "initialBlinkTime",
                        type: NON_NEGATIVE_MILLISECONDS,
                        optional: true,
                        defaultText: "random"
                    },
                    COUNT: {
                        name: "count",
                        type: SPACECRAFT_COUNT,
                        optional: true,
                        defaultText: "single ship"
                    },
                    NAMES: {
                        name: "names",
                        type: STRING_ARRAY,
                        optional: true,
                        isValid: _craftIsMulti
                    },
                    LOADOUTS: {
                        name: "loadouts",
                        type: _createTypedArrayType(CLASS_LOADOUT_REFERENCE),
                        optional: true,
                        isValid: _craftCanHaveLoadouts,
                        updateOnValidate: true
                    },
                    PILOTED_INDEX: {
                        name: "pilotedIndex",
                        type: SPACECRAFT_COUNT,
                        optional: true,
                        isValid: _multiCraftCanBePiloted
                    },
                    POSITIONS: {
                        name: "positions",
                        type: _createTypedArrayType(BaseType.VECTOR3),
                        optional: true,
                        isValid: _craftCanHavePositions
                    },
                    FORMATION: {
                        name: "formation",
                        type: FORMATION,
                        optional: true,
                        isValid: _craftCanHaveFormation
                    },
                    INITIAL_BLINK_TIME_DELTA: {
                        name: "initialBlinkTimeDelta",
                        type: MILLISECONDS,
                        optional: true,
                        defaultText: "0",
                        isValid: _craftCanHaveInitialBlinkTimeDelta
                    }
                }
            },
            /**
             * @type Editor~TypeDescriptor
             */
            TIPS_SET = {
                baseType: BaseType.SET,
                values: []
            },
            /**
             * @type Editor~ItemDescriptor
             */
            MISSION = {
                TITLE: {
                    name: "title",
                    type: BaseType.STRING,
                    optional: true
                },
                DESCRIPTION: {
                    name: "description",
                    type: LONG_STRING
                },
                NEXT_MISSION: {
                    name: "nextMission",
                    type: MISSION_REFERENCE,
                    optional: true
                },
                TIPS: {
                    name: "tips",
                    type: TIPS_SET,
                    optional: true
                },
                ENVIRONMENT: {//TODO: can be an object as well
                    name: "environment",
                    type: ENVIRONMENT_REFERENCE
                },
                ANTICIPATION_THEME: {
                    name: "anticipationTheme",
                    type: MUSIC_REFERENCE,
                    optional: true
                },
                COMBAT_THEME: {
                    name: "combatTheme",
                    type: MUSIC_REFERENCE,
                    optional: true
                },
                TEAMS: {
                    name: "teams",
                    type: _createTypedArrayType(TEAM, undefined, function (instance) {
                        if (instance.length > 0 && instance.length <= 2) {
                            return "[" + instance.map(TEAM.getName).join(", ") + "]";
                        }
                    }),
                    optional: true
                },
                EVENTS: {
                    name: "events",
                    type: _createTypedArrayType(MISSION_EVENT),
                    optional: true
                },
                VIEWS: {
                    name: "views",
                    type: _createTypedArrayType(SCENE_VIEW),
                    optional: true
                },
                SPACECRAFTS: {
                    name: "spacecrafts",
                    type: _createTypedArrayType(SPACECRAFT)
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
        if (this._descriptor.getName) {
            return true;
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
     * Returns the value of the name property for the passed instance (either obtained from the 
     * corresponding field of the instance data or the getter function defined for the type)
     * @param {Object} instance
     * @returns {String}
     */
    Type.prototype.getInstanceName = function (instance) {
        if (this._descriptor.getName) {
            return this._descriptor.getName(instance);
        }
        return instance[NAME_PROPERTY_NAME];
    };
    /**
     * Returns the color to be used for the option corresponding to the passed instance when
     * selecting it within an array
     * @param {Object} instance
     * @returns {String}
     */
    Type.prototype.getInstanceColor = function (instance) {
        if (this._descriptor.getColor) {
            return this._descriptor.getColor(instance);
        }
        return undefined;
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
        if (this._descriptor.environmentReference) {
            return this._descriptor.environmentReference;
        }
        if (this._descriptor.missionReference) {
            return this._descriptor.missionReference;
        }
        return this._descriptor.baseType;
    };
    /**
     * Returns a displayable preview text for data of this type
     * @param {Object} data
     * @param {Object} parent The parent of data
     * @returns {String}
     */
    Type.prototype.getPreviewText = function (data, parent) {
        var result;
        if (this._descriptor.baseType === BaseType.ARRAY) {
            if (this._descriptor.getPreviewText) {
                result = this._descriptor.getPreviewText(data, parent);
            }
            if (!result) {
                if (data.length === 0) {
                    result = "empty list";
                } else if ((data.length === 1) && this._descriptor.elementType.getName) {
                    result = "[" + this._descriptor.elementType.getName(data[0]) + "]";
                } else if ((data.length === 1) && (typeof data[0] === "string")) {
                    result = "[" + data[0] + "]";
                } else if ((data.length <= 3) && (typeof data[0] === "number")) {
                    result = "[" + data.join(", ") + "]";
                } else {
                    result = this.getElementType().getDisplayName() + " [" + data.length + "]";
                }
            }
            return result;
        }
        return this._descriptor.getPreviewText ?
                this._descriptor.getPreviewText(data, parent) :
                this._descriptor.name;
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
     * For number types, returns the minimum allowed value
     * @returns {Number}
     */
    Type.prototype.getMin = function () {
        return this._descriptor.min;
    };
    /**
     * For number types, returns the maximum allowed value
     * @returns {Number}
     */
    Type.prototype.getMax = function () {
        return this._descriptor.max;
    };
    /**
     * For number types, returns whether only integers are allowed
     * @returns {Boolean}
     */
    Type.prototype.isInteger = function () {
        return !!this._descriptor.integer;
    };
    /**
     * For array types, returns their fixed length if set (undefined if not)
     * @returns {Number}
     */
    Type.prototype.getFixedLength = function () {
        return this._descriptor.fixedLength;
    };
    /**
     * For array types, returns their min length if set (undefined if not)
     * @returns {Number}
     */
    Type.prototype.getMinLength = function () {
        return this._descriptor.minLength;
    };
    /**
     * For array types, returns their max length if set (undefined if not)
     * @returns {Number}
     */
    Type.prototype.getMaxLength = function () {
        return this._descriptor.maxLength;
    };
    /**
     * Returns whether this type is a reference string (e.g. resource or class reference) type
     * @returns {Boolean}
     */
    Type.prototype.isItemReference = function () {
        return !!this._descriptor.resourceReference || !!this._descriptor.classReference || !!this._descriptor.environmentReference || !!this._descriptor.missionReference;
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
     * For environment reference string types, returns the category of environments the type refers to
     * @returns {String}
     */
    Type.prototype.getEnvironmentReference = function () {
        return this._descriptor.environmentReference;
    };
    /**
     * For mission reference string types, returns the category of missions the type refers to
     * @returns {String}
     */
    Type.prototype.getMissionReference = function () {
        return this._descriptor.missionReference;
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
        if (this.getEnvironmentReference()) {
            return common.ItemType.ENVIRONMENT;
        }
        if (this.getMissionReference()) {
            return common.ItemType.MISSION;
        }
        return common.ItemType.NONE;
    };
    /**
     * For reference string types, returns the name of the category of items it references
     * @returns {String}
     */
    Type.prototype.getReferenceItemCategory = function () {
        return this._descriptor.resourceReference || this._descriptor.classReference || this._descriptor.environmentReference || this._descriptor.missionReference;
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
     * @param {Boolean} [allowNull=false] 
     * @param {Object} [dataParent] The parent object of the property with this type 
     * @param {Object} [dataTopParent] The top level parent object of the property with this type 
     * @param {String} [itemName] The name of the editor item this property belongs to
     * @returns {String[]}
     */
    Type.prototype.getValues = function (allowNull, dataParent, dataTopParent, itemName) {
        var values;
        if (this._descriptor.values) {
            values = utils.getEnumValues(this._descriptor.values);
            return (typeof values[0] === "number") ? utils.getEnumKeys(this._descriptor.values) : values;
        }
        if (this._descriptor.getValues) {
            return this._descriptor.getValues(dataParent, dataTopParent, itemName);
        }
        if (this._descriptor.resourceReference) {
            return resources.getResourceNames(this._descriptor.resourceReference);
        }
        if (this._descriptor.classReference) {
            return classes.getClassNames(this._descriptor.classReference);
        }
        if (this._descriptor.environmentReference) {
            return environments.getEnvironmentNames();
        }
        if (this._descriptor.missionReference) {
            return missions.getMissionNames();
        }
        if (allowNull) {
            return null;
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
     * @param {Object} topParent
     * @param {String} itemName
     * @returns {String[]}
     */
    function getPropertyValues(propertyDescriptor, parent, topParent, itemName) {
        var values = new Type(propertyDescriptor.type).getValues(false, parent, topParent, itemName);
        // an object cannot reference itself (e.g. a fighter class cannot be based on itself)
        if (parent && (propertyDescriptor.name === BASED_ON_PROPERTY_NAME)) {
            // the original array is the list of available classes from the class manager
            // we do not want to modify that, or we make the removed class unlisted
            values = values.slice();
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
    missions.executeWhenReady(function () {
        TIPS_SET.values = missions.getTipIDs();
    });
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        BaseType: BaseType,
        Unit: Unit,
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
            "missileClasses": MISSILE_CLASS,
            "weaponClasses": WEAPON_CLASS,
            "propulsionClasses": PROPULSION_CLASS,
            "sensorsClasses": SENSORS_CLASS,
            "jumpEngineClasses": JUMP_ENGINE_CLASS,
            "shieldClasses": SHIELD_CLASS,
            "spacecraftTypes": SPACECRAFT_TYPE,
            "spacecraftClasses": SPACECRAFT_CLASS,
            "environments": ENVIRONMENT,
            "missions": MISSION
        },
        Type: Type,
        getPropertyValues: getPropertyValues
    };
});