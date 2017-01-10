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
    "armada/logic/classes"
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
    /**
     * Creates and returns a new type descriptor based on the passed one, changing some of its property descriptors
     * @param {Object} baseDescriptor
     * @param {Object.<String, String[]>} customProperties Changes the given simple property descriptors e.g. passing 
     * {COLOR: ["active", "passive"]} will make the COLOR property descriptor in such way that if it expected "color": [r,g,b,a] properties,
     * now it will expect "colors": {"active": [r,g,b,a], "passive": [r,g,b,a]} properties instead
     * @returns {Object}
     */
    _customTypes.getCustomDescriptor = function (baseDescriptor, customProperties) {
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
        HUD: {
            name: "hud",
            TARGET_SWITCH_ANIMATION_DURATION: {
                name: "targetSwitchAnimationDuration",
                type: "number"
            },
            HULL_INTEGRITY_DECREASE_ANIMATION_DURATION: {
                name: "hullIntegrityDecreaseAnimationDuration",
                type: "number"
            },
            TARGET_HULL_INTEGRITY_DECREASE_ANIMATION_DURATION: {
                name: "targetHullIntegrityDecreaseAnimationDuration",
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
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {COLOR: ["hostile", "friendly", "hostileHighlight", "friendlyHighlight", "hostileTarget", "friendlyTarget"], SIZE: ["default", "target"]})
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
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {COLOR: ["hostile", "friendly", "hostileHighlight", "friendlyHighlight", "hostileTarget", "friendlyTarget"], SIZE: ["minimum", "targetMinimum", "maximum"]})
            },
            SHIP_INDICATOR_SIZE_FACTOR: {
                name: "shipIndicatorSizeFactor",
                type: "number"
            },
            TARGET_INDICATOR_SWITCH_SCALE: {
                name: "targetIndicatorSwitchScale",
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
            AIM_ASSIST_INDICATOR: {
                name: "aimAssistIndicator",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_IMAGE_DESCRIPTOR, {COLOR: ["hostile", "friendly"]})
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
            TARGET_INFO_TEXT_LAYER_LAYOUT: {
                name: "targetInfoTextLayerLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            TARGET_INFO_TEXT: {
                name: "targetInfoText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["hostile", "friendly"], POSITION: ["name", "class", "team", "distance", "velocity"]})
            },
            SPEED_BAR: {
                name: "speedBar",
                type: _customTypes.getCustomDescriptor(_customTypes.UI_LAID_OUT_IMAGE_DESCRIPTOR, {COLOR: ["filled", "empty", "reverseFilled", "reverseEmpty"]})
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
            SPEED_TEXT_LAYER_LAYOUT: {
                name: "speedTextLayerLayout",
                type: _customTypes.LAYOUT_DESCRIPTOR
            },
            SPEED_TEXT: {
                name: "speedText",
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["forward", "reverse"], POSITION: ["maxForward", "maxReverse"]})
            },
            SPEED_TARGET_INDICATOR: {
                name: "speedTargetIndicator",
                type: _customTypes.UI_IMAGE_DESCRIPTOR
            },
            HULL_INTEGRITY_BAR: {
                name: "hullIntegrityBar",
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
                type: _customTypes.getCustomDescriptor(_customTypes.TEXT_DESCRIPTOR, {COLOR: ["free", "compensated", "restricted"]})
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
                type: _customTypes.TEXT_DESCRIPTOR
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
            TARGET_SWITCH_SOUND: {
                name: "targetSwitchSound",
                type: classes.SOUND_EFFECT_2D
            },
            TARGET_SWITCH_DENIED_SOUND: {
                name: "targetSwitchDeniedSound",
                type: classes.SOUND_EFFECT_2D
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
         * The ID (resource name) of the song (MusicResource) that should play while at the mission debriefing screen
         */
        DEBRIEFING_MUSIC: {
            name: "debriefingMusic",
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
     * Returns the setting value within the HUD setting object for the passed setting definition object.
     * @param {Object} settingDefinitionObject
     */
    ConfigurationContext.prototype.getHUDSetting = function (settingDefinitionObject) {
        return this._settings[BATTLE_SETTINGS.HUD.name][settingDefinitionObject.name];
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
        getHUDSetting: _context.getHUDSetting.bind(_context),
        getDefaultCameraFOV: _context.getDefaultCameraFOV.bind(_context),
        getDefaultCameraFOVRange: _context.getDefaultCameraFOVRange.bind(_context),
        getDefaultCameraSpan: _context.getDefaultCameraSpan.bind(_context),
        getDefaultCameraSpanRange: _context.getDefaultCameraSpanRange.bind(_context),
        getDefaultCameraBaseOrientation: _context.getDefaultCameraBaseOrientation.bind(_context),
        getDefaultCameraPointToFallback: _context.getDefaultCameraPointToFallback.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context)
    };
});