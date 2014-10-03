/**
 * @fileOverview This file contains the {@link Game} class.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1-dev
 */

/**********************************************************************
    Copyright 2014 Krisztián Nagy
    
    This file is part of Interstellar Armada.

    Interstellar Armada is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Interstellar Armada is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Interstellar Armada.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

/**
 * Defines a Game object.
 * @class Holds the general properties of the game (the current context for the
 * different modules)
 * @returns {Game}
 */
function Game() {
    /**
     * The game's available screens stored in an associative array, with the 
     * keys being the names of the screens.
     * @name Game#_screens
     * @type Object
     * @default {}
     */
    this._screens = new Object();
    /**
     * The list of screens that have been covered by superimposing (instead of
     * switching to) other pages on top.
     * @name Game#_coveredScreens
     * @type GameScreen[]
     * @default []
     */
    this._coveredScreens = new Array();
    /**
     * A reference to the currently active (displayed) screen of the game.
     * @name Game#_currentScreen
     * @type GameScreen
     * @default null
     */
    this._currentScreen = null;
    
    /**
     * The graphics context of the game, that can be used to access and 
     * manipulate graphical resources.
     * @name Game#graphicsContext
     * @type GraphicsContext
     */
    this.graphicsContext = new GraphicsContext();
    /**
     * The logic context of the game, containing the domain specific model (e.g.
     * what classes of spaceships are there)
     * @name Game#logicContext
     * @type LogicContext
     */
    this.logicContext = new LogicContext();
    /**
     * The control context of the game, that can be used to bind input controls
     * to in-game actions.
     * @name Game#controlContext
     * @type ControlContext
     */
    this.controlContext = new KeyboardControlContext();
    
    this.requestSettingsLoad();
}

/**
 * Notifies the user of an error that happened while running the game.
 * @param {String} message The message to show.
 */
Game.prototype.showError = function(message) {
    alert(message);
};

/**
 * Sends an asynchronous request to get the XML file describing the game
 * settings and sets the callback function to set them.
 */
Game.prototype.requestSettingsLoad = function () {
    var request = new XMLHttpRequest();
    request.open('GET', getXMLFolder()+"settings.xml?123", true);
    var self = this;
    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            var settingsXML = this.responseXML;
            self.graphicsContext.loadFromXML(settingsXML.getElementsByTagName("graphics")[0]);
            self.logicContext.loadFromXML(settingsXML.getElementsByTagName("logic")[0]);
            self.controlContext.loadFromXML(settingsXML.getElementsByTagName("control")[0]);
        }
    };
    request.send(null);
};

/**
 * Adds a new screen to the list that can be set as current later.
 * @param {GameScreen} screen The new game screen to be added.
 */
Game.prototype.addScreen = function(screen) {
    this._screens[screen.getName()]=screen;
};

/**
 * Returns the game screen with the specified name that the game has.
 * @param {String} screenName
 * @returns {GameScreen}
 */
Game.prototype.getScreen = function(screenName) {
    return this._screens[screenName];
};

/**
 * Sets the current game screen to the one with the specified name (from the
 * list of available screens), including updating the HTML body.
 * @param {String} screenName
 * @param {Boolean} [superimpose=false] Whether the screen should be 
 * superimposed on top of the current one.
 * @param {Number[3]} [backgroundColor] The color of the background in case the
 * screen is set superimposed. @see GameScreen#superimposeOnPage
 * @param {Number} [backgroundOpacity] The opacity of the background in case the
 * screen is set superimposed. @see GameScreen#superimposeOnPage
 */
Game.prototype.setCurrentScreen = function(screenName,superimpose,backgroundColor,backgroundOpacity) {
    var i;
    if((superimpose!==true)&&(this._currentScreen!==null)) {
        this._currentScreen.closePage();
        for(i=0;i<this._coveredScreens.length;i++) {
            this._coveredScreens[i].closePage();
        }
    }
    var screen = this.getScreen(screenName);
    if(superimpose===true) {
        this._coveredScreens.push(this._currentScreen);
        screen.superimposeOnPage(backgroundColor,backgroundOpacity);
    } else {
        screen.buildPage();
    }
    this._currentScreen = screen;
};

/**
 * Closes the topmost superimposed screen, revealing the one below.
 */
Game.prototype.closeSuperimposedScreen = function() {
    this._currentScreen.closeSuperimposedPage();
    this._currentScreen=this._coveredScreens.pop();
};

/**
 * Gets the object corresponding to the currently set game screen.
 * @returns {GameScreen}
 */
Game.prototype.getCurrentScreen = function() {
    return this._currentScreen;
};