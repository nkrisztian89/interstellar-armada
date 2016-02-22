/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file This module manages and provides the About screen of the application
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, window, document, setInterval, clearInterval */

/**
 * @param game Used for navigation and displaying the game version
 * @param screens The about screen is a subclass of HTMLScreen
 * @param strings Used for translation support
 * @param armadaScreens Used for navigation
 */
define([
    "modules/game",
    "modules/screens",
    "armada/strings",
    "armada/screens/shared"
], function (game, screens, strings, armadaScreens) {
    "use strict";
    var
            BACK_BUTTON_ID = "backButton",
            TITLE_HEADING_ID = "title",
            VERSION_PARAGRAPH_ID = "versionParagraph";
    /**
     * @class A class to represent the "About" screen in the game. Describes the
     * dynamic behaviour on that screen.
     * @extends HTMLScreen
     */
    function AboutScreen() {
        screens.HTMLScreen.call(this, armadaScreens.ABOUT_SCREEN_NAME, armadaScreens.ABOUT_SCREEN_SOURCE);
        /**
         * @type SimpleComponent
         */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /**
         * @type SimpleComponent
         */
        this._titleHeading = this.registerSimpleComponent(TITLE_HEADING_ID);
        /**
         * @type SimpleComponent
         */
        this._versionParagraph = this.registerSimpleComponent(VERSION_PARAGRAPH_ID);
    }
    AboutScreen.prototype = new screens.HTMLScreen();
    AboutScreen.prototype.constructor = AboutScreen;
    /**
     * @override
     */
    AboutScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    AboutScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._backButton.setContent(strings.get(strings.ABOUT.BACK));
        this._titleHeading.setContent(strings.get(strings.ABOUT.TITLE));
        this._versionParagraph.setContent(strings.get(strings.ABOUT.VERSION) + game.getVersion());
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        aboutScreen: new AboutScreen()
    };
});