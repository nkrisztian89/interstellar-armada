/**
 * Copyright 2016-2021 Krisztián Nagy
 * @file Augments the general strings module with constants and functions to conveniently access strings in the game and to verify their 
 * presence in the strings files.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 0.1
 */

/*global define */

/**
 * @param strings This module augments the general strings module.
 */
define([
    "modules/strings"
], function (strings) {
    "use strict";
    strings.GRAMMAR = {
        DEFINITE_ARTICLE_BEFORE_VOWEL: {name: "grammar.definiteArticle.beforeVowel"},
        DEFINITE_ARTICLE_BEFORE_CONSONANT: {name: "grammar.definiteArticle.beforeConsonant"},
        AND: {name: "grammar.and"}
    };
    strings.FIRST_RUN_NOTE = {
        HEADER: {name: "firstRunNote.header"},
        MESSAGE: {name: "firstRunNote.message"},
        BUTTON: {name: "firstRunNote.button"}
    };
    strings.RELEASE_NOTES = {
        PREFIX: {name: "releaseNotes.", optional: true},
        HEADER: {name: "releaseNotes.header"},
        GENERAL: {name: "releaseNotes.general"},
        NO_NEWS: {name: "releaseNotes.noNews"},
        BUTTON: {name: "releaseNotes.button"}
    };
    strings.SCREEN = {
        BACK: {name: "screen.back"},
        CANCEL: {name: "screen.cancel"}
    };
    strings.MAIN_MENU = {
        SINGLE_PLAYER: {name: "mainMenu.singlePlayer"},
        MULTIPLAYER: {name: "mainMenu.multiplayer"},
        DATABASE: {name: "mainMenu.database"},
        SETTINGS: {name: "mainMenu.settings"},
        ABOUT: {name: "mainMenu.about"},
        QUIT: {name: "mainMenu.quit"}
    };
    strings.MISSIONS = {
        BACK: {name: "missions.backButton"},
        TITLE: {name: "missions.title"},
        DIFFICULTY: {name: "missions.difficulty"},
        LAUNCH_BUTTON: {name: "missions.launchButton"},
        DEMO_BUTTON: {name: "missions.demoButton"},
        FILE_BUTTON: {name: "missions.fileButton"},
        CUSTOM_MISSION_CAPTION: {name: "missions.customMissionCaption"},
        CUSTOM_MISSION_SUBCAPTION: {name: "missions.customMissionSubcaption"},
        NOT_COMPLETED: {name: "missions.notCompleted"},
        BEST_SCORE: {name: "missions.bestScore"},
        SANDBOX_COMPLETED: {name: "missions.sandboxCompleted"},
        NO_SELECTED_NAME: {name: "missions.noSelectedName"},
        NO_SELECTED_DESCRIPTION: {name: "missions.noSelectedDescription"},
        CUSTOM_DESCRIPTION: {name: "missions.customDescription"},
        LOCATION: {name: "missions.location"},
        CREATED_BY: {name: "missions.createdBy"},
        LOADING_DESCRIPTION: {name: "missions.loadingDescription"},
        NO_TRANSLATED_DESCRIPTION: {name: "missions.noTranslatedDescription"},
        NO_DESCRIPTION: {name: "missions.noDescription"},
        OBJECTIVES_TITLE: {name: "missions.missionObjectivesTitle"},
        SPACECRAFT_TITLE: {name: "missions.playerSpacecraftTitle"},
        SPACECRAFT_DATA: {name: "missions.playerSpacecraftData"},
        SPACECRAFT_WEAPONS: {name: "missions.playerSpacecraftWeapons"},
        SPACECRAFT_MISSILES: {name: "missions.playerSpacecraftMissiles"},
        SPACECRAFT_SHIELD: {name: "missions.playerSpacecraftShield"},
        SPACECRAFT_PROPULSION: {name: "missions.playerSpacecraftPropulsion"},
        OBJECTIVE_SUBJECTS_SQUAD: {name: "missions.objectiveSubjects.squad"},
        OBJECTIVE_SUBJECTS_SQUADS: {name: "missions.objectiveSubjects.squads"},
        OBJECTIVE_SUBJECTS_TEAM: {name: "missions.objectiveSubjects.team"},
        OBJECTIVE_SUBJECTS_TEAMS: {name: "missions.objectiveSubjects.teams"},
        OBJECTIVE_WIN_PREFIX: {name: "missions.winObjective.", optional: true},
        OBJECTIVE_LOSE_PREFIX: {name: "missions.loseObjective.", optional: true}
    };
    strings.MULTI_GAMES = {
        BACK: {name: "multiGames.backButton"},
        TITLE: {name: "multiGames.title"},
        STARTED_YES: {name: "multiGames.started.yes"},
        STARTED_NO: {name: "multiGames.started.no"},
        JOIN_BUTTON: {name: "multiGames.joinButton"},
        DISCONNECT_MESSAGE: {name: "multiGames.disconnectMessage"},
        CANNOT_CONNECT_MESSAGE: {name: "multiGames.cannotConnectMessage"},
        GAME_NOT_FOUND_ERROR: {name: "multiGames.gameNotFoundError"},
        GAME_IS_FULL_ERROR: {name: "multiGames.gameIsFullError"},
        GAME_ALREADY_STARTED_ERROR: {name: "multiGames.gameAlreadyStartedError"},
        PLAYER_NAME_ALREADY_EXISTS_ERROR: {name: "multiGames.playerNameAlreadyExistsError"},
        GAME_NAME_ALREADY_EXISTS_ERROR: {name: "multiGames.gameNameAlreadyExistsError"},
        INVALID_GAME_SETTINGS_ERROR: {name: "multiGames.invalidGameSettingsError"}
    };
    strings.MULTI_LOBBY = {
        GAME_TITLE: {name: "multiLobby.gameTitle"},
        CONNECTION_SERVER: {name: "multiLobby.connection.server"},
        CONNECTION_DIRECT: {name: "multiLobby.connection.direct"},
        READY_YES: {name: "multiLobby.ready.yes"},
        READY_NO: {name: "multiLobby.ready.no"},
        KICK_BUTTON: {name: "multiLobby.kickButton"},
        LOCATION_LABEL: {name: "multiLobby.locationLabel"},
        HOST_LEFT_MESSAGE: {name: "multiLobby.hostLeftMessage"},
        KICKED_MESSAGE: {name: "multiLobby.kickedMessage"},
        PLAYER_JOINED_MESSAGE: {name: "multiLobby.playerJoinedMessage"},
        PLAYER_LEFT_MESSAGE: {name: "multiLobby.playerLeftMessage"},
        PLAYER_READY_MESSAGE: {name: "multiLobby.playerReadyMessage"},
        PLAYER_KICKED_MESSAGE: {name: "multiLobby.playerKickedMessage"}
    };
    strings.OBJECTIVE = {
        DESTROY_ALL_SUFFIX: {name: "destroyAll", optional: true},
        DESTROY_SUFFIX: {name: "destroy", optional: true},
        DESTROY_ONE_SUFFIX: {name: "destroyOne", optional: true},
        DESTROY_ANY_SUFFIX: {name: "destroyAny", optional: true},
        COUNT_BELOW_SUFFIX: {name: "countBelow", optional: true},
        TIME_SUFFIX: {name: "time", optional: true},
        TIME_MULTI_SUFFIX: {name: "timeMulti", optional: true}
    };
    strings.LOCATION = {
        UNKNOWN: {name: "location.unknown"},
        SYSTEM: {name: "location.system"}
    };
    strings.SETTINGS = {
        GENERAL: {name: "settings.general"},
        GRAPHICS: {name: "settings.graphics"},
        AUDIO: {name: "settings.audio"},
        GAMEPLAY: {name: "settings.gameplay"},
        CONTROLS: {name: "settings.controls"},
        DEFAULTS: {name: "settings.defaults"}
    };
    strings.INGAME_MENU = {
        TITLE: {name: "ingameMenu.title"},
        RESUME: {name: "ingameMenu.resume"},
        RESTART: {name: "ingameMenu.restart"},
        RESTART_HEADER: {name: "ingameMenu.restartDialog.header"},
        RESTART_MESSAGE: {name: "ingameMenu.restartDialog.message"},
        RESTART_RESTART: {name: "ingameMenu.restartDialog.restartButton"},
        QUIT: {name: "ingameMenu.quit"},
        QUIT_HEADER: {name: "ingameMenu.quitDialog.header"},
        QUIT_MESSAGE: {name: "ingameMenu.quitDialog.message"},
        QUIT_TO_MISSIONS: {name: "ingameMenu.quitDialog.quitToMissionsButton"},
        QUIT_TO_MAIN_MENU: {name: "ingameMenu.quitDialog.quitToMainMenuButton"}
    };
    strings.INFO_BOX = {
        HEADER: {name: "infoBox.header"},
        OK_BUTTON: {name: "infoBox.okButton"}
    };
    strings.LOADING = {
        HEADER: {name: "loading.header"},
        RESOURCES_START: {name: "loading.resourcesStart"},
        RESOURCE_READY: {name: "loading.resourceReady"},
        INIT_WEBGL: {name: "loading.initWebGL"},
        READY: {name: "loading.ready"}
    };
    strings.SPACECRAFT_STATS = {
        ARMOR: {name: "spacecraftStats.armor"},
        ARMOR_RATING: {name: "spacecraftStats.armorRating"}
    };
    strings.MISSION = {
        PREFIX: {name: "mission.", optional: true},
        NAME_SUFFIX: {name: ".name", optional: true},
        DESCRIPTION_SUFFIX: {name: ".description", optional: true},
        MESSAGES_SUFFIX: {name: ".messages.", optional: true}
    };
    strings.FACTION = {
        PREFIX: {name: "faction.", optional: true}
    };
    strings.SQUAD = {
        PREFIX: {name: "squad.", optional: true}
    };
    strings.BATTLE = {
        DEVELOPMENT_VERSION_NOTICE: {name: "battle.developmentVersionNotice"},
        SPECTATOR_MODE: {name: "battle.spectatorMode"},
        SCORE: {name: "battle.score"},
        HUD_FIREPOWER: {name: "battle.hud.firepower"},
        HUD_DISTANCE: {name: "battle.hud.distance"},
        HUD_VELOCITY: {name: "battle.hud.velocity"},
        HUD_SPACECRAFT_NAME_UNKNOWN: {name: "battle.hud.spacecraftNameUnknown"},
        HUD_TEAM_UNKNOWN: {name: "battle.hud.teamUnknown"},
        HUD_WINGMEN_HEADER: {name: "battle.hud.wingmenHeader"},
        HUD_FLIGHT_MODE: {name: "battle.hud.flightMode"},
        HUD_MISSILES: {name: "battle.hud.missiles"},
        HUD_OBJECTIVES: {name: "battle.hud.objectives"},
        HUD_ESCORTED_SHIPS_HEADER: {name: "battle.hud.escortedShipsHeader"},
        OBJECTIVE_SUBJECTS_SPACECRAFTS: {name: "battle.objectiveSubjects.spacecrafts"},
        OBJECTIVE_SUBJECTS_SQUADS: {name: "battle.objectiveSubjects.squads"},
        OBJECTIVE_SUBJECTS_TEAMS: {name: "battle.objectiveSubjects.teams"},
        OBJECTIVE_WIN_PREFIX: {name: "battle.winObjective.", optional: true},
        OBJECTIVE_LOSE_PREFIX: {name: "battle.loseObjective.", optional: true},
        LOADING_BOX_LOADING_MISSION: {name: "battle.loadingBox.loadingMission"},
        LOADING_BOX_BUILDING_SCENE: {name: "battle.loadingBox.buildingScene"},
        MESSAGE_READY: {name: "battle.message.ready"},
        MESSAGE_PAUSED: {name: "battle.message.paused"},
        MESSAGE_VICTORY: {name: "battle.message.victory"},
        MESSAGE_FAIL: {name: "battle.message.fail"},
        MESSAGE_DEFEAT_HEADER: {name: "battle.message.defeat.header"},
        MESSAGE_DEFEAT_MESSAGE: {name: "battle.message.defeat.message"},
        MESSAGE_DEFEAT_DEBRIEFING: {name: "battle.message.defeat.debriefingButton"},
        MESSAGE_DEFEAT_RESTART: {name: "battle.message.defeat.restartButton"},
        MESSAGE_DEFEAT_SPECTATE: {name: "battle.message.defeat.spectateButton"},
        MESSAGE_JUMP_ENGAGED: {name: "battle.message.jump.engaged"},
        MESSAGE_JUMP_PREPARING: {name: "battle.message.jump.preparing"},
        MESSAGE_NEW_HOSTILES: {name: "battle.message.newHostiles"}
    };
    strings.MULTI_BATTLE = {
        WAITING_FOR_OTHER_PLAYERS: {name: "battle.multi.waitingForOtherPlayers"},
        HOST_LEFT_MESSAGE: {name: "battle.multi.hostLeftMessage"},
        PLAYER_LEFT_MESSAGE: {name: "battle.multi.playerLeftMessage"}
    };
    strings.PERFORMANCE_LEVEL = {
        PREFIX: {name: "performanceLevel.", optional: true}
    };
    strings.DEBRIEFING = {
        BACK: {name: "debriefing.backButton"},
        VICTORY_TITLE: {name: "debriefing.victoryTitle"},
        DEFEAT_TITLE: {name: "debriefing.defeatTitle"},
        GENERIC_TITLE: {name: "debriefing.genericTitle"},
        SCORE: {name: "debriefing.score"},
        NEW_RECORD: {name: "debriefing.newRecord"},
        DESCRIPTION_VICTORY: {name: "debriefing.description.victory"},
        DESCRIPTION_NEXT_PERFORMANCE: {name: "debriefing.description.nextPerformance"},
        DESCRIPTION_FAIL: {name: "debriefing.description.fail"},
        DESCRIPTION_DEFEAT: {name: "debriefing.description.defeat"},
        DESCRIPTION_LEFT_EARLY: {name: "debriefing.description.leftEarly"},
        DESCRIPTION_GENERIC: {name: "debriefing.description.generic"},
        OBJECTIVES_HEADER: {name: "debriefing.objectivesHeader"},
        COMPLETED: {name: "debriefing.completed"},
        FAILED: {name: "debriefing.failed"},
        STATISTICS_HEADER: {name: "debriefing.statisticsHeader"},
        TIME_LABEL_CELL: {name: "debriefing.timeLabelCell"},
        KILLS_LABEL_CELL: {name: "debriefing.killsLabelCell"},
        DAMAGE_LABEL_CELL: {name: "debriefing.damageLabelCell"},
        HIT_RATIO_LABEL_CELL: {name: "debriefing.hitRatioLabelCell"},
        HULL_INTEGRITY_LABEL_CELL: {name: "debriefing.hullIntegrityLabelCell"},
        TEAM_SURVIVAL_LABEL_CELL: {name: "debriefing.teamSurvivalLabelCell"},
        BASE_SCORE_LABEL_CELL: {name: "debriefing.baseScoreLabelCell"},
        HIT_RATIO_BONUS_LABEL_CELL: {name: "debriefing.hitRatioBonusLabelCell"},
        HULL_INTEGRITY_BONUS_LABEL_CELL: {name: "debriefing.hullIntegrityBonusLabelCell"},
        TEAM_SURVIVAL_BONUS_LABEL_CELL: {name: "debriefing.teamSurvivalBonusLabelCell"},
        SCORE_BREAKDOWN_HEADER: {name: "debriefing.scoreBreakdownHeader"},
        RESTART_BUTTON: {name: "debriefing.restartButton"}
    };
    strings.DATABASE = {
        BACK: {name: "database.backButton"},
        TITLE: {name: "database.title"},
        PREV_BUTTON: {name: "database.prevButton"},
        NEXT_BUTTON: {name: "database.nextButton"},
        LOADING_BOX_INITIALIZING: {name: "database.loadingBox.initializing"},
        LENGTH: {name: "database.length"},
        WEAPON_SLOTS: {name: "database.weaponSlots"},
        MISSILE_LAUNCHERS: {name: "database.missileLaunchers"},
        LOCK_RESIST: {name: "database.lockResist"},
        MISSING_SPACECRAFT_TYPE_DESCRIPTION: {name: "database.missingSpacecraftTypeDescription"},
        MISSING_SPACECRAFT_CLASS_DESCRIPTION: {name: "database.missingSpacecraftClassDescription"}
    };
    strings.ABOUT = {
        BACK: {name: "about.backButton"},
        TITLE: {name: "about.title"},
        VERSION_PARAGRAPH: {name: "about.versionParagraph"},
        ABOUT_GAME_PARAGRAPH: {name: "about.aboutGameParagraph"},
        ABOUT_GAME_DEV_PARAGRAPH: {name: "about.aboutGameDevParagraph"},
        LICENSE_NOTE: {name: "about.licenseNote"},
        CREDITS_HEADER: {name: "about.creditsHeader"},
        CREDITS_GAME_DESIGN: {name: "about.creditsGameDesign"},
        CREDITS_PROGRAMMING: {name: "about.creditsProgramming"},
        CREDITS_REQUIREJS_NOTE: {name: "about.creditsRequireJSNote"},
        CREDITS_FONTS: {name: "about.creditsFonts"},
        CREDITS_MODELS: {name: "about.credits3DModels"},
        CREDITS_TEXTURES: {name: "about.creditsTextures"},
        CREDITS_MUSIC: {name: "about.creditsMusic"},
        CREDITS_SFX: {name: "about.creditsSoundEffects"},
        CREDITS_FREESOUND_NOTE: {name: "about.creditsFreesoundNote"},
        CREDITS_OTHER_SOUNDS_NOTE: {name: "about.creditsOtherSoundsNote"},
        CREDITS_SOUND_LICENSE_NOTE: {name: "about.creditsSoundLicenseNote"},
        CREDITS_TESTING: {name: "about.creditsTesting"},
        USED_SOFTWARE_HEADER: {name: "about.usedSoftwareHeader"},
        USED_SOFTWARE_PARAGRAPH: {name: "about.usedSoftwareParagraph"},
        LICENSE_HEADER: {name: "about.licenseHeader"},
        LICENSE_PARAGRAPH: {name: "about.licenseParagraph"},
        REQUIRE_JS_LICENSE: {name: "about.requireJSLicense"},
        HERE: {name: "about.here"}
    };
    strings.SETTING = {
        PREFIX: {name: "setting.", optional: true},
        ON: {name: "setting.on"},
        OFF: {name: "setting.off"},
        VERY_LOW: {name: "setting.veryLow"},
        LOW: {name: "setting.low"},
        MEDIUM: {name: "setting.medium"},
        HIGH: {name: "setting.high"},
        VERY_HIGH: {name: "setting.veryHigh"},
        NORMAL: {name: "setting.normal"},
        MINIMUM: {name: "setting.minimum"},
        MAXIMUM: {name: "setting.maximum"},
        FEW: {name: "setting.few"},
        MANY: {name: "setting.many"},
        EASY: {name: "setting.easy"},
        HARD: {name: "setting.hard"},
        CUSTOM: {name: "setting.custom"}
    };
    strings.GENERAL_SETTINGS = {
        BACK: {name: "generalSettings.backButton"},
        TITLE: {name: "generalSettings.title"},
        LANGUAGE: {name: "generalSettings.language"},
        ANALYTICS: {name: "generalSettings.analytics"},
        ANALYTICS_NOTE: {name: "generalSettings.analyticsNote"}
    };
    strings.GRAPHICS = {
        PREFIX: {name: "graphics.", optional: true},
        BACK: {name: "graphics.backButton"},
        TITLE: {name: "graphics.title"},
        GENERAL_LEVEL: {name: "graphics.generalLevel"},
        ANTIALIASING: {name: "graphics.antialiasing"},
        FILTERING: {name: "graphics.filtering"},
        BILINEAR: {name: "graphics.bilinear"},
        TRILINEAR: {name: "graphics.trilinear"},
        ANISOTROPIC: {name: "graphics.anisotropic"},
        TEXTURE_QUALITY: {name: "graphics.textureQuality"},
        BACKGROUND_QUALITY: {name: "graphics.backgroundQuality"},
        MODEL_DETAILS: {name: "graphics.modelDetails"},
        MISSILES_IN_LAUNCHERS: {name: "graphics.missilesInLaunchers"},
        SHADERS: {name: "graphics.shaders"},
        SHADOWS: {name: "graphics.shadows"},
        SHADOW_QUALITY: {name: "graphics.shadowQuality"},
        SHADOW_DISTANCE: {name: "graphics.shadowDistance"},
        MAX_DYNAMIC_LIGHTS: {name: "graphics.maxDynamicLights"},
        PARTICLE_AMOUNT: {name: "graphics.particleAmount"},
        DUST_PARTICLE_AMOUNT: {name: "graphics.dustParticleAmount"}
    };
    strings.GAMEPLAY_SETTINGS = {
        PREFIX: {name: "gameplaySettings.", optional: true},
        BACK: {name: "gameplaySettings.backButton"},
        TITLE: {name: "gameplaySettings.title"},
        HUD_TITLE: {name: "gameplaySettings.hudTitle"},
        CAMERA_TITLE: {name: "gameplaySettings.cameraTitle"},
        CONTROLS_TITLE: {name: "gameplaySettings.controlsTitle"},
        TARGET_HEALTH_AT_CENTER: {name: "gameplaySettings.targetHealthAtCenter"},
        OFFSET_IMPACT_INDICATORS: {name: "gameplaySettings.offsetImpactIndicators"},
        RELATIVE_TARGET_ORIENTATION: {name: "gameplaySettings.relativeTargetOrientation"},
        PREFERRED_FIGHTER_VIEW: {name: "gameplaySettings.preferredFighterView"},
        PREFERRED_SHIP_VIEW: {name: "gameplaySettings.preferredShipView"},
        DEMO_VIEW_SWITCHING: {name: "gameplaySettings.demoViewSwitching"},
        DEFAULT_SALVO_MODE: {name: "gameplaySettings.defaultSalvoMode"}
    };
    strings.AUDIO = {
        PREFIX: {name: "audio.", optional: true},
        BACK: {name: "audio.backButton"},
        TITLE: {name: "audio.title"},
        MASTER_VOLUME: {name: "audio.masterVolume"},
        MUSIC_VOLUME: {name: "audio.musicVolume"},
        SFX_VOLUME: {name: "audio.sfxVolume"},
        UI_VOLUME: {name: "audio.uiVolume"}
    };
    strings.CONTOLLER = {
        PREFIX: {name: "controller.", optional: true},
        GENERAL: {name: "controller.general"},
        FIGHTER: {name: "controller.fighter"},
        CAMERA: {name: "controller.camera"}
    };
    strings.INPUT = {
        DEVICE_NAME_PREFIX: {name: "inputDevice.", optional: true},
        DEVICE_KEYBOARD: {name: "inputDevice.keyboard"},
        DEVICE_MOUSE: {name: "inputDevice.mouse"},
        DEVICE_JOYSTICK: {name: "inputDevice.joystick"}
    };
    strings.TOUCH_AREA = {
        PREFIX: {name: "touchArea.", optional: true},
        DEFAULT: {name: "touchArea.default"}
    };
    strings.CONTROLS = {
        BACK: {name: "controls.backButton"},
        SETTINGS_TITLE: {name: "controls.settingsTitle"},
        TITLE: {name: "controls.title"},
        MOUSE_TURN_SENSITIVITY: {name: "controls.mouseTurnSensitivity"},
        CONTROLLER_TYPE_HEADING: {name: "controls.controllerHeading"},
        ACTION: {name: "controls.action"}
    };
    strings.ACTION_DESCRIPTIONS = {
        PREFIX: {name: "actionDescriptions.", optional: true}
    };
    strings.SPACECRAFT_CLASS = {
        PREFIX: {name: "spacecraftClass.", optional: true},
        NAME_SUFFIX: {name: ".name", optional: true},
        DESCRIPTION_SUFFIX: {name: ".description", optional: true}
    };
    strings.SPACECRAFT_TYPE = {
        PREFIX: {name: "spacecraftType.", optional: true},
        NAME_SUFFIX: {name: ".name", optional: true},
        DESCRIPTION_SUFFIX: {name: ".description", optional: true}
    };
    strings.WEAPON_CLASS = {
        PREFIX: {name: "weaponClass.", optional: true},
        NAME_SUFFIX: {name: ".name", optional: true},
        DESCRIPTION_SUFFIX: {name: ".description", optional: true}
    };
    strings.MISSILE_CLASS = {
        PREFIX: {name: "missileClass.", optional: true},
        NAME_SUFFIX: {name: ".name", optional: true},
        DESCRIPTION_SUFFIX: {name: ".description", optional: true}
    };
    strings.PROPULSION_CLASS = {
        PREFIX: {name: "propulsionClass.", optional: true},
        NAME_SUFFIX: {name: ".name", optional: true},
        DESCRIPTION_SUFFIX: {name: ".description", optional: true}
    };
    strings.SHIELD_CLASS = {
        PREFIX: {name: "shieldClass.", optional: true},
        NAME_SUFFIX: {name: ".name", optional: true},
        DESCRIPTION_SUFFIX: {name: ".description", optional: true}
    };
    strings.MISSILE_SIZE = {
        PREFIX: {name: "missileSize.", optional: true}
    };
    strings.OBJECT_VIEW = {
        PREFIX: {name: "objectView.", optional: true}
    };
    strings.FLIGHT_MODE = {
        PREFIX: {name: "flightMode.", optional: true}
    };
    strings.TIP = {
        PREFIX: {name: "tip.", optional: true}
    };
    /**
     * Returns whether the passed word start with a vowel (one that is recognized)
     * @param {String} word
     * @returns {Boolean}
     */
    function startsWithVowel(word) {
        var char = word[0].toLowerCase();
        return (char === "a") || (char === "e") || (char === "u") || (char === "i") || (char === "o") ||
                (char === "á") || (char === "é") || (char === "ú") || (char === "ü") || (char === "ű") || (char === "í") || (char === "ó") || (char === "ö") || (char === "ő");
    }
    /**
     * Returns the translated definite article that should be used with the passed (translated) word
     * @param {String} word
     * @returns {String}
     */
    strings.getDefiniteArticleForWord = function (word) {
        return strings.get(startsWithVowel(word) ? strings.GRAMMAR.DEFINITE_ARTICLE_BEFORE_VOWEL : strings.GRAMMAR.DEFINITE_ARTICLE_BEFORE_CONSONANT);
    };
    /**
     * Returns a string that can be used to display the list of the passed translated items in the current language.
     * @param {String[]} items
     * @returns {String}
     */
    strings.getList = function (items) {
        var result, i;
        result = items[0];
        for (i = 1; i < items.length - 1; i++) {
            result += (", " + items[i]);
        }
        if (items.length > 1) {
            result += (" " + strings.get(strings.GRAMMAR.AND) + " " + items[items.length - 1]);
        }
        return result;
    };
    return strings;
});
