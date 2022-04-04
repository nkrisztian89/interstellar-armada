/**
 * Copyright 2014-2022 Krisztián Nagy
 * @file Stores the current game configuration and settings and provides functions to load and access them.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for accessing the ScaleMode enum
 * @param types Used for verifying the types of settings loaded from JSON
 * @param asyncResource ConfigurationContext is a subclass of AsyncResource
 * @param camera Used for accessing the enum types in this module
 * @param classes Loading the game configuration initiates loading the classes.
 * @param constants Used to access common game constants
 */
define([
    "utils/utils",
    "utils/types",
    "modules/async-resource",
    "modules/scene/camera",
    "armada/logic/classes",
    "armada/constants"
], function (utils, types, asyncResource, camera, classes, constants) {
    "use strict";
    var
            // --------------------------------------------------------------------------------------------
            /**
             * All location IDs where setting values are stored in local storage are prefixed by this value.
             * @type String
             */
            MODULE_LOCAL_STORAGE_PREFIX = constants.LOCAL_STORAGE_PREFIX + "settings_",
            /**
             * The separator character used in local storage IDs which are joined together from multiple parts
             * @type String
             */
            LOCAL_STORAGE_SEPARATOR = "_",
            // --------------------------------------------------------------------------------------------
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
             * The definition object for multiplayer settings that can be used to verify the data loaded from JSON as well as refer to the 
             * individual settings later.
             * @type Object
             */
            MULTI_SETTINGS,
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
             * The full prefix to use for local storage IDs of HUD settings
             * @type String
             */
            LOCAL_STORAGE_HUD_PREFIX,
            /**
             * The full prefix to use for local storage IDs of battle settings
             * @type String
             */
            LOCAL_STORAGE_BATTLE_PREFIX,
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
    _customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR = {
        baseType: "object",
        properties: {
            TEXTURE: {
                name: "texture",
                type: "string"
            },
            MAPPING: {
                name: "mapping",
                type: _customTypes.TEXTURE_MAPPING
            },
            LAYOUT: {
                name: "layout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            COLOR: {
                name: "color",
                type: types.COLOR4
            }
        }
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
            },
            LAYOUT: {
                name: "layout",
                type: _customTypes.LAYOUT_DESCRIPTOR,
                optional: true
            }
        }
    };
    _customTypes.CRAFT_INDICATOR_POSITIONS = {
        baseType: "array", // how many crafts are in the wing
        elementType: {
            baseType: "array", // which craft is it within the wing
            elementType: types.VECTOR2 // relative position (within the wing layout) of the craft on the wingmen indicator panel
        }
    };
    _customTypes.NUMBER_ARRAY = {
        baseType: "array",
        elementType: "number"
    };
    _customTypes.STRING_ARRAY = {
        baseType: "array",
        elementType: "string"
    };
    /**
     * Creates and returns a new type descriptor based on the passed one, changing some of its property descriptors
     * @param {Object} baseDescriptor
     * @param {Object.<String, String[]>} customProperties Changes the given simple property descriptors e.g. passing 
     * {COLOR: ["active", "passive"]} will make the COLOR property descriptor in such way that if it expected "color": [r,g,b,a] properties,
     * now it will expect "colors": {"active": [r,g,b,a], "passive": [r,g,b,a]} properties instead
     * @param {String[]} [missingProperties] These properties will be deleted from the descriptor
     * @returns {Object}
     */
    _customTypes.getCustomDescriptor = function (baseDescriptor, customProperties, missingProperties) {
        var i, j, result = utils.deepCopy(baseDescriptor), customPropDescNames, propertyDescriptor;
        customPropDescNames = Object.keys(customProperties);
        for (i = 0; i < customPropDescNames.length; i++) {
            propertyDescriptor = result.properties[customPropDescNames[i]];
            result.properties[customPropDescNames[i] + "S"] = {
                name: propertyDescriptor.name + "s",
                type: {
                    baseType: "object",
                    properties: {}
                }
            };
            for (j = 0; j < customProperties[customPropDescNames[i]].length; j++) {
                result.properties[customPropDescNames[i] + "S"].type.properties[customProperties[customPropDescNames[i]][j].toUpperCase()] = {
                    name: customProperties[customPropDescNames[i]][j],
                    type: propertyDescriptor.type
                };
            }
            delete result.properties[customPropDescNames[i]];
        }
        if (missingProperties) {
            for (i = 0; i < missingProperties.length; i++) {
                delete result.properties[missingProperties[i]];
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
        MISSION_FILES: {
            name: "missions",
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
            type: classes.SOUND_EFFECT
        },
        /**
         * The descriptor for the sound effect that should play when the player clicks / activates a button on a screen 
         */
        BUTTON_CLICK_SOUND: {
            name: "buttonClickSound",
            type: classes.SOUND_EFFECT
        }
    };
    MULTI_SETTINGS = {
        /**
         * Which max player number options can the host choose for a new game
         */
        MAX_PLAYER_OPTIONS: {
            name: "maxPlayerOptions",
            type: _customTypes.NUMBER_ARRAY
        },
        /**
         * Which allowed spacecrafts can the host choose for a new game
         */
        SPACECRAFTS: {
            name: "spacecrafts",
            type: _customTypes.STRING_ARRAY
        },
        /**
         * Which spacecrafts loadouts can the host choose for the players
         */
        LOADOUTS: {
            name: "loadouts",
            type: _customTypes.STRING_ARRAY
        },
        /**
         * In multiplayer, the "slow connection" message is shown to the guest
         * player, if it doesn't get any updates from the host for this much
         * time, in milliseconds
         */
        SLOW_CONNECTION_THRESHOLD: {
            name: "slowConnectionThreshold",
            type: "number"
        },
        /**
         * In multiplayer, the "connection lost" message is shown to the guest
         * player, if it doesn't get any updates from the host for this much
         * time, in milliseconds
         */
        CONNECTION_LOST_THRESHOLD: {
            name: "connectionLostThreshold",
            type: "number"
        },
        /**
         * In multiplayer, the guest player is automatically disconnected from
         * the game, if it doesn't get any updates from the host (or the host
         * from it) for this much time, in milliseconds
         */
        DISCONNECT_THRESHOLD: {
            name: "disconnectThreshold",
            type: "number"
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
        /**
         * When prefilling the particle pool at the start of a battle, the size of the pool will be set to the maximum possible amount of 
         * particles multiplied by this factor.
         */
        PARTICLE_POOL_PREFILL_FACTOR: {
            name: "particlePoolPrefillFactor",
            type: "number"
        },
        /**
         * When prefilling the projectile pool at the start of a battle, the size of the pool will be set to the maximum possible amount of 
         * projectiles multiplied by this factor.
         */
        PROJECTILE_POOL_PREFILL_FACTOR: {
            name: "projectilePoolPrefillFactor",
            type: "number"
        },
        /**
         * When prefilling the missile pool at the start of a battle, the size of the pool will be set to the maximum possible amount of 
         * missiles multiplied by this factor.
         */
        MISSILE_POOL_PREFILL_FACTOR: {
            name: "missilePoolPrefillFactor",
            type: "number"
        },
        /**
         * When prefilling the trail segment pool at the start of a battle, the size of the pool will be set to the maximum possible amount of 
         * missiles multiplied by the missile prefill factor multipled by this factor.
         */
        TRAIL_SEGMENT_POOL_PREFILL_FACTOR: {
            name: "trailSegmentPoolPrefillFactor",
            type: "number"
        },
        /**
         * When prefilling the explosion pool at the start of a battle, the size of the pool will be set to the maximum possible amount of 
         * explosions multiplied by this factor.
         */
        EXPLOSION_POOL_PREFILL_FACTOR: {
            name: "explosionPoolPrefillFactor",
            type: "number"
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
            values: camera.Camera.TransitionStyle,
            defaultValue: camera.Camera.TransitionStyle.SMOOTH
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
            values: camera.Camera.TransitionStyle,
            defaultValue: camera.Camera.TransitionStyle.SMOOTH
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
         * When moving forward in combat flight mode, the controlled spacecraft will accelerate to maximum a speed 
         * that equals its acceleration multiplied by this factor.
         */
        MAX_COMBAT_FORWARD_SPEED_FACTOR: {
            name: "maxCombatForwardSpeedFactor",
            type: "number"
        },
        /**
         * When moving backward in combat flight mode, the controlled spacecraft will accelerate to maximum a reverse speed 
         * that equals its acceleration multiplied by this factor.
         */
        MAX_COMBAT_REVERSE_SPEED_FACTOR: {
            name: "maxCombatReverseSpeedFactor",
            type: "number"
        },
        /**
         * When moving forward in cruise flight mode, the controlled spacecraft will accelerate to maximum a speed 
         * that equals its acceleration multiplied by this factor.
         */
        MAX_CRUISE_FORWARD_SPEED_FACTOR: {
            name: "maxCruiseForwardSpeedFactor",
            type: "number"
        },
        /**
         * When moving backward in cruise flight mode, the controlled spacecraft will accelerate to maximum a reverse speed 
         * that equals its acceleration multiplied by this factor.
         */
        MAX_CRUISE_REVERSE_SPEED_FACTOR: {
            name: "maxCruiseReverseSpeedFactor",
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
         * When a mission is started with a fighter, the camera will be set to this view of the fighter
         */
        DEFAULT_FIGHTER_VIEW_NAME: {
            name: "defaultFighterViewName",
            type: "string"
        },
        /**
         * These options will be offered in the gameplay settings as possible preferred fighter views
         */
        DEFAULT_FIGHTER_VIEW_NAME_OPTIONS: {
            name: "defaultFighterViewNameOptions",
            type: _customTypes.STRING_ARRAY
        },
        /**
         * When a mission is started with a ship (not fighter), the camera will be set to this view of the ship
         */
        DEFAULT_SHIP_VIEW_NAME: {
            name: "defaultShipViewName",
            type: "string"
        },
        /**
         * These options will be offered in the gameplay settings as possible preferred ship views
         */
        DEFAULT_SHIP_VIEW_NAME_OPTIONS: {
            name: "defaultShipViewNameOptions",
            type: _customTypes.STRING_ARRAY
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
            name: "targetChangeTransitionDuration",
            type: types.DURATION,
            defaultValue: 300
        },
        /**
         * The style of camera transitions of target views when the target is changed
         */
        TARGET_CHANGE_TRANSITION_STYLE: {
            name: "targetChangeTransitionStyle",
            type: "enum",
            values: camera.Camera.TransitionStyle
        },
        /**
         * The amount of time while the same order in which targets are cycled through is kept valid, in milliseconds.
         * If the player is switching to the next target after this time has elapsed, a new target order is established.
         */
        TARGET_ORDER_DURATION: {
            name: "targetOrderDuration",
            type: "number"
        },
        /**
         * When preparing to jump out with the piloted spacecraft, the camera will switch to the spacecraft's first view (camera 
         * configuration) with this name, if any.
         */
        JUMP_PREPARE_VIEW_NAME: {
            name: "jumpPrepareViewName",
            type: "string"
        },
        /**
         * When jumping out with the piloted spacecraft, the camera will switch to the spacecraft's first view (camera configuration) with 
         * this name, if any. (otherwise switch to free camera)
         */
        JUMP_OUT_VIEW_NAME: {
            name: "jumpOutViewName",
            type: "string"
        },
        /**
         * The amount of time to wait after the game state changes to victory or defeat before actually displaying the result. (as for
         * example incoming projectiles destroying the player's ship right after victory can change the state to defeat)
         */
        GAME_STATE_DISPLAY_DELAY: {
            name: "gameStateDisplayDelay",
            type: "number"
        },
        /**
         * The amount of time to wait after the multiplayer match concludes before quitting to the score screen.
         */
        MULTI_MATCH_QUIT_DELAY: {
            name: "multiMatchQuitDelay",
            type: "number"
        },
        /**
         * The amount of time to wait between the player jumping out and showing the mission debriefing screen, in milliseconds.
         */
        QUIT_DELAY_AFTER_JUMP_OUT: {
            name: "quitDelayAfterJumpOut",
            type: "number"
        },
        HUD: {
            name: "hud",
            /**
             * If true, the target hull integrity quick view bar is shown above the center of the HUD regardless of whether the target is
             * visible on screen, otherwise it is shown above the target when the target is visible on screen (and above the center when not)
             */
            ALWAYS_SHOW_TARGET_HULL_BAR_AT_CENTER: {
                name: "alwaysShowTargetHullBarAtCenter",
                type: "boolean"
            },
            /**
             * If true, instead of showing a separate aim assist indicator next to the crosshairs, the crosshairs (weapon impact indicators)
             * themselves are offset to compensate for the relative movement of the target and assist the aiming.
             */
            AIM_ASSIST_CROSSHAIRS: {
                name: "aimAssistCrosshairs",
                type: "boolean"
            },
            /**
             * If true, the view (model) of the target on the HUD will be display in the orientation relative to the player ship, otherwise
             * simply top-down
             */
            RELATIVE_TARGET_ORIENTATION: {
                name: "relativeTargetOrientation",
                type: "boolean"
            },
            HIGHLIGHT_INTERVAL: {
                name: "highlightInterval",
                type: "number"
            },
            TARGET_SWITCH_ANIMATION_DURATION: {
                name: "targetSwitchAnimationDuration",
                type: "number"
            },
            AIM_ASSIST_APPEAR_ANIMATION_DURATION: {
                name: "aimAssistAppearAnimationDuration",
                type: "number"
            },
            HULL_INTEGRITY_DECREASE_ANIMATION_DURATION: {
                name: "hullIntegrityDecreaseAnimationDuration",
                type: "number"
            },
            SHIELD_DECREASE_ANIMATION_DURATION: {
                name: "shieldDecreaseAnimationDuration",
                type: "number"
            },
            TARGET_HULL_INTEGRITY_DECREASE_ANIMATION_DURATION: {
                name: "targetHullIntegrityDecreaseAnimationDuration",
                type: "number"
            },
            TARGET_SHIELD_DECREASE_ANIMATION_DURATION: {
                name: "targetShieldDecreaseAnimationDuration",
                type: "number"
            },
            SHIP_INDICATOR_HIGHLIGHT_ANIMATION_INTERVAL: {
                name: "shipIndicatorHighlightAnimationInterval",
                type: "number"
            },
            CENTER_CROSSHAIR: {
                name: "centerCrosshair",
                type: _customTypes.UI_IMAGE_DESCRIPTOR
            },
            CURSOR: {
                name: "cursor",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {MAPPING: ["still", "turn"]})
            },
            SHIP_ARROW: {
                name: "shipArrow",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {COLOR: ["hostile", "friendly", "hostileHighlight", "friendlyHighlight", "newHostile", "hostileTarget", "friendlyTarget", "transmission"], SIZE: ["default", "target"]})
            },
            SHIP_ARROW_POSITION_RADIUS: {
                name: "shipArrowPositionRadius",
                type: "number"
            },
            TARGET_ARROW_SWITCH_SCALE: {
                name: "targetArrowSwitchScale",
                type: "number"
            },
            SHIP_INDICATOR: {
                name: "shipIndicator",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {COLOR: ["hostile", "friendly", "hostileHighlight", "friendlyHighlight", "newHostile", "hostileTarget", "friendlyTarget", "transmission"], SIZE: ["minimum", "targetMinimum", "maximum"]})
            },
            SHIP_INDICATOR_SIZE_FACTOR: {
                name: "shipIndicatorSizeFactor",
                type: "number"
            },
            TARGET_INDICATOR_SWITCH_SCALE: {
                name: "targetIndicatorSwitchScale",
                type: "number"
            },
            MISSILE_LOCK_INDICATOR: {
                name: "missileLockIndicator",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {COLOR: ["hostileTarget", "friendlyTarget"]}, ["SIZE"])
            },
            MISSILE_LOCK_INDICATOR_COUNT: {
                name: "missileLockIndicatorCount",
                type: "number"
            },
            MISSILE_LOCK_INDICATOR_RADIUS: {
                name: "missileLockIndicatorRadius",
                type: "number"
            },
            MISSILE_LOCK_INDICATOR_SIZE: {
                name: "missileLockIndicatorSize",
                type: "number"
            },
            MISSILE_LOCK_INDICATOR_ANGLE: {
                name: "missileLockIndicatorAngle",
                type: "number"
            },
            MISSILE_LOCK_INDICATOR_ROTATION_SPEED: {
                name: "missileLockIndicatorRotationSpeed",
                type: "number"
            },
            MISSILE_LOCK_INDICATOR_BLINK_INTERVAL: {
                name: "missileLockIndicatorBlinkInterval",
                type: "number"
            },
            DISTANCE_TEXT_LAYER_LAYOUT: {
                name: "distanceTextLayerLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            DISTANCE_TEXT: {
                name: "distanceText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["hostile", "friendly"]})
            },
            SHIP_STATUS_INDICATOR: {
                name: "shipStatusIndicator",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {MAPPING: ["protect", "destroy", "transmission"], COLOR: ["protect", "destroy", "transmission"], SIZE: ["reticle", "arrow"]})
            },
            AIM_ASSIST_INDICATOR: {
                name: "aimAssistIndicator",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {COLOR: ["hostile", "friendly", "appear"]})
            },
            AIM_ASSIST_INDICATOR_APPEAR_SCALE: {
                name: "aimAssistIndicatorAppearScale",
                type: "number"
            },
            WEAPON_IMPACT_INDICATOR: {
                name: "weaponImpactIndicator",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {COLOR: ["normal", "outOfRange"]})
            },
            WEAPON_IMPACT_INDICATOR_SWITCH_SCALE: {
                name: "weaponImpactIndicatorSwitchScale",
                type: "number"
            },
            TARGET_VIEW_LAYOUT: {
                name: "targetViewLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            TARGET_VIEW_CAMERA_DISTANCE: {
                name: "targetViewCameraDistance",
                type: "number"
            },
            TARGET_VIEW_VIEW_DISTANCE: {
                name: "targetViewViewDistance",
                type: "number"
            },
            TARGET_VIEW_FOV: {
                name: "targetViewFOV",
                type: "number"
            },
            TARGET_VIEW_TARGET_ITEM_SHADER: {
                name: "targetViewTargetItemShader",
                type: "string"
            },
            TARGET_VIEW_TARGET_ITEM_FULL_INTEGRITY_COLOR: {
                name: "targetViewTargetItemFullIntegrityColor",
                type: types.COLOR4
            },
            TARGET_VIEW_TARGET_ITEM_HALF_INTEGRITY_COLOR: {
                name: "targetViewTargetItemHalfIntegrityColor",
                type: types.COLOR4
            },
            TARGET_VIEW_TARGET_ITEM_ZERO_INTEGRITY_COLOR: {
                name: "targetViewTargetItemZeroIntegrityColor",
                type: types.COLOR4
            },
            TARGET_INFO_BACKGROUND: {
                name: "targetInfoBackground",
                type: _customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR
            },
            TARGET_HULL_INTEGRITY_BAR: {
                name: "targetHullIntegrityBar",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {COLOR: ["filled", "empty"]})
            },
            TARGET_SHIELD_BAR: {
                name: "targetShieldBar",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {COLOR: ["filled", "empty"]})
            },
            TARGET_INFO_TEXT_LAYER_LAYOUT: {
                name: "targetInfoTextLayerLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            TARGET_INFO_TEXT: {
                name: "targetInfoText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["hostile", "friendly"], FONT_SIZE: ["name", "others"], POSITION: ["name", "class", "team", "firepower", "distance", "velocity"]})
            },
            WINGMEN_STATUS_BACKGROUND: {
                name: "wingmenStatusBackground",
                type: _customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR
            },
            WINGMEN_STATUS_HEADER_TEXT: {
                name: "wingmenStatusHeaderText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            /**
             * Information based on which the indicators for the individual spacecrafts within squads can be created for the wingmen status indicator
             */
            WINGMEN_STATUS_CRAFT_INDICATOR: {
                name: "wingmenStatusCraftIndicator",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {MAPPING: ["player", "shield", "general", "interceptor", "bomber", "heavyFighter"], COLOR: ["fullIntegrity", "halfIntegrity", "zeroIntegrity", "destroyed", "away", "fullShieldIntegrity", "halfShieldIntegrity", "zeroShieldIntegrity"]})
            },
            /**
             * Stores the relative positions (within the area described by the squad layouts) of the individual spacecraft indicators for
             * each squad size and craft index
             * (-1,-1): bottom left, (1,1): top right
             */
            WINGMEN_STATUS_CRAFT_POSITIONS: {
                name: "wigmenStatusCraftPositions",
                type: _customTypes.CRAFT_INDICATOR_POSITIONS
            },
            /**
             * This is a virtual layout that is used indirectly (by dynamically creating layouts based on it) to lay out the individual 
             * spacecraft indicators within the squad and the squad texts
             */
            WINGMEN_STATUS_SQUAD_LAYOUT: {
                name: "wigmenStatusSquadLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            WINGMEN_STATUS_SQUAD_TEXT: {
                name: "wingmenStatusSquadText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            SPEED_BAR: {
                name: "speedBar",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {COLOR: ["combatFilled", "combatEmpty", "combatReverseFilled", "combatReverseEmpty", "cruiseFilled", "cruiseEmpty", "cruiseReverseFilled", "cruiseReverseEmpty", "freeFilled", "freeEmpty", "freeReverseFilled", "freeReverseEmpty"]})
            },
            SPEED_BAR_BASE_MAX_SPEED_FACTOR: {
                name: "speedBarBaseMaxSpeedFactor",
                type: "number"
            },
            SPEED_BAR_DEFAULT_BASE_MAX_SPEED: {
                name: "speedBarDefaultBaseMaxSpeed",
                type: "number"
            },
            SPEED_BAR_MAX_SPEED_STEP_FACTOR: {
                name: "speedBarMaxSpeedStepFactor",
                type: "number"
            },
            SPEED_BAR_MAX_SPEED_STEP_BUFFER: {
                name: "speedBarMaxSpeedStepBuffer",
                type: "number"
            },
            SPEED_TEXT_LAYER_LAYOUT: {
                name: "speedTextLayerLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            SPEED_TEXT: {
                name: "speedText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["combatForward", "combatReverse", "cruiseForward", "cruiseReverse", "freeForward", "freeReverse"], POSITION: ["maxForward", "maxReverse"]})
            },
            SPEED_TARGET_INDICATOR: {
                name: "speedTargetIndicator",
                type: _customTypes.UI_IMAGE_DESCRIPTOR
            },
            MISSILE_INDICATOR: {
                name: "missileIndicator",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {MAPPING: ["single", "salvo"], COLOR: ["ready", "locking", "loading"]})
            },
            MISSILE_INDICATOR_TEXT_LAYOUT: {
                name: "missileIndicatorTextLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            MISSILE_INDICATOR_TEXT: {
                name: "missileIndicatorText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["ready", "locking", "loading"]})
            },
            HULL_INTEGRITY_BAR: {
                name: "hullIntegrityBar",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {COLOR: ["filled", "empty", "filledWhenDecreasing", "emptyWhenDecreasing"]})
            },
            SHIELD_BAR: {
                name: "shieldBar",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {COLOR: ["filled", "empty", "filledWhenDecreasing", "emptyWhenDecreasing"]})
            },
            FLIGHT_MODE_INDICATOR_BACKGROUND: {
                name: "flightModeIndicatorBackground",
                type: _customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR
            },
            FLIGHT_MODE_HEADER_TEXT: {
                name: "flightModeHeaderText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            FLIGHT_MODE_TEXT: {
                name: "flightModeText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["free", "combat", "cruise"]})
            },
            MISSILE_INFO_BACKGROUND: {
                name: "missileInfoBackground",
                type: _customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR
            },
            MISSILE_INFO_HEADER_TEXT: {
                name: "missileInfoHeaderText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            MISSILE_INFO_TEXT: {
                name: "missileInfoText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["readySelected", "lockingSelected", "loadingSelected", "notSelected", "empty"], POSITION: ["name", "count"]})
            },
            MISSILE_INFO_TEXT_OFFSET: {
                name: "missileInfoTextOffset",
                type: "number"
            },
            MAX_MISSILE_INFO_DISPLAYED: {
                name: "maxMissileInfoDisplayed",
                type: "number"
            },
            DRIFT_ARROW: {
                name: "driftArrow",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {COLOR: ["minSpeed", "maxSpeed"]})
            },
            DRIFT_ARROW_POSITION_RADIUS: {
                name: "driftArrowPositionRadius",
                type: "number"
            },
            DRIFT_ARROW_MIN_SPEED: {
                name: "driftArrowMinSpeed",
                type: "number"
            },
            DRIFT_ARROW_MAX_SPEED_FACTOR: {
                name: "driftArrowMaxSpeedFactor",
                type: "number"
            },
            TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR: {
                name: "targetHullIntegrityQuickViewBar",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {COLOR: ["hostileFilled", "hostileEmpty", "friendlyFilled", "friendlyEmpty", "filledWhenDecreasing"]})
            },
            TARGET_SHIELD_QUICK_VIEW_BAR: {
                name: "targetShieldQuickViewBar",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {COLOR: ["filled", "empty", "filledWhenDecreasing"]})
            },
            HEADER_TEXT_LAYER_LAYOUT: {
                name: "headerTextLayerLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            SMALL_HEADER_TEXT: {
                name: "smallHeaderText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            BIG_HEADER_TEXT: {
                name: "bigHeaderText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            SUBHEADER_TEXT: {
                name: "subheaderText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            MESSAGE_BACKGROUND: {
                name: "messageBackground",
                type: _customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR
            },
            MESSAGE_TEXT: {
                name: "messageText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["default", "jump", "alert", "controlString", "friendlySpacecraft", "hostileSpacecraft", "slowConnection", "connectionLost"]})
            },
            MESSAGE_TEXT_MARGIN: {
                name: "messageTextMargin",
                type: "number"
            },
            TOP_LEFT_TEXT_LAYER_LAYOUT: {
                name: "topLeftTextLayerLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            SCORE_TEXT: {
                name: "scoreText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            OBJECTIVES_BACKGROUND: {
                name: "objectivesBackground",
                type: _customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR
            },
            OBJECTIVES_HEADER_TEXT: {
                name: "objectivesHeaderText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            OBJECTIVES_TEXT: {
                name: "objectivesText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["inProgress", "completed", "failed"]})
            },
            OBJECTIVES_TEXT_OFFSET: {
                name: "objectivesTextOffset",
                type: "number"
            },
            MAX_OBJECTIVES_DISPLAYED: {
                name: "maxObjectivesDisplayed",
                type: "number"
            },
            ESCORTS_BACKGROUND: {
                name: "escortsBackground",
                type: _customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR
            },
            ESCORTS_HEADER_TEXT: {
                name: "escortsHeaderText",
                type: _customTypes.TEXT_DESCRIPTOR
            },
            ESCORTS_TEXT: {
                name: "escortsText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["alive", "away", "destroyed"]})
            },
            ESCORTS_INTEGRITY_BARS: {
                name: "escortsIntegrityBars",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {COLOR: ["fullHull", "halfHull", "zeroHull", "awayHull", "destroyed", "shield", "lostShield"], LAYOUT: ["hull", "shield"]})
            },
            ESCORTS_TEXT_OFFSET: {
                name: "escortsTextOffset",
                type: "number"
            },
            MAX_ESCORTS_DISPLAYED: {
                name: "maxEscortsDisplayed",
                type: "number"
            },
            TARGET_SWITCH_SOUND: {
                name: "targetSwitchSound",
                type: classes.SOUND_EFFECT
            },
            TARGET_SWITCH_DENIED_SOUND: {
                name: "targetSwitchDeniedSound",
                type: classes.SOUND_EFFECT
            },
            FLIGHT_MODE_SWITCH_SOUND: {
                name: "flightModeSwitchSound",
                type: classes.SOUND_EFFECT
            },
            MISSILE_CHANGE_SOUND: {
                name: "missileChangeSound",
                type: classes.SOUND_EFFECT
            },
            MISSILE_CHANGE_DENIED_SOUND: {
                name: "missileChangeDeniedSound",
                type: classes.SOUND_EFFECT
            },
            MISSILE_SALVO_SOUND: {
                name: "missileSalvoSound",
                type: classes.SOUND_EFFECT
            },
            MISSILE_LOADED_SOUND: {
                name: "missileLoadedSound",
                type: classes.SOUND_EFFECT
            },
            MISSILE_LOCKING_SOUND: {
                name: "missileLockingSound",
                type: classes.SOUND_EFFECT
            },
            MISSILE_LOCKING_SOUND_COUNT: {
                name: "missileLockingSoundCount",
                type: "number"
            },
            MISSILE_LOCKED_SOUND: {
                name: "missileLockedSound",
                type: classes.SOUND_EFFECT
            },
            MESSAGE_SOUND: {
                name: "messageSound",
                type: classes.SOUND_EFFECT
            },
            MESSAGE_TYPE_SOUND: {
                name: "messageTypeSound",
                type: classes.SOUND_EFFECT
            },
            NEW_HOSTILES_ALERT_SOUND: {
                name: "newHostilesAlertSound",
                type: classes.SOUND_EFFECT
            },
            CONNECTION_WARNING_SOUND: {
                name: "connectionWarningSound",
                type: classes.SOUND_EFFECT
            },
            NEW_HOSTILES_ALERT_DURATION: {
                name: "newHostilesAlertDuration",
                type: "number"
            },
            NEW_HOSTILES_ALERT_BLINK_INTERVAL: {
                name: "newHostilesAlertBlinkInterval",
                type: "number"
            }
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
        /**
         * Whether the views should automatically change every X seconds when in demo mode
         */
        DEMO_VIEW_SWITCHING: {
            name: "demoViewSwitching",
            type: "boolean"
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
         * When the ingame menu is opened (or another screen is opened from within it), the SFX volume will be changed by this factor
         */
        SFX_VOLUME_IN_MENUS: {
            name: "sfxVolumeInMenus",
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
         * The IDs (resource names) of the songs (MusicResource) that can be played during battles while there are hostiles, but there is no
         * fighting. One of these is chosen randomly for each mission when it starts (unless there is a specific track set in the mission data)
         */
        ANTICIPATION_MUSIC: {
            name: "anticipationMusic",
            type: _customTypes.STRING_ARRAY
        },
        /**
         * The IDs (resource names) of the songs (MusicResources) that can be played during battles while fighting is going on.
         * One of these is chosen randomly for each mission when it starts (unless there is a specific track set in the mission data)
         */
        COMBAT_MUSIC: {
            name: "combatMusic",
            type: _customTypes.STRING_ARRAY
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
         * The ID (resource name) of the song (MusicResource) that should play while at the mission debriefing screen, if the mission was
         * won
         */
        DEBRIEFING_VICTORY_MUSIC: {
            name: "debriefingVictoryMusic",
            type: "string"
        },
        /**
         * The ID (resource name) of the song (MusicResource) that should play while at the mission debriefing screen, if the mission has
         * been lost
         */
        DEBRIEFING_DEFEAT_MUSIC: {
            name: "debriefingDefeatMusic",
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
         * The duration of the fade in of the debriefing music theme after exiting the battle, in seconds
         */
        DEBRIEFING_THEME_FADE_IN_DURATION: {
            name: "debriefingThemeFadeInDuration",
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
         * If the player hasn't used primary weapons (hit ratio is 0) during the mission, the hit ratio of missiles is used for
         * hit ratio bonus calculation instead, multiplied by this factor
         */
        MISSILE_HIT_RATIO_FACTOR: {
            name: "missileHitRatioFactor",
            type: "number"
        },
        /**
         * The amount of score points awarded for the player if a team mission (the player has teammates) is completed with all teammates
         * surviving. If some teammates fall, the bonus is proportional to the ratio of surviving teammates.
         */
        SCORE_BONUS_FOR_TEAM_SURVIVAL: {
            name: "scoreBonusForTeamSurvival",
            type: "number"
        },
        /**
         * Whether missile launchers should be set to salvo mode by default (when available)
         */
        DEFAULT_SALVO_MODE: {
            name: "defaultSalvoMode",
            type: "boolean"
        },
        /**
         * When the missiles of the selected class run out and the spacecraft automatically switches to the next missile class, the
         * newly selected launcher is set to this cooldown (minimum)
         */
        MISSILE_AUTO_CHANGE_COOLDOWN: {
            name: "missileAutoChangeCooldown",
            type: "number"
        }
    };
    CAMERA_SETTINGS = {
        DEFAULT_FOV: {
            name: "defaultFOV",
            type: "number"
        },
        DEFAULT_SPAN: {
            name: "defaultSpan",
            type: "number"
        },
        DEFAULT_BASE_ORIENTATION: {
            name: "defaultBaseOrientation",
            type: "enum",
            values: camera.CameraOrientationConfiguration.BaseOrientation
        },
        DEFAULT_POINT_TO_FALLBACK: {
            name: "defaultPointToFallback",
            type: "enum",
            values: camera.CameraOrientationConfiguration.PointToFallback
        }
    };
    LOCAL_STORAGE_HUD_PREFIX = MODULE_LOCAL_STORAGE_PREFIX + BATTLE_SETTINGS.HUD.name + LOCAL_STORAGE_SEPARATOR;
    LOCAL_STORAGE_BATTLE_PREFIX = MODULE_LOCAL_STORAGE_PREFIX + "battle" + LOCAL_STORAGE_SEPARATOR;
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
        /**
         * Cache storing the current HUD settings (considering both settings file and local storage) for faster access
         * @type Object
         */
        this._hudSettings = {};
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
     * Returns the value for the battle setting identified by the passed setting definition object.
     * Checks locally stored settings as well as defaults.
     * @param {Object} settingDefinitionObject
     */
    ConfigurationContext.prototype.getBattleSetting = function (settingDefinitionObject) {
        var local;
        if (localStorage[LOCAL_STORAGE_BATTLE_PREFIX + settingDefinitionObject.name] !== undefined) {
            local = types.getValueOfTypeFromLocalStorage(settingDefinitionObject.type, LOCAL_STORAGE_BATTLE_PREFIX + settingDefinitionObject.name);
        }
        return (local !== undefined) ? local : this._settings[settingDefinitionObject.name];
    };
    /**
     * Overrides the local value for the battle setting identified by the passed setting definition object (storing it in local storage)
     * @param {Object} settingDefinitionObject
     * @param {} value
     */
    ConfigurationContext.prototype.setBattleSetting = function (settingDefinitionObject, value) {
        localStorage[LOCAL_STORAGE_BATTLE_PREFIX + settingDefinitionObject.name] = value;
    };
    /**
     * Returns the value for the HUD setting identified by the passed setting definition object.
     * Checks locally stored settings as well as defaults.
     * @param {Object} settingDefinitionObject
     */
    ConfigurationContext.prototype.getHUDSetting = function (settingDefinitionObject) {
        var local;
        if (this._hudSettings[settingDefinitionObject.name] === undefined) {
            if (localStorage[LOCAL_STORAGE_HUD_PREFIX + settingDefinitionObject.name] !== undefined) {
                local = types.getValueOfTypeFromLocalStorage(settingDefinitionObject.type, LOCAL_STORAGE_HUD_PREFIX + settingDefinitionObject.name);
            }
            this._hudSettings[settingDefinitionObject.name] = (local !== undefined) ? local : this._settings[BATTLE_SETTINGS.HUD.name][settingDefinitionObject.name];
        }
        return this._hudSettings[settingDefinitionObject.name];
    };
    /**
     * Overrides the local value for the HUD setting identified by the passed setting definition object (storing it in local storage)
     * @param {Object} settingDefinitionObject
     * @param {} value
     */
    ConfigurationContext.prototype.setHUDSetting = function (settingDefinitionObject, value) {
        localStorage[LOCAL_STORAGE_HUD_PREFIX + settingDefinitionObject.name] = value;
        this._hudSettings[settingDefinitionObject.name] = value;
    };
    /**
     * Removes all local overrides for HUD settings, resetting them to their default values (coming from the settings JSON)
     */
    ConfigurationContext.prototype.resetHUDSettings = function () {
        var i, name, keys = Object.keys(BATTLE_SETTINGS.HUD);
        for (i = 0; i < keys.length; i++) {
            if (typeof BATTLE_SETTINGS.HUD[keys[i]] === "object") {
                name = BATTLE_SETTINGS.HUD[keys[i]].name;
                localStorage.removeItem(LOCAL_STORAGE_HUD_PREFIX + name);
                this._hudSettings[name] = this._settings[BATTLE_SETTINGS.HUD.name][name];
            }
        }
    };
    /**
     * Removes all local overrides for battle settings, resetting them to their default values (coming from the settings JSON)
     */
    ConfigurationContext.prototype.resetBattleSettings = function () {
        var i, keys = Object.keys(BATTLE_SETTINGS);
        for (i = 0; i < keys.length; i++) {
            if (typeof BATTLE_SETTINGS[keys[i]] === "object") {
                localStorage.removeItem(LOCAL_STORAGE_BATTLE_PREFIX + BATTLE_SETTINGS[keys[i]].name);
            }
        }
    };
    /**
     * Returns the default starting field of view value for camera configurations, in degrees
     * @returns {Number}
     */
    ConfigurationContext.prototype.getDefaultCameraFOV = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_FOV);
    };
    /**
     * Returns the default starting span value for camera configurations, in meters
     * @returns {Number}
     */
    ConfigurationContext.prototype.getDefaultCameraSpan = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_SPAN);
    };
    /**
     * (enum CameraOrientationConfiguration.BaseOrientation) Returns the default base orientation mode to use for camera 
     * configurations
     * @returns {String}
     */
    ConfigurationContext.prototype.getDefaultCameraBaseOrientation = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_BASE_ORIENTATION);
    };
    /**
     * (enum CameraOrientationConfiguration.PointToFallback) Returns the default point-to fallback mode to use for camera 
     * configurations
     * @returns {String}
     */
    ConfigurationContext.prototype.getDefaultCameraPointToFallback = function () {
        return this.getSetting(CAMERA_SETTINGS.DEFAULT_POINT_TO_FALLBACK);
    };
    /**
     * Returns the name of the camera configuration to be used for the default view when piloting the passed spacecraft
     * @param {Spacecraft} spacecraft
     * @returns {String}
     */
    ConfigurationContext.prototype.getDefaultCamerConfigurationName = function (spacecraft) {
        return spacecraft.isFighter() ?
                this.getBattleSetting(BATTLE_SETTINGS.DEFAULT_FIGHTER_VIEW_NAME) :
                this.getBattleSetting(BATTLE_SETTINGS.DEFAULT_SHIP_VIEW_NAME);
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
        types.getVerifiedObject("multi", dataJSON.multi, MULTI_SETTINGS, this._settings);
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
        MULTI_SETTINGS: MULTI_SETTINGS,
        BATTLE_SETTINGS: BATTLE_SETTINGS,
        DATABASE_SETTINGS: DATABASE_SETTINGS,
        CAMERA_SETTINGS: CAMERA_SETTINGS,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        loadSettingsFromJSON: _context.loadSettingsFromJSON.bind(_context),
        getConfigurationSetting: _context.getConfigurationSetting.bind(_context),
        getSetting: _context.getSetting.bind(_context),
        getHUDSetting: _context.getHUDSetting.bind(_context),
        setHUDSetting: _context.setHUDSetting.bind(_context),
        getBattleSetting: _context.getBattleSetting.bind(_context),
        setBattleSetting: _context.setBattleSetting.bind(_context),
        resetHUDSettings: _context.resetHUDSettings.bind(_context),
        resetBattleSettings: _context.resetBattleSettings.bind(_context),
        getDefaultCameraFOV: _context.getDefaultCameraFOV.bind(_context),
        getDefaultCameraSpan: _context.getDefaultCameraSpan.bind(_context),
        getDefaultCameraBaseOrientation: _context.getDefaultCameraBaseOrientation.bind(_context),
        getDefaultCameraPointToFallback: _context.getDefaultCameraPointToFallback.bind(_context),
        getDefaultCamerConfigurationName: _context.getDefaultCamerConfigurationName.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context)
    };
});