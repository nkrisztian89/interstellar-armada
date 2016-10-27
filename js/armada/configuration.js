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
 * @param utils Used for accessing the ScaleMode enum
 * @param types Used for verifying the types of settings loaded from JSON
 * @param asyncResource ConfigurationContext is a subclass of AsyncResource
 * @param camera Used for accessing the enum types in this module
 * @param classes Loading the game configuration initiates loading the classes.
 */
define([
    "utils/utils",
    "utils/types",
    "modules/async-resource",
    "modules/scene/camera",
    "armada/classes"
], function (utils, types, asyncResource, camera, classes) {
    "use strict";
    var
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
    _customTypes.LIGHT_SOURCE = {
        baseType: "object",
        properties: {
            COLOR: {
                name: "color",
                type: types.COLOR3
            },
            DIRECTION: {
                name: "direction",
                type: types.VECTOR3
            }
        }
    };
    _customTypes.LAYOUT_DESCRIPTOR = {
        baseType: "object",
        properties: {
            LEFT: {
                name: "left",
                type: "number",
                optional: true
            },
            CENTER_X: {
                name: "centerX",
                type: "number",
                optional: true
            },
            RIGHT: {
                name: "right",
                type: "number",
                optional: true
            },
            TOP: {
                name: "top",
                type: "number",
                optional: true
            },
            CENTER_Y: {
                name: "centerY",
                type: "number",
                optional: true
            },
            BOTTOM: {
                name: "bottom",
                type: "number",
                optional: true
            },
            WIDTH: {
                name: "width",
                type: "number",
                optional: true
            },
            HEIGHT: {
                name: "height",
                type: "number",
                optional: true
            },
            SCALE_MODE: {
                name: "scaleMode",
                type: "enum",
                values: utils.ScaleMode
            },
            X_SCALE_MODE: {
                name: "xScaleMode",
                type: "enum",
                values: utils.ScaleMode,
                optional: true
            },
            Y_SCALE_MODE: {
                name: "yScaleMode",
                type: "enum",
                values: utils.ScaleMode,
                optional: true
            }
        }
    };
    /**
     * Defines the coordinates for the top-left and bottom-right corners (or other corners if flipped horizontally or vertically) of a
     * texture within an image, in texture space ((0;0) is top-left, (1;1) is bottom-right of the image)
     * @type Object
     */
    _customTypes.TEXTURE_MAPPING = {
        baseType: "array",
        elementType: types.VECTOR2,
        length: 2
    };
    _customTypes.UI_IMAGE_DESCRIPTOR = {
        baseType: "object",
        properties: {
            TEXTURE: {
                name: "texture",
                type: "string"
            },
            MAPPING: {
                name: "mapping",
                type: _customTypes.TEXTURE_MAPPING,
                optional: true
            },
            SIZE: {
                name: "size",
                type: types.VECTOR2
            },
            SCALE_MODE: {
                name: "scaleMode",
                type: "enum",
                values: utils.ScaleMode
            },
            COLOR: {
                name: "color",
                type: types.COLOR4
            }
        }
    };
    /**
     * Returns a type descriptor to use for UI images that have multiple colors and/or texture mappings instead of a single one
     * @param {String[]} [mappings] The names (identifiers) of the mappings. E.g. for describing "mappings": {"active": [...], "inactive": [...]},
     * use ["active", "inactive"] If omitted, a single "mapping" property is optional (as in UI_IMAGE_DESCRIPTOR)
     * @param {String[]} [colors] The same as mappings. If omitted, a single "color" property is expected (as in UI_IMAGE_DESCRIPTOR)
     * @returns {Object}
     */
    _customTypes.getCustomUIImageDescriptor = function (mappings, colors) {
        var i, result = utils.deepCopy(_customTypes.UI_IMAGE_DESCRIPTOR);
        if (mappings) {
            delete result.properties.MAPPING;
            result.properties.MAPPINGS = {
                name: "mappings",
                type: {
                    baseType: "object",
                    properties: {}
                }
            };
            for (i = 0; i < mappings.length; i++) {
                result.properties.MAPPINGS.type.properties[mappings[i].toUpperCase()] = {
                    name: mappings[i],
                    type: _customTypes.TEXTURE_MAPPING
                };
            }
        }
        if (colors) {
            delete result.properties.COLOR;
            result.properties.COLORS = {
                name: "colors",
                type: {
                    baseType: "object",
                    properties: {}
                }
            };
            for (i = 0; i < colors.length; i++) {
                result.properties.COLORS.type.properties[colors[i].toUpperCase()] = {
                    name: colors[i],
                    type: types.COLOR4
                };
            }
        }
        return result;
    };
    _customTypes.TEXT_DESCRIPTOR = {
        baseType: "object",
        properties: {
            COLOR: {
                name: "color",
                type: types.COLOR4
            },
            FONT_SIZE: {
                name: "fontSize",
                type: "number"
            },
            FONT_NAME: {
                name: "fontName",
                type: "string"
            },
            POSITION: {
                name: "position",
                type: types.VECTOR2
            }
        }
    };
    /**
     * Returns a type descriptor to use for UI texts that have multiple colors and/or positions instead of a single one
     * @param {String[]} [colors] The names (identifiers) of the colors. E.g. for describing "colors": {"active": [...], "inactive": [...]},
     * use ["active", "inactive"] If omitted, a single "color" property is expected (as in TEXT_DESCRIPTOR)
     * @param {String[]} [positions] The same as colors. If omitted, a single "position" property is expected (as in TEXT_DESCRIPTOR)
     * @returns {Object}
     */
    _customTypes.getCustomTextDescriptor = function (colors, positions) {
        var i, result = utils.deepCopy(_customTypes.TEXT_DESCRIPTOR);
        if (colors) {
            delete result.properties.COLOR;
            result.properties.COLORS = {
                name: "colors",
                type: {
                    baseType: "object",
                    properties: {}
                }
            };
            for (i = 0; i < colors.length; i++) {
                result.properties.COLORS.type.properties[colors[i].toUpperCase()] = {
                    name: colors[i],
                    type: types.COLOR4
                };
            }
        }
        if (positions) {
            delete result.properties.POSITION;
            result.properties.POSITIONS = {
                name: "positions",
                type: {
                    baseType: "object",
                    properties: {}
                }
            };
            for (i = 0; i < positions.length; i++) {
                result.properties.POSITIONS.type.properties[positions[i].toUpperCase()] = {
                    name: positions[i],
                    type: types.VECTOR2
                };
            }
        }
        return result;
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
                    FILENAME: {
                        name: "filename",
                        type: "string"
                    },
                    FOLDER: {
                        name: "folder",
                        type: "string"
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
         * The uniform with the corresponding (pre- and suffixed) name will be used in the spacecraft shader to pass the group transform
         * values of the various triangle groups.
         */
        UNIFORM_GROUP_TRANSFORMS_ARRAY_NAME: {
            name: "groupTransformsArrayName",
            type: "string",
            defaultValue: "groupTransforms"
        },
        /**
         * Whether to interpret given field of view, span and other camera property values as vertical or horizontal.
         */
        USE_VERTICAL_CAMERA_VALUES: {
            name: "useVerticalCameraValues",
            type: "boolean",
            defaultValue: true
        },
        /**
         * The ID (resource name) of the song (MusicResource) that should play when the menus are shown.
         */
        MENU_MUSIC: {
            name: "menuMusic",
            type: "string"
        },
        /**
         * The default duration of the fade in of music themes (when no theme is playing), in seconds
         */
        MUSIC_FADE_IN_DURATION: {
            name: "musicFadeInDuration",
            type: "number"
        },
        /**
         * The default duration of the crossfade between different music themes (e.g. anticipation -> combat), in seconds
         */
        THEME_CROSSFADE_DURATION: {
            name: "themeCrossfadeDuration",
            type: "number"
        },
        /**
         * The default duration of the fade out of music themes (when no theme is following), in seconds
         */
        MUSIC_FADE_OUT_DURATION: {
            name: "musicFadeOutDuration",
            type: "number"
        },
        /**
         * The descriptor for the sound effect that should play when the player selects a button on a screen (hover over / navigates to it
         * with the keyboard)
         */
        BUTTON_SELECT_SOUND: {
            name: "buttonSelectSound",
            type: classes.SOUND_EFFECT_2D
        },
        /**
         * The descriptor for the sound effect that should play when the player clicks / activates a button on a screen 
         */
        BUTTON_CLICK_SOUND: {
            name: "buttonClickSound",
            type: classes.SOUND_EFFECT_2D
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
            type: types.COLOR4,
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
            type: types.COLOR4,
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
            type: types.ANGLE_DEGREES,
            defaultValue: 90
        },
        /**
         * When starting the rotation animation without the reveal animation, the rotation angle will initially be set to this (in degrees)
         */
        ROTATION_START_ANGLE: {
            name: "rotationStartAngle",
            type: types.ANGLE_DEGREES,
            defaultValue: 180
        },
        /**
         * The viewing angle that remains constant as the models rotate in the database (in degrees)
         */
        ROTATION_VIEW_ANGLE: {
            name: "rotationViewAngle",
            type: types.ANGLE_DEGREES,
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
            type: types.COLOR4,
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
            type: types.DURATION,
            defaultValue: 2000
        },
        /**
         * This much delay will be applied between the revealing of the wireframe and the solid models, in milliseconds
         */
        REVEAL_SOLID_DELAY_DURATION: {
            name: "revealSolidDelayDuration",
            type: types.DURATION,
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
        MINIMUM_PROJECTILE_COUNT_FOR_INSTANCING: {
            name: "minimumProjectileCountForInstancing",
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
            values: camera.Camera.prototype.TransitionStyle,
            defaultValue: camera.Camera.prototype.TransitionStyle.SMOOTH
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
            values: camera.Camera.prototype.TransitionStyle,
            defaultValue: camera.Camera.prototype.TransitionStyle.SMOOTH
        },
        /**
         * The length of impulse-like events (like firing a projectile or hitting a ship) in milliseconds
         */
        MOMENT_DURATION: {
            name: "momentDuration",
            type: types.DURATION,
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
            type: types.DURATION
        },
        /**
         * When moving forward in compensated flight modes, the controlled spacecraft will accelerate to maximum a speed 
         * that equals its acceleration multiplied by this factor.
         */
        COMPENSATED_FORWARD_SPEED_FACTOR: {
            name: "compensatedForwardSpeedFactor",
            type: "number"
        },
        /**
         * When moving backward in compensated flight modes, the controlled spacecraft will accelerate to maximum a reverse speed 
         * that equals its acceleration multiplied by this factor.
         */
        COMPENSATED_REVERSE_SPEED_FACTOR: {
            name: "compensatedReverseSpeedFactor",
            type: "number"
        },
        /**
         * When strafing, the controlled spacecraft will accelerate to maximum a speed (along the strafing axis) that equals its acceleration 
         * multiplied by this factor.
         */
        STRAFE_SPEED_FACTOR: {
            name: "strafeSpeedFactor",
            type: "number"
        },
        /**
         * If a muzzle flash particle has no set duration (by its projectile class), this duration will be applied. In milliseconds
         */
        DEFAULT_MUZZLE_FLASH_DURATION: {
            name: "defaultMuzzleFlashDuration",
            type: types.DURATION,
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
            type: types.COLOR4,
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
            defaultValue: "oneColor"
        },
        /**
         * When true, those hitboxes are visible, for which actual hitchecks are calculated (and manual toggling of hitbox visibility
         * is disabled)
         */
        SHOW_HITBOXES_FOR_HITCHECKS: {
            name: "showHitboxesForHitchecks",
            type: "boolean"
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
            type: types.DURATION,
            defaultValue: 300
        },
        /**
         * The style of camera transitions of target views when the target is changed
         */
        TARGET_CHANGE_TRANSITION_STYLE: {
            name: "targetChangeTransitionStyle",
            type: "enum",
            values: camera.Camera.prototype.TransitionStyle
        },
        /**
         * The amount of time to wait after the game state changes to victory or defeat before actually displaying the result. (as for
         * example incoming projectiles destroying the player's ship right after victory can change the state to defeat)
         */
        GAME_STATE_DISPLAY_DELAY: {
            name: "gameStateDisplayDelay",
            type: "number"
        },
        HUD_TARGET_SWITCH_ANIMATION_DURATION: {
            name: "hudTargetSwitchAnimationDuration",
            type: "number"
        },
        HUD_HULL_INTEGRITY_DECREASE_ANIMATION_DURATION: {
            name: "hudHullIntegrityDecreaseAnimationDuration",
            type: "number"
        },
        HUD_TARGET_HULL_INTEGRITY_DECREASE_ANIMATION_DURATION: {
            name: "hudTargetHullIntegrityDecreaseAnimationDuration",
            type: "number"
        },
        HUD_CENTER_CROSSHAIR: {
            name: "hudCenterCrosshair",
            type: _customTypes.UI_IMAGE_DESCRIPTOR
        },
        HUD_CURSOR: {
            name: "hudCursor",
            type: _customTypes.getCustomUIImageDescriptor(["still", "turn"])
        },
        HUD_TARGET_ARROW: {
            name: "hudTargetArrow",
            type: _customTypes.getCustomUIImageDescriptor(undefined, ["hostile", "friendly"])
        },
        HUD_TARGET_ARROW_POSITION_RADIUS: {
            name: "hudTargetArrowPositionRadius",
            type: "number"
        },
        HUD_TARGET_ARROW_SWITCH_SCALE: {
            name: "hudTargetArrowSwitchScale",
            type: "number"
        },
        HUD_TARGET_INDICATOR: {
            name: "hudTargetIndicator",
            type: _customTypes.getCustomUIImageDescriptor(undefined, ["hostile", "friendly"])
        },
        HUD_TARGET_INDICATOR_SWITCH_SCALE: {
            name: "hudTargetIndicatorSwitchScale",
            type: "number"
        },
        HUD_AIM_ASSIST_INDICATOR: {
            name: "hudAimAssistIndicator",
            type: _customTypes.getCustomUIImageDescriptor(undefined, ["hostile", "friendly"])
        },
        HUD_WEAPON_IMPACT_INDICATOR: {
            name: "hudWeaponImpactIndicator",
            type: _customTypes.getCustomUIImageDescriptor(undefined, ["normal", "outOfRange"])
        },
        HUD_WEAPON_IMPACT_INDICATOR_SWITCH_SCALE: {
            name: "hudWeaponImpactIndicatorSwitchScale",
            type: "number"
        },
        HUD_TARGET_VIEW_LAYOUT: {
            name: "hudTargetViewLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
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
        HUD_TARGET_VIEW_TARGET_ITEM_FULL_INTEGRITY_COLOR: {
            name: "hudTargetViewTargetItemFullIntegrityColor",
            type: types.COLOR4
        },
        HUD_TARGET_VIEW_TARGET_ITEM_HALF_INTEGRITY_COLOR: {
            name: "hudTargetViewTargetItemHalfIntegrityColor",
            type: types.COLOR4
        },
        HUD_TARGET_VIEW_TARGET_ITEM_ZERO_INTEGRITY_COLOR: {
            name: "hudTargetViewTargetItemZeroIntegrityColor",
            type: types.COLOR4
        },
        HUD_TARGET_INFO_BACKGROUND_TEXTURE: {
            name: "hudTargetInfoBackgroundTexture",
            type: "string"
        },
        HUD_TARGET_INFO_BACKGROUND_TEXTURE_MAPPING: {
            name: "hudTargetInfoBackgroundTextureMapping",
            type: _customTypes.TEXTURE_MAPPING
        },
        HUD_TARGET_INFO_BACKGROUND_LAYOUT: {
            name: "hudTargetInfoBackgroundLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_TARGET_INFO_BACKGROUND_COLOR: {
            name: "hudTargetInfoBackgroundColor",
            type: types.COLOR4
        },
        HUD_TARGET_HULL_INTEGRITY_BAR_TEXTURE: {
            name: "hudTargetHullIntegrityBarTexture",
            type: "string"
        },
        HUD_TARGET_HULL_INTEGRITY_BAR_TEXTURE_MAPPING: {
            name: "hudTargetHullIntegrityBarTextureMapping",
            type: _customTypes.TEXTURE_MAPPING
        },
        HUD_TARGET_HULL_INTEGRITY_BAR_LAYOUT: {
            name: "hudTargetHullIntegrityBarLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_TARGET_HULL_INTEGRITY_BAR_FILLED_COLOR: {
            name: "hudTargetHullIntegrityBarFilledColor",
            type: types.COLOR4
        },
        HUD_TARGET_HULL_INTEGRITY_BAR_EMPTY_COLOR: {
            name: "hudTargetHullIntegrityBarEmptyColor",
            type: types.COLOR4
        },
        HUD_TARGET_INFO_TEXT_LAYER_LAYOUT: {
            name: "hudTargetInfoTextLayerLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_TARGET_INFO_TEXT: {
            name: "hudTargetInfoText",
            type: _customTypes.getCustomTextDescriptor(["hostile", "friendly"], ["name", "class", "team", "distance", "velocity"])
        },
        HUD_SPEED_BAR_TEXTURE: {
            name: "hudSpeedBarTexture",
            type: "string"
        },
        HUD_SPEED_BAR_TEXTURE_MAPPING: {
            name: "hudSpeedBarTextureMapping",
            type: _customTypes.TEXTURE_MAPPING
        },
        HUD_SPEED_BAR_LAYOUT: {
            name: "hudSpeedBarLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_SPEED_BAR_FILLED_COLOR: {
            name: "hudSpeedBarFilledColor",
            type: types.COLOR4
        },
        HUD_SPEED_BAR_EMPTY_COLOR: {
            name: "hudSpeedBarEmptyColor",
            type: types.COLOR4
        },
        HUD_REVERSE_SPEED_BAR_FILLED_COLOR: {
            name: "hudReverseSpeedBarFilledColor",
            type: types.COLOR4
        },
        HUD_REVERSE_SPEED_BAR_EMPTY_COLOR: {
            name: "hudReverseSpeedBarEmptyColor",
            type: types.COLOR4
        },
        HUD_SPEED_BAR_BASE_MAX_SPEED_FACTOR: {
            name: "hudSpeedBarBaseMaxSpeedFactor",
            type: "number"
        },
        HUD_SPEED_BAR_DEFAULT_BASE_MAX_SPEED: {
            name: "hudSpeedBarDefaultBaseMaxSpeed",
            type: "number"
        },
        HUD_SPEED_BAR_MAX_SPEED_STEP_FACTOR: {
            name: "hudSpeedBarMaxSpeedStepFactor",
            type: "number"
        },
        HUD_SPEED_TEXT_LAYER_LAYOUT: {
            name: "hudSpeedTextLayerLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_SPEED_TEXT: {
            name: "hudSpeedText",
            type: _customTypes.getCustomTextDescriptor(["forward", "reverse"], ["maxForward", "maxReverse"])
        },
        HUD_SPEED_TARGET_INDICATOR_TEXTURE: {
            name: "hudSpeedTargetIndicatorTexture",
            type: "string"
        },
        HUD_SPEED_TARGET_INDICATOR_TEXTURE_MAPPING: {
            name: "hudSpeedTargetIndicatorTextureMapping",
            type: _customTypes.TEXTURE_MAPPING
        },
        HUD_SPEED_TARGET_INDICATOR_COLOR: {
            name: "hudSpeedTargetIndicatorColor",
            type: types.COLOR4
        },
        HUD_SPEED_TARGET_INDICATOR_SIZE: {
            name: "hudSpeedTargetIndicatorSize",
            type: types.VECTOR2
        },
        HUD_HULL_INTEGRITY_BAR_TEXTURE: {
            name: "hudHullIntegrityBarTexture",
            type: "string"
        },
        HUD_HULL_INTEGRITY_BAR_TEXTURE_MAPPING: {
            name: "hudHullIntegrityBarTextureMapping",
            type: _customTypes.TEXTURE_MAPPING
        },
        HUD_HULL_INTEGRITY_BAR_LAYOUT: {
            name: "hudHullIntegrityBarLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_HULL_INTEGRITY_BAR_FILLED_COLOR: {
            name: "hudHullIntegrityBarFilledColor",
            type: types.COLOR4
        },
        HUD_HULL_INTEGRITY_BAR_EMPTY_COLOR: {
            name: "hudHullIntegrityBarEmptyColor",
            type: types.COLOR4
        },
        HUD_HULL_INTEGRITY_BAR_FILLED_COLOR_WHEN_DECREASING: {
            name: "hudHullIntegrityBarFilledColorWhenDecreasing",
            type: types.COLOR4
        },
        HUD_HULL_INTEGRITY_BAR_EMPTY_COLOR_WHEN_DECREASING: {
            name: "hudHullIntegrityBarEmptyColorWhenDecreasing",
            type: types.COLOR4
        },
        HUD_FLIGHT_MODE_INDICATOR_BACKGROUND_TEXTURE: {
            name: "hudFlightModeIndicatorBackgroundTexture",
            type: "string"
        },
        HUD_FLIGHT_MODE_INDICATOR_BACKGROUND_TEXTURE_MAPPING: {
            name: "hudFlightModeIndicatorBackgroundTextureMapping",
            type: _customTypes.TEXTURE_MAPPING
        },
        HUD_FLIGHT_MODE_INDICATOR_BACKGROUND_LAYOUT: {
            name: "hudFlightModeIndicatorBackgroundLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_FLIGHT_MODE_INDICATOR_BACKGROUND_COLOR: {
            name: "hudFlightModeIndicatorBackgroundColor",
            type: types.COLOR4
        },
        HUD_FLIGHT_MODE_HEADER_TEXT: {
            name: "hudFlightModeHeaderText",
            type: _customTypes.TEXT_DESCRIPTOR
        },
        HUD_FLIGHT_MODE_TEXT: {
            name: "hudFlightModeText",
            type: _customTypes.getCustomTextDescriptor(["free", "compensated", "restricted"])
        },
        HUD_DRIFT_ARROW_TEXTURE: {
            name: "hudDriftArrowTexture",
            type: "string"
        },
        HUD_DRIFT_ARROW_TEXTURE_MAPPING: {
            name: "hudDriftArrowTextureMapping",
            type: _customTypes.TEXTURE_MAPPING
        },
        HUD_DRIFT_ARROW_POSITION_RADIUS: {
            name: "hudDriftArrowPositionRadius",
            type: "number"
        },
        HUD_DRIFT_ARROW_SIZE: {
            name: "hudDriftArrowSize",
            type: types.VECTOR2
        },
        HUD_DRIFT_ARROW_SCALE_MODE: {
            name: "hudDriftArrowScaleMode",
            type: "enum",
            values: utils.ScaleMode
        },
        HUD_DRIFT_ARROW_MIN_SPEED_COLOR: {
            name: "hudDriftArrowMinSpeedColor",
            type: types.COLOR4
        },
        HUD_DRIFT_ARROW_MAX_SPEED_COLOR: {
            name: "hudDriftArrowMaxSpeedColor",
            type: types.COLOR4
        },
        HUD_DRIFT_ARROW_MIN_SPEED: {
            name: "hudDriftArrowMinSpeed",
            type: "number"
        },
        HUD_DRIFT_ARROW_MAX_SPEED_FACTOR: {
            name: "hudDriftArrowMaxSpeedFactor",
            type: "number"
        },
        HUD_TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR_TEXTURE: {
            name: "hudTargetHullIntegrityQuickViewBarTexture",
            type: "string"
        },
        HUD_TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR_TEXTURE_MAPPING: {
            name: "hudTargetHullIntegrityQuickViewBarTextureMapping",
            type: _customTypes.TEXTURE_MAPPING
        },
        HUD_TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR_LAYOUT: {
            name: "hudTargetHullIntegrityQuickViewBarLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR_HOSTILE_FILLED_COLOR: {
            name: "hudTargetHullIntegrityQuickViewBarHostileFilledColor",
            type: types.COLOR4
        },
        HUD_TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR_HOSTILE_EMPTY_COLOR: {
            name: "hudTargetHullIntegrityQuickViewBarHostileEmptyColor",
            type: types.COLOR4
        },
        HUD_TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR_FRIENDLY_FILLED_COLOR: {
            name: "hudTargetHullIntegrityQuickViewBarFriendlyFilledColor",
            type: types.COLOR4
        },
        HUD_TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR_FRIENDLY_EMPTY_COLOR: {
            name: "hudTargetHullIntegrityQuickViewBarFriendlyEmptyColor",
            type: types.COLOR4
        },
        HUD_TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR_FILLED_COLOR_WHEN_DECREASING: {
            name: "hudTargetHullIntegrityQuickViewBarFilledColorWhenDecreasing",
            type: types.COLOR4
        },
        HUD_HEADER_TEXT_LAYER_LAYOUT: {
            name: "hudHeaderTextLayerLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_SMALL_HEADER_TEXT: {
            name: "hudSmallHeaderText",
            type: _customTypes.TEXT_DESCRIPTOR
        },
        HUD_BIG_HEADER_TEXT: {
            name: "hudBigHeaderText",
            type: _customTypes.TEXT_DESCRIPTOR
        },
        HUD_SUBHEADER_TEXT: {
            name: "hudSubheaderText",
            type: _customTypes.TEXT_DESCRIPTOR
        },
        HUD_TOP_LEFT_TEXT_LAYER_LAYOUT: {
            name: "hudTopLeftTextLayerLayout",
            type: _customTypes.LAYOUT_DESCRIPTOR
        },
        HUD_SCORE_TEXT: {
            name: "hudScoreText",
            type: _customTypes.TEXT_DESCRIPTOR
        },
        HUD_TARGET_SWITCH_SOUND: {
            name: "hudTargetSwitchSound",
            type: classes.SOUND_EFFECT_2D
        },
        HUD_TARGET_SWITCH_DENIED_SOUND: {
            name: "hudTargetSwitchDeniedSound",
            type: classes.SOUND_EFFECT_2D
        },
        WEAPON_FIRE_SOUND_STACK_MINIMUM_DISTANCE: {
            name: "weaponFireSoundStackMinimumDistance",
            type: "number"
        },
        /**
         * Two (or more) hit sound effects will be stacked if the difference between their starting time
         * is less than this amount (in seconds)
         */
        HIT_SOUND_STACKING_TIME_THRESHOLD: {
            name: "hitSoundStackingTimeThreshold",
            type: "number"
        },
        /**
         * When two (or more) hit sound effects are stacked, each additional sound effect increases the
         * volume of the first effect by its volume multiplied by this factor
         */
        HIT_SOUND_STACKING_VOLUME_FACTOR: {
            name: "hitSoundStackingVolumeFactor",
            type: "number"
        },
        /**
         * Two (or more) fire sound effects will be stacked if the difference between their starting time
         * is less than this amount (in seconds)
         */
        FIRE_SOUND_STACKING_TIME_THRESHOLD: {
            name: "fireSoundStackingTimeThreshold",
            type: "number"
        },
        /**
         * When two (or more) fire sound effects are stacked, each additional sound effect increases the
         * volume of the first effect by its volume multiplied by this factor
         */
        FIRE_SOUND_STACKING_VOLUME_FACTOR: {
            name: "fireSoundStackingVolumeFactor",
            type: "number"
        },
        DEMO_FIGHTER_AI_TYPE: {
            name: "demoFighterAI",
            type: "string"
        },
        DEMO_SHIP_AI_TYPE: {
            name: "demoShipAI",
            type: "string"
        },
        DEMO_VIEW_SWITCH_INTERVAL: {
            name: "demoViewSwitchInterval",
            type: "number"
        },
        DEMO_DOUBLE_VIEW_SWITCH_CHANCE: {
            name: "demoDoubleViewSwitchChance",
            type: "number"
        },
        /**
         * When the ingame menu is opened (or another screen is opened from within it), the music volume will be changed by this factor
         */
        MUSIC_VOLUME_IN_MENUS: {
            name: "musicVolumeInMenus",
            type: "number"
        },
        /**
         * The ID (resource name) of the song (MusicResource) that should play during battles while there are no hostile spacecrafts.
         */
        AMBIENT_MUSIC: {
            name: "ambientMusic",
            type: "string"
        },
        /**
         * The ID (resource name) of the song (MusicResource) that should play during battles while there are hostiles, but there is no
         * fighting.
         */
        ANTICIPATION_MUSIC: {
            name: "anticipationMusic",
            type: "string"
        },
        /**
         * The ID (resource name) of the song (MusicResource) that should play during battles while fighting is going on.
         */
        COMBAT_MUSIC: {
            name: "combatMusic",
            type: "string"
        },
        /**
         * The ID (resource name) of the song (MusicResource) that should play when a battle is won.
         */
        VICTORY_MUSIC: {
            name: "victoryMusic",
            type: "string"
        },
        /**
         * The ID (resource name) of the song (MusicResource) that should play when a battle is lost.
         */
        DEFEAT_MUSIC: {
            name: "defeatMusic",
            type: "string"
        },
        /**
         * The duration while the combat theme is kept playing during battle after a spacecraft fires at a hostile target, in seconds
         */
        COMBAT_THEME_DURATION_AFTER_FIRE: {
            name: "combatThemeDurationAfterFire",
            type: "number"
        },
        /**
         * The duration of the crossfade to the ending music themes (victory / defeat) during battle, in seconds
         */
        END_THEME_CROSSFADE_DURATION: {
            name: "endThemeCrossfadeDuration",
            type: "number"
        },
        /**
         * The ratio of score points that should be awarded for destroying an enemy. E.g. 0.2 means that 20% of score points should be 
         * awarded for the kill to the spacecraft which delivered the final hit, and 80% for the damage, proportionally to all spacecrafts
         * which dealt it
         */
        SCORE_FRACTION_FOR_KILL: {
            name: "scoreFractionForKill",
            type: {
                baseType: "number",
                range: [0, 1]
            }
        },
        /**
         * The amount of score points awarded for the player if an individual mission (no teammates) is completed with full hull integrity. 
         * If the player's ship is damaged, the bonus is proportional to the amount of hull integrity left.
         */
        SCORE_BONUS_FOR_HULL_INTEGRITY: {
            name: "scoreBonusForHullIntegrity",
            type: "number"
        },
        /**
         * The amount of score points awarded for the player if a team mission (the player has teammates) is completed with full hull 
         * integrity. If the player's ship is damaged, the bonus is proportional to the amount of hull integrity left.
         */
        SCORE_BONUS_FOR_HULL_INTEGRITY_TEAM: {
            name: "scoreBonusForHullIntegrityTeam",
            type: "number"
        },
        /**
         * The amount of score points awarded for the player if a team mission (the player has teammates) is completed with all teammates
         * surviving. If some teammates fall, the bonus is proportional to the ratio of surviving teammates.
         */
        SCORE_BONUS_FOR_TEAM_SURVIVAL: {
            name: "scoreBonusForTeamSurvival",
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
            type: types.VECTOR2
        },
        DEFAULT_SPAN: {
            name: "defaultSpan",
            type: "number"
        },
        DEFAULT_SPAN_RANGE: {
            name: "defaultSpanRange",
            type: types.VECTOR2
        },
        DEFAULT_BASE_ORIENTATION: {
            name: "defaultBaseOrientation",
            type: "enum",
            values: camera.CameraOrientationConfiguration.prototype.BaseOrientation
        },
        DEFAULT_POINT_TO_FALLBACK: {
            name: "defaultPointToFallback",
            type: "enum",
            values: camera.CameraOrientationConfiguration.prototype.PointToFallback
        }
    };
    Object.freeze(_customTypes);
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
        CONFIGURATION: CONFIGURATION,
        GENERAL_SETTINGS: GENERAL_SETTINGS,
        BATTLE_SETTINGS: BATTLE_SETTINGS,
        DATABASE_SETTINGS: DATABASE_SETTINGS,
        CAMERA_SETTINGS: CAMERA_SETTINGS,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        loadSettingsFromJSON: _context.loadSettingsFromJSON.bind(_context),
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