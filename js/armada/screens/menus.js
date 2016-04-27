/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides the menu screens of the Interstellar Armada game which are simply instances of MenuScreen.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 0.1
 */

/*jslint nomen: true, white: true, plusplus: true*/
/*global define */

/**
 * @param utils Used for trimming filename extensions.
 * @param screens The menu screens are instances of MenuScreen.
 * @param game Used for navigation.
 * @param armadaScreens Used for common screen constants.
 * @param config Used for choosing the level description file to load when a new battle is started from the main menu.
 * @param strings Used for translation support.
 * @param battle Used for starting / resuming the battle.
 */
define([
    "utils/utils",
    "modules/screens",
    "modules/game",
    "armada/screens/shared",
    "armada/configuration",
    "armada/strings",
    "armada/screens/battle"
], function (utils, screens, game, armadaScreens, config, strings, battle) {
    "use strict";
    // -------------------------------------------------------------------------
    // Private functions
    /**
     * Creates and returns the menu options for the level selection screen.
     * @param {Boolean} demoMode
     * @returns {MenuComponent~MenuOption[]}
     */
    function _getLevelOptions(demoMode) {
        var result = [], i, actionFunction = function (levelFilename) {
            game.setScreen(armadaScreens.BATTLE_SCREEN_NAME);
            game.getScreen().startNewBattle(levelFilename, demoMode);
        };
        for (i = 0; i < config.getLevelFileCount(); i++) {
            result.push({
                id: strings.LEVEL.PREFIX.name + utils.getFilenameWithoutExtension(config.getLevelFileName(i)),
                action: actionFunction.bind(this, config.getLevelFileName(i))
            });
        }
        result.push({
            id: strings.SCREEN.BACK.name,
            action: function () {
                game.setScreen(armadaScreens.MAIN_MENU_SCREEN_NAME);
            }
        });
        return result;
    }
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        mainMenuScreen: new screens.MenuScreen(
                armadaScreens.MAIN_MENU_SCREEN_NAME,
                armadaScreens.MAIN_MENU_SCREEN_SOURCE,
                {
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                armadaScreens.MENU_COMPONENT_SOURCE,
                {
                    menuClassName: armadaScreens.MENU_CLASS_NAME,
                    buttonClassName: armadaScreens.MENU_BUTTON_CLASS_NAME,
                    buttonContainerClassName: armadaScreens.MENU_BUTTON_CONTAINER_CLASS_NAME
                },
                [{
                        id: strings.MAIN_MENU.NEW_GAME.name,
                        action: function () {
                            game.setScreen(armadaScreens.LEVEL_MENU_SCREEN_NAME);
                        }
                    }, {
                        id: strings.MAIN_MENU.DEMO.name,
                        action: function () {
                            game.setScreen(armadaScreens.DEMO_LEVEL_MENU_SCREEN_NAME);
                        }
                    }, {
                        id: strings.MAIN_MENU.DATABASE.name,
                        action: function () {
                            game.setScreen(armadaScreens.DATABASE_SCREEN_NAME);
                        }
                    }, {
                        id: strings.MAIN_MENU.SETTINGS.name,
                        action: function () {
                            game.setScreen(armadaScreens.SETTINGS_SCREEN_NAME);
                        }
                    }, {
                        id: strings.MAIN_MENU.ABOUT.name,
                        action: function () {
                            game.setScreen(armadaScreens.ABOUT_SCREEN_NAME);
                        }
                    }], armadaScreens.MAIN_MENU_CONTAINER_ID),
        levelSelectionMenuScreen: new screens.MenuScreen(
                armadaScreens.LEVEL_MENU_SCREEN_NAME,
                armadaScreens.LEVEL_MENU_SCREEN_SOURCE,
                {
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                armadaScreens.MENU_COMPONENT_SOURCE,
                {
                    menuClassName: armadaScreens.MENU_CLASS_NAME,
                    buttonClassName: armadaScreens.MENU_BUTTON_CLASS_NAME,
                    buttonContainerClassName: armadaScreens.MENU_BUTTON_CONTAINER_CLASS_NAME
                },
                _getLevelOptions(false),
                armadaScreens.LEVEL_MENU_CONTAINER_ID),
        demoLevelSelectionMenuScreen: new screens.MenuScreen(
                armadaScreens.DEMO_LEVEL_MENU_SCREEN_NAME,
                armadaScreens.DEMO_LEVEL_MENU_SCREEN_SOURCE,
                {
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                armadaScreens.MENU_COMPONENT_SOURCE,
                {
                    menuClassName: armadaScreens.MENU_CLASS_NAME,
                    buttonClassName: armadaScreens.MENU_BUTTON_CLASS_NAME,
                    buttonContainerClassName: armadaScreens.MENU_BUTTON_CONTAINER_CLASS_NAME
                },
                _getLevelOptions(true),
                armadaScreens.DEMO_LEVEL_MENU_CONTAINER_ID),
        settingsMenuScreen: new screens.MenuScreen(
                armadaScreens.SETTINGS_SCREEN_NAME,
                armadaScreens.SETTINGS_SCREEN_SOURCE,
                {
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                armadaScreens.MENU_COMPONENT_SOURCE,
                {
                    menuClassName: armadaScreens.MENU_CLASS_NAME,
                    buttonClassName: armadaScreens.MENU_BUTTON_CLASS_NAME,
                    buttonContainerClassName: armadaScreens.MENU_BUTTON_CONTAINER_CLASS_NAME
                },
                [{
                        id: strings.SETTINGS.GENERAL.name,
                        action: function () {
                            game.setScreen(armadaScreens.GENERAL_SETTINGS_SCREEN_NAME);
                        }
                    }, {
                        id: strings.SETTINGS.GRAPHICS.name,
                        action: function () {
                            game.setScreen(armadaScreens.GRAPHICS_SCREEN_NAME);
                        }
                    }, {
                        id: strings.SETTINGS.CONTROLS.name,
                        action: function () {
                            game.setScreen(armadaScreens.CONTROLS_SCREEN_NAME);
                        }
                    }, {
                        id: strings.SCREEN.BACK.name,
                        action: function () {
                            game.setScreen(armadaScreens.MAIN_MENU_SCREEN_NAME);
                        }
                    }], armadaScreens.SETTINGS_MENU_CONTAINER_ID),
        ingameMenuScreen: new screens.MenuScreen(
                armadaScreens.INGAME_MENU_SCREEN_NAME,
                armadaScreens.INGAME_MENU_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.INGAME_MENU_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                armadaScreens.MENU_COMPONENT_SOURCE,
                {
                    menuClassName: armadaScreens.MENU_CLASS_NAME,
                    buttonClassName: armadaScreens.MENU_BUTTON_CLASS_NAME,
                    buttonContainerClassName: armadaScreens.MENU_BUTTON_CONTAINER_CLASS_NAME
                },
                [{
                        id: strings.INGAME_MENU.RESUME.name,
                        action: function () {
                            game.closeSuperimposedScreen();
                            battle.resumeBattle();
                        }
                    }, {
                        id: strings.SETTINGS.CONTROLS.name,
                        action: function () {
                            game.setScreen(armadaScreens.CONTROLS_SCREEN_NAME, true, armadaScreens.SUPERIMPOSE_BACKGROUND_COLOR);
                        }
                    }, {
                        id: strings.INGAME_MENU.QUIT.name,
                        action: function () {
                            game.setScreen(armadaScreens.MAIN_MENU_SCREEN_NAME);
                        }
                    }], armadaScreens.INGAME_MENU_CONTAINER_ID)
    };
});
