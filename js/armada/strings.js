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
        GRAPHICS: {name: "settings.graphics"},
        CONTROLS: {name: "settings.controls"}
    };
    strings.INGAME_MENU = {
        RESUME: {name: "ingameMenu.resume"},
        QUIT: {name: "ingameMenu.quit"}
    };
    strings.ABOUT = {
        BACK: {name: "about.back"},
        TITLE: {name: "about.title"},
        VERSION: {name: "about.version"}
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
    strings.GRAPHICS = {
        BACK: {name: "graphics.back"},
        DEFAULTS: {name: "graphics.defaults"},
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
    return strings;
});
