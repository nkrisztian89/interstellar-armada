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
 * @param screens The menu screens are instances of MenuScreen.
 * @param game Used for navigation.
 * @param armadaScreens Used for common screen constants.
 * @param strings Used for translation support.
 * @param audio Used for volume control
 * @param battle Used for starting / resuming the battle.
 */
define([
    "modules/screens",
    "modules/game",
    "armada/screens/shared",
    "armada/strings",
    "armada/audio",
    "armada/screens/battle"
], function (screens, game, armadaScreens, strings, audio, battle) {
    "use strict";
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
                armadaScreens.MENU_STYLE,
                [{
                        id: strings.MAIN_MENU.NEW_GAME.name,
                        action: function () {
                            game.setScreen(armadaScreens.MISSIONS_SCREEN_NAME);
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
                    }], armadaScreens.MAIN_MENU_CONTAINER_ID,
                {
                    show: function () {
                        audio.resetMasterVolume();
                        audio.resetMusicVolume();
                        audio.playMusic(armadaScreens.MENU_THEME);
                    },
                    optionselect: armadaScreens.playButtonSelectSound,
                    optionclick: armadaScreens.playButtonClickSound
                }),
        settingsMenuScreen: new screens.MenuScreen(
                armadaScreens.SETTINGS_SCREEN_NAME,
                armadaScreens.SETTINGS_SCREEN_SOURCE,
                {
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                armadaScreens.MENU_COMPONENT_SOURCE,
                armadaScreens.MENU_STYLE,
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
                        id: strings.SETTINGS.AUDIO.name,
                        action: function () {
                            game.setScreen(armadaScreens.AUDIO_SCREEN_NAME);
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
                    }],
                armadaScreens.SETTINGS_MENU_CONTAINER_ID,
                armadaScreens.MENU_EVENT_HANDLERS,
                {
                    "escape": function () {
                        game.setScreen(armadaScreens.MAIN_MENU_SCREEN_NAME);
                    }
                }),
        ingameMenuScreen: new screens.MenuScreen(
                armadaScreens.INGAME_MENU_SCREEN_NAME,
                armadaScreens.INGAME_MENU_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.INGAME_MENU_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                armadaScreens.MENU_COMPONENT_SOURCE,
                armadaScreens.MENU_STYLE,
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
                        id: strings.SETTINGS.AUDIO.name,
                        action: function () {
                            game.setScreen(armadaScreens.AUDIO_SCREEN_NAME, true, armadaScreens.SUPERIMPOSE_BACKGROUND_COLOR);
                        }
                    }, {
                        id: strings.INGAME_MENU.RESTART.name,
                        action: function () {
                            game.closeSuperimposedScreen();
                            game.getScreen().startNewBattle({
                                restart: true
                            });
                        }
                    }, {
                        id: strings.INGAME_MENU.QUIT.name,
                        action: function () {
                            game.setScreen(armadaScreens.MAIN_MENU_SCREEN_NAME);
                        }
                    }],
                armadaScreens.INGAME_MENU_CONTAINER_ID,
                armadaScreens.MENU_EVENT_HANDLERS,
                {
                    "escape": function () {
                        game.closeSuperimposedScreen();
                        battle.resumeBattle();
                    }
                })
    };
});
