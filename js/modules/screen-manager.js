/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides functions to add and access HTML screens of the application
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, plusplus: true */
/*global define */

/**
 * @param asyncResource ScreenManager is an AsyncResource as it tracks the loading state of the screens it manages
 */
define([
    "modules/async-resource"
], function (asyncResource) {
    "use strict";
    /**
     * The screen manager instance used to store and access screens
     * @type ScreenManager
     */
    var _screenManager;
    /**
     * @class
     * @extends AsyncResource
     */
    function ScreenManager() {
        asyncResource.AsyncResource.call(this);
        /**
         * The game's available screens stored in an associative array, with the 
         * keys being the names of the screens.
         * @type Object.<String, HTMLScreen>
         * @default {}
         */
        this._screens = {};
        /**
         * The list of screens that have been covered by superimposing (instead of
         * switching to) other pages on top.
         * @type HTMLScreen[]
         * @default []
         */
        this._coveredScreens = [];
        /**
         * A reference to the currently active (displayed) screen of the game.
         * @type HTMLScreen
         * @default null
         */
        this._currentScreen = null;
        /**
         * How many screens have been loaded and are ready to use so far
         * @type Number
         */
        this._screensLoaded = 0;
        /**
         * How many screens need to be loaded total
         * @type Number
         */
        this._screensToLoad = 0;
    }
    ScreenManager.prototype = new asyncResource.AsyncResource();
    ScreenManager.prototype.constructor = ScreenManager;
    /**
     * Gets the object corresponding to the currently set game screen.
     * @returns {HTMLScreen}
     */
    ScreenManager.prototype.getCurrentScreen = function () {
        return this._currentScreen;
    };
    /**
     * Returns the game screen with the specified name that the game has.
     * @param {String} screenName
     * @returns {HTMLScreen}
     */
    ScreenManager.prototype.getScreen = function (screenName) {
        return screenName ?
                this._screens[screenName] :
                this.getCurrentScreen();
    };
    /**
     * Adds a new screen to the list that can be set as current later.
     * @param {HTMLScreen} screen The new game screen to be added.
     * @param {Boolean} [replace=false] Wether to replace the current page content with this
     * screen's content.
     */
    ScreenManager.prototype.addScreen = function (screen, replace) {
        var screenName, onScreenReadyFunction = function () {
            this._screensLoaded++;
            if (this._screensLoaded === this._screensToLoad) {
                this.setToReady();
            }
        }.bind(this);
        // in replace mode, the current screens are all removed from te page
        if (replace === true) {
            for (screenName in this._screens) {
                if (this._screens.hasOwnProperty(screenName)) {
                    this._screens[screenName].removeFromPage();
                }
            }
        }
        this._screensToLoad++;
        this._screens[screen.getName()] = screen;
        if (replace === true) {
            screen.replacePageWithScreen(onScreenReadyFunction);
        } else {
            screen.addScreenToPage(onScreenReadyFunction);
        }

    };
    /**
     * Sets the current game screen to the one with the specified name (from the
     * list of available screens), including updating the HTML body.
     * @param {String} screenName
     * @param {Boolean} [superimpose=false] Whether the screen should be 
     * superimposed on top of the current one.
     * @param {Number[4]} [backgroundColor] The color of the background in case the
     * screen is set superimposed. @see HTMLScreen#superimposeOnPage
     */
    ScreenManager.prototype.setCurrentScreen = function (screenName, superimpose, backgroundColor) {
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
            screen.superimposeOnPage(backgroundColor);
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
     * If the current screen was superimposed, closes it, otherwise simply navigates to
     * (sets) the screen with the given name.
     * @param {String} screenName
     */
    ScreenManager.prototype.closeOrNavitageTo = function (screenName) {
        if (this.getCurrentScreen().isSuperimposed()) {
            this.closeSuperimposedScreen();
        } else {
            this.setCurrentScreen(screenName);
        }
    };
    /**
     * Updates the components on all screens to reflect the application's current state.
     */
    ScreenManager.prototype.updateAllScreens = function () {
        var screenName;
        for (screenName in this._screens) {
            if (this._screens.hasOwnProperty(screenName)) {
                this._screens[screenName].updateScreen();
            }
        }
    };
    _screenManager = new ScreenManager();
    return {
        getCurrentScreen: _screenManager.getCurrentScreen.bind(_screenManager),
        getScreen: _screenManager.getScreen.bind(_screenManager),
        addScreen: _screenManager.addScreen.bind(_screenManager),
        setCurrentScreen: _screenManager.setCurrentScreen.bind(_screenManager),
        closeSuperimposedScreen: _screenManager.closeSuperimposedScreen.bind(_screenManager),
        closeOrNavitageTo: _screenManager.closeOrNavitageTo.bind(_screenManager),
        updateAllScreens: _screenManager.updateAllScreens.bind(_screenManager),
        executeWhenReady: _screenManager.executeWhenReady.bind(_screenManager)
    };
});