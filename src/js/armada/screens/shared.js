/**
 * Copyright 2016-2026 Krisztián Nagy
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
                GAME_VERSION_LABEL_ID: "gameVersion",
                // music
                MENU_THEME: "menu",
                BRIEFING_THEME: "briefing",
                DEBRIEFING_VICTORY_THEME: "debriefing_victory",
                DEBRIEFING_DEFEAT_THEME: "debriefing_defeat",
                // components
                MULTI_BAR_SELECTOR_SOURCE: "multibarselector.html",
                MULTI_BAR_SELECTOR_CSS: "multibarselector.css",
                SLIDER_SOURCE: "slider.html",
                SLIDER_CSS: "slider.css",
                LOADING_BOX_SOURCE: "loadingbox.html",
                LOADING_BOX_CSS: "loadingbox.css",
                INFO_BOX_SOURCE: "infobox.html",
                INFO_BOX_CSS: "infobox.css",
                MENU_COMPONENT_SOURCE: "menucomponent.html",
                MENU_COMPONENT_CSS: "menucomponent.css",
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
                // shared background image behind the main / single player / settings menu screens (see showMenuBackground())
                MAIN_BACKGROUND_IMAGE_ID: "mainBackgroundImage",
                // added to the document body while the "UI effects" graphics setting is on
                UI_EFFECTS_BODY_CLASS_NAME: "uiEffects",
                // welcome message
                RELEASE_NOTES_CLASS_NAME: "releaseNotes",
                // announcements
                ANNOUNCEMENTS_CLASS_NAME: "announcements",
                ANNOUNCEMENT_CLASS_NAME: "announcement",
                // screens
                MAIN_MENU_SCREEN_NAME: "mainMenu",
                MAIN_MENU_SCREEN_SOURCE: "menu.html",
                MAIN_MENU_CONTAINER_ID: "menuContainer",
                SINGLE_PLAYER_SCREEN_NAME: "singlePlayer",
                SINGLE_PLAYER_SCREEN_SOURCE: "menu.html",
                SINGLE_PLAYER_MENU_CONTAINER_ID: "menuContainer",
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
                INGAME_MENU_BACKGROUND_CLASS_NAME: "ingameMenuBackground",
                DIALOG_SCREEN_NAME: "dialog",
                DIALOG_SCREEN_SOURCE: "dialog.html",
                DIALOG_SCREEN_CSS: "dialog.css",
                DIALOG_BACKGROUND_CLASS_NAME: "dialogBackground",
                ERROR_DIALOG_SCREEN_NAME: "errorDialog",
                ERROR_DIALOG_SCREEN_SOURCE: "errorDialog.html",
                ERROR_DIALOG_SCREEN_CSS: "dialog.css",
                ERROR_DIALOG_BACKGROUND_CLASS_NAME: "errorDialogBackground"
            },
            // --------------------------------------------------------------------------------------------
            // Constants
            FULLSCREEN_BUTTON_ID = "fullscreenButton",
            /**
             * The class added to the fullscreen toggle button while fullscreen mode is active, to switch it to showing the "exit fullscreen" icon
             * @type String
             */
            FULLSCREEN_BUTTON_ACTIVE_CLASS = "active",
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
            _buttonClickSound,
            /**
             * The shared background image element displayed behind the main / single player / settings menu screens, lazily created and kept
             * alive across navigation between those screens (see showMenuBackground() / hideMenuBackground()).
             * @type Element
             */
            _mainBackgroundImage,
            /**
             * Whether the appear transition of _mainBackgroundImage has already been played once. It is only meant to play once, when the
             * game starts - not every time the menus are (re)entered from another screen - see showMenuBackground().
             * @type Boolean
             */
            _mainBackgroundShown = false;
    // --------------------------------------------------------------------------------------------
    // Private functions
    /**
     * Returns whether the page is currently displayed in fullscreen mode, checking all the vendor-prefixed variants of the corresponding
     * DOM property.
     * @returns {Boolean}
     */
    function _isFullscreen() {
        return !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    }
    function _toggleFullscreen() {
        if (!_isFullscreen()) {
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
    /**
     * Updates the passed fullscreen toggle button element to reflect whether fullscreen mode is currently active (see FULLSCREEN_BUTTON_ACTIVE_CLASS)
     * @param {Element} button
     */
    function _updateFullscreenButton(button) {
        button.classList.toggle(FULLSCREEN_BUTTON_ACTIVE_CLASS, _isFullscreen());
    }
    /**
     * Creates (if not created yet) and returns the shared main background image element, inserted as the very first child of the document
     * body so that it is always stacked behind every screen, regardless of when it gets created.
     * @returns {Element}
     */
    function _getMainBackgroundImage() {
        if (!_mainBackgroundImage) {
            _mainBackgroundImage = document.createElement("div");
            _mainBackgroundImage.id = exports.MAIN_BACKGROUND_IMAGE_ID;
            _mainBackgroundImage.hidden = true;
            document.body.insertBefore(_mainBackgroundImage, document.body.firstChild);
        }
        return _mainBackgroundImage;
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
        audio.initMusic(config.getSetting(config.GENERAL_SETTINGS.BRIEFING_MUSIC), exports.BRIEFING_THEME, true);
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
     * Shows the shared background image displayed behind the main / single player / settings menu screens. Safe to call from all three of
     * those screens' show handlers. Only plays the fade-in transition the very first time it is called (when the game starts) - every
     * subsequent call (re-entering the menus from another screen, or navigating between these three screens) shows it instantly, without
     * replaying the transition.
     */
    exports.showMenuBackground = function () {
        var element = _getMainBackgroundImage();
        if (!_mainBackgroundShown) {
            _mainBackgroundShown = true;
            components.playAppearTransition(element);
        } else {
            element.hidden = false;
        }
    };
    /**
     * Instantly hides the shared background image shown by showMenuBackground(). Call from all three of the main / single player / settings
     * menu screens' hide handlers.
     */
    exports.hideMenuBackground = function () {
        if (_mainBackgroundImage) {
            _mainBackgroundImage.hidden = true;
        }
    };
    /**
     * Call on the screen that has a fullscreen button to set up its event handlers
     */
    exports.setupFullscreenButton = function () {
        var button;
        if (game.usesElectron()) {
            this.getElement(FULLSCREEN_BUTTON_ID).hidden = true;
        } else {
            button = this.getElement(FULLSCREEN_BUTTON_ID);
            button.onclick = _toggleFullscreen;
            _updateFullscreenButton(button);
            document.onfullscreenchange = document.onwebkitfullscreenchange = document.onmozfullscreenchange = document.onMSFullscreenChange = function () {
                _updateFullscreenButton(button);
            };
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
        show: function () {
            exports.setupFullscreenButton.call(this);
            if (!this.isSuperimposed()) {
                audio.playMusic(exports.MENU_THEME);
            }
        },
        optionselect: exports.playButtonSelectSound,
        optionclick: exports.playButtonClickSound
    };
    /**
     * Same as MENU_EVENT_HANDLERS, but also shows / hides the shared main background image behind the screen - for the single player and
     * settings menu screens (the main menu screen sets up its own show/hide handlers, calling showMenuBackground() / hideMenuBackground()
     * directly, as it needs a custom show handler anyway). Not used for the in-game menu, which is superimposed over the running battle and
     * must not show this background over it.
     * @type Object.<String, Function>
     */
    exports.MENU_WITH_BACKGROUND_EVENT_HANDLERS = {
        show: function () {
            exports.showMenuBackground();
            exports.MENU_EVENT_HANDLERS.show.call(this);
        },
        hide: function () {
            exports.hideMenuBackground();
        },
        optionselect: exports.playButtonSelectSound,
        optionclick: exports.playButtonClickSound
    };
    /**
     * A style descriptor containing the CSS class names needed to create a MenuComponent
     * @type MenuComponent~Style
     */
    exports.MENU_STYLE = {
        cssFilename: exports.MENU_COMPONENT_CSS,
        menuClassName: exports.MENU_CLASS_NAME,
        buttonContainerClassName: exports.MENU_BUTTON_CONTAINER_CLASS_NAME,
        selectedButtonClassName: components.SELECTED_CLASS_NAME,
        disabledClassName: components.DISABLED_CLASS_NAME
    };
    // ------------------------------------------------------------------------------
    // Public interface of the module
    return exports;
});