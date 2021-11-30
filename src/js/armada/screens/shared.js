/**
 * Copyright 2016-2021 Krisztián Nagy
 * @file Contains the common constants and functions accessible to all screens of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param game Used to change the screen in public functions
 * @param resources Used to load and access the sound effects for buttons
 * @param components Used for constants (CSS class names)
 * @param config Used to access which sound effects and music to load
 * @param audio Used to initialize music
 */
define([
    "modules/game",
    "modules/media-resources",
    "modules/components",
    "armada/configuration",
    "armada/audio"
], function (game, resources, components, config, audio) {
    "use strict";
    var
            exports = {
                // ------------------------------------------------------------------------------
                // Constants
                // music
                MENU_THEME: "menu",
                DEBRIEFING_VICTORY_THEME: "debriefing_victory",
                DEBRIEFING_DEFEAT_THEME: "debriefing_defeat",
                // components
                SELECTOR_SOURCE: "selector.html",
                SELECTOR_CSS: "selector.css",
                SLIDER_SOURCE: "slider.html",
                SLIDER_CSS: "slider.css",
                LOADING_BOX_SOURCE: "loadingbox.html",
                LOADING_BOX_CSS: "loadingbox.css",
                INFO_BOX_SOURCE: "infobox.html",
                INFO_BOX_CSS: "infobox.css",
                MENU_COMPONENT_SOURCE: "menucomponent.html",
                CHECK_GROUP_SOURCE: "checkgroup.html",
                CHECK_GROUP_CSS: "checkgroup.css",
                LIST_COMPONENT_SOURCE: "listcomponent.html",
                LIST_COMPONENT_CSS: "listcomponent.css",
                // menu component classes
                MENU_CLASS_NAME: "menu",
                MENU_BUTTON_CONTAINER_CLASS_NAME: "transparentContainer",
                // list component classes
                LIST_CLASS_NAME: "list",
                LIST_ELEMENT_CLASS_NAME: "listElement",
                LIST_ELEMENT_CONTAINER_CLASS_NAME: "transparentContainer",
                CAPTION_CLASS_NAME: "caption",
                SUBCAPTION_CLASS_NAME: "subcaption",
                // general
                SUPERIMPOSE_BACKGROUND_COLOR: [0.25, 0.25, 0.25, 0.5],
                SCREEN_BACKGROUND_CLASS_NAME: "fullScreenFix",
                SCREEN_CONTAINER_CLASS_NAME: "fullScreenContainer",
                // welcome message
                RELEASE_NOTES_CLASS_NAME: "releaseNotes",
                // screens
                MAIN_MENU_SCREEN_NAME: "mainMenu",
                MAIN_MENU_SCREEN_SOURCE: "menu.html",
                MAIN_MENU_CONTAINER_ID: "menuContainer",
                MISSIONS_SCREEN_NAME: "missions",
                MISSIONS_SCREEN_SOURCE: "missions.html",
                MISSIONS_SCREEN_CSS: "missions.css",
                MISSIONS_LIST_CONTAINER_ID: "missionListContainer",
                MULTI_GAMES_SCREEN_NAME: "multiGames",
                MULTI_GAMES_SCREEN_SOURCE: "multi-games.html",
                MULTI_GAMES_SCREEN_CSS: "multi-games.css",
                MULTI_LOBBY_SCREEN_NAME: "multiLobby",
                MULTI_LOBBY_SCREEN_SOURCE: "multi-lobby.html",
                MULTI_LOBBY_SCREEN_CSS: "multi-lobby.css",
                MULTI_SCORE_SCREEN_NAME: "multiScore",
                MULTI_SCORE_SCREEN_SOURCE: "multi-score.html",
                MULTI_SCORE_SCREEN_CSS: "multi-score.css",
                BATTLE_SCREEN_NAME: "battle",
                BATTLE_SCREEN_SOURCE: "battle.html",
                BATTLE_SCREEN_CSS: "battle.css",
                DEBRIEFING_SCREEN_NAME: "debriefing",
                DEBRIEFING_SCREEN_SOURCE: "debriefing.html",
                DEBRIEFING_SCREEN_CSS: "debriefing.css",
                DATABASE_SCREEN_NAME: "database",
                DATABASE_SCREEN_SOURCE: "database.html",
                DATABASE_SCREEN_CSS: "database.css",
                SETTINGS_SCREEN_NAME: "settings",
                SETTINGS_SCREEN_SOURCE: "menu.html",
                SETTINGS_MENU_CONTAINER_ID: "menuContainer",
                GENERAL_SETTINGS_SCREEN_NAME: "generalSettings",
                GENERAL_SETTINGS_SCREEN_SOURCE: "general-settings.html",
                GENERAL_SETTINGS_SCREEN_CSS: "general-settings.css",
                GRAPHICS_SCREEN_NAME: "graphics",
                GRAPHICS_SCREEN_SOURCE: "graphics.html",
                GRAPHICS_SCREEN_CSS: "graphics.css",
                AUDIO_SCREEN_NAME: "audio",
                AUDIO_SCREEN_SOURCE: "audio.html",
                CONTROLS_SCREEN_NAME: "controls",
                CONTROLS_SCREEN_SOURCE: "controls.html",
                CONTROLS_SCREEN_CSS: "controls.css",
                GAMEPLAY_SETTINGS_SCREEN_NAME: "gameplaySettings",
                GAMEPLAY_SETTINGS_SCREEN_SOURCE: "gameplay-settings.html",
                GAMEPLAY_SETTINGS_SCREEN_CSS: "gameplay-settings.css",
                ABOUT_SCREEN_NAME: "about",
                ABOUT_SCREEN_SOURCE: "about.html",
                ABOUT_SCREEN_CSS: "about.css",
                INGAME_MENU_SCREEN_NAME: "ingameMenu",
                INGAME_MENU_SCREEN_SOURCE: "ingame-menu.html",
                INGAME_MENU_SCREEN_CSS: "ingame-menu.css",
                INGAME_MENU_CONTAINER_ID: "menuContainer",
                DIALOG_SCREEN_NAME: "dialog",
                DIALOG_SCREEN_SOURCE: "dialog.html",
                DIALOG_SCREEN_CSS: "dialog.css"
            },
            // --------------------------------------------------------------------------------------------
            // Constants
            FULLSCREEN_BUTTON_ID = "fullscreenButton",
            // ------------------------------------------------------------------------------
            // Private variables
            /**
             * Stores the sound source that can be used to play the button select sound (played when the player hovers over a button or selects it
             * with the arrow keys)
             * @type SoundSource
             */
            _buttonSelectSound,
            /**
             * Stores the sound source that can be used to play the button click sound (played when the player clicks on or activates an
             * enabled button)
             * @type SoundSource
             */
            _buttonClickSound;
    // --------------------------------------------------------------------------------------------
    // Private functions
    function _toggleFullscreen() {
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.mozRequestFullScreen) {
                document.documentElement.mozRequestFullScreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) {
                document.documentElement.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozExitFullScreen) {
                document.mozExitFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }
    // ------------------------------------------------------------------------------
    // Public functions
    /**
     * Initiates the loading of the sound effects used on all screens.
     * @param {Function} [callback] If given, this function is executed once all sound effects are loaded
     */
    exports.initAudio = function (callback) {
        var s1, s2;
        s1 = resources.getSoundEffect(config.getSetting(config.GENERAL_SETTINGS.BUTTON_SELECT_SOUND).name);
        s2 = resources.getSoundEffect(config.getSetting(config.GENERAL_SETTINGS.BUTTON_CLICK_SOUND).name);
        audio.initMusic(config.getSetting(config.GENERAL_SETTINGS.MENU_MUSIC), exports.MENU_THEME, true);
        if ((s1 && !s1.isLoaded() && !s1.hasError()) || (s2 && !s2.isLoaded() && !s2.hasError())) {
            resources.executeWhenReady(function () {
                _buttonSelectSound = s1 && s1.createSoundClip(
                        resources.SoundCategory.UI,
                        config.getSetting(config.GENERAL_SETTINGS.BUTTON_SELECT_SOUND).volume);
                _buttonClickSound = s2 && s2.createSoundClip(
                        resources.SoundCategory.UI,
                        config.getSetting(config.GENERAL_SETTINGS.BUTTON_CLICK_SOUND).volume);
            });
        }
        resources.requestResourceLoad();
        if (callback) {
            resources.executeWhenReady(callback);
        }
    };
    /**
     * Plays the button select sound, if it is loaded.
     * @param {Boolean} [enabled=false] If false, does not play the sound
     */
    exports.playButtonSelectSound = function (enabled) {
        if (_buttonSelectSound && enabled) {
            _buttonSelectSound.play();
        }
    };
    /**
     * Plays the button click sound, if it is loaded.
     * @param {Boolean} [enabled=false] If false, does not play the sound
     */
    exports.playButtonClickSound = function (enabled) {
        if (_buttonClickSound && enabled) {
            _buttonClickSound.play();
        }
    };
    /**
     * Sets up a dialog screen using the passed data and opens it as a superimposed screen
     * @param {DialogScreen~Data} dialogData
     */
    exports.openDialog = function (dialogData) {
        game.getScreen(exports.DIALOG_SCREEN_NAME).setup(dialogData);
        game.setScreen(exports.DIALOG_SCREEN_NAME, true, exports.SUPERIMPOSE_BACKGROUND_COLOR);
    };
    /**
     * Returns the HTML code for insterting the passed text as a sub paragraph.
     * @param {String} text
     * @returns {String}
     */
    exports.getSubParagraph = function (text) {
        return '<p class="sub fadedText">' + text + "</p>";
    };
    /**
     * Call on the screen that has a fullscreen button to set up its event handlers
     */
    exports.setupFullscreenButton = function () {
        if (game.usesElectron()) {
            this.getElement(FULLSCREEN_BUTTON_ID).hidden = true;
        } else {
            this.getElement(FULLSCREEN_BUTTON_ID).onclick = _toggleFullscreen;
        }
    };
    // ------------------------------------------------------------------------------
    // Derived constants
    /**
     * Contains event handlers to play the button click and select sounds for elements with the class "button". Can be used for all screens
     * that contain buttons (but needs to be complemented with additional event handlers if those are needed)
     * @type Object.<String, Object.<String, Function>>
     */
    exports.BUTTON_EVENT_HANDLERS = {
        "button": {
            mouseenter: function () {
                exports.playButtonSelectSound(!this.classList.contains(components.DISABLED_CLASS_NAME));
            },
            mouseup: function () {
                exports.playButtonClickSound(!this.classList.contains(components.DISABLED_CLASS_NAME));
            }
        }
    };
    /**
     * Contains event handlers for MenuScreen screens to play the button select and click sounds for the menu option buttons
     * and to set up the fullscreen toggling button
     * @type Object.<String, Function>
     */
    exports.MENU_EVENT_HANDLERS = {
        show: exports.setupFullscreenButton,
        optionselect: exports.playButtonSelectSound,
        optionclick: exports.playButtonClickSound
    };
    /**
     * A style descriptor containing the CSS class names needed to create a MenuComponent
     * @type MenuComponent~Style
     */
    exports.MENU_STYLE = {
        menuClassName: exports.MENU_CLASS_NAME,
        buttonContainerClassName: exports.MENU_BUTTON_CONTAINER_CLASS_NAME,
        selectedButtonClassName: components.SELECTED_CLASS_NAME,
        disabledClassName: components.DISABLED_CLASS_NAME
    };
    // ------------------------------------------------------------------------------
    // Public interface of the module
    return exports;
});