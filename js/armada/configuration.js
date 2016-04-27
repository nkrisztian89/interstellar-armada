/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Stores the current game configuration and settings and provides functions to load and access them.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define */

/**
 * @param types Used for verifying the types of settings loaded from JSON
 * @param asyncResource
 * @param budaScene
 * @param classes
 */
define([
    "utils/types",
    "modules/async-resource",
    "modules/buda-scene",
    "armada/classes"
], function (types, asyncResource, budaScene, classes) {
    "use strict";
    var
            /**
             * @enum {String}
             * The options for auto targeting.
             */
            AutoTargetingMode = {
                /**
                 * Automatic targeting is completely switched off
                 */
                NEVER: "never",
                /**
                 * If a ship is hit, it is automatically selected as a target if no ships are selected as target yet
                 */
                HIT_AND_NO_TARGET: "hitAndNoTarget",
                /**
                 * If a ship is hit, it is automatically selected as a (new) target unless the player has manually set a different target before
                 */
                HIT_AND_AUTO_TARGET: "hitAndAutoTarget",
                /**
                 * If a ship is hit, it is always selected as a (new) target
                 */
                ALWAYS_WHEN_HIT: "alwaysWhenHit"
            },
    /**
     * This object holds the definition objects for custom types that are used for object property verification
     * @type Object
     */
    _customTypes = {},
            /**
             * Definition object for cofiguration settings that can be used to verify the data loaded from JSON
             * @type Object
             */
            CONFIGURATION,
            /**
             * The definition object for general settings that can be used to verify the data loaded from JSON as well as refer to the 
             * individual settings later.
             * @type Object
             */
            GENERAL_SETTINGS,
            /**
             * The definition object for database settings that can be used to verify the data loaded from JSON as well as refer to the 
             * individual settings later.
             * @type Object
             */
            DATABASE_SETTINGS,
            /**
             * The definition object for battle settings that can be used to verify the data loaded from JSON as well as refer to the 
             * individual settings later.
             * @type Object
             */
            BATTLE_SETTINGS,
            /**
             * The definition object for camera settings that can be used to verify the data loaded from JSON as well as refer to the 
             * individual settings later.
             * @type Object
             */
            CAMERA_SETTINGS,
            /**
             * The context storing the current settings and game data that can be accessed through the interface of this module
             * @type ConfigurationContext
             */
            _context;
    _customTypes.VECTOR3 = {
        baseType: "array",
        length: 3,
        elementType: "number"
    };
    _customTypes.COLOR3 = {
        baseType: "array",
        length: 3,
        elementType: "number",
        elementTypeParams: {
            range: [0, 1]
        }
    };
    _customTypes.COLOR4 = {
        baseType: "array",
        length: 4,
        elementType: "number",
        elementTypeParams: {
            range: [0, 1]
        }
    };
    _customTypes.DURATION = {
        baseType: "number",
        range: [0, undefined]
    };
    _customTypes.FILE_DESCRIPTOR = {
        baseType: "object",
        properties: {
            FILENAME: {
                name: "filename",
                type: "string"
            },
            FOLDER: {
                name: "folder",
                type: "string"
            }
        }
    };
    _customTypes.ANGLE_DEGREES = {
        baseType: "number",
        range: [-360, 360]
    };
    _customTypes.LIGHT_SOURCE = {
        baseType: "object",
        properties: {
            COLOR: {
                name: "color",
                type: _customTypes.COLOR3
            },
            DIRECTION: {
                name: "direction",
                type: _customTypes.VECTOR3
            }
        }
    };
    CONFIGURATION = {
        CLASSES_SOURCE_FILE: {
            name: "classes",
            type: _customTypes.FILE_DESCRIPTOR
        },
        ENVIRONMENTS_SOURCE_FILE: {
            name: "environments",
            type: _customTypes.FILE_DESCRIPTOR
        },
        LEVEL_FILES: {
            name: "levels",
            type: {
                baseType: "object",
                properties: {
                    FOLDER: {
                        name: "folder",
                        type: "string"
                    },
                    FILENAMES: {
                        name: "filenames",
                        type: "array",
                        elementType: "string"
                    }
                }
            }
        }
    };
    GENERAL_SETTINGS = {
        /**
         * Whether the RequestAnimationFrame API should be used for the render loops (as opposed to setInterval)
         */
        USE_REQUEST_ANIM_FRAME: {
            name: "useRequestAnimFrame",
            type: "boolean",
            defaultValue: true
        },
        /**
         * Default seed to use for generating random numbers to allow consistent and comparable testing.
         */
        DEFAULT_RANDOM_SEED: {
            name: "defaultRandomSeed",
            type: "number",
            defaultValue: 4718
        },
        /**
         * The uniform with the corresponding (pre- and suffixed) name will be used in the spacecraft shader to pass the luminosity
         * factor values of the various triangle groups.
         */
        UNIFORM_LUMINOSITY_FACTORS_ARRAY_NAME: {
            name: "luminosityFactorsArrayName",
            type: "string",
            defaultValue: "luminosityFactors"
        },
        /**
         * Whether to interpret given field of view, span and other camera property values as vertical or horizontal.
         */
        USE_VERTICAL_CAMERA_VALUES: {
            name: "useVerticalCameraValues",
            type: "boolean",
            defaultValue: true
        }
    };
    DATABASE_SETTINGS = {
        /**
         * Whether to show the loading box when loading the first item after navigating to the database screen
         */
        SHOW_LOADING_BOX_FIRST_TIME: {
            name: "showLoadingBoxFirstTime",
            type: "boolean",
            defaultValue: true
        },
        /**
         * Whether to show the loading box when switching to another item on the database screen
         */
        SHOW_LOADING_BOX_ON_ITEM_CHANGE: {
            name: "showLoadingBoxOnItemChange",
            type: "boolean",
            defaultValue: true
        },
        /**
         * The background color for the canvas that shows the models in the database
         */
        BACKGROUND_COLOR: {
            name: "backgroundColor",
            type: _customTypes.COLOR4,
            defaultValue: [0, 0, 0, 0]
        },
        /**
         * The view distance of the scene in which the current item is displayed
         */
        ITEM_VIEW_DISTANCE: {
            name: "itemViewDistance",
            type: "number",
            defaultValue: 2000
        },
        /**
         * The field of view of the camera of the scene in which the current item is displayed (in degrees)
         */
        ITEM_VIEW_FOV: {
            name: "itemViewFOV",
            type: "number",
            defaultValue: 60
        },
        /**
         * The span of the camera of the scene in which the current item is displayed (in degrees)
         */
        ITEM_VIEW_SPAN: {
            name: "itemViewSpan",
            type: "number",
            defaultValue: 0.2
        },
        /**
         * If true, the wireframe model will be visible in the database unless the shaders can only show one model and the solid model is also set to show
         */
        SHOW_WIREFRAME_MODEL: {
            name: "showWireframeModel",
            type: "boolean",
            defaultValue: true
        },
        /**
         * The name of the shader to use when rendering the wireframe model
         */
        WIREFRAME_SHADER_NAME: {
            name: "wireframeShaderName",
            type: "string",
            defaultValue: "oneColorReveal"
        },
        /**
         * If the wireframe model is visible, it will be colored (homogenously) with this color
         */
        WIREFRAME_COLOR: {
            name: "wireframeColor",
            type: _customTypes.COLOR4,
            defaultValue: [1, 0, 0, 1]
        },
        /**
         * If true, the solid model will be visible in the database (it will face in after the wireframe model, if that is also visible and reveal is active)
         */
        SHOW_SOLID_MODEL: {
            name: "showSolidModel",
            type: "boolean",
            defaultValue: true
        },
        /**
         * The name of the shader to use when rendering the solid model
         */
        SOLID_SHADER_NAME: {
            name: "solidShaderName",
            type: "string",
            defaultValue: "shadowMapReveal"
        },
        /**
         * The light sources that will be added to the item view scene in the database
         */
        LIGHT_SOURCES: {
            name: "lightSources",
            type: "array",
            elementType: _customTypes.LIGHT_SOURCE,
            minLength: 1,
            maxLength: 2
        },
        /**
         * The name of the equipment profile that should be equipped on the spacecrafts shown in the database 
         */
        EQUIPMENT_PROFILE_NAME: {
            name: "equipmentProfileName",
            type: "string",
            defaultValue: "default"
        },
        /**
         * The size of every model shown will be multiplied by this factor in the database when switching to it
         */
        START_SIZE_FACTOR: {
            name: "startSizeFactor",
            type: "number",
            defaultValue: "1"
        },
        /**
         * If the model size is changed by the user in the database, it cannot go below the original size multiplied by this factor
         */
        MIN_SIZE_FACTOR: {
            name: "minimumSizeFactor",
            type: "number",
            defaultValue: "0.9"
        },
        /**
         * If the model size is changed by the user in the database, it cannot go above the original size multiplied by this factor
         */
        MAX_SIZE_FACTOR: {
            name: "maximumSizeFactor",
            type: "number",
            defaultValue: "1.6"
        },
        /**
         * If true, the models in the database will be rotated automatically
         */
        MODEL_AUTO_ROTATION: {
            name: "modelAutoRotation",
            type: "boolean",
            defaultValue: true
        },
        /**
         * If true, the models in the database can be rotated by the mouse
         */
        MODEL_MOUSE_ROTATION: {
            name: "modelMouseRotation",
            type: "boolean",
            defaultValue: true
        },
        /**
         * The rotation animation (if turned on) will be carried out at this many frames per second
         */
        ROTATION_FPS: {
            name: "rotationFPS",
            type: "number",
            defaultValue: 60
        },
        /**
         * When starting the rotation and the review animations at the same time, the rotation angle will initially be set to this (in degrees)
         */
        ROTATION_REVEAL_START_ANGLE: {
            name: "rotationRevealStartAngle",
            type: _customTypes.ANGLE_DEGREES,
            defaultValue: 90
        },
        /**
         * When starting the rotation animation without the reveal animation, the rotation angle will initially be set to this (in degrees)
         */
        ROTATION_START_ANGLE: {
            name: "rotationStartAngle",
            type: _customTypes.ANGLE_DEGREES,
            defaultValue: 180
        },
        /**
         * The viewing angle that remains constant as the models rotate in the database (in degrees)
         */
        ROTATION_VIEW_ANGLE: {
            name: "rotationViewAngle",
            type: _customTypes.ANGLE_DEGREES,
            defaultValue: 60
        },
        /**
         * If the automatic rotation is turned on, the model will rotate 360 degrees during this much time, in milliseconds
         */
        ROTATION_DURATION: {
            name: "rotationDuration",
            type: "number",
            defaultValue: 4000
        },
        /**
         * If the user rotates the model in the database using the mouse, this will determine the rate or the rotation in degrees / pixels
         */
        ROTATION_MOUSE_SENSITIVITY: {
            name: "rotationMouseSensitivity",
            type: "number",
            defaultValue: 1
        },
        /**
         * If the shaders are not simplified, this setting will toggle the fade-in reveal animation
         */
        MODEL_REVEAL_ANIMATION: {
            name: "modelRevealAnimation",
            type: "boolean",
            defaultValue: true
        },
        /**
         * The models will fade in from this color while being revealed
         */
        REVEAL_COLOR: {
            name: "revealColor",
            type: _customTypes.COLOR4,
            defaultValue: [1.0, 1.0, 1.0, 1.0]
        },
        /**
         * The reveal animation will be carried out at this many frames per second
         */
        REVEAL_FPS: {
            name: "revealFPS",
            type: "number",
            defaultValue: 60
        },
        /**
         * The amount of time needed for the reveal animation to fully reveal a (wireframe/solid) model, in milliseconds
         */
        REVEAL_DURATION: {
            name: "revealDuration",
            type: _customTypes.DURATION,
            defaultValue: 2000
        },
        /**
         * This much delay will be applied between the revealing of the wireframe and the solid models, in milliseconds
         */
        REVEAL_SOLID_DELAY_DURATION: {
            name: "revealSolidDelayDuration",
            type: _customTypes.DURATION,
            defaultValue: 2000
        },
        /**
         * The transition from the reveal color to the model color will this much part of the model's length
         */
        REVEAL_TRANSITION_LENGTH_FACTOR: {
            name: "revealTransitionLengthFactor",
            type: "number",
            defaultValue: 0.15
        },
        /**
         * The rendering of the item view scene will happen at this many frames per second
         */
        RENDER_FPS: {
            name: "databaseRenderFPS",
            type: "number",
            defaultValue: 60
        }
    };
    BATTLE_SETTINGS = {
        /**
         * The rendering of the battle scene will happen at this many frames per second
         */
        RENDER_FPS: {
            name: "battleRenderFPS",
            type: "number",
            defaultValue: 60
        },
        /**
         * The simulation loop will be executed this many times per second during the battle
         */
        SIMULATION_STEPS_PER_SECOND: {
            name: "simulationStepsPerSecond",
            type: "number",
            defaultValue: 60
        },
        MINIMUM_DUST_PARTICLE_COUNT_FOR_INSTANCING: {
            name: "minimumDustParticleCountForInstancing",
            type: "number",
            defaultValue: 1
        },
        MINIMUM_EXPLOSION_PARTICLE_COUNT_FOR_INSTANCING: {
            name: "minimumExplosionParticleCountForInstancing",
            type: "number",
            defaultValue: 1
        },
        MINIMUM_MUZZLE_FLASH_PARTICLE_COUNT_FOR_INSTANCING: {
            name: "minimumMuzzleFlashParticleCountForInstancing",
            type: "number",
            defaultValue: 1
        },
        MINIMUM_THRUSTER_PARTICLE_COUNT_FOR_INSTANCING: {
            name: "minimumThrusterParticleCountForInstancing",
            type: "number",
            defaultValue: 1
        },
        MINIMUM_BLINKER_PARTICLE_COUNT_FOR_INSTANCING: {
            name: "minimumBlinkerParticleCountForInstancing",
            type: "number",
            defaultValue: 1
        },
        /**
         * The view distance in the battle scene
         */
        VIEW_DISTANCE: {
            name: "viewDistance",
            type: "number",
            defaultValue: 5000
        },
        /**
         * When one of the coordinates of the player's ship exceeds this number, the whole scene is moved so that the player's ship is in the origo.
         */
        MOVE_TO_ORIGO_DISTANCE: {
            name: "moveToOrigoDistance",
            type: "number"
        },
        /**
         * The default duration of camera transitions for the battle scene (will be overridden by specific settings for specific transition cases)
         */
        CAMERA_DEFAULT_TRANSITION_DURATION: {
            name: "cameraDefaultTransitionDuration",
            type: "number",
            defaultValue: 1000
        },
        /**
         * The default style of camera transitions for the battle scene (will be overridden by specific settings for specific transition cases)
         */
        CAMERA_DEFAULT_TRANSITION_STYLE: {
            name: "cameraDefaultTransitionStyle",
            type: "enum",
            values: budaScene.Camera.prototype.TransitionStyle,
            defaultValue: budaScene.Camera.prototype.TransitionStyle.SMOOTH
        },
        /**
         * The duration of camera transitions happening when the user switches to piloting mode
         */
        CAMERA_PILOTING_SWITCH_TRANSITION_DURATION: {
            name: "cameraPilotingSwitchTransitionDuration",
            type: "number",
            defaultValue: 1000
        },
        /**
         * The style of camera transitions happening when the user switches to piloting mode
         */
        CAMERA_PILOTING_SWITCH_TRANSITION_STYLE: {
            name: "cameraPilotingSwitchTransitionStyle",
            type: "enum",
            values: budaScene.Camera.prototype.TransitionStyle,
            defaultValue: budaScene.Camera.prototype.TransitionStyle.SMOOTH
        },
        /**
         * The length of impulse-like events (like firing a projectile or hitting a ship) in milliseconds
         */
        MOMENT_DURATION: {
            name: "momentDuration",
            type: _customTypes.DURATION,
            defaultValue: 1
        },
        /**
         * Background objects will be rendered at a point this distance from the camera-space origo, in their set direction.
         */
        BACKGROUND_OBJECT_DISTANCE: {
            name: "backgroundObjectDistance",
            type: "number",
            defaultValue: 4500
        },
        /**
         * When turning, (maneuvering computers of) spacecrafts allow the turn rate to accelerate for a maximum of this duration 
         * (around each axis), in seconds.
         */
        TURN_ACCELERATION_DURATION_S: {
            name: "turnAccelerationDurationInSeconds",
            type: _customTypes.DURATION,
            defaultValue: 0.5
        },
        /**
         * If a muzzle flash particle has no set duration (by its projectile class), this duration will be applied. In milliseconds
         */
        DEFAULT_MUZZLE_FLASH_DURATION: {
            name: "defaultMuzzleFlashDuration",
            type: _customTypes.DURATION,
            defaultValue: 500
        },
        /**
         * If true, spacecrafts can hit themselves with their own projectiles
         */
        SELF_FIRE: {
            name: "selfFire",
            type: "boolean",
            defaultValue: true
        },
        /**
         * The default auto-targeting mode to use
         */
        AUTO_TARGETING: {
            name: "autoTargeting",
            type: "enum",
            values: AutoTargetingMode,
            defaultValue: AutoTargetingMode.HIT_AND_AUTO_TARGET
        },
        /**
         * If no profile name is given, new spacecraft are equipped with the profile having this name, if they have such
         */
        DEFAULT_EQUIPMENT_PROFILE_NAME: {
            name: "defaultEquipmentProfileName",
            type: "string",
            defaultValue: "default"
        },
        /**
         * When displayed, hitboxes will be modulated with this color.
         */
        HITBOX_COLOR: {
            name: "hitboxColor",
            type: _customTypes.COLOR4,
            defaultValue: [0.0, 0.5, 0.5, 0.5]
        },
        /**
         * The texture resource with this name will be applied to hitboxes when they are displayed.
         */
        HITBOX_TEXTURE_NAME: {
            name: "hitboxTexture",
            type: "string",
            defaultValue: "white"
        },
        /**
         * The shader resource with this name will be used for hitboxes when they are displayed.
         */
        HITBOX_SHADER_NAME: {
            name: "hitboxShader",
            type: "string",
            defaultValue: "lambert-with-luminosity"
        },
        /**
         * Views (camera configurations) with this name will be treated as target views (and set to face the current target of the 
         * spacecraft)
         */
        TARGET_VIEW_NAME: {
            name: "targetViewName",
            type: "string",
            defaultValue: "target"
        },
        /**
         * The duration of camera transitions of target views when the target is changed, in milliseconds
         */
        TARGET_CHANGE_TRANSITION_DURATION: {
            name: "targetChangeTransitonDuration",
            type: _customTypes.DURATION,
            defaultValue: 300
        },
        /**
         * The style of camera transitions of target views when the target is changed
         */
        TARGET_CHANGE_TRANSITION_STYLE: {
            name: "targetChangeTransitionStyle",
            type: "enum",
            values: budaScene.Camera.prototype.TransitionStyle,
            defaultValue: budaScene.Camera.prototype.TransitionStyle.SMOOTH
        },
        HUD_CENTER_CROSSHAIR_TEXTURE: {
            name: "hudCenterCrosshairTexture",
            type: "string",
            defaultValue: "crosshair"
        },
        HUD_CENTER_CROSSHAIR_SIZE: {
            name: "hudCenterCrosshairSize",
            type: "array",
            elementType: "number",
            length: 2,
            defaultValue: [0.05, 0.05]
        },
        HUD_CENTER_CROSSHAIR_COLOR: {
            name: "hudCenterCrosshairColor",
            type: _customTypes.COLOR4,
            defaultValue: [0, 1, 0, 0.25]
        },
        HUD_TARGET_ARROW_TEXTURE: {
            name: "hudTargetArrowTexture",
            type: "string",
            defaultValue: "arrow"
        },
        HUD_TARGET_ARROW_SIZE: {
            name: "hudTargetArrowSize",
            type: "array",
            elementType: "number",
            length: 2,
            defaultValue: [0.075, 0.075]
        },
        HUD_TARGET_ARROW_COLOR: {
            name: "hudTargetArrowColor",
            type: _customTypes.COLOR4,
            defaultValue: [1, 0, 0, 0.75]
        },
        HUD_TARGET_INDICATOR_TEXTURE: {
            name: "hudTargetIndicatorTexture",
            type: "string",
            defaultValue: "target"
        },
        HUD_TARGET_INDICATOR_SIZE: {
            name: "hudTargetIndicatorSize",
            type: "array",
            elementType: "number",
            length: 2,
            defaultValue: [0.1, 0.1]
        },
        HUD_TARGET_INDICATOR_COLOR: {
            name: "hudTargetIndicatorColor",
            type: _customTypes.COLOR4,
            defaultValue: [1, 0, 0, 0.75]
        },
        HUD_WEAPON_IMPACT_INDICATOR_TEXTURE: {
            name: "hudWeaponImpactIndicatorTexture",
            type: "string",
            defaultValue: "crosshair"
        },
        HUD_WEAPON_IMPACT_INDICATOR_SIZE: {
            name: "hudWeaponImpactIndicatorSize",
            type: "array",
            elementType: "number",
            length: 2,
            defaultValue: [0.05, 0.05]
        },
        HUD_WEAPON_IMPACT_INDICATOR_COLOR: {
            name: "hudWeaponImpactIndicatorColor",
            type: _customTypes.COLOR4,
            defaultValue: [0, 1, 0, 0.75]
        },
        HUD_WEAPON_IMPACT_INDICATOR_OUT_OF_RANGE_COLOR: {
            name: "hudWeaponImpactIndicatorOutOfRangeColor",
            type: _customTypes.COLOR4
        },
        HUD_TARGET_VIEW_POSITION: {
            name: "hudTargetViewPosition",
            type: "array",
            elementType: "number",
            length: 2
        },
        HUD_TARGET_VIEW_SIZE: {
            name: "hudTargetViewSize",
            type: "array",
            elementType: "number",
            length: 2
        },
        HUD_TARGET_VIEW_VIEW_DISTANCE: {
            name: "hudTargetViewViewDistance",
            type: "number"
        },
        HUD_TARGET_VIEW_FOV: {
            name: "hudTargetViewFOV",
            type: "number"
        },
        HUD_TARGET_VIEW_TARGET_ITEM_SHADER: {
            name: "hudTargetViewTargetItemShader",
            type: "string"
        },
        HUD_TARGET_VIEW_TARGET_ITEM_COLOR: {
            name: "hudTargetViewTargetItemColor",
            type: _customTypes.COLOR4
        },
        DEMO_FIGHTER_AI_TYPE: {
            name: "demoFighterAI",
            type: "string"
        },
        DEMO_VIEW_SWITCH_INTERVAL: {
            name: "demoViewSwitchInterval",
            type: "number"
        },
        DEMO_DOUBLE_VIEW_SWITCH_CHANCE: {
            name: "demoDoubleViewSwitchChance",
            type: "number"
        }
    };
    CAMERA_SETTINGS = {
        DEFAULT_FOV: {
            name: "defaultFOV",
            type: "number"
        },
        DEFAULT_FOV_RANGE: {
            name: "defaultFOVRange",
            type: "array",
            length: 2
        },
        DEFAULT_SPAN: {
            name: "defaultSpan",
            type: "number"
        },
        DEFAULT_SPAN_RANGE: {
            name: "defaultSpanRange",
            type: "array",
            length: 2
        },
        DEFAULT_BASE_ORIENTATION: {
            name: "defaultBaseOrientation",
            type: "enum",
            values: budaScene.CameraOrientationConfiguration.prototype.BaseOrientation
        },
        DEFAULT_POINT_TO_FALLBACK: {
            name: "defaultPointToFallback",
            type: "enum",
            values: budaScene.CameraOrientationConfiguration.prototype.PointToFallback
        }
    };
    Object.freeze(_customTypes);
    Object.freeze(AutoTargetingMode);
    // #########################################################################
    /**
     * @class A class responsible for loading and storing game logic related 
     * settings as well and provide an interface to access them.
     * @extends AsyncResource
     */
    function ConfigurationContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * An object storing all the configuration settings. (verified against CONFIGURATION)
         * @type
         */
        this._configuration = null;
        /**
         * An object storing all the general settings. (properties verified against GENERAL_SETTINGS, BATTLE_SETTINGS, DATABASE_SETTINGS...)
         * @type Object
         */
        this._settings = null;
    }
    ConfigurationContext.prototype = new asyncResource.AsyncResource();
    ConfigurationContext.prototype.constructor = ConfigurationContext;
    /**
     * 
     * @param {Object} configJSON
     */
    ConfigurationContext.prototype.loadConfigurationFromJSON = function (configJSON) {
        this._configuration = types.getVerifiedObject("configuration", configJSON, CONFIGURATION);
    };
    /**
     * Returns the configuration setting value for the passed setting definition object (from CONFIGURATION).
     * @param {Object} settingDefinitionObject
     */
    ConfigurationContext.prototype.getConfigurationSetting = function (settingDefinitionObject) {
        return this._configuration[settingDefinitionObject.name];
    };
    /**
     * Returns the setting value for the passed setting definition object.
     * @param {Object} settingDefinitionObject
     */
    ConfigurationContext.prototype.getSetting = function (settingDefinitionObject) {
        return this._settings[settingDefinitionObject.name];
    };
    /**
     * Returns the default starting field of view value for camera configurations, in degrees
     * @returns {Number}
     */
    ConfigurationContext.prototype.getDefaultCameraFOV = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_FOV);
    };
    /**
     * Returns the default minimum and maximum field of view values for camera configurations, in degrees
     * @returns {Number[2]}
     */
    ConfigurationContext.prototype.getDefaultCameraFOVRange = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_FOV_RANGE);
    };
    /**
     * Returns the default starting span value for camera configurations, in meters
     * @returns {Number}
     */
    ConfigurationContext.prototype.getDefaultCameraSpan = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_SPAN);
    };
    /**
     * Returns the default minimum and maximum span values for camera configurations, in meters
     * @returns {Number[2]}
     */
    ConfigurationContext.prototype.getDefaultCameraSpanRange = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_SPAN_RANGE);
    };
    /**
     * (enum CameraOrientationConfiguration.prototype.BaseOrientation) Returns the default base orientation mode to use for camera 
     * configurations
     * @returns {String}
     */
    ConfigurationContext.prototype.getDefaultCameraBaseOrientation = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_BASE_ORIENTATION);
    };
    /**
     * (enum CameraOrientationConfiguration.prototype.PointToFallback) Returns the default point-to fallback mode to use for camera 
     * configurations
     * @returns {String}
     */
    ConfigurationContext.prototype.getDefaultCameraPointToFallback = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_POINT_TO_FALLBACK);
    };
    /**
     * Returns the number of available level files.
     * @returns {Number}
     */
    ConfigurationContext.prototype.getLevelFileCount = function () {
        return this.getConfigurationSetting(CONFIGURATION.LEVEL_FILES).filenames.length;
    };
    /**
     * Returns the name of the level file (without path) of the given index.
     * @param {number} index
     * @returns {string}
     */
    ConfigurationContext.prototype.getLevelFileName = function (index) {
        return this.getConfigurationSetting(CONFIGURATION.LEVEL_FILES).filenames[index];
    };
    // methods
    /**
     * Loads all the setting and references from the passed JSON object and
     * initiates the request(s) necessary to load additional configuration from
     * referenced files.
     * @param {Object} dataJSON
     */
    ConfigurationContext.prototype.loadSettingsFromJSON = function (dataJSON) {
        this._settings = types.getVerifiedObject("general", dataJSON.general, GENERAL_SETTINGS);
        types.getVerifiedObject("database", dataJSON.database, DATABASE_SETTINGS, this._settings);
        types.getVerifiedObject("battle", dataJSON.battle, BATTLE_SETTINGS, this._settings);
        types.getVerifiedObject("camera", dataJSON.camera, CAMERA_SETTINGS, this._settings);
        classes.requestLoad(this.getConfigurationSetting(CONFIGURATION.CLASSES_SOURCE_FILE), function () {
            this.setToReady();
        }.bind(this));
    };
    _context = new ConfigurationContext();
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        AutoTargetingMode: AutoTargetingMode,
        CONFIGURATION: CONFIGURATION,
        GENERAL_SETTINGS: GENERAL_SETTINGS,
        BATTLE_SETTINGS: BATTLE_SETTINGS,
        DATABASE_SETTINGS: DATABASE_SETTINGS,
        CAMERA_SETTINGS: CAMERA_SETTINGS,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        loadSettingsFromJSON: _context.loadSettingsFromJSON.bind(_context),
        getLevelFileCount: _context.getLevelFileCount.bind(_context),
        getLevelFileName: _context.getLevelFileName.bind(_context),
        getConfigurationSetting: _context.getConfigurationSetting.bind(_context),
        getSetting: _context.getSetting.bind(_context),
        getDefaultCameraFOV: _context.getDefaultCameraFOV.bind(_context),
        getDefaultCameraFOVRange: _context.getDefaultCameraFOVRange.bind(_context),
        getDefaultCameraSpan: _context.getDefaultCameraSpan.bind(_context),
        getDefaultCameraSpanRange: _context.getDefaultCameraSpanRange.bind(_context),
        getDefaultCameraBaseOrientation: _context.getDefaultCameraBaseOrientation.bind(_context),
        getDefaultCameraPointToFallback: _context.getDefaultCameraPointToFallback.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context)
    };
});