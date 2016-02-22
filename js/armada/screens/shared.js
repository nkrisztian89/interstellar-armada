/**
 * Copyright 2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define */

define(function () {
    "use strict";
    // constants to be accessable to all screen
    return {
        SELECTOR_SOURCE: "selector.html",
        SELECTOR_CSS: "selector.css",
        SUPERIMPOSE_BACKGROUND_COLOR: [0.25, 0.25, 0.25, 0.5],
        MAIN_MENU_SCREEN_NAME: "mainMenu",
        MAIN_MENU_SCREEN_SOURCE: "menu.html",
        MAIN_MENU_CONTAINER_ID: "menuContainer",
        BATTLE_SCREEN_NAME: "battle",
        DATABASE_SCREEN_NAME: "database",
        SETTINGS_SCREEN_NAME: "settings",
        SETTINGS_SCREEN_SOURCE: "menu.html",
        SETTINGS_MENU_CONTAINER_ID: "menuContainer",
        GRAPHICS_SCREEN_NAME: "graphics",
        GRAPHICS_SCREEN_SOURCE: "graphics.html",
        CONTROLS_SCREEN_NAME: "controls",
        ABOUT_SCREEN_NAME: "about",
        ABOUT_SCREEN_SOURCE: "about.html",
        INGAME_MENU_SCREEN_NAME: "ingameMenu",
        INGAME_MENU_SCREEN_SOURCE: "ingame-menu.html",
        INGAME_MENU_CONTAINER_ID: "menuContainer"
    };
});