/**
 * Copyright 2016-2021 Krisztián Nagy
 * @file Provides the menu screens of the Interstellar Armada game which are simply instances of MenuScreen.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 0.1
 */

/*global define, window */

/**
 * @param utils Used for format strings
 * @param application Used to check whether packaged with Electron
 * @param screens The menu screens are instances of MenuScreen.
 * @param game Used for navigation.
 * @param analytics Used for reporting opening of the different menu items.
 * @param constants Used for global localStorage IDs
 * @param armadaScreens Used for common screen constants.
 * @param strings Used for translation support.
 * @param audio Used for volume control
 * @param networking Used to check whether we are in a multi game
 * @param battle Used for starting / resuming the battle.
 */
define([
    "utils/utils",
    "modules/application",
    "modules/screens",
    "modules/game",
    "modules/analytics",
    "armada/constants",
    "armada/screens/shared",
    "armada/strings",
    "armada/audio",
    "armada/networking",
    "armada/screens/battle"
], function (utils, application, screens, game, analytics, constants, armadaScreens, strings, audio, networking, battle) {
    "use strict";
    var
            // --------------------------------------------------------------------------------------------
            // Constants
            FIRST_RUN_NOTE_SHOWN_LOCAL_STORAGE_ID = constants.LOCAL_STORAGE_PREFIX + "firstRunNoteShown",
            // --------------------------------------------------------------------------------------------
            // Private variables
            _releaseNotesShown = false,
            _mainMenuOptions = [{
                    id: strings.MAIN_MENU.SINGLE_PLAYER.name,
                    action: function () {
                        analytics.sendEvent("newgame");
                        audio.resume();
                        game.setScreen(armadaScreens.MISSIONS_SCREEN_NAME);
                    }
                }, {
                    id: strings.MAIN_MENU.MULTIPLAYER.name,
                    action: function () {
                        analytics.sendEvent("multi");
                        audio.resume();
                        game.setScreen(armadaScreens.MULTI_GAMES_SCREEN_NAME);
                    }
                }, {
                    id: strings.MAIN_MENU.DATABASE.name,
                    action: function () {
                        analytics.sendEvent("database");
                        audio.resume();
                        game.setScreen(armadaScreens.DATABASE_SCREEN_NAME);
                    }
                }, {
                    id: strings.MAIN_MENU.SETTINGS.name,
                    action: function () {
                        analytics.sendEvent("settings");
                        audio.resume();
                        game.setScreen(armadaScreens.SETTINGS_SCREEN_NAME);
                    }
                }, {
                    id: strings.MAIN_MENU.ABOUT.name,
                    action: function () {
                        analytics.sendEvent("about");
                        audio.resume();
                        game.setScreen(armadaScreens.ABOUT_SCREEN_NAME);
                    }
                }];
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getMainMenuScreen: function () {
            if (application.usesElectron()) {
                _mainMenuOptions.push({
                    id: strings.MAIN_MENU.QUIT.name,
                    action: function () {
                        window.close();
                    }
                });
            }
            return new screens.MenuScreen(
                    armadaScreens.MAIN_MENU_SCREEN_NAME,
                    armadaScreens.MAIN_MENU_SCREEN_SOURCE,
                    {
                        backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                        containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                    },
                    armadaScreens.MENU_COMPONENT_SOURCE,
                    armadaScreens.MENU_STYLE,
                    _mainMenuOptions,
                    armadaScreens.MAIN_MENU_CONTAINER_ID,
                    {
                        show: function () {
                            var message, newReleases, i;
                            audio.resetMasterVolume();
                            audio.resetMusicVolume();
                            // show first run message
                            if (localStorage[FIRST_RUN_NOTE_SHOWN_LOCAL_STORAGE_ID] !== "true") {
                                localStorage[FIRST_RUN_NOTE_SHOWN_LOCAL_STORAGE_ID] = "true";
                                armadaScreens.openDialog({
                                    header: strings.get(strings.FIRST_RUN_NOTE.HEADER),
                                    message: utils.formatString(strings.get(strings.FIRST_RUN_NOTE.MESSAGE), {
                                        chrome: '<a target="_blank" rel="noopener" href="https://www.google.com/chrome/">Google Chrome</a>',
                                        facebook: '<a target="_blank" rel="noopener" href="https://www.facebook.com/interstellar.armada">facebook</a>'
                                    }),
                                    buttons: [{
                                            caption: strings.get(strings.FIRST_RUN_NOTE.BUTTON),
                                            action: function () {
                                                audio.resume();
                                                game.closeSuperimposedScreen();
                                                audio.playMusic(armadaScreens.MENU_THEME);
                                                analytics.login();
                                            }
                                        }]
                                });
                                // if running a new version for the first time, show release notes of version since the last played one
                            } else if (!application.isFirstRun() && application.hasVersionChanged() && !_releaseNotesShown) {
                                _releaseNotesShown = true;
                                message = utils.formatString(strings.get(strings.RELEASE_NOTES.GENERAL), {
                                    version: application.getVersion()
                                }) + "<br/><br/>";
                                newReleases = application.getNewReleases();
                                if (newReleases.length > 0) {
                                    for (i = 0; i < newReleases.length; i++) {
                                        message += "<h2>" + newReleases[i] + "</h2>" + utils.formatString(strings.get(strings.RELEASE_NOTES.PREFIX, newReleases[i]));
                                    }
                                } else {
                                    message += utils.formatString(strings.get(strings.RELEASE_NOTES.NO_NEWS), {
                                        github: '<a target="_blank" rel="noopener" href="https://github.com/nkrisztian89/interstellar-armada/releases">Github</a>'
                                    });
                                }
                                armadaScreens.openDialog({
                                    header: strings.get(strings.RELEASE_NOTES.HEADER),
                                    message: message,
                                    messageClass: armadaScreens.RELEASE_NOTES_CLASS_NAME,
                                    buttons: [{
                                            caption: strings.get(strings.RELEASE_NOTES.BUTTON),
                                            action: function () {
                                                audio.resume();
                                                game.closeSuperimposedScreen();
                                                audio.playMusic(armadaScreens.MENU_THEME);
                                                analytics.login();
                                            }
                                        }]
                                });
                            } else {
                                audio.playMusic(armadaScreens.MENU_THEME);
                                analytics.login();
                            }
                            armadaScreens.setupFullscreenButton.call(this);
                        },
                        optionselect: armadaScreens.playButtonSelectSound,
                        optionclick: armadaScreens.playButtonClickSound
                    });
        },
        getSettingsMenuScreen: function () {
            return new screens.MenuScreen(
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
                            id: strings.SETTINGS.GAMEPLAY.name,
                            action: function () {
                                game.setScreen(armadaScreens.GAMEPLAY_SETTINGS_SCREEN_NAME);
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
                    });
        },
        getIngameMenuScreen: function () {
            return new screens.MenuScreen(
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
                            id: strings.SETTINGS.GAMEPLAY.name,
                            action: function () {
                                game.setScreen(armadaScreens.GAMEPLAY_SETTINGS_SCREEN_NAME, true, armadaScreens.SUPERIMPOSE_BACKGROUND_COLOR);
                            }
                        }, {
                            id: strings.INGAME_MENU.RESTART.name,
                            isVisible: function () {
                                return !networking.isInGame();
                            },
                            action: function () {
                                armadaScreens.openDialog({
                                    header: strings.get(strings.INGAME_MENU.RESTART_HEADER),
                                    message: strings.get(strings.INGAME_MENU.RESTART_MESSAGE),
                                    buttons: [{
                                            caption: strings.get(strings.SCREEN.CANCEL),
                                            action: function () {
                                                game.closeSuperimposedScreen();
                                            }
                                        }, {
                                            caption: strings.get(strings.INGAME_MENU.RESTART_RESTART),
                                            action: function () {
                                                game.closeSuperimposedScreen();
                                                game.closeSuperimposedScreen();
                                                game.getScreen().startNewBattle({
                                                    restart: true
                                                });
                                            }
                                        }
                                    ]
                                });
                            }
                        }, {
                            id: strings.INGAME_MENU.QUIT.name,
                            isVisible: function () {
                                return !networking.isInGame();
                            },
                            action: function () {
                                armadaScreens.openDialog({
                                    header: strings.get(strings.INGAME_MENU.QUIT_HEADER),
                                    message: strings.get(strings.INGAME_MENU.QUIT_MESSAGE),
                                    buttons: [{
                                            caption: strings.get(strings.SCREEN.CANCEL),
                                            action: function () {
                                                game.closeSuperimposedScreen();
                                            }
                                        }, {
                                            caption: strings.get(strings.INGAME_MENU.QUIT_TO_MISSIONS),
                                            action: function () {
                                                game.setScreen(armadaScreens.MISSIONS_SCREEN_NAME);
                                            }
                                        }, {
                                            caption: strings.get(strings.INGAME_MENU.QUIT_TO_MAIN_MENU),
                                            action: function () {
                                                game.setScreen(armadaScreens.MAIN_MENU_SCREEN_NAME);
                                            }
                                        }
                                    ]
                                });
                            }
                        }, {
                            id: strings.INGAME_MENU.QUIT_MULTI.name,
                            isVisible: function () {
                                return networking.isInGame();
                            },
                            action: function () {
                                armadaScreens.openDialog({
                                    header: strings.get(strings.INGAME_MENU.QUIT_MULTI_HEADER),
                                    message: strings.get(strings.INGAME_MENU.QUIT_MULTI_MESSAGE),
                                    buttons: [{
                                            caption: strings.get(strings.SCREEN.CANCEL),
                                            action: function () {
                                                game.closeSuperimposedScreen();
                                            }
                                        }, {
                                            caption: strings.get(strings.INGAME_MENU.QUIT_TO_SCORE),
                                            action: function () {
                                                game.setScreen(armadaScreens.MULTI_SCORE_SCREEN_NAME);
                                                networking.leaveGame();
                                            }
                                        }, {
                                            caption: strings.get(strings.INGAME_MENU.QUIT_TO_MAIN_MENU),
                                            action: function () {
                                                networking.onDisconnect(null);
                                                networking.disconnect();
                                                game.setScreen(armadaScreens.MAIN_MENU_SCREEN_NAME);
                                            }
                                        }
                                    ]
                                });
                            }
                        }],
                    armadaScreens.INGAME_MENU_CONTAINER_ID,
                    armadaScreens.MENU_EVENT_HANDLERS,
                    {
                        "escape": function () {
                            game.closeSuperimposedScreen();
                            battle.resumeBattle();
                        }
                    });
        }
    };
});
