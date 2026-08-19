/**
 * Copyright 2014-2026 Krisztián Nagy
 * @file Augments the template provided by the game module to define the basic structure and initialization process of the Interstellar
 * Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param game This module uses the template provided by the game module and customizes it for Interstellar Armada
 * @param components Used to clear the cached DOM models of all loaded components after the game has been initialized
 * @param analytics Used for initializing game analytics
 * @param lights Used to set up light space perspective shadow mapping
 * @param constants Used to access the language setting location in the local storage
 * @param graphics Used to load the graphics settings
 * @param audio Used to load the audio settings
 * @param config Used to load general game configuration and settings
 * @param environments Used to load the environments
 * @param missions Used to load the missions
 * @param missionHub Used to initialize mission hub backend config
 * @param control Used to load the control configuration and setings of the game and access main functionality
 * @param strings Used to load the game translation strings
 * @param networking Used to initialize multiplayer backend config
 * @param announcements Used to initialize announcements backend config
 * @param armadaScreens Used for screen constants
 * @param menus Used to create menu screens
 * @param missionsScreen Used to create the mission chooser screen
 * @param multiGames Used to create the multiplayer game chooser screen
 * @param multiLobby Used to create the multiplayer game lobby screen
 * @param battle Used to create the battle screen
 * @param debriefing Used to create the debriefing screen
 * @param multiScore Used to create the multiplayer scoreboard screen
 * @param database Used to create the database screen
 * @param generalSettings Used to create the general settings screen
 * @param graphicsScreen Used to create the graphics settings screen
 * @param audioScreen Used to create the audio settings screen
 * @param gameplaySettingsScreen Used to create the gameplay settings screen
 * @param controlsScreen Used to create the control settings screen
 * @param aboutScreen Used to create the about screen
 * @param dialogScreen Used to create the dialog and error dialog screens
 * @param errorDialog Used to route showError() calls to the error dialog screen instead of alert()
 */
define([
    "modules/game",
    "modules/components",
    "modules/analytics",
    "modules/scene/lights",
    "armada/constants",
    "armada/graphics",
    "armada/audio",
    "armada/configuration",
    "armada/logic/environments",
    "armada/logic/missions",
    "armada/logic/mission-hub",
    "armada/control",
    "armada/strings",
    "armada/networking",
    "armada/announcements",
    "armada/screens/shared",
    "armada/screens/menus",
    "armada/screens/missions",
    "armada/screens/multi-games",
    "armada/screens/multi-lobby",
    "armada/screens/battle",
    "armada/screens/debriefing",
    "armada/screens/multi-score",
    "armada/screens/database",
    "armada/screens/general-settings",
    "armada/screens/graphics-settings",
    "armada/screens/audio-settings",
    "armada/screens/gameplay-settings",
    "armada/screens/control-settings",
    "armada/screens/about",
    "armada/screens/dialog",
    "armada/screens/error-dialog"
], function (
        game, components, analytics, lights,
        constants, graphics, audio, config, environments, missions, missionHub, control, strings, networking, announcements,
        armadaScreens, menus, missionsScreen, multiGames, multiLobby, battle, debriefing, multiScore, database, generalSettings, graphicsScreen, audioScreen, gameplaySettingsScreen, controlsScreen, aboutScreen, dialogScreen, errorDialog) {
    "use strict";
    // -------------------------------------------------------------------------
    // local variables
    var _progressBar = document.getElementById("splashProgress");
    _progressBar.max = 6;
    /**
     * Toggles the body class that CSS uses to gate the "UI effects" animation / background blur rules on the current graphics setting.
     */
    function _updateUIEffectsClass() {
        document.body.classList.toggle(armadaScreens.UI_EFFECTS_BODY_CLASS_NAME, graphics.getUIEffects() === graphics.UIEffectsLevel.HIGH);
    }
    // -------------------------------------------------------------------------
    // setting game properties
    game.setGameName(constants.GAME_NAME);
    game.setStartScreenName("mainMenu");
    game.setConfigFolder("config/");
    game.setConfigFileName("config.json");
    game.setFileCacheBypassEnabled(true);
    game.setPreviouslyRunVersion(localStorage[constants.VERSION_LOCAL_STORAGE_ID]);
    // failing to load config or settings should already use the proper error handler, analytics.sendEvent() will simply no-op in this case
    game.showError = function (message, severity, details, disableIgnore) {
        analytics.sendEvent("error", undefined, {message: (message.length > 120) ? message.substr(0, 120) + "..." : message});
        errorDialog.showError(message, severity, details, disableIgnore);
    };
    // -------------------------------------------------------------------------
    // Overridden protected methods
    game._loadGameSettingsAndExecuteCallback = function (settingsJSON, callback) {
        // load defaults from the JSON files and then overwrite with local preferences (of which only differences from defaults are stored)
        graphics.loadSettingsFromJSON(settingsJSON.graphics);
        graphics.loadSettingsFromLocalStorage();
        audio.loadSettingsFromJSON(settingsJSON.audio);
        audio.loadSettingsFromLocalStorage();
        config.loadSettingsFromJSON(settingsJSON.logic);
        control.loadSettingsFromJSON(settingsJSON.control);
        control.loadSettingsFromLocalStorage();
        missions.loadSettingsFromLocalStorage();
        graphics.executeWhenReady(function () {
            lights.setupLiSPSM(graphics.getLispsmMinimumNear(), graphics.getLispsmNearFactor());
            _updateUIEffectsClass();
        });
        graphics.onSettingsChange(_updateUIEffectsClass);
        config.executeWhenReady(function () {
            environments.requestLoad();
            environments.executeWhenReady(function () {
                _progressBar.value = 2;
                missions.requestLoad(false);
                missions.executeWhenReady(function () {
                    _progressBar.value = 3;
                    callback();
                });
            });
        });
    };
    game._loadGameConfigurationAndExecuteCallback = function (configJSON, callback) {
        config.loadConfigurationFromJSON(configJSON.dataFiles.logic);
        graphics.loadConfigurationFromJSON(configJSON.graphics);
        audio.loadConfigurationFromJSON(configJSON.audio);
        missions.loadConfigurationFromJSON(configJSON.logic);
        control.loadConfigurationFromJSON(configJSON.control);
        _progressBar.value = 1;
        if (configJSON.analyticsEnabled) {
            analytics.init(configJSON.analyticsUrl);
        }
        networking.init(configJSON.multiUrl);
        missionHub.init(configJSON.missionHubUrl);
        announcements.init(configJSON.announcementsUrl);
        document.getElementById(armadaScreens.GAME_VERSION_LABEL_ID).textContent = game.getVersion();
        callback();
    };
    game._buildScreensAndExecuteCallback = function (callback) {
        game.addScreen(menus.getMainMenuScreen());
        game.addScreen(menus.getSinglePlayerMenuScreen());
        game.addScreen(missionsScreen.getMissionsScreen());
        game.addScreen(multiGames.getMultiGamesScreen());
        game.addScreen(multiLobby.getMultiLobbyScreen());
        game.addScreen(battle.getBattleScreen());
        game.addScreen(debriefing.getDebriefingScreen());
        game.addScreen(multiScore.getMultiScoreScreen());
        game.addScreen(database.getDatabaseScreen());
        game.addScreen(menus.getSettingsMenuScreen());
        game.addScreen(generalSettings.getGeneralSettingsScreen());
        game.addScreen(graphicsScreen.getGraphicsScreen());
        game.addScreen(audioScreen.getAudioScreen());
        game.addScreen(gameplaySettingsScreen.getGameplaySettingsScreen());
        game.addScreen(controlsScreen.getControlsScreen());
        game.addScreen(aboutScreen.getAboutScreen());
        game.addScreen(menus.getIngameMenuScreen(), true);
        game.addScreen(dialogScreen.getDialogScreen(), true);
        game.addScreen(dialogScreen.getErrorDialogScreen(), true);
        _progressBar.value = 4;
        game.executeWhenAllScreensReady(function () {
            _progressBar.value = 5;
            game.requestLanguageChange(localStorage.getItem(constants.LANGUAGE_LOCAL_STORAGE_ID) || game.getDefaultLanguage(), strings, function () {
                _progressBar.value = 6;
                components.clearStoredDOMModels();
                localStorage[constants.VERSION_LOCAL_STORAGE_ID] = game.getVersion();
                armadaScreens.initAudio(function () {
                    callback();
                    errorDialog.setScreensReady();
                });
            });
        });
    };
    return game;
});