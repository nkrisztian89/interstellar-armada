/**
 * Copyright 2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 0.1
 */

/*jslint nomen: true, white: true*/
/*global define */

define([
    "modules/screens",
    "modules/game",
    "armada/screens/shared",
    "armada/logic",
    "armada/strings"
], function (screens, game, armadaScreens, logic, strings) {
    "use strict";
    return {
        mainMenuScreen: new screens.MenuScreen(
                armadaScreens.MAIN_MENU_SCREEN_NAME,
                armadaScreens.MAIN_MENU_SCREEN_SOURCE,
                [{
                        caption: strings.get(strings.MAIN_MENU.NEW_GAME),
                        action: function () {
                            game.setScreen(armadaScreens.BATTLE_SCREEN_NAME);
                            game.getScreen().startNewBattle(logic.getLevelFileName(0));
                        }
                    }, {
                        caption: strings.get(strings.MAIN_MENU.DATABASE),
                        action: function () {
                            game.setScreen(armadaScreens.DATABASE_SCREEN_NAME);
                        }
                    }, {
                        caption: strings.get(strings.MAIN_MENU.SETTINGS),
                        action: function () {
                            game.setScreen(armadaScreens.SETTINGS_SCREEN_NAME);
                        }
                    }, {
                        caption: strings.get(strings.MAIN_MENU.ABOUT),
                        action: function () {
                            game.setScreen(armadaScreens.ABOUT_SCREEN_NAME);
                        }
                    }], armadaScreens.MAIN_MENU_CONTAINER_ID),
        settingsMenuScreen: new screens.MenuScreen(
                armadaScreens.SETTINGS_SCREEN_NAME,
                armadaScreens.SETTINGS_SCREEN_SOURCE,
                [{
                        caption: strings.get(strings.SETTINGS.GRAPHICS),
                        action: function () {
                            game.setScreen(armadaScreens.GRAPHICS_SCREEN_NAME);
                        }
                    }, {
                        caption: strings.get(strings.SETTINGS.CONTROLS),
                        action: function () {
                            game.setScreen(armadaScreens.CONTROLS_SCREEN_NAME);
                        }
                    }, {
                        caption: strings.get(strings.SCREEN.BACK),
                        action: function () {
                            game.setScreen(armadaScreens.MAIN_MENU_SCREEN_NAME);
                        }
                    }], armadaScreens.SETTINGS_MENU_CONTAINER_ID),
        ingameMenuScreen: new screens.MenuScreen(
                armadaScreens.INGAME_MENU_SCREEN_NAME,
                armadaScreens.INGAME_MENU_SCREEN_SOURCE,
                [{
                        caption: strings.get(strings.INGAME_MENU.RESUME),
                        action: function () {
                            game.closeSuperimposedScreen();
                            game.getScreen().resumeBattle();
                        }
                    }, {
                        caption: strings.get(strings.SETTINGS.CONTROLS),
                        action: function () {
                            game.setScreen(armadaScreens.CONTROLS_SCREEN_NAME, true, armadaScreens.SUPERIMPOSE_BACKGROUND_COLOR);
                        }
                    }, {
                        caption: strings.get(strings.INGAME_MENU.QUIT),
                        action: function () {
                            game.setScreen(armadaScreens.MAIN_MENU_SCREEN_NAME);
                        }
                    }], armadaScreens.INGAME_MENU_CONTAINER_ID)
    };
});
