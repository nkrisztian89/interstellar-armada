/**
 * Copyright 2014-2022 Krisztián Nagy
 * @file This module manages and provides the Battle screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for string formatting, async calls.
 * @param vec Used for vector operation for the HUD elements.
 * @param mat Used for matrix operation for the HUD elements and displaying matrix stats.
 * @param application Used for displaying errors and logging.
 * @param game Used for navigation
 * @param components Used for the components of the screen (e.g. loading box)
 * @param screens The battle screen is a HTMLScreenWithCanvases.
 * @param renderableObjects Used for creating the HUD elements
 * @param sceneGraph Used for creating the battle scene and the nodes for the HUD elements.
 * @param analytics Used for reporting mission start/win/lose/score events.
 * @param resources Used for accessing the resources for the HUD and for requesting the loading of reasourcing and setting callback for when they are ready.
 * @param egomModel Used for creating the models for the HUD elements
 * @param strings Used for translation support.
 * @param armadaScreens Used for common screen constants.
 * @param graphics Used for accessing graphics settings.
 * @param audio Used for controlling volume (muting when opening the menu)
 * @param networking Used for multiplayer
 * @param classes Used for HUD elements for convenient acquiry of their resources.
 * @param config Used to access game setting / configuration.
 * @param control Used for global game control functions.
 * @param SpacecraftEvents used for setting spacecraft event handlers
 * @param missions Used for creating the Mission object, accessing enums.
 * @param missionEvents Used for accessing enums.
 * @param equipment Used to access flight mode constants
 * @param spacecraft Used for multiplayer data messaging and state setup
 * @param ai Used for performing the AI control operations in the battle simulation loop.
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/game",
    "modules/components",
    "modules/screens",
    "modules/media-resources",
    "modules/egom-model",
    "modules/scene/renderable-objects",
    "modules/scene/scene-graph",
    "modules/analytics",
    "armada/strings",
    "armada/screens/shared",
    "armada/graphics",
    "armada/audio",
    "armada/networking",
    "armada/logic/classes",
    "armada/configuration",
    "armada/control",
    "armada/logic/SpacecraftEvents",
    "armada/logic/missions",
    "armada/logic/missions/events",
    "armada/logic/equipment",
    "armada/logic/spacecraft",
    "armada/logic/ai",
    "utils/polyfill"
], function (
        utils, vec, mat,
        application, game, components, screens, resources, egomModel,
        renderableObjects, sceneGraph,
        analytics,
        strings, armadaScreens, graphics, audio, networking, classes, config, control,
        SpacecraftEvents, missions, missionEvents, equipment, spacecraft, ai) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // imports
            ObjectiveState = missionEvents.ObjectiveState,
            // ------------------------------------------------------------------------------
            // enums
            HUDSection = {
                TARGET_INFO: 0,
                TARGET_INDICATOR: 1,
                SHIP_INDICATORS: 2,
                AIM_ASSIST_INDICATOR: 3,
                WEAPON_IMPACT_INDICATORS: 4,
                HULL_BAR: 5,
                SHIELD_BAR: 6,
                SPEED_BAR: 7,
                DRIFT_ARROW: 8,
                FLIGHT_MODE: 9,
                WINGMEN_INFO: 10,
                MISSILE_INFO: 11,
                MISSILE_INDICATOR: 12,
                OBJECTIVES: 13,
                ESCORTS: 14,
                SCORE: 15
            },
            HUDSectionState = {
                VISIBLE: 0,
                HIDDEN: 1,
                HIGHLIGHTED: 2
            },
            ConnectionStatus = {
                GOOD: 0,
                SLOW: 1,
                LOST: 2
            },
            // ------------------------------------------------------------------------------
            // constants
            /** @type String */
            STATS_PARAGRAPH_ID = "stats",
            LOADING_BOX_ID = "loadingBox",
            INFO_BOX_ID = "infoBox",
            BATTLE_CANVAS_ID = "battleCanvas",
            /** @type Number */
            LOOP_CANCELED = -1,
            LOOP_REQUESTANIMFRAME = -2,
            HOST_UPDATE_INTERVAL = 50,
            LOADING_BUILDING_SCENE_PROGRESS = 10,
            LOADING_RESOURCES_START_PROGRESS = 20,
            LOADING_RESOURCE_PROGRESS = 60,
            LOADING_INIT_WEBGL_PROGRESS = LOADING_RESOURCES_START_PROGRESS + LOADING_RESOURCE_PROGRESS,
            /**
             * When creating the battle scene, the camera will be created with this FOV, but it will be immediately overwritten by the 
             * FOV set for the first scene view of the loaded mission, therefore no point in making this settable.
             * @type Number
             */
            INITIAL_CAMERA_FOV = 40,
            INITIAL_CAMERA_SPAN = 0.2,
            /**
             * If the scene (environment) contains particle system effects, the scene will be rendered this many times in preparation before
             * starting the battle, to achieve a stable particle system state
             * @type Number
             */
            PREPARE_SCENE_COUNT = 20,
            /**
             * When the scene is rendered in preparation (see PREPARE_SCENE_COUNT), this will be the dt value passed for each render
             * @type Number
             */
            PREPARE_SCENE_DT = 100,
            /** @type String */
            HUD_ELEMENT_CLASS_NAME = "hudElementClass",
            HUD_ELEMENT_MODEL_NAME_PREFIX = "squareModel",
            MODEL_NAME_INFIX = "-",
            UI_2D_SHADER_NAME = "ui2d",
            UI_3D_SHADER_NAME = "ui3d",
            UI_2D_MIX_VIEWPORT_SHADER_NAME = "ui2d-mix-viewport",
            UI_2D_CLIP_VIEWPORT_SHADER_NAME = "ui2d-clip-viewport",
            // identifiers for music tracks
            AMBIENT_THEME = "ambient",
            ANTICIPATION_THEME_PREFIX = "anticipation",
            COMBAT_THEME_PREFIX = "combat",
            VICTORY_THEME = "victory",
            DEFEAT_THEME = "defeat",
            // HUD messages
            /** @type Number */
            HUD_MESSAGE_DURATION_PER_CHAR = 70, // based on average ~900 char per minute human reading speed
            HUD_MESSAGE_BASE_DURATION = 400, // fix extra time added to the duration of all HUD messages without explicit duration
            HUD_MESSAGE_APPEAR_DURATION_PER_CHAR = 7,
            HUD_MESSAGE_APPEAR_SOUND_STOP_RAMP_DURATION = 0.01, // in seconds!
            /** ID for the HUD message queue for the hostile alert that is shown in parallel to highlighting the newly arrived hostiles, if no other message is visible @type String */
            HOSTILE_ALERT_QUEUE = "hostileAlert",
            /** ID for the HUD message queue for general messages - messages without a specified queue go here @type String */
            INFO_QUEUE = "info",
            /** ID for the HUD message queue for mission state updates @type String */
            MISSION_QUEUE = "mission",
            /** ID for the HUD message queue for messages from the jump engine of the ship @type String */
            JUMP_QUEUE = "system",
            /** ID for the HUD message queue for messages about multiplayer network connection status @type String */
            CONNECTION_QUEUE = "connection",
            /** In descending priority order @type Array */
            MESSAGE_QUEUES = [CONNECTION_QUEUE, JUMP_QUEUE, MISSION_QUEUE, INFO_QUEUE, HOSTILE_ALERT_QUEUE],
            // target info section names
            /** @type String */
            TARGET_INFO_NAME = "name",
            TARGET_INFO_CLASS = "class",
            TARGET_INFO_TEAM = "team",
            TARGET_INFO_FIREPOWER = "firepower",
            TARGET_INFO_DISTANCE = "distance",
            TARGET_INFO_VELOCITY = "velocity",
            /** From top to bottom in the info panel
             * @type Array */
            TARGET_INFO_SECTIONS = [TARGET_INFO_NAME, TARGET_INFO_CLASS, TARGET_INFO_TEAM, TARGET_INFO_FIREPOWER, TARGET_INFO_DISTANCE, TARGET_INFO_VELOCITY],
            /** This governs what suppements are target view items added with @type Object */
            TARGET_VIEW_SUPPLEMENTS = {weapons: true},
            POINTER_LOCK_DELAY = 1000,
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * The mission object storing and simulating the game-logic model of the battle
             * @type Mission
             */
            _mission,
            /**
             * The scene that is used to render the battle
             * @type Scene
             */
            _battleScene,
            /**
             * The ID of the loop function that is set to run the game simulation
             * @type Number
             */
            _simulationLoop = LOOP_CANCELED,
            /**
             * For the host: the time elapsed since the last multiplayer game
             * update message has been sent to the guests
             * For guests: the time elapsed since the last multiplayer game
             * update message has been received from the host
             * In ms.
             * @type Number
             */
            _timeSinceHostUpdate,
            /**
             * For multiplayer host: an array of the times elapsed since receiving
             * the last guest update from each of the guests in the current game
             * @type Array
             */
            _timeSinceGuestUpdates,
            /**
             * One of ConnectionStatus
             * @type Number
             */
            _connectionStatus,
            /**
             * This stores the value of the cursor as it was used in the battle, while some menu is active
             * @type String
             */
            _battleCursor,
            /**
             * Stores the timestamp of the last simulation step
             * @type DOMHighResTimeStamp
             */
            _prevDate,
            /**
             * Whether the time is stopped in the simulated battle currently
             * @type Boolean
             */
            _isTimeStopped,
            /**
             * A function handling the resizing of the window from the battle screen's perspective is stored in this variable
             * @type Function
             */
            _handleResize,
            /**
             * Stores the parameters of the last sent analytics event
             * @type Object
             */
            _analyticsState,
            /**
             * A reference to the created battle screen instance
             * @type BattleScreen
             */
            _battleScreen,
            /**
             * The ID of the timeout set to retry locking the pointer if it fails for the first time
             * @type Number
             */
            _pointerLockTimeout = -1,
            /**
             * The object that will be returned as this module
             * @type Battle
             */
            _battle = {},
            /**
             * The name (including the path within the mission folder) of the loaded mission file.
             * @type String
             */
            _missionSourceFilename,
            /**
             * 
             * @type Object
             */
            _missionData,
            /**
             * The timestamp taken when loading of the mission starts
             * @type DOMHighResTimeStamp;
             */
            _loadingStartTime,
            /**
             * The string ID of the difficulty level on which the battle is currently played.
             * @type String
             */
            _difficulty,
            /**
             * Whether the game is in demo mode, in which all spacecrafts are controlled by AI and automatic camera switching is performed.
             * @type Boolean
             */
            _demoMode,
            /**
             * Whether we are playing a multiplayer game
             * @type Boolean
             */
            _multi,
            /**
             * The translated gameplay tip text displayed in the loading box.
             * @type String
             */
            _tipText,
            /**
             * The theme identifier of the anticipation theme of the current mission (might be a combination of the ANTICIPATION_THEME_PREFIX and an
             * index for songs listed as the general anticipation themes (in settings.json) or the resource name of the track itself if a custom
             * track is chosen for the mission)
             * @type String
             */
            _anticipationTheme,
            /**
             * The theme identifier of the combat theme of the current mission (might be a combination of the COMBAT_THEME_PREFIX and an
             * index for songs listed as the general combat themes (in settings.json) or the resource name of the track itself if a custom
             * track is chosen for the mission)
             * @type String
             */
            _combatTheme,
            /**
             * The total time elapsed in simulation since the battle began, in milliseconds
             * @type Number
             */
            _elapsedTime,
            /**
             * The time elapsed since last switching view in demo mode, in milliseconds.
             * @type Number
             */
            _timeInSameView,
            /**
             * (enum missionEvents.MissionState) The last mission state that the player has been made aware of.
             * @type String
             */
            _displayedMissionState,
            /**
             * The elapsed simulation time since the game's end state changed to victory or defeat. In milliseconds
             * @type Number
             */
            _timeSinceGameStateChanged,
            /**
             * The elapsed simulation time since the multiplayer match has concluded. In milliseconds
             * @type Number
             */
            _timeSinceMultiMatchEnded,
            /**
             * The elapsed simulation time since the the player's spacecraft jumped out of the battle scene. In milliseconds
             * @type Number
             */
            _timeSincePlayerLeft,
            /**
             * A reference to the followed spacecraft (if any, as last displayed on the HUD)
             * @type Spacecraft
             */
            _spacecraft,
            /**
             * A cached reference to the squads in the team of the currently followed spacecraft, for quicker update of the wingmen status
             * indicator on the HUD
             * @type Array
             */
            _squads,
            /**
             * A cached reference to the missile classes equipped on the followed spacecraft, for quicker update of missile info indicator on the HUD
             * @type Array
             */
            _missileClasses,
            /**
             * A cached reference to the spacecrafts that need to be escorted (protected) by the player
             * @type Array
             */
            _escorts,
            /**
             * A cached reference to the spacecrafts that need to be destroyed by the player to complete the mission
             * @type Array
             */
            _targets,
            /**
             * The hull integrity of the followed spacecraft (if any, as last displayed on the HUD)
             * @type Number
             */
            _spacecraftHullIntegrity,
            /**
             * The shield integrity of the followed spacecraft (if any, as last displayed on the HUD)
             * @type Number
             */
            _spacecraftShieldIntegrity,
            /**
             * A reference to the target of the followed spacecraft (if any, as last displayed on the HUD)
             * @type Spacecraft
             */
            _target,
            /**
             * The hull integrity of the target of the followed spacecraft (if any, as last displayed on the HUD)
             * @type Number
             */
            _targetHullIntegrity,
            /**
             * The shield integrity of the target of the followed spacecraft (if any, as last displayed on the HUD)
             * @type Number
             */
            _targetShieldIntegrity,
            /**
             * An array storing the reference to all persistent HUD elements (so that when the graphics settings are changed, they can be
             * notified to update the shaders etc)
             * @type HUDElement[]
             */
            _hudElements = [],
            // HUD animation timing
            /**
             * The time left from the hull integrity decrease HUD animation, in milliseconds
             * @type Number
             */
            _hullIntegrityDecreaseTime,
            /**
             * The time left from the shield integrity decrease HUD animation, in milliseconds
             * @type Number
             */
            _shieldDecreaseTime,
            /**
             * The time left from the target hull integrity decrease HUD animation, in milliseconds
             * @type Number
             */
            _targetHullIntegrityDecreaseTime,
            /**
             * The time left from the target shield integrity decrease HUD animation, in milliseconds
             * @type Number
             */
            _targetShieldDecreaseTime,
            /**
             * The time left from the target switch HUD animation, in milliseconds
             * @type Number
             */
            _targetSwitchTime,
            /**
             * The time left from the aim assist appear HUD animation, in milliseconds
             * @type Number
             */
            _aimAssistAppearTime,
            /**
             * The time left / elapsed from the ship indicator highlight animation, in milliseconds
             * @type Number
             */
            _shipIndicatorHighlightTime,
            /**
             * A reference to the camera configuration that was active at the time an automatic configuration was set instead (i.e. during
             * jump sequences, to allow going back to the original configuration)
             * @type CameraConfiguration
             */
            _originalCameraConfig,
            // HUD messages
            /**
             * @typedef {Object} Battle~HUDMessage The properties of a message that can be displayed for the player on the HUD
             * @property {String} [text] The text of the message (formatted, translated, can contain '\n'-s)
             * @property {Number} [duration] The duration to display the message for, in milliseconds. If not given, an automatic
             * duration will be set based on the length of the text
             * @property {Number} timeLeft How much time is still left from displaying this message, in milliseconds
             * @property {String} [queue] The ID of the message queue this messag should go in
             * @property {Boolean} [permanent] If true, the message keeps being displayed until a new urgent
             * message is added or the queue is cleared
             * @property {Number[4]} [color] When given, the text is displayed using this text color
             * @property {Number} [blinkInterval] When given, the text will blink with this interval, in milliseconds
             * @property {Boolean} [silent=false] When true, the message sound effect will not be played for this message
             * @property {Boolean} [new=false] When a new message is put at the front of the queue, this flag is set to true
             * @property {Boolean} [appearAnimation=false] If true, the message will have a "typewriter" style appearing animation
             * @property {Number} appearDuration If appearAnimation is true, this holds the calculated value for the duration of the appear animation, in milliseconds
             * @property {Number} appearDurationLeft If appearAnimation is true, this holds the time left from the appear animation, in milliseconds
             * @property {Spacecraft} [source] If the message is a transmission from another spacecraft, this field holds a reference to that spacecraft
             */
            /**
             * Contains the HUD message queues by their IDs. Each queue is the list of messages to be displayed on the HUD for that queue. 
             * The messages are displayed in the order they are in the queue.
             * @type Object.<String, Battle~HUDMessage[]>
             */
            _messageQueues,
            /**
             * If the message currently displayed on the HUD is a transmission from another spacecraft, this holds the reference to that spacecraft
             * @type Spacecraft
             */
            _messageSource,
            /**
             * The sound played when a new HUD message is displayed.
             * @type SoundClip
             */
            _messageSound,
            /**
             * The sound played while the "typewriter" appear animation for a new HUD message is in progress.
             * @type SoundClip
             */
            _messageTypeSound,
            /**
             * The sound played when the current missile finishes loading while being already locked
             * @type SoundClip
             */
            _missileLoadedSound,
            /**
             * Whether the selected missile is loaded and ready for launch during the current frame (independently from being locked on target)
             * @type Boolean
             */
            _missileLoaded,
            /**
             * The sound played as the missile is being locked (several time during the locking process)
             * @type SoundClip
             */
            _missileLockingSound,
            /**
             * How many times should the locking sound play while locking before full missile lock is achieved (e.g. 3 means the sound plays at 0%, 33% and 67% lock)
             * @type Number
             */
            _missileLockingSoundCount,
            /**
             * The number of times the missile locking sound has been already played during the locking process
             * @type Number
             */
            _missileLockingSoundsPlayed,
            /**
             * The sound played when the selected missile gets locked on target.
             * @type SoundClip
             */
            _missileLockedSound,
            /**
             * Whether the selected missile is locked on target during the current frame
             * @type Boolean
             */
            _missileLocked,
            /**
             * The message that is displayed informing the player about engaged jump engines.
             * @type Battle~HUDMessage
             */
            _jumpMessage,
            /**
             * The message that is displayed informing the player about new hostiles that arrived.
             * @type Battle~HUDMessage
             */
            _newHostilesMessage,
            /**
             * The sound played when the new hostiles arrive
             * @type SoundClip
             */
            _newHostilesAlertSound,
            /**
             * The time left from the new hostiles alert (both the message and enemy highlights) - we need to decrease this
             * even when the message is not shown, because a higher priority message (e.g. winning or jump) pushed it. In milliseconds.
             * @type Number
             */
            _newHostilesAlertTimeLeft,
            /**
             * The sound played when the slow connection / connection lost warnings are shown
             * @type SoundClip
             */
            _connectionWarningSound,
            /**
             * An array holding references to the hostile spacecrafts that should be highlighted as newly arrived
             * @type Spacecraft[]
             */
            _newHostiles,
            /**
             * Used to determine the visibility of currently highlighted (blinking) HUD elements
             * @type Number
             */
            _hudHighlightTime,
            /**
             * Whether currently highlighted (blinking) HUD elements are visible at the moment
             * @type Number
             */
            _hudHighlightVisible,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // music related
            /**
             * The elapsed simulation time since a spacecraft last fired at a hostile target. (for deciding whether there is combat going
             * on to choose the right music track) In milliseconds
             * @type Number
             */
            _timeSinceLastFire,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // cached configuration settings
            /**
             * Cached setting of the duration while the combat theme is kept playing during battle after a spacecraft fires at a hostile 
             * target, in milliseconds
             * @type Number
             */
            _combatThemeDurationAfterFire,
            /**
             * Cached setting of the interval of blinking for highlighted HUD elements
             * @type Number
             */
            _hudHighlightInterval,
            /**
             * In multiplayer, the guest player is automatically disconnected from
             * the game, if it doesn't get any updates from the host (or the host 
             * from it) for this much time, in milliseconds
             * @type Number
             */
            _disconnectThreshold,
            // ................................................................................................
            // elements of the HUD and their stored state
            /**
             * Whether the HUD should be currently displayed.
             * @type Boolean
             */
            _isHUDVisible,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // central elements
            /**
             * A crosshair that is always shown at the center of the screen when the camera is set to an aiming view of a spacecraft.
             * @type HUDElement
             */
            _centerCrosshair,
            /**
             * Crosshairs that are shown in the line of fire of the weapons of the followed ship, at the same distance as the estimated
             * hit position.
             * @type HUDElement[]
             */
            _weaponImpactIndicators,
            /**
             * A bar showing the hull integrity of the current target near the center of the HUD / over the target (depending on settings)
             * @type HUDElement
             */
            _targetHullIntegrityQuickViewBar,
            /**
             * A bar showing the shield integrity of the current target near the center of the HUD / over the target (depending on settings)
             * @type HUDElement
             */
            _targetShieldQuickViewBar,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // cursor
            /**
             * When a spacecraft is controlled by the mouse, this HUD element is shown at the position of the cursor if it is within the 
             * deadzone (is not triggering a turn of the controlled spacecraft).
             * @type HUDElement
             */
            _hudStillCursor,
            /**
             * When a spacecraft is controlled by the mouse, this HUD element is shown at the position of the cursor if it is outside the 
             * deadzone (is triggering a turn of the controlled spacecraft), pointing towards the direction of the triggered turn.
             * @type HUDElement
             */
            _hudTurnCursor,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // 3D position based target info
            /**
             * Reticles that are shown at the location of the indicated ships 
             * @type HUDElement[]
             */
            _shipIndicators,
            /**
             * Arrows that points in the direction of indicated ships, when they are not visible on the screen.
             * @type HUDElement[]
             */
            _shipArrows,
            /**
             * Indicators shown around the current target that indicate the state of missile lock state
             * @type HUDElement[]
             */
            _missileLockIndicators,
            /**
             * The angle of the first missile lock indicator (to track them rotating around the target while locking), in radians
             * @type Number
             */
            _missileLockIndicatorAngle,
            /**
             * For tracking the time for the blinking of missile lock indicators while locked
             * @type Number
             */
            _missileLockIndicatorBlinkTime,
            /**
             * Houses the texts displaying the distance from the target at its indicator reticle
             * @type TextLayer
             */
            _distanceTextLayer,
            /**
             * Displays the current calculated distance from the target at its indicator reticle
             * @type CanvasText
             */
            _distanceText,
            /**
             * Little icons that are displayed next to ship reticles and arrows which relay information about the spacecrafts
             * (e.g. if it is an objective target or is transmitting the message that is displayed on the HUD)
             * @type HUDElement[]
             */
            _shipStatusIndicators,
            /**
             * A reticle that is shown at the estimated location towards which the followed spacecraft has to fire in order to hit the
             * current target, given the current velocity of both and the speed of the first fired projectile of the first equipped weapon.
             * @type HUDElement
             */
            _aimAssistIndicator,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // target info panel
            /**
             * The scene to which a view of the currently selected target ship is rendered.
             * @type Scene
             */
            _targetScene,
            /**
             * A reference to the currently displayed spacecraft in the target view scene.
             * @type Spacecraft
             */
            _targetViewItem,
            /**
             * A reference to the visual model that was added to the target view scene to display the current target
             * @type ParameterizedMesh
             */
            _targetViewModel,
            /**
             * The reusable matrix to store the orientation of the target view item
             * @type Float32Array
             */
            _targetViewOrientationMatrix = mat.identity4(),
            /**
             * Stores the parameters for adding the target view item to the target view scene
             * @type Object
             */
            _targetViewParams,
            /**
             * The RGBA color of the currently displayed spacecraft in the target view screen. (based on its hull integrity)
             * @type Number[4]
             */
            _targetViewItemColor,
            /**
             * A rectangle displayed as the background of the panel showing the information about the current target (including the target
             * view scene, hull integrity bar, textual information...), if there is one selected.
             * @type HUDElement
             */
            _targetInfoBackground,
            /**
             * A bar showing the current hull integrity of the selected target within the target info panel.
             * @type HUDElement
             */
            _targetHullIntegrityBar,
            /**
             * A bar showing the current shield integrity of the selected target within the target info panel.
             * @type HUDElement
             */
            _targetShieldBar,
            /**
             * Houses all the texts that display information about the current target within the target info panel.
             * @type TextLayer
             */
            _targetInfoTextLayer,
            /**
             * Stores the texts that Display the various information about the currently targeted spacecraft within the target info panel.
             * The keys are IDs (defined among the constants)
             * @type Object.<String, CanvasText>
             */
            _targetInfoTexts,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // wingmen status panel
            /**
             * A rectangle displayed as the background of the panel showing the information about the wingmen
             * @type HUDElement
             */
            _wingmenStatusBackground,
            /**
             * Houses the texts of the wingmen status indicator panel.
             * @type TextLayer
             */
            _wingmenStatusTextLayer,
            /**
             * Displays the header text (i.e. "Wingmen:") on the wingmen status indicator panel.
             * @type CanvasText
             */
            _wingmenStatusHeaderText,
            /**
             * The indicator laid over the spacecraft indicator that represents the player's spacecraft (if it is within a squad) on the
             * wingmen status indicator
             * @type HUDElement
             */
            _wingmenStatusPlayerIndicator,
            /**
             * The indicators for the individual spacecrafts within the squads for the wingmen status panel
             * @type {body: HUDElement, shield: HUDElement}[]
             */
            _wingmenStatusCraftIndicators,
            /**
             * Stored layouts for each of the individual spacecraft indicators of the wingmen status panel. This array is cleared whenever
             * a new spacecraft is followed so that new layouts are automatically generated for the (potentially) different squads
             * @type ClipSpaceLayout
             */
            _wingmenStatusCraftLayouts,
            /**
             * Displays the names of the squads on the wingmen status panel
             * @type CanvasText[]
             */
            _wingmenStatusSquadTexts,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // speed and drift indicators
            /**
             * Displays the current forward or reverse speed compared to a calculated maximum in the form of a partially filled bar.
             * @type HUDElement
             */
            _speedBar,
            /**
             * Highlights the current target (intended) forward or reverse speed within the speed bar.
             * @type HUDElement
             */
            _speedTargetIndicator,
            /**
             * Indicates the current missile firing mode (single / salvo) and status (loading / out of range / locking / ready to fire) with icon and color
             * @type HUDElement
             */
            _missileIndicator,
            /**
             * Houses the missile indicator text
             * @type TextLayer
             */
            _missileIndicatorTextLayer,
            /**
             * Displays the count for the currently selected missile class
             * @type CanvasText
             */
            _missileIndicatorText,
            /**
             * Houses the texts displaying the current and reference speed values.
             * @type TextLayer
             */
            _speedTextLayer,
            /**
             * Displays the current calculated reference (forward or reverse) speed (relative to which the speed bar is filled) next to (the 
             * top or bottom of) the speed bar.
             * @type CanvasText
             */
            _maxSpeedText,
            /**
             * Displays the current (forward or reverse) speed of the followed spacecraft next to the speed bar.
             * @type CanvasText
             */
            _currentSpeedText,
            /**
             * An arrow pointing towards the direction the followed spacecraft is drifting towards with a color based on the intensity of
             * the drift.
             * @type HUDElement
             */
            _driftArrow,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // hull integrity bar
            /**
             * Displays the hull integrity of the followed spacecraft.
             * @type HUDElement
             */
            _hullIntegrityBar,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // shield integrity bar
            /**
             * Displays the shield integrity of the followed spacecraft.
             * @type HUDElement
             */
            _shieldBar,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // flight mode indicator
            /**
             * A rectangle displayed as the background for the flight mode indicator panel.
             * @type HUDElement
             */
            _flightModeIndicatorBackground,
            /**
             * Houses the texts of the flight mode indicator panel.
             * @type TextLayer
             */
            _flightModeIndicatorTextLayer,
            /**
             * Displays the header text (i.e. "Flight mode:") on the flight mode indicator panel.
             * @type CanvasText
             */
            _flightModeHeaderText,
            /**
             * Displays the current flight mode on the flight mode indicator panel.
             * @type CanvasText
             */
            _flightModeText,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // missile info indicator
            /**
             * A rectangle displayed as the background for the missile info indicator panel.
             * @type HUDElement
             */
            _missileInfoBackground,
            /**
             * Houses the texts of the missile info indicator panel.
             * @type TextLayer
             */
            _missileInfoTextLayer,
            /**
             * Displays the header text (i.e. "Missiles:") on the missile info indicator panel.
             * @type CanvasText
             */
            _missileInfoHeaderText,
            /**
             * Displays the class name and count about missiles on the missile info indicator panel.
             * @type CanvasText[]
             */
            _missileInfoNameTexts,
            _missileInfoCountTexts,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // headers
            /**
             * Houses the header texts.
             * @type TextLayer
             */
            _headerTextLayer,
            /**
             * Displays a smaller header text at the top center of the screen, shown/hidden independently from the HUD, used for displaying
             * version info.
             * @type CanvasText
             */
            _smallHeaderText,
            /**
             * Displays a larger header text below the small one, shown/hidden with the rest of the HUD.
             * @type CanvasText
             */
            _bigHeaderText,
            /**
             * Displays a smaller header text below the big one, shown/hidden with the rest of the HUD.
             * @type CanvasText
             */
            _subheaderText,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // message
            /**
             * A rectangle displayed as the background for the HUD message.
             * @type HUDElement
             */
            _messageBackground,
            /**
             * Houses the message text.
             * @type TextLayer
             */
            _messageTextLayer,
            /**
             * A message that can be displayed to the user (status of the mission, tutorial, radio chatter...)
             * @type CanvasText
             */
            _messageText,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // top left
            /**
             * Houses the score text
             * @type TextLayer
             */
            _topLeftTextLayer,
            /**
             * Displays the score of the player
             * @type CanvasText
             */
            _scoreText,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // objectives indicator
            /**
             * A rectangle displayed as the background for the mission objective indicator panel.
             * @type HUDElement
             */
            _objectivesBackground,
            /**
             * Houses the texts of the mission objective indicator panel.
             * @type TextLayer
             */
            _objectivesTextLayer,
            /**
             * Displays the header text (i.e. "Objectives:") on the mission objective indicator panel.
             * @type CanvasText
             */
            _objectivesHeaderText,
            /**
             * Displays the objectives on the mission objective indicator panel.
             * @type CanvasText[]
             */
            _objectivesTexts,
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // escorted ships indicator
            /**
             * A rectangle displayed as the background for the escorted ships indicator panel.
             * @type HUDElement
             */
            _escortsBackground,
            /**
             * Houses the texts of the escorted ships indicator panel.
             * @type TextLayer
             */
            _escortsTextLayer,
            /**
             * Displays the header text (i.e. "Protect:") on the escorted ships indicator panel.
             * @type CanvasText
             */
            _escortsHeaderText,
            /**
             * Displays the names of the escorted ships on the indicator panel.
             * @type CanvasText[]
             */
            _escortsTexts,
            /**
             * The HUD elements and layouts for displaying the hull and shield integrity bars for each escorted ship
             * @type {hull: HUDElement, shield: HUDElement, hullLayout: ClipSpaceLayout, shieldLayout: ClipSpaceLayout}[]
             */
            _escortBars,
            // ................................................................................................
            // cached references of setting values used for the layout of the HUD
            /**
             * Whether the crosshairs should be offset for aim assist instead of showing a separate indicator.
             * @type Boolean
             */
            _aimAssistCrosshairs,
            /**
             * (enum ScaleMode) Stores the scaling mode to use for the center crosshair for quicker access.
             * @type String
             */
            _centerCrosshairScaleMode,
            /**
             * Stores a reference to the layout used for distance text's clearing box
             * @type LayoutDescriptor
             */
            _distanceTextBoxLayoutDescriptor,
            /**
             * Stores a reference to the layout used for the target view scene for quicker access.
             * @type ClipSpaceLayout
             */
            _targetViewLayout,
            /**
             * Stores a reference to the layout used for the target info background HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _targetInfoBackgroundLayout,
            /**
             * Stores a reference to the layout used for the wingmen status background HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _wingmenStatusBackgroundLayout,
            /**
             * Stores a reference to the layout used for the target hull integrity bar HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _targetHullIntegrityBarLayout,
            /**
             * Stores a reference to the layout used for the target shield integrity bar HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _targetShieldBarLayout,
            /**
             * Stores a reference to the layout used for the speed bar HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _speedBarLayout,
            /**
             * Stores a reference to the size used for the speed target indicator HUD element for quicker access.
             * @type Number[2]
             */
            _speedTargetIndicatorSize,
            /**
             * Stores a reference to the layout used for the missile indicator HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _missileIndicatorLayout,
            /**
             * Stores a reference to the layout used for the hull integrity bar HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _hullIntegrityBarLayout,
            /**
             * Stores a reference to the layout used for the shield integrity bar HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _shieldBarLayout,
            /**
             * Stores a reference to the layout used for the flight mode indicator background HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _flightModeIndicatorBackgroundLayout,
            /**
             * Stores a reference to the layout used for the missile info indicator background HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _missileInfoBackgroundLayout,
            /**
             * Stores a reference to the layout used for the target hull integrity quick view bar HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _targetHullIntegrityQuickViewBarLayout,
            /**
             * Stores a reference to the layout used for the target shield integrity quick view bar HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _targetShieldQuickViewBarLayout,
            /**
             * Stores a reference to the layout used for the mission objective indicator background HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _objectivesBackgroundLayout,
            /**
             * Stores a reference to the layout used for the escorted ships indicator background HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _escortsBackgroundLayout,
            /**
             * Stores a reference to the layout used for the message background HUD element for quicker access.
             * @type ClipSpaceLayout
             */
            _messageBackgroundLayout,
            // ................................................................................................
            // other cached setting values used for the HUD
            /**
             * The duration of the target switch animation (scaling applied to target indicator reticle / arrow and weapon impact indicators),
             * in milliseconds
             * @type Number
             */
            _hudTargetSwitchAnimationDuration,
            /**
             * The duration of the aim assist appear animation, in milliseconds
             * @type Number
             */
            _hudAimAssistAppearAnimationDuration,
            /**
             * The duration of the hull integrity decrease animation (highlighting hull integrity bar), in milliseconds
             * @type Number
             */
            _hudHullIntegrityDecreaseAnimationDuration,
            /**
             * The duration of the shield integrity decrease animation (highlighting shield integrity bar), in milliseconds
             * @type Number
             */
            _hudShieldDecreaseAnimationDuration,
            /**
             * The duration of the target hull integrity decrease animation (highlighting target hull integrity quick view bar), in milliseconds
             * @type Number
             */
            _hudTargetHullIntegrityDecreaseAnimationDuration,
            /**
             * The duration of the target shield integrity decrease animation (highlighting target shield integrity quick view bar), in milliseconds
             * @type Number
             */
            _hudTargetShieldDecreaseAnimationDuration,
            /**
             * The interval of the ship indicator (reticle/arrow) highlight animation, in milliseconds
             * @type Number
             */
            _shipIndicatorHighlightAnimationInterval,
            /**
             * The horizontal and vertical min/max sizes of the target indicator reticle
             * @type Object.<String, Number[2]>
             */
            _shipIndicatorSizes,
            /**
             * The factor by which to multiply the visible size of spacecrafts to get the size of their indicator
             * @type type
             */
            _shipIndicatorSizeFactor,
            /**
             * The scaling to apply to the target indicator reticle at the start of the target switch HUD animation
             * @type Number
             */
            _targetIndicatorSwitchScale,
            /**
             * The horizontal and vertical base size of the target indicator arrow
             * @type Number[2]
             */
            _shipArrowSizes,
            /**
             * The scaling to apply to the target indicator arrow at the start of the target switch HUD animation
             * @type Number
             */
            _targetArrowSwitchScale,
            /**
             * The horizontal and vertical base size of the weapon impact indicators
             * @type Number[2]
             */
            _weaponImpactIndicatorSize,
            /**
             * The scaling to apply to the weapon impact indicators at the start of the target switch HUD animation
             * @type Number
             */
            _weaponImpactIndicatorSwitchScale,
            /**
             * The horizontal and vertical base size of the aim assist indicator
             * @type Number[2]
             */
            _aimAssistIndicatorSize,
            /**
             * The scaling to apply to the aim assist indicator at the start of the appear / target switch HUD animation
             * @type Number
             */
            _aimAssistIndicatorAppearScale,
            /**
             * The minimum drift speed at which the drift arrow HUD element is displayed.
             * @type Number
             */
            _driftArrowMinSpeed,
            /**
             * The factor by which to multiply the acceleration of the followed spacecraft to get the drift speed at which the drift arrow is
             * displayed with the max speed color.
             * @type Number
             */
            _driftArrowMaxSpeedFactor,
            /**
             * The settings object for escorted ship hull and shield integrity bars is used at various points, so we store a cached reference to it
             * @type Object
             */
            _escortsIntegrityBarsSettings,
            /**
             * The settings object for wingmen status craft indicators is used at various points, so we store a cached reference to it
             * @type Object
             */
            _wingmenStatusCraftIndicatorSettings,
            /**
             * Stores that based on the configuration, what is the biggest size a squad can be so that there are positions defined for all
             * individual spacecraft indicators within it, in case it needs to be displayed on the wingmen status indicator panel
             * @type Number
             */
            _wingmenStatusMaxSquadMemberCount,
            /**
             * The settings object for message text is used frequently for setting message colors, so we store a cached reference to it
             * @type Object
             */
            _messageTextSettings,
            /**
             * An array storing the current state of each of the HUD sections
             * @type Number[]
             */
            _hudSectionStates;
    // -------------------------------------------------------------------------
    // Freezing enums
    Object.freeze(HUDSection);
    Object.freeze(HUDSectionState);
    // ------------------------------------------------------------------------------
    // private functions
    /**
     * When the followed spacecraft changes or spacecrafts switch teams, we need to re-generate
     * the wingman status indicators
     */
    function _refreshWingmanStatusPanel() {
        _squads = _spacecraft.getTeam() ? _spacecraft.getTeam().getSquads() : [];
        _wingmenStatusCraftLayouts = []; // drop the previous array so new layouts are generated for potentially new squads
    }
    /**
     * Executes one simulation (and control) step for the battle.
     */
    function _simulationLoopFunction() {
        var followedCraft, curDate, dt, i, players;
        if (_simulationLoop !== LOOP_CANCELED) {
            curDate = performance.now();
            dt = curDate - _prevDate;
            _timeSinceHostUpdate += dt;
            control.control(dt);
            if (_multi && !networking.isHost()) {
                if (!_mission.getPilotedSpacecraft().canBeReused()) {
                    networking.sendGuestUpdate(_mission.getPilotedSpacecraft());
                }
            }
            ai.control(dt);
            followedCraft = _mission.getFollowedSpacecraftForScene(_battleScene);
            if (!_isTimeStopped) {
                _mission.tick(dt, _battleScene, _multi);
                if (_multi) {
                    if (networking.isHost()) {
                        if (_timeSinceHostUpdate >= HOST_UPDATE_INTERVAL) {
                            _timeSinceHostUpdate = 0;
                            networking.sendHostUpdate(_mission.getSpacecrafts());
                        }
                        players = networking.getPlayers();
                        for (i = 1; i < players.length; i++) {
                            if (!players[i].left) {
                                _timeSinceGuestUpdates[i] += dt;
                                if (_timeSinceGuestUpdates[i] > _disconnectThreshold) {
                                    networking.guestTimeout(players[i].name);
                                }
                            }
                        }
                    } else {
                        if (_timeSinceHostUpdate > _disconnectThreshold) {
                            _multi = false;
                            game.getScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME).updateData();
                            networking.leaveGame();
                            _battleScreen.showMessage(strings.get(strings.MULTI_BATTLE.CONNECTION_TIMEOUT), function () {
                                game.setScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME);
                            });
                        } else if (_timeSinceHostUpdate > config.getSetting(config.MULTI_SETTINGS.CONNECTION_LOST_THRESHOLD)) {
                            if (_connectionStatus !== ConnectionStatus.LOST) {
                                _connectionStatus = ConnectionStatus.LOST;
                                _battleScreen.clearHUDMessages(CONNECTION_QUEUE);
                                _battleScreen.queueHUDMessage({
                                    text: strings.get(strings.MULTI_BATTLE.CONNECTION_LOST),
                                    color: _messageTextSettings.colors.connectionLost,
                                    queue: CONNECTION_QUEUE,
                                    permanent: true,
                                    silent: true
                                }, true);
                                _connectionWarningSound.play();
                            }
                        } else if (_timeSinceHostUpdate > config.getSetting(config.MULTI_SETTINGS.SLOW_CONNECTION_THRESHOLD)) {
                            if (_connectionStatus !== ConnectionStatus.SLOW) {
                                _connectionStatus = ConnectionStatus.SLOW;
                                _battleScreen.clearHUDMessages(CONNECTION_QUEUE);
                                _battleScreen.queueHUDMessage({
                                    text: strings.get(strings.MULTI_BATTLE.SLOW_CONNECTION),
                                    color: _messageTextSettings.colors.slowConnection,
                                    queue: CONNECTION_QUEUE,
                                    permanent: true,
                                    silent: true
                                }, true);
                                _connectionWarningSound.play();
                            }
                        } else {
                            if (_connectionStatus !== ConnectionStatus.GOOD) {
                                _connectionStatus = ConnectionStatus.GOOD;
                                _battleScreen.clearHUDMessages(CONNECTION_QUEUE);
                            }
                        }
                    }
                }
                _elapsedTime += dt;
                if (!_mission.isFinished() && !_mission.noHostilesPresent()) {
                    _timeSinceLastFire += dt;
                    if (_timeSinceLastFire > _combatThemeDurationAfterFire) {
                        audio.playMusic(_anticipationTheme);
                    }
                }
            }
            if (followedCraft) {
                // handling the loss of the spacecraft that is followed by the camera
                if (followedCraft.canBeReused() || followedCraft.isAway()) {
                    if (control.isInPilotMode()) {
                        control.switchToSpectatorMode(true);
                    } else if (_demoMode) {
                        // first, try to switch to a new spacecraft, if there are none, switch to free camera
                        if (!_battleScene.getCamera().followNextNode()) {
                            control.switchToSpectatorMode(true, true);
                        }
                        _timeInSameView = 0;
                    }
                } else if (_demoMode) {
                    if (config.getBattleSetting(config.BATTLE_SETTINGS.DEMO_VIEW_SWITCHING)) {
                        // automatic view switching in demo mode
                        _timeInSameView += dt;
                        if (_timeInSameView > config.getSetting(config.BATTLE_SETTINGS.DEMO_VIEW_SWITCH_INTERVAL)) {
                            _timeInSameView = 0;
                            _battleScene.getCamera().changeToNextView();
                            if (Math.random() < config.getSetting(config.BATTLE_SETTINGS.DEMO_DOUBLE_VIEW_SWITCH_CHANCE)) {
                                _battleScene.getCamera().changeToNextView();
                            }
                        }
                    }
                }
            }
            _prevDate = curDate;
        }
    }
    /**
     * Removes the stored renferences to the logic and graphical models of the battle.
     */
    function _clearData() {
        if (_mission) {
            _mission.destroy();
        }
        _mission = null;
        if (_battleScene) {
            _battleScene.clear(true);
        }
        _battleScene = null;
        if (_targetScene) {
            _targetScene.clear(true);
        }
        _targetScene = null;
        _messageQueues = null;
        _newHostilesMessage = null;
        _newHostilesAlertTimeLeft = 0;
        _newHostiles = null;
        audio.playMusic(null);
        // HUD
        _hullIntegrityDecreaseTime = 0;
        _shieldDecreaseTime = 0;
        _targetHullIntegrityDecreaseTime = 0;
        _targetShieldDecreaseTime = 0;
        _targetSwitchTime = 0;
        _aimAssistAppearTime = 0;
        _shipIndicatorHighlightTime = 0;
        // other
        _tipText = "";
        _hudSectionStates = null;
    }
    /**
     * Sets the tip text by choosing one randomly from the available options.
     */
    function _chooseTipText() {
        var
                tipIDs = _missionSourceFilename && missions.getMissionDescriptor(_missionSourceFilename).getTipIDs() || missions.getTipIDs(),
                i = Math.min(Math.floor(Math.random() * tipIDs.length), tipIDs.length - 1);
        _tipText = strings.get(strings.TIP.PREFIX, tipIDs[i]);
    }
    // ------------------------------------------------------------------------------
    // public functions
    /**
     * Stops the time in the battle simulation.
     */
    function stopTime() {
        _isTimeStopped = true;
        if (_battleScene) {
            _battleScene.setShouldAnimate(false);
        }
    }
    /**
     * Resumes the time in the battle simulation
     */
    function resumeTime() {
        if (_battleScene) {
            _battleScene.setShouldAnimate(true);
        }
        _isTimeStopped = false;
    }
    /**
     * Changes whether the time is stopped in the simulation to the opposite of the current value
     */
    function toggleTime() {
        if (_isTimeStopped) {
            resumeTime();
        } else {
            stopTime();
        }
    }
    /**
     * Hides all elements of the HUD. (rendering the battle screen after this will not show the HUD)
     */
    function hideHUD() {
        _isHUDVisible = false;
    }
    /**
     * Shows all elements of the HUD. (rendering the battle screen after this will show the HUD)
     */
    function showHUD() {
        _isHUDVisible = true;
    }
    /**
     * Switches the current state of visibility of the HUD to its opposite.
     */
    function toggleHUDVisibility() {
        _isHUDVisible = !_isHUDVisible;
    }
    /**
     * Updates all HUD elements for the case when the graphics settings have been changed (i.e. clears cached values depending on graphics 
     * settings)
     */
    function handleGraphicsSettingsChanged() {
        var i;
        for (i = 0; i < _hudElements.length; i++) {
            _hudElements[i].handleGraphicsSettingsChanged();
        }
    }
    // ------------------------------------------------------------------------------
    // Spacecraft event handlers
    /**
     * Updates the state / mood based music theme for the case a spacecraft just fired.
     */
    function _handleSpacecraftFired() {
        var target = this.getTarget();
        if (target && target.isHostile(this) && !_mission.isFinished()) {
            _timeSinceLastFire = 0;
            if (_combatTheme) {
                audio.playMusic(_combatTheme);
            }
        }
    }
    /**
     * Handles camera configuration / HUD message features related to the jump engine engaged event
     * @returns {Boolean} Always true (signals the spacecraft's jump engine that the HUD actions happened so it can play the related sound
     * effect)
     */
    function _handlePilotedSpacecraftJumpEngaged() {
        _jumpMessage = {
            text: strings.get(strings.BATTLE.MESSAGE_JUMP_ENGAGED),
            color: _messageTextSettings.colors.jump,
            queue: JUMP_QUEUE,
            permanent: true,
            silent: true
        };
        _battleScreen.queueHUDMessage(_jumpMessage, true);
        _originalCameraConfig = _battleScene.getCamera().getConfiguration();
        return true;
    }
    /**
     * Handles camera configuration / HUD message features related to the jump engine cancelled event
     * @returns {Boolean} Always true (signals the spacecraft's jump engine that the HUD actions happened so it can play the related sound
     * effect)
     */
    function _handlePilotedSpacecraftJumpCancelled() {
        _battleScreen.clearHUDMessages(JUMP_QUEUE);
        _battleScene.getCamera().startTransitionToConfiguration(_originalCameraConfig);
        return true;
    }
    /**
     * If the given spacecraft has a view with the given name, initiates a transition for the battle scene camera to the corresponding 
     * camera configuration
     * @param {Spacecraft} craft
     * @param {String} viewName
     * @param {Number} duration The duration of the transition, in milliseconds
     * @returns {Boolean} Whether there was a view found (and transition initiated)
     */
    function _switchToCameraConfig(craft, viewName, duration) {
        var camConfigs = craft.getVisualModel().getNode().getCameraConfigurationsWithName(viewName);
        if (camConfigs.length > 0) {
            _battleScene.getCamera().startTransitionToConfiguration(camConfigs[0], duration);
            return true;
        }
        return false;
    }
    /**
     * Handles camera configuration / HUD message features related to the jump engine prepare event
     * @param {SpacecraftEvents~PreparingJumpData} data
     */
    function _handlePilotedSpacecraftPreparingJump(data) {
        // when starting the preparation...
        if (data.duration === data.timeLeft) {
            _switchToCameraConfig(this, config.getSetting(config.BATTLE_SETTINGS.JUMP_PREPARE_VIEW_NAME), data.duration);
        }
        // when finishing the preparation
        if (data.timeLeft <= 0) {
            hideHUD();
            if (!_switchToCameraConfig(this, config.getSetting(config.BATTLE_SETTINGS.JUMP_OUT_VIEW_NAME), 0)) {
                _battleScene.getCamera().setToFreeCamera();
            }
        } else {
            // during preparation
            _battleScreen.queueHUDMessage({
                text: utils.formatString(strings.get(strings.BATTLE.MESSAGE_JUMP_PREPARING), {
                    timeLeft: utils.formatTimeToSeconds(data.timeLeft)
                }),
                color: _messageTextSettings.colors.jump,
                duration: 1,
                queue: JUMP_QUEUE,
                silent: true
            }, true);
        }
    }
    /**
     * Handles camera configuration features related to the jump out event for non-piloted spacecrafts
     */
    function _handleSpacecraftJumpOutStarted() {
        if (this === _mission.getFollowedSpacecraftForScene(_battleScene)) {
            if (_demoMode) {
                _switchToCameraConfig(this, config.getSetting(config.BATTLE_SETTINGS.JUMP_OUT_VIEW_NAME), 0);
            } else {
                _battleScene.getCamera().setToFreeCamera();
            }
        }
    }
    /**
     * Issues / updates the HUD message notifying of new hostiles if necessary
     */
    function _handleSpacecraftArrived() {
        /**@type Spacecraft */
        var craft = _mission.getPilotedSpacecraft();
        if (craft && craft.isAlive() && !craft.isAway() && craft.isHostile(this)) {
            if (!_newHostilesMessage || (_newHostilesAlertTimeLeft <= 0)) {
                if (_newHostilesMessage) {
                    _newHostilesMessage.timeLeft = 0;
                }
                _newHostilesMessage = {
                    text: "\n\n" + strings.get(strings.BATTLE.MESSAGE_NEW_HOSTILES),
                    color: _messageTextSettings.colors.alert,
                    blinkInterval: config.getHUDSetting(config.BATTLE_SETTINGS.HUD.NEW_HOSTILES_ALERT_BLINK_INTERVAL),
                    duration: config.getHUDSetting(config.BATTLE_SETTINGS.HUD.NEW_HOSTILES_ALERT_DURATION),
                    silent: true,
                    queue: HOSTILE_ALERT_QUEUE
                };
                _battleScreen.queueHUDMessage(_newHostilesMessage, true);
                _newHostiles = [this];
                _newHostilesAlertSound.play();
            } else {
                _newHostiles.push(this);
            }
            _newHostilesAlertTimeLeft = _newHostilesMessage.duration;
        }
    }
    /**
     * Updates the HUD state according to the passed HUD event data
     * @param {SpacecraftEvents~HUDData} data
     */
    function _handleHUDEvent(data) {
        var i, state;
        state = HUDSectionState[utils.constantName(data.state)];
        if (data.section) {
            _hudSectionStates[HUDSection[utils.constantName(data.section)]] = state;
        } else {
            for (i = 0; i < _hudSectionStates.length; i++) {
                _hudSectionStates[i] = state;
            }
        }
    }
    // ##############################################################################
    /**
     * @class Can be used to represent an element of the HUD, for which it can create an appropriate UIElement and add it to the battle scene.
     * @param {String} shaderName The name of the shader to use for rendering this element.
     * @param {String} textureName The name of the common texture resource to use for this element.
     * @param {Number[2]|Number[3]} position The 2D or 3D (starting) position of the element (depending on the shader used)
     * @param {Number[2]} size The 2D size factor of the element to scale it.
     * @param {String} scaleMode (enum ScaleMode) The scaling mode to be used to size this element.
     * @param {Number[4]} color An RGBA color for the element it can be modulated with. (inside the clip zone)
     * @param {Number[4]} [clipColor] An RGBA color to be used for modulation outside the clip zone set for the element.
     * @param {Number[2][2]} [textureCoordinates] The coordinates for the top-left and bottom-right corners of the section of the texture
     * image to use for texture mapping (or other corners if flipped horizontally or vertically) If not given, the whole image is used.
     * (0;0) is top-left and (1;1) is bottom-right of the image
     */
    function HUDElement(shaderName, textureName, position, size, scaleMode, color, clipColor, textureCoordinates) {
        /**
         * Manages the acquiry of appropriate resources.
         * @type TexturedModelClass
         */
        this._class = new classes.TexturedModelClass({
            name: HUD_ELEMENT_CLASS_NAME,
            shader: shaderName,
            texture: textureName
        });
        /**
         * The 2D or 3D (starting) position of the element (depending on the shader used)
         * @type Number[2]|Number[3]
         */
        this._position = position;
        /**
         * The 2D factor of the element to scale it.
         * @type Number[2]
         */
        this._scale = [0.5 * size[0], 0.5 * size[1]]; // square model coordinates are -1 to 1, resulting in a scale of 1 corresponding to a size of 2
        /**
         * (enum ScaleMode) The scaling mode to be used to size this element.
         * @type String
         */
        this._scaleMode = scaleMode;
        /**
         * An RGBA color for the element it can be modulated with. (inside the clip zone)
         * @type Number[4]
         */
        this._color = color;
        /**
         * The current angle for the element to be rotated by in 2D, in radians.
         * @type Number
         */
        this._angle = 0;
        /**
         * The coordinates specifying the clip zone for this element, in the form of [minX, maxX, minY, maxY], where the area outside the
         * min-max range on either the X or Y is considered to be outside the clip zone, and all coordinates go from -1 (left / bottom) to
         * 1 (right / top), corresponding to a relative position within the element.
         * @type Number[4]
         */
        this._clipCoordinates = renderableObjects.CLIP_COORDINATES_NO_CLIP.slice();
        /**
         * An RGBA color to be used for modulation outside the clip zone set for the element.
         * @type Number[4]
         */
        this._clipColor = clipColor || [0, 0, 0, 0];
        /**
         * The coordinates for the top-left and bottom-right corners of the section of the texture image to use for texture mapping (or 
         * other corners if flipped horizontally or vertically) When not set, the whole image is used.
         * (0;0) is top-left and (1;1) is bottom-right of the image
         * @type Number[2][2]
         */
        this._textureCoordinates = textureCoordinates;
        /**
         * A reference to the visual model that is used to add a representation of this element to the scene.
         * @type UIElement
         */
        this._visualModel = null;
        /**
         * A reference to the node at which the visual model of this element is stored in the scene.
         * @type RenderableNode
         */
        this._node = null;
    }
    /**
     * Returns the name of the model to be used / created for this HUD element, based on its texture coordinates
     * @returns {String}
     */
    HUDElement.prototype._getModelName = function () {
        return HUD_ELEMENT_MODEL_NAME_PREFIX + (this._textureCoordinates ?
                MODEL_NAME_INFIX + (this._textureCoordinates[0].join(MODEL_NAME_INFIX) + MODEL_NAME_INFIX + this._textureCoordinates[1].join(MODEL_NAME_INFIX)) :
                "");
    };
    /**
     * Grabs the references to all needed resource objects and marks them for loading. Automatically called when the element is added to a scene.
     */
    HUDElement.prototype._acquireResources = function () {
        var modelName, model;
        modelName = this._getModelName();
        model = resources.getModel(modelName, {allowNullResult: true});
        this._class.acquireResources({model: model || egomModel.squareModel(modelName, this._textureCoordinates)});
    };
    /**
     * Sets up the visual model to represent this HUD element, creating it if necessary. Automatically called when the element is added to a 
     * scene.
     */
    HUDElement.prototype._initVisualModel = function () {
        if (!this._visualModel) {
            this._visualModel = new renderableObjects.UIElement(
                    this._class.getModel(),
                    this._class.getShader(),
                    this._class.getTexturesOfTypes(this._class.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    this._position,
                    this._scale,
                    this._scaleMode,
                    this._color,
                    Math.degrees(this._angle),
                    this._clipCoordinates,
                    this._clipColor);
        } else {
            this._visualModel.init(
                    this._class.getModel(),
                    this._class.getShader(),
                    this._class.getTexturesOfTypes(this._class.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    this._position,
                    this._scale,
                    this._scaleMode,
                    this._color,
                    Math.degrees(this._angle),
                    this._clipCoordinates,
                    this._clipColor);
        }
    };
    /**
     * Returns the current scale factor used (on the X and Y axes) for the element.
     * @returns {Number[2]}
     */
    HUDElement.prototype.getScale = function () {
        return this._scale;
    };
    /**
     * Returns the scale mode (enum: utils.ScaleMode) set for this HUD element
     * @returns {String}
     */
    HUDElement.prototype.getScaleMode = function () {
        return this._scaleMode;
    };
    /**
     * Returns the current RGBA color set for this element. (direct reference)
     * @returns {Number[4]}
     */
    HUDElement.prototype.getColor = function () {
        return this._color;
    };
    /**
     * Marks all needed resources for loading and sets a callback to add the visual model of this element to the passed scene if when all
     * resources are loaded (or adds it right away, if the resources are already loaded at the time of call)
     * @param {Scene} scene
     */
    HUDElement.prototype.addToScene = function (scene) {
        this._acquireResources();
        resources.executeWhenReady(function () {
            this._initVisualModel();
            this._node = scene.addUIObject(this._visualModel);
        }.bind(this));
    };
    /**
     * Marks all needed resources for loading and sets a callback to add the resources to the passed scene if when all
     * resources are loaded (or adds it right away, if the resources are already loaded at the time of call)
     * @param {Scene} scene
     */
    HUDElement.prototype.addResourcesToScene = function (scene) {
        this._acquireResources();
        resources.executeWhenReady(function () {
            this._initVisualModel();
            scene.addResourcesOfObject(this._visualModel);
        }.bind(this));
    };
    /**
     * Hides the visual representation of this element in the scene it was added to.
     */
    HUDElement.prototype.hide = function () {
        this._node.hide();
    };
    /**
     * Shows (makes visible) the visual representation of this element in the scene it was added to.
     */
    HUDElement.prototype.show = function () {
        this._node.show();
    };
    /**
     * Returns whether the visual representation of this element is set to be visible in the scene it was added to.
     * @returns {Boolean}
     */
    HUDElement.prototype.isVisible = function () {
        return this._node.isVisible();
    };
    /**
     * Sets a new position for this HUD element and its visual representation, if that exists.
     * @param {Number[2]|Number[3]} value
     */
    HUDElement.prototype.setPosition = function (value) {
        this._position = value;
        if (this._visualModel) {
            this._visualModel.setPosition(value);
        }
    };
    /**
     * Sets a new size for the element to be used for scaling it when rendering.
     * @param {Number[2]} value
     */
    HUDElement.prototype.setSize = function (value) {
        // square model coordinates are -1 to 1, resulting in a scale of 1 corresponding to a size of 2
        this._scale[0] = 0.5 * value[0];
        this._scale[1] = 0.5 * value[1];
        if (this._visualModel) {
            this._visualModel.setSize(this._scale);
        }
    };
    /**
     * Sets a new angle for this HUD element and its visual representation, if that exists.
     * @param {Number} value The new angle, in radians
     */
    HUDElement.prototype.setAngle = function (value) {
        this._angle = value;
        if (this._visualModel) {
            this._visualModel.setAngle(value);
        }
    };
    /**
     * Sets a new color for this HUD elements and its visual representation, if that exists.
     * @param {Number[4]} value RGBA color
     */
    HUDElement.prototype.setColor = function (value) {
        this._color = value;
        if (this._visualModel) {
            this._visualModel.setColor(value);
        }
    };
    /**
     * Sets new minimum and maximum X coordinates for the clip zone of the element.
     * @param {Number} minimum
     * @param {Number} maximum
     */
    HUDElement.prototype.clipX = function (minimum, maximum) {
        if (this._textureCoordinates) {
            minimum = utils.getLinearMix(this._textureCoordinates[0][0], this._textureCoordinates[1][0], minimum);
            maximum = utils.getLinearMix(this._textureCoordinates[0][0], this._textureCoordinates[1][0], maximum);
        }
        this._clipCoordinates[0] = minimum;
        this._clipCoordinates[1] = maximum;
        if (this._visualModel) {
            this._visualModel.clipX(minimum, maximum);
        }
    };
    /**
     * Sets new minimum and maximum Y coordinates for the clip zone of the element.
     * @param {Number} minimum
     * @param {Number} maximum
     */
    HUDElement.prototype.clipY = function (minimum, maximum) {
        if (this._textureCoordinates) {
            minimum = 1 - utils.getLinearMix(this._textureCoordinates[1][1], this._textureCoordinates[0][1], minimum);
            maximum = 1 - utils.getLinearMix(this._textureCoordinates[1][1], this._textureCoordinates[0][1], maximum);
        }
        this._clipCoordinates[2] = 1 - maximum;
        this._clipCoordinates[3] = 1 - minimum;
        if (this._visualModel) {
            this._visualModel.clipY(minimum, maximum);
        }
    };
    /**
     * Sets a new RGBA color for the element to be used for coloring it outsite its clip zone.
     * @param {Number[4]} value
     */
    HUDElement.prototype.setClipColor = function (value) {
        this._clipColor = value;
        if (this._visualModel) {
            this._visualModel.setClipColor(value);
        }
    };
    /**
     * Sets new texture coordinates for the HUD element. If it already has a visual model, also changes its model, so in case the element
     * is already used in a scene, the appropriate model needs to already be loaded! (e.g. with addResourcesToScene() for a HUD element 
     * with the same texture coordinates, before the loading)
     * @param {Number[2][2]} value
     */
    HUDElement.prototype.setTextureCoordinates = function (value) {
        this._textureCoordinates = value;
        if (this._visualModel) {
            this._visualModel.setModel(graphics.getModel(this._getModelName()).getEgomModel());
        }
    };
    /**
     * Set a new scaling mode to be used for the visual representation of this element
     * @param {String} value (enum ScaleMode)
     */
    HUDElement.prototype.setScaleMode = function (value) {
        this._scaleMode = value;
        if (this._visualModel) {
            this._visualModel.setScaleMode(value);
        }
    };
    /**
     * Sets new absolute (viewport) coordinates for the position and size of the element applying the rules
     * of the passed clip space layout to a viewport of the given size.
     * @param {ClipSpaceLayout} layout
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     */
    HUDElement.prototype.applyLayout = function (layout, viewportWidth, viewportHeight) {
        this.setPosition(layout.getPosition(viewportWidth, viewportHeight));
        this.setSize(layout.getSize(viewportWidth, viewportHeight));
    };
    /**
     * Updates the properties of the class of this element for the case when the graphics settings have been changed. (e.g. clearing the
     * cached shader value, since a new shader might have become active)
     */
    HUDElement.prototype.handleGraphicsSettingsChanged = function () {
        this._class.handleGraphicsSettingsChanged();
    };
    // ------------------------------------------------------------------------------
    // private functions
    /**
     * Adds the passed HUD element to the stores persistent HUD element list and also returns it for convenience.
     * @param {HUDElement} hudElement
     * @returns {HUDElement}
     */
    function _addHUDElement(hudElement) {
        _hudElements.push(hudElement);
        return hudElement;
    }
    /**
     * Creates and returns a new HUD element that can be used as a ship indicator.
     * @returns {HUDElement}
     */
    function _createShipIndicator() {
        return _addHUDElement(new HUDElement(
                UI_3D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).texture,
                [0, 0, 0],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).sizes.maximum,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).scaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).colors.hostile,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).mapping));
    }
    /**
     * Creates and returns a new HUD element that can be used as a ship status indicator.
     * @param {String} mapping The string ID of the area of the texture to be used
     * @returns {HUDElement}
     */
    function _createShipStatusIndicator(mapping) {
        return _addHUDElement(new HUDElement(
                UI_2D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).texture,
                [0, 0],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).sizes.reticle,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).scaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).colors.friendly,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).mappings[mapping]));
    }
    /**
     * Creates and returns a new HUD element that can be used as a ship arrow.
     * @returns {HUDElement}
     */
    function _createShipArrow() {
        return _addHUDElement(new HUDElement(
                UI_2D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).texture,
                [0, 0],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).sizes.default,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).scaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).colors.hostile,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).mapping));
    }
    /**
     * Creates and returns a new HUD element that can be used as a missile lock indicator.
     * @returns {HUDElement}
     */
    function _createMissileLockIndicator() {
        return _addHUDElement(new HUDElement(
                UI_2D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR).texture,
                [0, 0],
                [1, 1],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR).scaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).colors.hostile,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR).mapping));
    }
    /**
     * Creates and returns a new HUD element that can be used as a weapon impact indicator.
     * @returns {HUDElement}
     */
    function _createWeaponImpactIndicator() {
        return _addHUDElement(new HUDElement(
                UI_3D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WEAPON_IMPACT_INDICATOR).texture,
                [0, 0, 0],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WEAPON_IMPACT_INDICATOR).size,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WEAPON_IMPACT_INDICATOR).scaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WEAPON_IMPACT_INDICATOR).colors.normal,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WEAPON_IMPACT_INDICATOR).mapping));
    }
    /**
     * Creates and returns a layout suitable for an individual spacecraft within the wingmen status indicator,
     * based on the layout defined for squads and the positions defined for spacecrafts
     * @param {Number} squadIndex
     * @param {Number} squadSize
     * @param {Number} craftIndex
     * @returns {HUDElement}
     */
    function _createWingmanCraftIndicatorLayout(squadIndex, squadSize, craftIndex) {
        var layoutDescriptor, craftPosition, craftSize;
        // start with a generic (1st) squad layout
        layoutDescriptor = utils.deepCopy(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_SQUAD_LAYOUT));
        // shift it to the right based on the index of the squad
        layoutDescriptor.right += layoutDescriptor.width * squadIndex;
        // position and resize according to the settings referring to individual spacecraft indicators
        craftPosition = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_CRAFT_POSITIONS)[squadSize - 1][craftIndex];
        craftSize = _wingmenStatusCraftIndicatorSettings.size;
        layoutDescriptor.right -= layoutDescriptor.width * (0.5 - 0.5 * (craftPosition[0] + craftSize[0]));
        layoutDescriptor.top -= layoutDescriptor.height * (0.5 - 0.5 * (craftPosition[1] + craftSize[1]));
        layoutDescriptor.width *= craftSize[0];
        layoutDescriptor.height *= craftSize[1];
        return new screens.ClipSpaceLayout(layoutDescriptor);
    }
    /**
     * Creates a HUD element suitable as an individual spacecraft indicator within the wingmen status panel
     * @param {ClipSpaceLayout} layout The layout to be used (create it beforehand using _createWingmanCraftIndicatorLayout())
     * @param {String} [craftType=general] The string ID of the craft / indicator type (which determines the icon to be used)
     * Special values are: player, general.
     * @param {Boolean} [forResourcesOnly=false] If true, the created indicator is not added to the list of persistently stored HUD elements
     * @returns {HUDElement}
     */
    function _createWingmanCraftIndicator(layout, craftType, forResourcesOnly) {
        var mappings, result;
        mappings = _wingmenStatusCraftIndicatorSettings.mappings;
        result = new HUDElement(
                UI_2D_MIX_VIEWPORT_SHADER_NAME,
                _wingmenStatusCraftIndicatorSettings.texture,
                layout.getClipSpacePosition(),
                layout.getClipSpaceSize(),
                layout.getScaleMode(),
                _wingmenStatusCraftIndicatorSettings.colors.fullIntegrity,
                undefined,
                (craftType && mappings[craftType]) || mappings.general);
        if (!forResourcesOnly) {
            _addHUDElement(result);
        }
        return result;
    }
    /**
     * 
     * @param {Number} squadIndex
     * @returns {CanvasText}
     */
    function _createWingmenStatusSquadText(squadIndex) {
        var position = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_SQUAD_TEXT).position;
        position = [position[0] + squadIndex * 2 *
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_SQUAD_LAYOUT).width /
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_BACKGROUND).layout.width,
            position[1]];
        return new screens.CanvasText(
                position,
                "",
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_SQUAD_TEXT).fontName,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_SQUAD_TEXT).fontSize,
                _wingmenStatusBackgroundLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_SQUAD_TEXT).color,
                "center");
    }
    /**
     * Creates all HUD elements, marks their resources for loading if they are not loaded yet, and adds their visual models to the scene if
     * they are. If they are not loaded, sets callbacks to add them after the loading has finished.
     */
    function _addHUDToScene() {
        var i, n, layout, mappings, indicator, layoutDescriptor, element;
        // keep the ons with the same shader together for faster rendering
        // ---------------------------------------------------------
        // UI 2D SHADER
        _centerCrosshair = _centerCrosshair || _addHUDElement(new HUDElement(
                UI_2D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CENTER_CROSSHAIR).texture,
                [0, 0],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CENTER_CROSSHAIR).size,
                _centerCrosshairScaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CENTER_CROSSHAIR).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CENTER_CROSSHAIR).mapping));
        _centerCrosshair.addToScene(_battleScene);
        _driftArrow = _driftArrow || _addHUDElement(new HUDElement(
                UI_2D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW).texture,
                [0, 0],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW).size,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW).scaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW).colors.maxSpeed,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW).mapping));
        _driftArrow.addToScene(_battleScene);
        if (!_shipArrows) {
            _shipArrows = [_createShipArrow()];
        }
        for (i = 0; i < _shipArrows.length; i++) {
            _shipArrows[i].addToScene(_battleScene);
        }
        if (!_shipStatusIndicators) {
            _shipStatusIndicators = [];
            mappings = Object.keys(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).mappings);
            for (i = 0; i < mappings.length; i++) {
                _shipStatusIndicators.push(_createShipStatusIndicator(mappings[i]));
            }
        }
        for (i = 0; i < _shipStatusIndicators.length; i++) {
            _shipStatusIndicators[i].addToScene(_battleScene);
        }
        if (!_missileLockIndicators) {
            _missileLockIndicators = [];
            for (i = 0; i < config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR_COUNT); i++) {
                _missileLockIndicators.push(_createMissileLockIndicator());
            }
        }
        for (i = 0; i < config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR_COUNT); i++) {
            _missileLockIndicators[i].addToScene(_battleScene);
        }
        // ---------------------------------------------------------
        // UI 3D SHADER
        if (!_shipIndicators) {
            _shipIndicators = [_createShipIndicator()];
        }
        for (i = 0; i < _shipIndicators.length; i++) {
            _shipIndicators[i].addToScene(_battleScene);
        }
        _aimAssistIndicator = _aimAssistIndicator || _addHUDElement(new HUDElement(
                UI_3D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR).texture,
                [0, 0, 0],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR).size,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR).scaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR).colors.hostile,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR).mapping));
        _aimAssistIndicator.addToScene(_battleScene);
        if (!_weaponImpactIndicators) {
            _weaponImpactIndicators = [_createWeaponImpactIndicator()];
        }
        for (i = 0; i < _weaponImpactIndicators.length; i++) {
            _weaponImpactIndicators[i].addToScene(_battleScene);
        }
        // ---------------------------------------------------------
        // UI 2D MIX VIEWPORT SHADER
        _targetInfoBackground = _targetInfoBackground || _addHUDElement(new HUDElement(
                UI_2D_MIX_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_BACKGROUND).texture,
                _targetInfoBackgroundLayout.getClipSpacePosition(),
                _targetInfoBackgroundLayout.getClipSpaceSize(),
                _targetInfoBackgroundLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_BACKGROUND).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_BACKGROUND).mapping));
        _targetInfoBackground.addToScene(_battleScene);
        _wingmenStatusBackground = _wingmenStatusBackground || _addHUDElement(new HUDElement(
                UI_2D_MIX_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_BACKGROUND).texture,
                _wingmenStatusBackgroundLayout.getClipSpacePosition(),
                _wingmenStatusBackgroundLayout.getClipSpaceSize(),
                _wingmenStatusBackgroundLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_BACKGROUND).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_BACKGROUND).mapping));
        _wingmenStatusBackground.addToScene(_battleScene);
        _flightModeIndicatorBackground = _flightModeIndicatorBackground || _addHUDElement(new HUDElement(
                UI_2D_MIX_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_INDICATOR_BACKGROUND).texture,
                _flightModeIndicatorBackgroundLayout.getClipSpacePosition(),
                _flightModeIndicatorBackgroundLayout.getClipSpaceSize(),
                _flightModeIndicatorBackgroundLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_INDICATOR_BACKGROUND).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_INDICATOR_BACKGROUND).mapping));
        _flightModeIndicatorBackground.addToScene(_battleScene);
        _missileInfoBackground = _missileInfoBackground || _addHUDElement(new HUDElement(
                UI_2D_MIX_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_BACKGROUND).texture,
                _missileInfoBackgroundLayout.getClipSpacePosition(),
                _missileInfoBackgroundLayout.getClipSpaceSize(),
                _missileInfoBackgroundLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_BACKGROUND).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_BACKGROUND).mapping));
        _missileInfoBackground.addToScene(_battleScene);
        _objectivesBackground = _objectivesBackground || _addHUDElement(new HUDElement(
                UI_2D_MIX_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_BACKGROUND).texture,
                _objectivesBackgroundLayout.getClipSpacePosition(),
                _objectivesBackgroundLayout.getClipSpaceSize(),
                _objectivesBackgroundLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_BACKGROUND).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_BACKGROUND).mapping));
        _objectivesBackground.addToScene(_battleScene);
        _escortsBackground = _escortsBackground || _addHUDElement(new HUDElement(
                UI_2D_MIX_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_BACKGROUND).texture,
                _escortsBackgroundLayout.getClipSpacePosition(),
                _escortsBackgroundLayout.getClipSpaceSize(),
                _escortsBackgroundLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_BACKGROUND).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_BACKGROUND).mapping));
        _escortsBackground.addToScene(_battleScene);
        _messageBackground = _messageBackground || _addHUDElement(new HUDElement(
                UI_2D_MIX_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_BACKGROUND).texture,
                _messageBackgroundLayout.getClipSpacePosition(),
                _messageBackgroundLayout.getClipSpaceSize(),
                _messageBackgroundLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_BACKGROUND).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_BACKGROUND).mapping));
        _messageBackground.addToScene(_battleScene);
        // these are created dynamically so initialize the arrays 
        if (!_wingmenStatusCraftIndicators) {
            _wingmenStatusCraftLayouts = [];
            _wingmenStatusCraftIndicators = [];
        }
        // but if they were already created for a previous battle, we need to add them to the current, new scene
        for (i = 0; i < _wingmenStatusCraftIndicators.length; i++) {
            _wingmenStatusCraftIndicators[i].body.addToScene(_battleScene);
            _wingmenStatusCraftIndicators[i].shield.addToScene(_battleScene);
        }
        if (_wingmenStatusPlayerIndicator) {
            _wingmenStatusPlayerIndicator.addToScene(_battleScene);
        }
        // ---------------------------------------------------------
        // UI 2D CLIP VIEWPORT SHADER
        _targetHullIntegrityBar = _targetHullIntegrityBar || _addHUDElement(new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_BAR).texture,
                _targetHullIntegrityBarLayout.getClipSpacePosition(),
                _targetHullIntegrityBarLayout.getClipSpaceSize(),
                _targetHullIntegrityBarLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_BAR).colors.filled,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_BAR).colors.empty,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_BAR).mapping));
        _targetHullIntegrityBar.addToScene(_battleScene);
        _targetShieldBar = _targetShieldBar || _addHUDElement(new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_BAR).texture,
                _targetShieldBarLayout.getClipSpacePosition(),
                _targetShieldBarLayout.getClipSpaceSize(),
                _targetShieldBarLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_BAR).colors.filled,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_BAR).colors.empty,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_BAR).mapping));
        _targetShieldBar.addToScene(_battleScene);
        _speedBar = _speedBar || _addHUDElement(new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR).texture,
                _speedBarLayout.getClipSpacePosition(),
                _speedBarLayout.getClipSpaceSize(),
                _speedBarLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR).colors.combatFilled,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR).colors.combatEmpty,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR).mapping));
        _speedBar.addToScene(_battleScene);
        _speedTargetIndicator = _speedTargetIndicator || _addHUDElement(new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TARGET_INDICATOR).texture,
                _speedBarLayout.getClipSpacePosition(),
                _speedBarLayout.getClipSpaceSize(),
                _speedBarLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TARGET_INDICATOR).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TARGET_INDICATOR).mapping));
        _speedTargetIndicator.addToScene(_battleScene);
        _missileIndicator = _missileIndicator || _addHUDElement(new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).texture,
                _missileIndicatorLayout.getClipSpacePosition(),
                _missileIndicatorLayout.getClipSpaceSize(),
                _missileIndicatorLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).colors.loading,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).colors.loading,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).mappings.single));
        _missileIndicator.addToScene(_battleScene);
        // just to make sure model with salvo texture coordinates is added to context:
        element = new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).texture,
                _missileIndicatorLayout.getClipSpacePosition(),
                _missileIndicatorLayout.getClipSpaceSize(),
                _missileIndicatorLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).colors.loading,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).colors.loading,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).mappings.salvo);
        element.addResourcesToScene(_battleScene);
        _hullIntegrityBar = _hullIntegrityBar || _addHUDElement(new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.HULL_INTEGRITY_BAR).texture,
                _hullIntegrityBarLayout.getClipSpacePosition(),
                _hullIntegrityBarLayout.getClipSpaceSize(),
                _hullIntegrityBarLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.HULL_INTEGRITY_BAR).colors.filled,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.HULL_INTEGRITY_BAR).colors.empty,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.HULL_INTEGRITY_BAR).mapping));
        _hullIntegrityBar.addToScene(_battleScene);
        _shieldBar = _shieldBar || _addHUDElement(new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIELD_BAR).texture,
                _shieldBarLayout.getClipSpacePosition(),
                _shieldBarLayout.getClipSpaceSize(),
                _shieldBarLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIELD_BAR).colors.filled,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIELD_BAR).colors.empty,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIELD_BAR).mapping));
        _shieldBar.addToScene(_battleScene);
        _targetHullIntegrityQuickViewBar = _targetHullIntegrityQuickViewBar || _addHUDElement(new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR).texture,
                _targetHullIntegrityQuickViewBarLayout.getClipSpacePosition(),
                _targetHullIntegrityQuickViewBarLayout.getClipSpaceSize(),
                _targetHullIntegrityQuickViewBarLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR).colors.hostileFilled,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR).mapping));
        _targetHullIntegrityQuickViewBar.addToScene(_battleScene);
        _targetShieldQuickViewBar = _targetShieldQuickViewBar || _addHUDElement(new HUDElement(
                UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_QUICK_VIEW_BAR).texture,
                _targetShieldQuickViewBarLayout.getClipSpacePosition(),
                _targetShieldQuickViewBarLayout.getClipSpaceSize(),
                _targetShieldQuickViewBarLayout.getScaleMode(),
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_QUICK_VIEW_BAR).colors.filled,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_QUICK_VIEW_BAR).mapping));
        _targetShieldQuickViewBar.addToScene(_battleScene);
        n = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MAX_ESCORTS_DISPLAYED);
        if (!_escortBars) {
            _escortBars = [];
            for (i = 0; i < n; i++) {
                _escortBars.push({});
                layoutDescriptor = utils.deepCopy(_escortsIntegrityBarsSettings.layouts.hull);
                layoutDescriptor.top += i * config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_TEXT_OFFSET) * _escortsBackgroundLayout.getClipSpaceHeight() * 0.5;
                _escortBars[i].hullLayout = new screens.ClipSpaceLayout(layoutDescriptor);
                _escortBars[i].hull = _addHUDElement(new HUDElement(
                        UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                        _escortsIntegrityBarsSettings.texture,
                        _escortBars[i].hullLayout.getClipSpacePosition(),
                        _escortBars[i].hullLayout.getClipSpaceSize(),
                        _escortBars[i].hullLayout.getScaleMode(),
                        _escortsIntegrityBarsSettings.colors.fullHull,
                        _escortsIntegrityBarsSettings.colors.destroyed,
                        _escortsIntegrityBarsSettings.mapping));
                layoutDescriptor = utils.deepCopy(_escortsIntegrityBarsSettings.layouts.shield);
                layoutDescriptor.top += i * config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_TEXT_OFFSET) * _escortsBackgroundLayout.getClipSpaceHeight() * 0.5;
                _escortBars[i].shieldLayout = new screens.ClipSpaceLayout(layoutDescriptor);
                _escortBars[i].shield = _addHUDElement(new HUDElement(
                        UI_2D_CLIP_VIEWPORT_SHADER_NAME,
                        _escortsIntegrityBarsSettings.texture,
                        _escortBars[i].shieldLayout.getClipSpacePosition(),
                        _escortBars[i].shieldLayout.getClipSpaceSize(),
                        _escortBars[i].shieldLayout.getScaleMode(),
                        _escortsIntegrityBarsSettings.colors.shield,
                        _escortsIntegrityBarsSettings.colors.lostShield,
                        _escortsIntegrityBarsSettings.mapping));
            }
        }
        for (i = 0; i < n; i++) {
            _escortBars[i].hull.addToScene(_battleScene);
            _escortBars[i].shield.addToScene(_battleScene);
        }
        // ---------------------------------------------------------
        // UI 2D SHADER
        // these need to render on top of the backgrounds
        _hudStillCursor = _hudStillCursor || _addHUDElement(new HUDElement(
                UI_2D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).texture,
                [0, 0],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).size,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).scaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).mappings.still));
        _hudStillCursor.addToScene(_battleScene);
        _hudTurnCursor = _hudTurnCursor || _addHUDElement(new HUDElement(
                UI_2D_SHADER_NAME,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).texture,
                [0, 0],
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).size,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).scaleMode,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).color,
                undefined,
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CURSOR).mappings.turn));
        _hudTurnCursor.addToScene(_battleScene);
        // mark wingman craft indicator resources for loading
        layout = _createWingmanCraftIndicatorLayout(0, 1, 0);
        mappings = Object.keys(_wingmenStatusCraftIndicatorSettings.mappings);
        for (i = 0; i < mappings.length; i++) {
            indicator = _createWingmanCraftIndicator(layout, mappings[i], true);
            indicator.addResourcesToScene(_battleScene);
        }
        // mark HUD sound effects for loading
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SWITCH_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SWITCH_DENIED_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_SWITCH_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_CHANGE_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_CHANGE_DENIED_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_SALVO_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOADED_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCKING_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCKED_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_TYPE_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.NEW_HOSTILES_ALERT_SOUND).name);
        resources.getSoundEffect(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CONNECTION_WARNING_SOUND).name);
    }
    /**
     * Returns the HTML string to insert to messages that contains the key to open the menu in a highlighted style.
     * @returns {String}
     */
    function _getMenuKeyHTMLString() {
        return "<span class='highlightedText'>" + control.getInputInterpreter(control.KEYBOARD_NAME).getControlStringForAction("quit") + "</span>";
    }
    /**
     * @param {Spacecraft} craft
     * @returns {Boolean}
     */
    function _spacecraftShouldBeIndicated(craft) {
        return  craft.isAlive() && !craft.isAway() && (craft !== _spacecraft);
    }
    /**
     * @param {Spacecraft} craft
     * @returns {Boolean}
     */
    function _escortShouldBeIndicated(craft) {
        return  (craft !== _spacecraft);
    }
    /**
     * 
     * @param {Number} distance
     * @returns {String}
     */
    function _getDistanceString(distance) {
        return (distance > 1000) ? (distance / 1000).toPrecision(3) + "k" : Math.round(distance).toString();
    }
    /**
     * Returns an interpolated color to be used to represent hull integrities
     * @param {Number} hullIntegrity The hull integrity to represent (0.0-1.0)
     * @param {Number[4]} fullColor Color to use when the hull integrity is 1.0
     * @param {Number[4]} halfColor Color to use when the hull integrity is 0.5
     * @param {Number[4]} zeroColor Color to use when the hull integrity is 0.0
     * @returns {Number[4]}
     */
    function _getHullIntegrityColor(hullIntegrity, fullColor, halfColor, zeroColor) {
        return (hullIntegrity > 0.5) ?
                utils.getMixedColor(
                        halfColor,
                        fullColor,
                        (hullIntegrity - 0.5) * 2) :
                utils.getMixedColor(
                        zeroColor,
                        halfColor,
                        hullIntegrity * 2);
    }
    /**
     * The callback to execute when adding the target view model to its scene
     * @param {Model} model
     */
    function _targetViewAddCallback(model) {
        model.setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, function () {
            return _targetViewItemColor;
        });
        model.setScale(1 / model.getSize());
        _targetViewModel = model;
    }
    /**
     * Whether the passed HUD section should be currently visible according to its state
     * @param {Number} hudSection (enum HUDSection)
     * @returns {Boolean}
     */
    function _hudSectionIsVisible(hudSection) {
        return (_hudSectionStates[hudSection] === HUDSectionState.VISIBLE) ||
                ((_hudSectionStates[hudSection] === HUDSectionState.HIGHLIGHTED) && _hudHighlightVisible);
    }
    // ##############################################################################
    /**
     * @class Represents the battle screen.
     * @extends HTMLScreenWithCanvases
     */
    function BattleScreen() {
        screens.HTMLScreenWithCanvases.call(this,
                armadaScreens.BATTLE_SCREEN_NAME,
                armadaScreens.BATTLE_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.BATTLE_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                graphics.getAntialiasing(),
                true,
                graphics.getFiltering(),
                config.getSetting(config.GENERAL_SETTINGS.USE_REQUEST_ANIM_FRAME),
                {
                    activate: function () {
                        _aimAssistCrosshairs = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_CROSSHAIRS);
                    }
                });
        /**
         * @type SimpleComponent
         */
        this._stats = this.registerSimpleComponent(STATS_PARAGRAPH_ID);
        /**
         * @type LoadingBox
         */
        this._loadingBox = this.registerExternalComponent(new components.LoadingBox(
                LOADING_BOX_ID,
                armadaScreens.LOADING_BOX_SOURCE,
                {cssFilename: armadaScreens.LOADING_BOX_CSS},
                strings.LOADING.HEADER.name));
        /**
         * @type InfoBox
         */
        this._infoBox = this.registerExternalComponent(new components.InfoBox(
                INFO_BOX_ID,
                armadaScreens.INFO_BOX_SOURCE,
                {cssFilename: armadaScreens.INFO_BOX_CSS},
                strings.INFO_BOX.HEADER.name,
                strings.INFO_BOX.OK_BUTTON.name,
                {
                    show: function () {
                        if (!_battleScreen.isVisible()) {
                            return;
                        }
                        while (game.getScreen() !== _battleScreen) {
                            game.closeSuperimposedScreen();
                        }
                        this.pauseBattle();
                    }.bind(this),
                    hide: function () {
                        if (game.getScreen() !== _battleScreen) {
                            return;
                        }
                        this.resumeBattle();
                        resumeTime();
                        if (!_demoMode) {
                            control.switchToPilotMode(_mission.getPilotedSpacecraft(), true);
                        } else {
                            control.switchToSpectatorMode(false, true);
                            _battleScene.getCamera().followNextNode();
                            _timeInSameView = 0;
                        }
                    }.bind(this),
                    buttonselect: armadaScreens.playButtonSelectSound,
                    buttonclick: armadaScreens.playButtonClickSound
                }));
    }
    BattleScreen.prototype = new screens.HTMLScreenWithCanvases();
    BattleScreen.prototype.constructor = BattleScreen;
    /**
     * @override
     * @returns {Boolean}
     */
    BattleScreen.prototype.show = function () {
        if (screens.HTMLScreenWithCanvases.prototype.show.call(this)) {
            document.getElementById(armadaScreens.GAME_VERSION_LABEL_ID).hidden = true;
            return true;
        }
        return false;
    };
    /**
     * @override
     * @returns {Boolean}
     */
    BattleScreen.prototype.hide = function () {
        var shadows;
        if (screens.HTMLScreenWithCanvases.prototype.hide.call(this)) {
            if (_multi) {
                _multi = false;
            }
            this.pauseBattle(true);
            _clearData();
            shadows = graphics.isShadowMappingEnabled();
            graphics.setShadowMapping();
            if (shadows !== graphics.isShadowMappingEnabled()) {
                graphics.handleSettingsChanged();
            }
            document.getElementById(armadaScreens.GAME_VERSION_LABEL_ID).hidden = false;
            return true;
        }
        return false;
    };
    /**
     * @override
     * @param {Boolean} active
     */
    BattleScreen.prototype.setActive = function (active) {
        screens.HTMLScreen.prototype.setActive.call(this, active);
        if (!active) {
            control.exitPointerLock();
        }
    };
    /**
     * @override
     */
    BattleScreen.prototype._initializeComponents = function () {
        var canvas;
        screens.HTMLScreenWithCanvases.prototype._initializeComponents.call(this);
        canvas = this.getScreenCanvas(BATTLE_CANVAS_ID).getCanvasElement();
        if (_handleResize) {
            window.removeEventListener("resize", _handleResize);
        }
        _handleResize = _handleResize || function () {
            control.setScreenCenter(canvas.width / 2, canvas.height / 2);
        };
        window.addEventListener("resize", _handleResize);
        _handleResize();
    };
    /**
     * @override
     */
    BattleScreen.prototype._updateComponents = function () {
        screens.HTMLScreenWithCanvases.prototype._updateComponents.call(this);
    };
    /**
     * Pauses the battle by canceling all control, simulation and the render loop (e.g. for when a menu is 
     * displayed)
     * @param {Boolean} [quit=false] Whether we are stopping the battle when quitting it altogether
     * @param {Boolean} [dimMusic=true] 
     * @param {Boolean} [dimSFX=true] 
     */
    BattleScreen.prototype.pauseBattle = function (quit, dimMusic, dimSFX) {
        control.stopListening();
        _battleCursor = document.body.style.cursor;
        document.body.style.cursor = game.getDefaultCursor();
        if (!_multi || quit) {
            if (_simulationLoop !== LOOP_REQUESTANIMFRAME) {
                clearInterval(_simulationLoop);
            }
            _simulationLoop = LOOP_CANCELED;
            if (_battleScene) {
                _battleScene.setShouldAnimate(false);
            }
            this.stopRenderLoop();
        }
        if (dimMusic !== false) {
            audio.resetMusicVolume();
            audio.setMusicVolume(config.getSetting(config.BATTLE_SETTINGS.MUSIC_VOLUME_IN_MENUS) * audio.getMusicVolume(), false);
        }
        if (dimSFX !== false) {
            audio.resetSFXVolume();
            audio.setSFXVolume(config.getSetting(config.BATTLE_SETTINGS.SFX_VOLUME_IN_MENUS) * audio.getSFXVolume(), false);
        }
        if (_messageTypeSound) {
            _messageTypeSound.stopPlaying(HUD_MESSAGE_APPEAR_SOUND_STOP_RAMP_DURATION);
        }
        if (application.isDebugVersion() && _battleScene) {
            _battleScene.logNodes();
        }
    };
    /**
     * Resumes the simulation and control of the battle and the render loop
     * @param {Boolean} [start=false] Whether this is the start of the battle 
     * (as opposed to resuming after a pause)
     * @param {Boolean} [escapePressed=false] Whether the escape key is being
     * pressed to resume (coming from the in-game menu)
     */
    BattleScreen.prototype.resumeBattle = function (start, escapePressed) {
        document.body.style.cursor = _battleCursor || game.getDefaultCursor();
        if (_multi && !start) {
            control.startListening();
        } else {
            if (_simulationLoop === LOOP_CANCELED) {
                _prevDate = performance.now();
                if (_battleScene) {
                    if (!_isTimeStopped) {
                        _battleScene.setShouldAnimate(true);
                    }
                }
                if (config.getSetting(config.GENERAL_SETTINGS.USE_REQUEST_ANIM_FRAME)) {
                    _simulationLoop = LOOP_REQUESTANIMFRAME;
                } else {
                    _simulationLoop = setInterval(_simulationLoopFunction, 1000 / (config.getSetting(config.BATTLE_SETTINGS.SIMULATION_STEPS_PER_SECOND)));
                }
                control.startListening();
                if (escapePressed) {
                    control.getInputInterpreter(control.KEYBOARD_NAME).setEscapeToPressed();
                }
                this.startRenderLoop(1000 / config.getSetting(config.BATTLE_SETTINGS.RENDER_FPS));
            } else {
                application.showError(
                        "Trying to resume simulation while it is already going on!",
                        application.ErrorSeverity.MINOR,
                        "No action was taken, to avoid double-running the simulation.");
            }
        }
        audio.resetMusicVolume();
        audio.resetSFXVolume();
        if (control.getInputInterpreter(control.MOUSE_NAME).isEnabled()) {
            this.requestPointerLock(true);
        }
    };
    /**
     * Uses the loading box to show the status to the user.
     * @param {String} newStatus The status to show on the loading box. If
     * undefined, the status won't be updated.
     * @param {Number} newProgress The new value of the progress bar on the loading
     * box. If undefined, the value won't be updated.
     */
    BattleScreen.prototype._updateLoadingStatus = function (newStatus, newProgress) {
        if (newStatus !== undefined) {
            this._loadingBox.updateStatus(_tipText + armadaScreens.getSubParagraph(newStatus));
        }
        if (newProgress !== undefined) {
            this._loadingBox.updateProgress(newProgress);
        }
    };
    /**
     * Updates the loading box message and progress value to reflect the state given in the parameters.
     * @param {String} resourceName The name of the resource that have just finished loading
     * @param {String} resourceType The name of the resource that have just finished loading
     * @param {Number} totalResources The number of total resources to be loaded
     * @param {Number} loadedResources The number of resources that have already been loaded
     */
    BattleScreen.prototype._updateLoadingBoxForResourceLoad = function (resourceName, resourceType, totalResources, loadedResources) {
        this._updateLoadingStatus(
                utils.formatString(strings.get(strings.LOADING.RESOURCE_READY), {
                    resource: resourceName,
                    resourceType: resourceType,
                    loaded: loadedResources,
                    total: totalResources
                }),
                LOADING_RESOURCES_START_PROGRESS + (loadedResources / totalResources) * LOADING_RESOURCE_PROGRESS);
    };
    /**
     * Adds the text layers and texts of the HUD to the screen if needed.
     */
    BattleScreen.prototype._addUITexts = function () {
        var i, n, layoutDescriptor,
                screenCanvas = this.getScreenCanvas(BATTLE_CANVAS_ID),
                // general HUD text
                initText = function (descriptor, layout, layer, alignment) {
                    var setting, result;
                    setting = config.getHUDSetting(descriptor);
                    result = new screens.CanvasText(
                            setting.position,
                            "",
                            setting.fontName,
                            setting.fontSize,
                            layout.getScaleMode(),
                            setting.color || setting.colors[Object.keys(setting.colors)[0]],
                            alignment);
                    layer.addText(result);
                    return result;
                },
                getTargetInfoText = function (sectionName) {
                    return new screens.CanvasText(
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_TEXT).positions[sectionName],
                            "",
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_TEXT).fontName,
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_TEXT).fontSizes[(sectionName === "name") ? "name" : "others"],
                            _targetInfoBackgroundLayout.getScaleMode(),
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_TEXT).colors.friendly);
                },
                getSpeedText = function (textPosition) {
                    return new screens.CanvasText(
                            textPosition,
                            "",
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).fontName,
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).fontSize,
                            _speedBarLayout.getScaleMode(),
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).colors.combatForward);
                },
                getMissileInfoNameText = function (index) {
                    var position = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT).positions.name;
                    position = [position[0], position[1] + index * config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT_OFFSET)];
                    return new screens.CanvasText(
                            position,
                            "",
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT).fontName,
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT).fontSize,
                            _missileInfoBackgroundLayout.getScaleMode(),
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT).colors.notSelected);
                },
                getMissileInfoCountText = function (index) {
                    var position = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT).positions.count;
                    position = [position[0], position[1] + index * config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT_OFFSET)];
                    return new screens.CanvasText(
                            position,
                            "",
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT).fontName,
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT).fontSize,
                            _missileInfoBackgroundLayout.getScaleMode(),
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT).colors.notSelected,
                            "right");
                },
                getObjectiveText = function (index) {
                    var position = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_TEXT).position;
                    position = [position[0], position[1] + index * config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_TEXT_OFFSET)];
                    return new screens.CanvasText(
                            position,
                            "",
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_TEXT).fontName,
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_TEXT).fontSize,
                            _objectivesBackgroundLayout.getScaleMode(),
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_TEXT).colors.inProgress);
                },
                getEscortText = function (index) {
                    var position = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_TEXT).position;
                    position = [position[0], position[1] + index * config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_TEXT_OFFSET)];
                    return new screens.CanvasText(
                            position,
                            "",
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_TEXT).fontName,
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_TEXT).fontSize,
                            _escortsBackgroundLayout.getScaleMode(),
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_TEXT).colors.alive);
                };
        // ..............................................................................
        // target distance
        if (!_distanceTextLayer) {
            _distanceTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DISTANCE_TEXT_LAYER_LAYOUT));
            screenCanvas.addTextLayer(_distanceTextLayer);
        }
        if (!_distanceText) {
            _distanceText = new screens.CanvasText(
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DISTANCE_TEXT).position,
                    "",
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DISTANCE_TEXT).fontName,
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DISTANCE_TEXT).fontSize,
                    new screens.ClipSpaceLayout(_distanceTextBoxLayoutDescriptor).getScaleMode(),
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DISTANCE_TEXT).colors.hostile,
                    "left",
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DISTANCE_TEXT).layout);
            _distanceTextLayer.addText(_distanceText);
        }
        // ..............................................................................
        // target info
        if (!_targetInfoTextLayer) {
            _targetInfoTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_TEXT_LAYER_LAYOUT));
            screenCanvas.addTextLayer(_targetInfoTextLayer);
        }
        if (!_targetInfoTexts) {
            _targetInfoTexts = {};
            for (i = 0; i < TARGET_INFO_SECTIONS.length; i++) {
                _targetInfoTexts[TARGET_INFO_SECTIONS[i]] = getTargetInfoText(TARGET_INFO_SECTIONS[i]);
                _targetInfoTextLayer.addText(_targetInfoTexts[TARGET_INFO_SECTIONS[i]]);
            }
        }
        // ..............................................................................
        // wingmen status
        if (!_wingmenStatusTextLayer) {
            _wingmenStatusTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_BACKGROUND).layout);
            screenCanvas.addTextLayer(_wingmenStatusTextLayer);
        }
        _wingmenStatusHeaderText = _wingmenStatusHeaderText || initText(
                config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_HEADER_TEXT,
                _wingmenStatusBackgroundLayout,
                _wingmenStatusTextLayer);
        _wingmenStatusHeaderText.setText(strings.get(strings.BATTLE.HUD_WINGMEN_HEADER));
        if (!_wingmenStatusSquadTexts) {
            _wingmenStatusSquadTexts = [];
        }
        // ..............................................................................
        // speed bar
        if (!_speedTextLayer) {
            _speedTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT_LAYER_LAYOUT));
            screenCanvas.addTextLayer(_speedTextLayer);
        }
        if (!_maxSpeedText) {
            _maxSpeedText = getSpeedText(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).positions.maxForward);
            _speedTextLayer.addText(_maxSpeedText);
        }
        if (!_currentSpeedText) {
            _currentSpeedText = getSpeedText(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).positions.maxReverse);
            _speedTextLayer.addText(_currentSpeedText);
        }
        // ..............................................................................
        // missile indicator text
        if (!_missileIndicatorTextLayer) {
            _missileIndicatorTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR_TEXT_LAYOUT));
            screenCanvas.addTextLayer(_missileIndicatorTextLayer);
        }
        if (!_missileIndicatorText) {
            _missileIndicatorText = new screens.CanvasText(
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR_TEXT).position,
                    "",
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR_TEXT).fontName,
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR_TEXT).fontSize,
                    _missileIndicatorLayout.getScaleMode(),
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR_TEXT).colors.ready,
                    "right");
            _missileIndicatorTextLayer.addText(_missileIndicatorText);
        }
        // ..............................................................................
        // flight mode
        if (!_flightModeIndicatorTextLayer) {
            _flightModeIndicatorTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_INDICATOR_BACKGROUND).layout);
            screenCanvas.addTextLayer(_flightModeIndicatorTextLayer);
        }
        _flightModeHeaderText = _flightModeHeaderText || initText(
                config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_HEADER_TEXT,
                _flightModeIndicatorBackgroundLayout,
                _flightModeIndicatorTextLayer);
        _flightModeHeaderText.setText(strings.get(strings.BATTLE.HUD_FLIGHT_MODE));
        if (!_flightModeText) {
            _flightModeText = new screens.CanvasText(
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_TEXT).position,
                    "",
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_TEXT).fontName,
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_TEXT).fontSize,
                    _flightModeIndicatorBackgroundLayout.getScaleMode(),
                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_TEXT).colors.combat);
            _flightModeIndicatorTextLayer.addText(_flightModeText);
        }
        // ..............................................................................
        // missile info
        if (!_missileInfoTextLayer) {
            _missileInfoTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_BACKGROUND).layout);
            screenCanvas.addTextLayer(_missileInfoTextLayer);
        }
        _missileInfoHeaderText = _missileInfoHeaderText || initText(
                config.BATTLE_SETTINGS.HUD.MISSILE_INFO_HEADER_TEXT,
                _missileInfoBackgroundLayout,
                _missileInfoTextLayer);
        _missileInfoHeaderText.setText(strings.get(strings.BATTLE.HUD_MISSILES));
        if (!_missileInfoNameTexts) {
            _missileInfoNameTexts = [];
            _missileInfoCountTexts = [];
            n = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MAX_MISSILE_INFO_DISPLAYED);
            for (i = 0; i < n; i++) {
                _missileInfoNameTexts.push(getMissileInfoNameText(i));
                _missileInfoTextLayer.addText(_missileInfoNameTexts[i]);
                _missileInfoCountTexts.push(getMissileInfoCountText(i));
                _missileInfoTextLayer.addText(_missileInfoCountTexts[i]);
            }
        }
        // ..............................................................................
        // headers
        if (!_headerTextLayer) {
            _headerTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.HEADER_TEXT_LAYER_LAYOUT));
            screenCanvas.addTextLayer(_headerTextLayer);
        }
        _smallHeaderText = _smallHeaderText || initText(
                config.BATTLE_SETTINGS.HUD.SMALL_HEADER_TEXT,
                _headerTextLayer.getLayout(),
                _headerTextLayer,
                "center");
        _bigHeaderText = _bigHeaderText || initText(
                config.BATTLE_SETTINGS.HUD.BIG_HEADER_TEXT,
                _headerTextLayer.getLayout(),
                _headerTextLayer,
                "center");
        _subheaderText = _subheaderText || initText(
                config.BATTLE_SETTINGS.HUD.SUBHEADER_TEXT,
                _headerTextLayer.getLayout(),
                _headerTextLayer,
                "center");
        // ..............................................................................
        // message
        if (!_messageTextLayer) {
            layoutDescriptor = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_BACKGROUND).layout;
            layoutDescriptor.width -= config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_TEXT_MARGIN);
            _messageTextLayer = new screens.TextLayer(layoutDescriptor);
            screenCanvas.addTextLayer(_messageTextLayer);
        }
        _messageText = _messageText || initText(
                config.BATTLE_SETTINGS.HUD.MESSAGE_TEXT,
                _messageTextLayer.getLayout(),
                _messageTextLayer,
                "center");
        // ..............................................................................
        // top left
        if (!_topLeftTextLayer) {
            _topLeftTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TOP_LEFT_TEXT_LAYER_LAYOUT));
            screenCanvas.addTextLayer(_topLeftTextLayer);
        }
        _scoreText = _scoreText || initText(
                config.BATTLE_SETTINGS.HUD.SCORE_TEXT,
                _topLeftTextLayer.getLayout(),
                _topLeftTextLayer,
                "left");
        // ..............................................................................
        // objectives
        if (!_objectivesTextLayer) {
            _objectivesTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_BACKGROUND).layout);
            screenCanvas.addTextLayer(_objectivesTextLayer);
        }
        _objectivesHeaderText = _objectivesHeaderText || initText(
                config.BATTLE_SETTINGS.HUD.OBJECTIVES_HEADER_TEXT,
                _objectivesBackgroundLayout,
                _objectivesTextLayer);
        _objectivesHeaderText.setText(strings.get(strings.BATTLE.HUD_OBJECTIVES));
        if (!_objectivesTexts) {
            _objectivesTexts = [];
            n = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MAX_OBJECTIVES_DISPLAYED);
            for (i = 0; i < n; i++) {
                _objectivesTexts.push(getObjectiveText(i));
                _objectivesTextLayer.addText(_objectivesTexts[i]);
            }
        }
        // ..............................................................................
        // escorted ships
        if (!_escortsTextLayer) {
            _escortsTextLayer = new screens.TextLayer(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_BACKGROUND).layout);
            screenCanvas.addTextLayer(_escortsTextLayer);
        }
        _escortsHeaderText = _escortsHeaderText || initText(
                config.BATTLE_SETTINGS.HUD.ESCORTS_HEADER_TEXT,
                _escortsBackgroundLayout,
                _escortsTextLayer);
        _escortsHeaderText.setText(strings.get(strings.BATTLE.HUD_ESCORTED_SHIPS_HEADER));
        if (!_escortsTexts) {
            _escortsTexts = [];
            n = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MAX_ESCORTS_DISPLAYED);
            for (i = 0; i < n; i++) {
                _escortsTexts.push(getEscortText(i));
                _escortsTextLayer.addText(_escortsTexts[i]);
            }
        }
    };
    /**
     * Shows the stats (FPS, draw stats) component.
     */
    BattleScreen.prototype.showDevelopmentInfo = function () {
        this._stats.show();
        _smallHeaderText.show();
    };
    /**
     * Hides the stats (FPS, draw stats) component.
     */
    BattleScreen.prototype.hideDevelopmentInfo = function () {
        this._stats.hide();
        _smallHeaderText.hide();
    };
    /**
     * Toggles the visibility of the development related information (e.g. version info header and FPS count) on the screen.
     */
    BattleScreen.prototype.toggleDevInfoVisibility = function () {
        if (this._stats.isVisible()) {
            this.hideDevelopmentInfo();
        } else {
            this.showDevelopmentInfo();
        }
    };
    /**
     * Shows the given message to the user in an information box.
     * @param {String} message
     * @param {Function} [onButtonClick]
     * @param {Boolean} [allowHTML=false]
     */
    BattleScreen.prototype.showMessage = function (message, onButtonClick, allowHTML) {
        this._infoBox.updateMessage(message, undefined, allowHTML);
        this._infoBox.onButtonClick(function () {
            armadaScreens.playButtonClickSound();
            if (onButtonClick) {
                onButtonClick();
            }
        });
        this._infoBox.show();
        control.exitPointerLock();
    };
    /**
     * Updates the big header's content on the screen.
     * @param {String} content
     * @param {Object} [replacements]
     */
    BattleScreen.prototype.setHeaderContent = function (content, replacements) {
        if (_bigHeaderText) {
            _bigHeaderText.setText(content, replacements);
        }
    };
    /**
     * Updates the subheader's content on the screen.
     * @param {String} content
     * @param {Object} [replacements]
     */
    BattleScreen.prototype.setSubheaderContent = function (content, replacements) {
        if (_subheaderText) {
            _subheaderText.setText(content, replacements);
        }
    };
    /**
     * Adds a new HUD message to the queue.
     * @param {Battle~HUDMessage} message The properties of the message to add
     * @param {Boolean} urgent If true, the message will be appended to the front of the queue, otherwise to the
     * back of the queue.
     */
    BattleScreen.prototype.queueHUDMessage = function (message, urgent) {
        var text, start, end, i, length, replacementID, replacementText, modifier, /**@type Spacecraft*/ craft;
        text = message.text;
        // replacing references in the text
        for (start = text.indexOf("{"); start >= 0; start = text.indexOf("{")) {
            end = text.indexOf("}");
            if (end >= 0) {
                replacementID = text.substring(start + 1, end).split("/");
                switch (replacementID[0]) {
                    case "controlStrings":
                        // control strings have a specific color assigned to them, so add the modifier to the string
                        replacementText =
                                "[color:" + _messageTextSettings.colors.controlString.join(",") + "]" +
                                control.getInputInterpreter(replacementID[1]).getControlStringForAction(replacementID[2]) +
                                "[]";
                        break;
                    case "spacecrafts":
                        craft = _mission.getSpacecraft(replacementID[1]);
                        replacementText =
                                "[color:" + (_spacecraft.isHostile(craft) ? _messageTextSettings.colors.hostileSpacecraft : _messageTextSettings.colors.friendlySpacecraft).join(",") + "]" +
                                craft.getDisplayName() +
                                "[]";
                        break;
                    default:
                        application.showError("Unknown reference type specified in HUD message: '" + replacementID[0] + "'!");
                        replacementText = "";
                }
                text = text.substring(0, start) + replacementText + text.substr(end + 1);
            } else {
                application.showError("Unclosed reference in HUD message: '" + message.text + "'!");
            }
        }
        // calculate the real, visible length of the text, excluding modifiers and line breaks
        // because appear animation and text visibility duration needs to take that as a base
        length = 0;
        modifier = false;
        for (i = 0; i < text.length; i++) {
            if (text[i] === "[") {
                modifier = true;
            } else if (text[i] === "]") {
                modifier = false;
            } else if ((modifier === false) && (text[i] !== "\n")) {
                length++;
            }
        }
        message.text = text;
        message.new = true;
        // calculating duration based on message length if needed
        message.timeLeft = message.duration || Math.round(length * HUD_MESSAGE_DURATION_PER_CHAR + HUD_MESSAGE_BASE_DURATION);
        // setting up appear animation
        message.appearDuration = message.appearAnimation ? Math.round(length * HUD_MESSAGE_APPEAR_DURATION_PER_CHAR) : 0;
        message.appearTimeLeft = message.appearDuration || 0;
        message.queue = message.queue || INFO_QUEUE;
        if (urgent) {
            _messageQueues[message.queue].unshift(message);
        } else {
            _messageQueues[message.queue].push(message);
        }
    };
    /**
     * Clears all HUD messages from the given queue.
     * @param {String} [queue=INFO_QUEUE] 
     */
    BattleScreen.prototype.clearHUDMessages = function (queue) {
        _messageQueues[queue || INFO_QUEUE] = [];
    };
    /**
     * Clears all HUD messages from the all queues.
     */
    BattleScreen.prototype.clearHUDMessageQueues = function () {
        var i;
        for (i = 0; i < MESSAGE_QUEUES.length; i++) {
            _messageQueues[MESSAGE_QUEUES[i]] = [];
        }
    };
    /**
     * Updates the contents of the HUDF with information about the currently followed spacecraft
     * @param {Number} dt The time elapsed since the last HUD update (in milliseconds)
     */
    BattleScreen.prototype._updateHUD = function (dt) {
        var
                /** @type Spacecraft */
                craft = _mission ? _mission.getFollowedSpacecraftForScene(_battleScene) : null,
                target, wingman,
                /** @type MissileLauncher */
                missileLauncher,
                /** @type Number */
                distance, aspect, i, j, count, scale, futureDistance, animationProgress, animation2Progress, aimAssistAppearAnimationProgress, targetSwitchAnimationProgress, shipWidth,
                hullIntegrity, shieldIntegrity,
                acceleration, speed, absSpeed, maxSpeed, stepFactor, stepBuffer, speedRatio, speedTarget, driftSpeed, driftArrowMaxSpeed, arrowPositionRadius,
                armor, craftCount, height, statusCount, angle, lockRatio,
                /** @type Weapon[] */
                weapons,
                /** @type Number[2] */
                position2D, direction2D, maxSpeedTextPosition, maxReverseSpeedTextPosition, shipIndicatorSize, shipIndicatorMinSize, size2D,
                /** @type Number[3] */
                position, targetPosition, vectorToTarget, futureTargetPosition, slotPosition, basePointPosition, relativeVelocity, indicatorPosition,
                /** @type Number[4] */
                direction, color, targetInfoTextColor, filledColor, emptyColor, hostileColor, friendlyColor, hostileArrowColor, friendlyArrowColor,
                newHostileColor, newHostileArrowColor,
                /** @type Object.<String, Number[4]> */
                colors,
                /** @type Float32Array */
                m, scaledOriMatrix,
                /** @type HTMLCanvasElement */
                canvas = this.getScreenCanvas(BATTLE_CANVAS_ID).getCanvasElement(),
                /** @type Boolean */
                isInAimingView, behind, targetInRange, targetIsHostile, targetSwitched, scalesWithWidth, playerFound, newHostilesPresent, skip, away, transmissionSource, missileLockIndicatorsUpdated, missileLoaded,
                visible1, visible2, visible3, visible4,
                /** @type MouseInputIntepreter */
                mouseInputInterpreter,
                /** @type String */
                text,
                /** @type String[] */
                objectivesState, statusIndicators,
                /** @type HUDElement */
                indicator,
                /** @type Spacecraft[] */
                ships, highlightedShips,
                /** @type Battle~HUDMessage[] */
                messageQueue;
        missileLockIndicatorsUpdated = false;
        if (craft && _isHUDVisible) {
            _hudHighlightTime = (_hudHighlightTime + dt) % _hudHighlightInterval;
            _hudHighlightVisible = _hudHighlightTime < 0.5 * _hudHighlightInterval;
            isInAimingView = craft.getView(_battleScene.getCamera().getConfiguration().getName()).isAimingView();
            // .....................................................................................................
            // header and score
            _bigHeaderText.show();
            if (control.isInPilotMode()) {
                _subheaderText.hide();
                if (_hudSectionIsVisible(HUDSection.SCORE)) {
                    _scoreText.setText(utils.formatString(strings.get(strings.BATTLE.SCORE), {
                        score: Math.round(craft.getScore())
                    }));
                    _scoreText.show();
                } else {
                    _scoreText.hide();
                }
            } else {
                _subheaderText.setText(craft.getDisplayName() || craft.getClass().getDisplayName());
                _subheaderText.show();
                _scoreText.hide();
            }
            // .....................................................................................................
            // center crosshair
            if (isInAimingView) {
                _centerCrosshair.show();
            } else {
                _centerCrosshair.hide();
            }
            // .....................................................................................................
            // cursor
            mouseInputInterpreter = control.getInputInterpreter(control.MOUSE_NAME);
            if (control.isListening() &&
                    mouseInputInterpreter.isEnabled() &&
                    control.isInPilotMode() &&
                    !control.isControllerPriority(control.CAMERA_CONTROLLER_NAME) &&
                    !control.isMouseTurningDisabled() &&
                    !craft.isManeuveringLocked()) {
                position2D = mouseInputInterpreter.getMousePosition();
                position2D = [
                    (position2D[0] / canvas.width - 0.5) * 2,
                    (0.5 - position2D[1] / canvas.height) * 2
                ];
                if (mouseInputInterpreter.isMouseDisplaced()) {
                    _hudStillCursor.hide();
                    _hudTurnCursor.show();
                    _hudTurnCursor.setPosition(position2D);
                    angle = vec.angle2y(position2D[0] * canvas.width / canvas.height, position2D[1]);
                    _hudTurnCursor.setAngle(angle * ((position2D[0] < 0) ? -1 : 1));
                } else {
                    _hudStillCursor.show();
                    _hudTurnCursor.hide();
                    _hudStillCursor.setPosition(position2D);
                }
            } else {
                _hudStillCursor.hide();
                _hudTurnCursor.hide();
            }
            // .....................................................................................................
            // speed bar
            relativeVelocity = craft.getRelativeVelocityMatrix();
            if (_hudSectionIsVisible(HUDSection.SPEED_BAR)) {
                speed = relativeVelocity[13];
                absSpeed = Math.abs(speed);
                acceleration = craft.getMaxAcceleration();
                maxSpeed = craft.getMaxSpeed();
                if (!maxSpeed) {
                    maxSpeed = (config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR_BASE_MAX_SPEED_FACTOR) * acceleration) ||
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR_DEFAULT_BASE_MAX_SPEED);
                    stepFactor = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR_MAX_SPEED_STEP_FACTOR);
                    stepBuffer = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR_MAX_SPEED_STEP_BUFFER);
                    while ((maxSpeed + stepBuffer) < absSpeed) {
                        maxSpeed *= stepFactor;
                    }
                }
                if (craft.hasSpeedTarget()) {
                    speedTarget = craft.getSpeedTarget();
                    if (speed * speedTarget >= 0) {
                        speedTarget = Math.abs(speedTarget);
                    } else {
                        speedTarget = 0;
                    }
                }
                speedRatio = Math.min(absSpeed / maxSpeed, 1.0);
                maxSpeedTextPosition = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).positions.maxForward;
                maxReverseSpeedTextPosition = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).positions.maxReverse;
                colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR).colors;
                text = craft.getFlightMode();
                if (speed >= 0) {
                    _speedBar.setColor(colors[text + "Filled"]);
                    _speedBar.setClipColor(colors[text + "Empty"]);
                    _speedBar.clipY(0, speedRatio);
                    _maxSpeedText.setPosition(maxSpeedTextPosition);
                    _maxSpeedText.setColor(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).colors[text + "Forward"]);
                    _maxSpeedText.setText(Math.max(maxSpeed, speed).toFixed());
                    _currentSpeedText.setPosition([maxSpeedTextPosition[0], maxReverseSpeedTextPosition[1] + (maxSpeedTextPosition[1] - maxReverseSpeedTextPosition[1]) * speedRatio]);
                    _currentSpeedText.setColor(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).colors[text + "Forward"]);
                    _currentSpeedText.setText(absSpeed.toFixed());
                    _speedTargetIndicator.clipX(0.5 - _speedTargetIndicatorSize[0] / 2, 0.5 + _speedTargetIndicatorSize[0] / 2);
                    if (craft.hasSpeedTarget()) {
                        _speedTargetIndicator.clipY(speedTarget / maxSpeed - _speedTargetIndicatorSize[1] / 2, speedTarget / maxSpeed + _speedTargetIndicatorSize[1] / 2);
                        _speedTargetIndicator.show();
                    } else {
                        _speedTargetIndicator.hide();
                    }
                } else {
                    _speedBar.setColor(colors[text + "ReverseFilled"]);
                    _speedBar.setClipColor(colors[text + "ReverseEmpty"]);
                    _speedBar.clipY(1 - speedRatio, 1);
                    _maxSpeedText.setPosition(maxReverseSpeedTextPosition);
                    _maxSpeedText.setColor(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).colors[text + "Reverse"]);
                    _maxSpeedText.setText(Math.min(-maxSpeed, speed).toFixed());
                    _currentSpeedText.setPosition([maxSpeedTextPosition[0], maxSpeedTextPosition[1] - (maxSpeedTextPosition[1] - maxReverseSpeedTextPosition[1]) * speedRatio]);
                    _currentSpeedText.setColor(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TEXT).colors[text + "Reverse"]);
                    _currentSpeedText.setText("-" + absSpeed.toFixed());
                    _speedTargetIndicator.clipX(0.5 - _speedTargetIndicatorSize[0] / 2, 0.5 + _speedTargetIndicatorSize[0] / 2);
                    if (craft.hasSpeedTarget()) {
                        _speedTargetIndicator.clipY(1 - (speedTarget / maxSpeed + _speedTargetIndicatorSize[1] / 2), 1 - (speedTarget / maxSpeed - _speedTargetIndicatorSize[1] / 2));
                        _speedTargetIndicator.show();
                    } else {
                        _speedTargetIndicator.hide();
                    }
                }
                _speedBar.applyLayout(_speedBarLayout, canvas.width, canvas.height);
                _speedBar.show();
                _speedTargetIndicator.applyLayout(_speedBarLayout, canvas.width, canvas.height);
                _speedTextLayer.show();
            } else {
                _speedBar.hide();
                _speedTargetIndicator.hide();
                _speedTextLayer.hide();
            }
            // .....................................................................................................
            // drift arrow
            if (isInAimingView && _hudSectionIsVisible(HUDSection.DRIFT_ARROW)) {
                direction2D = [relativeVelocity[12], relativeVelocity[14]];
                driftSpeed = vec.extractLength2(direction2D);
                if (driftSpeed > _driftArrowMinSpeed) {
                    _driftArrow.show();
                    aspect = _battleScene.getCamera().getAspect();
                    arrowPositionRadius = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW_POSITION_RADIUS) * (utils.yScalesWithHeight(_centerCrosshairScaleMode, canvas.width, canvas.height) ? 1 : aspect);
                    _driftArrow.setPosition(vec.scaled2([direction2D[0] / aspect, direction2D[1]], arrowPositionRadius));
                    _driftArrow.setAngle(Math.acos(direction2D[1]) * ((direction2D[0] < 0) ? -1 : 1));
                    driftArrowMaxSpeed = _driftArrowMaxSpeedFactor * acceleration;
                    if (driftArrowMaxSpeed === 0) {
                        driftArrowMaxSpeed = maxSpeed;
                    }
                    _driftArrow.setColor(utils.getMixedColor(
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW).colors.minSpeed,
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW).colors.maxSpeed,
                            Math.min((driftSpeed - _driftArrowMinSpeed) / (driftArrowMaxSpeed - _driftArrowMinSpeed), 1.0)));
                } else {
                    _driftArrow.hide();
                }
            } else {
                _driftArrow.hide();
            }
            // .....................................................................................................
            // hull and shield integrity bar
            hullIntegrity = craft.getHullIntegrity();
            shieldIntegrity = craft.getShieldIntegrity();
            // color change animation when the integrity decreases
            if (craft !== _spacecraft) {
                _spacecraft = craft;
                _refreshWingmanStatusPanel();
                _missileClasses = craft.getMissileClasses();
                _spacecraftHullIntegrity = hullIntegrity;
                _spacecraftShieldIntegrity = shieldIntegrity;
                animationProgress = 0;
                animation2Progress = 0;
                _hullIntegrityDecreaseTime = 0;
                _shieldDecreaseTime = 0;
            } else {
                if (hullIntegrity < _spacecraftHullIntegrity) {
                    _hullIntegrityDecreaseTime = _hudHullIntegrityDecreaseAnimationDuration;
                    animationProgress = 1;
                } else if (_hullIntegrityDecreaseTime > 0) {
                    _hullIntegrityDecreaseTime -= dt;
                    animationProgress = _hullIntegrityDecreaseTime / _hudHullIntegrityDecreaseAnimationDuration;
                }
                _spacecraftHullIntegrity = hullIntegrity;
                if (shieldIntegrity < _spacecraftShieldIntegrity) {
                    _shieldDecreaseTime = _hudShieldDecreaseAnimationDuration;
                    animation2Progress = 1;
                } else if (_shieldDecreaseTime > 0) {
                    _shieldDecreaseTime -= dt;
                    animation2Progress = _shieldDecreaseTime / _hudShieldDecreaseAnimationDuration;
                }
                _spacecraftShieldIntegrity = shieldIntegrity;
            }
            colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.HULL_INTEGRITY_BAR).colors;
            if (_hudSectionIsVisible(HUDSection.HULL_BAR)) {
                if (_hullIntegrityDecreaseTime > 0) {
                    _hullIntegrityBar.setColor(utils.getMixedColor(colors.filled, colors.filledWhenDecreasing, animationProgress));
                    _hullIntegrityBar.setClipColor(utils.getMixedColor(colors.empty, colors.emptyWhenDecreasing, animationProgress));
                } else {
                    _hullIntegrityBar.setColor(colors.filled);
                    _hullIntegrityBar.setClipColor(colors.empty);
                }
                _hullIntegrityBar.clipY(0, hullIntegrity);
                _hullIntegrityBar.applyLayout(_hullIntegrityBarLayout, canvas.width, canvas.height);
                _hullIntegrityBar.show();
            } else {
                _hullIntegrityBar.hide();
            }
            if (craft.hasShield() && _hudSectionIsVisible(HUDSection.SHIELD_BAR)) {
                colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIELD_BAR).colors;
                if (_shieldDecreaseTime > 0) {
                    _shieldBar.setColor(utils.getMixedColor(colors.filled, colors.filledWhenDecreasing, animation2Progress));
                    _shieldBar.setClipColor(utils.getMixedColor(colors.empty, colors.emptyWhenDecreasing, animation2Progress));
                } else {
                    _shieldBar.setColor(colors.filled);
                    _shieldBar.setClipColor(colors.empty);
                }
                _shieldBar.clipY(0, shieldIntegrity);
                _shieldBar.applyLayout(_shieldBarLayout, canvas.width, canvas.height);
                _shieldBar.show();
            } else {
                _shieldBar.hide();
            }
            // .....................................................................................................
            // flight mode indicator
            if (_hudSectionIsVisible(HUDSection.FLIGHT_MODE)) {
                _flightModeIndicatorBackground.applyLayout(_flightModeIndicatorBackgroundLayout, canvas.width, canvas.height);
                _flightModeIndicatorBackground.show();
                _flightModeText.setText(strings.get(strings.FLIGHT_MODE.PREFIX, craft.getFlightMode(), craft.getFlightMode()));
                colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_TEXT).colors;
                switch (craft.getFlightMode()) {
                    case equipment.FlightMode.FREE:
                        _flightModeText.setColor(colors.free);
                        break;
                    case equipment.FlightMode.COMBAT:
                        _flightModeText.setColor(colors.combat);
                        break;
                    case equipment.FlightMode.CRUISE:
                        _flightModeText.setColor(colors.cruise);
                        break;
                    default:
                        application.showError("Unknown flight mode: " + craft.getFlightMode() + "!");
                }
                _flightModeIndicatorTextLayer.show();
            } else {
                _flightModeIndicatorBackground.hide();
                _flightModeIndicatorTextLayer.hide();
            }
            // .....................................................................................................
            // missile info indicator
            lockRatio = 0;
            if (_missileClasses.length > 0) {
                colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_TEXT).colors;
                missileLauncher = craft.getActiveMissileLauncher();
                craftCount = 0; // used for saving count of equipped missiles
                for (i = 0; i < _missileInfoNameTexts.length; i++) {
                    if (i < _missileClasses.length) {
                        text = _missileClasses[i].getShortName();
                        count = craft.getMissileCount(_missileClasses[i]);
                        _missileInfoCountTexts[i].setText(count.toString());
                        if (count <= 0) {
                            color = colors.empty;
                        } else if (missileLauncher && (missileLauncher.getMissileClass() === _missileClasses[i])) {
                            if (craft.getTarget()) {
                                lockRatio = craft.getMissileLockRatio();
                            }
                            targetInRange = lockRatio >= 1;
                            missileLoaded = missileLauncher.isReady();
                            color = missileLoaded ? (targetInRange ? colors.readySelected : colors.lockingSelected) : colors.loadingSelected;
                            if (missileLauncher.isInSalvoMode()) {
                                text += " (×" + Math.min(missileLauncher.getSalvo(), missileLauncher.getMissileCount()) + ")";
                            }
                            craftCount = count;
                            if (targetInRange) {
                                if (!_missileLocked) {
                                    _missileLockedSound.play();
                                } else if (missileLoaded && !_missileLoaded) {
                                    _missileLoadedSound.play();
                                }
                                _missileLocked = true;
                            } else {
                                speedRatio = lockRatio * _missileLockingSoundCount;
                                if (speedRatio <= 0) {
                                    _missileLockingSoundsPlayed = 0;
                                } else {
                                    speedRatio = Math.floor(speedRatio) + 1;
                                    if (speedRatio > _missileLockingSoundsPlayed) {
                                        _missileLockingSoundsPlayed++;
                                        _missileLockingSound.play();
                                    } else if (speedRatio < _missileLockingSoundsPlayed) {
                                        _missileLockingSoundsPlayed = 0;
                                    }
                                }
                                _missileLocked = false;
                            }
                            _missileLoaded = missileLoaded;
                        } else {
                            color = colors.notSelected;
                        }
                        _missileInfoNameTexts[i].setText(text);
                        _missileInfoNameTexts[i].setColor(color);
                        _missileInfoCountTexts[i].setColor(color);
                        _missileInfoNameTexts[i].show();
                        _missileInfoCountTexts[i].show();
                    } else {
                        _missileInfoNameTexts[i].hide();
                        _missileInfoCountTexts[i].hide();
                    }
                }
                if (_hudSectionIsVisible(HUDSection.MISSILE_INFO)) {
                    _missileInfoBackground.applyLayout(_missileInfoBackgroundLayout, canvas.width, canvas.height);
                    _missileInfoBackground.show();
                    _missileInfoTextLayer.show();
                } else {
                    _missileInfoBackground.hide();
                    _missileInfoTextLayer.hide();
                }
                // .....................................................................................................
                // missile indicator
                if ((craftCount > 0) && _hudSectionIsVisible(HUDSection.MISSILE_INDICATOR)) {
                    _missileIndicator.setTextureCoordinates(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).mappings[missileLauncher.isInSalvoMode() ? "salvo" : "single"]);
                    colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).colors;
                    speedRatio = missileLauncher.getLoadRatio();
                    if (speedRatio < 1) {
                        _missileIndicator.setColor(colors.locking);
                        _missileIndicator.setClipColor(colors.loading);
                        _missileIndicator.clipY(0, speedRatio);
                    } else {
                        _missileIndicator.setColor(colors.ready);
                        _missileIndicator.setClipColor(colors.locking);
                        _missileIndicator.clipY(0, lockRatio);
                    }
                    _missileIndicator.applyLayout(_missileIndicatorLayout, canvas.width, canvas.height);
                    _missileIndicator.show();
                    _missileIndicatorText.setText(craftCount.toString());
                    colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR_TEXT).colors;
                    _missileIndicatorText.setColor((speedRatio >= 1) ? (targetInRange ? colors.ready : colors.locking) : colors.loading);
                    _missileIndicatorTextLayer.show();
                } else {
                    _missileIndicator.hide();
                    _missileIndicatorTextLayer.hide();
                }
            } else {
                _missileInfoBackground.hide();
                _missileInfoTextLayer.hide();
                _missileIndicator.hide();
                _missileIndicatorTextLayer.hide();
            }
            if (!_demoMode && control.isInPilotMode()) {
                // .....................................................................................................
                // objectives
                if (_hudSectionIsVisible(HUDSection.OBJECTIVES)) {
                    _objectivesBackground.applyLayout(_objectivesBackgroundLayout, canvas.width, canvas.height);
                    _objectivesBackground.show();
                    objectivesState = _mission.getObjectivesState();
                    colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_TEXT).colors;
                    for (i = 0; i < _objectivesTexts.length; i++) {
                        if (i < objectivesState.length) {
                            _objectivesTexts[i].setText(objectivesState[i].text);
                            switch (objectivesState[i].state) {
                                case ObjectiveState.IN_PROGRESS:
                                    _objectivesTexts[i].setColor(colors.inProgress);
                                    break;
                                case ObjectiveState.COMPLETED:
                                    _objectivesTexts[i].setColor(colors.completed);
                                    break;
                                case ObjectiveState.FAILED:
                                    _objectivesTexts[i].setColor(colors.failed);
                                    break;
                            }
                            _objectivesTexts[i].show();
                        } else {
                            _objectivesTexts[i].hide();
                        }
                    }
                    _objectivesTextLayer.show();
                } else {
                    _objectivesBackground.hide();
                    _objectivesTextLayer.hide();
                }
                // .....................................................................................................
                // escorts
                ships = _escorts.filter(_escortShouldBeIndicated);
                if ((ships.length > 0) && _hudSectionIsVisible(HUDSection.ESCORTS)) {
                    _escortsBackground.applyLayout(_escortsBackgroundLayout, canvas.width, canvas.height);
                    _escortsBackground.show();
                    for (i = 0; i < _escortsTexts.length; i++) {
                        if (i < ships.length) {
                            _escortsTexts[i].setText(ships[i].getDisplayName() || strings.get(strings.BATTLE.HUD_SPACECRAFT_NAME_UNKNOWN));
                            away = ships[i].isAway();
                            colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_TEXT).colors;
                            _escortsTexts[i].setColor(ships[i].isAlive() ? (away ? colors.away : colors.alive) : colors.destroyed);
                            _escortBars[i].hull.setColor(away ? _escortsIntegrityBarsSettings.colors.awayHull :
                                    _getHullIntegrityColor(ships[i].getHullIntegrity(),
                                            _escortsIntegrityBarsSettings.colors.fullHull,
                                            _escortsIntegrityBarsSettings.colors.halfHull,
                                            _escortsIntegrityBarsSettings.colors.zeroHull));
                            _escortBars[i].hull.clipX(0, ships[i].getHullIntegrity());
                            _escortBars[i].hull.applyLayout(_escortBars[i].hullLayout, canvas.width, canvas.height);
                            _escortsTexts[i].show();
                            _escortBars[i].hull.show();
                            if (ships[i].hasShield() && !away) {
                                _escortBars[i].shield.clipX(0, ships[i].getShieldIntegrity());
                                _escortBars[i].shield.applyLayout(_escortBars[i].shieldLayout, canvas.width, canvas.height);
                                _escortBars[i].shield.show();
                            } else {
                                _escortBars[i].shield.hide();
                            }
                        } else {
                            _escortsTexts[i].hide();
                            _escortBars[i].hull.hide();
                            _escortBars[i].shield.hide();
                        }
                    }
                    _escortsTextLayer.show();
                } else {
                    _escortsBackground.hide();
                    _escortsTextLayer.hide();
                    for (i = 0; i < _escortBars.length; i++) {
                        _escortBars[i].hull.hide();
                        _escortBars[i].shield.hide();
                    }
                }
            } else {
                _objectivesBackground.hide();
                _objectivesTextLayer.hide();
                _escortsBackground.hide();
                _escortsTextLayer.hide();
                for (i = 0; i < _escortBars.length; i++) {
                    _escortBars[i].hull.hide();
                    _escortBars[i].shield.hide();
                }
            }
            // .....................................................................................................
            // HUD messages
            i = 0;
            // finding the highest priority non empty queue
            while ((i < MESSAGE_QUEUES.length) && (_messageQueues[MESSAGE_QUEUES[i]].length === 0)) {
                i++;
            }
            // if such a queue has been found, display the first message in the queue
            if ((control.isInPilotMode()) && (i < MESSAGE_QUEUES.length)) {
                messageQueue = _messageQueues[MESSAGE_QUEUES[i]];
                // playing sound for messages which appear instantly (without animation)
                if (messageQueue[0].new) {
                    if (!messageQueue[0].silent && !messageQueue[0].appearTimeLeft) {
                        _messageSound.play();
                    }
                    messageQueue[0].new = false;
                }
                // setting text
                _messageText.setText(messageQueue[0].text);
                // setting reveal state based on appear animation for "typewriter" effect
                if (messageQueue[0].appearTimeLeft > 0) {
                    _messageText.setRevealState(1 - messageQueue[0].appearTimeLeft / messageQueue[0].appearDuration);
                    messageQueue[0].appearTimeLeft -= dt;
                    // playing appear animation sound
                    if (!messageQueue[0].silent) {
                        _messageTypeSound.setVolume(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_TYPE_SOUND).volume);
                        _messageTypeSound.play();
                    }
                } else {
                    _messageText.setRevealState(1);
                    _messageTypeSound.stopLoop();
                }
                // setting color
                if (messageQueue[0].color) {
                    color = messageQueue[0].color;
                } else {
                    color = _messageTextSettings.colors.default;
                }
                if (messageQueue[0].blinkInterval > 0) {
                    color = color.slice();
                    color[3] = color[3] * Math.abs(((messageQueue[0].duration - messageQueue[0].timeLeft) % messageQueue[0].blinkInterval) / messageQueue[0].blinkInterval - 0.5) * 2;
                }
                _messageText.setColor(color);
                // transmission source
                _messageSource = messageQueue[0].source;
                // managing timing
                skip = false;
                if (!messageQueue[0].permanent) {
                    if ((messageQueue[0] === _newHostilesMessage)) {
                        messageQueue[0].timeLeft = _newHostilesAlertTimeLeft;
                        if (_newHostilesAlertTimeLeft <= 0) {
                            skip = true;
                        }
                    } else {
                        messageQueue[0].timeLeft -= dt;
                    }
                    if (messageQueue[0].timeLeft <= 0) {
                        messageQueue.shift();
                        if (messageQueue.length > 0) {
                            messageQueue[0].new = true;
                        }
                    }
                }
                if (!skip) {
                    _messageBackground.applyLayout(_messageBackgroundLayout, canvas.width, canvas.height);
                    _messageBackground.show();
                    _messageTextLayer.show();
                } else {
                    _messageTextLayer.hide();
                    _messageBackground.hide();
                }
            } else {
                _messageTextLayer.hide();
                _messageBackground.hide();
                _messageTypeSound.stopPlaying(HUD_MESSAGE_APPEAR_SOUND_STOP_RAMP_DURATION);
                _messageSource = null;
            }
            if (_newHostilesAlertTimeLeft > 0) {
                _newHostilesAlertTimeLeft -= dt;
            }
            // .....................................................................................................
            // target related information
            target = craft.getTarget();
            if (_target !== target) {
                _target = target;
                targetSwitched = true;
                _targetSwitchTime = _hudTargetSwitchAnimationDuration;
                targetSwitchAnimationProgress = 1;
            } else if (_targetSwitchTime > 0) {
                _targetSwitchTime -= dt;
                targetSwitchAnimationProgress = _targetSwitchTime / _hudTargetSwitchAnimationDuration;
            } else {
                targetSwitchAnimationProgress = 0;
            }
            if (_aimAssistAppearTime > 0) {
                aimAssistAppearAnimationProgress = _aimAssistAppearTime / _hudAimAssistAppearAnimationDuration;
            } else {
                aimAssistAppearAnimationProgress = 0;
            }
            visible1 = false;
            visible2 = false;
            visible3 = false;
            visible4 = false;
            if (target) {
                targetPosition = target.getPhysicalPositionVector();
                position = craft.getPhysicalPositionVector();
                vectorToTarget = vec.diff3(targetPosition, position);
                distance = vec.length3(vectorToTarget);
                weapons = craft.getWeapons();
                targetIsHostile = target.isHostile(craft);
                if (weapons.length > 0) {
                    futureTargetPosition = craft.getTargetHitPosition();
                    // aim assist indicator at the expected future position of the target (if turned on)
                    if (!_aimAssistCrosshairs && _hudSectionIsVisible(HUDSection.AIM_ASSIST_INDICATOR)) {
                        _aimAssistIndicator.setPosition(futureTargetPosition);
                        color = targetIsHostile ?
                                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR).colors.hostile :
                                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR).colors.friendly;
                        // scaling / coloring according to the appear / target switch animation
                        if ((_targetSwitchTime > 0) || (_aimAssistAppearTime > 0)) {
                            animationProgress = Math.max(targetSwitchAnimationProgress, aimAssistAppearAnimationProgress);
                            _aimAssistIndicator.setColor(utils.getMixedColor(
                                    color,
                                    config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR).colors.appear,
                                    animationProgress));
                            _aimAssistIndicator.setSize(vec.scaled2(
                                    _aimAssistIndicatorSize,
                                    1 + (_aimAssistIndicatorAppearScale - 1) * animationProgress));
                        } else {
                            _aimAssistIndicator.setColor(color);
                            _aimAssistIndicator.setSize(_aimAssistIndicatorSize);
                        }
                        _aimAssistIndicator.show();
                        visible1 = true;
                    }
                    // weapon crosshairs in the lines of fire
                    futureDistance = vec.length3(vec.diff3(futureTargetPosition, position));
                    m = craft.getPhysicalModel().getOrientationMatrix();
                    scale = craft.getVisualModel().getScalingMatrix()[0];
                    scaledOriMatrix = craft.getScaledOriMatrix();
                    targetInRange = false;
                    for (i = 0; i < weapons.length; i++) {
                        if (_weaponImpactIndicators.length <= i) {
                            _weaponImpactIndicators.push(_createWeaponImpactIndicator());
                            _weaponImpactIndicators[i].addToScene(_battleScene);
                        }
                        if (weapons[i].isFixed()) {
                            slotPosition = weapons[i].getOrigoPositionMatrix();
                            indicatorPosition = vec.sumArray3([
                                position,
                                vec.scaled3Aux(mat.getRowB43(m), futureDistance),
                                vec.scaled3Aux(mat.getRowA43(m), slotPosition[12] * scale),
                                vec.scaled3Aux(mat.getRowC43(m), slotPosition[14] * scale)]);
                        } else {
                            basePointPosition = weapons[i].getBasePointPosVector(scaledOriMatrix);
                            indicatorPosition = vec.sum3(
                                    basePointPosition,
                                    vec.scaled3Aux(mat.getRowB43(weapons[i].getProjectileOrientationMatrix()), vec.length3(
                                            vec.diff3Aux(futureTargetPosition, basePointPosition))));
                        }
                        if (_aimAssistCrosshairs) {
                            vec.sub3(indicatorPosition, vec.diff3Aux(futureTargetPosition, targetPosition));
                        }
                        _weaponImpactIndicators[i].setPosition(indicatorPosition);
                        if (futureDistance <= weapons[i].getRange(speed)) {
                            _weaponImpactIndicators[i].setColor(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WEAPON_IMPACT_INDICATOR).colors.normal);
                            targetInRange = true;
                        } else {
                            _weaponImpactIndicators[i].setColor(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WEAPON_IMPACT_INDICATOR).colors.outOfRange);
                        }
                        // scaling according to the target switch animation
                        if (_targetSwitchTime > 0) {
                            _weaponImpactIndicators[i].setSize(vec.scaled2(_weaponImpactIndicatorSize, 1 + (_weaponImpactIndicatorSwitchScale - 1) * targetSwitchAnimationProgress));
                        } else {
                            _weaponImpactIndicators[i].setSize(_weaponImpactIndicatorSize);
                        }
                        _weaponImpactIndicators[i].show();
                    }
                    if (_hudSectionIsVisible(HUDSection.WEAPON_IMPACT_INDICATORS)) {
                        while (i < _weaponImpactIndicators.length) {
                            _weaponImpactIndicators[i].hide();
                            i++;
                        }
                        visible2 = true;
                    }
                    if (!targetInRange || (craft.isFighter() && (vec.dot3(mat.getRowB43(m), vectorToTarget) < 0))) {
                        visible1 = false;
                        _aimAssistAppearTime = _hudAimAssistAppearAnimationDuration;
                    } else {
                        _aimAssistAppearTime -= dt;
                    }
                }
                // target info panel
                hullIntegrity = target.getHullIntegrity();
                shieldIntegrity = target.getShieldIntegrity();
                if (_hudSectionIsVisible(HUDSection.TARGET_INFO)) {
                    _targetInfoBackground.applyLayout(_targetInfoBackgroundLayout, canvas.width, canvas.height);
                    _targetInfoBackground.show();
                    // target view
                    _targetViewItemColor = _getHullIntegrityColor(hullIntegrity,
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_TARGET_ITEM_FULL_INTEGRITY_COLOR),
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_TARGET_ITEM_HALF_INTEGRITY_COLOR),
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_TARGET_ITEM_ZERO_INTEGRITY_COLOR));
                    if (_targetViewItem !== target) {
                        _targetScene.clearNodes(true);
                        _targetViewModel = null;
                        _targetViewItem = target;
                        _targetViewItem.addToScene(_targetScene, graphics.getMaxLoadedLOD(), true, TARGET_VIEW_SUPPLEMENTS, _targetViewParams, _targetViewAddCallback);
                    }
                    // setting orientation of the target view model
                    if (_targetViewModel) {
                        _targetViewModel.setOrientationM4(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.RELATIVE_TARGET_ORIENTATION) ? mat.prod4Aux(
                                target.getPhysicalOrientationMatrix(),
                                mat.inverseOfRotation4Aux(mat.lookTowards4Aux(
                                        vec.normalize3(vec.diffTranslation3Aux(craft.getPhysicalPositionMatrix(), target.getPhysicalPositionMatrix())),
                                        mat.getRowC43(craft.getPhysicalOrientationMatrix())))) :
                                mat.IDENTITY4);
                    }
                    _targetScene.setRelativeViewport(
                            _targetViewLayout.getPositiveLeft(canvas.width, canvas.height),
                            _targetViewLayout.getPositiveBottom(canvas.width, canvas.height),
                            _targetViewLayout.getPositiveWidth(canvas.width, canvas.height),
                            _targetViewLayout.getPositiveHeight(canvas.width, canvas.height));
                    // target hull and shield integrity bars
                    _targetHullIntegrityBar.clipX(0, hullIntegrity);
                    _targetHullIntegrityBar.applyLayout(_targetHullIntegrityBarLayout, canvas.width, canvas.height);
                    _targetHullIntegrityBar.show();
                    if (target.hasShield()) {
                        _targetShieldBar.clipX(0, shieldIntegrity);
                        _targetShieldBar.applyLayout(_targetShieldBarLayout, canvas.width, canvas.height);
                        _targetShieldBar.show();
                    } else {
                        _targetShieldBar.hide();
                    }
                    // target info texts
                    targetInfoTextColor = targetIsHostile ?
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_TEXT).colors.hostile :
                            config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_TEXT).colors.friendly;
                    _targetInfoTexts[TARGET_INFO_NAME].setColor(targetInfoTextColor);
                    _targetInfoTexts[TARGET_INFO_NAME].setText(target.getDisplayName() || strings.get(strings.BATTLE.HUD_SPACECRAFT_NAME_UNKNOWN));
                    _targetInfoTexts[TARGET_INFO_TEAM].setColor(targetInfoTextColor);
                    _targetInfoTexts[TARGET_INFO_TEAM].setText(target.getTeam() ? target.getTeam().getDisplayName() : strings.get(strings.BATTLE.HUD_TEAM_UNKNOWN));
                    _targetInfoTexts[TARGET_INFO_CLASS].setColor(targetInfoTextColor);
                    _targetInfoTexts[TARGET_INFO_CLASS].setText(target.getClass().getDisplayName());
                    _targetInfoTexts[TARGET_INFO_FIREPOWER].setColor(targetInfoTextColor);
                    armor = target.getTarget() && target.getTarget().getClass().getArmor();
                    _targetInfoTexts[TARGET_INFO_FIREPOWER].setText(strings.get(strings.BATTLE.HUD_FIREPOWER) + ": " + (armor ? (target.getFirepower(armor).toFixed(1) + " / ") : "") + target.getFirepower().toFixed(1));
                    _targetInfoTexts[TARGET_INFO_DISTANCE].setColor(targetInfoTextColor);
                    _targetInfoTexts[TARGET_INFO_DISTANCE].setText(strings.get(strings.BATTLE.HUD_DISTANCE) + ": " + utils.getLengthString(distance));
                    _targetInfoTexts[TARGET_INFO_VELOCITY].setColor(targetInfoTextColor);
                    _targetInfoTexts[TARGET_INFO_VELOCITY].setText(strings.get(strings.BATTLE.HUD_VELOCITY) + ": " + mat.translationLength(target.getPhysicalVelocityMatrix()).toFixed() + " m/s");
                    _targetInfoTextLayer.show();
                    visible3 = true;
                }
                // .....................................................................................................
                // target integrity quick view bar
                if (isInAimingView) {
                    _targetHullIntegrityQuickViewBar.clipX(0.5 - hullIntegrity / 2, 0.5 + hullIntegrity / 2);
                    _targetHullIntegrityQuickViewBar.applyLayout(_targetHullIntegrityQuickViewBarLayout, canvas.width, canvas.height);
                    if (target.hasShield()) {
                        _targetShieldQuickViewBar.clipX(0.5 - shieldIntegrity / 2, 0.5 + shieldIntegrity / 2);
                        _targetShieldQuickViewBar.applyLayout(_targetShieldQuickViewBarLayout, canvas.width, canvas.height);
                        _targetShieldQuickViewBar.show();
                    } else {
                        _targetShieldQuickViewBar.hide();
                    }
                    // target hull integrity decrease animation (color change of the filled portion)
                    if (targetSwitched) {
                        _targetHullIntegrity = hullIntegrity;
                        _targetShieldIntegrity = shieldIntegrity;
                        _targetHullIntegrityDecreaseTime = 0;
                        _targetShieldDecreaseTime = 0;
                        animationProgress = 0;
                        animation2Progress = 0;
                    } else {
                        if (hullIntegrity < _targetHullIntegrity) {
                            _targetHullIntegrityDecreaseTime = _hudTargetHullIntegrityDecreaseAnimationDuration;
                            animationProgress = 1;
                        } else if (_targetHullIntegrityDecreaseTime > 0) {
                            _targetHullIntegrityDecreaseTime -= dt;
                            animationProgress = _targetHullIntegrityDecreaseTime / _hudTargetHullIntegrityDecreaseAnimationDuration;
                        }
                        _targetHullIntegrity = hullIntegrity;
                        if (shieldIntegrity < _targetShieldIntegrity) {
                            _targetShieldDecreaseTime = _hudTargetShieldDecreaseAnimationDuration;
                            animation2Progress = 1;
                        } else if (_targetShieldDecreaseTime > 0) {
                            _targetShieldDecreaseTime -= dt;
                            animation2Progress = _targetShieldDecreaseTime / _hudTargetShieldDecreaseAnimationDuration;
                        }
                        _targetShieldIntegrity = shieldIntegrity;
                    }
                    colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR).colors;
                    filledColor = targetIsHostile ? colors.hostileFilled : colors.friendlyFilled;
                    emptyColor = targetIsHostile ? colors.hostileEmpty : colors.friendlyEmpty;
                    if (_targetHullIntegrityDecreaseTime > 0) {
                        _targetHullIntegrityQuickViewBar.setColor(utils.getMixedColor(filledColor, colors.filledWhenDecreasing, animationProgress));
                    } else {
                        _targetHullIntegrityQuickViewBar.setColor(filledColor);
                    }
                    _targetHullIntegrityQuickViewBar.setClipColor(emptyColor);
                    _targetHullIntegrityQuickViewBar.show();
                    if (target.hasShield()) {
                        colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_QUICK_VIEW_BAR).colors;
                        if (_targetShieldDecreaseTime > 0) {
                            _targetShieldQuickViewBar.setColor(utils.getMixedColor(colors.filled, colors.filledWhenDecreasing, animation2Progress));
                        } else {
                            _targetShieldQuickViewBar.setColor(colors.filled);
                        }
                        _targetShieldQuickViewBar.setClipColor(colors.empty);
                        _targetShieldQuickViewBar.show();
                    } else {
                        _targetShieldQuickViewBar.hide();
                    }
                    visible4 = _hudSectionIsVisible(HUDSection.TARGET_INDICATOR);
                }
            }
            if (!visible1) {
                _aimAssistIndicator.hide();
            }
            if (!visible2) {
                for (i = 0; i < _weaponImpactIndicators.length; i++) {
                    _weaponImpactIndicators[i].hide();
                }
            }
            if (!visible3) {
                _targetInfoBackground.hide();
                if (_targetViewItem) {
                    _targetScene.clearNodes(true);
                    _targetViewItem = null;
                    _targetViewModel = null;
                }
                _targetHullIntegrityBar.hide();
                _targetShieldBar.hide();
                _targetInfoTextLayer.hide();
            }
            if (!visible4) {
                _targetHullIntegrityQuickViewBar.hide();
                _targetShieldQuickViewBar.hide();
                _distanceTextLayer.hide();
            }
            // .....................................................................................................
            // wingmen status
            if ((_squads.length > 0) && _hudSectionIsVisible(HUDSection.WINGMEN_INFO)) {
                _wingmenStatusBackground.applyLayout(_wingmenStatusBackgroundLayout, canvas.width, canvas.height);
                _wingmenStatusBackground.show();
                _wingmenStatusTextLayer.show();
                // create / update squad labels and individual spacecraft indicators
                count = 0;
                playerFound = false;
                for (i = 0; i < _squads.length; i++) {
                    // create / update the text label for the squad
                    if (_wingmenStatusSquadTexts.length <= i) {
                        _wingmenStatusSquadTexts.push(_createWingmenStatusSquadText(i));
                        _wingmenStatusTextLayer.addText(_wingmenStatusSquadTexts[i]);
                    }
                    _wingmenStatusSquadTexts[i].setText(strings.get(strings.SQUAD.PREFIX, _squads[i].name, _squads[i].name));
                    _wingmenStatusSquadTexts[i].show();
                    // only check as many spacecrafts as there are positions defined for, as we cannot display more
                    craftCount = Math.min(_squads[i].crafts.length, _wingmenStatusMaxSquadMemberCount);
                    for (j = 0; j < craftCount; j++) {
                        // create / update individual indicators
                        wingman = _squads[i].crafts[j];
                        // generate a new layout if necessary
                        if (_wingmenStatusCraftLayouts.length <= count) {
                            _wingmenStatusCraftLayouts.push(_createWingmanCraftIndicatorLayout(i, craftCount, j));
                            // if the layout changed, it is possible, that the spacecraft type changed too, so update texture coordinates
                            if (_wingmenStatusCraftIndicators.length > count) {
                                _wingmenStatusCraftIndicators[count].body.setTextureCoordinates(
                                        _wingmenStatusCraftIndicatorSettings.mappings[wingman.getTypeName()] ||
                                        _wingmenStatusCraftIndicatorSettings.mappings.general);
                            }
                        }
                        // create a new HUD element if necessary
                        if (_wingmenStatusCraftIndicators.length <= count) {
                            _wingmenStatusCraftIndicators.push({
                                body: _createWingmanCraftIndicator(_wingmenStatusCraftLayouts[count], wingman.getTypeName()),
                                shield: _createWingmanCraftIndicator(_wingmenStatusCraftLayouts[count], "shield")
                            });
                            _wingmenStatusCraftIndicators[count].body.addToScene(_battleScene);
                            _wingmenStatusCraftIndicators[count].shield.addToScene(_battleScene);
                        }
                        // apply the created / stored layout
                        _wingmenStatusCraftIndicators[count].body.applyLayout(_wingmenStatusCraftLayouts[count], canvas.width, canvas.height);
                        _wingmenStatusCraftIndicators[count].shield.applyLayout(_wingmenStatusCraftLayouts[count], canvas.width, canvas.height);
                        // color based on hull integrity
                        _wingmenStatusCraftIndicators[count].body.setColor(wingman.isAlive() ?
                                (wingman.isAway() ?
                                        _wingmenStatusCraftIndicatorSettings.colors.away :
                                        _getHullIntegrityColor(wingman.getHullIntegrity(),
                                                _wingmenStatusCraftIndicatorSettings.colors.fullIntegrity,
                                                _wingmenStatusCraftIndicatorSettings.colors.halfIntegrity,
                                                _wingmenStatusCraftIndicatorSettings.colors.zeroIntegrity)) :
                                _wingmenStatusCraftIndicatorSettings.colors.destroyed);
                        _wingmenStatusCraftIndicators[count].body.show();
                        if (wingman.isAlive() && !wingman.isAway() && wingman.hasShield()) {
                            _wingmenStatusCraftIndicators[count].shield.setColor(
                                    _getHullIntegrityColor(wingman.getShieldIntegrity(),
                                            _wingmenStatusCraftIndicatorSettings.colors.fullShieldIntegrity,
                                            _wingmenStatusCraftIndicatorSettings.colors.halfShieldIntegrity,
                                            _wingmenStatusCraftIndicatorSettings.colors.zeroShieldIntegrity));
                            _wingmenStatusCraftIndicators[count].shield.show();
                        } else {
                            _wingmenStatusCraftIndicators[count].shield.hide();
                        }
                        // add player indicator for the followed spacecraft
                        if (wingman === craft) {
                            if (!_wingmenStatusPlayerIndicator) {
                                _wingmenStatusPlayerIndicator = _createWingmanCraftIndicator(_wingmenStatusCraftLayouts[count], "player");
                                _wingmenStatusPlayerIndicator.addToScene(_battleScene);
                            }
                            _wingmenStatusPlayerIndicator.applyLayout(_wingmenStatusCraftLayouts[count], canvas.width, canvas.height);
                            _wingmenStatusPlayerIndicator.setColor(_wingmenStatusCraftIndicators[count].body.getColor());
                            _wingmenStatusPlayerIndicator.show();
                            playerFound = true;
                        }
                        count++;
                    }
                }
                // hide any elements that were created before but are not needed currently
                while (i < _wingmenStatusSquadTexts.length) {
                    _wingmenStatusSquadTexts[i].hide();
                    i++;
                }
                for (i = count; i < _wingmenStatusCraftIndicators.length; i++) {
                    _wingmenStatusCraftIndicators[i].body.hide();
                    _wingmenStatusCraftIndicators[i].shield.hide();
                }
                if (!playerFound && _wingmenStatusPlayerIndicator) {
                    _wingmenStatusPlayerIndicator.hide();
                }
            } else {
                // if there are no squads in the team of the followed spacecraft, just hide the whole panel
                _wingmenStatusBackground.hide();
                _wingmenStatusTextLayer.hide();
                for (i = 0; i < _wingmenStatusCraftIndicators.length; i++) {
                    _wingmenStatusCraftIndicators[i].body.hide();
                    _wingmenStatusCraftIndicators[i].shield.hide();
                }
                if (_wingmenStatusPlayerIndicator) {
                    _wingmenStatusPlayerIndicator.hide();
                }
            }
            // .....................................................................................................
            // ship indicators and arrows
            ships = _mission.getSpacecrafts().filter(_spacecraftShouldBeIndicated);
            highlightedShips = craft.getTargetingSpacecrafts().filter(_spacecraftShouldBeIndicated);
            aspect = _battleScene.getCamera().getAspect();
            // caching (animated) colors for indicators and arrows
            animationProgress = Math.abs((2 * _shipIndicatorHighlightTime / _shipIndicatorHighlightAnimationInterval) - 1);
            colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).colors;
            hostileColor = utils.getMixedColor(colors.hostile, colors.hostileHighlight, animationProgress);
            friendlyColor = utils.getMixedColor(colors.friendly, colors.friendlyHighlight, animationProgress);
            colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).colors;
            hostileArrowColor = utils.getMixedColor(colors.hostile, colors.hostileHighlight, animationProgress);
            friendlyArrowColor = utils.getMixedColor(colors.friendly, colors.friendlyHighlight, animationProgress);
            if (control.isInPilotMode() && _newHostilesMessage && (_newHostilesAlertTimeLeft > 0)) {
                newHostilesPresent = true;
                animationProgress = Math.abs(((_newHostilesMessage.duration - _newHostilesAlertTimeLeft) % _newHostilesMessage.blinkInterval) / _newHostilesMessage.blinkInterval - 0.5) * 2;
                newHostileColor = utils.getMixedColor(
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).colors.hostile,
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).colors.newHostile,
                        animationProgress);
                newHostileArrowColor = utils.getMixedColor(
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).colors.hostile,
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).colors.newHostile,
                        animationProgress);
            } else {
                newHostilesPresent = false;
            }
            statusCount = 0; // counter for the status indicators that we are using
            for (i = 0; i < ships.length; i++) {
                visible1 = (((ships[i] === target) && _hudSectionIsVisible(HUDSection.TARGET_INDICATOR)) ||
                        ((ships[i] !== target) && _hudSectionIsVisible(HUDSection.SHIP_INDICATORS)) &&
                        craft.isInSensorRange(ships[i]));
                transmissionSource = (ships[i] === _messageSource);
                // targeting reticle at the ship position
                if (_shipIndicators.length <= i) {
                    _shipIndicators.push(_createShipIndicator());
                    _shipIndicators[i].addToScene(_battleScene);
                }
                targetPosition = ships[i].getPhysicalPositionVector();
                indicator = _shipIndicators[i];
                indicator.setPosition(targetPosition);
                targetIsHostile = ships[i].isHostile(craft);
                shipWidth = ships[i].getVisualModel().updateVisibleSize({camera: _battleScene.getCamera()}, true).width * _shipIndicatorSizeFactor;
                shipIndicatorMinSize = (ships[i] === target) ? _shipIndicatorSizes.targetMinimum : _shipIndicatorSizes.minimum;
                shipIndicatorSize = [
                    Math.min(Math.max(shipIndicatorMinSize[0], shipWidth), _shipIndicatorSizes.maximum[0]),
                    Math.min(Math.max(shipIndicatorMinSize[1], shipWidth), _shipIndicatorSizes.maximum[1])
                ];
                colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).colors;
                if (transmissionSource) {
                    indicator.setColor(colors.transmission);
                }
                // current target
                if (ships[i] === target) {
                    if (!transmissionSource) {
                        indicator.setColor(
                                (targetIsHostile ?
                                        ((newHostilesPresent && (_newHostiles.indexOf(ships[i]) >= 0)) ?
                                                utils.getMixedColor(colors.hostileTarget, colors.newHostile, animationProgress) :
                                                colors.hostileTarget) :
                                        colors.friendlyTarget));
                    }
                    // scaling according to the target switch animation
                    if (_targetSwitchTime > 0) {
                        indicator.setSize(vec.scaled2(shipIndicatorSize, 1 + (_targetIndicatorSwitchScale - 1) * targetSwitchAnimationProgress));
                    } else {
                        indicator.setSize(shipIndicatorSize);
                    }
                } else {
                    // ships other than the target
                    if (!transmissionSource) {
                        indicator.setColor((newHostilesPresent && (_newHostiles.indexOf(ships[i]) >= 0)) ?
                                newHostileColor :
                                ((highlightedShips.indexOf(ships[i]) >= 0) ?
                                        (targetIsHostile ? hostileColor : friendlyColor) :
                                        (targetIsHostile ? colors.hostile : colors.friendly)));
                    }
                    indicator.setSize(shipIndicatorSize);
                }
                if (visible1) {
                    indicator.show();
                } else {
                    indicator.hide();
                }
                // ship indicating arrow, if ship target is not visible on the screen
                if (_shipArrows.length <= i) {
                    _shipArrows.push(_createShipArrow());
                    _shipArrows[i].addToScene(_battleScene);
                }
                direction = mat.getRowD4(mat.prod34Aux(ships[i].getPhysicalPositionMatrix(), _battleScene.getCamera().getViewMatrix(), _battleScene.getCamera().getProjectionMatrix()));
                behind = direction[3] < 0;
                vec.normalize4D(direction);
                indicator = _shipArrows[i];
                if (behind || (direction[0] < -1) || (direction[0] > 1) || (direction[1] < -1) || (direction[1] > 1)) {
                    if (visible1) {
                        indicator.show();
                    } else {
                        indicator.hide();
                    }
                    direction[0] *= aspect;
                    vec.normalize2(direction);
                    if (behind) {
                        vec.negate2(direction);
                    }
                    arrowPositionRadius = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW_POSITION_RADIUS) * (utils.yScalesWithHeight(_centerCrosshairScaleMode, canvas.width, canvas.height) ? (1 / aspect) : 1);
                    indicator.setPosition(vec.scaled2([direction[0], direction[1] * aspect], arrowPositionRadius));
                    indicator.setAngle(Math.acos(direction[1]) * ((direction[0] < 0) ? -1 : 1));
                    colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).colors;
                    if (transmissionSource) {
                        indicator.setColor(colors.transmission);
                    }
                    // current target
                    if (ships[i] === target) {
                        if (!transmissionSource) {
                            indicator.setColor(
                                    (targetIsHostile ?
                                            ((newHostilesPresent && (_newHostiles.indexOf(ships[i]) >= 0)) ?
                                                    utils.getMixedColor(colors.hostileTarget, colors.newHostile, animationProgress) :
                                                    colors.hostileTarget) :
                                            colors.friendlyTarget));
                        }
                        // scaling according to the target switch animation
                        if (_targetSwitchTime > 0) {
                            indicator.setSize(vec.scaled2(_shipArrowSizes.target, 1 + (_targetArrowSwitchScale - 1) * targetSwitchAnimationProgress));
                        } else {
                            indicator.setSize(_shipArrowSizes.target);
                        }
                        _distanceTextLayer.hide();
                    } else {
                        // ships other than the target
                        if (!transmissionSource) {
                            indicator.setColor((newHostilesPresent && (_newHostiles.indexOf(ships[i]) >= 0)) ?
                                    newHostileArrowColor :
                                    ((highlightedShips.indexOf(ships[i]) >= 0) ?
                                            (targetIsHostile ? hostileArrowColor : friendlyArrowColor) :
                                            (targetIsHostile ? colors.hostile : colors.friendly)));
                        }
                        indicator.setSize(_shipArrowSizes.default);
                    }
                } else {
                    indicator.hide();
                    // if no arrow is displayed for the target, display the distance text next to its reticle
                    if ((ships[i] === target) && visible1) {
                        _distanceText.setText(_getDistanceString(distance));
                        _distanceText.setColor(targetIsHostile ?
                                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DISTANCE_TEXT).colors.hostile :
                                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DISTANCE_TEXT).colors.friendly);
                        // calculate and set the current position for the text box and the text itself
                        height = 0.5 * shipIndicatorSize[1] * (utils.scalesWithWidth(_shipIndicators[i].getScaleMode(), aspect, 1) ? aspect : 1);
                        position2D = [direction[0], direction[1] - height];
                        scalesWithWidth = utils.scalesWithWidth(_distanceText.getBoxLayout().getScaleMode(), aspect, 1);
                        size2D = [_distanceTextBoxLayoutDescriptor.width / (scalesWithWidth ? 1 : aspect), _distanceTextBoxLayoutDescriptor.height * (scalesWithWidth ? aspect : 1)];
                        _distanceText.getBoxLayout().setPosition(
                                position2D[0] + size2D[0] * 0.5,
                                position2D[1] - size2D[1] * 0.5);
                        _distanceText.invalidateLayout();
                        _distanceText.setPosition([
                            position2D[0] + size2D[0] * 0.05,
                            position2D[1] - size2D[1] * 0.95
                        ]);
                        _distanceTextLayer.show();
                        // calculate and set the current position for target hull integrity quick view bar
                        if (!config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ALWAYS_SHOW_TARGET_HULL_BAR_AT_CENTER)) {
                            position2D[1] = direction[1] + height;
                            _targetHullIntegrityQuickViewBar.setPosition([
                                (0.5 + 0.5 * position2D[0]) * canvas.width,
                                (0.5 - 0.5 * (position2D[1] + _targetHullIntegrityQuickViewBarLayout.getClipSpaceHeight() * 1.5)) * canvas.height
                            ]);
                            _targetShieldQuickViewBar.setPosition([
                                (0.5 + 0.5 * position2D[0]) * canvas.width,
                                (0.5 - 0.5 * (position2D[1] + _targetHullIntegrityQuickViewBarLayout.getClipSpaceHeight() * 1.75 + _targetShieldQuickViewBarLayout.getClipSpaceHeight())) * canvas.height
                            ]);
                        }
                        // display missile lock indicators
                        if (lockRatio > 0) {
                            arrowPositionRadius = 0.5 * shipIndicatorSize[1] * config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR_RADIUS) * (utils.yScalesWithHeight(_shipIndicators[i].getScaleMode(), canvas.width, canvas.height) ? (1 / aspect) : 1);
                            if (lockRatio < 1) {
                                // indicators rotate and stay visible while locking
                                _missileLockIndicatorAngle += dt * config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR_ROTATION_SPEED);
                                _missileLockIndicatorBlinkTime = 0;
                            } else {
                                // indicators stay in place and blink while locked
                                _missileLockIndicatorAngle = Math.radians(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR_ANGLE));
                                _missileLockIndicatorBlinkTime = (_missileLockIndicatorBlinkTime + dt / config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR_BLINK_INTERVAL)) % 1;
                            }
                            angle = _missileLockIndicatorAngle;
                            colors = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR).colors;
                            color = (targetIsHostile ? colors.hostileTarget : colors.friendlyTarget);
                            size2D = vec.scaled2(shipIndicatorSize, config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR_SIZE));
                            for (j = 0; j < _missileLockIndicators.length; j++) {
                                indicator = _missileLockIndicators[j];
                                if ((lockRatio < 1) || ((_missileLockIndicatorBlinkTime > 0.25) && (_missileLockIndicatorBlinkTime < 0.75))) {
                                    indicator.setPosition([direction[0] + Math.cos(angle) * arrowPositionRadius, direction[1] + Math.sin(angle) * aspect * arrowPositionRadius]);
                                    indicator.setSize(size2D);
                                    indicator.setAngle(-0.5 * Math.PI - angle);
                                    indicator.setColor(color);
                                    indicator.show();
                                    angle += 2 * Math.PI / config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR_COUNT);
                                } else {
                                    indicator.hide();
                                }
                            }
                            missileLockIndicatorsUpdated = true;
                        }
                    }
                }
                // .....................................................................................................
                // ship status indicators
                // if all (visible) hostile ships are targets, we do not add "destroy" indicators to any of them (instead of adding to all of them)
                // so we count the target ships with "j":
                j = 0;
                while ((j < ships.length) && (!ships[j].isHostile(craft) || (_targets.indexOf(ships[j]) >= 0))) {
                    j++;
                }
                // collect the IDs of all indicators that are valid in this array
                statusIndicators = [];
                if (transmissionSource) {
                    statusIndicators.push("transmission");
                }
                if (_escorts.indexOf(ships[i]) >= 0) {
                    statusIndicators.push("protect");
                }
                if ((j < ships.length) && (_targets.indexOf(ships[i]) >= 0)) {
                    statusIndicators.push("destroy");
                }
                // setting up the indicator(s)
                if ((statusIndicators.length > 0) && visible1) {
                    if (!_shipArrows[i].isVisible()) {
                        // if the ship is on screen, all status indicators are displayed below its indicator reticle
                        scalesWithWidth = utils.scalesWithWidth(_shipIndicators[i].getScaleMode(), aspect, 1);
                        height = 0.5 * shipIndicatorSize[1] * (scalesWithWidth ? aspect : 1);
                        position2D = [direction[0], direction[1] - height];
                        size2D = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).sizes.reticle;
                        size2D = [size2D[0] * 0.5 / (scalesWithWidth ? 1 : aspect), size2D[1] * 0.5 * (scalesWithWidth ? aspect : 1)];
                        for (j = 0; j < statusIndicators.length; j++) {
                            if (_shipStatusIndicators.length <= statusCount) {
                                _shipStatusIndicators.push(_createShipStatusIndicator(statusIndicators[j]));
                                _shipStatusIndicators[statusCount].addToScene(_battleScene);
                            }
                            indicator = _shipStatusIndicators[statusCount];
                            statusCount++;
                            indicator.setColor(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).colors[statusIndicators[j]] || _shipIndicators[i].getColor());
                            indicator.setScaleMode(_shipIndicators[i].getScaleMode());
                            indicator.setSize(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).sizes.reticle);
                            indicator.setPosition([
                                position2D[0] - size2D[0] * (1.2 + 2.1 * (statusIndicators.length - 1 - j)),
                                position2D[1] - size2D[1] * 1.2
                            ]);
                            indicator.setTextureCoordinates(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).mappings[statusIndicators[j]]);
                            indicator.show();
                        }
                    } else {
                        // if the ship is not on screen, the first status indicator is displayed next to its indicator arrow
                        if (_shipStatusIndicators.length <= statusCount) {
                            _shipStatusIndicators.push(_createShipStatusIndicator(statusIndicators[0]));
                            _shipStatusIndicators[statusCount].addToScene(_battleScene);
                        }
                        indicator = _shipStatusIndicators[statusCount];
                        statusCount++;
                        indicator.setColor(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).colors[statusIndicators[0]] || _shipArrows[i].getColor());
                        indicator.setScaleMode(_shipArrows[i].getScaleMode());
                        indicator.setSize(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).sizes.arrow);
                        indicator.setPosition(vec.scaled2([direction[0], direction[1] * aspect], (config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW_POSITION_RADIUS) + _shipArrows[i].getScale()[0] * 1.5) * (utils.yScalesWithHeight(_centerCrosshairScaleMode, canvas.width, canvas.height) ? (1 / aspect) : 1)));
                        indicator.setTextureCoordinates(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_STATUS_INDICATOR).mappings[statusIndicators[0]]);
                        indicator.show();
                    }
                }
            }
            while (i < _shipIndicators.length) {
                _shipIndicators[i].hide();
                _shipArrows[i].hide();
                i++;
            }
            while (statusCount < _shipStatusIndicators.length) {
                _shipStatusIndicators[statusCount].hide();
                statusCount++;
            }
            _battleScene.showUI();
        } else {
            // if there is no followed spacecraft
            if (_isHUDVisible) {
                _bigHeaderText.show();
            } else {
                _bigHeaderText.hide();
            }
            _subheaderText.hide();
            _scoreText.hide();
            _battleScene.hideUI();
            _targetScene.clearNodes(true);
            _targetViewItem = null;
            _targetViewModel = null;
            _targetInfoTextLayer.hide();
            _speedTextLayer.hide();
            _flightModeIndicatorTextLayer.hide();
            _missileInfoTextLayer.hide();
            _missileIndicatorTextLayer.hide();
            _objectivesTextLayer.hide();
            _escortsTextLayer.hide();
            _messageTextLayer.hide();
            _messageTypeSound.stopPlaying(HUD_MESSAGE_APPEAR_SOUND_STOP_RAMP_DURATION);
            _distanceTextLayer.hide();
            _wingmenStatusTextLayer.hide();
        }
        _shipIndicatorHighlightTime = (_shipIndicatorHighlightTime + dt) % _shipIndicatorHighlightAnimationInterval;
        if (!missileLockIndicatorsUpdated) {
            _missileLockIndicatorAngle = Math.radians(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCK_INDICATOR_ANGLE));
            _missileLockIndicatorBlinkTime = 0;
            for (i = 0; i < _missileLockIndicators.length; i++) {
                _missileLockIndicators[i].hide();
            }
        }
    };
    /**
     * @param {ObjectiveWithState} object Information about a mission objective
     * @returns {Boolean} Whether the objective is completed
     */
    function _mapObjectiveState(object) {
        return object.state === ObjectiveState.COMPLETED;
    }
    /**
     * Sets up and navigates to the debriefing screen according to the current state of the mission.
     */
    function _goToDebriefing() {
        var
                /**@type Boolean*/ victory, isRecord = false,
                /**@type Spacecraft*/ craft,
                /**@type Number*/ hitRatio,
                /**@type Object*/ perfStats,
                /**@type MissionDescriptor */ missionDescriptor;
        if (_multi) {
            game.setScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME);
            networking.leaveGame();
            return;
        }
        craft = _mission.getPilotedSpacecraft();
        victory = _mission.getState() === missionEvents.MissionState.COMPLETED;
        hitRatio = craft ? craft.getHitRatio() : 0;
        // calculating score from base score and bonuses
        perfStats = craft ? _mission.getPerformanceStatistics() : {};
        if (_missionSourceFilename) {
            missionDescriptor = missions.getMissionDescriptor(_mission.getName());
            // NONE state mission playthrough count is increased right when the mission starts
            if (_mission.getState() !== missionEvents.MissionState.NONE) {
                missionDescriptor.increasePlaythroughCount(victory);
            }
            if (victory && !missionDescriptor.isCustom()) {
                // updating the record if needed
                isRecord = missionDescriptor.updateBestScore(perfStats.score, perfStats.performance);
                analytics.sendEvent("score", [utils.getFilenameWithoutExtension(_missionSourceFilename)], {difficulty: _difficulty, score: perfStats.score});
            }
        }
        game.getScreen(armadaScreens.DEBRIEFING_SCREEN_NAME).setData({
            missionState: _mission.getState(),
            objectives: _mission.getObjectives(),
            objectivesCompleted: _mission.getObjectivesState(true).map(_mapObjectiveState),
            performance: victory ? perfStats.performance : missions.FAILED_MISSION_PERFORMACE,
            nextPerformance: victory ? perfStats.nextPerformance : null,
            nextPerformanceScore: victory ? perfStats.nextPerformanceScore : 0,
            score: victory ? perfStats.score : 0,
            isRecord: isRecord,
            elapsedTime: _elapsedTime,
            kills: craft ? craft.getKills() : 0,
            damageDealt: craft ? Math.round(craft.getDamageDealt()) : 0,
            baseScore: perfStats.baseScore || 0,
            hitRatio: hitRatio,
            hitRatioBonus: perfStats.hitRatioBonus,
            missileDamageDealt: craft ? Math.round(craft.getMissileDamageDealt()) : 0,
            missilesLaunched: craft ? Math.round(craft.getMissilesLaunched()) : 0,
            missilesHit: craft ? Math.round(craft.getMissileHitsOnEnemies()) : 0,
            hullIntegrity: craft ? craft.getHullIntegrity() : 0,
            hullIntegrityBonus: perfStats.hullIntegrityBonus,
            teamSurvival: perfStats.teamSurvival,
            teamSurvivalBonus: perfStats.teamSurvivalBonus,
            nextMissionName: victory ? _mission.getNextMissionName() : null
        });
        game.setScreen(armadaScreens.DEBRIEFING_SCREEN_NAME);
    }
    /**
     * @override
     * @param {Number} dt
     */
    BattleScreen.prototype._render = function (dt) {
        var
                /**@type Boolean*/ victory,
                /**@type Spacecraft*/ craft,
                /**@type Number */ time,
                /**@type Object */ analyticsParams,
                /**@type ModelDebugStats*/ mainStats, shadowStats;
        // if we are using the RequestAnimationFrame API for the rendering loop, then the simulation
        // is performed right before each render and not in a separate loop for best performance
        if (_simulationLoop === LOOP_REQUESTANIMFRAME) {
            _simulationLoopFunction();
        }
        if (_battleScene) {
            // manually updating the camera so the HUD update has up-to-date information
            _battleScene.getCamera().update((_simulationLoop !== LOOP_CANCELED) ? dt : 0);
            this._updateHUD(dt);
        }
        screens.HTMLScreenWithCanvases.prototype._render.call(this, dt);
        if (_battleScene) {
            if (application.isDebugVersion()) {
                mainStats = _battleScene.getMainDebugStats();
                shadowStats = _battleScene.getShadowMapDebugStats();
                if (this._stats.isVisible()) {
                    this._stats.setContent(
                            missions.getDebugInfo() + "<br/>" +
                            sceneGraph.getDebugInfo() + "<br/>" +
                            mat.getMatrixCount() + " <br/>" +
                            this.getFPSStats() + "<br/>" +
                            (mainStats ? (mainStats.triangleDrawCalls + ": " + mainStats.triangles + " + i: " + mainStats.instancedTriangleDrawCalls + ": " + mainStats.instancedTriangles) : "") + "<br/>" +
                            (shadowStats ? (shadowStats.triangleDrawCalls + ": " + shadowStats.triangles) : ""));
                }
                mat.clearMatrixCount();
            } else {
                if (this._stats.isVisible()) {
                    this._stats.setTextContent(this.getFPSStats());
                }
            }
        }
        // displaying the victory or defeat message
        if ((_simulationLoop !== LOOP_CANCELED)) {
            if (!_demoMode) {
                craft = _mission.getPilotedSpacecraft();
                if (craft && craft.isAlive() && craft.isAway()) {
                    if (_timeSincePlayerLeft > config.getSetting(config.BATTLE_SETTINGS.QUIT_DELAY_AFTER_JUMP_OUT)) {
                        _goToDebriefing();
                    } else {
                        _timeSincePlayerLeft += dt;
                    }
                    return;
                }
                // we wait a little after the state changes to victory or defeat so that incoming projectiles destroying the player's ship
                // right after it destroyed the last enemy can change the state from victory to defeat
                if (_mission && (_displayedMissionState !== _mission.getState())) {
                    _displayedMissionState = _mission.getState();
                    _timeSinceGameStateChanged = 0;
                } else if (_timeSinceGameStateChanged < config.getSetting(config.BATTLE_SETTINGS.GAME_STATE_DISPLAY_DELAY)) {
                    _timeSinceGameStateChanged += dt;
                    if (_timeSinceGameStateChanged >= config.getSetting(config.BATTLE_SETTINGS.GAME_STATE_DISPLAY_DELAY)) {
                        victory = _mission.getState() === missionEvents.MissionState.COMPLETED;
                        time = Math.round(_elapsedTime / 1000);
                        if (_missionSourceFilename && !missions.getMissionDescriptor(_mission.getName()).isCustom()) {
                            analyticsParams = {difficulty: _difficulty, time: time};
                            if (_analyticsState) {
                                if (_analyticsState.win) {
                                    analyticsParams.prevwin = true;
                                } else {
                                    analyticsParams.prevlose = true;
                                }
                                analyticsParams.prevdifficulty = _analyticsState.difficulty;
                                analyticsParams.prevtime = _analyticsState.time;
                            }
                            analytics.sendEvent(victory ? "win" : "lose", [utils.getFilenameWithoutExtension(_missionSourceFilename)], analyticsParams);
                            _analyticsState = {
                                win: victory,
                                difficulty: _difficulty,
                                time: time
                            };
                        }
                        if (craft && craft.isAlive()) {
                            this.queueHUDMessage({
                                text: strings.get(victory ? strings.BATTLE.MESSAGE_VICTORY : strings.BATTLE.MESSAGE_FAIL),
                                queue: MISSION_QUEUE,
                                permanent: true
                            }, true);
                        } else {
                            if (_multi) {
                                // if we die in a multiplayer match, switch to spectator mode instead of showing the
                                // death dialog popup
                                // first, try to switch to a new spacecraft, if there are none, switch to free camera
                                if (!_battleScene.getCamera().followNextNode()) {
                                    control.switchToSpectatorMode(true, true);
                                }
                            } else {
                                this.pauseBattle(false, false, true);
                                armadaScreens.openDialog({
                                    header: strings.get(strings.BATTLE.MESSAGE_DEFEAT_HEADER),
                                    message: strings.get(strings.BATTLE.MESSAGE_DEFEAT_MESSAGE),
                                    buttons: [{
                                            caption: strings.get(strings.BATTLE.MESSAGE_DEFEAT_DEBRIEFING),
                                            action: _goToDebriefing
                                        }, {
                                            caption: strings.get(strings.BATTLE.MESSAGE_DEFEAT_RESTART),
                                            action: function () {
                                                game.closeSuperimposedScreen();
                                                this.startNewBattle({
                                                    restart: true
                                                });
                                            }.bind(this)
                                        }, {
                                            caption: strings.get(strings.BATTLE.MESSAGE_DEFEAT_SPECTATE),
                                            action: function () {
                                                game.closeSuperimposedScreen();
                                                this.resumeBattle();
                                            }.bind(this)
                                        }],
                                    onClose: function () {
                                        this.resumeBattle();
                                    }.bind(this)
                                });
                            }
                        }
                        audio.playMusic(
                                (victory ? VICTORY_THEME : DEFEAT_THEME),
                                (victory ? AMBIENT_THEME : null),
                                config.getSetting(config.BATTLE_SETTINGS.END_THEME_CROSSFADE_DURATION));
                    }
                }
                if (_multi && networking.isHost()) {
                    if (_mission && _mission.noHostilesPresent()) {
                        _timeSinceMultiMatchEnded += dt;
                        if (_timeSinceMultiMatchEnded >= config.getSetting(config.BATTLE_SETTINGS.MULTI_MATCH_QUIT_DELAY)) {
                            game.setScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME);
                            networking.concludeMatch();
                        }
                    }
                }
            } else {
                if (_mission && (_displayedMissionState !== _mission.getState())) {
                    _displayedMissionState = _mission.getState();
                    if (_displayedMissionState === missionEvents.MissionState.ENDED) {
                        audio.playMusic(AMBIENT_THEME);
                    }
                }
            }
        }
    };
    /**
     * @private
     * @param {Mission} mission
     */
    BattleScreen.prototype._startBattle = function (mission) {
        var missionDescriptor, custom, anticipationMusicNames, anticipationMusic, anticipationMusicIndex, combatMusicNames, combatMusic, combatMusicIndex, i, canvas, shadows;
        canvas = this.getScreenCanvas(BATTLE_CANVAS_ID).getCanvasElement();
        _mission = mission;
        _targets = _mission.getTargetSpacecrafts();
        _escorts = _mission.getEscortedSpacecrafts();
        if (_missionSourceFilename) {
            missionDescriptor = missions.getMissionDescriptor(_mission.getName());
            custom = missionDescriptor.isCustom();
            // for missions that are already won or lost at the very beginning (no enemies / controlled craft), we do not display the
            // victory / defeat message
            if (!_demoMode) {
                if ((!_mission.getPilotedSpacecraft() || (_mission.getState() === missionEvents.MissionState.NONE))) {
                    missionDescriptor.increasePlaythroughCount(true);
                }
                if (!custom) {
                    _analyticsState = null;
                    analytics.sendEvent("start", [utils.getFilenameWithoutExtension(_missionSourceFilename)], {difficulty: _difficulty});
                } else {
                    analytics.sendEvent("customstart");
                }
            }
        } else {
            custom = true;
        }
        _displayedMissionState = _mission.getState();
        _timeSinceGameStateChanged = config.getSetting(config.BATTLE_SETTINGS.GAME_STATE_DISPLAY_DELAY);
        _timeSinceMultiMatchEnded = 0;
        _timeSincePlayerLeft = 0;
        this._updateLoadingStatus(strings.get(strings.BATTLE.LOADING_BOX_BUILDING_SCENE), LOADING_BUILDING_SCENE_PROGRESS);
        shadows = graphics.isShadowMappingEnabled();
        if (_mission.hasShadows()) {
            graphics.setShadowMapping();
        } else {
            graphics.setShadowMapping(false, false);
        }
        if (shadows !== graphics.isShadowMappingEnabled()) {
            graphics.handleSettingsChanged();
        }
        if (graphics.shouldUseShadowMapping()) {
            graphics.getShadowMappingShader();
        }
        if (graphics.isAnaglyphRenderingEnabled()) {
            graphics.getAnaglyphRedShader();
            graphics.getAnaglyphCyanShader();
        }
        if (graphics.isSideBySideRenderingEnabled()) {
            graphics.getSideBySideLeftShader();
            graphics.getSideBySideRightShader();
        }
        if (graphics.isShadowMapDebuggingEnabled()) {
            graphics.getShadowMapDebugShader();
        }
        _battleScene = new sceneGraph.Scene(
                0, 0, 1, 1,
                true, [true, true, true, true],
                [0, 0, 0, 1], true,
                graphics.getLODContext(),
                graphics.getMaxDirLights(),
                graphics.getMaxPointLights(),
                graphics.getMaxSpotLights(),
                {
                    useVerticalValues: config.getSetting(config.GENERAL_SETTINGS.USE_VERTICAL_CAMERA_VALUES),
                    viewDistance: config.getSetting(config.BATTLE_SETTINGS.VIEW_DISTANCE),
                    fov: INITIAL_CAMERA_FOV,
                    span: INITIAL_CAMERA_SPAN,
                    transitionDuration: config.getSetting(config.BATTLE_SETTINGS.CAMERA_DEFAULT_TRANSITION_DURATION),
                    transitionStyle: config.getSetting(config.BATTLE_SETTINGS.CAMERA_DEFAULT_TRANSITION_STYLE)
                });
        // we manually update the camera separately before the HUD rendering to make sure it is up-to-date
        _battleScene.setShouldUpdateCamera(false);
        _targetScene = new sceneGraph.Scene(
                _targetViewLayout.getPositiveLeft(canvas.width, canvas.height),
                _targetViewLayout.getPositiveBottom(canvas.width, canvas.height),
                _targetViewLayout.getPositiveWidth(canvas.width, canvas.height),
                _targetViewLayout.getPositiveHeight(canvas.width, canvas.height),
                false, [true, true, true, true],
                [0, 0, 0, 0], true,
                graphics.getLODContext(),
                0,
                0,
                0,
                {
                    useVerticalValues: config.getSetting(config.GENERAL_SETTINGS.USE_VERTICAL_CAMERA_VALUES),
                    viewDistance: config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_VIEW_DISTANCE),
                    fov: config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_FOV),
                    span: config.getSetting(config.CAMERA_SETTINGS.DEFAULT_SPAN),
                    transitionDuration: config.getSetting(config.BATTLE_SETTINGS.CAMERA_DEFAULT_TRANSITION_DURATION),
                    transitionStyle: config.getSetting(config.BATTLE_SETTINGS.CAMERA_DEFAULT_TRANSITION_STYLE)
                },
                false);
        _targetScene.getCamera().moveToPosition([0, 0, config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_CAMERA_DISTANCE)], 0);
        _mission.addToScene(_battleScene, _targetScene);
        _addHUDToScene();
        _hudSectionStates = new Array(Object.keys(HUDSection).length);
        for (i = 0; i < _hudSectionStates.length; i++) {
            _hudSectionStates[i] = HUDSectionState.VISIBLE;
        }
        _hudHighlightTime = 0;
        _shipIndicatorHighlightTime = 0;
        this._addUITexts();
        _messageQueues = _messageQueues || {};
        this.clearHUDMessageQueues();
        _mission.onTeamsChanged(_refreshWingmanStatusPanel);
        // initializing music
        audio.initMusic(config.getSetting(config.BATTLE_SETTINGS.AMBIENT_MUSIC), AMBIENT_THEME, true);
        // choose the anticipation music track
        anticipationMusicNames = config.getSetting(config.BATTLE_SETTINGS.ANTICIPATION_MUSIC);
        // check if there is a specific track given for the mission
        anticipationMusic = _mission.getAnticipationTheme();
        if (anticipationMusic) {
            // check if the specific track is also listed among the general anticipation tracks (if so, it might already be loaded)
            anticipationMusicIndex = anticipationMusicNames.indexOf(anticipationMusicNames);
        } else {
            // choose a track randomly, if no specific one was given
            anticipationMusicIndex = Math.min(Math.floor(Math.random() * anticipationMusicNames.length), anticipationMusicNames.length - 1);
            anticipationMusic = anticipationMusicNames[anticipationMusicIndex];
        }
        // set the theme ID based on whether it is a listed or custom combat theme
        _anticipationTheme = (anticipationMusicIndex >= 0) ? ANTICIPATION_THEME_PREFIX + anticipationMusicIndex : anticipationMusic;
        // choose the combat music track
        combatMusicNames = config.getSetting(config.BATTLE_SETTINGS.COMBAT_MUSIC);
        // check if there is a specific track given for the mission
        combatMusic = _mission.getCombatTheme();
        if (combatMusic) {
            // check if the specific track is also listed among the general combat tracks (if so, it might already be loaded)
            combatMusicIndex = combatMusicNames.indexOf(combatMusic);
        } else {
            // choose a track randomly, if no specific one was given
            combatMusicIndex = Math.min(Math.floor(Math.random() * combatMusicNames.length), combatMusicNames.length - 1);
            combatMusic = combatMusicNames[combatMusicIndex];
        }
        // set the theme ID based on whether it is a listed or custom combat theme
        _combatTheme = (combatMusicIndex >= 0) ? COMBAT_THEME_PREFIX + combatMusicIndex : combatMusic;
        // load the selected music, associating it with the selected theme ID
        audio.initMusic(anticipationMusic, _anticipationTheme, true);
        audio.initMusic(combatMusic, _combatTheme, true);
        audio.initMusic(config.getSetting(config.BATTLE_SETTINGS.VICTORY_MUSIC), VICTORY_THEME, false);
        audio.initMusic(config.getSetting(config.BATTLE_SETTINGS.DEFEAT_MUSIC), DEFEAT_THEME, false);
        audio.initMusic(config.getSetting(config.BATTLE_SETTINGS.DEBRIEFING_VICTORY_MUSIC), armadaScreens.DEBRIEFING_VICTORY_THEME, true);
        audio.initMusic(config.getSetting(config.BATTLE_SETTINGS.DEBRIEFING_DEFEAT_MUSIC), armadaScreens.DEBRIEFING_DEFEAT_THEME, true);
        control.getController(control.GENERAL_CONTROLLER_NAME).setMission(_mission);
        control.getController(control.GENERAL_CONTROLLER_NAME).setBattle(_battle);
        control.getController(control.CAMERA_CONTROLLER_NAME).setControlledCamera(_battleScene.getCamera());
        this._updateLoadingStatus(strings.get(strings.LOADING.RESOURCES_START), LOADING_RESOURCES_START_PROGRESS);
        resources.executeOnResourceLoad(this._updateLoadingBoxForResourceLoad.bind(this));
        resources.executeWhenReady(function () {
            _battleScene.setShadowMapping(_mission.hasShadows() ? graphics.getShadowMappingSettings() : null);
            if (graphics.isAnaglyphRenderingEnabled()) {
                _battleScene.setAnaglyphRendering(graphics.getAnaglyphRenderingSettings());
            }
            if (graphics.isSideBySideRenderingEnabled()) {
                _battleScene.setSideBySideRendering(graphics.getSideBySideRenderingSettings());
            }
            if (graphics.isShadowMapDebuggingEnabled()) {
                _battleScene.setupShadowMapDebugging(graphics.getShadowMapDebuggingSettings());
            }
            this._updateLoadingStatus(strings.get(strings.LOADING.INIT_WEBGL), LOADING_INIT_WEBGL_PROGRESS);
            utils.executeAsync(function () {
                this.setAntialiasing(graphics.getAntialiasing());
                this.setFiltering(graphics.getFiltering());
                this.clearSceneCanvasBindings();
                this.bindSceneToCanvas(_battleScene, this.getScreenCanvas(BATTLE_CANVAS_ID));
                this.bindSceneToCanvas(_targetScene, this.getScreenCanvas(BATTLE_CANVAS_ID));
                _targetScene.clearNodes(true);
                this._updateLoadingStatus(strings.get(strings.LOADING.READY), 100);
                application.log("Game data loaded in " + ((performance.now() - _loadingStartTime) / 1000).toFixed(3) + " seconds!", 1);
                _smallHeaderText.setText(strings.get(strings.BATTLE.DEVELOPMENT_VERSION_NOTICE), {version: application.getVersion()});
                document.body.classList.remove("wait");
                control.switchToSpectatorMode(false, true);
                this.setHeaderContent(custom ?
                        _mission.getTitle() || (_missionSourceFilename && utils.getFilenameWithoutExtension(_missionSourceFilename)) || _mission.getName() :
                        strings.get(strings.MISSION.PREFIX, utils.getFilenameWithoutExtension(_missionSourceFilename) + strings.MISSION.NAME_SUFFIX.name));
                _battleCursor = document.body.style.cursor;
                if (!_multi) {
                    this.showMessage(utils.formatString(strings.get(strings.BATTLE.MESSAGE_READY), {
                        menuKey: _getMenuKeyHTMLString()
                    }), undefined, true);
                }
                _mission.applyToSpacecrafts(function (craft) {
                    craft.addEventHandler(SpacecraftEvents.FIRED, _handleSpacecraftFired.bind(craft));
                    if (craft === _mission.getPilotedSpacecraft()) {
                        craft.addEventHandler(SpacecraftEvents.JUMP_ENGAGED, _handlePilotedSpacecraftJumpEngaged.bind(craft));
                        craft.addEventHandler(SpacecraftEvents.JUMP_CANCELLED, _handlePilotedSpacecraftJumpCancelled.bind(craft));
                        craft.addEventHandler(SpacecraftEvents.PREPARING_JUMP, _handlePilotedSpacecraftPreparingJump.bind(craft));
                        craft.addEventHandler(SpacecraftEvents.HUD, _handleHUDEvent.bind(craft));
                    } else {
                        craft.addEventHandler(SpacecraftEvents.JUMP_OUT_STARTED, _handleSpacecraftJumpOutStarted.bind(craft));
                        craft.addEventHandler(SpacecraftEvents.ARRIVED, _handleSpacecraftArrived.bind(craft));
                    }
                });
                _missileLoadedSound = resources.getSoundEffect(
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOADED_SOUND).name).createSoundClip(
                        resources.SoundCategory.SOUND_EFFECT,
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOADED_SOUND).volume);
                _missileLockingSoundsPlayed = 0;
                _missileLockingSound = resources.getSoundEffect(
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCKING_SOUND).name).createSoundClip(
                        resources.SoundCategory.SOUND_EFFECT,
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCKING_SOUND).volume);
                _missileLockedSound = resources.getSoundEffect(
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCKED_SOUND).name).createSoundClip(
                        resources.SoundCategory.SOUND_EFFECT,
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCKED_SOUND).volume);
                _messageSound = resources.getSoundEffect(
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_SOUND).name).createSoundClip(
                        resources.SoundCategory.SOUND_EFFECT,
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_SOUND).volume);
                _messageTypeSound = resources.getSoundEffect(
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_TYPE_SOUND).name).createSoundClip(
                        resources.SoundCategory.SOUND_EFFECT,
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_TYPE_SOUND).volume,
                        true);
                _newHostilesAlertSound = resources.getSoundEffect(
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.NEW_HOSTILES_ALERT_SOUND).name).createSoundClip(
                        resources.SoundCategory.SOUND_EFFECT,
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.NEW_HOSTILES_ALERT_SOUND).volume);
                _connectionWarningSound = resources.getSoundEffect(
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CONNECTION_WARNING_SOUND).name).createSoundClip(
                        resources.SoundCategory.SOUND_EFFECT,
                        config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CONNECTION_WARNING_SOUND).volume);
                if (!_multi) {
                    this._loadingBox.hide();
                } else {
                    this._updateLoadingStatus(strings.get(strings.MULTI_BATTLE.WAITING_FOR_OTHER_PLAYERS));
                    networking.onGameStart(function () {
                        var i, players;
                        this._loadingBox.hide();
                        this.resumeBattle(true);
                        resumeTime();
                        _timeSinceHostUpdate = 0;
                        if (networking.isHost()) {
                            _timeSinceGuestUpdates = [];
                            players = networking.getPlayers();
                            for (i = 0; i < players.length; i++) {
                                _timeSinceGuestUpdates.push(0);
                            }
                        }
                        control.switchToPilotMode(_mission.getPilotedSpacecraft(), true);
                        networking.onGameUpdate(!networking.isHost() ?
                                function (data) {
                                    var i, spacecrafts = _mission.getSpacecrafts();
                                    for (i = 0; i < spacecrafts.length; i++) {
                                        spacecrafts[i].applyMultiHostData(data, i * spacecraft.MULTI_HOST_DATA_LENGTH);
                                    }
                                    _timeSinceHostUpdate = 0;
                                } :
                                function (data) {
                                    _mission.getSpacecrafts()[data[0]].applyMultiGuestData(data);
                                    _timeSinceGuestUpdates[data[0]] = 0;
                                });
                    }.bind(this));
                    networking.onDisconnect(function () {
                        _multi = false;
                        if (game.getScreen() !== _battleScreen) {
                            return;
                        }
                        game.getScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME).updateData();
                        this.showMessage(strings.get(strings.MULTI_GAMES.DISCONNECT_MESSAGE), function () {
                            game.setScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME);
                        });
                    }.bind(this));
                    networking.onHostLeft(function () {
                        _multi = false;
                        game.getScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME).updateData();
                        this.showMessage(utils.formatString(strings.get(strings.MULTI_BATTLE.HOST_LEFT_MESSAGE), {
                            host: networking.getHostName()
                        }), function () {
                            game.setScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME);
                        });
                    }.bind(this));
                    networking.onPlayerLeave(function (player) {
                        var spacecraft;
                        _battleScreen.queueHUDMessage({
                            text: utils.formatString(strings.get(strings.MULTI_BATTLE.PLAYER_LEFT_MESSAGE), {
                                player: player.name
                            })
                        });
                        if (networking.isHost()) {
                            spacecraft = mission.getSpacecraft(player.name);
                            if (spacecraft && spacecraft.isAlive()) {
                                spacecraft.setHullIntegrity(0);
                            }
                        }
                        if (networking.getActivePlayers().length <= 1) {
                            _multi = false;
                            this.showMessage(strings.get(strings.MULTI_BATTLE.ALL_PLAYERS_LEFT_MESSAGE), function () {
                                game.setScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME);
                                networking.leaveGame();
                            });
                        }
                    }.bind(this));
                    networking.onMatchConcluded(function () {
                        game.setScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME);
                    });
                    networking.onGuestTimeout(function () {
                        _multi = false;
                        game.getScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME).updateData();
                        _battleScreen.showMessage(strings.get(strings.MULTI_BATTLE.CONNECTION_TIMEOUT), function () {
                            game.setScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME);
                        });
                    });
                    networking.markLoaded();
                }
                showHUD();
                this.startRenderLoop(1000 / config.getSetting(config.BATTLE_SETTINGS.RENDER_FPS));
                _elapsedTime = 0;
                _timeSinceLastFire = 0;
                _missileLocked = false;
                audio.playMusic(_mission.noHostilesPresent() ? AMBIENT_THEME : _anticipationTheme);
                if (_mission.prepareScene(_battleScene)) {
                    _battleScene.setShouldAnimate(true);
                    for (i = 0; i < PREPARE_SCENE_COUNT; i++) {
                        this._render(PREPARE_SCENE_DT);
                    }
                    _battleScene.setShouldAnimate(false);
                }
            }.bind(this));
        }.bind(this));
        resources.requestResourceLoad();
    };
    /**
     * @typedef {Object} BattleScreen~BattleParams
     * @property {String} [missionSourceFilename] The file to load the mission description data from. Not needed if the battle is being restarted
     * or the mission data is passed directly in the missionData field
     * @property {String} [missionData] The mission description JSON data if passed directly. Otherwise the data will be loaded from file based
     * on the missionSourceFilename field, or reloaded again as the last one when restarting the battle
     * @property {String} [difficulty]  The string ID of the difficulty level to use
     * @property {Boolean} [demoMode] If true, AIs are added to all spacecrafts and the piloted spacecraft is not set, when loading the mission.
     * @property {Boolean} [restart] Whether to restart the same battle that has been loaded last time
     * @property {Boolean} [multi] Whether the game is multiplayer
     */
    /**
     * If a mission description file is given: loads the specified mission description file and sets a callback to create a new game-logic model 
     * and scene for the simulated battle based on the mission description and current settings.
     * If the mission description data is given directly: does all the same loading and setup synchronously.
     * @param {BattleScreen~BattleParams} [params]
     */
    BattleScreen.prototype.startNewBattle = function (params) {
        var canvas;
        _loadingStartTime = performance.now();
        canvas = this.getScreenCanvas(BATTLE_CANVAS_ID).getCanvasElement();
        params = params || {};
        if (params.restart) {
            this.pauseBattle();
        }
        if (params.missionData !== undefined) {
            _missionSourceFilename = null;
            _missionData = params.missionData;
        } else if (params.missionSourceFilename !== undefined) {
            _missionSourceFilename = params.missionSourceFilename;
        }
        if (params.difficulty !== undefined) {
            _difficulty = params.difficulty;
        }
        if (params.demoMode !== undefined) {
            _demoMode = params.demoMode;
        }
        _multi = params.multi;
        spacecraft.setMultiGuest(_multi && !networking.isHost());
        _clearData();
        _chooseTipText();
        document.body.classList.add("wait");
        this._loadingBox.show();
        this.resizeCanvases();
        control.setScreenCenter(
                canvas.width / 2,
                canvas.height / 2);
        this._updateLoadingStatus(strings.get(strings.BATTLE.LOADING_BOX_LOADING_MISSION), 0);
        if (_missionSourceFilename) {
            missions.requestMission(_missionSourceFilename, _difficulty, _demoMode, this._startBattle.bind(this));
        } else {
            this._startBattle(missions.createMission(_missionData, _difficulty, _demoMode));
        }
    };
    /**
     * Requests the pointer to be locked by the canvas element on this screen
     * @param {Boolean} [retry=false] Whether to try again after a short time if locking the pointer fails
     */
    BattleScreen.prototype.requestPointerLock = function (retry) {
        var promise;
        if (control.isPointerLockEnabled() && (document.pointerLockElement !== this.getScreenCanvas(BATTLE_CANVAS_ID).getCanvasElement())) {
            if (_pointerLockTimeout !== -1) {
                clearInterval(_pointerLockTimeout);
                _pointerLockTimeout = -1;
            }
            promise = this.getScreenCanvas(BATTLE_CANVAS_ID).getCanvasElement().requestPointerLock();
            if (promise instanceof Promise) {
                promise.catch(function () {
                    if (retry) {
                        application.log_DEBUG("Pointer lock request failed. Will retry in a short while.");
                        // we need to use timeout to make sure the gesture that initiated
                        // this function (e.g. clicking the "Resume" button) completes
                        // before the pointer lock is requested, otherwise it can be denied
                        // if the user quit from it before
                        _pointerLockTimeout = setTimeout(function () {
                            _pointerLockTimeout = -1;
                            if ((game.getScreen() === this) && control.getInputInterpreter(control.MOUSE_NAME).isEnabled()) {
                                this.requestPointerLock(false);
                            }
                        }.bind(this), POINTER_LOCK_DELAY);
                    }
                }.bind(this));
            }
        }
    };
    // -------------------------------------------------------------------------
    // Initialization
    if (control.isPointerLockSupported()) {
        document.addEventListener("pointerlockchange", function () {
            if (_pointerLockTimeout !== -1) {
                clearInterval(_pointerLockTimeout);
                _pointerLockTimeout = -1;
            }
        });
    }
    // -------------------------------------------------------------------------
    // Caching frequently needed setting values
    config.executeWhenReady(function () {
        // hud
        // see also the activate event handler at the BattleScreen constructor
        _centerCrosshairScaleMode = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.CENTER_CROSSHAIR).scaleMode;
        _speedTargetIndicatorSize = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_TARGET_INDICATOR).size;
        _distanceTextBoxLayoutDescriptor = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DISTANCE_TEXT).layout;
        _targetViewLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_LAYOUT));
        _targetInfoBackgroundLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INFO_BACKGROUND).layout);
        _wingmenStatusBackgroundLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_BACKGROUND).layout);
        _targetHullIntegrityBarLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_BAR).layout);
        _targetShieldBarLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_BAR).layout);
        _speedBarLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SPEED_BAR).layout);
        _missileIndicatorLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INDICATOR).layout);
        _hullIntegrityBarLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.HULL_INTEGRITY_BAR).layout);
        _shieldBarLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIELD_BAR).layout);
        _flightModeIndicatorBackgroundLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_INDICATOR_BACKGROUND).layout);
        _missileInfoBackgroundLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_INFO_BACKGROUND).layout);
        _objectivesBackgroundLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.OBJECTIVES_BACKGROUND).layout);
        _escortsBackgroundLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_BACKGROUND).layout);
        _messageBackgroundLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_BACKGROUND).layout);
        _hudTargetSwitchAnimationDuration = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SWITCH_ANIMATION_DURATION);
        _hudAimAssistAppearAnimationDuration = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_APPEAR_ANIMATION_DURATION);
        _hudHullIntegrityDecreaseAnimationDuration = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.HULL_INTEGRITY_DECREASE_ANIMATION_DURATION);
        _hudShieldDecreaseAnimationDuration = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIELD_DECREASE_ANIMATION_DURATION);
        _hudTargetHullIntegrityDecreaseAnimationDuration = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_DECREASE_ANIMATION_DURATION);
        _hudTargetShieldDecreaseAnimationDuration = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_DECREASE_ANIMATION_DURATION);
        _shipIndicatorHighlightAnimationInterval = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR_HIGHLIGHT_ANIMATION_INTERVAL);
        _shipIndicatorSizes = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR).sizes;
        _shipIndicatorSizeFactor = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_INDICATOR_SIZE_FACTOR);
        _targetIndicatorSwitchScale = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_INDICATOR_SWITCH_SCALE);
        _aimAssistIndicatorSize = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR).size;
        _aimAssistIndicatorAppearScale = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_INDICATOR_APPEAR_SCALE);
        _shipArrowSizes = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHIP_ARROW).sizes;
        _targetArrowSwitchScale = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_ARROW_SWITCH_SCALE);
        _weaponImpactIndicatorSize = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WEAPON_IMPACT_INDICATOR).size;
        _weaponImpactIndicatorSwitchScale = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WEAPON_IMPACT_INDICATOR_SWITCH_SCALE);
        _driftArrowMinSpeed = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW_MIN_SPEED);
        _driftArrowMaxSpeedFactor = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.DRIFT_ARROW_MAX_SPEED_FACTOR);
        _targetHullIntegrityQuickViewBarLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_HULL_INTEGRITY_QUICK_VIEW_BAR).layout);
        _targetShieldQuickViewBarLayout = new screens.ClipSpaceLayout(config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SHIELD_QUICK_VIEW_BAR).layout);
        _escortsIntegrityBarsSettings = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ESCORTS_INTEGRITY_BARS);
        _wingmenStatusCraftIndicatorSettings = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_CRAFT_INDICATOR);
        _wingmenStatusMaxSquadMemberCount = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_CRAFT_POSITIONS).length;
        _messageTextSettings = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MESSAGE_TEXT);
        _missileLockingSoundCount = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.MISSILE_LOCKING_SOUND_COUNT);
        _targetViewParams = {
            shaderName: config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_TARGET_ITEM_SHADER),
            positionMatrix: mat.IDENTITY4,
            orientationMatrix: _targetViewOrientationMatrix,
            skipResources: true
        };
        _hudHighlightInterval = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.HIGHLIGHT_INTERVAL);
        // music
        _combatThemeDurationAfterFire = config.getSetting(config.BATTLE_SETTINGS.COMBAT_THEME_DURATION_AFTER_FIRE) * 1000;
        // multi
        _disconnectThreshold = config.getSetting(config.MULTI_SETTINGS.DISCONNECT_THRESHOLD);
    });
    // initializing anaglyph text rendering if needed
    graphics.executeWhenReady(function () {
        if (graphics.isAnaglyphRenderingEnabled()) {
            screens.setAnaglyphTextRendering(true, graphics.getAnaglyphOriginalColorRatio(), graphics.getAnaglyphCyanFactor(), graphics.getAnaglyphGamma());
        }
    });
    graphics.onSettingsChange(handleGraphicsSettingsChanged);
    // -------------------------------------------------------------------------
    // The public interface of the module
    _battle.getBattleScreen = function () {
        if (!_battleScreen) {
            _battleScreen = new BattleScreen();
            _battle.pauseBattle = _battleScreen.pauseBattle.bind(_battleScreen);
            _battle.resumeBattle = _battleScreen.resumeBattle.bind(_battleScreen);
        }
        return _battleScreen;
    };
    _battle.stopTime = stopTime;
    _battle.resumeTime = resumeTime;
    _battle.toggleTime = toggleTime;
    _battle.showHUD = showHUD;
    _battle.hideHUD = hideHUD;
    _battle.toggleHUDVisibility = toggleHUDVisibility;
    _battle.HUDSection = HUDSection;
    _battle.HUDSectionState = HUDSectionState;
    return _battle;
});