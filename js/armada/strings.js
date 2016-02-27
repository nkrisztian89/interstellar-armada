/**
 * Copyright 2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 0.1
 */

/*jslint nomen: true, white: true*/
/*global define */

/**
 * @param strings
 */
define([
    "modules/strings"
], function (strings) {
    "use strict";
    strings.SCREEN = {
        BACK: {name: "screen.back"}
    };
    strings.MAIN_MENU = {
        NEW_GAME: {name: "mainMenu.newGame"},
        DATABASE: {name: "mainMenu.database"},
        SETTINGS: {name: "mainMenu.settings"},
        ABOUT: {name: "mainMenu.about"}
    };
    strings.SETTINGS = {
        GENERAL: {name: "settings.general"},
        GRAPHICS: {name: "settings.graphics"},
        CONTROLS: {name: "settings.controls"},
        DEFAULTS: {name: "settings.defaults"}
    };
    strings.INGAME_MENU = {
        TITLE: {name: "ingameMenu.title"},
        RESUME: {name: "ingameMenu.resume"},
        QUIT: {name: "ingameMenu.quit"}
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
        ARMOR: {name: "spacecraftStats.armor"}
    };
    strings.BATTLE = {
        DEVELOPMENT_VERSION_NOTICE: {name: "battle.developmentVersionNotice"},
        SPECTATOR_MODE: {name: "battle.spectatorMode"},
        PILOTING_MODE: {name: "battle.pilotingMode"},
        HUD_TARGET: {name: "battle.hud.target"},
        HUD_DISTANCE: {name: "battle.hud.distance"},
        HUD_VIEW: {name: "battle.hud.view"},
        HUD_FLIGHT_MODE: {name: "battle.hud.flightMode"},
        HUD_SPEED: {name: "battle.hud.speed"},
        LOADING_BOX_LOADING_LEVEL: {name: "battle.loadingBox.loadingLevel"},
        LOADING_BOX_ADDING_RANDOM_ELEMENTS: {name: "battle.loadingBox.addingRandomElements"},
        LOADING_BOX_BUILDING_SCENE: {name: "battle.loadingBox.buildingScene"},
        MESSAGE_READY: {name: "battle.message.ready"},
        MESSAGE_PAUSED: {name: "battle.message.paused"}
    };
    strings.DATABASE = {
        BACK: {name: "database.backButton"},
        TITLE: {name: "database.title"},
        PREV_BUTTON: {name: "database.prevButton"},
        NEXT_BUTTON: {name: "database.nextButton"},
        LOADING_BOX_INITIALIZING: {name: "database.loadingBox.initializing"},
        LENGTH: {name: "database.length"},
        MASS: {name: "database.mass"},
        WEAPON_SLOTS: {name: "database.weaponSlots"},
        THRUSTERS: {name: "database.thrusters"},
        MISSING_SPACECRAFT_TYPE_DESCRIPTION: {name: "database.missingSpacecraftTypeDescription"},
        MISSING_SPACECRAFT_CLASS_DESCRIPTION: {name: "database.missingSpacecraftClassDescription"}
    };
    strings.ABOUT = {
        BACK: {name: "about.backButton"},
        TITLE: {name: "about.title"},
        ABOUT_GAME_HEADER: {name: "about.aboutGameHeader"},
        VERSION_PARAGRAPH: {name: "about.versionParagraph"},
        ABOUT_GAME_PARAGRAPH: {name: "about.aboutGameParagraph"},
        ABOUT_AUTHOR_LICENSE_HEADER: {name: "about.aboutAuthorLicenseHeader"},
        ABOUT_AUTHOR_LICENSE_PARAGRAPH: {name: "about.aboutAuthorLicenseParagraph"},
        REQUIRE_JS_LICENSES: {name: "about.theNewBSDOrMITLicenses"}
    };
    strings.SETTING = {
        ON: {name: "setting.on"},
        OFF: {name: "setting.off"},
        VERY_LOW: {name: "setting.veryLow"},
        LOW: {name: "setting.low"},
        MEDIUM: {name: "setting.medium"},
        HIGH: {name: "setting.high"},
        VERY_HIGH: {name: "setting.veryHigh"},
        NORMAL: {name: "setting.normal"},
        SIMPLE: {name: "setting.simple"}
    };
    strings.GENERAL_SETTINGS = {
        BACK: {name: "generalSettings.backButton"},
        TITLE: {name: "generalSettings.title"},
        LANGUAGE: {name: "generalSettings.language"}
    };
    strings.GRAPHICS = {
        BACK: {name: "graphics.back"},
        TITLE: {name: "graphics.title"},
        ANTIALIASING: {name: "graphics.antialiasing"},
        FILTERING: {name: "graphics.filtering"},
        BILINEAR: {name: "graphics.bilinear"},
        TRILINEAR: {name: "graphics.trilinear"},
        ANISOTROPIC: {name: "graphics.anisotropic"},
        TEXTURE_QUALITY: {name: "graphics.textureQuality"},
        MODEL_DETAILS: {name: "graphics.modelDetails"},
        SHADERS: {name: "graphics.shaders"},
        SHADOWS: {name: "graphics.shadows"},
        SHADOW_QUALITY: {name: "graphics.shadowQuality"},
        SHADOW_DISTANCE: {name: "graphics.shadowDistance"},
        SHADOW_DISTANCE_VERY_CLOSE: {name: "graphics.shadowDistanceVeryClose"},
        SHADOW_DISTANCE_CLOSE: {name: "graphics.shadowDistanceClose"},
        SHADOW_DISTANCE_MEDIUM: {name: "graphics.shadowDistanceMedium"},
        SHADOW_DISTANCE_FAR: {name: "graphics.shadowDistanceFar"},
        SHADOW_DISTANCE_VERY_FAR: {name: "graphics.shadowDistanceVeryFar"}
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
    strings.CONTROLS = {
        BACK: {name: "controls.back"},
        TITLE: {name: "controls.title"},
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
    strings.OBJECT_VIEW = {
        PREFIX: {name: "objectView.", optional: true}
    };
    strings.FLIGHT_MODE = {
        PREFIX: {name: "flightMode.", optional: true}
    };
    /**
     * A shortcut for getting the translated (if available) or original spacecraft class name.
     * @param {SpacecraftClass} spacecraftClass
     * @returns {String}
     */
    strings.getSpacecraftClassName = function (spacecraftClass) {
        return strings.get(
                strings.SPACECRAFT_CLASS.PREFIX, spacecraftClass.getName() + strings.SPACECRAFT_CLASS.NAME_SUFFIX.name,
                spacecraftClass.getFullName());
    };
    /**
     * A shortcut for getting the translated (if available) or original spacecraft type name.
     * @param {SpacecraftType} spacecraftType
     * @returns {String}
     */
    strings.getSpacecraftTypeName = function (spacecraftType) {
        return strings.get(
                strings.SPACECRAFT_TYPE.PREFIX, spacecraftType.getName() + strings.SPACECRAFT_TYPE.NAME_SUFFIX.name,
                spacecraftType.getFullName());
    };
    return strings;
});
