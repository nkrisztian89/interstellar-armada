"use strict";

/**
 * @fileOverview This file defines the GameScreen class and its descendant
 * classes, which load and manipulate the DOM of the HTML pages and control
 * the rendering of scenes to the canvas elements.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
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

Application.createModule({name: "Screens",
    dependencies: [
        {script: "matrices.js"},
        {module: "Resource", from: "resource.js"},
        {module: "Components", from: "components.js"},
        {module: "Scene", from: "scene.js"},
        {module: "Logic", from: "logic.js"},
        {module: "Control", from: "control.js"},
        {module: "GL", from: "gl.js"}]}, function () {
    // create a reference to the used modules in the local scope for cleaner and
    // faster access
    var Resource = Application.Resource.Resource;
    var Components = Application.Components;
    var Scene = Application.Scene;
    var Logic = Application.Logic;
    var Control = Application.Control;
    var GL = Application.GL;

    /**
     * Defines a GameScreen object.
     * @class Holds the logical model of a screen of the game. The different
     * screens should be defined as descendants of this class.
     * @extends Resource
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     * @returns {GameScreen}
     */
    function GameScreen(name, source) {
        Resource.call(this);
        // general properties
        this._name = name;
        this._source = source;
        this._model = null;
        this._background = null;
        this._container = null;

        this._game = null;

        this._simpleComponents = new Array();
        this._externalComponents = new Array();

        // function to execute when the model is loaded
        this._onModelLoad = function () {
        };

        // source will be undefined when setting the prototypes for inheritance
        if (source !== undefined) {
            this.requestModelLoad();
        }
    }

    GameScreen.prototype = new Resource();
    GameScreen.prototype.constructor = GameScreen;

    GameScreen.prototype.setGame = function (game) {
        this._game = game;
    };

    /**
     * Initiates the asynchronous loading of the screen's structure from the
     * external HTML file.
     */
    GameScreen.prototype.requestModelLoad = function () {
        // send an asynchronous request to grab the HTML file containing the DOM of
        // this screen
        var self = this;
        Application.requestTextFile("screen", this._source, function (responseText) {
            self._model = document.implementation.createHTMLDocument(self._name);
            self._model.documentElement.innerHTML = responseText;
            self._onModelLoad();
            self.setToReady();
        });
    };

    /**
     * Getter for the _name property.
     * @returns {String}
     */
    GameScreen.prototype.getName = function () {
        return this._name;
    };

    /**
     * Replaces the current HTML page's body with the sctructure of the screen.
     */
    GameScreen.prototype.replacePageWithScreen = function () {
        document.body.innerHTML = "";
        this.addScreenToPage();
    };

    /**
     * Appends the content of the screen to the page in an invisible (display: none)
     * div.
     */
    GameScreen.prototype.addScreenToPage = function () {
        var self = this;
        this.executeWhenReady(function () {
            self._background = document.createElement("div");
            self._background.setAttribute("id", self._name + "PageBackground");
            self._background.className = "fullScreenFix";
            self._background.style.display = "none";
            self._container = document.createElement("div");
            self._container.setAttribute("id", self._name + "PageContainer");
            self._container.className = "fullScreenContainer";
            self._container.style.display = "none";
            self._container.innerHTML = self._model.body.innerHTML;
            var namedElements = self._container.querySelectorAll("[id]");
            for (var i = 0; i < namedElements.length; i++) {
                namedElements[i].setAttribute("id", self._name + "_" + namedElements[i].getAttribute("id"));
            }
            document.body.appendChild(self._background);
            document.body.appendChild(self._container);
            self._initializeComponents();
        });
    };

    GameScreen.prototype.show = function () {
        this.executeWhenReady(function () {
            this._container.style.display = "block";
        });
    };

    /**
     * Superimposes the screen on the current page, by appending a full screen
     * container and the screen structure as its child inside it.
     * @param {Number[3]} backgroundColor The color of the full screen background. ([r,g,b],
     * where all color components should be 0-255)
     * @param {Number} backgroundOpacity The opacity of the background (0.0-1.0)
     */
    GameScreen.prototype.superimposeOnPage = function (backgroundColor, backgroundOpacity) {
        this.executeWhenReady(function () {
            this._background.style.backgroundColor = "rgba(" + backgroundColor[0] + "," + backgroundColor[1] + "," + backgroundColor[2] + "," + backgroundOpacity + ")";
            this._background.style.display = "block";
            document.body.appendChild(this._background);
            document.body.appendChild(this._container);
            this.show();
        });
    };

    GameScreen.prototype.hide = function () {
        this.executeWhenReady(function () {
            this._container.style.display = "none";
            this._background.style.display = "none";
        });
    };

    /**
     * Tells whether the screen is superimposed on top of another one.
     * @returns {Boolean}
     */
    GameScreen.prototype.isSuperimposed = function () {
        return this._background.style.display !== "none";
    };

    /**
     * Executes the necessary actions required when closing the page. This method
     * only nulls out the default components, additional functions need to be added
     * in the descendant classes.
     */
    GameScreen.prototype.removeFromPage = function () {
        var i;
        for (i = 0; i < this._simpleComponents.length; i++) {
            this._simpleComponents[i].resetComponent();
        }
        for (var i = 0; i < this._externalComponents.length; i++) {
            this._externalComponents[i].component.resetComponent();
        }
        document.body.removeChild(this._background);
        document.body.removeChild(this._container);
        this._background = null;
        this._container = null;
    };

    /**
     * Setting the properties that will be used to easier access DOM elements later.
     * In descendants, this method should be overwritten, adding the additional
     * components of the screen after calling this parent method.
     */
    GameScreen.prototype._initializeComponents = function () {
        var i;
        for (i = 0; i < this._simpleComponents.length; i++) {
            this._simpleComponents[i].initComponent();
        }
        for (i = 0; i < this._externalComponents.length; i++) {
            var parentNode;
            if (this._externalComponents[i].parentNodeID !== undefined) {
                parentNode = document.getElementById(this._name + "_" + this._externalComponents[i].parentNodeID);
            }
            // otherwise just leave it undefined, nothing to pass to the method below
            this.addExternalComponent(this._externalComponents[i].component, parentNode);
        }
    };

    GameScreen.prototype.registerSimpleComponent = function (simpleComponentName) {
        var component = new Components.SimpleComponent(this._name + "_" + simpleComponentName);
        this._simpleComponents.push(component);
        return component;
    };

    GameScreen.prototype.registerExternalComponent = function (screenComponent, parentNodeID) {
        this._externalComponents.push({
            component: screenComponent,
            parentNodeID: parentNodeID
        });
        return screenComponent;
    };

    /**
     * Appends the elements of an external component (a HTML document fragment
     * defined in an external xml file) to the DOM tree and returns the same 
     * component.
     * @param {ScreenComponent} screenComponent
     * @param {Node} [parentNode] The node in the document to which to append the
     * component (if omitted, it will be appended to the body)
     * @returns {ScreenComponent}
     */
    GameScreen.prototype.addExternalComponent = function (screenComponent, parentNode) {
        screenComponent.appendToPage(parentNode);
        return screenComponent;
    };

    /**
     * Provides visual information to the user about the current status of the game.
     * @param {String} newStatus The new status to display.
     */
    GameScreen.prototype.updateStatus = function (newStatus) {
        if (this._status !== null) {
            this._status.setContent(newStatus);
        } else {
            alert(newStatus);
        }
    };

    /**
     * @class An enhanced canvas element (a wrapper around a regular HTML canvas), 
     * that can create and hold a reference to a managed WebGL context for the canvas.
     * @param {HTMLCanvasElement} canvas The canvas around which this object should
     * be created.
     * @returns {ScreenCanvas}
     */
    function ScreenCanvas(canvas) {
        this._canvas = canvas;
        this._name = canvas.getAttribute("id");
        this._resizeable = canvas.classList.contains("resizeable");
        this._context = null;
    }

    /**
     * Returns the stored HTML canvas element.
     * @returns {HTMLCanvasElement}
     */
    ScreenCanvas.prototype.getCanvasElement = function () {
        return this._canvas;
    };

    /**
     * Tells if the canvas is resizeable = if it has a dynamic size that changes
     * when the window is resized.
     * @returns {Boolean}
     */
    ScreenCanvas.prototype.isResizeable = function () {
        return this._resizeable;
    };

    /**
     * Returns a managed WebGL context created for the canvas. It creates the 
     * context if it does not exist yet.
     * @returns {ManagedGLContext}
     */
    ScreenCanvas.prototype.getManagedContext = function () {
        if (this._context === null) {
            this._context = new GL.ManagedGLContext(this._canvas.getAttribute("id"), this._canvas, Armada.graphics().getAntialiasing(), Armada.graphics().getFiltering());
        }
        return this._context;
    };

    /**
     * Defines a game screen with canvases object.
     * @class Represents a game screen that has one or more canvases where WebGL
     * scenes can be rendered.
     * @extends GameScreen
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     * @returns {GameScreenWithCanvases}
     */
    function GameScreenWithCanvases(name, source) {
        GameScreen.call(this, name, source);

        this._canvases = new Object();

        this._sceneCanvasBindings = new Array();

        this._renderLoop = null;

        this._renderTimes = null;

        this._resizeEventListener = null;
    }
    ;

    GameScreenWithCanvases.prototype = new GameScreen();
    GameScreenWithCanvases.prototype.constructor = GameScreenWithCanvases;

    /**
     * Stops the render loop and nulls out the components.
     */
    GameScreenWithCanvases.prototype.removeFromPage = function () {
        GameScreen.prototype.removeFromPage.call(this);

        this.stopRenderLoop();

        window.removeEventListener("resize", this._resizeEventListener);
        this._resizeEventListener = null;

        this._canvases = new Object();

        this._sceneCanvasBindings = new Array();

        Armada.resources().clearResourceContextBindings();
    };

    GameScreenWithCanvases.prototype.hide = function () {
        GameScreen.prototype.hide.call(this);
        this.stopRenderLoop();
    };

    /**
     * Initializes the components of the parent class, then the additional ones for
     * this class (the canvases).
     */
    GameScreenWithCanvases.prototype._initializeComponents = function () {
        GameScreen.prototype._initializeComponents.call(this);

        var canvasElements = document.getElementsByTagName("canvas");
        for (var i = 0; i < canvasElements.length; i++) {
            this._canvases[canvasElements[i].getAttribute("id")] = new ScreenCanvas(canvasElements[i]);
        }

        var self = this;
        this._resizeEventListener = function () {
            self.resizeCanvases.call(self);
        };
        window.addEventListener("resize", this._resizeEventListener);
    };

    /**
     * Returns the stored canvas component that has the passed name.
     * @param {String} name
     * @returns {ScreenCanvas}
     */
    GameScreenWithCanvases.prototype.getScreenCanvas = function (name) {
        return this._canvases[this._name + "_" + name];
    };

    /**
     * Creates a binding between the passed scene and canvas, causing the scene to
     * be rendered on the canvas automatically in the render loop of this screen.
     * @param {Scene} scene
     * @param {ScreenCanvas} canvas
     */
    GameScreenWithCanvases.prototype.bindSceneToCanvas = function (scene, canvas) {
        var alreadyBound = false;
        for (var i = 0; i < this._sceneCanvasBindings.length; i++) {
            if (
                    (this._sceneCanvasBindings[i].scene === scene) &&
                    (this._sceneCanvasBindings[i].canvas === canvas)
                    ) {
                alreadyBound = true;
            }
        }
        if (alreadyBound === false) {
            this._sceneCanvasBindings.push({
                scene: scene,
                canvas: canvas
            });
        }
        scene.addToContext(canvas.getManagedContext());
        if (this._renderLoop !== null) {
            canvas.getManagedContext().setupVertexBuffers();
            canvas.getManagedContext().setupFrameBuffers();
        }
    };

    /**
     * Renders the scenes displayed on this screen.
     */
    GameScreenWithCanvases.prototype.render = function () {
        var i;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].scene.cleanUp();
            this._sceneCanvasBindings[i].scene.render(this._sceneCanvasBindings[i].canvas.getManagedContext());
        }
        if (this._renderLoop !== null) {
            var d = new Date();
            this._renderTimes.push(d);
            while ((this._renderTimes.length > 1) && ((d - this._renderTimes[0]) > 1000)) {
                this._renderTimes.shift();
            }
        }
    };

    /**
     * Starts the render loop, by beginning to execute the render function every
     * interval milliseconds.
     * @param {Number} interval
     */
    GameScreenWithCanvases.prototype.startRenderLoop = function (interval) {
        var i;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].canvas.getManagedContext().setupVertexBuffers();
            this._sceneCanvasBindings[i].canvas.getManagedContext().setupFrameBuffers();
        }
        var self = this;
        this._renderTimes = [new Date()];
        this._renderLoop = setInterval(function () {
            self.render();
        }, interval);
    };

    /**
     * Stops the render loop.
     */
    GameScreenWithCanvases.prototype.stopRenderLoop = function () {
        clearInterval(this._renderLoop);
        this._renderLoop = null;
    };

    /**
     * Returns the Frames Per Second count for this screen's render loop.
     * @returns {Number}
     */
    GameScreenWithCanvases.prototype.getFPS = function () {
        return this._renderTimes.length;
    };

    GameScreenWithCanvases.prototype.resizeCanvas = function (name) {
        var i;
        var canvasElement = this._canvases[name].getCanvasElement();
        var width = canvasElement.clientWidth;
        var height = canvasElement.clientHeight;
        if (canvasElement.width !== width ||
                canvasElement.height !== height) {
            // Change the size of the canvas to match the size it's being displayed
            canvasElement.width = width;
            canvasElement.height = height;
        }
        // updated the variables in the scenes
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            if (this._sceneCanvasBindings[i].canvas === this._canvases[name]) {
                this._sceneCanvasBindings[i].scene.resizeViewport(
                        canvasElement.width,
                        canvasElement.height
                        );
            }
        }
    };

    /**
     * Updates all needed variables when the screen is resized (camera perspective
     * matrices as well!)
     */
    GameScreenWithCanvases.prototype.resizeCanvases = function () {
        // first, update the canvas width and height properties if the client width/
        // height has changed
        for (var canvasName in this._canvases) {
            if (this._canvases[canvasName].isResizeable() === true) {
                this.resizeCanvas(canvasName);
            }
        }
    };

    /**
     * Defines a battle screen object.
     * @class Represents the battle screen.
     * @extends GameScreenWithCanvases
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     * @returns {BattleScreen}
     */
    function BattleScreen(name, source) {
        GameScreenWithCanvases.call(this, name, source);

        this._stats = this.registerSimpleComponent("stats");
        this._ui = this.registerSimpleComponent("ui");
        this._smallHeader = this.registerSimpleComponent("smallHeader");
        this._bigHeader = this.registerSimpleComponent("bigHeader");

        this._debugLabel = this.registerSimpleComponent("debugLabel");

        this._crosshair = this.registerSimpleComponent("crosshair");

        var self = this;

        this._loadingBox = this.registerExternalComponent(new Components.LoadingBox(name + "_loadingBox", "loadingbox.html", "loadingbox.css"));
        this._infoBox = this.registerExternalComponent(new Components.InfoBox(name + "_infoBox", "infobox.html", "infobox.css", function () {
            self.pauseBattle();
        }, function () {
            self.resumeBattle();
        }));

        /**
         * @name BattleScreen#_level
         * @type Level
         */
        this._level = null;
        /**
         * @name BattleScreen#_battleScene
         * @type Scene
         */
        this._battleScene = null;
        this._simulationLoop = null;
        this._battleCursor = null;
    }
    ;

    BattleScreen.prototype = new GameScreenWithCanvases();
    BattleScreen.prototype.constructor = BattleScreen;

    BattleScreen.prototype.pauseBattle = function () {
        Armada.control().stopListening();
        this._battleCursor = document.body.style.cursor;
        document.body.style.cursor = 'default';
        clearInterval(this._simulationLoop);
        this._simulationLoop = null;
    };

    BattleScreen.prototype.resumeBattle = function () {
        document.body.style.cursor = this._battleCursor || 'default';
        if (this._simulationLoop === null) {
            var prevDate = new Date();
            var freq = 60;
            var self = this;

            this._simulationLoop = setInterval(function ()
            {
                var curDate = new Date();
                Armada.control().control();
                self._level.tick(curDate - prevDate);
                prevDate = curDate;
            }, 1000 / freq);
            Armada.control().startListening();
        } else {
            Application.showError("Trying to resume simulation while it is already going on!", "minor",
                    "No action was taken, to avoid double-running the simulation.");
        }

    };

    BattleScreen.prototype.hide = function () {
        GameScreenWithCanvases.prototype.hide.call(this);
        this.pauseBattle();
        this._level = null;
        this._battleScene = null;
    };

    /**
     * Initializes the components of the parent class, then the additional ones for
     * this class (the canvases).
     */
    BattleScreen.prototype._initializeComponents = function () {
        GameScreenWithCanvases.prototype._initializeComponents.call(this);
        var canvas = this.getScreenCanvas("battleCanvas").getCanvasElement();
        this._resizeEventListener2 = function () {
            Armada.control().setScreenCenter(canvas.width / 2, canvas.height / 2);
        };
        window.addEventListener("resize", this._resizeEventListener2);
        this._resizeEventListener2();
    };

    /**
     * Getter for the _loadingBox property.
     * @returns {LoadingBox}
     */
    BattleScreen.prototype.getLoadingBox = function () {
        return this._loadingBox;
    };

    /**
     * Getter for the _infoBox property.
     * @returns {InfoBox}
     */
    BattleScreen.prototype.getInfoBox = function () {
        return this._infoBox;
    };

    /**
     * Uses the loading box to show the status to the user.
     * @param {String} newStatus The status to show on the loading box. If
     * undefined, the status won't be updated.
     * @param {Number} newProgress The new value of the progress bar on the loading
     * box. If undefined, the value won't be updated.
     */
    BattleScreen.prototype.updateStatus = function (newStatus, newProgress) {
        if (newStatus !== undefined) {
            this._loadingBox.updateStatus(newStatus);
        }
        if (newProgress !== undefined) {
            this._loadingBox.updateProgress(newProgress);
        }
    };

    BattleScreen.prototype.setDebugLabel = function (message) {
        this._debugLabel.setContent(message);
    };

    /**
     * Hides the stats (FPS, draw stats) component.
     */
    BattleScreen.prototype.hideStats = function () {
        this._stats.hide();
    };

    /**
     * Hides the UI (information about controlled spacecraft) component.
     */
    BattleScreen.prototype.hideUI = function () {
        this._ui.hide();
    };

    /**
     * Shows the headers in the top center of the screen.
     */
    BattleScreen.prototype.showHeaders = function () {
        this._bigHeader.show();
        this._smallHeader.show();
    };

    /**
     * Hides the headers.
     */
    BattleScreen.prototype.hideHeaders = function () {
        this._bigHeader.hide();
        this._smallHeader.hide();
    };

    /**
     * Shows the stats (FPS, draw stats) component.
     */
    BattleScreen.prototype.showStats = function () {
        this._stats.show();
    };

    BattleScreen.prototype.showCrosshair = function () {
        this._crosshair.show();
    };

    BattleScreen.prototype.hideCrosshair = function () {
        this._crosshair.hide();
    };

    /**
     * Toggles the visibility of the texts (headers and statistics) on the screen.
     * @returns {undefined}
     */
    BattleScreen.prototype.toggleTextVisibility = function () {
        if (this._bigHeader.isVisible()) {
            this.hideHeaders();
            this.hideStats();
        } else {
            this.showHeaders();
            this.showStats();
        }
    };

    /**
     * Shows the UI (information about controlled spacecraft) component.
     */
    BattleScreen.prototype.showUI = function () {
        this._ui.show();
    };

    /**
     * Shows the given message to the user in an information box.
     * @param {String} message
     */
    BattleScreen.prototype.showMessage = function (message) {
        this._infoBox.updateMessage(message);
        this._infoBox.show();
    };

    /**
     * Updates the big header's content on the screen.
     * @param {String} content
     */
    BattleScreen.prototype.setHeaderContent = function (content) {
        this._bigHeader.setContent(content);
    };

    BattleScreen.prototype.render = function () {
        GameScreenWithCanvases.prototype.render.call(this);
        this._stats.setContent(this.getFPS() + "<br/>" + this._sceneCanvasBindings[0].scene.getNumberOfDrawnTriangles());
        var craft = this._level.getPilotedSpacecraft();
        this._ui.setContent(
                craft.getFlightMode() + " flight mode<br/>" +
                "speed: " + craft.getRelativeVelocityMatrix()[13].toFixed() +
                ((craft.getFlightMode() === "compensated") ? (" / " + craft._maneuveringComputer._speedTarget.toFixed()) : ""));
    };

    BattleScreen.prototype.startNewBattle = function (levelSourceFilename) {
        document.body.style.cursor = 'wait';
        this.hideStats();
        this.hideUI();
        this.hideCrosshair();
        this._loadingBox.show();
        this.resizeCanvases();
        Armada.control().setScreenCenter(
                this.getScreenCanvas("battleCanvas").getCanvasElement().width / 2,
                this.getScreenCanvas("battleCanvas").getCanvasElement().height / 2);

        this._level = new Logic.Level();

        var self = this;

        this._level.onLoad = function () {
            self.updateStatus("loading additional configuration...", 5);
            self._level.addRandomShips("human", {falcon: 30, viper: 10, aries: 5, taurus: 10}, 3000);

            self.updateStatus("building scene...", 10);
            var canvas = self.getScreenCanvas("battleCanvas").getCanvasElement();
            self._battleScene = new Scene.Scene(
                    0, 0, canvas.width, canvas.height,
                    true, [true, true, true, true],
                    [0, 0, 0, 1], true,
                    Armada.graphics().getLODContext(),
                    {
                        enable: Armada.graphics().getShadowMapping(),
                        shader: Armada.resources().getShader("shadowMapping"),
                        textureSize: Armada.graphics().getShadowQuality(),
                        ranges: Armada.graphics().getShadowRanges(),
                        depthRatio: Armada.graphics().getShadowDepthRatio()
                    });
            self._level.buildScene(self._battleScene);

            Armada.control().getController("general").setLevel(self._level);
            Armada.control().getController("camera").setControlledCamera(self._battleScene.activeCamera);

            self.updateStatus("loading graphical resources...", 15);
            Armada.resources().onResourceLoad = function (resourceName, totalResources, loadedResources) {
                self.updateStatus("loaded " + resourceName + ", total progress: " + loadedResources + "/" + totalResources, 20 + (loadedResources / totalResources) * 60);
            };
            var freq = 60;
            Armada.resources().executeWhenReady(function () {
                self.updateStatus("initializing WebGL...", 75);
                self.bindSceneToCanvas(self._battleScene, self.getScreenCanvas("battleCanvas"));
                self._level.addProjectileResourcesToContext(self.getScreenCanvas("battleCanvas").getManagedContext());
                self.updateStatus("", 100);
                self._smallHeader.setContent("running an early test of Interstellar Armada, version: " + Armada.getVersion());
                Armada.control().switchToSpectatorMode();
                self._battleCursor = document.body.style.cursor;
                self.showMessage("Ready!");
                self.getLoadingBox().hide();
                self.showStats();
                self.startRenderLoop(1000 / freq);
            });

            Armada.resources().requestResourceLoad();
        };

        self.updateStatus("loading level information...", 0);
        this._level.requestLoadFromFile(levelSourceFilename);
    };

    /**
     * Defines a database screen object.
     * @class Represents the database screen.
     * @extends GameScreenWithCanvases
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     * @returns {DatabaseScreen}
     */
    function DatabaseScreen(name, source) {
        GameScreenWithCanvases.call(this, name, source);

        this._itemName = this.registerSimpleComponent("itemName");
        this._itemType = this.registerSimpleComponent("itemType");
        this._itemDescription = this.registerSimpleComponent("itemDescription");

        this._backButton = this.registerSimpleComponent("backButton");
        this._prevButton = this.registerSimpleComponent("prevButton");
        this._nextButton = this.registerSimpleComponent("nextButton");
        this._loadingBox = this.registerExternalComponent(new Components.LoadingBox(name + "_loadingBox", "loadingbox.html", "loadingbox.css"));

        this._scene = null;
        this._item = null;
        this._itemIndex = null;
        this._animationLoop = null;
        this._revealLoop = null;
        this._rotationLoop = null;
        this._solidModel = null;
        this._wireframeModel = null;

        this._mousePos = null;
    }
    ;

    DatabaseScreen.prototype = new GameScreenWithCanvases();
    DatabaseScreen.prototype.constructor = DatabaseScreen;

    /**
     * Nulls out the components.
     */
    DatabaseScreen.prototype.removeFromPage = function () {
        GameScreenWithCanvases.prototype.removeFromPage.call(this);

        this._itemLength = null;
        this._itemLengthInMeters = null;
        this._itemFront = null;
        this._revealState = null;

        this.stopRevealLoop();
        this.stopRotationLoop();
        this._item = null;
        this._itemIndex = null;
        this._scene = null;
        this._solidModel = null;
        this._wireframeModel = null;

        this._mousePos = null;
    };

    /**
     * Initializes the components of the parent class, then the additional ones for
     * this class.
     */
    DatabaseScreen.prototype._initializeComponents = function () {
        GameScreenWithCanvases.prototype._initializeComponents.call(this);

        var self = this;

        this._backButton.getElement().onclick = function () {
            self.stopRevealLoop();
            self.stopRotationLoop();
            if (self.isSuperimposed()) {
                self._game.closeSuperimposedScreen();
            } else {
                self._game.setCurrentScreen('mainMenu');
            }
        };
        this._prevButton.getElement().onclick = function () {
            self.selectPreviousShip();
        };
        this._nextButton.getElement().onclick = function () {
            self.selectNextShip();
        };
    };

    /**
     * Getter for the _loadingBox property.
     * @returns {LoadingBox}
     */
    DatabaseScreen.prototype.getLoadingBox = function () {
        return this._loadingBox;
    };

    /**
     * Uses the loading box to show the status to the user.
     * @param {String} newStatus The status to show on the loading box. If
     * undefined, the status won't be updated.
     * @param {Number} newProgress The new value of the progress bar on the loading
     * box. If undefined, the value won't be updated.
     */
    DatabaseScreen.prototype.updateStatus = function (newStatus, newProgress) {
        if (newStatus !== undefined) {
            this._loadingBox.updateStatus(newStatus);
        }
        if (newProgress !== undefined) {
            this._loadingBox.updateProgress(newProgress);
        }
    };

    DatabaseScreen.prototype.startRevealLoop = function () {
        var prevDate = new Date();
        var self = this;
        this._revealLoop = setInterval(function ()
        {
            var curDate = new Date();
            if (self._revealState < 2.0) {
                self._revealState += (curDate - prevDate) / 1000 / 2;
            } else {
                self.stopRevealLoop();
            }
            prevDate = curDate;
        }, 1000 / 60);
    };

    DatabaseScreen.prototype.startRotationLoop = function () {
        // turn the ship to start the rotation facing the camera
        this._solidModel.setOrientationMatrix(Mat.identity4());
        this._solidModel.rotate([0.0, 0.0, 1.0], Math.PI);
        this._solidModel.rotate([1.0, 0.0, 0.0], 60 / 180 * Math.PI);
        this._wireframeModel.setOrientationMatrix(Mat.identity4());
        this._wireframeModel.rotate([0.0, 0.0, 1.0], Math.PI);
        this._wireframeModel.rotate([1.0, 0.0, 0.0], 60 / 180 * Math.PI);
        var prevDate = new Date();
        var self = this;
        this._rotationLoop = setInterval(function ()
        {
            var curDate = new Date();
            self._solidModel.rotate(self._item.visualModel.getZDirectionVector(), (curDate - prevDate) / 1000 * Math.PI / 2);
            self._wireframeModel.rotate(self._item.visualModel.getZDirectionVector(), (curDate - prevDate) / 1000 * Math.PI / 2);
            prevDate = curDate;
        }, 1000 / 60);
    };

    DatabaseScreen.prototype.stopRevealLoop = function () {
        clearInterval(this._revealLoop);
        this._revealLoop = null;
    };

    DatabaseScreen.prototype.stopRotationLoop = function () {
        clearInterval(this._rotationLoop);
        this._rotationLoop = null;
    };

    DatabaseScreen.prototype.show = function () {
        GameScreenWithCanvases.prototype.show.call(this);
        this.executeWhenReady(function () {
            this.initializeCanvas();
        });
    };

    DatabaseScreen.prototype.hide = function () {
        GameScreenWithCanvases.prototype.hide.call(this);
        this.executeWhenReady(function () {
            this._scene.clearObjects();
            this.render();
        });
    };

    DatabaseScreen.prototype.initializeCanvas = function () {
        var self = this;

        this._loadingBox.show();
        this.updateStatus("initializing database...", 0);

        this.resizeCanvas(this._name + "_databaseCanvas");
        var canvas = this.getScreenCanvas("databaseCanvas").getCanvasElement();
        // create a new scene and add a directional light source which will not change
        // while different objects are shown
        this._scene = new Scene.Scene(
                0, 0, canvas.clientWidth, canvas.clientHeight,
                true, [true, true, true, true],
                [0, 0, 0, 0], true,
                Armada.graphics().getLODContext(),
                {
                    enable: Armada.graphics().getShadowMapping(),
                    shader: Armada.resources().getShader("shadowMapping"),
                    textureSize: Armada.graphics().getShadowQuality(),
                    ranges: [],
                    depthRatio: Armada.graphics().getShadowDepthRatio()
                });
        this._scene.addLightSource(new Scene.LightSource([1.0, 1.0, 1.0], [0.0, 1.0, 1.0]));

        Armada.resources().onResourceLoad = function (resourceName, totalResources, loadedResources) {
            self.updateStatus("loaded " + resourceName + ", total progress: " + loadedResources + "/" + totalResources, 20 + (loadedResources / totalResources) * 60);
        };
        Armada.resources().executeWhenReady(function () {
            self.updateStatus("", 100);
            self._loadingBox.hide();
        });

        this.updateStatus("loading graphical resources...", 15);

        this._itemIndex = 0;
        this.loadShip();

        // when the user presses the mouse on the canvas, he can start rotating the model
        // by moving the mouse
        canvas.onmousedown = function (e) {
            self._mousePos = [e.screenX, e.screenY];
            // automatic rotation should stop for the time of manual rotation
            self.stopRotationLoop();
            // the mouse might go out from over the canvas during rotation, so register the
            // move event handler on the document body
            document.body.onmousemove = function (e) {
                self._solidModel.rotate([0.0, 1.0, 0.0], -(e.screenX - self._mousePos[0]) / 180 * Math.PI);
                self._solidModel.rotate([1.0, 0.0, 0.0], -(e.screenY - self._mousePos[1]) / 180 * Math.PI);
                self._wireframeModel.rotate([0.0, 1.0, 0.0], -(e.screenX - self._mousePos[0]) / 180 * Math.PI);
                self._wireframeModel.rotate([1.0, 0.0, 0.0], -(e.screenY - self._mousePos[1]) / 180 * Math.PI);
                self._mousePos = [e.screenX, e.screenY];
            };
            // once the user releases the mouse button, the event handlers should be cancelled
            // and the automatic rotation started again
            document.body.onmouseup = function (e) {
                document.body.onmousemove = null;
                document.body.onmouseup = null;
                self.startRotationLoop();
                e.preventDefault();
                return false;
            };
            e.preventDefault();
            return false;
        };
    };

    /**
     * Selects and displays the previous spacecraft class from the list on the database
     * screen. Loops around.
     */
    DatabaseScreen.prototype.selectPreviousShip = function () {
        // using % operator does not work with -1, reverted to "if"
        this._itemIndex -= 1;
        if (this._itemIndex === -1) {
            this._itemIndex = Armada.logic().getSpacecraftClasses().length - 1;
        }
        this.loadShip();
    };

    /**
     * Selects and displays the next spacecraft class from the list on the database
     * screen. Loops around.
     */
    DatabaseScreen.prototype.selectNextShip = function () {
        this._itemIndex = (this._itemIndex + 1) % Armada.logic().getSpacecraftClasses().length;
        this.loadShip();
    };

    /**
     * Load the information and model of the currently selected ship and display
     * them on the page.
     */
    DatabaseScreen.prototype.loadShip = function () {
        // the execution might take a few seconds, and is in the main thread, so
        // better inform the user
        document.body.style.cursor = 'wait';
        // stop the possible ongoing loops that display the previous ship to avoid
        // null reference
        this.stopRevealLoop();
        this.stopRotationLoop();
        this.stopRenderLoop();

        // clear the previous scene graph and render the empty scene to clear the
        // background of the canvas to transparent
        this._scene.clearObjects();
        this.render();

        var self = this;
        Armada.logic().executeWhenReady(function () {
            // display the data that can be displayed right away, and show loading
            // for the rest
            var shipClass = Armada.logic().getSpacecraftClasses()[self._itemIndex];
            self._itemName.setContent(shipClass.fullName);
            self._itemType.setContent(shipClass.spacecraftType.fullName);
            self._itemDescription.setContent("Loading...");

            // create a ship that can be used to add the models (ship with default weapons
            // to the scene
            self._item = new Logic.Spacecraft(
                    shipClass,
                    "",
                    Mat.identity4(),
                    Mat.identity4(),
                    null,
                    "default"
                    );
            // add the ship to the scene in triangle drawing mode
            self._solidModel = self._item.addToScene(self._scene, Armada.graphics().getMaxLoadedLOD(), false, true, false, false);
            // set the shader to reveal, so that we have a nice reveal animation when a new ship is selected
            self._solidModel.cascadeSetShader(Armada.graphics().getShadowMapping() ?
                    Armada.resources().getShader("shadowMapReveal")
                    : Armada.resources().getShader("simpleReveal"));
            // set the necessary uniform functions for the reveal shader
            self._solidModel.setUniformValueFunction("u_revealFront", function () {
                return true;
            });
            self._solidModel.setUniformValueFunction("u_revealStart", function () {
                return self._itemFront - ((self._revealState - 1.0) * self._itemLength * 1.1);
            });
            self._solidModel.setUniformValueFunction("u_revealTransitionLength", function () {
                return self._itemLength / 10;
            });
            // add the ship to the scene in line drawing mode as well
            self._wireframeModel = self._item.addToScene(self._scene, Armada.graphics().getMaxLoadedLOD(), false, true, false, true);
            // set the shader to one colored reveal, so that we have a nice reveal animation when a new ship is selected
            self._wireframeModel.cascadeSetShader(Armada.resources().getShader("oneColorReveal"));
            // set the necessary uniform functions for the one colored reveal shader
            self._wireframeModel.setUniformValueFunction("u_color", function () {
                return [0.0, 1.0, 0.0, 1.0];
            });
            self._wireframeModel.setUniformValueFunction("u_revealFront", function () {
                return (self._revealState <= 1.0);
            });
            self._wireframeModel.setUniformValueFunction("u_revealStart", function () {
                return self._itemFront - ((self._revealState > 1.0 ? (self._revealState - 1.0) : self._revealState) * self._itemLength * 1.1);
            });
            self._wireframeModel.setUniformValueFunction("u_revealTransitionLength", function () {
                return (self._revealState <= 1.0) ? (self._itemLength / 10) : 0;
            });

            // set the callback for when the potentially needed additional file resources have 
            // been loaded
            Armada.resources().executeWhenReady(function () {
                // get the length of the ship based on the length of its model
                self._itemLength = self._item.visualModel.modelsWithLOD[0].model.getHeight();
                self._itemLengthInMeters = self._item.visualModel.modelsWithLOD[0].model.getHeightInMeters();
                self._itemFront = self._item.visualModel.modelsWithLOD[0].model.getMaxY();
                self._itemDescription.setContent(
                        shipClass.description + "<br/>" +
                        "<br/>" +
                        "Length: " + (((self._itemLengthInMeters) < 100) ?
                                (self._itemLengthInMeters).toPrecision(3)
                                : Math.round(self._itemLengthInMeters)) +
                        " m<br/>" +
                        "Weapon slots: " + shipClass.weaponSlots.length + "<br/>" +
                        "Thrusters: " + shipClass.thrusterSlots.length);
                // this will create the GL context if needed or update it with the new
                // data if it already exists
                self.bindSceneToCanvas(self._scene, self.getScreenCanvas("databaseCanvas"));
                // set the camera position so that the whole ship nicely fits into the picture
                self._scene.activeCamera.setPositionMatrix(Mat.translation4(0, 0, -self._item.visualModel.getScaledSize()));
                if(Armada.graphics().getShadowMapping()) {
                    self._scene.setShadowMapRanges([
                        0.5 * self._item.visualModel.getScaledSize(),
                        self._item.visualModel.getScaledSize()
                    ]);
                    self._scene.enableShadowMapping();
                } else {
                    self._scene.disableShadowMapping();
                }

                self._revealState = 0.0;

                self.startRenderLoop(1000 / 60);
                self.startRevealLoop();
                self.startRotationLoop();
                document.body.style.cursor = 'default';
            });

            // initiate the loading of additional file resources if they are needed
            Armada.resources().requestResourceLoad();
        });
    };

    /**
     * Defines a graphics setting screen object.
     * @class Represents the graphics settings screen.
     * @extends GameScreen
     * @param {String} name @see GameScreen
     * @param {String} source @see GameScreen
     * @returns {GraphicsScreen}
     */
    function GraphicsScreen(name, source) {
        GameScreen.call(this, name, source);

        this._backButton = this.registerSimpleComponent("backButton");
        this._defaultsButton = this.registerSimpleComponent("defaultsButton");
        this._antialiasingSelector = this.registerExternalComponent(new Components.Selector(name + "_aaSelector", "selector.html", "selector.css", "Anti-aliasing:", ["on", "off"]), "settingsDiv");
        this._filteringSelector = this.registerExternalComponent(new Components.Selector(name + "_filteringSelector", "selector.html", "selector.css", "Texture filtering:", ["bilinear", "trilinear", "anisotropic"]), "settingsDiv");
        this._lodSelector = this.registerExternalComponent(new Components.Selector(name + "_lodSelector", "selector.html", "selector.css", "Model details:", ["very low", "low", "medium", "high", "very high"]), "settingsDiv");
        this._shadowMappingSelector = this.registerExternalComponent(new Components.Selector(name + "_shadowMappingSelector", "selector.html", "selector.css", "Shadows:", ["on", "off"]), "settingsDiv");
        this._shadowQualitySelector = this.registerExternalComponent(new Components.Selector(name + "_shadowQualitySelector", "selector.html", "selector.css", "Shadow quality:", ["low", "medium", "high"]), "settingsDiv");
        this._shadowDistanceSelector = this.registerExternalComponent(new Components.Selector(name + "_shadowDistanceSelector", "selector.html", "selector.css", "Shadow distance:", ["very close", "close", "medium", "far", "very far"]), "settingsDiv");
    }
    ;

    GraphicsScreen.prototype = new GameScreen();
    GraphicsScreen.prototype.constructor = GraphicsScreen;

    GraphicsScreen.prototype._initializeComponents = function () {
        GameScreen.prototype._initializeComponents.call(this);

        var self = this;
        this._backButton.getElement().onclick = function () {
            Armada.graphics().setAntialiasing((self._antialiasingSelector.getSelectedValue() === "on"));
            Armada.graphics().setFiltering(self._filteringSelector.getSelectedValue());
            Armada.graphics().setMaxLOD(self._lodSelector.getSelectedIndex());
            Armada.graphics().setShadowMapping((self._shadowMappingSelector.getSelectedValue() === "on"));
            Armada.graphics().setShadowQuality((function (v) {
                var mapping = {
                    "low": 1024,
                    "medium": 2048,
                    "high": 4096
                };
                return mapping[v];
            }(self._shadowQualitySelector.getSelectedValue())));
            Armada.graphics().setShadowDistance((function (v) {
                var mapping = {
                    "very close": 2,
                    "close": 3,
                    "medium": 4,
                    "far": 5,
                    "very far": 6
                };
                return mapping[v];
            }(self._shadowDistanceSelector.getSelectedValue())));
            if (self.isSuperimposed()) {
                self._game.closeSuperimposedScreen();
            } else {
                self._game.setCurrentScreen('settings');
            }
            return false;
        };
        this._defaultsButton.getElement().onclick = function () {
            Armada.graphics().restoreDefaults();
            self.updateValues();
            return false;
        };

        this.updateValues();
    };

    GraphicsScreen.prototype.updateValues = function () {
        var self = this;
        Armada.graphics().executeWhenReady(function () {
            self._antialiasingSelector.selectValue((Armada.graphics().getAntialiasing() === true) ? "on" : "off");
            self._filteringSelector.selectValue(Armada.graphics().getFiltering());
            self._lodSelector.selectValueWithIndex(Armada.graphics().getMaxLoadedLOD());
            self._shadowMappingSelector.selectValue((Armada.graphics().getShadowMapping() === true) ? "on" : "off");
            self._shadowQualitySelector.selectValue(function (v) {
                switch (v) {
                    case 1024:
                        return "low";
                    case 2048:
                        return "medium";
                    case 4096:
                        return "high";
                    default:
                        return "medium";
                }
            }((Armada.graphics().getShadowQuality())));
            self._shadowDistanceSelector.selectValue(function (v) {
                switch (v) {
                    case 2:
                        return "very close";
                    case 3:
                        return "close";
                    case 4:
                        return "medium";
                    case 5:
                        return "far";
                    case 6:
                        return "very far";
                    default:
                        return "medium";
                }
            }((Armada.graphics().getShadowDistance())));
        });
    };

    /**
     * Defines a controls screen object.
     * @class Represents the controls screen, where the user can set up the game
     * controls.
     * @extends GameScreen
     * @param {String} name @see GameScreen
     * @param {String} source @see GameScreen
     * @returns {ControlsScreen}
     */
    function ControlsScreen(name, source) {
        GameScreen.call(this, name, source);
        this._backButton = this.registerSimpleComponent("backButton");
        this._defaultsButton = this.registerSimpleComponent("defaultsButton");
        /**
         * The name of the action currently being set (to get triggered by a new 
         * key). If null, the user is not setting any actions.
         * @name ControlsScreen#_actionUnderSetting
         * @type String
         */
        this._actionUnderSetting = null;
        /**
         * While the user sets a new key, this property tells if shift is pressed
         * down.
         * @name ControlsScreen#_settingShiftState
         * @type Boolean
         */
        this._settingShiftState = null;
        /**
         * While the user sets a new key, this property tells if control is pressed
         * down.
         * @name ControlsScreen#_settingCtrlState
         * @type Boolean
         */
        this._settingCtrlState = null;
        /**
         * While the user sets a new key, this property tells if alt is pressed
         * down.
         * @name ControlsScreen#_settingAltState
         * @type Boolean
         */
        this._settingAltState = null;
    }
    ;

    ControlsScreen.prototype = new GameScreen();
    ControlsScreen.prototype.constructor = ControlsScreen;

    /**
     * Refreshes the cell showing the currently set key for the given action in the
     * UI. (call after the key has changed)
     * @param {String} actionName
     */
    ControlsScreen.prototype.refreshKeyForAction = function (actionName) {
        document.getElementById(actionName).innerHTML = Armada.control().getInterpreter("keyboard").getControlStringForAction(actionName);
        document.getElementById(actionName).className = "clickable";
    };

    /**
     * Handler for the keydown event to be active while the user is setting a new key
     * for an action. Updates the shift, control and alt states if one of those keys
     * is pressed, so that key combinations such as "ctrl + left" can be set.
     * @param {KeyboardEvent} event
     */
    ControlsScreen.prototype.handleKeyDownWhileSetting = function (event) {
        if (event.keyCode === 16) {
            this._settingShiftState = true;
        }
        if (event.keyCode === 17) {
            this._settingCtrlState = true;
        }
        if (event.keyCode === 18) {
            this._settingAltState = true;
        }
    };

    /**
     * Handler for the keyp event to be active while the user is setting a new key
     * for an action. This actually sets the key to the one that has been released,
     * taking into account the shift, control and alt states as well.
     * @param {KeyboardEvent} event
     */
    ControlsScreen.prototype.handleKeyUpWhileSetting = function (event) {
        // if we released shift, ctrl or alt, update their state
        // (assigning shift, ctrl or alt as a single key to an action is not allowed
        // at the moment, as assigning them to a continuous action would break
        // functionality of other continuous actions that the user would wish to
        // apply simultaneously, since after the press the shift/ctrl/alt state
        // would be different)
        if (event.keyCode === 16) {
            this._settingShiftState = false;
        } else if (event.keyCode === 17) {
            this._settingCtrlState = false;
        } else if (event.keyCode === 18) {
            this._settingAltState = false;
        } else {
            // if it was any other key, respect the shift, ctrl, alt states and set the
            // new key for the action
            var interpreter = Armada.control().getInterpreter("keyboard");
            interpreter.setAndStoreKeyBinding(new Control.KeyBinding(
                    this._actionUnderSetting,
                    Control.KeyboardInputInterpreter.prototype.getKeyOfCode(event.keyCode),
                    this._settingShiftState,
                    this._settingCtrlState,
                    this._settingAltState
                    ));
            this.stopKeySetting();
        }
    };

    /**
     * Cancels an ongoing key setting by updating the internal state, refreshing the
     * UI (cancelling highlight and restoring it to show the original key) and cancelling
     * key event handlers.
     */
    ControlsScreen.prototype.stopKeySetting = function () {
        if (this._actionUnderSetting !== null) {
            this.refreshKeyForAction(this._actionUnderSetting);
            this._actionUnderSetting = null;
            document.onkeydown = null;
            document.onkeyup = null;
        }
    };

    /**
     * Starts setting a new key for an action. Highlights the passed element and
     * sets up the key event handlers to update the action represented by this
     * element.
     * @param {Element} tdElement
     */
    ControlsScreen.prototype.startKeySetting = function (tdElement) {
        var actionName = tdElement.getAttribute("id");
        // if we are already in the process of setting this action, just cancel it,
        // so setting an action can be cancelled by clicking on the same cell again
        if (this._actionUnderSetting === actionName) {
            this.stopKeySetting();
            // otherwise cancel if we are in a process of setting another action, and 
            // then start setting this one
        } else {
            this.stopKeySetting();
            this._actionUnderSetting = actionName;
            tdElement.innerHTML = "?";
            tdElement.className = "highlightedItem";
            this._settingShiftState = false;
            this._settingCtrlState = false;
            this._settingAltState = false;
            var self = this;
            document.onkeydown = function (event) {
                self.handleKeyDownWhileSetting(event);
            };
            document.onkeyup = function (event) {
                self.handleKeyUpWhileSetting(event);
            };
        }
    };

    /**
     * Initializes the buttons and adds the table showing the current control settings.
     */
    ControlsScreen.prototype._initializeComponents = function () {
        GameScreen.prototype._initializeComponents.call(this);

        var self = this;
        this._backButton.getElement().onclick = function () {
            self.stopKeySetting();
            if (self._game.getCurrentScreen().isSuperimposed()) {
                self._game.closeSuperimposedScreen();
            } else {
                self._game.setCurrentScreen('settings');
            }
            return false;
        };
        this._defaultsButton.getElement().onclick = function () {
            self.stopKeySetting();
            Armada.control().restoreDefaults();
            self.generateTables();
            return false;
        };

        this.generateTables();
    };

    /**
     * Adds the table showing available actions and their assigned keys as well as
     * sets up a click handler for the cells showing the keys to initiate a change
     * of that key binding.
     */
    ControlsScreen.prototype.generateTables = function () {
        var self = this;

        var tablesContainer = document.getElementById(this._name + "_tablesContainer");
        tablesContainer.innerHTML = "";
        var gameControllers = Armada.control().getControllers();
        for (var i = 0; i < gameControllers.length; i++) {
            var h2Element = document.createElement("h2");
            h2Element.innerHTML = gameControllers[i].getType() + " controls";
            tablesContainer.appendChild(h2Element);
            var tableElement = document.createElement("table");
            tableElement.className = "horizontallyCentered outerContainer";
            var theadElement = document.createElement("thead");
            for (var j = 0, n = Armada.control().getInputInterpreters().length; j < n; j++) {
                var thElement = document.createElement("th");
                thElement.innerHTML = Armada.control().getInputInterpreters()[j].getDeviceName();
                theadElement.appendChild(thElement);
            }
            theadElement.innerHTML += "<th>Action</th>";
            var tbodyElement = document.createElement("tbody");
            var actions = gameControllers[i].getActions();
            for (j = 0; j < actions.length; j++) {
                var trElement = document.createElement("tr");
                for (var k = 0, n = Armada.control().getInputInterpreters().length; k < n; k++) {
                    var td1Element = document.createElement("td");
                    if (Armada.control().getInputInterpreters()[k].getDeviceName() === "Keyboard") {
                        td1Element.setAttribute("id", actions[j].getName());
                        td1Element.className = "clickable";
                        td1Element.onclick = function () {
                            self.startKeySetting(this);
                        };
                    }
                    td1Element.innerHTML = Armada.control().getInputInterpreters()[k].getControlStringForAction(actions[j].getName());
                    trElement.appendChild(td1Element);
                }
                var td2Element = document.createElement("td");
                td2Element.innerHTML = actions[j].getDescription();
                trElement.appendChild(td2Element);
                tbodyElement.appendChild(trElement);
            }
            tableElement.appendChild(theadElement);
            tableElement.appendChild(tbodyElement);
            tablesContainer.appendChild(tableElement);
        }
    };

    /**
     * Defines a menu screen object.
     * @class A game screen with a {@link MenuComponent}.
     * @extends GameScreen
     * @param {String} name See {@link GameScreen}
     * @param {String} source See {@link GameScreen}
     * @param {Object[]} menuOptions The menuOptions for creating the {@link MenuComponent}
     * @param {String} [menuContainerID] The ID of the HTML element inside of which
     * the menu should be added (if omitted, it will be appended to body)
     * @returns {MenuScreen}
     */
    function MenuScreen(name, source, menuOptions, menuContainerID) {
        GameScreen.call(this, name, source);

        /**
         * @see MenuComponent
         * @name MenuScreen#_menuOptions 
         * @type Object[]
         */
        this._menuOptions = menuOptions;
        /**
         * The ID of the HTML element inside of which the menu will be added. If
         * undefined, it will be appended to the document body.
         * @name MenuScreen#_menuContainerID 
         * @type String
         */
        this._menuContainerID = menuContainerID;
        /**
         * The component generating the HTML menu.
         * @name MenuScreen#_menuComponent 
         * @type MenuComponent
         */
        this._menuComponent = this.registerExternalComponent(new Components.MenuComponent(name + "_menu", "menucomponent.html", this._menuOptions), this._menuContainerID);
    }
    ;

    MenuScreen.prototype = new GameScreen();
    MenuScreen.prototype.constructor = MenuScreen;

    /**
     * Creates an about screen object.
     * @class A class to represent the "About" screen in the game. Describes the
     * dynamic behaviour on that screen.
     * @param {String} name See {@link GameScreen}
     * @param {String} source See {@link GameScreen}
     * @returns {AboutScreen}
     */
    function AboutScreen(name, source) {
        GameScreen.call(this, name, source);

        this._backButton = this.registerSimpleComponent("backButton");
        /**
         * @name AboutScreen#_versionParagraph
         * @type SimpleComponent
         */
        this._versionParagraph = this.registerSimpleComponent("versionParagraph");
    }

    AboutScreen.prototype = new GameScreen();
    AboutScreen.prototype.constructor = AboutScreen;

    AboutScreen.prototype._initializeComponents = function () {
        GameScreen.prototype._initializeComponents.call(this);

        this._versionParagraph.setContent("Application version: " + Armada.getVersion());

        var self = this;
        this._backButton.getElement().onclick = function () {
            if (self._game.getCurrentScreen().isSuperimposed()) {
                self._game.closeSuperimposedScreen();
            } else {
                self._game.setCurrentScreen('mainMenu');
            }
            return false;
        };
    };

    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        GameScreen: GameScreen,
        GameScreenWithCanvases: GameScreenWithCanvases,
        BattleScreen: BattleScreen,
        DatabaseScreen: DatabaseScreen,
        GraphicsScreen: GraphicsScreen,
        ControlsScreen: ControlsScreen,
        MenuScreen: MenuScreen,
        AboutScreen: AboutScreen
    };
});