/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * Usage:
 * TODO: explain usage
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true */
/*global define, Image */

define(function () {
    "use strict";

    /**
     * @class
     * @returns {ScreenManager}
     */
    function ScreenManager() {
        /**
         * The game's available screens stored in an associative array, with the 
         * keys being the names of the screens.
         * @type Object.<String,screens.GameScreen>
         * @default {}
         */
        this._screens = {};
        /**
         * The list of screens that have been covered by superimposing (instead of
         * switching to) other pages on top.
         * @type screens.GameScreen[]
         * @default []
         */
        this._coveredScreens = [];
        /**
         * A reference to the currently active (displayed) screen of the game.
         * @type screens.GameScreen
         * @default null
         */
        this._currentScreen = null;
    }

    /**
     * Adds a new screen to the list that can be set as current later.
     * @param {screens.GameScreen} screen The new game screen to be added.
     * @param {Boolean} [replace=false] Wether to replace the current page content with this
     * screen's content.
     */
    ScreenManager.prototype.addScreen = function (screen, replace) {
        var screenName;
        if (replace === true) {
            for (screenName in this._screens) {
                if (this._screens.hasOwnProperty(screenName)) {
                    this._screens[screenName].removeFromPage();
                }
            }
        }
        this._screens[screen.getName()] = screen;
        screen.setGame(this);
        if (replace === true) {
            screen.replacePageWithScreen();
        } else {
            screen.addScreenToPage();
        }
    };

    /**
     * Returns the game screen with the specified name that the game has.
     * @param {String} screenName
     * @returns {screens.GameScreen}
     */
    ScreenManager.prototype.getScreen = function (screenName) {
        return this._screens[screenName];
    };

    /**
     * Sets the current game screen to the one with the specified name (from the
     * list of available screens), including updating the HTML body.
     * @param {String} screenName
     * @param {Boolean} [superimpose=false] Whether the screen should be 
     * superimposed on top of the current one.
     * @param {Number[3]} [backgroundColor] The color of the background in case the
     * screen is set superimposed. @see screens.GameScreen#superimposeOnPage
     * @param {Number} [backgroundOpacity] The opacity of the background in case the
     * screen is set superimposed. @see screens.GameScreen#superimposeOnPage
     */
    ScreenManager.prototype.setCurrentScreen = function (screenName, superimpose, backgroundColor, backgroundOpacity) {
        var i, screen;
        if ((superimpose !== true) && (this._currentScreen !== null)) {
            this._currentScreen.hide();
            for (i = 0; i < this._coveredScreens.length; i++) {
                this._coveredScreens[i].hide();
            }
        }
        screen = this.getScreen(screenName);
        if (superimpose === true) {
            this._coveredScreens.push(this._currentScreen);
            screen.superimposeOnPage(backgroundColor, backgroundOpacity);
        } else {
            screen.show();
        }
        this._currentScreen = screen;
    };

    /**
     * Closes the topmost superimposed screen, revealing the one below.
     */
    ScreenManager.prototype.closeSuperimposedScreen = function () {
        this._currentScreen.hide();
        this._currentScreen = this._coveredScreens.pop();
    };

    /**
     * Gets the object corresponding to the currently set game screen.
     * @returns {screens.GameScreen}
     */
    ScreenManager.prototype.getCurrentScreen = function () {
        return this._currentScreen;
    };

    return {
        ScreenManager: ScreenManager
    };
});