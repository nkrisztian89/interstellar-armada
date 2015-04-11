Application.createModule({name: "Game",
    dependencies: [
        {module: "Screens", from: "screens.js"},
        {module: "Graphics", from: "graphics.js"},
        {module: "Logic", from: "logic.js"},
        {module: "Control", from: "control.js"}]}, function () {
    // create a reference to the used modules in the local scope for cleaner and
    // faster access
    var Graphics = Application.Graphics;
    var Logic = Application.Logic;
    var Control = Application.Control;
    /**
     * Defines a Game object.
     * @class Holds the general properties and screens of the game.
     * @returns {Game}
     */
    function Game() {
        Application.log("Creating new game object...", 1);
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
        this.graphicsContext = new Graphics.GraphicsContext();
        /**
         * The logic context of the game, containing the domain specific model (e.g.
         * what classes of spaceships are there)
         * @name Game#logicContext
         * @type LogicContext
         */
        this.logicContext = new Logic.LogicContext();
        /**
         * The control context of the game, that can be used to bind input controls
         * to in-game actions.
         * @name Game#controlContext
         * @type ControlContext
         */
        this.controlContext = new Control.ControlContext();
        this.requestSettingsLoad();
        Application.log("Game object created.", 1);
    }

    /**
     * Sends an asynchronous request to get the XML file describing the game
     * settings and sets the callback function to set them.
     */
    Game.prototype.requestSettingsLoad = function () {
        var self = this;
        Application.requestXMLFile("config", "settings.xml", function (settingsXML) {
            Application.log("Loading game settings...", 1);
            self.graphicsContext.loadFromXMLTag(settingsXML.getElementsByTagName("graphics")[0]);
            self.graphicsContext.loadFromLocalStorage();
            self.logicContext.loadFromXML(settingsXML.getElementsByTagName("logic")[0]);
            self.controlContext.loadFromXML(settingsXML.getElementsByTagName("control")[0]);
            self.controlContext.loadFromLocalStorage();
        });
    };

    /**
     * Adds a new screen to the list that can be set as current later.
     * @param {GameScreen} screen The new game screen to be added.
     * @param {Boolean} [replace=false] Wether to replace the current page content with this
     * screen's content.
     */
    Game.prototype.addScreen = function (screen, replace) {
        if (replace === true) {
            for (var screenName in this._screens) {
                this._screens[screenName].removeFromPage();
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
     * @returns {GameScreen}
     */
    Game.prototype.getScreen = function (screenName) {
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
    Game.prototype.setCurrentScreen = function (screenName, superimpose, backgroundColor, backgroundOpacity) {
        var i;
        if ((superimpose !== true) && (this._currentScreen !== null)) {
            this._currentScreen.hide();
            for (i = 0; i < this._coveredScreens.length; i++) {
                this._coveredScreens[i].hide();
            }
        }
        var screen = this.getScreen(screenName);
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
    Game.prototype.closeSuperimposedScreen = function () {
        this._currentScreen.hide();
        this._currentScreen = this._coveredScreens.pop();
    };

    /**
     * Gets the object corresponding to the currently set game screen.
     * @returns {GameScreen}
     */
    Game.prototype.getCurrentScreen = function () {
        return this._currentScreen;
    };

    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        Game: Game
    };
});