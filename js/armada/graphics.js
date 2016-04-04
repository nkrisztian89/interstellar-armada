/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides functionality to parse and load the graphics settings of Interstellar Armada from an external file as well as to save them
 * to or load from HTML5 local storage and access derived settings.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, parseFloat, window, localStorage, screen */

/**
 * @param types Used for type checking JSON settings and set values
 * @param application Using the application module for error displaying functionality
 * @param asyncResource GraphicsContext is an AsynchResource subclass
 * @param managedGL Used for checking valid texture filtering values
 * @param resources Used to provide resource accessor functions that access resources through this module but add parameters based on current graphics context settings
 * @param budaScene The graphics context creates and stores a default LODContext
 * @param constants Used to access common game constants
 */
define([
    "utils/types",
    "modules/application",
    "modules/async-resource",
    "modules/managed-gl",
    "modules/graphics-resources",
    "modules/buda-scene",
    "armada/constants",
    "utils/polyfill"
], function (types, application, asyncResource, managedGL, resources, budaScene, constants) {
    "use strict";
    var
            // --------------------------------------------------------------------------------------------
            // Constants
            /**
             * All location IDs where setting values are stored in local storage are prefixed by this value.
             * @type String
             */
            MODULE_LOCAL_STORAGE_PREFIX = constants.LOCAL_STORAGE_PREFIX + "graphics_",
            // ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
            // Configuration
            // ............................................................................................
            // Texture quality
            /**
             * The definition object for texture quality descriptors, based on which the array of descriptors defined in the config JSON
             * is type-verified.
             * @type Object
             */
            TEXTURE_QUALITY_DESCRIPTOR_TYPE = types.getNameAndValueDefinitionObject("maximumResolution"),
            // ............................................................................................
            // Model LOD
            /**
             * The definition object for model LOD descriptors, based on which the array of descriptors defined in the config JSON
             * is type-verified.
             * @type Object
             */
            LOD_LEVEL_DESCRIPTOR_TYPE = types.getNameAndValueDefinitionObject("lod"),
            // ............................................................................................
            // Shader complexity
            /**
             * The definition object for dependent shader requirement descriptors. A dependent shader requirement descriptor describes
             * shader requirements (e.g. required amount of varying vectors or texture units) that depend on values set by the game (through
             * replacing the original value in #define statements in the shader source). This basically means requirements coming from 
             * array variables (uniforms, attributes or varyings), that have an array length dependent on game variables.
             * The properties of such a descriptor refer to different variables the requirement depends on, and the values of the properties
             * give the coefficient for the dependency. Example dependent requirement descriptor:
             * "requiredVaryingsPer": {
             *   "dirLight": 2,
             *   "luminosityFactor": 3
             * }
             * This would describe that 2 varying vectors should be added to the requirements for each directional light source and 3 for 
             * each available luminosity factor index.
             * @type Object
             */
            DEPENDENT_SHADER_REQUIREMENT_DESCRIPTOR_TYPE = {
                baseType: "object",
                properties: {
                    /**
                     * Number of required vectors to be added for each available luminosity factor index.
                     */
                    LUMINOSITY_FACTOR: {
                        name: "luminosityFactor",
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * Number of required vectors to be added for each available directional light source.
                     */
                    DIR_LIGHT: {
                        name: "dirLight",
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * Number of required vectors to be added for each available point light source.
                     */
                    POINT_LIGHT: {
                        name: "pointLight",
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * Number of required vectors to be added for each available spot light source.
                     */
                    SPOT_LIGHT: {
                        name: "spotLight",
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * Number of required vectors to be added for each available shadow map texture.
                     */
                    SHADOW_MAP: {
                        name: "shadowMap",
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * Number of required vectors to be added for each available shadow map range.
                     */
                    SHADOW_MAP_RANGE: {
                        name: "shadowMapRange",
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * Number of required vectors to be added for each available shadow map sample. (for PCF)
                     */
                    SHADOW_MAP_SAMPLE: {
                        name: "shadowMapSample",
                        type: "number",
                        defaultValue: 0
                    }
                }
            },
    /**
     * A shortcut to access the dependent shader requirement property definition objects.
     * @type Object
     */
    DEPENDENT_SHADER_REQUIREMENT_PROPERTIES = DEPENDENT_SHADER_REQUIREMENT_DESCRIPTOR_TYPE.properties,
            /**
             * A shader requirement descriptor has a property with this name to define the number of (static) required vertex uniform vectors.
             * @type String
             */
            REQ_VERTEX_UNIFORMS_PROP_NAME = "requiredVertexUniformVectors",
            /**
             * A shader requirement descriptor has a property with this name to define the required dependent vertex uniform vectors.
             * (in a dependent shader requirement descriptor)
             * @type String
             */
            REQ_VERTEX_UNIFORMS_PER_PROP_NAME = "requiredVertexUniformVectorsPer",
            REQ_ATTRIBUTES_PROP_NAME = "requiredAttributeVectors",
            REQ_ATTRIBUTES_PER_PROP_NAME = "requiredAttributeVectorsPer",
            REQ_VARYINGS_PROP_NAME = "requiredVaryingVectors",
            REQ_VARYINGS_PER_PROP_NAME = "requiredVaryingVectorsPer",
            REQ_TEXTURE_UNITS_PROP_NAME = "requiredTextureUnits",
            REQ_TEXTURE_UNITS_PER_PROP_NAME = "requiredTextureUnitsPer",
            REQ_FRAGMENT_UNIFORMS_PROP_NAME = "requiredFragmentUniformVectors",
            REQ_FRAGMENT_UNIFORMS_PER_PROP_NAME = "requiredFragmentUniformVectorsPer",
            /**
             * The definition object used to type-verify shader requirements descriptors. A shader requirements descriptor contains all
             * static and dependent requirements of a shader from which the actual requirements can be calculated for any given combination
             * of game variable values (upon which the requirements might depend).
             * @type Object
             */
            SHADER_REQUIREMENTS_DESCRIPTOR_TYPE = {
                baseType: "object",
                properties: {
                    /**
                     * The number of static required vertex shader uniform vectors needed to compile this shader.
                     */
                    VERTEX_UNIFORM_VECTORS: {
                        name: REQ_VERTEX_UNIFORMS_PROP_NAME,
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * The dependent requirement descriptor defining the number of required dependent vertex shader uniform vectors for each 
                     * game variable they depend upon.
                     */
                    VERTEX_UNIFORM_VECTORS_PER: {
                        name: REQ_VERTEX_UNIFORMS_PER_PROP_NAME,
                        type: DEPENDENT_SHADER_REQUIREMENT_DESCRIPTOR_TYPE,
                        defaultValue: {}
                    },
                    /**
                     * The number of static required attribute vectors needed to compile this shader.
                     */
                    ATTRIBUTE_VECTORS: {
                        name: REQ_ATTRIBUTES_PROP_NAME,
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * The dependent requirement descriptor defining the number of required dependent attribute vectors for each game
                     * variable they depend upon.
                     */
                    ATTRIBUTE_VECTORS_PER: {
                        name: REQ_ATTRIBUTES_PER_PROP_NAME,
                        type: DEPENDENT_SHADER_REQUIREMENT_DESCRIPTOR_TYPE,
                        defaultValue: {}
                    },
                    /**
                     * The number of static required varying vectors needed to compile this shader.
                     */
                    VARYING_VECTORS: {
                        name: REQ_VARYINGS_PROP_NAME,
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * The dependent requirement descriptor defining the number of required dependent varying vectors for each game
                     * variable they depend upon.
                     */
                    VARYING_VECTORS_PER: {
                        name: REQ_VARYINGS_PER_PROP_NAME,
                        type: DEPENDENT_SHADER_REQUIREMENT_DESCRIPTOR_TYPE,
                        defaultValue: {}
                    },
                    /**
                     * The number of static required texture units (for the fragment shader) needed to compile this shader.
                     */
                    TEXTURE_UNITS: {
                        name: REQ_TEXTURE_UNITS_PROP_NAME,
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * The dependent requirement descriptor defining the number of required dependent texture units (for the fragment shader) 
                     * for each game variable they depend upon.
                     */
                    TEXTURE_UNITS_PER: {
                        name: REQ_TEXTURE_UNITS_PER_PROP_NAME,
                        type: DEPENDENT_SHADER_REQUIREMENT_DESCRIPTOR_TYPE,
                        defaultValue: {}
                    },
                    /**
                     * The number of static required fragment shader uniform vectors needed to compile this shader.
                     */
                    FRAGMENT_UNIFORM_VECTORS: {
                        name: REQ_FRAGMENT_UNIFORMS_PROP_NAME,
                        type: "number",
                        defaultValue: 0
                    },
                    /**
                     * The dependent requirement descriptor defining the number of required dependent fragment shader uniform vectors for each 
                     * game variable they depend upon.
                     */
                    FRAGMENT_UNIFORM_VECTORS_PER: {
                        name: REQ_FRAGMENT_UNIFORMS_PER_PROP_NAME,
                        type: DEPENDENT_SHADER_REQUIREMENT_DESCRIPTOR_TYPE,
                        defaultValue: {}
                    }
                }
            },
    /**
     * A constant defining the structure of shader descriptor object, used to verify the shader complexity descriptors read from JSON.
     * @type Object
     */
    SHADER_COMPLEXITY_DESCRIPTOR_TYPE = {
        baseType: "object",
        properties: {
            /**
             * Identifies this shader complexity level.
             */
            NAME: {
                name: "name",
                type: "string"
            },
            /**
             * Whether shadow mapping is available to turn on when this shader complexity level is used.
             */
            SHADOW_MAPPING_AVAILABLE: {
                name: "shadows",
                type: "boolean"
            },
            /**
             * The number of samples to be used for shadow mapping PCF when this shader complexity is used.
             */
            NUM_SHADOW_MAP_SAMPLES: {
                name: "numShadowMapSamples",
                type: "number",
                defaultValue: 0
            },
            /**
             * Whether dynamic lights are available to turn on when this shader complexity level is used.
             */
            DYNAMIC_LIGHTS_AVAILABLE: {
                name: "dynamicLights",
                type: "boolean"
            },
            /**
             * The number of maximum available directional light sources when this shader complexity is used.
             */
            MAX_DIR_LIGHTS: {
                name: "maxDirLights",
                type: "number"
            },
            /**
             * The number of maximum available spot light sources (for dynamic lighting) when this shader complexity is used.
             */
            MAX_SPOT_LIGHTS: {
                name: "maxSpotLights",
                type: "number",
                defaultValue: 0
            },
            /**
             * Whether luminosity textures are available when this shader complexity level is used.
             */
            LUMINOSITY_TEXTURES_AVAILABLE: {
                name: "luminosityTextures",
                type: "boolean"
            },
            /**
             * Whether the reveal feature is available when this shader complexity level is used.
             */
            REVEAL_AVAILABLE: {
                name: "reveal",
                type: "boolean"
            },
            /**
             * The object describing the base requirements of this shader complexity level (without any of the features (shadow mapping, 
             * dynamic lights...) being turned on.
             */
            REQUIREMENTS: {
                name: "requirements",
                type: SHADER_REQUIREMENTS_DESCRIPTOR_TYPE
            }
        }
    },
    /**
     * A shortcut to access the shader complexity property definition objects.
     * @type Object
     */
    SHADER_COMPLEXITY_PROPERTIES = SHADER_COMPLEXITY_DESCRIPTOR_TYPE.properties,
            /**
             * The array of shader complexity descriptors will be read from the property with this name in the shader settings JSON.
             * @type String
             */
            SHADER_COMPLEXITIES_PROPERTY_NAME = "complexities",
            /**
             * Describes the structure of the shader configuration descriptor object read from the configuration JSON file.
             * @type Object
             */
            SHADER_CONFIG = {
                /**
                 * The shader requirements that should be added on top of the base requirement of the selected shader complexity level when
                 * the various features are turned on.
                 */
                FEATURE_REQUIREMENTS: {
                    name: "featureRequirements",
                    type: "object",
                    properties: {
                        /**
                         * Requirements to be added when shadow mapping is turned on.
                         */
                        SHADOWS: {
                            name: "shadows",
                            type: SHADER_REQUIREMENTS_DESCRIPTOR_TYPE
                        },
                        /**
                         * Requirements to be added when dynamic lights are turned on.
                         */
                        DYNAMIC_LIGHTS: {
                            name: "dynamicLights",
                            type: SHADER_REQUIREMENTS_DESCRIPTOR_TYPE
                        },
                        /**
                         * Requirements to be added when reveal is turned on (which automatically happens when it is available)
                         */
                        REVEAL: {
                            name: "reveal",
                            type: SHADER_REQUIREMENTS_DESCRIPTOR_TYPE
                        }
                    }
                },
                /**
                 * The array storing the descriptors for the available shader complexities, from the least complex to the most complex.
                 */
                COMPLEXITIES: {
                    name: SHADER_COMPLEXITIES_PROPERTY_NAME,
                    type: "array",
                    elementType: SHADER_COMPLEXITY_DESCRIPTOR_TYPE,
                    minLength: 1
                },
                /**
                 * Name of the shader that should be used when rendering the shadow maps.
                 */
                SHADOW_MAPPING_SHADER_NAME: {
                    name: "shadowMappingShaderName",
                    type: "string"
                },
                /**
                 * Name of the #define that determines the maximum number of directional lights in shaders.
                 */
                MAX_DIR_LIGHTS_DEFINE_NAME: {
                    name: "maxDirLightsDefineName",
                    type: "string"
                },
                /**
                 * The name of the #define that determines the maximum number of dynamic point lights in shaders.
                 */
                MAX_POINT_LIGHTS_DEFINE_NAME: {
                    name: "maxPointLightsDefineName",
                    type: "string"
                },
                /**
                 * The name of the #define that determines the maximum number of dynamic spot lights in shaders.
                 * @type String
                 */
                MAX_SPOT_LIGHTS_DEFINE_NAME: {
                    name: "maxSpotLightsDefineName",
                    type: "string"
                },
                /**
                 * The divisor of the dust particle length in shaders. The original value defined in the shader is replaced by this value, 
                 * and since it has to be strictly given in floating point format for the shader to compile, it is defined as a string here.
                 */
                DUST_LENGTH_DIVISOR: {
                    name: "dustLengthDivisor",
                    type: "string"
                },
                /**
                 * The name of the #define that determines the divisor by which the length of dust particles is divided.
                 */
                DUST_LENGTH_DIVISOR_DEFINE_NAME: {
                    name: "dustLengthDivisorDefineName",
                    type: "string"
                },
                /**
                 * The maximum amount of luminosity factors (length of the respective uniform variable) available to shaders.
                 */
                MAX_LUMINOSITY_FACTORS: {
                    name: "maxLuminosityFactors",
                    type: "number"
                },
                /**
                 * The name of the #define that determines the maximum amount of luminosity factors available to shaders.
                 */
                MAX_LUMINOSITY_FACTORS_DEFINE_NAME: {
                    name: "maxLuminosityFactorsDefineName",
                    type: "string"
                },
                /**
                 * The name of the #define that determines the maximum number of available shadow map ranges (for each directional light 
                 * source) in shaders.
                 */
                MAX_SHADOW_MAP_RANGES_DEFINE_NAME: {
                    name: "maxShadowMapRangesDefineName",
                    type: "string"
                },
                /**
                 * The name of the #define that determines the maximum number of available shadow maps (which will be set to maximum number
                 * of light sources * maximum number of shadow map ranges) in shaders.
                 */
                MAX_SHADOW_MAPS_DEFINE_NAME: {
                    name: "maxShadowMapsDefineName",
                    type: "string"
                },
                /**
                 * The name of the #define that determines how many samples of shadow maps should be taken and averaged to determine how
                 * much a certain point is in shadow. (PCF)
                 */
                NUM_SHADOW_MAP_SAMPLES_DEFINE_NAME: {
                    name: "numShadowMapSamplesDefineName",
                    type: "string"
                }
            },
    /**
     * A shortcut to access the shader feature requirements property definition objects.
     * @type Object
     */
    FEATURE_REQUIREMENTS_PROPERTIES = SHADER_CONFIG.FEATURE_REQUIREMENTS.properties,
            // ............................................................................................
            // Shadow distance (number of used shadow map ranges)
            /**
             * The definition object for shadow distance descriptors, based on which the array of descriptors defined in the config JSON
             * is type-verified.
             * @type Object
             */
            SHADOW_DISTANCE_DESCRIPTOR_TYPE = types.getNameAndValueDefinitionObject("numRanges"),
            // ............................................................................................
            // Amount of dynamic (point) lights
            /**
             * The definition object for dynamic light amount descriptors, based on which the array of descriptors defined in the config JSON
             * is type-verified.
             * @type Object
             */
            DYNAMIC_LIGHT_AMOUNT_DESCRIPTOR_TYPE = types.getNameAndValueDefinitionObject("maxLights"),
            // ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
            // Settings
            // ............................................................................................
            // Antialiasing
            /**
             * The key identifying the location where the antialiasing setting is stored in local storage.
             * @type String
             */
            ANTIALIASING_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "antialiasing",
            // ............................................................................................
            // Texture filtering
            /**
             * The key identifying the location where the texture filtering setting is stored in local storage.
             * @type String
             */
            FILTERING_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "filtering",
            /**
             * If the texture filtering setting loaded from file or local storage specifies anisotropic filtering, but it is not supported
             * by the hardware, this filtering mode will be used instead.
             * @type String
             */
            ANISOTROPIC_FALLBACK_FILTERING = managedGL.TextureFiltering.TRILINEAR,
            // ............................................................................................
            // Texture quality
            /**
             * The key identifying the location where the texture quality setting is stored in local storage.
             * @type String
             */
            TEXTURE_QUALITY_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "textureQuality",
            // ............................................................................................
            // Cubemap quality
            /**
             * The key identifying the location where the cubemap quality setting is stored in local storage.
             * @type String
             */
            CUBEMAP_QUALITY_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "cubemapQuality",
            // ............................................................................................
            // Model LOD
            /**
             * The key identifying the location where the highest displayed model LOD setting is stored in local storage.
             * @type String
             */
            MAX_LOD_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "maxLOD",
            // ............................................................................................
            // Shader complexity
            /**
             * The key identifying the location where the shader complexity level setting is stored in local storage.
             * @type String
             */
            SHADER_COMPLEXITY_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "shaderComplexity",
            // ............................................................................................
            // Shadow mapping
            /**
             * The key identifying the location where the shader mapping setting (whether shadow mapping is enabled) is stored in local 
             * storage.
             * @type String
             */
            SHADOW_MAPPING_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "shadowMapping",
            // ............................................................................................
            // Shadow map quality (texture size)
            /**
             * The key identifying the location where the shader map quality setting is stored in local storage.
             * @type String
             */
            SHADOW_MAP_QUALITY_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "shadowQuality",
            // ............................................................................................
            // Shadow distance (number of used shadow map ranges)
            /**
             * The key identifying the location where the shader distance setting is stored in local storage.
             * @type String
             */
            SHADOW_DISTANCE_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "shadowDistance",
            // ............................................................................................
            // Amount of dynamic (point) lights
            /**
             * The key identifying the location where the point light amount setting is stored in local storage.
             * @type String
             */
            POINT_LIGHT_AMOUNT_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "pointLightAmount",
            // ............................................................................................
            /**
             * Shaders that implement the same function but without shadows should be referenced among the variant shaders with this type key
             * @type String
             */
            SHADER_VARIANT_WITHOUT_SHADOWS_NAME = "withoutShadows",
            /**
             * Shaders that implement the same function but without dynamic lights should be referenced among the variant shaders with this type key
             * @type String
             */
            SHADER_VARIANT_WITHOUT_DYNAMIC_LIGHTS_NAME = "withoutDynamicLights",
            /**
             * Stores a default context the methods of which are exposed in the interface of this module.
             * @type GraphicsContext
             */
            _context;
    // --------------------------------------------------------------------------------------------
    // Private functions dealing with shader requirements
    /**
     * Calculates and returns a shader requirement (such as number of required varying vectors) that depend on game variables uring the
     * supplied values of those game variables.
     * @param {Object} dependentRequirementDescriptor An object describing the dependencies of this requirement. The structure of this 
     * object is defined in DEPENDENT_SHADER_REQUIREMENT_DESCRIPTOR_TYPE. Example: {"dirLight": 2} -> 2 units (e.g. varying vectors) of this 
     * requirement should be added for each available directional light source. 
     * Has to include all the possible dependencies as properties (even if 0).
     * @param {Object} params Has to contain the values for the game variables that the requirement depends upon. Example: {"dirLight": 4}
     * would mean that the game has currently 4 directional light sources available. Should have the same structure as the other parameter.
     * @returns {Number}
     */
    function _getDependentShaderRequirement(dependentRequirementDescriptor, params) {
        var propertyDescriptorName, propertyDescriptor, result = 0;
        for (propertyDescriptorName in DEPENDENT_SHADER_REQUIREMENT_PROPERTIES) {
            if (DEPENDENT_SHADER_REQUIREMENT_PROPERTIES.hasOwnProperty(propertyDescriptorName)) {
                propertyDescriptor = DEPENDENT_SHADER_REQUIREMENT_PROPERTIES[propertyDescriptorName];
                if (params.hasOwnProperty(propertyDescriptor.name)) {
                    result += dependentRequirementDescriptor[propertyDescriptor.name] * params[propertyDescriptor.name];
                }
            }
        }
        return result;
    }
    /**
     * Returns a valid shader requirements object containing the actual shader requirements for a particular set of game variable values, by 
     * adding up the static requirements and the dependent requirements described in a requirements descriptor object.
     * @param {Object} requirementsDescriptor An object describing all static and and dependent requirements (for a certain shader 
     * complexity level or shader feature) in a structure defined by SHADER_REQUIREMENTS_DESCRIPTOR_TYPE.
     * @param {Object} params An object describing the current values of game variables that the requirements might depend upon, in a 
     * structure defined by DEPENDENT_SHADER_REQUIREMENT_DESCRIPTOR_TYPE.
     * @returns {ManagedShader~ShaderRequirements}
     */
    function _getShaderRequirementsFromDescriptor(requirementsDescriptor, params) {
        return {
            requiredVertexUniformVectors:
                    requirementsDescriptor[REQ_VERTEX_UNIFORMS_PROP_NAME] +
                    _getDependentShaderRequirement(requirementsDescriptor[REQ_VERTEX_UNIFORMS_PER_PROP_NAME], params),
            requiredAttributeVectors:
                    requirementsDescriptor[REQ_ATTRIBUTES_PROP_NAME] +
                    _getDependentShaderRequirement(requirementsDescriptor[REQ_ATTRIBUTES_PER_PROP_NAME], params),
            requiredVaryingVectors:
                    requirementsDescriptor[REQ_VARYINGS_PROP_NAME] +
                    _getDependentShaderRequirement(requirementsDescriptor[REQ_VARYINGS_PER_PROP_NAME], params),
            requiredTextureUnits:
                    requirementsDescriptor[REQ_TEXTURE_UNITS_PROP_NAME] +
                    _getDependentShaderRequirement(requirementsDescriptor[REQ_TEXTURE_UNITS_PER_PROP_NAME], params),
            requiredFragmentUniformVectors:
                    requirementsDescriptor[REQ_FRAGMENT_UNIFORMS_PROP_NAME] +
                    _getDependentShaderRequirement(requirementsDescriptor[REQ_FRAGMENT_UNIFORMS_PER_PROP_NAME], params)
        };
    }
    /**
     * Adds up two sets of shader requirements and returns the resulting combined requirement set.
     * @param {ManagedShader~ShaderRequirements} r
     * @param {ManagedShader~ShaderRequirements} s
     * @returns {ManagedShader~ShaderRequirements}
     */
    function _getCombinedRequirements(r, s) {
        return {
            requiredVertexUniformVectors: r.requiredVertexUniformVectors + s.requiredVertexUniformVectors,
            requiredAttributeVectors: r.requiredAttributeVectors + s.requiredAttributeVectors,
            requiredVaryingVectors: r.requiredVaryingVectors + s.requiredVaryingVectors,
            requiredTextureUnits: r.requiredTextureUnits + s.requiredTextureUnits,
            requiredFragmentUniformVectors: r.requiredFragmentUniformVectors + s.requiredFragmentUniformVectors
        };
    }
    // ############################################################################################
    /**
     * @class 
     * Handles a set of options that have a numeric value as well as a name (a string ID) and the values have a meaningful order.
     * @param {Array} list The array of objects that contain the names and values of the different options.
     * @param {Object} optionDescriptorType The object that describes the structure of one element in the passed array, with a NAME 
     * property that gives the name of the property containing the name (string ID) of the option and a VALUE property that gives the name
     * property containing the value of the option. The format of this option is the same as the definition objects used by types.js.
     * (example: {NAME: {name: "name", type: "string"}, VALUE: {name: "numericValue", type: "number"}})
     * @param {String} [name] Identification of what these options stand for. Used in error messages in case the provided list does not pass
     * type verification.
     * @param {Number} [limit] If given, options (the numeric value of which) pass this limit will not be included from the passed list.
     */
    function OrderedNamedNumericOptions(list, optionDescriptorType, name, limit) {
        /**
         * The array of object storing the name-value pairs of the options.
         * @type Array
         */
        this._list = list ? types.getArrayValue(
                name || "OrderedNamedNumericOptions.list",
                list,
                optionDescriptorType,
                null,
                {minLength: 1},
                []) : [];
        /**
         * The name of the property which contains the name of the option in the elements of the stored list.
         * @type String
         */
        this._optionNamePropertyName = optionDescriptorType ? optionDescriptorType.properties.NAME.name : null;
        /**
         * The name of the property which contains the numeric value of the option in the elements of the stored list.
         * @type String
         */
        this._optionValuePropertyName = optionDescriptorType ? optionDescriptorType.properties.VALUE.name : null;
        this._list.sort(function (a, b) {
            return a[this._optionValuePropertyName] - b[this._optionValuePropertyName];
        }.bind(this));
        /**
         * The currently selected option in the list.
         * @type Number
         */
        this._currentIndex = this._list.length - 1;
        if (limit) {
            this.applyLimit(limit);
        }
    }
    /**
     * Use this on one element of the stored list to retrieve its name.
     * @param {Object} element
     * @returns {String}
     */
    OrderedNamedNumericOptions.prototype._getNameFunction = function (element) {
        return element[this._optionNamePropertyName];
    };
    /**
     * Use this on one element of the stored list to check whether its name equals the passed value.
     * @param {String} name
     * @param {Object} element
     * @returns {Boolean}
     */
    OrderedNamedNumericOptions.prototype._checkNameFunction = function (name, element) {
        return element[this._optionNamePropertyName] === name;
    };
    /**
     * Use this on one element of the stored list to check whether its numeric value is within the passed limit.
     * @param {Number} limit
     * @param {Object} element
     * @returns {Boolean}
     */
    OrderedNamedNumericOptions.prototype._isWithinLimitFunction = function (limit, element) {
        return element[this._optionValuePropertyName] <= limit;
    };
    /**
     * @typedef {Function} OrderedNamedNumericOptions~valueFilterFunction
     * @param {Number} value
     * @returns {Boolean}
     */
    /**
     * Use this on one element of the stored list to filter it using a supplied filter function that will receive the numeric value of the
     * element.
     * @param {OrderedNamedNumericOptions~valueFilterFunction} valueFilterFunction
     * @param {Object} element
     * @returns {Boolean}
     */
    OrderedNamedNumericOptions.prototype._valueFilterFunction = function (valueFilterFunction, element) {
        return valueFilterFunction(element[this._optionValuePropertyName]);
    };
    /**
     * Returns an error message explaining that a non-existent option name was specified.
     * @param {String} name The name by which an option was attempted to be accessed. (and which is not in the list)
     * @returns {String}
     */
    OrderedNamedNumericOptions.prototype._getInvalidOptionAccessErrorMessage = function (name) {
        return "Invalid option (" + this._optionValuePropertyName + ") '" + name + "' specified! Valid values are: " + this.getNameList().join(", ") + ".";
    };
    /**
     * Return an array containing the names of all the stored options in order.
     * @returns {Array}
     */
    OrderedNamedNumericOptions.prototype.getNameList = function () {
        return this._list.map(this._getNameFunction.bind(this));
    };
    /**
     * Returns an array containing the names of the stored options that pass the given numeric filter function.
     * @param {OrderedNamedNumericOptions~valueFilterFunction} valueFilterFunction
     * @returns {Array}
     */
    OrderedNamedNumericOptions.prototype.getFilteredNameList = function (valueFilterFunction) {
        return this._list.filter(this._valueFilterFunction.bind(this, valueFilterFunction)).map(this._getNameFunction.bind(this));
    };
    /**
     * Selects the option from the stored list that is identified by the passed name and remembers the selection.
     * @param {String} name The name of the option to be selected.
     * @param {Boolean} [fallbackToHighest=false] If true, then in case there is no option in the list with the given name, instead of 
     * showing an error message, the last option (the one with the highest numeric value) will be selected.
     * @returns {Boolean} Whether a valid option was be selected.
     */
    OrderedNamedNumericOptions.prototype.setCurrent = function (name, fallbackToHighest) {
        this._currentIndex = this._list.findIndex(this._checkNameFunction.bind(this, name));
        if ((this._currentIndex < 0) && fallbackToHighest) {
            this._currentIndex = this._list.length - 1;
        }
        if (this._currentIndex < 0) {
            application.showError(this._getInvalidOptionAccessErrorMessage(name));
            return false;
        }
        return true;
    };
    /**
     * Returns the name of the currently selected option.
     * @returns {String|null}
     */
    OrderedNamedNumericOptions.prototype.getCurrentName = function () {
        return this._currentIndex >= 0 ? this._list[this._currentIndex][this._optionNamePropertyName] : null;
    };
    /**
     * Returns the numeric value of the currently selected option.
     * @returns {Number|null}
     */
    OrderedNamedNumericOptions.prototype.getCurrentValue = function () {
        return this._currentIndex >= 0 ? this._list[this._currentIndex][this._optionValuePropertyName] : 0;
    };
    /**
     * Returns the numeric value that belongs to the option with the passed name.
     * @param {String} name
     * @returns {Number}
     */
    OrderedNamedNumericOptions.prototype.getValueForName = function (name) {
        var index = this._list.findIndex(this._checkNameFunction.bind(this, name));
        if (index >= 0) {
            return this._list[index][this._optionValuePropertyName];
        }
        application.showError(this._getInvalidOptionAccessErrorMessage(name));
        return 0;
    };
    /**
     * Removes the options from the stored list the numeric value of which surpass the given limit. If the currently selected option is
     * removed, the last (highest) option will be selected instead.
     * @param {Number} limit
     */
    OrderedNamedNumericOptions.prototype.applyLimit = function (limit) {
        var originalName = this.getCurrentName();
        this._list = this._list.filter(this._isWithinLimitFunction.bind(this, limit));
        if (this._currentIndex >= this._list.length) {
            this._currentIndex = this._list.length - 1;
            application.log("Setting (" + this._optionValuePropertyName + ") changed to '" + this.getCurrentName() + "' from '" + originalName + "' as a result of limiting the setting to " + limit + ".", 1);
        }
    };
    /**
     * Selects the option right before the currently selected option, if possible.
     * @returns {Boolean} Whether a lower option could be selected.
     */
    OrderedNamedNumericOptions.prototype.decrease = function () {
        if (this._currentIndex > 0) {
            this._currentIndex--;
            return true;
        }
        return false;
    };
    /**
     * Returns the numeric value of the first (lowest) option in the stored list.
     * @returns {Number}
     */
    OrderedNamedNumericOptions.prototype.getFirstValue = function () {
        return this._list[0][this._optionValuePropertyName];
    };
    // ############################################################################################
    /**
     * @class 
     * Handles a list of possible texture qualities, storing an identifying name and the maximum texture
     * resolution for each quality level.
     * @extends OrderedNumbericOptions
     * @param {Array} list See OrderedNamedNumericOptions.
     * @param {String} [name] See OrderedNamedNumericOptions.
     * @param {Number} [maxResolution] An initial limit on the maximum resolution to be applied. Quality levels
     * with a maximum resolution higher than this will not be included in the stored list.
     */
    function TextureQuality(list, name, maxResolution) {
        OrderedNamedNumericOptions.call(this, list, TEXTURE_QUALITY_DESCRIPTOR_TYPE, name, maxResolution);
        /**
         * An array storing the quality levels in the (descending) order of preference for when choosing the most fitting quality level of
         * a given texture (which might not be available in the exact quality level that is selected)
         * Currently, this will start with the selected quality level, then contain all lower quality levels in descending order and finally
         * all higher quality levels in ascending order.
         * @type Array
         */
        this._preferenceList = null;
        this._updatePreferenceList();
    }
    TextureQuality.prototype = new OrderedNamedNumericOptions();
    TextureQuality.prototype.constructor = TextureQuality;
    /**
     * Generates and stores a new preference list based on the currently selected quality.
     */
    TextureQuality.prototype._updatePreferenceList = function () {
        var i;
        this._preferenceList = [];
        for (i = this._currentIndex; i >= 0; i--) {
            this._preferenceList.push(this._list[i]);
        }
        for (i = this._currentIndex + 1; i < this._list.length; i++) {
            this._preferenceList.push(this._list[i]);
        }
    };
    /**
     * @override
     * @param {String} name
     * @param {Boolean} [fallbackToHighest=false]
     * @returns {Boolean}
     */
    TextureQuality.prototype.setCurrent = function (name, fallbackToHighest) {
        var result;
        result = OrderedNamedNumericOptions.prototype.setCurrent.call(this, name, fallbackToHighest);
        this._updatePreferenceList();
        return result;
    };
    /**
     * Returns the names of the stored texture quality levels in the order of preference (to choose the most fitting texture quality for a
     * texture that is not available in the exact selected quality)
     * @returns {Array}
     */
    TextureQuality.prototype.getPreferenceNameList = function () {
        return this._preferenceList.map(this._getNameFunction.bind(this));
    };
    /**
     * @override
     * @param {Number} limit
     */
    TextureQuality.prototype.applyLimit = function (limit) {
        OrderedNamedNumericOptions.prototype.applyLimit.call(this, limit);
        this._updatePreferenceList();
    };
    // ############################################################################################
    /**
     * @class Can load, store, save, and modify a set of graphics settings and provide their current values
     * for other game modules.
     * @extends AsyncResource
     */
    function GraphicsContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * The JSON object storing the default graphics settings.
         * @type Object
         */
        this._dataJSON = null;
        /**
         * The current antialiasing setting.
         * @type Boolean
         */
        this._antialiasing = false;
        /**
         * (enum managedGL.TextureFiltering) The current texture filtering setting.
         * @type String
         */
        this._filtering = null;
        /**
         * The available and current model LOD levels.
         * @type OrderedNamedNumericOptions
         */
        this._lodLevel = null;
        /**
         * The maximum level of detail for which the model files should be loaded.
         * @type Number
         */
        this._maxLoadedLOD = 0;
        /**
         * The currently active LOD context.
         * @type LODContext
         */
        this._lodContext = null;
        /**
         * The currently set and available texture qualities.
         * @type TextureQuality
         */
        this._textureQuality = null;
        /**
         * The currently set and available cubemap qualities.
         * @type TextureQuality
         */
        this._cubemapQuality = null;
        /**
         * Whether shadow mapping is currently enabled.
         * @type Boolean
         */
        this._shadowMappingEnabled = false;
        /**
         * The currently set and available shadow map texture qualities.
         * @type TextureQuality
         */
        this._shadowMapQuality = null;
        /**
         * The list of ranges (distance from center to the sides, in game world
         * space coordinates) that the shadow maps generated for one light source
         * should cover. Must be in ascending order.
         * @type Number[]
         */
        this._shadowRanges = null;
        /**
         * The available and currently set shadow distance levels (governing how many shadow map ranges should be active)
         * @type OrderedNamedNumericOptions
         */
        this._shadowDistances = null;
        /**
         * The depth coverage of each shadow map should equal twice the range of the shadow map (as range refers to the distance from the
         * center to the sides) multiplied by this factor.
         * @type Number
         */
        this._shadowDepthRatio = 0;
        /**
         * The available and currently set maximum amount for dynamic point lights.
         * @type OrderedNamedNumericOptions
         */
        this._pointLightAmount = null;
        /**
         * An object storing all the configuration settings for this context (such as lists of valied values for the different options)
         * @type Object
         */
        this._shaderConfig = null;
        /**
         * The string ID of the currently selected shader complexity level.
         * @type String
         */
        this._shaderComplexity = null;
        /**
         * A cached value storing whether luminosity texture are available at the current shader complexity.
         * @type Boolean
         */
        this._luminosityTextureAreAvailable = false;
    }
    GraphicsContext.prototype = new asyncResource.AsyncResource();
    GraphicsContext.prototype.constructor = GraphicsContext;
    /**
     * @typedef {Object} GraphicsContext~CustomShaderRequirementsParams
     * @property {Number} [numPointLights]
     * @property {Number} [numShadowRanges]
     * @property {Number} [complexityLevelIndex]
     */
    /**
     * Returns the set of shader requirements valid for the current graphics settings stored in this context.
     * @param {GraphicsContext~CustomShaderRequirementsParams} [params] Certain game variable values to be taken into account when 
     * calculating the requirements dependent upon them can be overridden by the values provided in this parameter. An index for a 
     * different shader complexity than the currently selected one can also be provided here so that it will be taken as the base for
     * the requirements.
     * @returns {ManagedShader~ShaderRequirements}
     */
    GraphicsContext.prototype._getShaderRequirements = function (params) {
        params = params || {};
        var
                complexityDescriptor = this._getShaderComplexityDescriptor(params.complexityLevelIndex),
                featureRequirementsDescriptor = this.getShaderConfig(SHADER_CONFIG.FEATURE_REQUIREMENTS),
                numDirLights = complexityDescriptor[SHADER_COMPLEXITY_PROPERTIES.MAX_DIR_LIGHTS.name],
                numPointLights = (params.numPointLights === undefined) ? this.getMaxPointLights() : params.numPointLights,
                numSpotLights = (numPointLights > 0) ? complexityDescriptor[SHADER_COMPLEXITY_PROPERTIES.MAX_SPOT_LIGHTS.name] : 0,
                numShadowMapRanges = (params.numShadowRanges === undefined) ? this.getNumShadowMapRanges() : params.numShadowRanges,
                numShadowMaps = numDirLights * numShadowMapRanges,
                numShadowMapSamples = complexityDescriptor[SHADER_COMPLEXITY_PROPERTIES.NUM_SHADOW_MAP_SAMPLES.name],
                result,
                gameParams = {};
        gameParams[DEPENDENT_SHADER_REQUIREMENT_PROPERTIES.DIR_LIGHT.name] = numDirLights;
        gameParams[DEPENDENT_SHADER_REQUIREMENT_PROPERTIES.POINT_LIGHT.name] = numPointLights;
        gameParams[DEPENDENT_SHADER_REQUIREMENT_PROPERTIES.SPOT_LIGHT.name] = numSpotLights;
        gameParams[DEPENDENT_SHADER_REQUIREMENT_PROPERTIES.SHADOW_MAP.name] = numShadowMaps;
        gameParams[DEPENDENT_SHADER_REQUIREMENT_PROPERTIES.SHADOW_MAP_RANGE.name] = numShadowMapRanges;
        gameParams[DEPENDENT_SHADER_REQUIREMENT_PROPERTIES.SHADOW_MAP_SAMPLE.name] = numShadowMapSamples;
        gameParams[DEPENDENT_SHADER_REQUIREMENT_PROPERTIES.LUMINOSITY_FACTOR.name] = this.getShaderConfig(SHADER_CONFIG.MAX_LUMINOSITY_FACTORS);
        result = _getShaderRequirementsFromDescriptor(complexityDescriptor[SHADER_COMPLEXITY_PROPERTIES.REQUIREMENTS.name], gameParams);
        if (complexityDescriptor[SHADER_COMPLEXITY_PROPERTIES.SHADOW_MAPPING_AVAILABLE.name] && (numShadowMapRanges > 0)) {
            result = _getCombinedRequirements(result, _getShaderRequirementsFromDescriptor(
                    featureRequirementsDescriptor[FEATURE_REQUIREMENTS_PROPERTIES.SHADOWS.name],
                    gameParams));
        }
        if (complexityDescriptor[SHADER_COMPLEXITY_PROPERTIES.DYNAMIC_LIGHTS_AVAILABLE.name] && (numPointLights > 0)) {
            result = _getCombinedRequirements(result, _getShaderRequirementsFromDescriptor(
                    featureRequirementsDescriptor[FEATURE_REQUIREMENTS_PROPERTIES.DYNAMIC_LIGHTS.name],
                    gameParams));
        }
        if (complexityDescriptor[SHADER_COMPLEXITY_PROPERTIES.REVEAL_AVAILABLE.name]) {
            result = _getCombinedRequirements(result, _getShaderRequirementsFromDescriptor(
                    featureRequirementsDescriptor[FEATURE_REQUIREMENTS_PROPERTIES.REVEAL.name],
                    gameParams));
        }
        return result;
    };
    /**
     * Returns whether the shader requirements valid for the current settings stored in this graphics context are satisfied by the graphics
     * driver.
     * @param {GraphicsContext~CustomShaderRequirementsParams} [params] Provide game variable values or a shader complexity level index in
     * this object to override the respective current settings when calculating the requirements.
     * @returns {Boolean}
     */
    GraphicsContext.prototype._shaderRequirementsAreSatisfied = function (params) {
        return managedGL.requirementsAreSatisfied(this._getShaderRequirements(params));
    };
    /**
     * Removes all stored shader complexity levels for which even the basic requirements (with all features turned off) are not satisfiable
     * by the graphics driver.
     */
    GraphicsContext.prototype._limitShaderComplexities = function () {
        var complexities = [], originalComplexities = this.getShaderConfig(SHADER_CONFIG.COMPLEXITIES), i;
        for (i = 0; i < originalComplexities.length; i++) {
            if (this._shaderRequirementsAreSatisfied({
                numPointLights: 0,
                numShadowRanges: 0,
                complexityLevelIndex: i
            })) {
                complexities.push(originalComplexities[i]);
            } else {
                application.log("Defined shader complexity level '" + originalComplexities[i][SHADER_COMPLEXITY_PROPERTIES.NAME.name] + "', which has too high requirements and thus will be dropped from the available shader complexities.", 1);
            }
        }
        this.setShaderConfig(SHADER_CONFIG.COMPLEXITIES, complexities);
    };
    /**
     * If needed, decreases the currently set shader complexity level to one at which the requirements (with the current feature settings)
     * are satisfied by the graphics driver.
     */
    GraphicsContext.prototype._setFallbackShaderComplexity = function () {
        var i;
        i = this.getShaderComplexities().indexOf(this.getShaderComplexity());
        while ((i > 0) && !this._shaderRequirementsAreSatisfied({complexityLevelIndex: i})) {
            i--;
        }
        this.setShaderComplexity(this.getShaderComplexities()[i], false);
    };
    /**
     * Loads all configuration information for the context from the passed JSON object. This includes the list of options for the various
     * settings and other meta and non-changeable data. Needs to be called only once, before the settings themselves are to be loaded.
     * @param {Object} dataJSON
     */
    GraphicsContext.prototype.loadConfigurationFromJSON = function (dataJSON) {
        var i, n, limit, lodDisplayLimits;
        this._shaderConfig = types.getVerifiedObject("config.graphics.shaders", dataJSON.shaders, SHADER_CONFIG);
        this._limitShaderComplexities();
        this._textureQuality = new TextureQuality(
                dataJSON.context.textureQualities,
                "config.graphics.context.textureQualities",
                managedGL.getMaxTextureSize());
        this._cubemapQuality = new TextureQuality(
                dataJSON.context.cubemapQualities,
                "config.graphics.context.cubemapQualities",
                managedGL.getMaxCubemapSize());
        this._shadowMapQuality = new TextureQuality(
                dataJSON.context.shadows.qualities,
                "config.graphics.context.shadows.qualities",
                managedGL.getMaxRenderbufferSize());
        this._shadowRanges = types.getArrayValue("config.graphics.context.shadows.ranges", dataJSON.context.shadows.ranges, "number", null, {minLength: 1});
        this._shadowDistances = new OrderedNamedNumericOptions(
                dataJSON.context.shadows.distances,
                SHADOW_DISTANCE_DESCRIPTOR_TYPE,
                "config.graphics.context.shadows.distances",
                this._shadowRanges.length);
        this._shadowDepthRatio = types.getNumberValue("config.graphics.context.shadows.depthRatio", dataJSON.context.shadows.depthRatio);
        this._pointLightAmount = new OrderedNamedNumericOptions(
                dataJSON.context.pointLightAmounts,
                DYNAMIC_LIGHT_AMOUNT_DESCRIPTOR_TYPE,
                "config.graphics.context.pointLightAmounts");
        this._lodLevel = new OrderedNamedNumericOptions(
                dataJSON.levelOfDetailSettings.lodLevels,
                LOD_LEVEL_DESCRIPTOR_TYPE,
                "config.graphics.levelOfDetailSettings.lodLevels");
        // configuring the LOD context
        lodDisplayLimits = new Array(dataJSON.levelOfDetailSettings.lodDisplayProfile.limits.length + 1);
        lodDisplayLimits[0] = 0;
        for (i = 0, n = dataJSON.levelOfDetailSettings.lodDisplayProfile.limits.length; i < n; i++) {
            limit = dataJSON.levelOfDetailSettings.lodDisplayProfile.limits[i];
            lodDisplayLimits[this._lodLevel.getValueForName(limit.level) + 1] = limit.objectSizeLessThan;
        }
        this._lodContext = new budaScene.LODContext(
                this._lodLevel.getFirstValue(),
                lodDisplayLimits,
                dataJSON.levelOfDetailSettings.lodDisplayProfile.compensateForObjectSize,
                dataJSON.levelOfDetailSettings.lodDisplayProfile.referenceSize,
                dataJSON.levelOfDetailSettings.lodDisplayProfile.minimumRelativeSize);
    };
    /**
     * Loads the graphics setting from the data stored in the passed JSON object.
     * @param {Object} dataJSON The JSON object storing the game settings.
     * @param {Boolean} [onlyRestoreSettings=false] Whether only the default 
     * settings should be restored or completely new settings should be initialized.
     */
    GraphicsContext.prototype.loadSettingsFromJSON = function (dataJSON, onlyRestoreSettings) {
        var screenSize, i, n, limit;
        onlyRestoreSettings = onlyRestoreSettings || false;
        if (!onlyRestoreSettings) {
            this._dataJSON = dataJSON;
        }
        if (typeof dataJSON.shaders === "object") {
            // enabling fallback disables the check for requirements - feature settings are not loaded yet, requirements cannot be checked
            this.setShaderComplexity(dataJSON.shaders.complexity, false, true);
        } else {
            application.showError("Missing required settings.graphics.shaders from the setting definition object!");
        }
        if (typeof dataJSON.context === "object") {
            this.setAntialiasing(types.getBooleanValue(dataJSON.context.antialiasing, {name: "settings.graphics.context.antialiasing"}), false);
            this.setFiltering(types.getEnumValue(managedGL.TextureFiltering, dataJSON.context.filtering, {name: "settings.graphics.context.filtering"}), false);
            this.setTextureQuality(dataJSON.context.textureQuality, false, true);
            this.setCubemapQuality(dataJSON.context.cubemapQuality, false, true);
            this.setShadowMapping(types.getBooleanValue(dataJSON.context.shadowMapping, {name: "settings.graphics.context.shadowMapping"}), false, true);
            if (typeof dataJSON.context.shadows === "object") {
                this.setShadowMapQuality(dataJSON.context.shadows.quality, false, true);
                this.setShadowDistance(dataJSON.context.shadows.distance, false, true);
            }
            this.setPointLightAmount(dataJSON.context.pointLightAmount, false, true);
        } else {
            application.showError("Missing required settings.graphics.context from the setting definition object!");
        }
        // load the LOD load settings (maximum loaded LOD)
        this.setLODLevel(dataJSON.levelOfDetail.maxLevel, false);
        // if the maximum loaded LOD is limited by screen width, check the current width and apply the limit
        if (dataJSON.levelOfDetail.autoLimitByScreenSize === true) {
            screenSize = Math.max(screen.width, screen.height);
            for (i = 0, n = dataJSON.levelOfDetail.limits.length; i < n; i++) {
                // take the width of the window, therefore playing in a small window
                // will not use unnecesarily high detail, even if the screen is big
                limit = dataJSON.levelOfDetail.limits[i];
                if ((screenSize < limit.screenSizeLessThan) &&
                        (this.getMaxLoadedLOD() > this._lodLevel.getValueForName(limit.level))) {
                    this.setLODLevel(limit.level, false);
                }
            }
        }
        // now that all default settings are loaded, descrease the shader complexity until it is at a level where the requirements with
        // these defaults are satisfied
        this._setFallbackShaderComplexity();
    };
    /**
     * Loads the custom graphics settings stored in HTML5 local storage.
     */
    GraphicsContext.prototype.loadFromLocalStorage = function () {
        var value, params, loadSetting = function (location, type, defaultValue, setterFunction) {
            if (localStorage[location] !== undefined) {
                // settings might be saved in different formats in different game versions, so do not show errors for invalid type if the version
                // has changed since the last run
                params = {
                    silentFallback: application.hasVersionChanged(),
                    defaultValue: defaultValue
                };
                value = types.getValueOfTypeFromLocalStorage(type, location, params);
                // apply the setting if it is valid or if the game version has changed, in which case the fallback of the invalid setting 
                // (namely the default setting from the JSON) will be applied and also saved to local storage
                if (!params.error || application.hasVersionChanged()) {
                    setterFunction(value, !!params.error && (params.error !== types.Errors.INVALID_ENUM_OBJECT_ERROR));
                }
            }
        };
        loadSetting(ANTIALIASING_LOCAL_STORAGE_ID, "boolean", this.getAntialiasing(), this.setAntialiasing.bind(this));
        loadSetting(FILTERING_LOCAL_STORAGE_ID, {baseType: "enum", values: managedGL.TextureFiltering}, this.getFiltering(), this.setFiltering.bind(this));
        loadSetting(TEXTURE_QUALITY_LOCAL_STORAGE_ID, {baseType: "enum", values: types.getEnumObjectForArray(this.getTextureQualities())}, this.getTextureQuality(), this.setTextureQuality.bind(this));
        loadSetting(CUBEMAP_QUALITY_LOCAL_STORAGE_ID, {baseType: "enum", values: types.getEnumObjectForArray(this.getCubemapQualities())}, this.getCubemapQuality(), this.setCubemapQuality.bind(this));
        loadSetting(MAX_LOD_LOCAL_STORAGE_ID, {baseType: "enum", values: types.getEnumObjectForArray(this.getLODLevels())}, this.getLODLevel(), this.setLODLevel.bind(this));
        loadSetting(SHADER_COMPLEXITY_LOCAL_STORAGE_ID, {baseType: "enum", values: types.getEnumObjectForArray(this.getShaderComplexities())}, this.getShaderComplexity(), this.setShaderComplexity.bind(this));
        loadSetting(SHADOW_MAPPING_LOCAL_STORAGE_ID, "boolean", this.isShadowMappingEnabled(), this.setShadowMapping.bind(this));
        loadSetting(SHADOW_MAP_QUALITY_LOCAL_STORAGE_ID, {baseType: "enum", values: types.getEnumObjectForArray(this.getShadowMapQualities())}, this.getShadowMapQuality(), this.setShadowMapQuality.bind(this));
        if (this.canEnableShadowMapping()) {
            loadSetting(SHADOW_DISTANCE_LOCAL_STORAGE_ID, {baseType: "enum", values: types.getEnumObjectForArray(this.getShadowDistances())}, this.getShadowDistance(), this.setShadowDistance.bind(this));
            // otherwise the shadow distances will be an empty array, and we cannot verify the value
        }
        loadSetting(POINT_LIGHT_AMOUNT_LOCAL_STORAGE_ID, {baseType: "enum", values: types.getEnumObjectForArray(this.getPointLightAmounts())}, this.getPointLightAmount(), this.setPointLightAmount.bind(this));
        this.setToReady();
    };
    /**
     * Restores the default settings that were loaded from file, and erases the custom changes that are stored in HTML5 local storage.
     */
    GraphicsContext.prototype.restoreDefaults = function () {
        this.loadSettingsFromJSON(this._dataJSON, true);
        localStorage.removeItem(ANTIALIASING_LOCAL_STORAGE_ID);
        localStorage.removeItem(FILTERING_LOCAL_STORAGE_ID);
        localStorage.removeItem(TEXTURE_QUALITY_LOCAL_STORAGE_ID);
        localStorage.removeItem(CUBEMAP_QUALITY_LOCAL_STORAGE_ID);
        localStorage.removeItem(MAX_LOD_LOCAL_STORAGE_ID);
        localStorage.removeItem(SHADER_COMPLEXITY_LOCAL_STORAGE_ID);
        localStorage.removeItem(SHADOW_MAPPING_LOCAL_STORAGE_ID);
        localStorage.removeItem(SHADOW_MAP_QUALITY_LOCAL_STORAGE_ID);
        localStorage.removeItem(SHADOW_DISTANCE_LOCAL_STORAGE_ID);
        localStorage.removeItem(POINT_LIGHT_AMOUNT_LOCAL_STORAGE_ID);
    };
    /**
     * Returns the current antialiasing setting.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.getAntialiasing = function () {
        return this._antialiasing;
    };
    /**
     * Sets a new antialiasing setting.
     * @param {Boolean} value
     * @param {Boolean} [saveToLocalStorage=true]
     * @returns {Boolean} Whether the setting was successfully set to the passed value.
     */
    GraphicsContext.prototype.setAntialiasing = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (managedGL.isAntialiasingAvailable()) {
            this._antialiasing = value;
        } else {
            this._antialiasing = false;
            if (value) {
                application.log("Attempted to enable antialiasing, but it is not supported and so will be disabled.", 1);
            }
        }
        // saving the original preference
        if (saveToLocalStorage) {
            localStorage[ANTIALIASING_LOCAL_STORAGE_ID] = value.toString();
        }
        return this._antialiasing === value;
    };
    /**
     * Returns the current texture filtering setting.
     * @returns {String} enum managedGL.TextureFiltering
     */
    GraphicsContext.prototype.getFiltering = function () {
        return this._filtering;
    };
    /**
     * Sets a new texture filtering setting.
     * @param {String} value enum managedGL.TextureFiltering
     * @param {Boolean} [saveToLocalStorage=true]
     * @returns {Boolean} Whether the setting was successfully set to the passed value.
     */
    GraphicsContext.prototype.setFiltering = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        value = types.getEnumValue(managedGL.TextureFiltering, value, {name: "texture filtering", defaultValue: this._filtering});
        this._filtering = value;
        if ((!managedGL.isAnisotropicFilteringAvailable()) && (value === managedGL.TextureFiltering.ANISOTROPIC)) {
            this._filtering = ANISOTROPIC_FALLBACK_FILTERING;
            application.log("Attempted to set texture filtering to anisotropic, but it is not supported and so a fallback filtering will be applied instead.", 1);
        }
        // saving the original preference
        if (saveToLocalStorage) {
            localStorage[FILTERING_LOCAL_STORAGE_ID] = value.toString();
        }
    };
    /**
     * Returns the list of strings identifying the available texture quality levels, in ascending order.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getTextureQualities = function () {
        return this._textureQuality.getNameList();
    };
    /**
     * Returns the list of strings identifying the available texture quality levels, in order of preference.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getTextureQualityPreferenceList = function () {
        return this._textureQuality.getPreferenceNameList();
    };
    /**
     * Returns the string identifying the current texture quality level setting.
     * @returns {String}
     */
    GraphicsContext.prototype.getTextureQuality = function () {
        return this._textureQuality.getCurrentName();
    };
    /**
     * Sets a new texture quality level.
     * @param {String} value The string ID identifying the desired option.
     * @param {Boolean} [saveToLocalStorage=true]
     * @param {Boolean} [fallbackToHighest=false] If true, then in case the passed value cannot be set (because it is not valid e.g. 
     * because it is higher than the maximum supported by the graphics driver), then instead of showing an error, the highest available
     * option is set.
     */
    GraphicsContext.prototype.setTextureQuality = function (value, saveToLocalStorage, fallbackToHighest) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (this._textureQuality.setCurrent(value, fallbackToHighest)) {
            if (saveToLocalStorage) {
                localStorage[TEXTURE_QUALITY_LOCAL_STORAGE_ID] = value;
            }
        }
    };
    /**
     * Returns the list of strings identifying the available cubemap quality levels, in ascending order.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getCubemapQualities = function () {
        return this._cubemapQuality.getNameList();
    };
    /**
     * Returns the list of strings identifying the available cubemap quality levels, in order of preference.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getCubemapQualityPreferenceList = function () {
        return this._cubemapQuality.getPreferenceNameList();
    };
    /**
     * Returns the string identifying the current cubemap quality level setting.
     * @returns {String}
     */
    GraphicsContext.prototype.getCubemapQuality = function () {
        return this._cubemapQuality.getCurrentName();
    };
    /**
     * Sets a new cubemap quality level.
     * @param {String} value The string ID identifying the desired option.
     * @param {Boolean} [saveToLocalStorage=true]
     * @param {Boolean} [fallbackToHighest=false] If true, then in case the passed value cannot be set (because it is not valid e.g. 
     * because it is higher than the maximum supported by the graphics driver), then instead of showing an error, the highest available
     * option is set.
     */
    GraphicsContext.prototype.setCubemapQuality = function (value, saveToLocalStorage, fallbackToHighest) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (this._cubemapQuality.setCurrent(value, fallbackToHighest)) {
            if (saveToLocalStorage) {
                localStorage[CUBEMAP_QUALITY_LOCAL_STORAGE_ID] = value;
            }
        }
    };
    /**
     * Returns the numeric value marking the maximum detail level in which model files are to be loaded.
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxLoadedLOD = function () {
        return this._maxLoadedLOD;
    };
    /**
     * Returns the list of strings identifying the available model LOD levels, in ascending order.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getLODLevels = function () {
        return this._lodLevel.getNameList();
    };
    /**
     * Returns the string identifying the current model LOD level setting.
     * @returns {String}
     */
    GraphicsContext.prototype.getLODLevel = function () {
        return this._lodLevel.getCurrentName();
    };
    /**
     * Sets a new maximum model LOD. (both for displaying and loading models)
     * @param {String} value The string ID identifying the desired option.
     * @param {Boolean} [saveToLocalStorage=true]
     */
    GraphicsContext.prototype.setLODLevel = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (this._lodLevel.setCurrent(value)) {
            this._maxLoadedLOD = this._lodLevel.getCurrentValue();
            this._lodContext.maxEnabledLOD = this._lodLevel.getCurrentValue();
            if (saveToLocalStorage) {
                localStorage[MAX_LOD_LOCAL_STORAGE_ID] = value;
            }
        }
    };
    /**
     * Returns the LOD context object storing the currently active LOD settings in the format defined by BudaScene.
     * @returns {LODContext}
     */
    GraphicsContext.prototype.getLODContext = function () {
        return this._lodContext;
    };
    /**
     * Returns the string identifying the current shader complexity level setting.
     * @returns {String}
     */
    GraphicsContext.prototype.getShaderComplexity = function () {
        return this._shaderComplexity;
    };
    /**
     * Decreases the level of enabled shader features or disables them completely if required until a level can be reached where the 
     * graphics driver supports the resulting shader requirements.
     */
    GraphicsContext.prototype._limitShaderFeatures = function () {
        var
                originalShadowMapping = this.isShadowMappingEnabled(),
                originalNumShadowMapRanges = this.getNumShadowMapRanges(),
                originalMaxPointLights = this.getMaxPointLights();
        application.log("Checking requirements for current shader complexity...");
        while (!this._shaderRequirementsAreSatisfied()) {
            if (this.isShadowMappingEnabled()) {
                if (!this._shadowDistances.decrease()) {
                    this.setShadowMapping(false, false, true);
                }
            } else if (!this._pointLightAmount.decrease()) {
                application.showError("Cannot satisfy shader requirements for current complexity!");
                return;
            }
        }
        if (this.isShadowMappingEnabled() !== originalShadowMapping) {
            application.log("Disabled shadow mapping to satisfy requirements of current shader complexity.", 1);
        } else if (this.getNumShadowMapRanges() !== originalNumShadowMapRanges) {
            application.log("Changed number of shadow map ranges from " + originalNumShadowMapRanges + " to " + this.getNumShadowMapRanges() + " to satisfy requirements of current shader complexity.", 1);
        }
        if (this.getMaxPointLights() !== originalMaxPointLights) {
            application.log("Changed number of maximum point lights from " + originalMaxPointLights + " to " + this.getMaxPointLights() + " to satisfy requirements of current shader complexity.", 1);
        }
    };
    /**
     * Sets a new shader complexity level. Automatically lowers enabled shader features if needed to ensure that the shader requirements
     * are satisfied for the new level as well.
     * @param value The string ID identifying the desired option.
     * @param {Boolean} [saveToLocalStorage=true]
     * @param {Boolean} [fallbackToHighest=false] If true, then in case the passed value cannot be set (because it is not valid e.g. 
     * because it is higher than the maximum supported by the graphics driver), then instead of showing an error, the highest available
     * option is set. The requirements are not checked if the complexity level is set through fallback!
     */
    GraphicsContext.prototype.setShaderComplexity = function (value, saveToLocalStorage, fallbackToHighest) {
        var complexities = this.getShaderComplexities();
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (complexities.indexOf(value) >= 0) {
            if (this._shaderComplexity !== value) {
                this._shaderComplexity = value;
                this._limitShaderFeatures();
            }
            if (saveToLocalStorage) {
                localStorage[SHADER_COMPLEXITY_LOCAL_STORAGE_ID] = value;
            }
        } else {
            if (fallbackToHighest) {
                this._shaderComplexity = complexities[complexities.length - 1];
                application.log("Attempted to set shader complexity to '" + value + "', which is not supported, and thus '" + this._shaderComplexity + "' has been selected instead.", 1);
            } else {
                application.showError(
                        "Attempting to set shader complexity to '" + value + "', which is not one of the available options (" + this.getShaderComplexities().join(", ") + ").",
                        application.ErrorSeverity.MINOR,
                        "The shader complexity will stay '" + this.getShaderComplexity() + "'.");
            }
        }
        // caching the availability of luminosity textures as it is frequently queried
        this._luminosityTextureAreAvailable = this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_PROPERTIES.LUMINOSITY_TEXTURES_AVAILABLE.name];
    };
    /**
     * Return a list containing the names of all available shader complexity levels that can be set.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getShaderComplexities = function () {
        return this.getShaderConfig(SHADER_CONFIG.COMPLEXITIES).map(function (complexityDescriptor) {
            return complexityDescriptor[SHADER_COMPLEXITY_PROPERTIES.NAME.name];
        });
    };
    /**
     * Returns the name of the shader that is to be used for rendering shadow maps
     * @returns {String|null}
     */
    GraphicsContext.prototype.getShadowMappingShaderName = function () {
        return this.getShaderConfig(SHADER_CONFIG.SHADOW_MAPPING_SHADER_NAME);
    };
    /**
     * Returns whether shadow mapping is enabled.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.isShadowMappingEnabled = function () {
        return this._shadowMappingEnabled;
    };
    /**
     * Sets whether shadow mapping should be enabled. Also checks whether enabling shadow mapping is possible at the current settings 
     * (shader requirements would be satisfied at least using the closest shadow distance) and only enables it if possible, also ensuring
     * that the requirements are met by lowering the shadow distance level, if needed.
     * @param {Boolean} value
     * @param {Boolean} [saveToLocalStorage=true]
     * @param {Boolean} [ignoreRequirements=false] If true, the requirements are not checked and the shadow mapping is set to the desired
     * value in any case.
     * @returns {Boolean} Whether shadow mapping has been successfully set to the passed value.
     */
    GraphicsContext.prototype.setShadowMapping = function (value, saveToLocalStorage, ignoreRequirements) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (ignoreRequirements || !value || this.canEnableShadowMapping()) {
            if (this._shadowMappingEnabled !== value) {
                this._shadowMappingEnabled = value;
                if (!ignoreRequirements && value) {
                    // it is possible that a too high, unsupported shadow distance is set, which needs to be lowered
                    this._limitShaderFeatures();
                }
            }
        } else {
            this._shadowMappingEnabled = false;
            application.log("Attempted to enable shadow mapping, but it is not supported (at the current shader complexity level) and so will be disabled.", 1);
        }
        // saving the original preference
        if (saveToLocalStorage) {
            localStorage[SHADOW_MAPPING_LOCAL_STORAGE_ID] = value.toString();
        }
        return this._shadowMappingEnabled === value;
    };
    /**
     * Returns the list of strings identifying the available shadow map quality levels, in ascending order.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getShadowMapQualities = function () {
        return this._shadowMapQuality.getNameList();
    };
    /**
     * Returns the string identifying the current shadow map quality level.
     * @returns {String}
     */
    GraphicsContext.prototype.getShadowMapQuality = function () {
        return this._shadowMapQuality.getCurrentName();
    };
    /**
     * Returns the size (in texels, both width and height) of shadow map texture used at the currentl set quality level.
     * @returns {Number}
     */
    GraphicsContext.prototype.getShadowMapTextureSize = function () {
        return this._shadowMapQuality.getCurrentValue();
    };
    /**
     * Sets a new shadow map quality level.
     * @param {String} value The string ID identifying the desired option.
     * @param {Boolean} [saveToLocalStorage=true]
     * @param {Boolean} [fallbackToHighest=false] If true, then in case the passed value cannot be set (because it is not valid e.g. 
     * because it is higher than the maximum supported by the graphics driver), then instead of showing an error, the highest available
     * option is set.
     */
    GraphicsContext.prototype.setShadowMapQuality = function (value, saveToLocalStorage, fallbackToHighest) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (this._shadowMapQuality.setCurrent(value, fallbackToHighest)) {
            if (saveToLocalStorage) {
                localStorage[SHADOW_MAP_QUALITY_LOCAL_STORAGE_ID] = value;
            }
        }
    };
    /**
     * Returns the array of ranges (size of the area covered by each shadow map, in world coordinates, from the center to the sides) for the 
     * active number of shadow maps.
     * @returns {Number[]}
     */
    GraphicsContext.prototype.getShadowRanges = function () {
        var i, result = [], numRanges = this.getNumShadowMapRanges();
        for (i = 0; i < numRanges; i++) {
            result.push(this._shadowRanges[i]);
        }
        return result;
    };
    /**
     * Returns the list of strings identifying the available shadow distance levels, in ascending order.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getShadowDistances = function () {
        return this._shadowDistances.getFilteredNameList(function (value) {
            return this._shaderRequirementsAreSatisfied({numShadowRanges: value});
        }.bind(this));
    };
    /**
     * Returns the string identifying the current shadow distance level.
     * @returns {String}
     */
    GraphicsContext.prototype.getShadowDistance = function () {
        return this._shadowDistances.getCurrentName();
    };
    /**
     * Returns the number of shadow map ranges actively used at the current settings.
     * @returns {Number}
     */
    GraphicsContext.prototype.getNumShadowMapRanges = function () {
        return this._shadowMappingEnabled ? this._shadowDistances.getCurrentValue() : 0;
    };
    /**
     * Sets a new distance level for rendering shadows. (which determines the number of ranges to use for shadow mapping)
     * @param {String} value The string ID identifying the desired option.
     * @param {Boolean} [saveToLocalStorage=true]
     * @param {Boolean} [fallbackToHighest=false] If true, then in case the passed value cannot be set (because it is not valid e.g. 
     * because it is higher than the maximum supported by the graphics driver), then instead of showing an error, the highest available
     * option is set.
     */
    GraphicsContext.prototype.setShadowDistance = function (value, saveToLocalStorage, fallbackToHighest) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (this._shadowDistances.setCurrent(value, fallbackToHighest)) {
            if (saveToLocalStorage) {
                localStorage[SHADOW_DISTANCE_LOCAL_STORAGE_ID] = value;
            }
        }
    };
    /**
     * Returns the depth ratio for shadow mapping. The depth area covered by each shadow map has a size multiplied by this factor compared
     * to the size covered in width and height.
     * @returns {Number}
     */
    GraphicsContext.prototype.getShadowDepthRatio = function () {
        return this._shadowDepthRatio;
    };
    /**
     * Returns the shader complexity descriptor object for the currently set shader complexity level.
     * @param {Number} [index] If given, the descriptor object belonging to the complexity level at this index is returned instead of the
     * one belonging to the current complexity.
     * @returns {Object}
     */
    GraphicsContext.prototype._getShaderComplexityDescriptor = function (index) {
        return (index === undefined) ?
                this.getShaderConfig(SHADER_CONFIG.COMPLEXITIES).find(function (complexityDescriptor) {
            return complexityDescriptor[SHADER_COMPLEXITY_PROPERTIES.NAME.name] === this.getShaderComplexity();
        }.bind(this), this) :
                this.getShaderConfig(SHADER_CONFIG.COMPLEXITIES)[index];
    };
    /**
     * Returns the maximum number of directional lights that can be used in shaders.
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxDirLights = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_PROPERTIES.MAX_DIR_LIGHTS.name];
    };
    /**
     * Returns the list of strings identifying the available maximum point light amount settings, in ascending order.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getPointLightAmounts = function () {
        return this._pointLightAmount.getFilteredNameList(function (value) {
            return this._shaderRequirementsAreSatisfied({numPointLights: value});
        }.bind(this));
    };
    /**
     * Returns the string identifying the current maximum point light amount setting.
     * @returns {String}
     */
    GraphicsContext.prototype.getPointLightAmount = function () {
        return this._pointLightAmount.getCurrentName();
    };
    /**
     * Returns the maximum number of point lights that can be used in shaders.
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxPointLights = function () {
        return this._pointLightAmount.getCurrentValue();
    };
    /**
     * Sets a new maximum dynamic light amount to be used in shaders.
     * @param {String} value The string ID identifying the desired option.
     * @param {Boolean} [saveToLocalStorage=true]
     * @param {Boolean} [fallbackToHighest=false] If true, then in case the passed value cannot be set (because it is not valid e.g. 
     * because it is higher than the maximum supported by the graphics driver), then instead of showing an error, the highest available
     * option is set.
     */
    GraphicsContext.prototype.setPointLightAmount = function (value, saveToLocalStorage, fallbackToHighest) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (this._pointLightAmount.setCurrent(value, fallbackToHighest)) {
            if (saveToLocalStorage) {
                localStorage[POINT_LIGHT_AMOUNT_LOCAL_STORAGE_ID] = value;
            }
        }
    };
    /**
     * Returns the maximum number of spot lights that can be used in shaders.
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxSpotLights = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_PROPERTIES.MAX_SPOT_LIGHTS.name];
    };
    /**
     * Returns the shader configuration value corresponding to the passed property definition object.
     * @param {Object} propertyDefinition A property definition object from SHADER_CONFIG
     * @returns {}
     */
    GraphicsContext.prototype.getShaderConfig = function (propertyDefinition) {
        return this._shaderConfig[propertyDefinition.name];
    };
    /**
     * Sets a new shader configuration value corresponding to the passed property definition object. (from the ones defined in SHADER_CONFIG)
     * @param {Object} propertyDefinition A property definition object from SHADER_CONFIG
     * @param {} value
     */
    GraphicsContext.prototype.setShaderConfig = function (propertyDefinition, value) {
        this._shaderConfig[propertyDefinition.name] = value;
    };
    /**
     * Returns how many samples should shaders take (and average) of the shadow maps to determine how much a point is in shadow.
     * @returns {Number}
     */
    GraphicsContext.prototype.getNumShadowMapSamples = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_PROPERTIES.NUM_SHADOW_MAP_SAMPLES.name];
    };
    /**
     * Returns whether shadow mapping is available according to the currently set shader complexity level. Does not check if the graphics
     * driver support the corresponding shader requirements!
     * @returns {Boolean}
     */
    GraphicsContext.prototype.isShadowMappingAvailable = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_PROPERTIES.SHADOW_MAPPING_AVAILABLE.name];
    };
    /**
     * Returns whether luminosity textures are available according to the currently set shader complexity level.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.areLuminosityTexturesAvailable = function () {
        return this._luminosityTextureAreAvailable;
    };
    /**
     * Returns whether the reveal effect is available according to the currently set shader complexity level.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.isRevealAvailable = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_PROPERTIES.REVEAL_AVAILABLE.name];
    };
    /**
     * Returns whether dynamic (point and spot) lights are available according to the currently set shader complexity level.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.areDynamicLightsAvailable = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_PROPERTIES.DYNAMIC_LIGHTS_AVAILABLE.name];
    };
    /**
     * Returns whether shadow mapping can be enabled (at least with the minimum available shadow distance setting) at the current settings
     * with the graphics driver still satisfying the resulting shader requirements.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.canEnableShadowMapping = function () {
        return this.isShadowMappingAvailable() && this._shaderRequirementsAreSatisfied({numShadowRanges: this._shadowDistances.getFirstValue()});
    };
    /**
     * Return shader resource that should be used for the given name and requests it for loading if needed. Considers the context settings.
     * @param {String} shaderName
     * @returns {ShaderResource}
     */
    GraphicsContext.prototype.getShader = function (shaderName) {
        shaderName = resources.getVariantShader(shaderName, this.getShaderComplexity()).getName();
        if (!this._shadowMappingEnabled) {
            shaderName = resources.getVariantShader(shaderName, SHADER_VARIANT_WITHOUT_SHADOWS_NAME).getName();
        }
        if (this._pointLightAmount.getCurrentValue() === 0) {
            shaderName = resources.getVariantShader(shaderName, SHADER_VARIANT_WITHOUT_DYNAMIC_LIGHTS_NAME).getName();
        }
        return resources.getShader(shaderName);
    };
    /**
     * Returns the managed shader corresponding to the passed name, taking into account the settings of the context.
     * @param {String} shaderName
     * @returns {ManagedShader}
     */
    GraphicsContext.prototype.getManagedShader = function (shaderName) {
        var replacedDefines = {}, result;
        replacedDefines[this.getShaderConfig(SHADER_CONFIG.MAX_DIR_LIGHTS_DEFINE_NAME)] = this.getMaxDirLights();
        replacedDefines[this.getShaderConfig(SHADER_CONFIG.MAX_POINT_LIGHTS_DEFINE_NAME)] = this.getMaxPointLights();
        replacedDefines[this.getShaderConfig(SHADER_CONFIG.MAX_SPOT_LIGHTS_DEFINE_NAME)] = this.getMaxSpotLights();
        replacedDefines[this.getShaderConfig(SHADER_CONFIG.MAX_SHADOW_MAP_RANGES_DEFINE_NAME)] = this.getNumShadowMapRanges();
        replacedDefines[this.getShaderConfig(SHADER_CONFIG.MAX_SHADOW_MAPS_DEFINE_NAME)] = this.getMaxDirLights() * this.getNumShadowMapRanges();
        replacedDefines[this.getShaderConfig(SHADER_CONFIG.NUM_SHADOW_MAP_SAMPLES_DEFINE_NAME)] = this.getNumShadowMapSamples();
        replacedDefines[this.getShaderConfig(SHADER_CONFIG.DUST_LENGTH_DIVISOR_DEFINE_NAME)] = this.getShaderConfig(SHADER_CONFIG.DUST_LENGTH_DIVISOR);
        replacedDefines[this.getShaderConfig(SHADER_CONFIG.MAX_LUMINOSITY_FACTORS_DEFINE_NAME)] = this.getShaderConfig(SHADER_CONFIG.MAX_LUMINOSITY_FACTORS);
        result = this.getShader(shaderName).getManagedShader(replacedDefines);
        if (!result.isAllowedByRequirements(this._getShaderRequirements())) {
            application.showError("Shader '" + shaderName + "' has too high requirements!");
        }
        return result;
    };
    /**
     * Return model resource that should be used for the given name and requests it for loading if needed. Considers the context settings.
     * @param {String} modelName
     * @returns {ModelResource}
     */
    GraphicsContext.prototype.getModel = function (modelName) {
        return resources.getModel(modelName, {maxLOD: this.getMaxLoadedLOD()});
    };
    // -------------------------------------------------------------------------
    // Public functions
    /**
     * Returns whether shadow mapping should be used if all current graphics settings are considered (not just the shadow mapping setting
     * itself)
     * @returns {Boolean}
     */
    function shouldUseShadowMapping() {
        return _context.isShadowMappingEnabled() && (_context.isShadowMappingAvailable());
    }
    /**
     * Returns the resource for the shader that is to be used when rendering shadow maps
     * @returns {ShaderResource}
     */
    function getShadowMappingShader() {
        return _context.getShader(_context.getShadowMappingShaderName());
    }
    /**
     * Returns a shadow mapping settings descriptor object that can be directly used as parameter for Scene constructors and contains the
     * state that reflect the current settings stored 
     * @returns {Scene~ShadowMappingParams|null}
     */
    function getShadowMappingSettings() {
        return shouldUseShadowMapping() ?
                {
                    enable: true,
                    shader: getShadowMappingShader().getManagedShader(),
                    textureSize: _context.getShadowMapTextureSize(),
                    ranges: _context.getShadowRanges(),
                    depthRatio: _context.getShadowDepthRatio(),
                    numSamples: _context.getNumShadowMapSamples()
                } :
                null;
    }
    _context = new GraphicsContext();
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        loadSettingsFromJSON: _context.loadSettingsFromJSON.bind(_context),
        loadSettingsFromLocalStorage: _context.loadFromLocalStorage.bind(_context),
        restoreDefaults: _context.restoreDefaults.bind(_context),
        getAntialiasing: _context.getAntialiasing.bind(_context),
        setAntialiasing: _context.setAntialiasing.bind(_context),
        getFiltering: _context.getFiltering.bind(_context),
        setFiltering: _context.setFiltering.bind(_context),
        getTextureQualities: _context.getTextureQualities.bind(_context),
        getTextureQuality: _context.getTextureQuality.bind(_context),
        setTextureQuality: _context.setTextureQuality.bind(_context),
        getTextureQualityPreferenceList: _context.getTextureQualityPreferenceList.bind(_context),
        getCubemapQualities: _context.getCubemapQualities.bind(_context),
        getCubemapQuality: _context.getCubemapQuality.bind(_context),
        setCubemapQuality: _context.setCubemapQuality.bind(_context),
        getCubemapQualityPreferenceList: _context.getCubemapQualityPreferenceList.bind(_context),
        getLODLevels: _context.getLODLevels.bind(_context),
        getLODLevel: _context.getLODLevel.bind(_context),
        setLODLevel: _context.setLODLevel.bind(_context),
        getMaxLoadedLOD: _context.getMaxLoadedLOD.bind(_context),
        getLODContext: _context.getLODContext.bind(_context),
        getShaderComplexity: _context.getShaderComplexity.bind(_context),
        setShaderComplexity: _context.setShaderComplexity.bind(_context),
        getShaderComplexities: _context.getShaderComplexities.bind(_context),
        getShadowMappingShaderName: _context.getShadowMappingShaderName.bind(_context),
        isShadowMappingEnabled: _context.isShadowMappingEnabled.bind(_context),
        setShadowMapping: _context.setShadowMapping.bind(_context),
        getShadowMapQualities: _context.getShadowMapQualities.bind(_context),
        getShadowMapQuality: _context.getShadowMapQuality.bind(_context),
        getShadowMapTextureSize: _context.getShadowMapTextureSize.bind(_context),
        setShadowMapQuality: _context.setShadowMapQuality.bind(_context),
        getShadowDistances: _context.getShadowDistances.bind(_context),
        getShadowDistance: _context.getShadowDistance.bind(_context),
        setShadowDistance: _context.setShadowDistance.bind(_context),
        getShadowDepthRatio: _context.getShadowDepthRatio.bind(_context),
        getNumShadowMapSamples: _context.getNumShadowMapSamples.bind(_context),
        getMaxDirLights: _context.getMaxDirLights.bind(_context),
        getPointLightAmounts: _context.getPointLightAmounts.bind(_context),
        getPointLightAmount: _context.getPointLightAmount.bind(_context),
        getMaxPointLights: _context.getMaxPointLights.bind(_context),
        setPointLightAmount: _context.setPointLightAmount.bind(_context),
        getMaxSpotLights: _context.getMaxSpotLights.bind(_context),
        isShadowMappingAvailable: _context.isShadowMappingAvailable.bind(_context),
        areLuminosityTexturesAvailable: _context.areLuminosityTexturesAvailable.bind(_context),
        isRevealAvailable: _context.isRevealAvailable.bind(_context),
        areDynamicLightsAvailable: _context.areDynamicLightsAvailable.bind(_context),
        canEnableShadowMapping: _context.canEnableShadowMapping.bind(_context),
        getShader: _context.getShader.bind(_context),
        getManagedShader: _context.getManagedShader.bind(_context),
        getModel: _context.getModel.bind(_context),
        shouldUseShadowMapping: shouldUseShadowMapping,
        getShadowMappingShader: getShadowMappingShader,
        getShadowMappingSettings: getShadowMappingSettings,
        executeWhenReady: _context.executeWhenReady.bind(_context)
    };
});