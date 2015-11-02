/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define */

define([
    "modules/application",
    "modules/async-resource",
    "modules/components",
    "modules/managed-gl",
    "armada/armada"
], function (application, asyncResource, components, managedGL, armada) {
    "use strict";

    /**
     * @class Holds the logical model of a screen of the game. The different
     * screens should be defined as descendants of this class.
     * @extends asyncResource.AsyncResource
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     */
    function HTMLScreen(name, source) {
        asyncResource.AsyncResource.call(this);
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

    HTMLScreen.prototype = new asyncResource.AsyncResource();
    HTMLScreen.prototype.constructor = HTMLScreen;

    HTMLScreen.prototype.setGame = function (game) {
        this._game = game;
    };

    /**
     * Initiates the asynchronous loading of the screen's structure from the
     * external HTML file.
     */
    HTMLScreen.prototype.requestModelLoad = function () {
        // send an asynchronous request to grab the HTML file containing the DOM of
        // this screen
        var self = this;
        application.requestTextFile("screen", this._source, function (responseText) {
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
    HTMLScreen.prototype.getName = function () {
        return this._name;
    };

    /**
     * Replaces the current HTML page's body with the sctructure of the screen.
     */
    HTMLScreen.prototype.replacePageWithScreen = function () {
        document.body.innerHTML = "";
        this.addScreenToPage();
    };

    /**
     * Appends the content of the screen to the page in an invisible (display: none)
     * div.
     */
    HTMLScreen.prototype.addScreenToPage = function () {
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

    HTMLScreen.prototype.show = function () {
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
    HTMLScreen.prototype.superimposeOnPage = function (backgroundColor, backgroundOpacity) {
        this.executeWhenReady(function () {
            this._background.style.backgroundColor = "rgba(" + backgroundColor[0] + "," + backgroundColor[1] + "," + backgroundColor[2] + "," + backgroundOpacity + ")";
            this._background.style.display = "block";
            document.body.appendChild(this._background);
            document.body.appendChild(this._container);
            this.show();
        });
    };

    HTMLScreen.prototype.hide = function () {
        this.executeWhenReady(function () {
            this._container.style.display = "none";
            this._background.style.display = "none";
        });
    };

    /**
     * Tells whether the screen is superimposed on top of another one.
     * @returns {Boolean}
     */
    HTMLScreen.prototype.isSuperimposed = function () {
        return this._background.style.display !== "none";
    };

    /**
     * Executes the necessary actions required when closing the page. This method
     * only nulls out the default components, additional functions need to be added
     * in the descendant classes.
     */
    HTMLScreen.prototype.removeFromPage = function () {
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
    HTMLScreen.prototype._initializeComponents = function () {
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

    HTMLScreen.prototype.registerSimpleComponent = function (simpleComponentName) {
        var component = new components.SimpleComponent(this._name + "_" + simpleComponentName);
        this._simpleComponents.push(component);
        return component;
    };

    HTMLScreen.prototype.registerExternalComponent = function (screenComponent, parentNodeID) {
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
    HTMLScreen.prototype.addExternalComponent = function (screenComponent, parentNode) {
        screenComponent.appendToPage(parentNode);
        return screenComponent;
    };

    /**
     * Provides visual information to the user about the current status of the game.
     * @param {String} newStatus The new status to display.
     */
    HTMLScreen.prototype.updateStatus = function (newStatus) {
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
            this._context = new managedGL.ManagedGLContext(this._canvas.getAttribute("id"), this._canvas, armada.graphics().getAntialiasing(), armada.graphics().getFiltering());
        }
        return this._context;
    };

    /**
     * @class Represents a game screen that has one or more canvases where WebGL
     * scenes can be rendered.
     * @extends HTMLScreen
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     */
    function HTMLScreenWithCanvases(name, source) {
        HTMLScreen.call(this, name, source);

        this._canvases = new Object();

        this._sceneCanvasBindings = new Array();

        this._renderLoop = null;

        this._renderTimes = null;

        this._resizeEventListener = null;
    }
    ;

    HTMLScreenWithCanvases.prototype = new HTMLScreen();
    HTMLScreenWithCanvases.prototype.constructor = HTMLScreenWithCanvases;

    HTMLScreenWithCanvases.prototype.clearSceneCanvasBindings = function () {
        ///TODO: Scene.destroy
        this._sceneCanvasBindings = [];
    };

    /**
     * Stops the render loop and nulls out the components.
     */
    HTMLScreenWithCanvases.prototype.removeFromPage = function () {
        HTMLScreen.prototype.removeFromPage.call(this);

        this.stopRenderLoop();

        window.removeEventListener("resize", this._resizeEventListener);
        this._resizeEventListener = null;

        this._canvases = new Object();

        this._sceneCanvasBindings = new Array();

        armada.resources().clearResourceContextBindings();
    };

    HTMLScreenWithCanvases.prototype.hide = function () {
        HTMLScreen.prototype.hide.call(this);
        this.stopRenderLoop();
    };

    /**
     * Initializes the components of the parent class, then the additional ones for
     * this class (the canvases).
     */
    HTMLScreenWithCanvases.prototype._initializeComponents = function () {
        HTMLScreen.prototype._initializeComponents.call(this);

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
    HTMLScreenWithCanvases.prototype.getScreenCanvas = function (name) {
        return this._canvases[this._name + "_" + name];
    };

    /**
     * Creates a binding between the passed scene and canvas, causing the scene to
     * be rendered on the canvas automatically in the render loop of this screen.
     * @param {Scene} scene
     * @param {ScreenCanvas} canvas
     */
    HTMLScreenWithCanvases.prototype.bindSceneToCanvas = function (scene, canvas) {
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
            canvas.getManagedContext().setup();
        }
    };

    /**
     * Renders the scenes displayed on this screen.
     */
    HTMLScreenWithCanvases.prototype.render = function () {
        var i, d, dt;
        d = new Date();
        dt = (this._renderTimes && (this._renderTimes.length > 0)) ? (d - this._renderTimes[this._renderTimes.length - 1]) : 0;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].scene.cleanUp();
            this._sceneCanvasBindings[i].scene.render(this._sceneCanvasBindings[i].canvas.getManagedContext(), dt);
        }
        if (this._renderLoop !== null) {
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
    HTMLScreenWithCanvases.prototype.startRenderLoop = function (interval) {
        var i;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].canvas.getManagedContext().setup();
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
    HTMLScreenWithCanvases.prototype.stopRenderLoop = function () {
        clearInterval(this._renderLoop);
        this._renderLoop = null;
    };

    /**
     * Returns the Frames Per Second count for this screen's render loop.
     * @returns {Number}
     */
    HTMLScreenWithCanvases.prototype.getFPS = function () {
        return this._renderTimes.length;
    };

    HTMLScreenWithCanvases.prototype.resizeCanvas = function (name) {
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
    HTMLScreenWithCanvases.prototype.resizeCanvases = function () {
        // first, update the canvas width and height properties if the client width/
        // height has changed
        for (var canvasName in this._canvases) {
            if (this._canvases[canvasName].isResizeable() === true) {
                this.resizeCanvas(canvasName);
            }
        }
    };

    /**
     * Defines a menu screen object.
     * @class A game screen with a {@link MenuComponent}.
     * @extends HTMLScreen
     * @param {String} name See {@link GameScreen}
     * @param {String} source See {@link GameScreen}
     * @param {Object[]} menuOptions The menuOptions for creating the {@link MenuComponent}
     * @param {String} [menuContainerID] The ID of the HTML element inside of which
     * the menu should be added (if omitted, it will be appended to body)
     * @returns {MenuScreen}
     */
    function MenuScreen(name, source, menuOptions, menuContainerID) {
        HTMLScreen.call(this, name, source);
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
        this._menuComponent = this.registerExternalComponent(new components.MenuComponent(name + "_menu", "menucomponent.html", this._menuOptions), this._menuContainerID);
    }
    ;

    MenuScreen.prototype = new HTMLScreen();
    MenuScreen.prototype.constructor = MenuScreen;

    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        HTMLScreen: HTMLScreen,
        HTMLScreenWithCanvases: HTMLScreenWithCanvases,
        MenuScreen: MenuScreen
    };
});